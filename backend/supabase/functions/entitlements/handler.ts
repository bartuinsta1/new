// POST /entitlements/verify → StoreKit 2 işlem(ler)ini sunucuda doğrular, abonelik durumunu ve ücretsiz
// kullanım haklarını döner. Gövde:
//   { "signed_transaction": "<JWS>" }              satın almadan hemen sonra
//   { "signed_transactions": ["<JWS>", ...] }      "Satın alımları geri yükle" (Transaction.currentEntitlements)
//   {}                                             yalnızca durum sorgusu
// İmza + Apple sertifika zinciri doğrulaması: _shared/appstore.ts. İstemcinin söylediği "premium"a asla güvenilmez.
import { FREE_TIER, type Entitlement } from "../_shared/contract.ts";
import { type AppStoreVerifier, AppStoreVerificationError, subscriptionFrom } from "../_shared/appstore.ts";
import {
  type AuthProvider, type EntitlementStore, type UsageStore,
  errorResponse, istanbulDay, istanbulWeek, json, pathAfter,
} from "../_shared/http.ts";

export interface EntitlementsDeps {
  auth: AuthProvider;
  entitlements: EntitlementStore;
  usage: UsageStore;
  /** Yoksa (yerel geliştirme) yalnızca "mock-" ile başlayan sahte işlemler kabul edilir. */
  verifier?: AppStoreVerifier;
  now?: () => Date;
}

const MAX_TRANSACTIONS = 10;

export function createEntitlementsHandler(deps: EntitlementsDeps) {
  const now = deps.now ?? (() => new Date());
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST" || pathAfter(req, "entitlements")[0] !== "verify") {
      return errorResponse(405, "method_not_allowed");
    }
    const userId = await deps.auth.userId(req);
    if (!userId) return errorResponse(401, "unauthorized");

    let body: { signed_transaction?: unknown; signed_transactions?: unknown } = {};
    try { body = await req.json(); } catch { /* boş gövde = yalnızca durum sorgusu */ }

    const list = [
      ...(typeof body.signed_transaction === "string" ? [body.signed_transaction] : []),
      ...(Array.isArray(body.signed_transactions) ? body.signed_transactions : []),
    ];
    if (list.length > MAX_TRANSACTIONS || list.some((t) => typeof t !== "string" || t.length > 20_000)) {
      return errorResponse(400, "invalid_transaction");
    }

    for (const jws of list as string[]) {
      if (!deps.verifier) {
        // SAHTE (yerel): "mock-yearly-trial" → 7 günlük deneme.
        if (!jws.startsWith("mock-")) return errorResponse(400, "invalid_transaction");
        await deps.entitlements.saveSubscription(userId, {
          productId: jws.includes("monthly") ? "masalcik.premium.monthly" : "masalcik.premium.yearly",
          expiresAt: new Date(now().getTime() + 7 * 86_400_000), isInTrial: jws.includes("trial"),
          originalTransactionId: `mock-${userId}`, environment: "Xcode",
        });
        continue;
      }
      try {
        const tx = await deps.verifier.verifyTransaction(jws);
        const sub = subscriptionFrom(tx, now());
        // Süresi dolmuş/iade edilmiş işlem hata değildir (geri yüklemede eski işlemler gelebilir); yok sayılır.
        if (sub) await deps.entitlements.saveSubscription(userId, sub);
        else await deps.entitlements.revoke(tx.originalTransactionId);
      } catch (e) {
        if (e instanceof AppStoreVerificationError) return errorResponse(400, "invalid_transaction");
        throw e;
      }
    }

    return json(await entitlementFor(userId, deps, now()));
  };
}

export async function entitlementFor(
  userId: string, deps: { entitlements: EntitlementStore; usage: UsageStore }, now: Date,
): Promise<Entitlement> {
  const sub = await deps.entitlements.subscription(userId);
  if (sub) {
    return { tier: "premium", product_id: sub.productId, is_in_trial: sub.isInTrial,
             expires_at: sub.expiresAt.toISOString() };
  }
  const used = await deps.usage.personalStoriesOn(userId, istanbulDay(now));
  const library = await deps.usage.libraryStoriesInWeek(userId, istanbulWeek(now));
  return {
    tier: "free", is_in_trial: false,
    personal_stories_remaining_today: Math.max(0, FREE_TIER.personalStoriesPerDay - used),
    library_stories_remaining_this_week: Math.max(0, FREE_TIER.libraryStoriesPerWeek - library.length),
  };
}
