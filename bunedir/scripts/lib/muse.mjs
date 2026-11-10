// "İlham" motoru: klavyede yazılanı okuyup sözlükten bir kelime önerir. Tamamen cihazda çalışır.
// Referans uygulama; iOS (Shared/Muse.swift) ve Android (Muse.kt) content/muse-vectors.json ile buna bağlıdır.
//
// Kural:
// 1. Yalnızca metin bir ayraçla (boşluk, noktalama, satır sonu) bitiyorsa bakılır — yarım kelimeye öneri yok.
// 2. Son cümlenin (., !, ?, satır sonu sonrası) son 12 kelimesine bakılır.
// 3. Gündelik kelimeler (yaygin.txt) ve 4 harften kısa tek kelimeler dışarıda.
// 4. Önce "bu budur": sözlükteki bir kelimenin kendisi yazıldıysa (çok kelimeliler dahil) → kind "word".
//    En sonda biten eşleşme kazanır; eşitse daha uzun olan.
// 5. Yoksa "buna X denir": bir tetikleyici kök, kelimenin başıyla eşleşirse → kind "feeling".
//    En sondaki kelimeye ait eşleşmeler; birden çok kelime adayıysa, eşleşen kelimenin harf kodları
//    toplamı mod aday sayısı (aynı his için farklı çekimlerde farklı kelimeler gelsin, ama hep aynı girdiye aynı cevap).

export const WINDOW_TOKENS = 12;

// ı/i ayrımı eşleşmede yok sayılır: "Ikigai" (yabancı I) ile klavyede yazılan "ikigai" eşleşsin.
const TR_LOWER = { "İ": "i", "I": "i", "ı": "i" };
const FOLD = { "â": "a", "î": "i", "û": "u", "ā": "a", "ē": "e", "ī": "i", "ō": "o", "ū": "u", "é": "e", "è": "e", "ê": "e", "à": "a", "á": "a", "ó": "o", "ú": "u", "í": "i", "ñ": "n", "ã": "a", "õ": "o" };

/** Küçük harf + şapka/uzatma işaretlerini kaldır; ı → i. ç ğ ö ş ü korunur. */
export function fold(s) {
  let out = "";
  for (const ch of s) {
    const lower = TR_LOWER[ch] ?? ch.toLowerCase();
    out += FOLD[lower] ?? lower;
  }
  return out;
}

const LETTER = /[\p{L}\p{N}]/u;

/** Harf/rakam dizileri; kesme işareti kelimeyi böler (Ayşe'ye → ayşe, ye). */
export function tokens(s) {
  const out = [];
  let cur = "";
  for (const ch of fold(s)) {
    if (LETTER.test(ch)) cur += ch;
    else if (cur) { out.push(cur); cur = ""; }
  }
  if (cur) out.push(cur);
  return out;
}

/** Sözlüğü motorun kullanacağı biçime çevirir (bir kez, açılışta). */
// Gündelik kelimeler (common) ve 4 harften kısa tek kelimeler hiç eşleşmez ("iki", "han", "an"...).
export function prepare(entries) {
  return entries.filter((e) => !e.common).map((e, index) => ({
    index,
    id: e.id,
    keys: [tokens(e.word)].filter((t) => t.length > 1 || (t.length === 1 && t[0].length >= 4)),
    triggers: (e.triggers ?? []).map((t) => tokens(t)).filter((t) => t.length > 0 && t.join("").length >= 3),
  }));
}

export function suggest(prepared, text) {
  if (!text || LETTER.test(fold(text.at(-1) ?? ""))) return null;
  const sentence = text.split(/[.!?\n]/).filter((p) => /[\p{L}]/u.test(p)).at(-1);
  const lastSep = text.trimEnd().at(-1);
  // Cümle sonu işaretiyle bitiyorsa, o cümle hâlâ değerlendirilir.
  const source = sentence ?? "";
  const toks = tokens(source).slice(-WINDOW_TOKENS);
  if (toks.length === 0 || lastSep === undefined) return null;

  // 1) Kelimenin kendisi
  let best = null;
  for (const e of prepared) {
    for (const key of e.keys) {
      for (let end = toks.length; end >= key.length; end--) {
        const start = end - key.length;
        if (key.every((k, i) => toks[start + i] === k)) {
          if (!best || end > best.end || (end === best.end && key.length > best.len)) best = { end, len: key.length, e };
          break;
        }
      }
    }
  }
  if (best) return { kind: "word", id: best.e.id, token: toks.slice(best.end - best.len, best.end).join(" ") };

  // 2) Tetikleyici: en sondaki kelimeden geriye doğru
  for (let end = toks.length; end >= 1; end--) {
    const cands = [];
    for (const e of prepared) {
      if (e.triggers.some((t) => matchesAt(toks, end, t))) cands.push(e);
    }
    if (cands.length > 0) {
      const token = toks[end - 1];
      let sum = 0;
      for (const ch of token) sum += ch.codePointAt(0);
      const pick = cands[sum % cands.length];
      return { kind: "feeling", id: pick.id, token };
    }
  }
  return null;
}

/** Tetikleyici t, toks dizisinde `end`de biter mi? Son kelime önek, öncekiler tam eşleşir. */
function matchesAt(toks, end, t) {
  const start = end - t.length;
  if (start < 0) return false;
  for (let i = 0; i < t.length - 1; i++) if (toks[start + i] !== t[i]) return false;
  return toks[end - 1].startsWith(t[t.length - 1]);
}
