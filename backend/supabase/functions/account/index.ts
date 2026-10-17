import { createAccountHandler } from "./handler.ts";
import { auth, cloneVoices, referralStore, shareStore, storyStore, stores } from "../_shared/deps.ts";

Deno.serve(createAccountHandler({ auth, usage: stores, entitlements: stores, stories: storyStore, cloneVoices, shares: shareStore, referrals: referralStore }));
