import { createAccountHandler } from "./handler.ts";
import { auth, cloneVoices, shareStore, storyStore, stores } from "../_shared/deps.ts";

Deno.serve(createAccountHandler({ auth, usage: stores, stories: storyStore, cloneVoices, shares: shareStore }));
