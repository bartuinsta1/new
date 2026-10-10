// Seslendirme (§4.5): SSML, ses seçimi, önbellek, hata toleransı, klon ses, akışta sıra.
import { test } from "node:test";
import assert from "node:assert/strict";
import { AzureTts, buildSsml, escapeXml, MemoryAudioStore, type SynthesisInput, type TtsProvider } from "../supabase/functions/_shared/tts/tts.ts";
import { MemoryCloneVoiceStore, voiceStory } from "../supabase/functions/_shared/tts/voice.ts";
import { MemoryCostLog } from "../supabase/functions/_shared/engine/store.ts";
import { mockStory } from "../supabase/functions/_shared/mock.ts";
import { createStoriesHandler } from "../supabase/functions/stories/handler.ts";
import { MemoryStores, mockAuth, RateLimiter } from "../supabase/functions/_shared/http.ts";
import { baseRequest, deps, goodStory } from "./fake-llm.ts";

class FakeTts implements TtsProvider {
  readonly name: string;
  readonly usdPerMillionChars = 16;
  calls: SynthesisInput[] = [];
  failOn?: number;
  constructor(name = "fake") { this.name = name; }
  voiceKey(i: SynthesisInput) { return `${this.name}:${i.tone}:${i.emotion}:${i.cloneVoiceId ?? ""}`; }
  async synthesize(i: SynthesisInput) {
    this.calls.push(i);
    if (this.failOn === this.calls.length) throw new Error("tts down");
    return new TextEncoder().encode(`mp3:${i.text}`);
  }
}

const story = mockStory({ ...baseRequest, language: "tr" }, "s1");

test("SSML: ses, ~%85 hız, duygu tonu, XML kaçışı", () => {
  const ssml = buildSsml({ text: `Fındık "merhaba" & <selam>`, language: "tr", tone: "mother", emotion: "neutral" });
  assert.match(ssml, /xml:lang="tr-TR"/);
  assert.match(ssml, /name="tr-TR-EmelNeural"/);
  assert.match(ssml, /rate="-15%"/);
  assert.match(ssml, /&quot;merhaba&quot; &amp; &lt;selam&gt;/);
  assert.ok(!ssml.includes("<selam>"));
  // Dede: daha yavaş ve pes; uykulu paragraf: daha da yavaş, yumuşak
  const dede = buildSsml({ text: "x", language: "tr", tone: "grandfather", emotion: "sleepy" });
  assert.match(dede, /tr-TR-AhmetNeural/);
  assert.match(dede, /rate="-30%"/);
  assert.match(dede, /pitch="-13%"/);
  assert.match(dede, /volume="soft"/);
  assert.match(buildSsml({ text: "x", language: "en", tone: "father", emotion: "surprised" }), /en-US-AndrewNeural.*rate="-11%" pitch="\+6%"/);
  assert.equal(escapeXml(`a'b`), "a&apos;b");
});

test("Azure isteği: doğru uç nokta, başlıklar, gövde SSML", async () => {
  let captured: { url: string; init: RequestInit } | undefined;
  const fetchFn = (async (url: string, init: RequestInit) => {
    captured = { url, init };
    return new Response(new Uint8Array([1, 2, 3]));
  }) as unknown as typeof fetch;
  const tts = new AzureTts({ key: "k", region: "westeurope", fetchFn });
  const bytes = await tts.synthesize({ text: "Merhaba", language: "tr", tone: "mother", emotion: "smiling" });
  assert.equal(bytes.length, 3);
  assert.equal(captured!.url, "https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1");
  const h = captured!.init.headers as Record<string, string>;
  assert.equal(h["Ocp-Apim-Subscription-Key"], "k");
  assert.equal(h["Content-Type"], "application/ssml+xml");
  assert.match(String(captured!.init.body), /Merhaba/);
});

test("her paragraf sırayla seslendirilir ve hazır oldukça bildirilir", async () => {
  const tts = new FakeTts(), audio = new MemoryAudioStore(), costs = new MemoryCostLog();
  const emitted: number[] = [];
  const r = await voiceStory(story, { language: "tr", voice: "mother", duration_minutes: 5 }, { tts, audio, costs },
    { onParagraph: (p) => { emitted.push(p.index); } });
  assert.deepEqual(emitted, story.paragraphs.map((p) => p.index));
  assert.ok(r.paragraphs.every((p) => p.audio_url?.startsWith("https://cdn.masalcik.test/tts/")));
  assert.equal(r.synthesizedChars, story.paragraphs.reduce((s, p) => s + p.text.length, 0));
  assert.equal(costs.entries[0].outcome, "tts");
  assert.ok(r.costUSD > 0);
});

