import { createStoriesHandler } from "./handler.ts";
import { auth, cloneVoices, limiter, makeEngine, makeVoice, stores } from "../_shared/deps.ts";

Deno.serve(createStoriesHandler({
  auth, usage: stores, entitlements: stores, limiter, engine: makeEngine(), voice: makeVoice(), cloneVoices,
}));
