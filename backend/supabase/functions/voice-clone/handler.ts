// POST /voice-clone   → ebeveyn ses örneğini yükler (Premium + ayrı açık rıza zorunlu).
// DELETE /voice-clone → ses örneğini ve klon sesi siler.
import { type AuthProvider, type EntitlementStore, errorResponse, json } from "../_shared/http.ts";
import type { CloneVoiceStore } from "../_shared/tts/voice.ts";

const MAX_SAMPLE_BYTES = 5 * 1024 * 1024; // ~1 dk m4a için bol

export function createVoiceCloneHandler(deps: { auth: AuthProvider; entitlements: EntitlementStore; cloneVoices?: CloneVoiceStore }) {
  return async (req: Request): Promise<Response> => {
    const userId = await deps.auth.userId(req);
    if (!userId) return errorResponse(401, "unauthorized");

    if (req.method === "DELETE") {
      // Gerçekte: Storage'daki örneği sil + TTS sağlayıcısındaki klon sesi sil + voice_clones satırını sil.
      await deps.cloneVoices?.delete(userId);
      return new Response(null, { status: 204 });
    }
    if (req.method !== "POST") return errorResponse(405, "method_not_allowed");
    if (!(await deps.entitlements.isPremium(userId))) return errorResponse(402, "premium_required");

    // KVKK: ses biyometrik veri sayılabilir → ayrı, açık rıza zaman damgası zorunlu.
    const consent = req.headers.get("x-consent-at");
    if (!consent || Number.isNaN(Date.parse(consent))) return errorResponse(400, "consent_required");

    const body = new Uint8Array(await req.arrayBuffer());
    if (body.byteLength === 0 || body.byteLength > MAX_SAMPLE_BYTES) return errorResponse(400, "invalid_sample");
    // SAHTE: gerçek sürümde örnek ElevenLabs'e yüklenir, dönen ses kimliği saklanır (Adım 9).
    const voiceId = `mock-${userId}`;
    await deps.cloneVoices?.set(userId, voiceId);
    return json({ voice_id: voiceId, status: "processing" }, 202);
  };
}
