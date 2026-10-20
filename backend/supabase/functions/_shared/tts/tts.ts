// Seslendirme (§4.5). Sağlayıcı bir arayüzün arkasında: Azure Neural (varsayılan), ElevenLabs (ses klonu).
// API anahtarları yalnızca sunucuda.
//
// VARSAYIM: Varsayılan sağlayıcı Azure Neural TTS — tr-TR nöral sesleri (Emel, Ahmet) ve SSML ile hız/perde/ton
// denetimi var; ElevenLabs ise ebeveynin kendi sesi (klon) için. Ses adları lansmandan önce dinlenip onaylanmalı.
import type { Language, ParagraphEmotion, VoiceTone } from "../contract.ts";

export interface SynthesisInput {
  text: string;
  language: Language;
  tone: VoiceTone;
  emotion: ParagraphEmotion;
  /** Yalnızca `parent_clone` için: sağlayıcıdaki klon ses kimliği. */
  cloneVoiceId?: string | null;
}

export interface TtsProvider {
  readonly name: string;
  /** Karakter başına maliyet (USD / 1M karakter) — maliyet logu için. */
  readonly usdPerMillionChars: number;
  /** Önbellek anahtarına giren ses kimliği (aynı metin + aynı ses = aynı dosya). */
  voiceKey(input: SynthesisInput): string;
  synthesize(input: SynthesisInput): Promise<Uint8Array>;
}

// ---------- Azure Neural ----------

type VoiceSpec = { name: string; pitch: number; rate: number };

/** Dört ses tonu (§4.5): sakin, yavaş (~%85), sıcak. Nine/Dede biraz daha yavaş ve pes. */
export const AZURE_VOICES: Record<Language, Record<Exclude<VoiceTone, "parent_clone">, VoiceSpec>> = {
  tr: {
    mother: { name: "tr-TR-EmelNeural", pitch: 0, rate: -15 },
    father: { name: "tr-TR-AhmetNeural", pitch: 0, rate: -15 },
    grandmother: { name: "tr-TR-EmelNeural", pitch: -8, rate: -20 },
    grandfather: { name: "tr-TR-AhmetNeural", pitch: -10, rate: -20 },
  },
  en: {
    mother: { name: "en-US-AvaNeural", pitch: 0, rate: -15 },
    father: { name: "en-US-AndrewNeural", pitch: 0, rate: -15 },
    grandmother: { name: "en-US-AvaNeural", pitch: -8, rate: -20 },
    grandfather: { name: "en-US-AndrewNeural", pitch: -10, rate: -20 },
  },
};

/** Paragraf duygusuna göre hafif ton değişimi (yüzde puanı). */
const EMOTION_PROSODY: Record<ParagraphEmotion, { pitch: number; rate: number; volume?: string }> = {
  neutral: { pitch: 0, rate: 0 },
  smiling: { pitch: 3, rate: 0 },
  surprised: { pitch: 6, rate: 4 },
  whisper: { pitch: -2, rate: -5, volume: "soft" },
  sleepy: { pitch: -3, rate: -10, volume: "soft" },
};

export function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

const pct = (n: number) => `${n >= 0 ? "+" : ""}${n}%`;

export function buildSsml(input: SynthesisInput): string {
  const tone = input.tone === "parent_clone" ? "mother" : input.tone;
  const voice = AZURE_VOICES[input.language][tone];
  const e = EMOTION_PROSODY[input.emotion];
  const lang = input.language === "tr" ? "tr-TR" : "en-US";
  const volume = e.volume ? ` volume="${e.volume}"` : "";
  // Paragraf sonunda kısa nefes payı: masal acele etmesin.
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">` +
    `<voice name="${voice.name}"><prosody rate="${pct(voice.rate + e.rate)}" pitch="${pct(voice.pitch + e.pitch)}"${volume}>` +
    `${escapeXml(input.text)}<break time="700ms"/></prosody></voice></speak>`;
}

export class AzureTts implements TtsProvider {
  readonly name = "azure";
  /** Azure Neural TTS liste fiyatı ~16 $ / 1M karakter (lansmandan önce güncel fiyatla doğrulanmalı). */
  readonly usdPerMillionChars = 16;
  private key: string;
  private region: string;
  private fetchFn: typeof fetch;

