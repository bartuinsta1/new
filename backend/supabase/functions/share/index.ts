import { createShareHandler } from "./handler.ts";
import { auth, limiter, shareStore, storyStore } from "../_shared/deps.ts";

Deno.serve(createShareHandler({
  auth, stories: storyStore, shares: shareStore, limiter,
  publicBaseUrl: Deno.env.get("PUBLIC_BASE_URL") ?? "https://masalcik.app",
  appStoreUrl: Deno.env.get("APP_STORE_URL") ?? "https://apps.apple.com/app/masalcik",
}));
