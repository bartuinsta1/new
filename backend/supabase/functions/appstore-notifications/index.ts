import { createAppStoreNotificationsHandler } from "./handler.ts";
import { appStoreVerifier, purchaseStore, stores } from "../_shared/deps.ts";

Deno.serve(createAppStoreNotificationsHandler({ verifier: appStoreVerifier, entitlements: stores, purchases: purchaseStore }));
