// Türkçe hal ekleri (iOS: Core/Utilities/TurkishText.swift ile aynı kurallar).
const BACK = new Set(["a", "ı", "o", "u"]);
const VOWELS = new Set(["a", "e", "ı", "i", "o", "ö", "u", "ü"]);
const HARD = new Set(["f", "s", "t", "k", "ç", "ş", "h", "p"]);

const lastWord = (w: string) => (w.split(" ").pop() ?? w).toLocaleLowerCase("tr-TR");
const lastVowel = (w: string) => [...lastWord(w)].reverse().find((c) => VOWELS.has(c));
const endsVowel = (w: string) => VOWELS.has([...lastWord(w)].pop() ?? "");
const twoWay = (w: string) => (BACK.has(lastVowel(w) ?? "e") ? "a" : "e");

export const dative = (n: string) => (endsVowel(n) ? `${n}'y${twoWay(n)}` : `${n}'${twoWay(n)}`);
export const locative = (n: string, afterPossessive = false) => {
  if (afterPossessive && endsVowel(n)) return `${n}'nd${twoWay(n)}`;
  const d = HARD.has([...lastWord(n)].pop() ?? "") ? "t" : "d";
  return `${n}'${d}${twoWay(n)}`;
};