  constructor(opts: { key: string; region: string; fetchFn?: typeof fetch }) {
    this.key = opts.key;
    this.region = opts.region;
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  voiceKey(input: SynthesisInput): string {
    const tone = input.tone === "parent_clone" ? "mother" : input.tone;
    return `azure:${AZURE_VOICES[input.language][tone].name}:${input.tone}:${input.emotion}`;
  }

  async synthesize(input: SynthesisInput): Promise<Uint8Array> {
    const res = await this.fetchFn(`https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": this.key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "masalcik",
      },
      body: buildSsml(input),
    });
    if (!res.ok) throw new TtsError(`azure_${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }
}

// ---------- ElevenLabs (ebeveynin klon sesi, Premium) ----------

export class ElevenLabsCloneTts implements TtsProvider {
  readonly name = "elevenlabs";
  /** Plan fiyatına göre değişir; maliyet logu için yaklaşık değer. */
  readonly usdPerMillionChars = 100;
  private key: string;
  private fetchFn: typeof fetch;

  constructor(opts: { key: string; fetchFn?: typeof fetch }) {
    this.key = opts.key;
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  voiceKey(input: SynthesisInput): string {
    return `elevenlabs:${input.cloneVoiceId}:${input.emotion}`;
  }

  async synthesize(input: SynthesisInput): Promise<Uint8Array> {
    if (!input.cloneVoiceId) throw new TtsError("no_clone_voice");
    const res = await this.fetchFn(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(input.cloneVoiceId)}?output_format=mp3_44100_64`,
      {
        method: "POST",
        headers: { "xi-api-key": this.key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text: input.text, model_id: "eleven_multilingual_v2" }),
      },
    );
    if (!res.ok) throw new TtsError(`elevenlabs_${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }
}

export class TtsError extends Error {}

// ---------- Ses deposu ----------

/** Üretilen ses dosyaları. Üretimde Supabase Storage (özel kova + imzalı URL; ses çocuğun adını içerir). */
export interface AudioStore {
  /** Aynı anahtar daha önce üretildiyse URL'si (önbellek isabeti). */
  find(key: string): Promise<string | null>;
  put(key: string, bytes: Uint8Array, contentType: string): Promise<string>;
  /** Bir klasördeki tüm dosyaları siler (ör. `clone/<userId>/`): klon sesle üretilmiş masal sesleri. */
  deletePrefix(prefix: string): Promise<void>;
}

export class MemoryAudioStore implements AudioStore {
  files = new Map<string, Uint8Array>();
  async find(key: string) { return this.files.has(key) ? this.urlFor(key) : null; }
  async put(key: string, bytes: Uint8Array, _contentType?: string) { this.files.set(key, bytes); return this.urlFor(key); }
  async deletePrefix(prefix: string) { for (const k of [...this.files.keys()]) if (k.startsWith(prefix)) this.files.delete(k); }
  private urlFor(key: string) { return `https://cdn.masalcik.test/${key}`; }
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- ElevenLabs anlık ses klonu (Instant Voice Cloning) ----------

/**
 * Ebeveynin ~1 dk'lık ses örneğinden klon ses oluşturur. Ses adı kişisel veri içermez (rastgele).
 * Örneği biz saklamayız: yalnızca sağlayıcıya iletilir; ses silinince sağlayıcıdaki örnekler de silinir.
 */
export class ElevenLabsVoiceCloner {
  private key: string;
  private fetchFn: typeof fetch;
  constructor(opts: { key: string; fetchFn?: typeof fetch }) {
    this.key = opts.key;
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  async create(sample: Uint8Array, contentType: string): Promise<string> {
    const form = new FormData();
    form.append("name", `masalcik-${crypto.randomUUID().slice(0, 8)}`);
    form.append("description", "Masalcık ebeveyn anlatıcı sesi (yalnızca bu aile).");
    form.append("remove_background_noise", "true");
    form.append("files", new Blob([new Uint8Array(sample)], { type: contentType }), "sample.m4a");
    const res = await this.fetchFn("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST", headers: { "xi-api-key": this.key }, body: form,
    });
    if (!res.ok) throw new TtsError(`elevenlabs_clone_${res.status}`);
    const body = await res.json() as { voice_id?: string };
    if (!body.voice_id) throw new TtsError("elevenlabs_clone_no_id");
    return body.voice_id;
  }

  async delete(voiceId: string): Promise<void> {
    const res = await this.fetchFn(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voiceId)}`, {
      method: "DELETE", headers: { "xi-api-key": this.key },
    });
    // 404: zaten silinmiş — amaç gerçekleşmiş sayılır.
    if (!res.ok && res.status !== 404) throw new TtsError(`elevenlabs_delete_${res.status}`);
  }
}
