import { createAccountHandler } from "./handler.ts";
import { auth, stores } from "../_shared/deps.ts";

Deno.serve(createAccountHandler({ auth, usage: stores }));
