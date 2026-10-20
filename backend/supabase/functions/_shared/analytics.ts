// Birinci taraf, anonim, toplu kullanım sayaçları (§6). Kişi kimliği, cihaz kimliği, IP ya da serbest metin
// SAKLANMAZ: yalnızca (gün, olay adı, izinli kaba boyutlar) başına bir sayaç. Bilinmeyen olay/boyut reddedilir.
import type { Region, StoryMood } from "./contract.ts";

const REGIONS: Region[] = ["sleep_house", "whisper_forest", "star_hill", "lighthouse_cove", "storyteller_plane",
  "feelings_garden", "treasure_chest"];
const MOODS: StoryMood[] = ["adventure", "funny", "calm"];

type Dims = Record<string, string | number | boolean>;
type Validator = (d: Record<string, unknown>) => Dims | null;

const exact = (keys: string[]) => (d: Record<string, unknown>) => Object.keys(d).every((k) => keys.includes(k));

/** Olay adı → boyut doğrulayıcı. Yeni olay eklenirse iOS `AnalyticsEvent` ile birlikte burada da tanımlanır. */
export const EVENT_SCHEMA: Record<string, Validator> = {
  onboarding_step: (d) => exact(["step"])(d) && Number.isInteger(d.step) && (d.step as number) >= 1 && (d.step as number) <= 10
    ? { step: d.step as number } : null,
  story_started: (d) => exact(["region", "mood", "library"])(d) && REGIONS.includes(d.region as Region)
      && MOODS.includes(d.mood as StoryMood) && typeof d.library === "boolean"
    ? { region: d.region as string, mood: d.mood as string, library: d.library } : null,
  story_finished: (d) => exact(["minutes"])(d) && ["0-5", "5-10", "10-15", "15+"].includes(d.minutes as string)
    ? { minutes: d.minutes as string } : null,
  paywall_shown: (d) => Object.keys(d).length === 0 ? {} : null,
  paywall_closed: (d) => Object.keys(d).length === 0 ? {} : null,
  paywall_purchased: (d) => exact(["plan"])(d) && ["monthly", "yearly"].includes(d.plan as string)
    ? { plan: d.plan as string } : null,
};

export interface AnalyticsStore {
  increment(day: string, name: string, dims: Dims, count: number): Promise<void>;
}

export class MemoryAnalyticsStore implements AnalyticsStore {
  counts = new Map<string, number>();
  async increment(day: string, name: string, dims: Dims, count: number) {
    const k = `${day}|${name}|${canonical(dims)}`;
    this.counts.set(k, (this.counts.get(k) ?? 0) + count);
  }
}

/** Anahtar sırası sabit JSON (aynı boyutlar aynı satıra düşsün). */
export function canonical(dims: Dims): string {
  return JSON.stringify(Object.fromEntries(Object.entries(dims).sort(([a], [b]) => a.localeCompare(b))));
}
