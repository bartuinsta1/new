// Davet programı: davet eden + edilen 7 gün Premium, kötüye kullanım sınırları, paylaşımda davet kodu.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createReferralHandler } from "../supabase/functions/referral/handler.ts";
import { createEntitlementsHandler } from "../supabase/functions/entitlements/handler.ts";
import { MemoryReferralStore, newReferralCode, normalizeReferralCode } from "../supabase/functions/_shared/referral.ts";
import { MemoryStores, mockAuth, RateLimiter } from "../supabase/functions/_shared/http.ts";

const NOW = new Date("2026-10-17T18:00:00Z");
const DAY = 86_400_000;

function setup(now = () => NOW) {
  const stores = new MemoryStores(now);
  const referrals = new MemoryReferralStore();
  const h = createReferralHandler({ auth: mockAuth, referrals, entitlements: stores, limiter: new RateLimiter(100, 60_000), now });
  const get = (user: string) => h(new Request("https://x/functions/v1/referral", { headers: { authorization: `Bearer ${user}` } }));
  const redeem = (user: string, code: unknown) => h(new Request("https://x/functions/v1/referral/redeem", {
    method: "POST", headers: { authorization: `Bearer ${user}`, "content-type": "application/json" },
    body: JSON.stringify({ code }),
  }));
  return { stores, referrals, get, redeem };
}

test("kod biçimi: karışan harf yok, normalize", () => {
  for (let i = 0; i < 200; i++) assert.match(newReferralCode(), /^[A-HJKMNP-Z2-9]{6}$/);
  assert.equal(normalizeReferralCode(" abc-23k "), "ABC23K");
  assert.equal(normalizeReferralCode("kısa"), null);
});

test("davet eden ve edilen 7 gün Premium kazanır", async () => {
  const { stores, get, redeem } = setup();
  const { code } = await (await get("anne-ayse")).json();
  assert.equal((await (await get("anne-ayse")).json()).code, code, "kod kalıcı");

  const res = await redeem("baba-mehmet", code.toLowerCase());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.inviter_rewarded, true);
  assert.equal(body.premium_until, new Date(NOW.getTime() + 7 * DAY).toISOString());
  assert.equal(await stores.isPremium("baba-mehmet"), true);
  assert.equal(await stores.isPremium("anne-ayse"), true);

  const ent = createEntitlementsHandler({ auth: mockAuth, entitlements: stores, usage: stores, now: () => NOW });
  const e = await (await ent(new Request("https://x/functions/v1/entitlements/verify", {
    method: "POST", headers: { authorization: "Bearer baba-mehmet" }, body: "{}",
  }))).json();
  assert.equal(e.tier, "premium");
  assert.equal(e.product_id, "masalcik.referral.week");
});

test("kendi kodu, ikinci kullanım, karşılıklı davet, bilinmeyen kod reddedilir", async () => {
  const { get, redeem } = setup();
  const a = (await (await get("user-a")).json()).code;
  const b = (await (await get("user-b")).json()).code;
  assert.equal((await redeem("user-a", a)).status, 409);
  assert.equal((await redeem("user-b", a)).status, 200);
  assert.equal((await redeem("user-b", a)).status, 409, "hesap başına bir kez");
  assert.equal((await redeem("user-a", b)).status, 409, "A→B sonrası B→A yok");
  assert.equal((await redeem("user-c", "ZZZZZZ")).status, 404);
  assert.equal((await redeem("user-c", "??")).status, 400);
});

test("ödüller birikir; davet edenin yıllık sınırı 12", async () => {
  const { stores, get, redeem } = setup();
  const code = (await (await get("populer-anne")).json()).code;
  for (let i = 0; i < 13; i++) {
    const body = await (await redeem(`arkadas-${i}`, code)).json();
    assert.equal(body.inviter_rewarded, i < 12);
  }
  assert.equal((await stores.bonusUntil("populer-anne"))?.getTime(), NOW.getTime() + 12 * 7 * DAY);
  assert.equal(await stores.isPremium("arkadas-12"), true, "sınır dolsa da davet edilen kazanır");
});

test("ödül süresi dolunca Premium biter", async () => {
  let now = NOW;
  const { stores, get, redeem } = setup(() => now);
  const code = (await (await get("u-1")).json()).code;
  await redeem("u-2", code);
  now = new Date(NOW.getTime() + 8 * DAY);
  assert.equal(await stores.isPremium("u-2"), false);
});
