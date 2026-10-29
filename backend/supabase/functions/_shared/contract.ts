// İstemci–sunucu sözleşmesi. iOS: Masalcik/Core/Networking/DTOs.swift ile birebir aynı tutulmalı.
// JSON alanları snake_case.

export type Region =
  | "sleep_house" | "whisper_forest" | "star_hill" | "lighthouse_cove"
  | "storyteller_plane" | "feelings_garden" | "treasure_chest";
export type CharacterID = "pamuk" | "findik" | "lodos" | "nur" | "yildiz" | "kaptan_midye";
export type StoryMood = "adventure" | "funny" | "calm";
export type ParagraphEmotion = "neutral" | "surprised" | "whisper" | "smiling" | "sleepy";
export type VoiceTone = "mother" | "father" | "grandmother" | "grandfather" | "parent_clone";

export const REGIONS: Region[] = [
  "sleep_house", "whisper_forest", "star_hill", "lighthouse_cove",
  "storyteller_plane", "feelings_garden", "treasure_chest",
];
export const CHARACTERS: CharacterID[] = ["pamuk", "findik", "lodos", "nur", "yildiz", "kaptan_midye"];
export const MOODS: StoryMood[] = ["adventure", "funny", "calm"];
export const VOICES: VoiceTone[] = ["mother", "father", "grandmother", "grandfather", "parent_clone"];
export type Language = "tr" | "en";
export const LANGUAGES: Language[] = ["tr", "en"];

export interface ContentFilters {
  allow_mild_scary: boolean;
  allow_conflict: boolean;
  allow_loss_and_separation: boolean;
}

export interface RecurringCharacter { name: string; card: string }

export interface StoryRequest {
  child_name: string;
  child_age: number;
  pronunciation?: string | null;
  interests: string[];
  value?: string | null;
  companion_character: CharacterID;
  region: Region;
  mood: StoryMood;
  duration_minutes: 5 | 10 | 15;
  recurring_characters: RecurringCharacter[];
  recent_story_titles: string[];
  content_filters: ContentFilters;
  voice: VoiceTone;
  /** Masal + seslendirme dili. Eski istemciler göndermezse "tr". */
  language: Language;
}

export interface Paragraph {
  index: number;
  text: string;
  scene_hint: string;
  emotion: ParagraphEmotion;
  audio_url?: string | null;
}

export interface Story {
  id: string;
  title: string;
  cover_scene: { region: Region; time_of_day: string };
  characters: CharacterID[];
  paragraphs: Paragraph[];
  moral?: string | null;
  new_recurring_character?: RecurringCharacter | null;
  duration_minutes: number;
  mood: StoryMood;
  is_fallback: boolean;
}

export type StreamLine =
  /** Masal yazılırken birkaç saniyede bir: bağlantıyı canlı tutar, bekleme animasyonu sürer. */
  | { type: "progress"; stage: "writing" | "checking" | "voicing" }
  | { type: "started"; id: string; title: string; cover_scene: Story["cover_scene"] }
  | { type: "paragraph"; paragraph: Paragraph }
  | { type: "completed"; story: Story }
  | { type: "error"; code: "daily_limit_reached" | "rate_limited" | "unsafe_input" | "internal" };

export interface LibraryItem {
  id: string;
  title: string;
  region: Region;
  duration_minutes: number;
  cover_url?: string | null;
  is_free: boolean;
  /** Bir Masal Dükkanı paketine aitse paket kimliği: yalnızca paketi alan açar (Premium dahil değil). */
  pack_id?: string | null;
}

export interface Entitlement {
  tier: "free" | "premium";
  product_id?: string | null;
  expires_at?: string | null;
  is_in_trial: boolean;
  personal_stories_remaining_today?: number | null;
  library_stories_remaining_this_week?: number | null;
  /** Sahip olunan tek seferlik paketler (Masal Dükkanı). */
  owned_products?: string[];
}

export const FREE_TIER = { personalStoriesPerDay: 1, libraryStoriesPerWeek: 3 } as const;
/**
 * Premium adil kullanım sınırı. VARSAYIM: "her gece yeni masal" için bol bol yeter (bir aile 4 çocukla bile
 * günde 10'u nadiren aşar), LLM + TTS maliyetini ve kötüye kullanımı sınırlar. Paywall'da açıkça yazar.
 */
export const PREMIUM_TIER = { personalStoriesPerDay: 10 } as const;
