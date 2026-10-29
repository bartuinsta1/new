// DELETE /account → tüm verileri sil (KVKK/COPPA: tek dokunuşla silme).
// Silinenler: kullanım sayaçları, abonelik kaydı, masallar (metin + ses kaydı), ses klonu, paylaşım bağlantıları.
// Üretimde ayrıca auth kullanıcısı (service role ile) ve Storage'daki ses dosyaları silinir.
// Maliyet ve işaretli içerik logları kişisel veri içermez (anonim), silinecek bir şey yoktur.
import { type AuthProvider, type EntitlementStore, errorResponse, type UsageStore } from "../_shared/http.ts";
import type { StoryStore } from "../_shared/engine/store.ts";
import { type CloneVoiceStore, deleteCloneVoice, type VoiceCloner } from "../_shared/tts/voice.ts";
import type { AudioStore } from "../_shared/tts/tts.ts";
import type { ShareStore } from "../_shared/share.ts";
import type { ReferralStore } from "../_shared/referral.ts";
import type { PurchaseStore } from "../_shared/packs.ts";

export interface AccountDeps {
  auth: AuthProvider;
  usage: UsageStore;
  /** Abonelik kaydı sunucudan silinir; App Store aboneliğinin kendisi Apple tarafında iptal edilmelidir. */
  entitlements?: EntitlementStore;
  stories?: StoryStore;
  cloneVoices?: CloneVoiceStore;
  shares?: ShareStore;
  referrals?: ReferralStore;
  /** Paket sahipliği sunucudan silinir; Apple tarafındaki satın alma kalır ve "geri yükle" ile yeni hesaba gelir. */
  purchases?: PurchaseStore;
  /** Klon sesi sağlayıcıdan da silmek için. */
  cloner?: VoiceCloner;
  audio?: AudioStore;
  /** Üretimde: auth.users satırını siler (tüm tablolar cascade ile temizlenir). Diğer silmelerden sonra çalışır. */
  deleteAuthUser?: (userId: string) => Promise<void>;
}

export function createAccountHandler(deps: AccountDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "DELETE") return errorResponse(405, "method_not_allowed");
    const userId = await deps.auth.userId(req);
    if (!userId) return errorResponse(401, "unauthorized");
    // Önce sağlayıcıdaki klon ses (başarısızsa hiçbir şey silinmez; istemci tekrar dener — yarım silme yok).
    try {
      await deleteCloneVoice(userId, deps);
    } catch {
      return errorResponse(502, "provider_delete_failed");
    }
    await Promise.all([
      deps.usage.deleteUser(userId),
      deps.entitlements?.deleteUser(userId),
      deps.stories?.deleteUser(userId),
      deps.shares?.deleteUser(userId),
      deps.referrals?.deleteUser(userId),
      deps.purchases?.deleteUser(userId),
    ]);
    await deps.deleteAuthUser?.(userId);
    return new Response(null, { status: 204 });
  };
}
