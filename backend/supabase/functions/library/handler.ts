// GET /library → hazır (önceden üretilmiş, CDN'deki) masallar. Dil: Accept-Language (tr | en).
import { type AuthProvider, errorResponse, json, requestLanguage } from "../_shared/http.ts";
import { mockLibrary } from "../_shared/mock.ts";

export function createLibraryHandler(deps: { auth: AuthProvider }) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "GET") return errorResponse(405, "method_not_allowed");
    if (!(await deps.auth.userId(req))) return errorResponse(401, "unauthorized");
    // Hazır kütüphane herkese aynı: CDN'de 1 saat önbelleklenebilir.
    return json(mockLibrary(requestLanguage(req)), 200, { "cache-control": "public, max-age=3600", vary: "Accept-Language" });
  };
}
