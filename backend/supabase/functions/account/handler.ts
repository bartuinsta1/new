// DELETE /account → tüm verileri sil (KVKK/COPPA: tek dokunuşla silme).
// Gerçekte: auth kullanıcısı + aile, çocuk profilleri, masallar, ses dosyaları, ses klonu, kullanım kayıtları.
// Maliyet logları ve işaretli içerik logları zaten kişisel veri içermez (anonim).
import { type AuthProvider, errorResponse, type UsageStore } from "../_shared/http.ts";

export function createAccountHandler(deps: { auth: AuthProvider; usage: UsageStore }) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "DELETE") return errorResponse(405, "method_not_allowed");
    const userId = await deps.auth.userId(req);
    if (!userId) return errorResponse(401, "unauthorized");
    await deps.usage.deleteUser(userId);
    return new Response(null, { status: 204 });
  };
}
