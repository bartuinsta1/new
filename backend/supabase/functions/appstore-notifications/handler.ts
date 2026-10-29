// POST /appstore-notifications → App Store Server Notifications V2 (App Store Connect'te bu URL tanımlanır).
// Yenileme, iade, iptal, faturalama hatası gibi olaylar uygulama açılmasa da sunucudaki durumu günceller.
// Kimlik doğrulaması yok (Apple çağırır); güven tamamen JWS imzası + Apple sertifika zincirindedir.
// Her zaman hızlı 200 döneriz (bilinmeyen işlem dahil); yalnızca imzası bozuk yük 400 alır. Apple 200 almazsa
// aynı bildirimi tekrar dener — işlemler idempotent (aynı abonelik kaydı tekrar yazılır).
import { type AppStoreVerifier, AppStoreVerificationError, subscriptionFrom } from "../_shared/appstore.ts";
import { type EntitlementStore, errorResponse } from "../_shared/http.ts";
import { PACK_IDS, type PurchaseStore } from "../_shared/packs.ts";

/** Erişimi hemen kapatan olaylar. EXPIRED ve GRACE_PERIOD_EXPIRED de süre dolduğu için kapanır. */
const REVOKING = new Set(["REFUND", "REVOKE", "EXPIRED", "GRACE_PERIOD_EXPIRED"]);

export function createAppStoreNotificationsHandler(deps: {
  verifier?: AppStoreVerifier; entitlements: EntitlementStore; purchases?: PurchaseStore; now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return errorResponse(405, "method_not_allowed");
    if (!deps.verifier) return errorResponse(503, "not_configured");
    let body: { signedPayload?: unknown };
    try { body = await req.json(); } catch { return errorResponse(400, "invalid_json"); }
    if (typeof body.signedPayload !== "string") return errorResponse(400, "invalid_payload");

    try {
      const n = await deps.verifier.verifyNotification(body.signedPayload);
      const signedTx = n.data?.signedTransactionInfo;
      if (!signedTx) return new Response(null, { status: 200 }); // TEST bildirimi vb.
      const tx = await deps.verifier.verifyTransaction(signedTx);
      if (PACK_IDS.includes(tx.productId)) {
        // Tek seferlik paket: yalnızca iade/iptal önemli (yenileme yok).
        if (REVOKING.has(n.notificationType) || tx.revocationDate !== undefined) {
          await deps.purchases?.revoke(tx.originalTransactionId);
        }
        return new Response(null, { status: 200 });
      }
      const owner = await deps.entitlements.userForOriginalTransaction(tx.originalTransactionId);
      if (!owner) return new Response(null, { status: 200 }); // henüz uygulamadan doğrulanmamış abonelik

      const sub = subscriptionFrom(tx, now());
      if (REVOKING.has(n.notificationType) || !sub) await deps.entitlements.revoke(tx.originalTransactionId);
      else await deps.entitlements.saveSubscription(owner, sub);
      return new Response(null, { status: 200 });
    } catch (e) {
      if (e instanceof AppStoreVerificationError) return errorResponse(400, "invalid_payload");
      throw e;
    }
  };
}
