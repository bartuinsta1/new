import { createLibraryHandler } from "./handler.ts";
import { auth } from "../_shared/deps.ts";

Deno.serve(createLibraryHandler({ auth }));
