// POST /stories  → masal üretimi (NDJSON akışı)
// GET  /stories/:id → saklanan masal (yeniden üretim yok)
// `engine` verilmezse sahte masal döner (yerel geliştirme / ANTHROPIC_API_KEY yokken).
import { FREE_TIER, type Story, type StreamLine } from "../_shared/contract.ts";
import {
  type AuthProvider, type EntitlementStore, type UsageStore,
  errorResponse, istanbulDay, json, pathAfter, RateLimiter, requestLanguage,
} from "../_shared/http.ts";
import { mockStory } from "../_shared/mock.ts";
import { type EngineDeps, generateStory } from "../_shared/engine/engine.ts";
import { sanitizeRequest, UnsafeInputError } from "../_shared/engine/safety.ts";
import { parseStoryRequest, ValidationError } from "../_shared/validate.ts";

export interface StoriesDeps {
  auth: AuthProvider;
  usage: UsageStore;
  entitlements: EntitlementStore;
  limiter: RateLimiter;
  /** Gerçek masal motoru (Claude). Yoksa sahte masal. */
  engine?: EngineDeps;
  now?: () => Date;
  /** Paragraflar arası yapay gecikme (ms, yalnızca sahte modda); testlerde 0. */
  paragraphDelayMs?: number;
  /** Üretim sürerken "progress" satırı aralığı (ms). */
  heartbeatMs?: number;
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
      if (deps.engine) {
        // Yalnızca kendi masalı: başka kullanıcının kimliğiyle sorgu 404 döner.
        const stored = await deps.engine.stories.get(userId, rest[0]);
        return stored ? json(stored.story) : errorResponse(404, "not_found");
      }
      return json(mockStory({
        child_name: "Ayşe", child_age: 5, interests: [], companion_character: "findik", region: "whisper_forest",
        mood: "calm", duration_minutes: 5, recurring_characters: [], recent_story_titles: [], voice: "mother",
        content_filters: { allow_mild_scary: false, allow_conflict: false, allow_loss_and_separation: false },
        language: requestLanguage(req),
      }, rest[0]));
    }

    if (req.method !== "POST" || rest.length !== 0) return errorResponse(405, "method_not_allowed");

    let body: unknown;
    try { body = await req.json(); } catch { return errorResponse(400, "invalid_json"); }
    let request;
    try { request = parseStoryRequest(body); } catch (e) {
      if (e instanceof ValidationError) return errorResponse(400, `invalid_${e.message}`);
      throw e;
    }
    const idempotencyKey = req.headers.get("idempotency-key")?.slice(0, 64) || undefined;

    // Aynı isteğin tekrarı (ağ kopması): limit düşmeden önbellekten dön.
    if (deps.engine && idempotencyKey) {
      const cached = await deps.engine.stories.findByIdempotencyKey(userId, idempotencyKey);
      if (cached) return streamStory(async () => cached.story, deps);
    }

    // Ücretsiz limit — sunucu tarafında (§4.6).
    const day = istanbulDay(now());
    const premium = await deps.entitlements.isPremium(userId);
    if (!premium && (await deps.usage.personalStoriesOn(userId, day)) >= FREE_TIER.personalStoriesPerDay) {
      return errorResponse(402, "daily_limit_reached");
    }

    if (!deps.engine) {
      await deps.usage.recordPersonalStory(userId, day);
      const story = mockStory(request);
      return streamStory(async () => story, deps, deps.paragraphDelayMs ?? 400);
    }

    const engine = deps.engine;
    // Uygunsuz ad/telaffuz: akış başlamadan 400 (ebeveyn düzeltsin; çocuk bu ekranı görmez).
    try {
      sanitizeRequest(request);
    } catch (e) {
      if (e instanceof UnsafeInputError) return errorResponse(400, "unsafe_input");
      throw e;
    }
    await deps.usage.recordPersonalStory(userId, day);
    return streamStory(async () => (await generateStory(userId, request, engine, { idempotencyKey })).story, deps);
  };
}

/**
 * NDJSON akışı. Üretim + moderasyon bitene kadar "progress" satırları gönderilir; masal ancak güvenlik
 * denetiminden geçtikten sonra çocuğa akar (güvenlik hızdan önce gelir).
 * Adım 6'da her paragraf seslendirildikçe gönderilecek; ilk paragraf hazır olur olmaz çalmaya başlar.
 */
function streamStory(produce: () => Promise<Story>, deps: StoriesDeps, paragraphDelayMs = 0): Response {
  const enc = new TextEncoder();
  const line = (l: StreamLine) => enc.encode(JSON.stringify(l) + "\n");
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(line({ type: "progress", stage: "writing" }));
      // İstemci bağlantıyı koparırsa enqueue fırlatır; üretim yine biter ve masal saklanır (sonra GET ile alınır).
      const beat = setInterval(() => {
        try { controller.enqueue(line({ type: "progress", stage: "writing" })); } catch { clearInterval(beat); }
      }, deps.heartbeatMs ?? 3000);
      let story: Story;
      try {
        story = await produce();
      } catch {
        clearInterval(beat);
        controller.enqueue(line({ type: "error", code: "internal" }));
        controller.close();
        return;
      }
      clearInterval(beat);
      controller.enqueue(line({ type: "started", id: story.id, title: story.title, cover_scene: story.cover_scene }));
      for (const p of story.paragraphs) {
        if (paragraphDelayMs > 0) await sleep(paragraphDelayMs);
        controller.enqueue(line({ type: "paragraph", paragraph: p }));
      }
      controller.enqueue(line({ type: "completed", story }));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8" } });
}
