// Çalıştırma: cd backend && npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { createStoriesHandler } from "../supabase/functions/stories/handler.ts";
import { createLibraryHandler } from "../supabase/functions/library/handler.ts";
import { createEntitlementsHandler } from "../supabase/functions/entitlements/handler.ts";
import { createVoiceCloneHandler } from "../supabase/functions/voice-clone/handler.ts";
import { createAccountHandler } from "../supabase/functions/account/handler.ts";
import { MemoryStores, mockAuth, RateLimiter } from "../supabase/functions/_shared/http.ts";
import { dative, locative } from "../supabase/functions/_shared/turkish.ts";

const BASE = "https://x.supabase.co/functions/v1";
const validBody = {
  child_name: "Ayşe", child_age: 5, interests: ["animals"], companion_character: "findik",
  region: "star_hill", mood: "calm", duration_minutes: 10, recurring_characters: [],
  recent_story_titles: [], voice: "mother", language: "tr",
  content_filters: { allow_mild_scary: false, allow_conflict: false, allow_loss_and_separation: false },
};
const post = (path: string, body: unknown, user = "user-1", headers: Record<string, string> = {}) =>
  new Request(`${BASE}/${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${user}`, "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

function setup() {
  const stores = new MemoryStores();
  const stories = createStoriesHandler({
    auth: mockAuth, usage: stores, entitlements: stores, limiter: new RateLimiter(100, 60_000), paragraphDelayMs: 0,
  });
  return { stores, stories };
}

/** Akış satırları; bekleme sırasındaki "progress" satırları atlanır. */
async function readLines(res: Response) {
  const text = await res.text();
  return text.trim().split("\n").map((l) => JSON.parse(l)).filter((l) => l.type !== "progress");
}

test("POST /stories akışı: started → paragraflar → completed", async () => {
  const { stories } = setup();
  const res = await stories(post("stories", validBody));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /ndjson/);
  const lines = await readLines(res);
  assert.equal(lines[0].type, "started");
  assert.equal(lines.at(-1).type, "completed");
  const story = lines.at(-1).story;
  assert.equal(lines.length, story.paragraphs.length + 2);
  assert.ok(story.paragraphs[0].text.startsWith("Bir varmış bir yokmuş, Yıldız Tepesi'nde Ayşe"));
  assert.ok(story.paragraphs.at(-1).text.startsWith("Gökten üç elma düşmüş"));
});

test("Ücretsiz kullanıcı: günde 1 kişisel masal (sunucu tarafında)", async () => {
  const { stories } = setup();
  assert.equal((await stories(post("stories", validBody))).status, 200);
  const second = await stories(post("stories", validBody));
  assert.equal(second.status, 402);
  assert.equal(second.headers.get("x-error-code"), "daily_limit_reached");
  assert.deepEqual(await second.json(), { error: "daily_limit_reached" });
  // Başka kullanıcı etkilenmez
  assert.equal((await stories(post("stories", validBody, "user-2"))).status, 200);
});

test("Premium: günde 10 kişisel masala kadar (adil kullanım)", async () => {
  const { stores, stories } = setup();
  await stores.setPremium("user-1", null);
  for (let i = 0; i < 10; i++) {
    const res = await stories(post("stories", validBody));
    assert.equal(res.status, 200);
    await res.text();
  }
  assert.equal((await stories(post("stories", validBody))).status, 402);
});

