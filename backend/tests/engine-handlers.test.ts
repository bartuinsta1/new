// /stories uç noktası gerçek motorla (sahte LLM) + yönetim maliyet panosu.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createStoriesHandler } from "../supabase/functions/stories/handler.ts";
import { createAdminCostsHandler } from "../supabase/functions/admin-costs/handler.ts";
import { MemoryStores, mockAuth, RateLimiter } from "../supabase/functions/_shared/http.ts";
import { baseRequest, deps, goodStory, storyWith } from "./fake-llm.ts";

const BASE = "https://x.supabase.co/functions/v1";
const post = (body: unknown, user = "user-1", headers: Record<string, string> = {}) =>
  new Request(`${BASE}/stories`, { method: "POST", headers: { authorization: `Bearer ${user}`, ...headers }, body: JSON.stringify(body) });

function setup(writes = [goodStory()]) {
  const stores = new MemoryStores();
  const engine = deps(writes);
  const h = createStoriesHandler({ auth: mockAuth, usage: stores, entitlements: stores, limiter: new RateLimiter(100, 60_000), engine, heartbeatMs: 5 });
  return { stores, engine, h };
}

async function lines(res: Response) {
  return (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
}

test("akış: progress → started → paragraflar → completed; masal saklanır", async () => {
  const { h, engine } = setup();
  const res = await h(post(baseRequest));
  const all = await lines(res);
  assert.equal(all[0].type, "progress");
  const real = all.filter((l) => l.type !== "progress");
  assert.equal(real[0].type, "started");
  assert.equal(real.at(-1).type, "completed");
  assert.equal(real.filter((l) => l.type === "paragraph").length, 6);
  const id = real[0].id;
  const get = await h(new Request(`${BASE}/stories/${id}`, { headers: { authorization: "Bearer user-1" } }));
  assert.equal((await get.json()).id, id);
  // Başkasının masalı görünmez
  const other = await h(new Request(`${BASE}/stories/${id}`, { headers: { authorization: "Bearer user-2" } }));
  assert.equal(other.status, 404);
  assert.equal(engine.llm.writes.length, 1);
});

test("uygunsuz ad: akış başlamadan 400, kota düşmez", async () => {
  const { h, stores, engine } = setup();
  const res = await h(post({ ...baseRequest, child_name: "Zombi" }));
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "unsafe_input" });
  assert.equal(await stores.personalStoriesOn("user-1", "2026-10-10"), 0);
  assert.equal(engine.llm.writes.length, 0);
});

test("idempotency: aynı anahtarla ikinci istek kota düşürmez ve yeniden üretmez", async () => {
  const { h, engine } = setup([goodStory(), goodStory()]);
  const a = (await lines(await h(post(baseRequest, "user-1", { "idempotency-key": "abc" })))).find((l) => l.type === "started");
  const second = await h(post(baseRequest, "user-1", { "idempotency-key": "abc" }));
  assert.equal(second.status, 200);   // ücretsiz limit dolu olsa da önbellekten döner
  const b = (await lines(second)).find((l) => l.type === "started");
  assert.equal(a.id, b.id);
  assert.equal(engine.llm.writes.length, 1);
});

test("güvenlik ihlalinde çocuk yine bir masal dinler (yedek)", async () => {
  const bad = storyWith("Canavar gelmiş.");
  const { h } = setup([bad, bad]);
  const done = (await lines(await h(post(baseRequest)))).find((l) => l.type === "completed");
  assert.equal(done.story.is_fallback, true);
  assert.ok(!JSON.stringify(done.story).includes("Canavar"));
});

test("yönetim maliyet panosu: yalnızca ADMIN_TOKEN ile, kişisel veri yok", async () => {
  const { h, engine } = setup([goodStory()]);
  await lines(await h(post(baseRequest)));
  const admin = createAdminCostsHandler({ costs: engine.costs, adminToken: "secret", now: () => new Date("2026-10-11T00:00:00Z") });
  assert.equal((await admin(new Request(`${BASE}/admin-costs`))).status, 401);
  assert.equal((await admin(new Request(`${BASE}/admin-costs`, { headers: { authorization: "Bearer wrong" } }))).status, 401);
  const res = await admin(new Request(`${BASE}/admin-costs?days=7`, { headers: { authorization: "Bearer secret" } }));
  const body = await res.json();
  assert.equal(body.stories, 1);
  assert.ok(body.avgCostUSD > 0);
  assert.equal(body.byDay.length, 1);
  assert.ok(!JSON.stringify(body).includes("Ayşe"));
  assert.ok(!JSON.stringify(body).includes("user-1"));
  // ADMIN_TOKEN tanımsızsa pano kapalı
  const closed = createAdminCostsHandler({ costs: engine.costs });
  assert.equal((await closed(new Request(`${BASE}/admin-costs`, { headers: { authorization: "Bearer " } }))).status, 401);
});
