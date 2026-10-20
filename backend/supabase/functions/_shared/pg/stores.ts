// Postgres depoları: bellek içi depoların (MemoryStores vb.) üretim karşılıkları. Aynı arayüzler, aynı davranış —
// tests/pg-stores.test.ts aynı senaryoları gerçek Postgres'te çalıştırır.
//
// Bağlantı: Edge Function'larda Supabase `SUPABASE_DB_URL`'i otomatik verir (service role yetkisiyle; RLS'yi aşar).
// İstemci (iOS) bu tablolara doğrudan erişmez; tüm yazma burada, sunucu doğrulamasından sonra.
// Havuz (pooler, işlem modu) için `prepare: false` zorunlu.
import postgres from "postgres";
import type { Subscription } from "../appstore.ts";
import type { EntitlementStore, UsageStore } from "../http.ts";
import type { Language, Story } from "../contract.ts";
import {
  type CostEntry, type CostLog, type CostSummary, type FlagEntry, type FlagLog, type StoredStory, type StoryStore,
  summarize,
} from "../engine/store.ts";
import type { ShareEntry, ShareStore } from "../share.ts";
import { newReferralCode, type Redemption, type ReferralStore } from "../referral.ts";
import type { CloneVoiceStore } from "../tts/voice.ts";
import { type AnalyticsStore, canonical } from "../analytics.ts";

export type Sql = ReturnType<typeof postgres>;

export function connect(url: string, opts: { max?: number } = {}): Sql {
  return postgres(url, { prepare: false, max: opts.max ?? 3, idle_timeout: 20, connect_timeout: 10 });
}

/** UsageStore + EntitlementStore (MemoryStores karşılığı). */
export class PgStores implements UsageStore, EntitlementStore {
  private sql: Sql;
  private now: () => Date;
  constructor(sql: Sql, now: () => Date = () => new Date()) {
    this.sql = sql;
    this.now = now;
  }

  async personalStoriesOn(userId: string, day: string) {
    const [r] = await this.sql`select personal_stories from usage_daily where user_id = ${userId} and day = ${day}`;
    return r ? Number(r.personal_stories) : 0;
  }
  async recordPersonalStory(userId: string, day: string) {
    await this.sql`insert into usage_daily (user_id, day, personal_stories) values (${userId}, ${day}, 1)
      on conflict (user_id, day) do update set personal_stories = usage_daily.personal_stories + 1`;
  }
  async libraryStoriesInWeek(userId: string, week: string) {
    const rows = await this.sql`select story_id from library_usage_weekly
      where user_id = ${userId} and week_start = ${week} order by opened_at`;
    return rows.map((r) => String(r.story_id));
  }
  async recordLibraryStory(userId: string, week: string, storyId: string) {
    await this.sql`insert into library_usage_weekly (user_id, week_start, story_id)
      values (${userId}, ${week}, ${storyId}) on conflict do nothing`;
  }

  async isPremium(userId: string) {
    return (await this.subscription(userId)) !== null || (await this.bonusUntil(userId)) !== null;
  }
  async subscription(userId: string): Promise<Subscription | null> {
    const [r] = await this.sql`select product_id, expires_at, is_in_trial, original_transaction_id, environment
      from entitlements where user_id = ${userId} and original_transaction_id is not null
        and revoked_at is null and expires_at > ${this.now()}`;
    return r ? {
      productId: r.product_id, expiresAt: new Date(r.expires_at), isInTrial: r.is_in_trial,
      originalTransactionId: r.original_transaction_id, environment: r.environment ?? "",
    } : null;
  }
  async saveSubscription(userId: string, sub: Subscription) {
    await this.sql.begin(async (tx) => {
      // Aynı App Store aboneliği başka hesaptaysa oradan alınır (tekil indeks de bunu zorlar).
      await tx`update entitlements set original_transaction_id = null, product_id = null, expires_at = null,
                 is_in_trial = false, tier = 'free', revoked_at = null
               where original_transaction_id = ${sub.originalTransactionId} and user_id <> ${userId}`;
      await tx`insert into entitlements (user_id, tier, product_id, original_transaction_id, expires_at, is_in_trial,
                                        environment, verified_at, revoked_at)
               values (${userId}, 'premium', ${sub.productId}, ${sub.originalTransactionId}, ${sub.expiresAt},
                       ${sub.isInTrial}, ${sub.environment}, ${this.now()}, null)
               on conflict (user_id) do update set tier = 'premium', product_id = excluded.product_id,
                 original_transaction_id = excluded.original_transaction_id, expires_at = excluded.expires_at,
                 is_in_trial = excluded.is_in_trial, environment = excluded.environment,
                 verified_at = excluded.verified_at, revoked_at = null`;
    });
  }
  async userForOriginalTransaction(id: string) {
    const [r] = await this.sql`select user_id from entitlements where original_transaction_id = ${id}`;
    return r ? String(r.user_id) : null;
  }
  async revoke(originalTransactionId: string) {
    await this.sql`update entitlements set revoked_at = ${this.now()}, tier = 'free'
      where original_transaction_id = ${originalTransactionId}`;
  }
  async grantBonusDays(userId: string, days: number, now: Date) {
    const [r] = await this.sql`insert into entitlements (user_id, bonus_until)
        values (${userId}, ${now}::timestamptz + make_interval(days => ${days}))
      on conflict (user_id) do update set bonus_until =
        greatest(coalesce(entitlements.bonus_until, ${now}::timestamptz), ${now}::timestamptz) + make_interval(days => ${days})
      returning bonus_until`;
    return new Date(r.bonus_until);
  }
  async bonusUntil(userId: string) {
    const [r] = await this.sql`select bonus_until from entitlements
      where user_id = ${userId} and bonus_until > ${this.now()}`;
    return r ? new Date(r.bonus_until) : null;
  }
  async setPremium(userId: string, expiresAt: Date | null) {
    await this.saveSubscription(userId, {
      productId: "masalcik.premium.yearly", expiresAt: expiresAt ?? new Date("2999-01-01"), isInTrial: false,
      originalTransactionId: `dev-${userId}`, environment: "Xcode",
    });
  }
  /** Kullanım ve abonelik satırları. (Hesabın tamamı `deleteAuthUser` ile silinir; bu tek başına da güvenli.) */
  async deleteUser(userId: string) {
    await this.sql.begin(async (tx) => {
      await tx`delete from usage_daily where user_id = ${userId}`;
      await tx`delete from library_usage_weekly where user_id = ${userId}`;
      await tx`delete from entitlements where user_id = ${userId}`;
    });
  }
}

