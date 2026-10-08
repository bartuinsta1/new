import { createVoiceCloneHandler } from "./handler.ts";
import { auth, stores } from "../_shared/deps.ts";

Deno.serve(createVoiceCloneHandler({ auth, entitlements: stores }));
