// GET /library     → hazır (önceden üretilmiş, CDN'deki) masalların listesi. Dil: Accept-Language (tr | en).
// GET /library/:id → bir kitaplık masalının tamamı. Ücretsiz hak burada sayılır (§4.6, sunucuda):
//   • `is_free` olmayan masallar yalnızca Premium'da (402 premium_required),
//   • ücretsiz kullanıcı haftada en fazla 3 farklı masal açar (403 weekly_limit_reached);
//     bu hafta zaten açtığı masalı tekrar dinlemek hakkı azaltmaz. Hafta: Türkiye saatiyle pazartesi başlar.
import { FREE_TIER } from "../_shared/contract.ts";
import {
  type AuthProvider, type EntitlementStore, type UsageStore,
  errorResponse, istanbulWeek, json, pathAfter, requestLanguage,
} from "../_shared/http.ts";
import { mockLibrary, mockLibraryStory } from "../_shared/mock.ts";

export function createLibraryHandler(deps: {
  auth: AuthProvider; entitlements: EntitlementStore; usage: UsageStore; now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());
  return async (req: Request): Promise<Response> => {
    if (req.method !== "GET") return errorResponse(405, "method_not_allowed");
    const userId = await deps.auth.userId(req);
    if (!userId) return errorResponse(401, "unauthorized");
    const lang = requestLanguage(req);
    const rest = pathAfter(req, "library");

    if (rest.length === 0) {
      // Liste herkese aynı: CDN'de 1 saat önbelleklenebilir.
      return json(mockLibrary(lang), 200, { "cache-control": "public, max-age=3600", vary: "Accept-Language" });
    }
    if (rest.length !== 1) return errorResponse(404, "not_found");

    const item = mockLibrary(lang).find((i) => i.id === rest[0]);
    if (!item) return errorResponse(404, "not_found");

    if (!(await deps.entitlements.isPremium(userId))) {
      if (!item.is_free) return errorResponse(402, "premium_required");
      const week = istanbulWeek(now());
      const opened = await deps.usage.libraryStoriesInWeek(userId, week);
      if (!opened.includes(item.id)) {
        if (opened.length >= FREE_TIER.libraryStoriesPerWeek) return errorResponse(403, "weekly_limit_reached");
        await deps.usage.recordLibraryStory(userId, week, item.id);
      }
    }
    // Kişiye göre sayaç tuttuğumuz için içerik yanıtı önbelleklenmez (ses dosyaları CDN'de ayrıca önbellekli).
    return json(mockLibraryStory(item, lang), 200, { "cache-control": "private, no-store" });
  };
}
