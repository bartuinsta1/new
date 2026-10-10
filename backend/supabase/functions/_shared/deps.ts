// Fonksiyonların bağımlılıkları. ANTHROPIC_API_KEY tanımlıysa gerçek masal motoru (Claude Haiku 5.5), değilse sahte masal.
// Not: her Edge Function ayrı bir isolate'te çalışır; bellek içi depolar fonksiyonlar arasında paylaşılmaz.
// Üretimde StoryStore / FlagLog / CostLog Postgres tablolarına bağlanır (bkz. migrations; Adım 10'da Supabase istemcisiyle).
import { MemoryStores, mockAuth, RateLimiter } from "./http.ts";
import type { EngineDeps } from "./engine/engine.ts";
import { ClaudeStoryLLM, type Effort } from "./engine/llm.ts";
import { MemoryCostLog, MemoryFlagLog, MemoryStoryStore } from "./engine/store.ts";

export const stores = new MemoryStores();
export const auth = mockAuth;
/** Kullanıcı başına dakikada 20 istek. */
export const limiter = new RateLimiter(20, 60_000);

export const storyStore = new MemoryStoryStore();
export const flagLog = new MemoryFlagLog();
export const costLog = new MemoryCostLog();

function env(key: string): string | undefined {
  return typeof Deno !== "undefined" ? Deno.env.get(key) : undefined;
}

export function makeEngine(): EngineDeps | undefined {
  if (!env("ANTHROPIC_API_KEY")) return undefined;
  const effort = (env("STORY_EFFORT") as Effort | undefined) ?? "low";
  return {
    llm: new ClaudeStoryLLM({ storyEffort: effort }),
    stories: storyStore,
    flags: flagLog,
    costs: costLog,
  };
}
