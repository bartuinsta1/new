// App Store JWS doğrulaması, abonelik uç noktaları ve kitaplık haftalık limiti.
// Sertifikalar tests/fixtures/appstore: openssl ile üretilmiş test kökü → ara (WWDR OID) → yaprak (alındı OID).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  AppStoreVerificationError, JwsAppStoreVerifier, type TransactionPayload,
} from "../supabase/functions/_shared/appstore.ts";
import { createEntitlementsHandler } from "../supabase/functions/entitlements/handler.ts";
import { createAppStoreNotificationsHandler } from "../supabase/functions/appstore-notifications/handler.ts";
import { createLibraryHandler } from "../supabase/functions/library/handler.ts";
import { istanbulWeek, MemoryStores, mockAuth } from "../supabase/functions/_shared/http.ts";

const dir = new URL("./fixtures/appstore/", import.meta.url);
const pemToB64 = (name: string) =>
  readFileSync(new URL(name, dir), "utf8").replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
const ROOT = pemToB64("root.pem"), INTER = pemToB64("inter.pem"), LEAF = pemToB64("leaf.pem");
const LEAF_NO_OID = pemToB64("leaf-no-oid.pem");
const ROOT_SHA = createHash("sha256").update(Buffer.from(ROOT, "base64")).digest("hex");
const leafKey = createPrivateKey(readFileSync(new URL("leaf.p8", dir), "utf8"));

// Sertifikalar 2026-10-12 21:04 UTC – 2045 geçerli.
const NOW = new Date("2026-10-19T12:00:00Z");
const DAY = 86_400_000;
const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

