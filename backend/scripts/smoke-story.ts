// Gerçek Claude API ile tek masal üretip güvenlik hattından geçirir ve maliyeti yazdırır.
// Kullanım (API anahtarı gerekir; çağrı başına yaklaşık 0,003 $):
//   cd backend && ANTHROPIC_API_KEY=... node --experimental-strip-types --no-warnings scripts/smoke-story.ts [tr|en] [5|10|15]
import { generateStory } from "../supabase/functions/_shared/engine/engine.ts";
import { ClaudeStoryLLM, type Effort } from "../supabase/functions/_shared/engine/llm.ts";
import { MemoryCostLog, MemoryFlagLog, MemoryStoryStore } from "../supabase/functions/_shared/engine/store.ts";
import type { StoryRequest } from "../supabase/functions/_shared/contract.ts";

const lang = (process.argv[2] === "en" ? "en" : "tr") as "tr" | "en";
const minutes = Number(process.argv[3] ?? 5) as 5 | 10 | 15;
const effort = (process.env.STORY_EFFORT ?? "low") as Effort;

const request: StoryRequest = {
  child_name: lang === "tr" ? "Ayşe" : "Emma", child_age: 5, pronunciation: null,
  interests: ["animals", "space"], value: "sharing", companion_character: "findik", region: "whisper_forest",
  mood: "calm", duration_minutes: minutes, recurring_characters: [], recent_story_titles: [], voice: "mother",
  language: lang, content_filters: { allow_mild_scary: false, allow_conflict: false, allow_loss_and_separation: false },
};

const flags = new MemoryFlagLog();
const costs = new MemoryCostLog();
const started = Date.now();
const result = await generateStory("smoke", request, {
  llm: new ClaudeStoryLLM({ storyEffort: effort }), stories: new MemoryStoryStore(), flags, costs,
});
const seconds = ((Date.now() - started) / 1000).toFixed(1);

console.log(`\n# ${result.story.title}  (${result.source}, ${seconds} sn, effort=${effort})\n`);
for (const p of result.story.paragraphs) console.log(`[${p.emotion}] ${p.text}\n`);
console.log("Ders:", result.story.moral);
console.log("Yeni karakter:", result.story.new_recurring_character);
console.log("Kalite uyarıları:", result.warnings.length ? result.warnings : "yok");
console.log("İşaretler:", flags.entries.map((f) => `${f.stage}:${f.reasons.join("|")}`));
const c = costs.entries[0];
console.log(`Token: girdi ${c.llmInputTokens}, çıktı ${c.llmOutputTokens}, önbellek okuma ${c.llmCacheReadTokens}, yazma ${c.llmCacheWriteTokens}`);
console.log(`Tahmini maliyet: $${c.costUSD.toFixed(5)} (${c.attempts} deneme)`);
