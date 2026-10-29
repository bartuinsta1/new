// Masal Dükkanı: tek seferlik paketler — katalog, kilit, satın alma doğrulaması, iade, geri yükleme, hesap silme.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { createLibraryHandler } from "../supabase/functions/library/handler.ts";
import { createEntitlementsHandler } from "../supabase/functions/entitlements/handler.ts";
import { createAppStoreNotificationsHandler } from "../supabase/functions/appstore-notifications/handler.ts";
import { createAccountHandler } from "../supabase/functions/account/handler.ts";
import { MemoryStores, mockAuth } from "../supabase/functions/_shared/http.ts";
import { MemoryPurchaseStore, PACKS } from "../supabase/functions/_shared/packs.ts";
import { JwsAppStoreVerifier, type TransactionPayload } from "../supabase/functions/_shared/appstore.ts";
import { mockLibrary } from "../supabase/functions/_shared/mock.ts";

const NOW = new Date("2026-10-29T12:00:00Z");
const get = (path: string, user = "user-1", lang = "tr") =>
  new Request(`https://x/functions/v1/${path}`, { headers: { authorization: `Bearer ${user}`, "accept-language": lang } });
const post = (path: string, body: unknown, user = "user-1") => new Request(`https://x/functions/v1/${path}`, {
  method: "POST", headers: { authorization: `Bearer ${user}` }, body: JSON.stringify(body),
});