function jws(payload: unknown, opts: { x5c?: string[]; alg?: string } = {}) {
  const head = b64url({ alg: opts.alg ?? "ES256", x5c: opts.x5c ?? [LEAF, INTER, ROOT] });
  const body = b64url(payload);
  const sig = sign("sha256", Buffer.from(`${head}.${body}`), { key: leafKey, dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${sig.toString("base64url")}`;
}

function tx(over: Partial<TransactionPayload> = {}): TransactionPayload {
  return {
    transactionId: "2000000001", originalTransactionId: "1000000001", bundleId: "com.masalcik.app",
    productId: "masalcik.premium.yearly", purchaseDate: NOW.getTime() - DAY, expiresDate: NOW.getTime() + 6 * DAY,
    offerType: 1, offerDiscountType: "FREE_TRIAL", environment: "Sandbox", type: "Auto-Renewable Subscription",
    ...over,
  };
}

const verifier = (now = NOW) => new JwsAppStoreVerifier({
  bundleId: "com.masalcik.app", environments: ["Production", "Sandbox"], rootFingerprintSha256: ROOT_SHA, now: () => now,
});

async function rejects(p: Promise<unknown>, code: string) {
  await assert.rejects(p, (e: unknown) => e instanceof AppStoreVerificationError && e.code === code);
}

test("JWS: geçerli işlem doğrulanır", async () => {
  const p = await verifier().verifyTransaction(jws(tx()));
  assert.equal(p.productId, "masalcik.premium.yearly");
  assert.equal(p.originalTransactionId, "1000000001");
});

test("JWS: kurcalanmış yük, yanlış kök, eksik OID, sıra, algoritma reddedilir", async () => {
  const good = jws(tx());
  const [h, , s] = good.split(".");
  await rejects(verifier().verifyTransaction(`${h}.${b64url(tx({ expiresDate: NOW.getTime() + 999 * DAY }))}.${s}`),
    "bad_signature");
  await rejects(new JwsAppStoreVerifier({ bundleId: "com.masalcik.app", environments: ["Sandbox"], now: () => NOW })
    .verifyTransaction(good), "untrusted_root"); // gerçek Apple kökü beklenirken test kökü
  await rejects(verifier().verifyTransaction(jws(tx(), { x5c: [LEAF_NO_OID, INTER, ROOT] })), "bad_leaf");
  await rejects(verifier().verifyTransaction(jws(tx(), { x5c: [INTER, LEAF, ROOT] })), "broken_chain");
  await rejects(verifier().verifyTransaction(jws(tx(), { x5c: [LEAF, INTER] })), "missing_chain");
  await rejects(verifier().verifyTransaction(jws(tx(), { alg: "none" })), "unsupported_alg");
  await rejects(verifier().verifyTransaction("abc.def"), "malformed_jws");
});

test("JWS: başka uygulama, izin verilmeyen ortam, süresi dolmuş sertifika", async () => {
  await rejects(verifier().verifyTransaction(jws(tx({ bundleId: "com.other" }))), "wrong_bundle");
  await rejects(verifier().verifyTransaction(jws(tx({ environment: "Xcode" }))), "wrong_environment");
  await rejects(verifier(new Date("2060-01-01")).verifyTransaction(jws(tx())), "certificate_expired");
});

const post = (path: string, body: unknown, user = "user-1") => new Request(`https://x/functions/v1/${path}`, {
  method: "POST", headers: { authorization: `Bearer ${user}`, "content-type": "application/json" },
  body: JSON.stringify(body),
});

test("POST /entitlements/verify: gerçek doğrulayıcıyla deneme → premium; bozuk işlem 400", async () => {
  const stores = new MemoryStores(() => NOW);
  const h = createEntitlementsHandler({ auth: mockAuth, entitlements: stores, usage: stores, verifier: verifier(), now: () => NOW });
  const e = await (await h(post("entitlements/verify", { signed_transaction: jws(tx()) }))).json();
  assert.equal(e.tier, "premium");
  assert.equal(e.is_in_trial, true);
  assert.equal(e.expires_at, new Date(NOW.getTime() + 6 * DAY).toISOString());
  assert.equal((await h(post("entitlements/verify", { signed_transaction: "mock-yearly-trial" }))).status, 400);
  assert.equal((await h(post("entitlements/verify", { signed_transactions: Array(11).fill("x") }))).status, 400);
});

test("POST /entitlements/verify: süresi dolmuş işlem premium vermez; geri yükleme aboneliği yeni hesaba taşır", async () => {
  const stores = new MemoryStores(() => NOW);
  const h = createEntitlementsHandler({ auth: mockAuth, entitlements: stores, usage: stores, verifier: verifier(), now: () => NOW });
  const expired = await (await h(post("entitlements/verify", { signed_transaction: jws(tx({ expiresDate: NOW.getTime() - 1 })) }))).json();
  assert.equal(expired.tier, "free");
  assert.equal(expired.library_stories_remaining_this_week, 3);

  await h(post("entitlements/verify", { signed_transaction: jws(tx()) }, "old-device"));
  assert.equal(await stores.isPremium("old-device"), true);
  const restored = await (await h(post("entitlements/verify", { signed_transactions: [jws(tx())] }, "new-device"))).json();
  assert.equal(restored.tier, "premium");
  assert.equal(await stores.isPremium("old-device"), false, "bir abonelik aynı anda tek hesabı açar");
});

test("App Store bildirimleri: yenileme uzatır, iade kapatır, bilinmeyen işlem 200, bozuk imza 400", async () => {
  const stores = new MemoryStores(() => NOW);
  const v = verifier();
  await stores.saveSubscription("user-1", {
    productId: "masalcik.premium.monthly", expiresAt: new Date(NOW.getTime() + DAY), isInTrial: false,
    originalTransactionId: "1000000001", environment: "Sandbox",
  });
  const h = createAppStoreNotificationsHandler({ verifier: v, entitlements: stores, now: () => NOW });
  const note = (type: string, t: TransactionPayload) => post("appstore-notifications", {
    signedPayload: jws({ notificationType: type, notificationUUID: crypto.randomUUID(),
      data: { bundleId: "com.masalcik.app", environment: "Sandbox", signedTransactionInfo: jws(t) } }),
  });

  const renewed = tx({ productId: "masalcik.premium.monthly", expiresDate: NOW.getTime() + 31 * DAY, offerType: undefined });
  assert.equal((await h(note("DID_RENEW", renewed))).status, 200);
  assert.equal((await stores.subscription("user-1"))?.expiresAt.getTime(), NOW.getTime() + 31 * DAY);

  assert.equal((await h(note("REFUND", renewed))).status, 200);
  assert.equal(await stores.isPremium("user-1"), false);

  assert.equal((await h(note("SUBSCRIBED", tx({ originalTransactionId: "999" })))).status, 200);
  assert.equal((await h(post("appstore-notifications", { signedPayload: "a.b.c" }))).status, 400);
  const noVerifier = createAppStoreNotificationsHandler({ entitlements: stores });
  assert.equal((await noVerifier(post("appstore-notifications", { signedPayload: "a.b.c" }))).status, 503);
});

test("Hafta anahtarı: Türkiye saatiyle pazartesi başlar", () => {
  assert.equal(istanbulWeek(new Date("2026-10-12T12:00:00Z")), "2026-10-12"); // pazartesi
  assert.equal(istanbulWeek(new Date("2026-10-11T21:30:00Z")), "2026-10-12"); // pazartesi 00:30 TR
  assert.equal(istanbulWeek(new Date("2026-10-18T20:59:00Z")), "2026-10-12"); // pazar 23:59 TR
  assert.equal(istanbulWeek(new Date("2026-10-18T21:00:00Z")), "2026-10-19"); // pazartesi 00:00 TR
});

test("GET /library/:id: ücretsizde haftada 3 farklı masal, tekrar dinleme sayılmaz, Premium masal 402", async () => {
  let now = NOW;
  const stores = new MemoryStores(() => now);
  const h = createLibraryHandler({ auth: mockAuth, entitlements: stores, usage: stores, now: () => now });
  const get = (id: string, user = "user-1") =>
    h(new Request(`https://x/functions/v1/library/${id}`, { headers: { authorization: `Bearer ${user}` } }));

  const first = await get("lib-keloglan-1");
  assert.equal(first.status, 200);
  const story = await first.json();
  assert.equal(story.title, "Keloğlan ile Sihirli Kaşık");
  assert.equal(story.id, "lib-keloglan-1");
  assert.ok(story.paragraphs.length > 0);

  assert.equal((await get("lib-hoca-1")).status, 200);
  assert.equal((await get("lib-keloglan-1")).status, 200, "aynı masalı tekrar dinlemek hak harcamaz");
  assert.equal((await get("lib-forest-1")).status, 200);
  const blocked = await get("lib-star-2");
  assert.equal(blocked.status, 403);
  assert.equal(blocked.headers.get("x-error-code"), "weekly_limit_reached");
  assert.equal((await get("lib-hoca-1")).status, 200, "bu hafta açılmış masal hâlâ dinlenir");
  assert.equal((await get("lib-dedekorkut-1", "user-2")).status, 402);
  assert.equal((await get("yok", "user-2")).status, 404);

  now = new Date(NOW.getTime() + 7 * DAY);
  assert.equal((await get("lib-star-2")).status, 200, "yeni hafta, yeni hak");

  await stores.setPremium("user-3", null);
  for (const id of ["lib-dedekorkut-1", "lib-star-1", "lib-sea-1", "lib-feel-1", "lib-keloglan-1"]) {
    assert.equal((await get(id, "user-3")).status, 200);
  }
});

test("Kalan haftalık kitaplık hakkı /entitlements/verify yanıtında", async () => {
  const stores = new MemoryStores(() => NOW);
  const lib = createLibraryHandler({ auth: mockAuth, entitlements: stores, usage: stores, now: () => NOW });
  await lib(new Request("https://x/functions/v1/library/lib-hoca-1", { headers: { authorization: "Bearer user-1" } }));
  const h = createEntitlementsHandler({ auth: mockAuth, entitlements: stores, usage: stores, now: () => NOW });
  const e = await (await h(post("entitlements/verify", {}))).json();
  assert.equal(e.library_stories_remaining_this_week, 2);
  assert.equal(e.personal_stories_remaining_today, 1);
});
