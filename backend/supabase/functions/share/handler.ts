// POST /share        → { url }   (oturum gerekli; yalnızca kendi masalı)
// GET  /share/:token → herkese açık önizleme verisi (başlık, metin, ilk paragrafın sesi, uygulama bağlantısı)
import { type AuthProvider, errorResponse, json, pathAfter, type RateLimiter } from "../_shared/http.ts";
import type { StoryStore } from "../_shared/engine/store.ts";
import { newShareToken, SHARE_TTL_DAYS, type ShareStore } from "../_shared/share.ts";
import type { ReferralStore } from "../_shared/referral.ts";

/** Web önizlemesine giden paragraf sayısı. */
export const PREVIEW_PARAGRAPHS = 3;

export interface ShareDeps {
  auth: AuthProvider;
  stories: StoryStore;
  shares: ShareStore;
  limiter: RateLimiter;
  /** Web önizleme sayfasının kökü, ör. https://masalcik.app */
  publicBaseUrl: string;
  appStoreUrl: string;
  /** Varsa önizlemede paylaşanın davet kodu gösterilir (arkadaş girerse ikisi de 1 hafta Premium). */
  referrals?: ReferralStore;
  now?: () => Date;
}

export function createShareHandler(deps: ShareDeps) {
  const now = deps.now ?? (() => new Date());
  return async (req: Request): Promise<Response> => {
    const rest = pathAfter(req, "share");

    if (req.method === "GET" && rest.length === 1) {
      const entry = await deps.shares.get(rest[0]);
      if (!entry) return errorResponse(404, "not_found");
      if (entry.expiresAt < now()) return errorResponse(410, "expired");
      const stored = await deps.stories.get(entry.userId, entry.storyId);
      if (!stored) return errorResponse(404, "not_found");
      const s = stored.story;
      const inviteCode = deps.referrals ? await deps.referrals.codeFor(entry.userId) : null;
      // Önizleme: kullanıcı kimliği, masal kimliği ya da diğer kişisel alanlar dönmez.
      return json({
        title: s.title,
        language: stored.language,
        region: s.cover_scene.region,
        // Veri minimizasyonu: önizleme sayfası ilk iki paragrafı (+ soluk bir üçüncü) gösterir; tamamı gönderilmez.
        paragraphs: s.paragraphs.slice(0, PREVIEW_PARAGRAPHS).map((p) => p.text),
        preview_audio_url: s.paragraphs[0]?.audio_url ?? null,
        app_store_url: deps.appStoreUrl,
        invite_code: inviteCode,
      }, 200, { "cache-control": "private, max-age=300" });
    }

    if (req.method !== "POST" || rest.length !== 0) return errorResponse(405, "method_not_allowed");
    const userId = await deps.auth.userId(req);
    if (!userId) return errorResponse(401, "unauthorized");
    if (!deps.limiter.allow(`share:${userId}`)) return errorResponse(429, "rate_limited");

    let body: { story_id?: unknown };
    try { body = await req.json(); } catch { return errorResponse(400, "invalid_json"); }
    if (typeof body.story_id !== "string" || body.story_id.length > 64) return errorResponse(400, "invalid_story_id");
    const stored = await deps.stories.get(userId, body.story_id);
    if (!stored) return errorResponse(404, "not_found");

    const token = newShareToken();
    const created = now();
    await deps.shares.save({
      token, userId, storyId: body.story_id, createdAt: created,
      expiresAt: new Date(created.getTime() + SHARE_TTL_DAYS * 86_400_000),
    });
    return json({ url: `${deps.publicBaseUrl.replace(/\/$/, "")}/s/${token}` }, 201);
  };
}
