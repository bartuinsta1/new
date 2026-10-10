// GET /admin-costs?days=30 → masal başına maliyet özeti (yönetim panosu, §4.6).
// Yalnızca ADMIN_TOKEN ile; kişisel veri içermez (maliyet logunda kullanıcı kimliği yok).
import { errorResponse, json } from "../_shared/http.ts";
import type { CostLog } from "../_shared/engine/store.ts";

export function createAdminCostsHandler(deps: { costs: CostLog; adminToken?: string; now?: () => Date }) {
  const now = deps.now ?? (() => new Date());
  return async (req: Request): Promise<Response> => {
    if (req.method !== "GET") return errorResponse(405, "method_not_allowed");
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!deps.adminToken || token !== deps.adminToken) return errorResponse(401, "unauthorized");
    const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get("days") ?? 30) || 30, 1), 365);
    const since = new Date(now().getTime() - days * 86_400_000);
    return json({ days, ...(await deps.costs.summary(since)) });
  };
}
