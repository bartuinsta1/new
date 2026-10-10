// POST /stories  → masal üretimi (NDJSON akışı)
// GET  /stories/:id → saklanan masal (yeniden üretim yok)
// `engine` verilmezse sahte masal döner (yerel geliştirme / ANTHROPIC_API_KEY yokken).
import { FREE_TIER, type Paragraph, type Story, type StoryRequest, type StreamLine } from "../_shared/contract.ts";
import {
  type AuthProvider, type EntitlementStore, type UsageStore,
  errorResponse, istanbulDay, json, pathAfter, RateLimiter, requestLanguage,
} from "../_shared/http.ts";
import { mockStory } from "../_shared/mock.ts";
import { type EngineDeps, generateStory } from "../_shared/engine/engine.ts";
import { sanitizeRequest, UnsafeInputError } from "../_shared/engine/safety.ts";
import { parseStoryRequest, ValidationError } from "../_shared/validate.ts";
import { type CloneVoiceStore, type VoiceDeps, voiceStory } from "../_shared/tts/voice.ts";

export interface StoriesDeps {
  auth: AuthProvider;
  usage: UsageStore;
  entitlements: EntitlementStore;
  limiter: RateLimiter;
  /** Gerçek masal motoru (Claude). Yoksa sahte masal. */
  engine?: EngineDeps;
  /** Seslendirme (Azure / ElevenLabs). Yoksa audio_url null gider; istemci cihaz içi sesle okur. */
  voice?: VoiceDeps;
  cloneVoices?: CloneVoiceStore;
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
      if (cached) return streamStory(async () => cached.story, deps, { voice: voicer(userId, request, cached.idempotencyKey) });
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
      return streamStory(async () => story, deps, {
        paragraphDelayMs: deps.voice ? 0 : deps.paragraphDelayMs ?? 400,
        voice: voicer(userId, request),
      });
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
    return streamStory(async () => (await generateStory(userId, request, engine, { idempotencyKey })).story, deps,
      { voice: voicer(userId, request, idempotencyKey) });
  };

  /** Seslendirme + sesli masalı kaydetme (sonraki GET ve tekrar dinleme sesi hazır bulur). */
  function voicer(userId: string, request: StoryRequest, idempotencyKey?: string) {
    const voice = deps.voice;
    if (!voice) return undefined;
    return async (story: Story, emit: (p: Paragraph) => void): Promise<Story> => {
      // Zaten seslendirilmiş (önbellekteki) masal: yeniden seslendirme yok.
      if (story.paragraphs.every((p) => p.audio_url)) {
        story.paragraphs.forEach(emit);
        return story;
      }
      const cloneVoiceId = request.voice === "parent_clone" ? await deps.cloneVoices?.get(userId) ?? null : null;
      const result = await voiceStory(story, request, voice, { cloneVoiceId, onParagraph: emit });
      const voiced = { ...story, paragraphs: result.paragraphs };
      await deps.engine?.stories.save({ userId, story: voiced, language: request.language, idempotencyKey, createdAt: now() });
      return voiced;
    };
  }
}

/**
 * NDJSON akışı. Üretim + moderasyon bitene kadar "progress" satırları gönderilir; masal ancak güvenlik
 * denetiminden geçtikten sonra çocuğa akar (güvenlik hızdan önce gelir). Seslendirme varsa her paragraf
 * sesi hazır olur olmaz gönderilir: istemci ilk paragrafı beklemeden çalmaya başlar.
 */
function streamStory(
  produce: () => Promise<Story>,
  deps: StoriesDeps,
  opts: { paragraphDelayMs?: number; voice?: (story: Story, emit: (p: Paragraph) => void) => Promise<Story> } = {},
): Response {
  const enc = new TextEncoder();
  const line = (l: StreamLine) => enc.encode(JSON.stringify(l) + "\n");
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (l: StreamLine) => {
        if (!open) return;
        // İstemci bağlantıyı koparırsa enqueue fırlatır; üretim/seslendirme yine biter ve masal saklanır.
        try { controller.enqueue(line(l)); } catch { open = false; }
      };
      send({ type: "progress", stage: "writing" });
      const beat = setInterval(() => send({ type: "progress", stage: "writing" }), deps.heartbeatMs ?? 3000);
      let story: Story;
      try {
        story = await produce();
      } catch {
        clearInterval(beat);
        send({ type: "error", code: "internal" });
        if (open) controller.close();
        return;
      }
      clearInterval(beat);
      send({ type: "started", id: story.id, title: story.title, cover_scene: story.cover_scene });
      if (opts.voice) {
        send({ type: "progress", stage: "voicing" });
        story = await opts.voice(story, (p) => send({ type: "paragraph", paragraph: p }));
      } else {
        for (const p of story.paragraphs) {
          if (opts.paragraphDelayMs) await sleep(opts.paragraphDelayMs);
          send({ type: "paragraph", paragraph: p });
        }
      }
      send({ type: "completed", story });
      if (open) controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8" } });
}
