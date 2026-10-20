// Ses klonu (ElevenLabs) ve ses dosyası deposu (Supabase Storage): sahte fetch ile istek biçimi ve silme zinciri.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createVoiceCloneHandler } from "../supabase/functions/voice-clone/handler.ts";
import { createAccountHandler } from "../supabase/functions/account/handler.ts";
import { MemoryStores, mockAuth } from "../supabase/functions/_shared/http.ts";
import { ElevenLabsVoiceCloner, MemoryAudioStore, type TtsProvider } from "../supabase/functions/_shared/tts/tts.ts";
import { MemoryCloneVoiceStore, voiceStory, type VoiceCloner } from "../supabase/functions/_shared/tts/voice.ts";
import { SupabaseStorageAudioStore } from "../supabase/functions/_shared/tts/storage.ts";
import { mockStory } from "../supabase/functions/_shared/mock.ts";
import type { StoryRequest } from "../supabase/functions/_shared/contract.ts";

class FakeCloner implements VoiceCloner {
  created = 0;
  deleted: string[] = [];
  failDelete = false;
  async create() { this.created++; return `voice-${this.created}`; }
  async delete(id: string) { if (this.failDelete) throw new Error("down"); this.deleted.push(id); }
}

const BASE = "https://x/functions/v1";
const sample = new Uint8Array(40 * 1024);
const post = () => new Request(`${BASE}/voice-clone`, { method: "POST", body: sample,
  headers: { authorization: "Bearer user-1", "x-consent-at": new Date().toISOString(), "content-type": "audio/m4a" } });
const del = (path = "voice-clone") => new Request(`${BASE}/${path}`, { method: "DELETE", headers: { authorization: "Bearer user-1" } });

async function setup() {
  const stores = new MemoryStores();
  await stores.setPremium("user-1", null);
  const cloneVoices = new MemoryCloneVoiceStore();
  const cloner = new FakeCloner();
  const audio = new MemoryAudioStore();
  return { stores, cloneVoices, cloner, audio,
           h: createVoiceCloneHandler({ auth: mockAuth, entitlements: stores, cloneVoices, cloner, audio }) };
}

test("klon oluşturulur; yeniden kayıtta eski ses önce silinir", async () => {
  const { h, cloner, cloneVoices } = await setup();
  const res = await h(post());
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { voice_id: "voice-1", status: "ready" });
  await h(post());
  assert.deepEqual(cloner.deleted, ["voice-1"]);
  assert.equal(await cloneVoices.get("user-1"), "voice-2");
});

test("silme: sağlayıcı + kayıt + klon sesle üretilmiş dosyalar; ortak dosyalar kalır", async () => {
  const { h, cloner, cloneVoices, audio } = await setup();
  await h(post());
  await audio.put("clone/user-1/a.mp3", new Uint8Array(1), "audio/mpeg");
  await audio.put("clone/user-2/b.mp3", new Uint8Array(1), "audio/mpeg");
  await audio.put("tts/c.mp3", new Uint8Array(1), "audio/mpeg");
  assert.equal((await h(del())).status, 204);
  assert.deepEqual(cloner.deleted, ["voice-1"]);
  assert.equal(await cloneVoices.get("user-1"), null);
  assert.deepEqual([...audio.files.keys()].sort(), ["clone/user-2/b.mp3", "tts/c.mp3"]);
});

test("sağlayıcı silemezse kayıt silinmez (yarım silme yok), hesap silme de durur", async () => {
  const { h, cloner, cloneVoices, stores, audio } = await setup();
  await h(post());
  cloner.failDelete = true;
  assert.equal((await h(del())).status, 502);
  assert.equal(await cloneVoices.get("user-1"), "voice-1");
  const account = createAccountHandler({ auth: mockAuth, usage: stores, entitlements: stores, cloneVoices, cloner, audio });
  assert.equal((await account(del("account"))).status, 502);
  cloner.failDelete = false;
  assert.equal((await account(del("account"))).status, 204);
  assert.equal(await cloneVoices.get("user-1"), null);
  assert.equal(await stores.isPremium("user-1"), false);
});

