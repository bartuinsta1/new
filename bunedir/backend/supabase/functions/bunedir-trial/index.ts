// Supabase Edge Function girişi. SUPABASE_URL, SUPABASE_ANON_KEY ve SUPABASE_SERVICE_ROLE_KEY
// Supabase tarafından otomatik verilir; PARTNER_SECRET elle eklenir:
//   supabase secrets set PARTNER_SECRET=$(openssl rand -hex 32)
import { createTrialHandler } from "./handler.ts";
import { RateLimiter, RestTrialStore, SupabaseAuth } from "./trial.ts";

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (r: Request) => Promise<Response>): void };

const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`${k} tanımlı değil`);
  return v;
};
const url = env("SUPABASE_URL");

Deno.serve(createTrialHandler({
  auth: new SupabaseAuth(url, env("SUPABASE_ANON_KEY")),
  store: new RestTrialStore(url, env("SUPABASE_SERVICE_ROLE_KEY")),
  // Ortak sunucu toplu deneme yapamasın: dakikada 60 kullanım (isolate başına).
  limiter: new RateLimiter(60, 60_000),
  partnerSecret: Deno.env.get("PARTNER_SECRET") ?? "",
  trialDays: Number(Deno.env.get("TRIAL_DAYS") ?? 60),
}));
