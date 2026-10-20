import { createEventsHandler } from "./handler.ts";
import { analyticsStore, auth, limiter } from "../_shared/deps.ts";

Deno.serve(createEventsHandler({ auth, store: analyticsStore, limiter }));
