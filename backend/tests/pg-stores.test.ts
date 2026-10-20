// Postgres depoları — gerçek veritabanında (migrasyonlar uygulanmış). TEST_DATABASE_URL yoksa atlanır.
//   ./scripts/test-pg.sh   (yerel Postgres'i hazırlar ve bu testleri çalıştırır)
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  connect, deleteAuthUser, PgAnalyticsStore, PgCloneVoiceStore, PgCostLog, PgFlagLog, PgReferralStore, PgShareStore, PgStores,
  PgStoryStore, type Sql,
} from "../supabase/functions/_shared/pg/stores.ts";
import { createEntitlementsHandler } from "../supabase/functions/entitlements/handler.ts";
import { createLibraryHandler } from "../supabase/functions/library/handler.ts";
import { createReferralHandler } from "../supabase/functions/referral/handler.ts";
import { createAccountHandler } from "../supabase/functions/account/handler.ts";
import { mockAuth, RateLimiter } from "../supabase/functions/_shared/http.ts";
import { mockStory } from "../supabase/functions/_shared/mock.ts";
import type { StoryRequest } from "../supabase/functions/_shared/contract.ts";

const url = process.env.TEST_DATABASE_URL;
const NOW = new Date("2026-10-20T12:00:00Z");
const DAY = 86_400_000;