export class PgStoryStore implements StoryStore {
  private sql: Sql;
  constructor(sql: Sql) { this.sql = sql; }

  async save(e: StoredStory) {
    const s = e.story;
    const source = s.is_fallback ? "fallback" : "generated";
    await this.sql`insert into stories (id, user_id, title, body, region, mood, duration_minutes, is_fallback,
                                        language, idempotency_key, source, created_at)
      values (${s.id}, ${e.userId}, ${s.title}, ${this.sql.json(s as never)}, ${s.cover_scene.region}, ${s.mood},
              ${s.duration_minutes}, ${s.is_fallback}, ${e.language}, ${e.idempotencyKey ?? null}, ${source}, ${e.createdAt})
      on conflict (id) do update set body = excluded.body, title = excluded.title
      where stories.user_id = excluded.user_id`;
  }
  async get(userId: string, id: string) {
    if (!isUuid(id)) return null;
    const [r] = await this.sql`select * from stories where id = ${id} and user_id = ${userId}`;
    return r ? row(r) : null;
  }
  async findByIdempotencyKey(userId: string, key: string) {
    const [r] = await this.sql`select * from stories where user_id = ${userId} and idempotency_key = ${key}`;
    return r ? row(r) : null;
  }
  async deleteUser(userId: string) { await this.sql`delete from stories where user_id = ${userId}`; }
}

function row(r: Record<string, unknown>): StoredStory {
  return {
    userId: String(r.user_id), story: r.body as Story, language: r.language as Language,
    idempotencyKey: (r.idempotency_key as string | null) ?? undefined, createdAt: new Date(r.created_at as string),
  };
}

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export class PgFlagLog implements FlagLog {
  private sql: Sql;
  constructor(sql: Sql) { this.sql = sql; }
  async record(e: FlagEntry) {
    await this.sql`insert into flagged_content (stage, reasons, excerpt, language, created_at)
      values (${e.stage}, ${e.reasons}, ${e.excerpt ?? null}, ${e.language}, ${e.at})`;
  }
}

export class PgCostLog implements CostLog {
  private sql: Sql;
  constructor(sql: Sql) { this.sql = sql; }
  async record(e: CostEntry) {
    await this.sql`insert into cost_log (llm_input_tokens, llm_output_tokens, llm_cache_read_tokens,
        llm_cache_write_tokens, tts_characters, estimated_cost_usd, was_regenerated, language, duration_minutes,
        attempts, outcome, created_at)
      values (${e.llmInputTokens}, ${e.llmOutputTokens}, ${e.llmCacheReadTokens}, ${e.llmCacheWriteTokens},
              ${e.ttsCharacters}, ${e.costUSD}, ${e.outcome === "regenerated"}, ${e.language}, ${e.durationMinutes},
              ${e.attempts}, ${e.outcome}, ${e.at})`;
  }
  async summary(since: Date): Promise<CostSummary> {
    const rows = await this.sql`select * from cost_log where created_at >= ${since} order by created_at`;
    return summarize(rows.map((r) => ({
      at: new Date(r.created_at), language: r.language, durationMinutes: r.duration_minutes ?? 0,
      llmInputTokens: r.llm_input_tokens, llmOutputTokens: r.llm_output_tokens,
      llmCacheReadTokens: r.llm_cache_read_tokens, llmCacheWriteTokens: r.llm_cache_write_tokens,
      ttsCharacters: r.tts_characters, costUSD: Number(r.estimated_cost_usd), attempts: r.attempts, outcome: r.outcome,
    })));
  }
}

