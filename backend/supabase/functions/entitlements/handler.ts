// POST /entitlements/verify → StoreKit 2 JWS işlemini sunucuda doğrular, abonelik durumunu döner.
// Adım 10: App Store Server API ile gerçek imza doğrulaması (x5c zinciri + Apple kök sertifikası).
import { FREE_TIER, type Entitlement } from "../_shared/contract.ts";
import {
  type AuthProvider, type EntitlementStore, type UsageStore,
  errorResponse, istanbulDay, json, pathAfter,
} from "../_shared/http.ts";

export function createEntitlementsHandler(deps: {
  auth: AuthProvider; entitlements: EntitlementStore; usage: UsageStore; now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST" || pathAfter(req, "entitlements")[0] !== "verify") {
      return errorResponse(405, "method_not_allowed");
    }
    const userId = await deps.auth.userId(req);
    if (!userId) return errorResponse(401, "unauthorized");

    let body: { signed_transaction?: string | null } = {};
    try { body = await req.json(); } catch { /* boş gövde = yalnızca durum sorgusu */ }

    if (body.signed_transaction) {
      // SAHTE: "mock-yearly-trial" → 7 günlük deneme. Gerçek doğrulama Adım 10'da.
      if (!body.signed_transaction.startsWith("mock-")) return errorResponse(400, "invalid_transaction");
      await deps.entitlements.setPremium(userId, new Date(now().getTime() + 7 * 86_400_000));
    }

    const premium = await deps.entitlements.isPremium(userId);
    const used = await deps.usage.personalStoriesOn(userId, istanbulDay(now()));
    const res: Entitlement = premium
      ? { tier: "premium", product_id: "masalcik.premium.yearly", is_in_trial: true,
          expires_at: new Date(now().getTime() + 7 * 86_400_000).toISOString() }
      : { tier: "free", is_in_trial: false,
          personal_stories_remaining_today: Math.max(0, FREE_TIER.personalStoriesPerDay - used),
          library_stories_remaining_this_week: FREE_TIER.libraryStoriesPerWeek };
    return json(res);
  };
}