test("klon sesle seslendirilen paragraflar sahibinin klasörüne yazılır", async () => {
  const audio = new MemoryAudioStore();
  const tts: TtsProvider = { name: "fake", usdPerMillionChars: 1, voiceKey: (i) => `fake:${i.tone}:${i.cloneVoiceId}`,
                             synthesize: async () => new Uint8Array([1]) };
  const req: StoryRequest = { child_name: "Ela", child_age: 5, interests: [], companion_character: "findik",
    region: "star_hill", mood: "calm", duration_minutes: 5, recurring_characters: [], recent_story_titles: [],
    voice: "parent_clone", language: "tr",
    content_filters: { allow_mild_scary: false, allow_conflict: false, allow_loss_and_separation: false } };
  await voiceStory(mockStory(req), req, { tts, cloneTts: tts, audio }, { cloneVoiceId: "v-1", cloneOwner: "user-9" });
  assert.ok([...audio.files.keys()].every((k) => k.startsWith("clone/user-9/")));
  const plain = new MemoryAudioStore();
  await voiceStory(mockStory(req), { ...req, voice: "mother" }, { tts, audio: plain }, { cloneOwner: "user-9" });
  assert.ok([...plain.files.keys()].every((k) => k.startsWith("tts/")));
});

test("ElevenLabs: çok parçalı yükleme, kişisel veri içermeyen ad; 404 silme başarı sayılır", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (init.method === "DELETE") return new Response(null, { status: 404 });
    return Response.json({ voice_id: "el-123" });
  }) as typeof fetch;
  const c = new ElevenLabsVoiceCloner({ key: "k", fetchFn });
  assert.equal(await c.create(sample, "audio/m4a"), "el-123");
  assert.equal(calls[0].url, "https://api.elevenlabs.io/v1/voices/add");
  assert.equal((calls[0].init.headers as Record<string, string>)["xi-api-key"], "k");
  const form = calls[0].init.body as FormData;
  assert.match(String(form.get("name")), /^masalcik-[0-9a-f]{8}$/);
  assert.ok(form.get("files") instanceof Blob);
  await c.delete("el-123");
  assert.equal(calls[1].url, "https://api.elevenlabs.io/v1/voices/el-123");
});

test("Supabase Storage: yoksa null, yükle → imzalı URL, klasör silme", async () => {
  const objects = new Set<string>();
  const log: string[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    const u = new URL(url);
    log.push(`${init.method} ${u.pathname}`);
    assert.equal((init.headers as Record<string, string>).authorization, "Bearer svc");
    const m = u.pathname.match(/^\/storage\/v1\/object\/(sign\/|list\/)?audio\/?(.*)$/)!;
    if (m[1] === "sign/") {
      return objects.has(decodeURIComponent(m[2]))
        ? Response.json({ signedURL: `/object/sign/audio/${m[2]}?token=t` })
        : Response.json({ error: "not_found" }, { status: 400 });
    }
    if (m[1] === "list/") {
      const { prefix } = JSON.parse(String(init.body));
      return Response.json([...objects].filter((o) => o.startsWith(`${prefix}/`)).map((o) => ({ name: o.slice(prefix.length + 1) })));
    }
    if (init.method === "POST") { objects.add(decodeURIComponent(m[2])); return Response.json({ Key: m[2] }); }
    if (init.method === "DELETE") {
      for (const p of JSON.parse(String(init.body)).prefixes) objects.delete(p);
      return Response.json([]);
    }
    return new Response(null, { status: 500 });
  }) as typeof fetch;
  const s = new SupabaseStorageAudioStore({ url: "https://p.supabase.co", serviceKey: "svc", bucket: "audio", fetchFn });
  assert.equal(await s.find("tts/x.mp3"), null);
  const url = await s.put("clone/u1/x.mp3", new Uint8Array([1]), "audio/mpeg");
  assert.equal(url, "https://p.supabase.co/storage/v1/object/sign/audio/clone/u1/x.mp3?token=t");
  assert.equal(await s.find("clone/u1/x.mp3"), url);
  await s.put("clone/u1/y.mp3", new Uint8Array([1]), "audio/mpeg");
  await s.put("tts/z.mp3", new Uint8Array([1]), "audio/mpeg");
  await s.deletePrefix("clone/u1/");
  assert.deepEqual([...objects], ["tts/z.mp3"]);
});
