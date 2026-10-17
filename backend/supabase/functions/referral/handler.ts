// GET  /referral         → { code, rewards_this_year, reward_days }   kendi davet kodu
// POST /referral/redeem  → { code }  davet kodunu kullan: davet eden + edilen 7 gün Premium
import { type AuthProvider, type EntitlementStore, errorResponse, json, pathAfter, type RateLimiter } from "../_shared/http.ts";
import {
  normalizeReferralCode, REFERRAL_MAX_REWARDS_PER_YEAR, REFERRAL_REWARD_DAYS, type ReferralStore,
} from "../_shared/referral.ts";

export interface ReferralDeps {
  auth: AuthProvider;
  referrals: ReferralStore;
  entitlements: EntitlementStore;
  limiter: RateLimiter;
  now?: () => Date;
}

const YEAR_MS = 365 * 86_400_000;

export function createReferralHandler(deps: ReferralDeps) {
  const now = deps.now ?? (() => new Date());
  return async (req: Request): Promise<Response> => {
    const userId = await deps.auth.userId(req);
    if (!userId) return errorResponse(401, "unauthorized");
    const rest = pathAfter(req, "referral");

    if (req.method === "GET" && rest.length === 0) {
      const code = await deps.referrals.codeFor(userId);
      const rewards = await deps.referrals.rewardsSince(userId, new Date(now().getTime() - YEAR_MS));
      return json({ code, rewards_this_year: rewards, reward_days: REFERRAL_REWARD_DAYS });
    }

    if (req.method !== "POST" || rest[0] !== "redeem" || rest.length !== 1) {
      return errorResponse(405, "method_not_allowed");
    }
    // Kod tahminine karşı: kullanıcı başına dakikada birkaç deneme (genel sınırlayıcıyla).
    if (!deps.limiter.allow(`referral:${userId}`)) return errorResponse(429, "rate_limited");

    let body: { code?: unknown };
    try { body = await req.json(); } catch { return errorResponse(400, "invalid_json"); }
    const code = typeof body.code === "string" ? normalizeReferralCode(body.code) : null;
    if (!code) return errorResponse(400, "invalid_code");

    const inviter = await deps.referrals.ownerOf(code);
    if (!inviter) return errorResponse(404, "invalid_code");
    if (inviter === userId) return errorResponse(409, "own_code");
    if (await deps.referrals.redemptionBy(userId)) return errorResponse(409, "already_redeemed");
    const reverse = await deps.referrals.redemptionBy(inviter);
    if (reverse?.inviter === userId) return errorResponse(409, "already_redeemed");

    const t = now();
    const inviteeUntil = await deps.entitlements.grantBonusDays(userId, REFERRAL_REWARD_DAYS, t);
    // Davet edenin yıllık sınırı dolmuşsa yalnızca davet edilen kazanır (arkadaşı yine de ödüllendirilir).
    const inviterRewards = await deps.referrals.rewardsSince(inviter, new Date(t.getTime() - YEAR_MS));
    const inviterRewarded = inviterRewards < REFERRAL_MAX_REWARDS_PER_YEAR;
    if (inviterRewarded) await deps.entitlements.grantBonusDays(inviter, REFERRAL_REWARD_DAYS, t);
    await deps.referrals.record({ inviter, invitee: userId, at: t });

    return json({ premium_until: inviteeUntil.toISOString(), inviter_rewarded: inviterRewarded });
  };
}