test("önbellek: aynı metin + ses ikinci kez seslendirilmez", async () => {
  const tts = new FakeTts(), audio = new MemoryAudioStore();
  await voiceStory(story, { language: "tr", voice: "mother", duration_minutes: 5 }, { tts, audio });
  const n = tts.calls.length;
  const again = await voiceStory(story, { language: "tr", voice: "mother", duration_minutes: 5 }, { tts, audio });
  assert.equal(tts.calls.length, n);
  assert.equal(again.cachedParagraphs, story.paragraphs.length);
  assert.equal(again.synthesizedChars, 0);
  // Farklı ses → yeni dosya
  await voiceStory(story, { language: "tr", voice: "grandfather", duration_minutes: 5 }, { tts, audio });
  assert.equal(tts.calls.length, n * 2);
});

test("TTS hatası: o paragraf audio_url null (cihaz sesi), diğerleri devam eder", async () => {
  const tts = new FakeTts();
  tts.failOn = 2;
  const r = await voiceStory(story, { language: "tr", voice: "mother", duration_minutes: 5 }, { tts, audio: new MemoryAudioStore() });
  assert.equal(r.failedParagraphs, 1);
  assert.equal(r.paragraphs[1].audio_url, null);
  assert.ok(r.paragraphs[2].audio_url);
});

test("klon ses: klon varsa klon sağlayıcı, yoksa 'Anne' sesine düşer", async () => {
  const tts = new FakeTts("azure"), clone = new FakeTts("eleven");
  await voiceStory(story, { language: "tr", voice: "parent_clone", duration_minutes: 5 }, { tts, cloneTts: clone, audio: new MemoryAudioStore() },
    { cloneVoiceId: "v-123" });
  assert.ok(clone.calls.length > 0 && tts.calls.length === 0);
  assert.equal(clone.calls[0].cloneVoiceId, "v-123");
  const tts2 = new FakeTts("azure"), clone2 = new FakeTts("eleven");
  await voiceStory(story, { language: "tr", voice: "parent_clone", duration_minutes: 5 }, { tts: tts2, cloneTts: clone2, audio: new MemoryAudioStore() },
    { cloneVoiceId: null });
  assert.equal(clone2.calls.length, 0);
  assert.equal(tts2.calls[0].tone, "mother");
});

test("akış: started → voicing → sesli paragraflar → completed; GET sesli masalı döndürür", async () => {
  const stores = new MemoryStores();
  const engine = deps([goodStory()]);
  const tts = new FakeTts();
  const h = createStoriesHandler({
    auth: mockAuth, usage: stores, entitlements: stores, limiter: new RateLimiter(100, 60_000), engine, heartbeatMs: 5,
    voice: { tts, audio: new MemoryAudioStore(), costs: engine.costs }, cloneVoices: new MemoryCloneVoiceStore(),
  });
  const res = await h(new Request("https://x/functions/v1/stories", { method: "POST", headers: { authorization: "Bearer user-1" }, body: JSON.stringify(baseRequest) }));
  const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
  const kinds = lines.map((l) => l.type === "progress" ? `progress:${l.stage}` : l.type);
  const startedAt = kinds.indexOf("started");
  assert.equal(kinds[startedAt + 1], "progress:voicing");
  const paragraphs = lines.filter((l) => l.type === "paragraph");
  assert.equal(paragraphs.length, 6);
  assert.ok(paragraphs.every((l) => l.paragraph.audio_url));
  const id = lines[startedAt].id;
  const got = await (await h(new Request(`https://x/functions/v1/stories/${id}`, { headers: { authorization: "Bearer user-1" } }))).json();
  assert.ok(got.paragraphs.every((p: { audio_url: string | null }) => p.audio_url));
  const summary = await engine.costs.summary(new Date(0));
  assert.ok(summary.ttsCharacters > 0 && summary.ttsCostUSD > 0);
  assert.equal(summary.stories, 1);   // TTS kaydı masal sayısına girmez
});
