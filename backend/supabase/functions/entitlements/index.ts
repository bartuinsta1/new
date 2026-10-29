import { createEntitlementsHandler } from "./handler.ts";
import { appStoreVerifier, auth, purchaseStore, stores } from "../_shared/deps.ts";

Deno.serve(createEntitlementsHandler({ auth, entitlements: stores, usage: stores, verifier: appStoreVerifier,
  purchases: purchaseStore }));
