import { createLibraryHandler } from "./handler.ts";
import { auth, purchaseStore, stores } from "../_shared/deps.ts";

Deno.serve(createLibraryHandler({ auth, entitlements: stores, usage: stores, purchases: purchaseStore }));
