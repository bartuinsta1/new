// Bu Nedir? → diğer uygulamada 2 ay ücretsiz deneme.
//
// Uygulama (kullanıcı JWT'si ile, e-postası doğrulanmış olmalı):
//   GET    /bunedir-trial          → { code, trial_days, redeemed }   yoksa üretir (idempotent)
//   DELETE /bunedir-trial          → 204   hesabı ve kodu siler (App Store 5.1.1(v))
//
// Ortak uygulamanın SUNUCUSU (x-partner-secret başlığı ile; istemciye asla gömülmez):
//   POST   /bunedir-trial/redeem   { code, partner_user_id }
//          → 200 { trial_days, trial_ends_at }   ilk kullanım ya da aynı kullanıcının tekrarı
//          → 404 invalid_code | 409 already_redeemed | 400 bad_request | 401 | 429
import {
  type AuthProvider, DEFAULT_TRIAL_DAYS, newTrialCode, normalizeTrialCode, type RateLimiter, safeEqual, type TrialStore,
} from "./trial.ts";

export interface TrialDeps {
  auth: AuthProvider;
  store: TrialStore;
  limiter: RateLimiter;
  partnerSecret: string;
  trialDays?: number;
  now?: () => Date;
  newCode?: () => string;
}

const DAY_MS = 86_400_000;
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS } });
const error = (status: number, code: string) => json({ error: code }, status);

export function createTrialHandler(deps: TrialDeps) {
  const now = deps.now ?? (() => new Date());
  const trialDays = deps.trialDays ?? DEFAULT_TRIAL_DAYS;
  const makeCode = deps.newCode ?? (() => newTrialCode());

  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const parts = new URL(req.url).pathname.split("/").filter(Boolean);
    const rest = parts.slice(parts.indexOf("bunedir-trial") + 1);

    if (rest[0] === "redeem" && rest.length === 1) {
      if (req.method !== "POST") return error(405, "method_not_allowed");
      return redeem(req);
    }
    if (rest.length !== 0) return error(404, "not_found");

    const user = await deps.auth.user(req);
    if (!user) return error(401, "unauthorized");

    if (req.method === "DELETE") {
      await deps.store.deleteUser(user.id);
      return new Response(null, { status: 204, headers: CORS });
    }
    if (req.method !== "GET") return error(405, "method_not_allowed");
    // Ödül e-postaya bağlı: doğrulanmamış (ör. anonim) hesap kod alamaz.
    if (!user.email || !user.emailConfirmed) return error(403, "email_not_verified");

    let rec = await deps.store.byUser(user.id);
    for (let attempt = 0; !rec && attempt < 5; attempt++) {
      const candidate = { userId: user.id, code: makeCode(), trialDays, issuedAt: now(), redeemedAt: null, partnerUserId: null };
      if (await deps.store.insert(candidate)) rec = candidate;
      else rec = await deps.store.byUser(user.id); // eşzamanlı istek kazanmış olabilir
    }
    if (!rec) return error(500, "code_generation_failed");
    return json({ code: rec.code, trial_days: rec.trialDays, redeemed: rec.redeemedAt !== null });
  };

  async function redeem(req: Request): Promise<Response> {
    const secret = req.headers.get("x-partner-secret") ?? "";
    if (!deps.partnerSecret || !safeEqual(secret, deps.partnerSecret)) return error(401, "unauthorized");
    if (!deps.limiter.allow("redeem")) return error(429, "rate_limited");

    let body: { code?: unknown; partner_user_id?: unknown };
    try { body = await req.json(); } catch { return error(400, "bad_request"); }
    const code = typeof body.code === "string" ? normalizeTrialCode(body.code) : null;
    const partnerUser = typeof body.partner_user_id === "string" ? body.partner_user_id.trim() : "";
    if (!code || !partnerUser || partnerUser.length > 200) return error(400, "bad_request");

    const rec = await deps.store.byCode(code);
    if (!rec) return error(404, "invalid_code");
    const t = now();
    if (!rec.redeemedAt) {
      if (!(await deps.store.markRedeemed(code, partnerUser, t))) return error(409, "already_redeemed");
      return json({ trial_days: rec.trialDays, trial_ends_at: new Date(t.getTime() + rec.trialDays * DAY_MS).toISOString() });
    }
    // Aynı kişi tekrar denerse (ör. uygulamayı yeniden kurdu) aynı bitiş tarihini döndür.
    if (rec.partnerUserId === partnerUser) {
      return json({ trial_days: rec.trialDays, trial_ends_at: new Date(rec.redeemedAt.getTime() + rec.trialDays * DAY_MS).toISOString() });
    }
    return error(409, "already_redeemed");
  }
}
