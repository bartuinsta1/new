// Fonksiyonların bağımlılıkları. ANTHROPIC_API_KEY tanımlıysa gerçek masal motoru (Claude Haiku 5.5), değilse sahte masal.
// Depolar: SUPABASE_DB_URL varsa (Supabase Edge Functions bunu otomatik verir) Postgres, yoksa bellek içi.
// Bellek içi depolar yalnızca yerel geliştirme ve testler içindir: her Edge Function ayrı isolate'te çalışır ve
// veriler fonksiyonlar arasında paylaşılmaz, yeniden başlatınca kaybolur. `USE_MEMORY_STORES=1` ile zorlanabilir.
import {
  type EntitlementStore, MemoryStores, mockAuth, RateLimiter, supabaseJwtAuth, type UsageStore,
} from "./http.ts";
import { connect, deleteAuthUser, PgAnalyticsStore, PgCloneVoiceStore, PgPurchaseStore, PgCostLog, PgFlagLog, PgReferralStore, PgShareStore, PgStores,
  PgStoryStore } from "./pg/stores.ts";
import type { CostLog, FlagLog, StoryStore } from "./engine/store.ts";
import type { ShareStore } from "./share.ts";
import type { ReferralStore } from "./referral.ts";
import type { AudioStore } from "./tts/tts.ts";
import type { CloneVoiceStore } from "./tts/voice.ts";
import { SupabaseStorageAudioStore } from "./tts/storage.ts";
import { type AnalyticsStore, MemoryAnalyticsStore } from "./analytics.ts";
import { MemoryPurchaseStore, type PurchaseStore } from "./packs.ts";
import type { EngineDeps } from "./engine/engine.ts";
import { ClaudeStoryLLM, type Effort } from "./engine/llm.ts";
import { MemoryCostLog, MemoryFlagLog, MemoryStoryStore } from "./engine/store.ts";
import { AzureTts, ElevenLabsCloneTts, ElevenLabsVoiceCloner, MemoryAudioStore } from "./tts/tts.ts";
import { MemoryCloneVoiceStore, type VoiceCloner, type VoiceDeps } from "./tts/voice.ts";
import { MemoryShareStore } from "./share.ts";
import { MemoryReferralStore } from "./referral.ts";
import { type AppStoreEnvironment, JwsAppStoreVerifier } from "./appstore.ts";

function env(key: string): string | undefined {
  return typeof Deno !== "undefined" ? Deno.env.get(key) : undefined;
}

const dbUrl = env("USE_MEMORY_STORES") === "1" ? undefined : env("SUPABASE_DB_URL");
const db = dbUrl ? connect(dbUrl) : null;
/** Depolar Postgres'te mi? (yönetim panosu ve günlükler için) */
export const usesDatabase = db !== null;

export const stores: UsageStore & EntitlementStore = db ? new PgStores(db) : new MemoryStores();

/** Supabase'de çalışırken gerçek oturum; yerel denemede `MOCK_AUTH=1` ile "Bearer <userId>". */
export const auth = env("SUPABASE_URL") && env("MOCK_AUTH") !== "1" ? supabaseJwtAuth : mockAuth;
/** Kullanıcı başına dakikada 20 istek. */
export const limiter = new RateLimiter(20, 60_000);

export const storyStore: StoryStore = db ? new PgStoryStore(db) : new MemoryStoryStore();
export const purchaseStore: PurchaseStore = db ? new PgPurchaseStore(db) : new MemoryPurchaseStore();
export const analyticsStore: AnalyticsStore = db ? new PgAnalyticsStore(db) : new MemoryAnalyticsStore();
export const flagLog: FlagLog = db ? new PgFlagLog(db) : new MemoryFlagLog();
export const costLog: CostLog = db ? new PgCostLog(db) : new MemoryCostLog();
/** Hesap silmede auth kullanıcısını siler (yalnızca Postgres'te; tüm tablolar cascade ile temizlenir). */
export const removeAuthUser = db ? (userId: string) => deleteAuthUser(db, userId) : undefined;


export function makeEngine(): EngineDeps | undefined {
  if (!env("ANTHROPIC_API_KEY")) return undefined;
  const effort = (env("STORY_EFFORT") as Effort | undefined) ?? "low";
  return {
    llm: new ClaudeStoryLLM({ storyEffort: effort }),
    stories: storyStore,
    flags: flagLog,
    costs: costLog,
  };
}

/** Ses dosyaları: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY varsa Supabase Storage (özel kova, imzalı URL). */
export const audioStore: AudioStore = env("SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY")
  ? new SupabaseStorageAudioStore({ url: env("SUPABASE_URL")!, serviceKey: env("SUPABASE_SERVICE_ROLE_KEY")!,
                                     bucket: env("AUDIO_BUCKET") ?? "audio" })
  : new MemoryAudioStore();
export const shareStore: ShareStore = db ? new PgShareStore(db) : new MemoryShareStore();
export const referralStore: ReferralStore = db ? new PgReferralStore(db) : new MemoryReferralStore();
export const cloneVoices: CloneVoiceStore = db ? new PgCloneVoiceStore(db) : new MemoryCloneVoiceStore();
/** ELEVENLABS_API_KEY tanımlıysa gerçek anlık ses klonu. */
export const voiceCloner: VoiceCloner | undefined = env("ELEVENLABS_API_KEY")
  ? new ElevenLabsVoiceCloner({ key: env("ELEVENLABS_API_KEY")! }) : undefined;

/** AZURE_TTS_KEY + AZURE_TTS_REGION tanımlıysa seslendirme açık; ELEVENLABS_API_KEY ebeveyn klon sesi için. */
export function makeVoice(): VoiceDeps | undefined {
  const key = env("AZURE_TTS_KEY"), region = env("AZURE_TTS_REGION");
  if (!key || !region) return undefined;
  const eleven = env("ELEVENLABS_API_KEY");
  return {
    tts: new AzureTts({ key, region }),
    cloneTts: eleven ? new ElevenLabsCloneTts({ key: eleven }) : undefined,
    audio: audioStore,
    costs: costLog,
  };
}

/**
 * App Store doğrulayıcısı: APPLE_BUNDLE_ID tanımlıysa gerçek JWS doğrulaması. Kabul edilen ortamlar
 * APPSTORE_ENVIRONMENTS (varsayılan "Production,Sandbox" — App Review sandbox'ta satın alır).
 */
export const appStoreVerifier = env("APPLE_BUNDLE_ID")
  ? new JwsAppStoreVerifier({
    bundleId: env("APPLE_BUNDLE_ID")!,
    environments: (env("APPSTORE_ENVIRONMENTS") ?? "Production,Sandbox").split(",").map((s) => s.trim()) as AppStoreEnvironment[],
    rootFingerprintSha256: env("APPLE_ROOT_CA_SHA256") || undefined,
  })
  : undefined;
