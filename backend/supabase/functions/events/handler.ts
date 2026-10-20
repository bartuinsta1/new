// POST /events → { events: [{ name, dims? }] }  anonim kullanım olaylarını toplu sayar (en çok 50 olay).
// Oturum gerekir (kötüye kullanımı sınırlamak için) ama kullanıcı kimliği SAKLANMAZ; gün sunucuda belirlenir.
import { type AuthProvider, errorResponse, istanbulDay, type RateLimiter } from "../_shared/http.ts";
import { type AnalyticsStore, canonical, EVENT_SCHEMA } from "../_shared/analytics.ts";

const MAX_EVENTS = 50;

export function createEventsHandler(deps: { auth: AuthProvider; store: AnalyticsStore; limiter: RateLimiter;
                                            now?: () => Date }) {
  const now = deps.now ?? (() => new Date());
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return errorResponse(405, "method_not_allowed");
    const userId = await deps.auth.userId(req);
    if (!userId) return errorResponse(401, "unauthorized");
    if (!deps.limiter.allow(`events:${userId}`)) return errorResponse(429, "rate_limited");

    let body: { events?: unknown };
    try { body = await req.json(); } catch { return errorResponse(400, "invalid_json"); }
    if (!Array.isArray(body.events) || body.events.length > MAX_EVENTS) return errorResponse(400, "invalid_events");

    // Aynı istekteki aynı olayları birleştir; geçersiz olaylar sessizce atlanır (eski uygulama sürümleri bozulmasın).
    const grouped = new Map<string, { name: string; dims: Record<string, string | number | boolean>; n: number }>();
    let accepted = 0;
    for (const e of body.events) {
      if (typeof e !== "object" || e === null) continue;
      const { name, dims = {} } = e as { name?: unknown; dims?: unknown };
      const validate = typeof name === "string" ? EVENT_SCHEMA[name] : undefined;
      if (!validate || typeof dims !== "object" || dims === null || Array.isArray(dims)) continue;
      const clean = validate(dims as Record<string, unknown>);
      if (!clean) continue;
      const k = `${name}|${canonical(clean)}`;
      const g = grouped.get(k) ?? { name: name as string, dims: clean, n: 0 };
      g.n++;
      grouped.set(k, g);
      accepted++;
    }
    const day = istanbulDay(now());
    for (const g of grouped.values()) await deps.store.increment(day, g.name, g.dims, g.n);
    return new Response(JSON.stringify({ accepted }), { status: 202, headers: { "content-type": "application/json" } });
  };
}
