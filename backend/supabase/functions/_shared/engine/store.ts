// Kalıcılık arayüzleri: masal önbelleği, işaretli içerik logu, maliyet logu.
// Bellek içi uygulamalar testler ve yerel geliştirme içindir; üretimde Postgres tablolarına yazılır
// (stories, flagged_content, cost_log — bkz. supabase/migrations).
import type { Language, Story } from "../contract.ts";

export interface StoredStory {
  userId: string;
  story: Story;
  language: Language;
  idempotencyKey?: string;
  createdAt: Date;
}

/** Üretilen her masal saklanır; tekrar dinlemede yeniden üretim yapılmaz (§4.6). */
export interface StoryStore {
  save(entry: StoredStory): Promise<void>;
  get(userId: string, id: string): Promise<StoredStory | null>;
  findByIdempotencyKey(userId: string, key: string): Promise<StoredStory | null>;
  deleteUser(userId: string): Promise<void>;
}

/** İşaretlenen içerik: kişisel veri YOK (çocuğun adı maskelenir, kullanıcı kimliği tutulmaz). */
export interface FlagEntry {
  stage: "input" | "rules" | "moderation" | "llm" | "fallback";
  reasons: string[];
  excerpt?: string;
  language: Language;
  at: Date;
}
export interface FlagLog { record(entry: FlagEntry): Promise<void> }

/** Masal başına maliyet (§4.6). Kullanıcı kimliği yok; yönetim panosu toplamları buradan okur. */
export interface CostEntry {
  at: Date;
  language: Language;
  durationMinutes: number;
  llmInputTokens: number;
  llmOutputTokens: number;
  llmCacheReadTokens: number;
  llmCacheWriteTokens: number;
  ttsCharacters: number;
  costUSD: number;
  attempts: number;
  /** "tts": yalnızca seslendirme maliyeti (masal sayısına girmez). */
  outcome: "generated" | "regenerated" | "fallback" | "cached" | "tts";
}
export interface CostLog {
  record(entry: CostEntry): Promise<void>;
  summary(since: Date): Promise<CostSummary>;
}

export interface CostSummary {
  stories: number;
  fallbacks: number;
  regenerations: number;
  totalCostUSD: number;
  avgCostUSD: number;
  llmOutputTokens: number;
  /** Gerçekten seslendirilen (önbellekten gelmeyen) karakter sayısı. */
  ttsCharacters: number;
  ttsCostUSD: number;
  byDay: { day: string; stories: number; costUSD: number }[];
}

export class MemoryStoryStore implements StoryStore {
  entries: StoredStory[] = [];
  /** Upsert: aynı kullanıcı + masal kimliği varsa günceller (seslendirme sonrası ses URL'leri eklenir). */
  async save(e: StoredStory) {
    const i = this.entries.findIndex((x) => x.userId === e.userId && x.story.id === e.story.id);
    if (i >= 0) this.entries[i] = e; else this.entries.push(e);
  }
  async get(userId: string, id: string) { return this.entries.find((e) => e.userId === userId && e.story.id === id) ?? null; }
  async findByIdempotencyKey(userId: string, key: string) {
    return this.entries.find((e) => e.userId === userId && e.idempotencyKey === key) ?? null;
  }
  async deleteUser(userId: string) { this.entries = this.entries.filter((e) => e.userId !== userId); }
}

export class MemoryFlagLog implements FlagLog {
  entries: FlagEntry[] = [];
  async record(e: FlagEntry) { this.entries.push(e); }
}

export class MemoryCostLog implements CostLog {
  entries: CostEntry[] = [];
  async record(e: CostEntry) { this.entries.push(e); }
  async summary(since: Date): Promise<CostSummary> { return summarize(this.entries.filter((e) => e.at >= since)); }
}

export function summarize(entries: CostEntry[]): CostSummary {
  const produced = entries.filter((e) => e.outcome !== "cached" && e.outcome !== "tts");
  const tts = entries.filter((e) => e.outcome === "tts");
  const ttsCost = tts.reduce((s, e) => s + e.costUSD, 0);
  const total = produced.reduce((s, e) => s + e.costUSD, 0) + ttsCost;
  const days = new Map<string, { stories: number; costUSD: number }>();
  for (const e of [...produced, ...tts]) {
    const day = e.at.toISOString().slice(0, 10);
    const d = days.get(day) ?? { stories: 0, costUSD: 0 };
    if (e.outcome !== "tts") d.stories += 1;
    d.costUSD += e.costUSD;
    days.set(day, d);
  }
  return {
    stories: produced.length,
    fallbacks: produced.filter((e) => e.outcome === "fallback").length,
    regenerations: produced.filter((e) => e.outcome === "regenerated").length,
    totalCostUSD: round(total),
    avgCostUSD: produced.length ? round(total / produced.length) : 0,
    llmOutputTokens: produced.reduce((s, e) => s + e.llmOutputTokens, 0),
    ttsCharacters: tts.reduce((s, e) => s + e.ttsCharacters, 0),
    ttsCostUSD: round(ttsCost),
    byDay: [...days.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([day, d]) => ({ day, stories: d.stories, costUSD: round(d.costUSD) })),
  };
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;
