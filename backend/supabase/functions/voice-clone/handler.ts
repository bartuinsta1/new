// POST /voice-clone   → ebeveyn ses örneğinden klon ses oluşturur (Premium + ayrı açık rıza zorunlu).
// DELETE /voice-clone → klon sesi her yerden siler: sağlayıcıdaki ses modeli, kayıt ve bu sesle üretilmiş masal sesleri.
// Ses örneğini biz saklamayız: yalnızca sağlayıcıya (ElevenLabs) iletilir.
import { type AuthProvider, type EntitlementStore, errorResponse, json } from "../_shared/http.ts";
import type { AudioStore } from "../_shared/tts/tts.ts";
import { type CloneVoiceStore, deleteCloneVoice, type VoiceCloner } from "../_shared/tts/voice.ts";

const MAX_SAMPLE_BYTES = 5 * 1024 * 1024; // ~1 dk m4a için bol
const MIN_SAMPLE_BYTES = 20 * 1024;       // birkaç saniyelik kayıt klon için yetersiz

export interface VoiceCloneDeps {
  auth: AuthProvider;
  entitlements: EntitlementStore;
  cloneVoices?: CloneVoiceStore;
  /** Yoksa (ELEVENLABS_API_KEY tanımsız) sahte ses kimliği verilir; seslendirme varsayılan sese düşer. */
  cloner?: VoiceCloner;
  audio?: AudioStore;
}

export function createVoiceCloneHandler(deps: VoiceCloneDeps) {
  return async (req: Request): Promise<Response> => {
    const userId = await deps.auth.userId(req);
    if (!userId) return errorResponse(401, "unauthorized");

    if (req.method === "DELETE") {
      try {
        await deleteCloneVoice(userId, deps);
      } catch {
        return errorResponse(502, "provider_delete_failed");   // istemci tekrar dener; kayıt silinmedi
      }
      return new Response(null, { status: 204 });
    }
    if (req.method !== "POST") return errorResponse(405, "method_not_allowed");
    if (!(await deps.entitlements.isPremium(userId))) return errorResponse(402, "premium_required");

    // KVKK: ses kişiyi tanımlayabilir → ayrı, açık rıza zaman damgası zorunlu (makul aralıkta).
    const consent = Date.parse(req.headers.get("x-consent-at") ?? "");
    if (Number.isNaN(consent) || Math.abs(Date.now() - consent) > 86_400_000) {
      return errorResponse(400, "consent_required");
    }

    const body = new Uint8Array(await req.arrayBuffer());
    if (body.byteLength < MIN_SAMPLE_BYTES || body.byteLength > MAX_SAMPLE_BYTES) {
      return errorResponse(400, "invalid_sample");
    }

    // Önceki klon varsa önce o silinir (tek klon, eski sesle üretilmiş dosyalar kalmasın).
    try {
      await deleteCloneVoice(userId, deps);
    } catch {
      return errorResponse(502, "provider_delete_failed");
    }
    let voiceId: string;
    if (deps.cloner) {
      try {
        voiceId = await deps.cloner.create(body, req.headers.get("content-type") ?? "audio/m4a");
      } catch {
        return errorResponse(502, "provider_clone_failed");
      }
    } else {
      voiceId = `mock-${userId}`;
    }
    await deps.cloneVoices?.set(userId, voiceId, new Date(consent));
    // Anlık klon: ses hemen kullanılabilir.
    return json({ voice_id: voiceId, status: "ready" }, 201);
  };
}
