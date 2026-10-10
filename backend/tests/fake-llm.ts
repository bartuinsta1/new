// Testler için sahte LLM: sırayla verilen yanıtları döndürür, çağrıları kaydeder.
import type { Language, StoryRequest } from "../supabase/functions/_shared/contract.ts";
import type { EngineDeps } from "../supabase/functions/_shared/engine/engine.ts";
import { MemoryCostLog, MemoryFlagLog, MemoryStoryStore } from "../supabase/functions/_shared/engine/store.ts";
import type { LlmResult, LlmUsage, StoryLLM } from "../supabase/functions/_shared/engine/llm.ts";
import type { LlmStory, Moderation } from "../supabase/functions/_shared/engine/schema.ts";

export const USAGE: LlmUsage = { input_tokens: 2000, output_tokens: 3000, cache_read_input_tokens: 1500, cache_creation_input_tokens: 0 };

export type WriteStep = LlmStory | { fail: "refusal" | "max_tokens" | "parse_error" | "api_error" };
export type ModStep = Moderation | { fail: "refusal" | "api_error" };

export class FakeLLM implements StoryLLM {
  writes: StoryRequest[] = [];
  moderations: string[] = [];
  private writeSteps: WriteStep[];
  private modSteps: ModStep[];
  constructor(writeSteps: WriteStep[], modSteps: ModStep[] = []) {
    this.writeSteps = writeSteps;
    this.modSteps = modSteps;
  }

  async writeStory(req: StoryRequest): Promise<LlmResult<LlmStory>> {
    this.writes.push(req);
    const step = this.writeSteps.shift() ?? { fail: "api_error" as const };
    if ("fail" in step) return { ok: false, reason: step.fail, usage: USAGE };
    return { ok: true, value: step, usage: USAGE };
  }

  async moderate(text: string, _lang: Language): Promise<LlmResult<Moderation>> {
    this.moderations.push(text);
    const step = this.modSteps.shift() ?? SAFE;
    if ("fail" in step) return { ok: false, reason: step.fail, usage: USAGE };
    return { ok: true, value: step, usage: { ...USAGE, output_tokens: 50 } };
  }
}

export const SAFE: Moderation = { verdict: "safe", categories: [], reason: "ok" };
export const UNSAFE: Moderation = { verdict: "unsafe", categories: ["fear_or_nightmare"], reason: "scary" };

/** İyi bir Türkçe masal (kurallara uyan). */
export function goodStory(name = "Ayşe", lang: Language = "tr"): LlmStory {
  const tr = lang === "tr";
  const p = (text: string, emotion: LlmStory["paragraphs"][number]["emotion"] = "neutral") => ({ text, scene_hint: "orman", emotion });
  return {
    title: tr ? `${name} ve Parlayan Yaprak` : `${name} and the Glowing Leaf`,
    cover_scene: { region: "whisper_forest", time_of_day: "dusk" },
    characters: ["pamuk", "findik"],
    paragraphs: tr
      ? [
        p(`Bir varmış bir yokmuş, Fısıltı Ormanı'nda ${name} adında bir çocuk yaşarmış.`, "smiling"),
        p(`Bir akşam Fındık, ${name}'ye parlayan bir yaprak göstermiş.`, "surprised"),
        p("Yaprağın ışığı azalıyormuş. Birlikte ona yeni bir dal bulmuşlar."),
        p(`${name} yaprağı dala koymuş, ışık yeniden parlamış.`, "smiling"),
        p("Orman sessizleşmiş. Fındık uzun uzun esnemiş.", "whisper"),
        p(`Gökten üç elma düşmüş: biri ${name}'ye, biri Fındık'a, biri de dinleyene. İyi geceler.`, "sleepy"),
      ]
      : [
        p(`Once upon a time, in Whisper Forest, there lived a child named ${name}.`, "smiling"),
        p(`One evening Fındık showed ${name} a glowing leaf.`, "surprised"),
        p("The leaf's light was fading. Together they found it a new branch."),
        p(`${name} placed the leaf on the branch and it glowed again.`, "smiling"),
        p("The forest grew quiet. Fındık gave a long yawn.", "whisper"),
        p(`Three apples fell from the sky: one for ${name}, one for Fındık, and one for you. Good night.`, "sleepy"),
      ],
    moral: tr ? "Birlikte olunca ışık büyür." : "Together, the light grows.",
    new_recurring_character: { name: tr ? "Işık Yaprak" : "Glow Leaf", card: tr ? "Geceleri parlayan küçük bir yaprak." : "A little leaf that glows at night." },
  };
}

/** İyi masala bir paragraf ekler (yasaklı içerik testi için). */
export function storyWith(extra: string, name = "Ayşe", lang: Language = "tr"): LlmStory {
  const s = goodStory(name, lang);
  s.paragraphs.splice(2, 0, { text: extra, scene_hint: "x", emotion: "neutral" });
  return s;
}

export const baseRequest: StoryRequest = {
  child_name: "Ayşe", child_age: 5, pronunciation: null, interests: ["animals"], value: "sharing",
  companion_character: "findik", region: "whisper_forest", mood: "calm", duration_minutes: 10,
  recurring_characters: [], recent_story_titles: [], voice: "mother", language: "tr",
  content_filters: { allow_mild_scary: false, allow_conflict: false, allow_loss_and_separation: false },
};

/** Sahte LLM + bellek içi depolarla motor bağımlılıkları. */
export function deps(writes: WriteStep[], mods: ModStep[] = []) {
  let n = 0;
  return {
    llm: new FakeLLM(writes, mods), stories: new MemoryStoryStore(), flags: new MemoryFlagLog(), costs: new MemoryCostLog(),
    now: () => new Date("2026-10-10T18:00:00Z"), newId: () => `story-${++n}`,
  } satisfies EngineDeps;
}