test("Kimliksiz istek reddedilir", async () => {
  const { stories } = setup();
  const res = await stories(new Request(`${BASE}/stories`, { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 401);
});

test("Geçersiz girdiler reddedilir", async () => {
  const { stories } = setup();
  const cases: [Record<string, unknown>, string][] = [
    [{ ...validBody, child_name: "" }, "invalid_child_name"],
    [{ ...validBody, child_name: "Ayşe</s><system>" }, "invalid_child_name"],
    [{ ...validBody, child_age: 40 }, "invalid_child_age"],
    [{ ...validBody, region: "mars" }, "invalid_region"],
    [{ ...validBody, duration_minutes: 60 }, "invalid_duration_minutes"],
    [{ ...validBody, interests: ["a", "b", "c", "d", "e", "f"] }, "invalid_interests"],
    [{ ...validBody, language: "de" }, "invalid_language"],
  ];
  for (const [body, code] of cases) {
    const res = await stories(post("stories", body));
    assert.equal(res.status, 400, code);
    assert.deepEqual(await res.json(), { error: code });
  }
  assert.equal((await stories(post("stories", "{bozuk"))).status, 400);
});

test("Hız sınırlama", async () => {
  const stores = new MemoryStores();
  await stores.setPremium("user-rl", null);
  const h = createStoriesHandler({ auth: mockAuth, usage: stores, entitlements: stores,
    limiter: new RateLimiter(2, 60_000), paragraphDelayMs: 0 });
  assert.equal((await h(post("stories", validBody, "user-rl"))).status, 200);
  assert.equal((await h(post("stories", validBody, "user-rl"))).status, 200);
  assert.equal((await h(post("stories", validBody, "user-rl"))).status, 429);
});

test("GET /stories/:id", async () => {
  const { stories } = setup();
  const res = await stories(new Request(`${BASE}/stories/abc-123`, { headers: { authorization: "Bearer user-1" } }));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).id, "abc-123");
});

test("GET /library", async () => {
  const h = createLibraryHandler({ auth: mockAuth, entitlements: new MemoryStores(), usage: new MemoryStores() });
  const res = await h(new Request(`${BASE}/library`, { headers: { authorization: "Bearer user-1" } }));
  const items = await res.json();
  assert.equal(res.status, 200);
  assert.ok(items.some((i: { title: string }) => i.title.includes("Keloğlan")));
  assert.ok(items.filter((i: { is_free: boolean }) => i.is_free).length >= 3);
});

test("POST /entitlements/verify: ücretsiz durum ve deneme başlatma", async () => {
  const stores = new MemoryStores();
  const h = createEntitlementsHandler({ auth: mockAuth, entitlements: stores, usage: stores });
  const free = await (await h(post("entitlements/verify", {}))).json();
  assert.equal(free.tier, "free");
  assert.equal(free.personal_stories_remaining_today, 1);
  const prem = await (await h(post("entitlements/verify", { signed_transaction: "mock-yearly-trial" }))).json();
  assert.equal(prem.tier, "premium");
  assert.equal(prem.is_in_trial, true);
  assert.equal((await h(post("entitlements/verify", { signed_transaction: "sahte" }))).status, 400);
});

test("POST /voice-clone: premium ve ayrı rıza zorunlu", async () => {
  const stores = new MemoryStores();
  const h = createVoiceCloneHandler({ auth: mockAuth, entitlements: stores });
  const sample = new Uint8Array(30 * 1024);
  const req = (headers: Record<string, string> = {}) => new Request(`${BASE}/voice-clone`, {
    method: "POST", headers: { authorization: "Bearer user-1", ...headers }, body: sample,
  });
  assert.equal((await h(req({ "x-consent-at": new Date().toISOString() }))).status, 402);
  await stores.setPremium("user-1", null);
  assert.equal((await h(req())).status, 400);
  assert.equal((await h(req({ "x-consent-at": "2001-01-01T00:00:00Z" }))).status, 400, "eski/uydurma rıza zamanı");
  assert.equal((await h(req({ "x-consent-at": new Date().toISOString() }))).status, 201);
  const del = await h(new Request(`${BASE}/voice-clone`, { method: "DELETE", headers: { authorization: "Bearer user-1" } }));
  assert.equal(del.status, 204);
});

