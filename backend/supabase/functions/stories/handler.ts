// POST /stories  → masal üretimi (NDJSON akışı)
// GET  /stories/:id → masal + ses URL'leri
// Adım 1: sahte üretim. Adım 5: girdi güvenliği → LLM (JSON şeması) → moderasyon → TTS → önbellek.
import { FREE_TIER, type StreamLine } from "../_shared/contract.ts";
import {
  type AuthProvider, type EntitlementStore, type UsageStore,
  errorResponse, istanbulDay, json, pathAfter, RateLimiter, requestLanguage,
} from "../_shared/http.ts";
import { mockStory } from "../_shared/mock.ts";
import { parseStoryRequest, ValidationError } from "../_shared/validate.ts";

export interface StoriesDeps {
  auth: AuthProvider;
  usage: UsageStore;
  entitlements: EntitlementStore;
  limiter: RateLimiter;
  now?: () => Date;
  /** Paragraflar arası yapay gecikme (ms); testlerde 0. */
  paragraphDelayMs?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createStoriesHandler(deps: StoriesDeps) {
  const now = deps.now ?? (() => new Date());
  return async (req: Request): Promise<Response> => {
    const userId = await deps.auth.userId(req);
    if (!userId) return errorResponse(401, "unauthorized");
    if (!deps.limiter.allow(userId)) return errorResponse(429, "rate_limited");

    const rest = pathAfter(req, "stories");

    if (req.method === "GET" && rest.length === 1) {
      // Sahte: istenen kimlikle örnek masal. Gerçekte: stories tablosu + RLS (yalnızca kendi ailesi).
      const story = mockStory({
        child_name: "Ayşe", child_age: 5, interests: [], companion_character: "findik", region: "whisper_forest",
        mood: "calm", duration_minutes: 5, recurring_characters: [], recent_story_titles: [], voice: "mother",
        content_filters: { allow_mild_scary: false, allow_conflict: false, allow_loss_and_separation: false },
        language: requestLanguage(req),
      }, rest[0]);
      return json(story);
    }

    if (req.method !== "POST" || rest.length !== 0) return errorResponse(405, "method_not_allowed");

    let body: unknown;
    try { body = await req.json(); } catch { return errorResponse(400, "invalid_json"); }
    let request;
    try { request = parseStoryRequest(body); } catch (e) {
      if (e instanceof ValidationError) return errorResponse(400, `invalid_${e.message}`);
      throw e;
    }

    // Ücretsiz limit — sunucu tarafında.
    const day = istanbulDay(now());
    const premium = await deps.entitlements.isPremium(userId);
    if (!premium && (await deps.usage.personalStoriesOn(userId, day)) >= FREE_TIER.personalStoriesPerDay) {
      return errorResponse(402, "daily_limit_reached");
    }
    await deps.usage.recordPersonalStory(userId, day);

    const story = mockStory(request);
    const delay = deps.paragraphDelayMs ?? 400;
    const enc = new TextEncoder();
    const line = (l: StreamLine) => enc.encode(JSON.stringify(l) + "\n");

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(line({ type: "started", id: story.id, title: story.title, cover_scene: story.cover_scene }));
        for (const p of story.paragraphs) {
          if (delay > 0) await sleep(delay);
          controller.enqueue(line({ type: "paragraph", paragraph: p }));
        }
        controller.enqueue(line({ type: "completed", story }));
        controller.close();
      },
    });
    return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8" } });
  };
}
