// "Günün kelimesi" kuralının referans uygulaması. iOS (Shared/Daily.swift) ve Android
// (Daily.kt) aynı kuralı uygular; content/test-vectors.json üçünü birbirine bağlar.
//
// Kural:
// - Gün sayısı: cihazın yerel takvim günü − epoch (words.json "epoch", ör. 2026-01-01).
//   Herkes aynı gün aynı kelimeyi görür (Instagram'da "bugünün kelimesi" demek için).
// - Günün kelimesi: 50 bölüm, no'ya göre sıralı listede (gün mod bölüm sayısı).
// - Gün 3 saatlik 8 dilime ayrılır; widget her dilimde arka planı değiştirir.
// - 12:00 dünün, 18:00 3 gün öncesinin, 21:00 bir hafta öncesinin kelimesi "hatırla" kartıdır.
// - 15:00 "sözlükten" kartıdır: 1000 kelimelik sözlükteki (bölüm ve gündelik olmayan) kelimelerden
//   gün mod sayı sıradaki; arka planda günün bölümünün sahnesi durur.
// - Arka plan: ilgili bölümün sahneleri (yoksa kapağı) içinde dilim sırasına göre döner.

export const SLOT_HOURS = 3;
export const SLOTS_PER_DAY = 24 / SLOT_HOURS;
/** dilim → kaç gün önceki kelime tekrar edilir */
export const REVIEW_SLOTS = { 4: 1, 6: 3, 7: 7 };
export const DICTIONARY_SLOT = 5;

const mod = (a, n) => ((a % n) + n) % n;

/** Yerel takvim tarihi (y, m 1-12, d) → epoch'tan bu yana gün (UTC hesabıyla, saat diliminden bağımsız). */
export function dayIndex(y, m, d, epoch) {
  const [ey, em, ed] = epoch.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ey, em - 1, ed)) / 86_400_000);
}

export function sortedWords(words) {
  return [...words].sort((a, b) => a.no - b.no);
}

export function wordForDay(words, day) {
  const list = sortedWords(words);
  return list[mod(day, list.length)];
}

/** Widget'ın "sözlükten" kartında dönen kelimeler (sözlük dosyasındaki sırayla). */
export function dailyPool(dictionary) {
  return dictionary.filter((e) => !e.common && e.episode === undefined);
}

export function dictionaryForDay(dictionary, day) {
  const pool = dailyPool(dictionary);
  return pool[mod(day, pool.length)];
}

export function images(word) {
  return word.scenes.length > 0 ? word.scenes : [word.cover];
}

/** Belirli gün + dilim için widget içeriği. */
export function entry(words, dictionary, day, slot) {
  const ago = REVIEW_SLOTS[slot] ?? 0;
  const word = wordForDay(words, day - ago);
  const imgs = images(word);
  const image = imgs[mod(day * SLOTS_PER_DAY + slot, imgs.length)];
  if (slot === DICTIONARY_SLOT) {
    return { kind: "dictionary", no: word.no, daysAgo: 0, image, dictId: dictionaryForDay(dictionary, day).id };
  }
  return { kind: ago > 0 ? "review" : "today", no: word.no, daysAgo: ago, image, dictId: null };
}
