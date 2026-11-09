// "Günün kelimesi" kuralının referans uygulaması. iOS (Shared/Daily.swift) ve Android
// (DailyPlanner.kt) aynı kuralı uygular; content/test-vectors.json üçünü birbirine bağlar.
//
// Kural:
// - Gün sayısı: cihazın yerel takvim günü − epoch (words.json "epoch", ör. 2026-01-01).
//   Herkes aynı gün aynı kelimeyi görür (Instagram'da "bugünün kelimesi" demek için).
// - Günün kelimesi: no'ya göre sıralı listede (gün mod kelime sayısı).
// - Gün 3 saatlik 8 dilime ayrılır; widget her dilimde arka planı değiştirir.
// - Bazı dilimler "hatırla" kartıdır (aralıklı tekrar): 12:00 dünün, 18:00 3 gün öncesinin,
//   21:00 bir hafta öncesinin kelimesi. Uygulama hiç açılmasa da widget öğretmeye devam eder.
// - Arka plan: kelimenin sahneleri (yoksa kapağı) içinde dilim sırasına göre döner.

export const SLOT_HOURS = 3;
export const SLOTS_PER_DAY = 24 / SLOT_HOURS;
/** dilim → kaç gün önceki kelime tekrar edilir */
export const REVIEW_SLOTS = { 4: 1, 6: 3, 7: 7 };

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

export function images(word) {
  return word.scenes.length > 0 ? word.scenes : [word.cover];
}

/** Belirli gün + dilim için widget içeriği. */
export function entry(words, day, slot) {
  const ago = REVIEW_SLOTS[slot] ?? 0;
  const word = wordForDay(words, day - ago);
  const imgs = images(word);
  return {
    kind: ago > 0 ? "review" : "today",
    no: word.no,
    daysAgo: ago,
    image: imgs[mod(day * SLOTS_PER_DAY + slot, imgs.length)],
  };
}
