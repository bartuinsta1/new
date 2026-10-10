import { createAdminCostsHandler } from "./handler.ts";
import { costLog } from "../_shared/deps.ts";

Deno.serve(createAdminCostsHandler({ costs: costLog, adminToken: Deno.env.get("ADMIN_TOKEN") }));
