// Fonksiyonların bağımlılıkları. ANTHROPIC_API_KEY tanımlıysa gerçek masal motoru (Claude Haiku 5.5), değilse sahte masal.
// Not: her Edge Function ayrı bir isolate'te çalışır; bellek içi depolar fonksiyonlar arasında paylaşılmaz.
// Üretimde StoryStore / FlagLog / CostLog Postgres tablolarına bağlanır (bkz. migrations; Adım 10'da Supabase istemcisiyle).
import { MemoryStores, mockAuth, RateLimiter, supabaseJwtAuth } from "./http.ts";
import type { EngineDeps } from "./engine/engine.ts";
import { ClaudeStoryLLM, type Effort } from "./engine/llm.ts";
import { MemoryCostLog, MemoryFlagLog, MemoryStoryStore } from "./engine/store.ts";
import { AzureTts, ElevenLabsCloneTts, MemoryAudioStore } from "./tts/tts.ts";
import { MemoryCloneVoiceStore, type VoiceDeps } from "./tts/voice.ts";
import { MemoryShareStore } from "./share.ts";
import { MemoryReferralStore } from "./referral.ts";
import { type AppStoreEnvironment, JwsAppStoreVerifier } from "./appstore.ts";

export const stores = new MemoryStores();

function env(key: string): string | undefined {
  return typeof Deno !== "undefined" ? Deno.env.get(key) : undefined;
}

/** Supabase'de çalışırken gerçek oturum; yerel denemede `MOCK_AUTH=1` ile "Bearer <userId>". */
export const auth = env("SUPABASE_URL") && env("MOCK_AUTH") !== "1" ? supabaseJwtAuth : mockAuth;
/** Kullanıcı başına dakikada 20 istek. */
export const limiter = new RateLimiter(20, 60_000);

export const storyStore = new MemoryStoryStore();
export const flagLog = new MemoryFlagLog();
export const costLog = new MemoryCostLog();


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

export const audioStore = new MemoryAudioStore();
export const shareStore = new MemoryShareStore();
export const referralStore = new MemoryReferralStore();
export const cloneVoices = new MemoryCloneVoiceStore();

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
