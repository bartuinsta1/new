// Paylaşım bağlantıları ve hesap silme.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createShareHandler } from "../supabase/functions/share/handler.ts";
import { createAccountHandler } from "../supabase/functions/account/handler.ts";
import { MemoryStores, mockAuth, RateLimiter } from "../supabase/functions/_shared/http.ts";
import { MemoryStoryStore } from "../supabase/functions/_shared/engine/store.ts";
import { MemoryShareStore, newShareToken } from "../supabase/functions/_shared/share.ts";
import { MemoryCloneVoiceStore } from "../supabase/functions/_shared/tts/voice.ts";
import { mockStory } from "../supabase/functions/_shared/mock.ts";
import { baseRequest } from "./fake-llm.ts";

const BASE = "https://x/functions/v1";

async function setup(now = new Date("2026-10-11T19:00:00Z")) {
  const stories = new MemoryStoryStore();
  await stories.save({ userId: "user-1", story: mockStory(baseRequest, "story-1"), language: "tr", createdAt: now });
  const shares = new MemoryShareStore();
  const clock = { now };
  const h = createShareHandler({
    auth: mockAuth, stories, shares, limiter: new RateLimiter(5, 60_000),
    publicBaseUrl: "https://masalcik.app/", appStoreUrl: "https://apps.apple.com/app/masalcik", now: () => clock.now,
  });
  return { stories, shares, h, clock };
}

const create = (storyId: string, user = "user-1") => new Request(`${BASE}/share`, {
  method: "POST", headers: { authorization: `Bearer ${user}` }, body: JSON.stringify({ story_id: storyId }),
});

test("paylaşım: bağlantı oluşur, önizleme kişisel alan içermez", async () => {
  const { h } = await setup();
  const res = await h(create("story-1"));
  assert.equal(res.status, 201);
  const { url } = await res.json();
  assert.match(url, /^https:\/\/masalcik\.app\/s\/[\w-]{20,}$/);
  const token = url.split("/").pop();
  const preview = await (await h(new Request(`${BASE}/share/${token}`))).json();
  assert.equal(preview.title, "Ayşe ve Kayıp Fener");
  assert.equal(preview.paragraphs.length, 3, "önizlemeye masalın yalnızca başı gider");
  assert.equal(preview.app_store_url, "https://apps.apple.com/app/masalcik");
  const raw = JSON.stringify(preview);
  assert.ok(!raw.includes("user-1") && !raw.includes("story-1"), "önizleme kimlik sızdırıyor");
});

test("paylaşım: başkasının masalı paylaşılamaz, oturumsuz POST reddedilir", async () => {
  const { h } = await setup();
  assert.equal((await h(create("story-1", "user-2"))).status, 404);
  assert.equal((await h(new Request(`${BASE}/share`, { method: "POST", body: "{}" }))).status, 401);
  assert.equal((await h(create("x".repeat(65)))).status, 400);
});

test("paylaşım: 30 gün sonra süresi dolar; jetonlar benzersiz", async () => {
  const { h, clock } = await setup();
  const { url } = await (await h(create("story-1"))).json();
  clock.now = new Date(clock.now.getTime() + 31 * 86_400_000);
  assert.equal((await h(new Request(`${BASE}/share/${url.split("/").pop()}`))).status, 410);
  const tokens = new Set(Array.from({ length: 200 }, newShareToken));
  assert.equal(tokens.size, 200);
});

test("hesap silme: masallar, ses klonu, paylaşımlar ve kullanım silinir", async () => {
  const { h, stories, shares } = await setup();
  const { url } = await (await h(create("story-1"))).json();
  const usage = new MemoryStores();
  await usage.recordPersonalStory("user-1", "2026-10-11");
  const clones = new MemoryCloneVoiceStore();
  await clones.set("user-1", "v1");
  await clones.set("user-2", "v2");
  const account = createAccountHandler({ auth: mockAuth, usage, stories, cloneVoices: clones, shares });
  const res = await account(new Request(`${BASE}/account`, { method: "DELETE", headers: { authorization: "Bearer user-1" } }));
  assert.equal(res.status, 204);
  assert.equal(await stories.get("user-1", "story-1"), null);
  assert.equal(await clones.get("user-1"), null);
  assert.equal(await clones.get("user-2"), "v2");     // başka aile etkilenmez
  assert.equal(await usage.personalStoriesOn("user-1", "2026-10-11"), 0);
  assert.equal((await h(new Request(`${BASE}/share/${url.split("/").pop()}`))).status, 404);
});
