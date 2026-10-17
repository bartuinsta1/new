import { createReferralHandler } from "./handler.ts";
import { auth, limiter, referralStore, stores } from "../_shared/deps.ts";

Deno.serve(createReferralHandler({ auth, referrals: referralStore, entitlements: stores, limiter }));
