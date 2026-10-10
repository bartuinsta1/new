import { createStoriesHandler } from "./handler.ts";
import { auth, limiter, makeEngine, stores } from "../_shared/deps.ts";

Deno.serve(createStoriesHandler({ auth, usage: stores, entitlements: stores, limiter, engine: makeEngine() }));
