// Claude API adaptörü. Model: Claude Haiku 5.5 (en düşük maliyetli güncel model; kullanıcı tercihi).
// API anahtarı yalnızca sunucuda: ANTHROPIC_API_KEY (Supabase secrets). İstemciye asla gitmez.
//
// Haiku 5.5 notları:
// - `temperature` / `top_p` / `top_k` gönderilmez (400 döner).
// - Düşünme varsayılan olarak açık (adaptive); derinliği `output_config.effort` ile ayarlanır.
// - Güvenlik sınıflandırıcısı reddederse `stop_reason: "refusal"` gelir ve sunucu tarafı yedek model YOK:
//   reddi burada yakalayıp motora "başarısız" olarak bildiririz; motor yeniden dener ya da güvenli yedeğe düşer.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Language, StoryRequest } from "../contract.ts";
import { buildModerationPrompt, buildSystemPrompt, buildUserPrompt } from "./prompt.ts";
import { type LlmStory, LlmStorySchema, type Moderation, ModerationSchema } from "./schema.ts";

export const STORY_MODEL = "claude-haiku-5-5";

export type Effort = "low" | "medium" | "high";

export interface LlmUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export type LlmResult<T> =
  | { ok: true; value: T; usage: LlmUsage }
  | { ok: false; reason: "refusal" | "max_tokens" | "parse_error" | "api_error"; usage: LlmUsage; detail?: string };

/** Motorun bağımlı olduğu soyutlama: testlerde sahte, üretimde Claude. */
export interface StoryLLM {
  writeStory(req: StoryRequest): Promise<LlmResult<LlmStory>>;
  moderate(storyText: string, lang: Language, allowed: string[]): Promise<LlmResult<Moderation>>;
}

const ZERO: LlmUsage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

function usageOf(u: Anthropic.Usage | undefined): LlmUsage {
  return {
    input_tokens: u?.input_tokens ?? 0,
    output_tokens: u?.output_tokens ?? 0,
    cache_read_input_tokens: u?.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: u?.cache_creation_input_tokens ?? 0,
  };
}

export interface ClaudeOptions {
  client?: Anthropic;
  /** Masal yazımı eforu. Varsayılan "low": hızlı ve ucuz; kalite yetmezse "medium" denenir (env: STORY_EFFORT). */
  storyEffort?: Effort;
  moderationEffort?: Effort;
}

export class ClaudeStoryLLM implements StoryLLM {
  private client: Anthropic;
  private storyEffort: Effort;
  private moderationEffort: Effort;

  constructor(opts: ClaudeOptions = {}) {
    // Kimlik bilgisi ortamdan: ANTHROPIC_API_KEY. Ağ hatası ve 429/5xx'te SDK 2 kez yeniden dener.
    this.client = opts.client ?? new Anthropic({ maxRetries: 2, timeout: 60_000 });
    this.storyEffort = opts.storyEffort ?? "low";
    this.moderationEffort = opts.moderationEffort ?? "low";
  }

  async writeStory(req: StoryRequest): Promise<LlmResult<LlmStory>> {
    try {
      const response = await this.client.messages.parse({
        model: STORY_MODEL,
        // 15 dakikalık Türkçe masal ~3–4K çıktı token'ı + düşünme payı.
        max_tokens: 16000,
        system: [{
          type: "text",
          text: buildSystemPrompt(req.language),
          // Sistem promptu her istekte aynı → önbellekten okunur (~%90 ucuz).
          cache_control: { type: "ephemeral" },
        }],
        messages: [{ role: "user", content: buildUserPrompt(req) }],
        output_config: { effort: this.storyEffort, format: zodOutputFormat(LlmStorySchema) },
      });
      const usage = usageOf(response.usage);
      if (response.stop_reason === "refusal") return { ok: false, reason: "refusal", usage, detail: response.stop_details?.category ?? undefined };
      if (response.stop_reason === "max_tokens") return { ok: false, reason: "max_tokens", usage };
      if (!response.parsed_output) return { ok: false, reason: "parse_error", usage };
      return { ok: true, value: response.parsed_output, usage };
    } catch (error) {
      return { ok: false, reason: "api_error", usage: ZERO, detail: describe(error) };
    }
  }

  async moderate(storyText: string, lang: Language, allowed: string[]): Promise<LlmResult<Moderation>> {
    try {
      const response = await this.client.messages.parse({
        model: STORY_MODEL,
        max_tokens: 4000,
        system: [{ type: "text", text: buildModerationPrompt(lang), cache_control: { type: "ephemeral" } }],
        messages: [{
          role: "user",
          content: `Allowed by the parent: ${allowed.length ? allowed.join(", ") : "nothing extra"}.\n\n<story>\n${storyText}\n</story>`,
        }],
        output_config: { effort: this.moderationEffort, format: zodOutputFormat(ModerationSchema) },
      });
      const usage = usageOf(response.usage);
      if (response.stop_reason === "refusal") return { ok: false, reason: "refusal", usage };
      if (response.stop_reason === "max_tokens") return { ok: false, reason: "max_tokens", usage };
      if (!response.parsed_output) return { ok: false, reason: "parse_error", usage };
      return { ok: true, value: response.parsed_output, usage };
    } catch (error) {
      return { ok: false, reason: "api_error", usage: ZERO, detail: describe(error) };
    }
  }
}

/** Hata özetini loglar için çıkarır; mesaj metni değil, tür ve durum kodu (kişisel veri içermez). */
function describe(error: unknown): string {
  if (error instanceof Anthropic.RateLimitError) return "rate_limited";
  if (error instanceof Anthropic.AuthenticationError) return "auth";
  if (error instanceof Anthropic.BadRequestError) return "bad_request";
  if (error instanceof Anthropic.APIError) return `api_${error.status ?? "unknown"}`;
  if (error instanceof Anthropic.APIConnectionError) return "connection";
  return "unknown";
}

/** Claude Haiku 5.5 fiyatları (USD / 1M token; istem ≤100K token kart). Maliyet logu için. */
export const PRICING = { input: 0.10, output: 0.50, cacheRead: 0.01, cacheWrite: 0.125 } as const;

export function estimateCostUSD(u: LlmUsage): number {
  return (u.input_tokens * PRICING.input + u.output_tokens * PRICING.output +
    u.cache_read_input_tokens * PRICING.cacheRead + u.cache_creation_input_tokens * PRICING.cacheWrite) / 1_000_000;
}

export function addUsage(a: LlmUsage, b: LlmUsage): LlmUsage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    cache_read_input_tokens: a.cache_read_input_tokens + b.cache_read_input_tokens,
    cache_creation_input_tokens: a.cache_creation_input_tokens + b.cache_creation_input_tokens,
  };
}

export const ZERO_USAGE = ZERO;
