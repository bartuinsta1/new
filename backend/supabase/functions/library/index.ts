import { createLibraryHandler } from "./handler.ts";
import { auth, stores } from "../_shared/deps.ts";

Deno.serve(createLibraryHandler({ auth, entitlements: stores, usage: stores }));
