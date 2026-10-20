// Anonim kullanım olayları: yalnızca izinli olay/boyutlar, kimlik yok, aynı olaylar birleşir.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEventsHandler } from "../supabase/functions/events/handler.ts";
import { MemoryAnalyticsStore } from "../supabase/functions/_shared/analytics.ts";
import { mockAuth, RateLimiter } from "../supabase/functions/_shared/http.ts";

const post = (body: unknown, user = "user-1") => new Request("https://x/functions/v1/events", {
  method: "POST", headers: { authorization: `Bearer ${user}` }, body: JSON.stringify(body),
});

test("geçerli olaylar sayılır, geçersizler atlanır, kimlik saklanmaz", async () => {
  const store = new MemoryAnalyticsStore();
  const h = createEventsHandler({ auth: mockAuth, store, limiter: new RateLimiter(100, 60_000),
                                  now: () => new Date("2026-10-20T22:30:00Z") });
  const res = await h(post({ events: [
    { name: "story_started", dims: { region: "star_hill", mood: "calm", library: false } },
    { name: "story_started", dims: { mood: "calm", library: false, region: "star_hill" } },
    { name: "paywall_shown" },
    { name: "story_finished", dims: { minutes: "5-10" } },
    { name: "story_started", dims: { region: "star_hill", mood: "calm", library: false, child: "Zeynep" } },
    { name: "unknown_event" },
    { name: "onboarding_step", dims: { step: 99 } },
    "çöp",
  ] }));
  assert.equal(res.status, 202);
  assert.deepEqual(await res.json(), { accepted: 4 });
  // Türkiye saatiyle ertesi gün (22:30 UTC = 01:30 TR)
  assert.equal(store.counts.get('2026-10-21|story_started|{"library":false,"mood":"calm","region":"star_hill"}'), 2);
  assert.equal(store.counts.get("2026-10-21|paywall_shown|{}"), 1);
  assert.ok(![...store.counts.keys()].some((k) => k.includes("user-1") || k.includes("Zeynep")));
});

test("sınırlar: oturum, 50 olay, hız", async () => {
  const store = new MemoryAnalyticsStore();
  const h = createEventsHandler({ auth: mockAuth, store, limiter: new RateLimiter(2, 60_000) });
  assert.equal((await h(new Request("https://x/functions/v1/events", { method: "POST", body: "{}" }))).status, 401);
  assert.equal((await h(post({ events: Array(51).fill({ name: "paywall_shown" }) }))).status, 400);
  assert.equal((await h(post({ events: [] }))).status, 202);
  assert.equal((await h(post({ events: [] }))).status, 429);
});