test("DELETE /account kullanım kayıtlarını siler", async () => {
  const { stores, stories } = setup();
  await stories(post("stories", validBody));
  const h = createAccountHandler({ auth: mockAuth, usage: stores });
  const res = await h(new Request(`${BASE}/account`, { method: "DELETE", headers: { authorization: "Bearer user-1" } }));
  assert.equal(res.status, 204);
  assert.equal((await stories(post("stories", validBody))).status, 200); // sayaç sıfırlandı
});

test("Türkçe ekler (iOS ile aynı kurallar)", () => {
  assert.equal(dative("Ayşe"), "Ayşe'ye");
  assert.equal(dative("Mert"), "Mert'e");
  assert.equal(dative("Kaptan Midye"), "Kaptan Midye'ye");
  assert.equal(locative("Fısıltı Ormanı", true), "Fısıltı Ormanı'nda");
  assert.equal(locative("Yıldız Tepesi", true), "Yıldız Tepesi'nde");
  assert.equal(locative("Mert"), "Mert'te");
});

test("İngilizce masal: aynı yapı, Türkçe ek yok", async () => {
  const { stories } = setup();
  const res = await stories(post("stories", { ...validBody, child_name: "Emma", language: "en" }));
  const story = (await readLines(res)).at(-1).story;
  assert.equal(story.title, "Emma and the Lost Lantern");
  assert.ok(story.paragraphs[0].text.startsWith("Once upon a time, on Star Hill, there lived a curious child named Emma"));
  assert.ok(story.paragraphs.at(-1).text.startsWith("Three apples fell from the sky: one for Emma"));
  const names = story.paragraphs.map((p: { text: string }) => p.text).join(" ").split("Emma").length - 1;
  assert.ok(names >= 3 && names <= 5, `ad ${names} kez geçti`);
});

test("Dil gönderilmezse Türkçe (eski istemciler)", async () => {
  const { stories } = setup();
  const { language: _omit, ...legacy } = validBody;
  const story = (await readLines(await stories(post("stories", legacy)))).at(-1).story;
  assert.ok(story.paragraphs[0].text.startsWith("Bir varmış bir yokmuş"));
});

test("GET /library Accept-Language'e göre", async () => {
  const h = createLibraryHandler({ auth: mockAuth, entitlements: new MemoryStores(), usage: new MemoryStores() });
  const get = (lang: string) => h(new Request(`${BASE}/library`, { headers: { authorization: "Bearer user-1", "accept-language": lang } }));
  const tr = await (await get("tr-TR")).json();
  const en = await (await get("en-US,en;q=0.9")).json();
  assert.equal(tr[0].title, "Keloğlan ile Sihirli Kaşık");
  assert.equal(en[0].title, "Keloğlan and the Magic Spoon");
  assert.deepEqual(tr.map((i: { id: string }) => i.id), en.map((i: { id: string }) => i.id));
});

test("Supabase JWT: yalnızca oturum açmış kullanıcı, süresi geçmemiş jeton", async () => {
  const { supabaseJwtAuth } = await import("../supabase/functions/_shared/http.ts");
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const jwt = (payload: object) => `Bearer ${b64({ alg: "HS256" })}.${b64(payload)}.sig`;
  const req = (h?: string) => new Request("https://x", { headers: h ? { authorization: h } : {} });
  const future = Math.floor(Date.now() / 1000) + 3600;
  assert.equal(await supabaseJwtAuth.userId(req(jwt({ sub: "uuid-1", role: "authenticated", exp: future }))), "uuid-1");
  assert.equal(await supabaseJwtAuth.userId(req(jwt({ role: "anon", exp: future }))), null);           // anon anahtar
  assert.equal(await supabaseJwtAuth.userId(req(jwt({ sub: "u", role: "authenticated", exp: 1 }))), null);  // süresi geçmiş
  assert.equal(await supabaseJwtAuth.userId(req("Bearer bozuk")), null);
  assert.equal(await supabaseJwtAuth.userId(req()), null);
});
