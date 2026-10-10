// Güvenlik katmanı (§4.4).
// 1) Girdi temizleme: ebeveynin/geçmişin serbest metinleri istem enjeksiyonu ve zararlı içerik için taranır.
// 2) Çıktı kural denetimi: yasaklı kelimeler (içerik filtrelerine göre), yapı ve kahraman kontrolleri.
//    Bu deterministik denetim, ikinci model çağrısıyla yapılan moderasyondan ÖNCE çalışır; ikisi birlikte uygulanır.
import type { ContentFilters, Language, StoryRequest } from "../contract.ts";
import type { LlmStory } from "./schema.ts";

/** Karşılaştırma için normalleştirme: Türkçe küçük harf + aksan/şapka sadeleştirme. */
export function normalize(s: string): string {
  return s.toLocaleLowerCase("tr-TR")
    .replace(/[âà]/g, "a").replace(/[îì]/g, "i").replace(/[ûù]/g, "u")
    .replace(/\s+/g, " ");
}

// ---------- 1) Girdi ----------

/** İstem enjeksiyonu kalıpları (tr + en). Eşleşen serbest metin modele hiç gönderilmez. */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all |the )?(previous|prior|above)/i,
  /disregard (all |the )?(previous|prior|above|instructions)/i,
  /(system|developer) (prompt|message|instructions?)/i,
  /you are now|act as|pretend to be|jailbreak|DAN mode/i,
  /new instructions?|override|bypass/i,
  /önceki (talimat|kural|komut)|talimatları (unut|yok say)|kuralları (unut|yok say|boşver)/i,
  /sistem (mesajı|istemi|promptu)|artık sen|gibi davran|rol yap/i,
  /<\/?\s*(system|assistant|user|child_profile|story|s)\b|<\|/i,
  /```|\{\{|\}\}|\[\[|\]\]/,
  /https?:\/\/|www\./i,
];

/**
 * Terim eşleştirme kuralı: terimler kelime başından eşleşir.
 *   "silah*" → kökle başlayan her kelime (Türkçe ekler: silahı, silahlar).
 *   "gun"    → yalnızca tam kelime ("begun" ya da "Gunnar" eşleşmez).
 *   Çok kelimeli ifadeler ("passed away") aynı kurallarla, kelime sınırında eşleşir.
 */
export function findTerms(text: string, terms: string[], opts: { turkishSoftening?: boolean } = {}): string[] {
  const n = normalize(text);
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return terms.filter((term) => {
    const prefix = term.endsWith("*");
    const body = normalize(prefix ? term.slice(0, -1) : term);
    const stems = prefix && opts.turkishSoftening ? [body, ...softened(body)] : [body];
    return stems.some((stem) => new RegExp(`(^|[^\\p{L}])${esc(stem)}${prefix ? "" : "(?![\\p{L}])"}`, "u").test(n));
  });
}

/**
 * Türkçe ünsüz yumuşaması: ünlüyle başlayan ek alınca kökün son ünsüzü değişir
 * (bıçak → bıçağı, tüfek → tüfeği, kitap → kitabı, ağaç → ağacı). Önek terimlerinde bu biçim de aranır.
 */
function softened(stem: string): string[] {
  const map: Record<string, string> = { k: "ğ", ç: "c", t: "d", p: "b" };
  const last = stem.at(-1) ?? "";
  if (!map[last] || stem.length < 3) return [];
  const out = [stem.slice(0, -1) + map[last]];
  if (stem.endsWith("nk")) out.push(stem.slice(0, -1) + "g"); // renk → rengi
  return out;
}

/** Çocuğa ulaşmaması gereken temalar (serbest girdi alanlarında). Ad ise istek reddedilir, diğer alanlar atılır.
 * Not: "Savaş" yaygın bir Türkçe erkek adı olduğu için listede yok. */
const HARMFUL_INPUT_TR = [
  "öldür*", "ölüm*", "ölü", "kan", "kanlı*", "bıçak*", "silah*", "tabanca*", "bomba*", "kavga*", "dövüş*",
  "canavar*", "hayalet*", "zombi*", "şeytan*", "korku*", "kabus*", "intihar*", "seks*", "çıplak*", "uyuşturucu*",
  "alkol*", "sigara*",
];
const HARMFUL_INPUT_EN = [
  "kill*", "death*", "dead", "blood*", "knife", "knives", "gun", "guns", "weapon*", "bomb*", "war", "wars", "fight*",
  "punch*", "monster*", "ghost*", "zombie*", "devil*", "horror*", "nightmare*", "suicide*", "sex", "sexy", "naked",
  "drug", "drugs", "alcohol*",
];

export type InputIssue = { field: string; reason: "injection" | "harmful" };

export function looksLikeInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

export function containsHarmful(text: string): boolean {
  return findTerms(text, HARMFUL_INPUT_TR, { turkishSoftening: true }).length > 0 ||
    findTerms(text, HARMFUL_INPUT_EN).length > 0;
}

const KNOWN_INTERESTS = new Set([
  "animals", "space", "sea", "princesses", "superheroes", "dinosaurs", "football", "vehicles", "music", "nature",
]);
const KNOWN_VALUES = new Set(["new_sibling", "starting_school", "fear_of_dark", "sharing", "brushing_teeth", "courage"]);

export class UnsafeInputError extends Error {}

/**
 * İsteği temizler. Ad ve telaffuz zararlı/enjeksiyon içerirse istek reddedilir (ebeveyn düzeltmeli).
 * Diğer serbest alanlar (eski masal başlıkları, kalıcı karakter kartları) sessizce atılır — çocuk hata görmez.
 */
export function sanitizeRequest(r: StoryRequest): { request: StoryRequest; issues: InputIssue[] } {
  const issues: InputIssue[] = [];
  for (const [field, value] of [["child_name", r.child_name], ["pronunciation", r.pronunciation ?? ""]] as const) {
    if (looksLikeInjection(value)) issues.push({ field, reason: "injection" });
    else if (containsHarmful(value)) issues.push({ field, reason: "harmful" });
  }
  if (issues.length) throw new UnsafeInputError(issues.map((i) => `${i.field}:${i.reason}`).join(","));

  const keep = (field: string) => (text: string) => {
    if (looksLikeInjection(text)) { issues.push({ field, reason: "injection" }); return false; }
    if (containsHarmful(text)) { issues.push({ field, reason: "harmful" }); return false; }
    return true;
  };
  const interests = r.interests.filter((i) => KNOWN_INTERESTS.has(i));
  if (interests.length !== r.interests.length) issues.push({ field: "interests", reason: "harmful" });

  return {
    request: {
      ...r,
      // Telaffuz yalnızca TTS içindir; modele asıl ad gider.
      pronunciation: r.pronunciation ?? null,
      interests,
      value: r.value && KNOWN_VALUES.has(r.value) ? r.value : null,
      recent_story_titles: r.recent_story_titles.filter(keep("recent_story_titles")),
      recurring_characters: r.recurring_characters.filter((c) => keep("recurring_characters")(`${c.name} ${c.card}`)),
    },
    issues,
  };
}

// ---------- 2) Çıktı ----------

/** Her zaman yasak (filtreden bağımsız). `*` = kökle başlayan kelimeler. */
const ALWAYS_BLOCKED: Record<Language, string[]> = {
  tr: ["öldür*", "silah*", "tabanca*", "tüfek*", "bıçakla*", "bomba*", "kan aktı", "kanlar*", "yarala*", "dövdü*",
    "dövüş*", "tokat*", "intihar*", "seks*", "uyuşturucu*", "sigara*", "alkol*", "şeytan*", "zombi*", "aptal*",
    "salak*", "gerizekalı*", "şişko*", "kızlar ağlar*", "erkekler ağlamaz", "kız işi", "erkek işi"],
  en: ["kill*", "gun", "guns", "rifle*", "stab*", "bomb*", "bleed*", "blood*", "punch*", "slap*", "suicide*", "sex",
    "sexy", "drug", "drugs", "cigarette*", "alcohol*", "devil*", "zombie*", "stupid", "idiot*", "fatso", "girls cry",
    "boys don't cry", "girls can't", "boys can't"],
};
const LOSS_TERMS: Record<Language, string[]> = {
  tr: ["öldü*", "ölmüş*", "ölüm*", "ölü", "cenaze*", "mezar*", "terk etti", "vefat*"],
  en: ["died", "dies", "dead", "death*", "funeral*", "grave", "graves", "passed away", "abandon*", "never came back"],
};
const SCARY_TERMS: Record<Language, string[]> = {
  tr: ["canavar*", "hayalet*", "cadı*", "kabus*", "dehşet*", "korkunç*", "çığlık*", "karanlıkta bir şey"],
  en: ["monster*", "ghost*", "witch*", "nightmare*", "terrifying", "horrible", "horrifying", "scream*",
    "something in the dark"],
};
/** Sık görülen marka/ürün adları (eksiksiz değildir; moderasyon modeli asıl ağdır).
 * Çocuk adı ya da günlük kelime olabilenler ("Elsa", "frozen") bilinçli olarak listede yok. */
const BRANDS = ["disney", "pixar", "marvel", "barbie", "lego", "pokemon", "pokémon", "youtube", "tiktok", "instagram",
  "netflix", "minecraft", "roblox", "fortnite", "coca-cola", "mcdonald", "nutella", "spiderman", "spider-man",
  "paw patrol", "peppa", "iphone", "playstation", "nintendo"];

const OPENINGS: Record<Language, string[]> = {
  tr: ["bir varmış bir yokmuş", "evvel zaman içinde"],
  en: ["once upon a time", "long, long ago", "long long ago"],
};
const CLOSINGS: Record<Language, string[]> = {
  tr: ["gökten üç elma", "ermiş muradına", "erdi muradına"],
  en: ["happily ever after", "three apples fell"],
};

export type CheckResult = {
  /** Çocuğa gönderilemez: yeniden üret ya da yedek masal. */
  blocking: string[];
  /** Kalite uyarıları: loglanır, masal yine gider. */
  warnings: string[];
};

export function storyText(s: Pick<LlmStory, "title" | "paragraphs" | "moral">): string {
  return [s.title, ...s.paragraphs.map((p) => p.text), s.moral].join("\n");
}

export function checkStory(story: LlmStory, req: StoryRequest): CheckResult {
  const lang = req.language;
  const blocking: string[] = [];
  const warnings: string[] = [];
  const full = storyText(story);
  const has = (terms: string[]) => findTerms(full, terms, { turkishSoftening: lang === "tr" });

  const always = has(ALWAYS_BLOCKED[lang]);
  if (always.length) blocking.push(`blocked_terms:${always.join("|")}`);
  if (!req.content_filters.allow_loss_and_separation) {
    const loss = has(LOSS_TERMS[lang]);
    if (loss.length) blocking.push(`loss_terms:${loss.join("|")}`);
  }
  if (!req.content_filters.allow_mild_scary) {
    const scary = has(SCARY_TERMS[lang]);
    if (scary.length) blocking.push(`scary_terms:${scary.join("|")}`);
  }
  const brands = findTerms(full, BRANDS);
  if (brands.length) blocking.push(`brands:${brands.join("|")}`);
  if (looksLikeInjection(storyText(story))) blocking.push("injection_echo");

  // Yapı
  if (story.paragraphs.length < 3) blocking.push("too_few_paragraphs");
  if (story.paragraphs.some((p) => p.text.trim().length === 0)) blocking.push("empty_paragraph");
  const nameCount = countName(storyText(story), req.child_name);
  if (nameCount === 0) blocking.push("hero_missing");
  else if (nameCount < 3 || nameCount > 5) warnings.push(`name_count:${nameCount}`);

  const first = normalize(story.paragraphs[0]?.text ?? "");
  if (!OPENINGS[lang].some((o) => first.startsWith(o))) warnings.push("no_traditional_opening");
  const last = normalize(story.paragraphs.at(-1)?.text ?? "");
  if (!CLOSINGS[lang].some((c) => last.includes(c))) warnings.push("no_traditional_closing");
  if (!story.paragraphs.slice(-2).every((p) => p.emotion === "sleepy" || p.emotion === "whisper")) {
    warnings.push("ending_not_sleepy");
  }
  if (/\d/.test(storyText(story))) warnings.push("digits_in_text");
  return { blocking, warnings };
}

/** Adın kaç kez geçtiği (Türkçe eklerle birlikte: "Ayşe'ye", "Ayşe'nin"). */
export function countName(text: string, name: string): number {
  const n = normalize(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^\\p{L}])${n}(?=$|[^\\p{L}]|['’])`, "gu");
  return (normalize(text).match(re) ?? []).length;
}

/** Log için kişisel veriyi maskeler (çocuğun adı → {CHILD}). */
export function maskPersonalData(text: string, name: string): string {
  if (!name) return text;
  const n = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(n, "giu"), "{CHILD}");
}

export const _forTests = { ALWAYS_BLOCKED, LOSS_TERMS, SCARY_TERMS, BRANDS };
export type { ContentFilters };
