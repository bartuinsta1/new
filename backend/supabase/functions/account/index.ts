import { createAccountHandler } from "./handler.ts";
import { audioStore, auth, cloneVoices, voiceCloner, referralStore, removeAuthUser, shareStore, storyStore, stores } from "../_shared/deps.ts";

Deno.serve(createAccountHandler({ auth, usage: stores, entitlements: stores, stories: storyStore, cloneVoices, shares: shareStore, referrals: referralStore,
  deleteAuthUser: removeAuthUser, cloner: voiceCloner, audio: audioStore }));
