// Masalın paragraflarını sırayla seslendirir; her paragraf hazır olur olmaz geri çağırır
// (istemci ilk paragrafı beklemeden çalmaya başlar, §3.3).
// Önbellek: aynı metin + aynı ses + aynı duygu → aynı dosya; tekrar seslendirme ve maliyet yok (§4.6).
// Bir paragraf seslendirilemezse audio_url null döner: istemci cihaz içi sesle okur, çocuk hata görmez.
import type { Paragraph, Story, StoryRequest } from "../contract.ts";
import type { CostLog } from "../engine/store.ts";
import { type AudioStore, sha256Hex, type SynthesisInput, type TtsProvider } from "./tts.ts";

export interface VoiceDeps {
  tts: TtsProvider;
  /** Ebeveynin klon sesi için (Premium). Yoksa ya da klon yoksa varsayılan "Anne" sesine düşülür. */
  cloneTts?: TtsProvider;
  audio: AudioStore;
  costs?: CostLog;
  now?: () => Date;
}

export interface VoiceResult {
  paragraphs: Paragraph[];
  synthesizedChars: number;
  cachedParagraphs: number;
  failedParagraphs: number;
  costUSD: number;
}

export async function voiceStory(
  story: Story,
  request: Pick<StoryRequest, "language" | "voice" | "duration_minutes">,
  deps: VoiceDeps,
  opts: { cloneVoiceId?: string | null; onParagraph?: (p: Paragraph) => void | Promise<void> } = {},
): Promise<VoiceResult> {
  const useClone = request.voice === "parent_clone" && !!opts.cloneVoiceId && !!deps.cloneTts;
  const provider = useClone ? deps.cloneTts! : deps.tts;
  const tone = useClone ? "parent_clone" : request.voice === "parent_clone" ? "mother" : request.voice;

  const out: Paragraph[] = [];
  let synthesizedChars = 0, cachedParagraphs = 0, failedParagraphs = 0;

  for (const p of story.paragraphs) {
    const input: SynthesisInput = {
      text: p.text, language: request.language, tone, emotion: p.emotion, cloneVoiceId: opts.cloneVoiceId,
    };
    let audioUrl: string | null = null;
    try {
      const key = `tts/${await sha256Hex(`${provider.voiceKey(input)}|${p.text}`)}.mp3`;
      audioUrl = await deps.audio.find(key);
      if (audioUrl) {
        cachedParagraphs++;
      } else {
        const bytes = await provider.synthesize(input);
        audioUrl = await deps.audio.put(key, bytes, "audio/mpeg");
        synthesizedChars += p.text.length;
      }
    } catch {
      failedParagraphs++;
      audioUrl = null;
    }
    const voiced = { ...p, audio_url: audioUrl };
    out.push(voiced);
    await opts.onParagraph?.(voiced);
  }

  const costUSD = (synthesizedChars * provider.usdPerMillionChars) / 1_000_000;
  if (deps.costs && synthesizedChars > 0) {
    await deps.costs.record({
      at: (deps.now ?? (() => new Date()))(), language: request.language, durationMinutes: request.duration_minutes,
      llmInputTokens: 0, llmOutputTokens: 0, llmCacheReadTokens: 0, llmCacheWriteTokens: 0,
      ttsCharacters: synthesizedChars, costUSD, attempts: 1, outcome: "tts",
    });
  }
  return { paragraphs: out, synthesizedChars, cachedParagraphs, failedParagraphs, costUSD };
}

/** Ailenin klon ses kimliği (ElevenLabs). Üretimde voice_clones tablosu. */
export interface CloneVoiceStore {
  get(userId: string): Promise<string | null>;
  set(userId: string, voiceId: string): Promise<void>;
  delete(userId: string): Promise<void>;
}

export class MemoryCloneVoiceStore implements CloneVoiceStore {
  private ids = new Map<string, string>();
  async get(userId: string) { return this.ids.get(userId) ?? null; }
  async set(userId: string, voiceId: string) { this.ids.set(userId, voiceId); }
  async delete(userId: string) { this.ids.delete(userId); }
}