describe("Postgres depoları", { skip: !url && "TEST_DATABASE_URL yok" }, () => {
  let sql: Sql;
  const users: string[] = [];
  const newUser = async () => {
    const id = crypto.randomUUID();
    await sql`insert into auth.users (id) values (${id})`;
    users.push(id);
    return id;
  };
  const req: StoryRequest = {
    child_name: "Zeynep", child_age: 5, interests: ["animals"], companion_character: "findik", region: "star_hill",
    mood: "calm", duration_minutes: 10, recurring_characters: [], recent_story_titles: [], voice: "mother",
    language: "tr", content_filters: { allow_mild_scary: false, allow_conflict: false, allow_loss_and_separation: false },
  };

  before(() => { sql = connect(url!, { max: 2 }); });
  beforeEach(async () => {
    await sql`truncate usage_daily, library_usage_weekly, entitlements, stories, story_shares, referral_codes,
              referral_redemptions, voice_clones, flagged_content, cost_log, auth.users cascade`;
  });
  after(async () => { await sql.end(); });

  test("günlük kullanım sayacı ve haftalık kitaplık (tekrar sayılmaz)", async () => {
    const s = new PgStores(sql, () => NOW);
    const u = await newUser();
    assert.equal(await s.personalStoriesOn(u, "2026-10-20"), 0);
    await s.recordPersonalStory(u, "2026-10-20");
    await s.recordPersonalStory(u, "2026-10-20");
    assert.equal(await s.personalStoriesOn(u, "2026-10-20"), 2);
    await s.recordLibraryStory(u, "2026-10-19", "lib-hoca-1");
    await s.recordLibraryStory(u, "2026-10-19", "lib-hoca-1");
    await s.recordLibraryStory(u, "2026-10-19", "lib-star-2");
    assert.deepEqual(await s.libraryStoriesInWeek(u, "2026-10-19"), ["lib-hoca-1", "lib-star-2"]);
  });

  test("abonelik: kaydet, süre, geri yüklemede hesaba taşı, iade", async () => {
    const s = new PgStores(sql, () => NOW);
    const a = await newUser(), b = await newUser();
    const sub = { productId: "masalcik.premium.yearly", expiresAt: new Date(NOW.getTime() + 7 * DAY), isInTrial: true,
                  originalTransactionId: "1000000001", environment: "Sandbox" };
    await s.saveSubscription(a, sub);
    assert.equal(await s.isPremium(a), true);
    assert.equal((await s.subscription(a))?.isInTrial, true);
    await s.saveSubscription(b, sub);
    assert.equal(await s.isPremium(a), false, "bir abonelik aynı anda tek hesabı açar");
    assert.equal(await s.userForOriginalTransaction("1000000001"), b);
    await s.revoke("1000000001");
    assert.equal(await s.isPremium(b), false);
    await s.saveSubscription(b, { ...sub, expiresAt: new Date(NOW.getTime() - 1) });
    assert.equal(await s.isPremium(b), false, "süresi dolmuş");
  });

  test("davet ödülü birikir ve süresi dolar", async () => {
    let now = NOW;
    const s = new PgStores(sql, () => now);
    const u = await newUser();
    assert.equal((await s.grantBonusDays(u, 7, now)).getTime(), NOW.getTime() + 7 * DAY);
    assert.equal((await s.grantBonusDays(u, 7, now)).getTime(), NOW.getTime() + 14 * DAY);
    assert.equal(await s.isPremium(u), true);
    now = new Date(NOW.getTime() + 15 * DAY);
    assert.equal(await s.isPremium(u), false);
    assert.equal((await s.grantBonusDays(u, 7, now)).getTime(), now.getTime() + 7 * DAY, "süresi dolmuşsa bugünden");
  });

  test("masallar: kaydet, sahibi dışında görünmez, idempotency, upsert", async () => {
    const store = new PgStoryStore(sql);
    const u = await newUser(), other = await newUser();
    const story = mockStory(req, crypto.randomUUID());
    await store.save({ userId: u, story, language: "tr", idempotencyKey: "k-1", createdAt: NOW });
    assert.equal((await store.get(u, story.id))?.story.title, story.title);
    assert.equal(await store.get(other, story.id), null);
    assert.equal(await store.get(u, "abc-not-uuid"), null);
    assert.equal((await store.findByIdempotencyKey(u, "k-1"))?.story.id, story.id);
    const voiced = { ...story, paragraphs: story.paragraphs.map((p) => ({ ...p, audio_url: "https://cdn/x.mp3" })) };
    await store.save({ userId: u, story: voiced, language: "tr", idempotencyKey: "k-1", createdAt: NOW });
    assert.equal((await store.get(u, story.id))?.story.paragraphs[0].audio_url, "https://cdn/x.mp3");
  });

  test("paylaşım, ses klonu, maliyet ve işaret logu", async () => {
    const u = await newUser();
    const story = mockStory(req, crypto.randomUUID());
    await new PgStoryStore(sql).save({ userId: u, story, language: "tr", createdAt: NOW });
    const shares = new PgShareStore(sql);
    await shares.save({ token: "tok_abcdefghijklmnop", userId: u, storyId: story.id, createdAt: NOW,
                        expiresAt: new Date(NOW.getTime() + 30 * DAY) });
    assert.equal((await shares.get("tok_abcdefghijklmnop"))?.storyId, story.id);

    const voices = new PgCloneVoiceStore(sql);
    await voices.set(u, "voice-1", NOW);
    assert.equal(await voices.get(u), "voice-1");
    await voices.delete(u);
    assert.equal(await voices.get(u), null);

    const costs = new PgCostLog(sql);
    const base = { at: NOW, language: "tr" as const, durationMinutes: 10, llmInputTokens: 1000, llmOutputTokens: 800,
                   llmCacheReadTokens: 900, llmCacheWriteTokens: 0, ttsCharacters: 0, costUSD: 0.004, attempts: 1 };
    await costs.record({ ...base, outcome: "generated" });
    await costs.record({ ...base, outcome: "tts", ttsCharacters: 4000, costUSD: 0.06, llmOutputTokens: 0 });
    const sum = await costs.summary(new Date(NOW.getTime() - DAY));
    assert.equal(sum.stories, 1);
    assert.equal(sum.ttsCharacters, 4000);
    assert.equal(sum.totalCostUSD, 0.064);

    await new PgFlagLog(sql).record({ stage: "rules", reasons: ["violence"], excerpt: "{CHILD} …", language: "tr", at: NOW });
    const [f] = await sql`select reasons from flagged_content`;
    assert.deepEqual(f.reasons, ["violence"]);
  });

  test("uç noktalar Postgres ile: kitaplık limiti, abonelik durumu, davet", async () => {
    const stores = new PgStores(sql, () => NOW);
    const referrals = new PgReferralStore(sql);
    const a = await newUser(), b = await newUser();
    const auth = (user: string) => ({ authorization: `Bearer ${user}` });

    const lib = createLibraryHandler({ auth: mockAuth, entitlements: stores, usage: stores, now: () => NOW });
    for (const id of ["lib-keloglan-1", "lib-hoca-1", "lib-forest-1"]) {
      assert.equal((await lib(new Request(`https://x/functions/v1/library/${id}`, { headers: auth(a) }))).status, 200);
    }
    assert.equal((await lib(new Request("https://x/functions/v1/library/lib-star-2", { headers: auth(a) }))).status, 403);

    const ent = createEntitlementsHandler({ auth: mockAuth, entitlements: stores, usage: stores, now: () => NOW });
    const e = await (await ent(new Request("https://x/functions/v1/entitlements/verify",
      { method: "POST", headers: auth(a), body: "{}" }))).json();
    assert.equal(e.library_stories_remaining_this_week, 0);

    const ref = createReferralHandler({ auth: mockAuth, referrals, entitlements: stores,
                                        limiter: new RateLimiter(100, 60_000), now: () => NOW });
    const { code } = await (await ref(new Request("https://x/functions/v1/referral", { headers: auth(a) }))).json();
    assert.match(code, /^[A-HJKMNP-Z2-9]{6}$/);
    const redeem = () => ref(new Request("https://x/functions/v1/referral/redeem",
      { method: "POST", headers: auth(b), body: JSON.stringify({ code }) }));
    assert.equal((await redeem()).status, 200);
    assert.equal((await redeem()).status, 409);
    assert.equal(await stores.isPremium(a), true);
    assert.equal(await stores.isPremium(b), true);
  });

  test("anonim sayaç birikir, boyut sırası önemsiz", async () => {
    const a = new PgAnalyticsStore(sql);
    await sql`truncate analytics_daily`;
    await a.increment("2026-10-20", "story_started", { region: "star_hill", mood: "calm", library: false }, 2);
    await a.increment("2026-10-20", "story_started", { library: false, mood: "calm", region: "star_hill" }, 3);
    const rows = await sql`select count from analytics_daily where name = 'story_started'`;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].count, 5);
  });

  test("hesap silme: auth kullanıcısı silinince her şey silinir", async () => {
    const stores = new PgStores(sql, () => NOW);
    const u = await newUser();
    await stores.recordPersonalStory(u, "2026-10-20");
    await new PgStoryStore(sql).save({ userId: u, story: mockStory(req, crypto.randomUUID()), language: "tr", createdAt: NOW });
    await new PgReferralStore(sql).codeFor(u);
    const h = createAccountHandler({ auth: mockAuth, usage: stores, entitlements: stores,
                                     deleteAuthUser: (id) => deleteAuthUser(sql, id) });
    assert.equal((await h(new Request("https://x/functions/v1/account", { method: "DELETE",
      headers: { authorization: `Bearer ${u}` } }))).status, 204);
    for (const t of ["usage_daily", "stories", "referral_codes"]) {
      const [r] = await sql`select count(*)::int as n from ${sql(t)} where user_id = ${u}`;
      assert.equal(r.n, 0, t);
    }
    const [x] = await sql`select count(*)::int as n from auth.users where id = ${u}`;
    assert.equal(x.n, 0);
  });
});
