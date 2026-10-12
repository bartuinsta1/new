// DELETE /account → tüm verileri sil (KVKK/COPPA: tek dokunuşla silme).
// Silinenler: kullanım sayaçları, abonelik kaydı, masallar (metin + ses kaydı), ses klonu, paylaşım bağlantıları.
// Üretimde ayrıca auth kullanıcısı (service role ile) ve Storage'daki ses dosyaları silinir.
// Maliyet ve işaretli içerik logları kişisel veri içermez (anonim), silinecek bir şey yoktur.
import { type AuthProvider, type EntitlementStore, errorResponse, type UsageStore } from "../_shared/http.ts";
import type { StoryStore } from "../_shared/engine/store.ts";
import type { CloneVoiceStore } from "../_shared/tts/voice.ts";
import type { ShareStore } from "../_shared/share.ts";

export interface AccountDeps {
  auth: AuthProvider;
  usage: UsageStore;
  /** Abonelik kaydı sunucudan silinir; App Store aboneliğinin kendisi Apple tarafında iptal edilmelidir. */
  entitlements?: EntitlementStore;
  stories?: StoryStore;
  cloneVoices?: CloneVoiceStore;
  shares?: ShareStore;
}

export function createAccountHandler(deps: AccountDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "DELETE") return errorResponse(405, "method_not_allowed");
    const userId = await deps.auth.userId(req);
    if (!userId) return errorResponse(401, "unauthorized");
    await Promise.all([
      deps.usage.deleteUser(userId),
      deps.entitlements?.deleteUser(userId),
      deps.stories?.deleteUser(userId),
      deps.cloneVoices?.delete(userId),
      deps.shares?.deleteUser(userId),
    ]);
    return new Response(null, { status: 204 });
  };
}
