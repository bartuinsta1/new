import { createVoiceCloneHandler } from "./handler.ts";
import { auth, cloneVoices, stores } from "../_shared/deps.ts";

Deno.serve(createVoiceCloneHandler({ auth, entitlements: stores, cloneVoices }));