export class PgShareStore implements ShareStore {
  private sql: Sql;
  constructor(sql: Sql) { this.sql = sql; }
  async save(e: ShareEntry) {
    await this.sql`insert into story_shares (token, user_id, story_id, created_at, expires_at)
      values (${e.token}, ${e.userId}, ${e.storyId}, ${e.createdAt}, ${e.expiresAt})`;
  }
  async get(token: string) {
    const [r] = await this.sql`select * from story_shares where token = ${token}`;
    return r ? {
      token: r.token, userId: String(r.user_id), storyId: String(r.story_id),
      createdAt: new Date(r.created_at), expiresAt: new Date(r.expires_at),
    } : null;
  }
  async deleteUser(userId: string) { await this.sql`delete from story_shares where user_id = ${userId}`; }
}

export class PgReferralStore implements ReferralStore {
  private sql: Sql;
  constructor(sql: Sql) { this.sql = sql; }
  async codeFor(userId: string) {
    const [existing] = await this.sql`select code from referral_codes where user_id = ${userId}`;
    if (existing) return String(existing.code);
    // Çakışma olasılığı ~1/887 milyon; yine de benzersizlik ihlalinde yeni kod denenir.
    for (let i = 0; i < 5; i++) {
      const rows = await this.sql`insert into referral_codes (user_id, code) values (${userId}, ${newReferralCode()})
        on conflict do nothing returning code`;
      if (rows.length) return String(rows[0].code);
      const [again] = await this.sql`select code from referral_codes where user_id = ${userId}`;
      if (again) return String(again.code);   // eşzamanlı istek oluşturdu
    }
    throw new Error("referral_code_generation_failed");
  }
  async ownerOf(code: string) {
    const [r] = await this.sql`select user_id from referral_codes where code = ${code}`;
    return r ? String(r.user_id) : null;
  }
  async redemptionBy(invitee: string): Promise<Redemption | null> {
    const [r] = await this.sql`select * from referral_redemptions where invitee_id = ${invitee}`;
    return r ? { inviter: String(r.inviter_id), invitee: String(r.invitee_id), at: new Date(r.redeemed_at) } : null;
  }
  async rewardsSince(inviter: string, since: Date) {
    const [r] = await this.sql`select count(*)::int as n from referral_redemptions
      where inviter_id = ${inviter} and redeemed_at >= ${since}`;
    return Number(r.n);
  }
  async record(r: Redemption, inviterRewarded: boolean) {
    await this.sql`insert into referral_redemptions (invitee_id, inviter_id, inviter_rewarded, redeemed_at)
      values (${r.invitee}, ${r.inviter}, ${inviterRewarded}, ${r.at})`;
  }
  async deleteUser(userId: string) {
    await this.sql.begin(async (tx) => {
      await tx`delete from referral_redemptions where invitee_id = ${userId} or inviter_id = ${userId}`;
      await tx`delete from referral_codes where user_id = ${userId}`;
    });
  }
}

export class PgCloneVoiceStore implements CloneVoiceStore {
  private sql: Sql;
  constructor(sql: Sql) { this.sql = sql; }
  async get(userId: string) {
    const [r] = await this.sql`select provider_voice_id from voice_clones where user_id = ${userId}`;
    return r ? String(r.provider_voice_id) : null;
  }
  async set(userId: string, voiceId: string, consentedAt: Date = new Date()) {
    await this.sql`insert into voice_clones (user_id, provider_voice_id, consented_at)
      values (${userId}, ${voiceId}, ${consentedAt})
      on conflict (user_id) do update set provider_voice_id = excluded.provider_voice_id,
        consented_at = excluded.consented_at`;
  }
  async delete(userId: string) { await this.sql`delete from voice_clones where user_id = ${userId}`; }
}

export class PgAnalyticsStore implements AnalyticsStore {
  private sql: Sql;
  constructor(sql: Sql) { this.sql = sql; }
  async increment(day: string, name: string, dims: Record<string, string | number | boolean>, count: number) {
    await this.sql`insert into analytics_daily (day, name, dims, count)
      values (${day}, ${name}, ${canonical(dims)}::jsonb, ${count})
      on conflict (day, name, dims) do update set count = analytics_daily.count + excluded.count`;
  }
}

/** Hesabı tamamen siler: auth.users satırı silinince tüm tablolar `on delete cascade` ile temizlenir. */
export async function deleteAuthUser(sql: Sql, userId: string) {
  await sql`delete from auth.users where id = ${userId}`;
}
