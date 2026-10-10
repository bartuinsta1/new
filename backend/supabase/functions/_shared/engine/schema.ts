// LLM'in yapılandırılmış çıktısı (§4.2). Claude'a JSON şeması olarak gönderilir (structured outputs),
// yanıt bu şemaya uymak zorundadır. Sayısal/uzunluk kısıtları API'de desteklenmediği için şemada yok;
// onları `checks.ts` sunucu tarafında denetler.
import { z } from "zod";

export const REGION_IDS = [
  "sleep_house", "whisper_forest", "star_hill", "lighthouse_cove",
  "storyteller_plane", "feelings_garden", "treasure_chest",
] as const;
export const CHARACTER_IDS = ["pamuk", "findik", "lodos", "nur", "yildiz", "kaptan_midye"] as const;
export const EMOTIONS = ["neutral", "surprised", "whisper", "smiling", "sleepy"] as const;

export const LlmStorySchema = z.object({
  title: z.string(),
  cover_scene: z.object({
    region: z.enum(REGION_IDS),
    time_of_day: z.enum(["dusk", "night"]),
  }),
  characters: z.array(z.enum(CHARACTER_IDS)),
  paragraphs: z.array(z.object({
    text: z.string(),
    scene_hint: z.string(),
    emotion: z.enum(EMOTIONS),
  })),
  moral: z.string(),
  new_recurring_character: z.object({ name: z.string(), card: z.string() }).nullable(),
});

export type LlmStory = z.infer<typeof LlmStorySchema>;

/** Moderasyon (ikinci model çağrısı) çıktısı. */
export const MODERATION_CATEGORIES = [
  "violence", "death_or_loss", "fear_or_nightmare", "brand_or_product", "real_person",
  "religion_or_politics", "gender_stereotype", "adult_or_inappropriate", "personal_data", "off_instruction",
] as const;

export const ModerationSchema = z.object({
  verdict: z.enum(["safe", "unsafe"]),
  categories: z.array(z.enum(MODERATION_CATEGORIES)),
  reason: z.string(),
});

export type Moderation = z.infer<typeof ModerationSchema>;
export type ModerationCategory = (typeof MODERATION_CATEGORIES)[number];
