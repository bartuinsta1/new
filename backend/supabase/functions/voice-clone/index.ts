import { createVoiceCloneHandler } from "./handler.ts";
import { audioStore, auth, cloneVoices, stores, voiceCloner } from "../_shared/deps.ts";

Deno.serve(createVoiceCloneHandler({ auth, entitlements: stores, cloneVoices, cloner: voiceCloner, audio: audioStore }));
