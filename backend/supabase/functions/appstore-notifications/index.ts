import { createAppStoreNotificationsHandler } from "./handler.ts";
import { appStoreVerifier, stores } from "../_shared/deps.ts";

Deno.serve(createAppStoreNotificationsHandler({ verifier: appStoreVerifier, entitlements: stores }));