// Test sertifika zinciri (appstore.test.ts ile aynı)
const dir = new URL("./fixtures/appstore/", import.meta.url);
const b64 = (n: string) => readFileSync(new URL(n, dir), "utf8").replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
const [ROOT, INTER, LEAF] = ["root.pem", "inter.pem", "leaf.pem"].map(b64);
const leafKey = createPrivateKey(readFileSync(new URL("leaf.p8", dir), "utf8"));
const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jws = (payload: unknown) => {
  const h = enc({ alg: "ES256", x5c: [LEAF, INTER, ROOT] }), p = enc(payload);
  return `${h}.${p}.${sign("sha256", Buffer.from(`${h}.${p}`), { key: leafKey, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
};
const verifier = new JwsAppStoreVerifier({
  bundleId: "com.masalcik.app", environments: ["Sandbox"], now: () => NOW,
  rootFingerprintSha256: createHash("sha256").update(Buffer.from(ROOT, "base64")).digest("hex"),
});
const packTx = (over: Partial<TransactionPayload> = {}): TransactionPayload => ({
  transactionId: "3000000001", originalTransactionId: "3000000001", bundleId: "com.masalcik.app",
  productId: "masalcik.pack.space", purchaseDate: NOW.getTime(), environment: "Sandbox", type: "Non-Consumable", ...over,
});

function setup() {
  const stores = new MemoryStores(() => NOW);
  const purchases = new MemoryPurchaseStore();
  return {
    stores, purchases,
    lib: createLibraryHandler({ auth: mockAuth, entitlements: stores, usage: stores, purchases, now: () => NOW }),
    ent: createEntitlementsHandler({ auth: mockAuth, entitlements: stores, usage: stores, purchases, verifier, now: () => NOW }),
  };
}

test("katalog: dile göre, sahiplik bilgisi, kitaplıkta paket masalları işaretli", async () => {
  const { lib, purchases } = setup();
  const tr = await (await lib(get("library/packs"))).json();
  assert.equal(tr.length, PACKS.length);
  assert.equal(tr[0].title, "Dede Korkut'tan Esintiler");
  assert.ok(tr.every((p: { owned: boolean }) => !p.owned));
  const en = await (await lib(get("library/packs", "user-1", "en"))).json();
  assert.equal(en[1].stories[0].title, "The Balloon to the Moon");
  await purchases.grant("user-1", "masalcik.pack.space", "t-1", "Sandbox");
  const after = await (await lib(get("library/packs"))).json();
  assert.equal(after.find((p: { id: string }) => p.id === "masalcik.pack.space").owned, true);
  const items = mockLibrary("tr").filter((i) => i.pack_id);
  assert.equal(items.length, 8);
  assert.ok(items.every((i) => !i.is_free));
});

test("paket masalı: almayan açamaz (Premium dahil değil), alan açar ve haftalık hakkı harcamaz", async () => {
  const { lib, stores, purchases } = setup();
  assert.equal((await lib(get("library/lib-space-balon"))).status, 402);
  assert.equal((await lib(get("library/lib-space-balon"))).headers.get("x-error-code"), "pack_required");
  await stores.setPremium("user-1", null);
  assert.equal((await lib(get("library/lib-space-balon"))).status, 402, "Premium paketleri kapsamaz");
  await purchases.grant("user-2", "masalcik.pack.space", "t-2", "Sandbox");
  for (const id of ["lib-space-balon", "lib-space-kuyruklu", "lib-space-gezegen", "lib-space-yastik"]) {
    const res = await lib(get(`library/${id}`, "user-2"));
    assert.equal(res.status, 200, id);
  }
  assert.deepEqual(await stores.libraryStoriesInWeek("user-2", "2026-10-26"), [], "paket masalı hak harcamaz");
  assert.equal((await lib(get("library/lib-dk-kopuz", "user-2"))).status, 402, "başka paket kilitli");
});

test("satın alma doğrulaması: imzalı işlem → sahiplik; iade edilmiş işlem → sahiplik kalkar", async () => {
  const { ent, purchases } = setup();
  const e = await (await ent(post("entitlements/verify", { signed_transaction: jws(packTx()) }))).json();
  assert.deepEqual(e.owned_products, ["masalcik.pack.space"]);
  assert.equal(e.tier, "free", "paket abonelik değildir");
  await ent(post("entitlements/verify", { signed_transactions: [jws(packTx({ revocationDate: NOW.getTime() }))] }));
  assert.deepEqual(await purchases.owned("user-1"), []);
});

test("geri yükleme paketi yeni hesaba taşır; sahte işlem (yerel) de çalışır", async () => {
  const { ent, purchases } = setup();
  await ent(post("entitlements/verify", { signed_transaction: jws(packTx()) }, "old-device"));
  await ent(post("entitlements/verify", { signed_transactions: [jws(packTx())] }, "new-device"));
  assert.deepEqual(await purchases.owned("old-device"), []);
  assert.deepEqual(await purchases.owned("new-device"), ["masalcik.pack.space"]);

  const stores = new MemoryStores(() => NOW);
  const local = createEntitlementsHandler({ auth: mockAuth, entitlements: stores, usage: stores, purchases, now: () => NOW });
  const e = await (await local(post("entitlements/verify",
    { signed_transaction: "mock-masalcik.pack.outfits.bayram-trial" }, "dev"))).json();
  assert.deepEqual(e.owned_products, ["masalcik.pack.outfits.bayram"]);
  assert.equal(e.tier, "free");
});

test("App Store bildirimi: paket iadesi sahipliği kaldırır", async () => {
  const purchases = new MemoryPurchaseStore();
  await purchases.grant("user-1", "masalcik.pack.space", "3000000001", "Sandbox");
  const stores = new MemoryStores(() => NOW);
  const h = createAppStoreNotificationsHandler({ verifier, entitlements: stores, purchases, now: () => NOW });
  const res = await h(post("appstore-notifications", { signedPayload: jws({
    notificationType: "REFUND", notificationUUID: crypto.randomUUID(),
    data: { bundleId: "com.masalcik.app", environment: "Sandbox", signedTransactionInfo: jws(packTx()) },
  }) }));
  assert.equal(res.status, 200);
  assert.deepEqual(await purchases.owned("user-1"), []);
});

test("hesap silme paket kaydını da siler", async () => {
  const purchases = new MemoryPurchaseStore();
  await purchases.grant("user-1", "masalcik.pack.space", "t", "Sandbox");
  const stores = new MemoryStores();
  const h = createAccountHandler({ auth: mockAuth, usage: stores, entitlements: stores, purchases });
  await h(new Request("https://x/functions/v1/account", { method: "DELETE", headers: { authorization: "Bearer user-1" } }));
  assert.deepEqual(await purchases.owned("user-1"), []);
});
