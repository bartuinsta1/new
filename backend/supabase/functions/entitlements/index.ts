import { createEntitlementsHandler } from "./handler.ts";
import { auth, stores } from "../_shared/deps.ts";

Deno.serve(createEntitlementsHandler({ auth, entitlements: stores, usage: stores }));
