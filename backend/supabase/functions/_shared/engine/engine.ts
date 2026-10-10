// Masal motoru (§4): temizle → üret → kural denetimi → moderasyon → (bir kez yeniden üret) → güvenli yedek.
// Çocuk hiçbir zaman hata ekranı görmez: her yolun sonunda dinlenebilir bir masal vardır.
import type { CharacterID, Story, StoryRequest } from "../contract.ts";
import { mockStory } from "../mock.ts";
import { addUsage, estimateCostUSD, type LlmUsage, type StoryLLM, ZERO_USAGE } from "./llm.ts";
import { checkStory, containsHarmful, looksLikeInjection, maskPersonalData, sanitizeRequest, storyText } from "./safety.ts";
import type { LlmStory } from "./schema.ts";
import type { CostLog, FlagLog, StoryStore } from "./store.ts";

export interface EngineDeps {
  llm: StoryLLM;
  stories: StoryStore;
  flags: FlagLog;
  costs: CostLog;
  now?: () => Date;
  newId?: () => string;
}

export type EngineSource = "generated" | "regenerated" | "fallback" | "cached";

export interface EngineResult {
  story: Story;
  source: EngineSource;
  warnings: string[];
  costUSD: number;
}

/** Üretim denemesi sayısı: ilk deneme + bir yeniden üretim (§4.4 madde 3). */
export const MAX_ATTEMPTS = 2;

export async function generateStory(
  userId: string,
  raw: StoryRequest,
  deps: EngineDeps,
  opts: { idempotencyKey?: string } = {},
): Promise<EngineResult> {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? (() => crypto.randomUUID());

  // Aynı istek tekrar gelirse (ağ kopması, yeniden deneme) yeniden üretme: önbellekten dön.
  if (opts.idempotencyKey) {
    const cached = await deps.stories.findByIdempotencyKey(userId, opts.idempotencyKey);
    if (cached) return { story: cached.story, source: "cached", warnings: [], costUSD: 0 };
  }

  // 1) Girdi temizleme. Ad/telaffuz uygunsuzsa UnsafeInputError fırlar (çağıran 400 döner, ebeveyn düzeltir).
  const { request, issues } = sanitizeRequest(raw);
  if (issues.length) {
    await deps.flags.record({ stage: "input", reasons: issues.map((i) => `${i.field}:${i.reason}`), language: request.language, at: now() });
  }

  let usage: LlmUsage = ZERO_USAGE;
  let accepted: LlmStory | null = null;
  let warnings: string[] = [];
  let attempts = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && !accepted; attempt++) {
    attempts = attempt;
    // 2) Üretim (sistem promptu + JSON şeması)
    const written = await deps.llm.writeStory(request);
    usage = addUsage(usage, written.usage);
    if (!written.ok) {
      await deps.flags.record({ stage: "llm", reasons: [written.reason, written.detail ?? ""].filter(Boolean), language: request.language, at: now() });
      continue;
    }
    const candidate = written.value;

    // 3a) Deterministik kural denetimi
    const check = checkStory(candidate, request);
    if (check.blocking.length) {
      await deps.flags.record({
        stage: "rules", reasons: check.blocking, language: request.language, at: now(),
        excerpt: maskPersonalData(storyText(candidate).slice(0, 400), request.child_name),
      });
      continue;
    }

    // 3b) İkinci model çağrısıyla moderasyon. Moderasyon çalışmazsa "güvensiz" sayılır (fail closed).
    const moderation = await deps.llm.moderate(storyText(candidate), request.language, allowedThemes(request));
    usage = addUsage(usage, moderation.usage);
    if (!moderation.ok || moderation.value.verdict !== "safe") {
      await deps.flags.record({
        stage: "moderation",
        reasons: moderation.ok ? moderation.value.categories : [`moderation_${moderation.reason}`],
        language: request.language, at: now(),
        excerpt: maskPersonalData(storyText(candidate).slice(0, 400), request.child_name),
      });
      continue;
    }
    accepted = candidate;
    warnings = check.warnings;
  }

  // 4) Hâlâ yoksa: hazır, güvenli kütüphane masalı (yalnızca doğrulanmış ad yerleştirilir).
  let story: Story;
  let source: EngineSource;
  if (accepted) {
    story = toContractStory(accepted, request, newId());
    source = attempts > 1 ? "regenerated" : "generated";
  } else {
    story = { ...mockStory(request, newId()), is_fallback: true };
    source = "fallback";
    await deps.flags.record({ stage: "fallback", reasons: ["all_attempts_failed"], language: request.language, at: now() });
  }

  const costUSD = estimateCostUSD(usage);
  await deps.stories.save({ userId, story, language: request.language, idempotencyKey: opts.idempotencyKey, createdAt: now() });
  await deps.costs.record({
    at: now(), language: request.language, durationMinutes: request.duration_minutes,
    llmInputTokens: usage.input_tokens, llmOutputTokens: usage.output_tokens,
    llmCacheReadTokens: usage.cache_read_input_tokens, llmCacheWriteTokens: usage.cache_creation_input_tokens,
    // TTS karakterleri Adım 6'da eklenecek; şimdilik seslendirilecek metnin uzunluğu.
    ttsCharacters: story.paragraphs.reduce((s, p) => s + p.text.length, 0),
    costUSD, attempts, outcome: source,
  });
  return { story, source, warnings, costUSD };
}

function allowedThemes(r: StoryRequest): string[] {
  const a: string[] = [];
  if (r.content_filters.allow_mild_scary) a.push("mild excitement (story must still end safe)");
  if (r.content_filters.allow_conflict) a.push("small disagreements that are resolved kindly");
  if (r.content_filters.allow_loss_and_separation) a.push("gentle, hopeful themes of loss or separation");
  return a;
}

function toContractStory(s: LlmStory, r: StoryRequest, id: string): Story {
  const characters: CharacterID[] = [...new Set<CharacterID>([...s.characters, r.companion_character])];
  return {
    id,
    title: s.title.trim(),
    // Kapak bölgesi istenen bölgedir; model başka bir bölge seçse bile çocuğun seçimi geçerli.
    cover_scene: { region: r.region, time_of_day: s.cover_scene.time_of_day },
    characters,
    paragraphs: s.paragraphs.map((p, index) => ({
      index, text: p.text.trim(), scene_hint: p.scene_hint, emotion: p.emotion, audio_url: null,
    })),
    moral: s.moral.trim() || null,
    // Yeni karakter sonraki masallara bağlam olarak geri döner: uygunsuzsa hiç saklanmaz.
    new_recurring_character: s.new_recurring_character &&
        !looksLikeInjection(`${s.new_recurring_character.name} ${s.new_recurring_character.card}`) &&
        !containsHarmful(`${s.new_recurring_character.name} ${s.new_recurring_character.card}`)
      ? s.new_recurring_character
      : null,
    duration_minutes: r.duration_minutes,
    mood: r.mood,
    is_fallback: false,
  };
}
