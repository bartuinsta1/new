// İstek doğrulama. Ebeveynin serbest metinleri (ad, telaffuz, ilgi alanı) burada şekil olarak doğrulanır;
// içerik/istem enjeksiyonu filtresi Adım 5'te safety.ts'e eklenecek.
import { CHARACTERS, LANGUAGES, MOODS, REGIONS, VOICES, type StoryRequest } from "./contract.ts";

export class ValidationError extends Error {}

const NAME_RE = /^[\p{L}][\p{L} '\-]{0,29}$/u;

export function parseStoryRequest(body: unknown): StoryRequest {
  if (typeof body !== "object" || body === null) throw new ValidationError("body");
  const b = body as Record<string, unknown>;
  const str = (k: string, max: number) => {
    const v = b[k];
    if (typeof v !== "string" || v.trim().length === 0 || v.length > max) throw new ValidationError(k);
    return v.trim();
  };
  const name = str("child_name", 30);
  if (!NAME_RE.test(name)) throw new ValidationError("child_name");
  const age = b["child_age"];
  if (typeof age !== "number" || !Number.isInteger(age) || age < 2 || age > 12) throw new ValidationError("child_age");
  const oneOf = <T extends string>(k: string, list: readonly T[]): T => {
    const v = b[k];
    if (typeof v !== "string" || !list.includes(v as T)) throw new ValidationError(k);
    return v as T;
  };
  const duration = b["duration_minutes"];
  if (duration !== 5 && duration !== 10 && duration !== 15) throw new ValidationError("duration_minutes");
  const arr = (k: string, max: number): unknown[] => {
    const v = b[k] ?? [];
    if (!Array.isArray(v) || v.length > max) throw new ValidationError(k);
    return v;
  };
  const filters = (b["content_filters"] ?? {}) as Record<string, unknown>;
  const pron = b["pronunciation"];
  if (pron != null && (typeof pron !== "string" || pron.length > 40)) throw new ValidationError("pronunciation");

  return {
    child_name: name,
    child_age: age,
    pronunciation: (pron as string | null | undefined) ?? null,
    interests: arr("interests", 5).map(String).slice(0, 5),
    value: typeof b["value"] === "string" ? (b["value"] as string) : null,
    companion_character: oneOf("companion_character", CHARACTERS),
    region: oneOf("region", REGIONS),
    mood: oneOf("mood", MOODS),
    duration_minutes: duration,
    recurring_characters: arr("recurring_characters", 3).map((c) => {
      const o = c as Record<string, unknown>;
      return { name: String(o.name ?? "").slice(0, 30), card: String(o.card ?? "").slice(0, 200) };
    }),
    recent_story_titles: arr("recent_story_titles", 5).map((t) => String(t).slice(0, 80)),
    content_filters: {
      allow_mild_scary: filters["allow_mild_scary"] === true,
      allow_conflict: filters["allow_conflict"] === true,
      allow_loss_and_separation: filters["allow_loss_and_separation"] === true,
    },
    voice: oneOf("voice", VOICES),
    language: b["language"] === undefined ? "tr" : oneOf("language", LANGUAGES),
  };
}
