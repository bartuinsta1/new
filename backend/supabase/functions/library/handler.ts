// GET /library → hazır (önceden üretilmiş, CDN'deki) masallar.
import { type AuthProvider, errorResponse, json } from "../_shared/http.ts";
import { MOCK_LIBRARY } from "../_shared/mock.ts";

export function createLibraryHandler(deps: { auth: AuthProvider }) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "GET") return errorResponse(405, "method_not_allowed");
    if (!(await deps.auth.userId(req))) return errorResponse(401, "unauthorized");
    // Hazır kütüphane herkese aynı: CDN'de 1 saat önbelleklenebilir.
    return json(MOCK_LIBRARY, 200, { "cache-control": "public, max-age=3600" });
  };
}
