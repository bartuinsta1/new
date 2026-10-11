// iOS String Catalog'unun iki dilde de eksiksiz olduğunu doğrular (Xcode olmadan CI'da çalışır).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type StringUnit = { state: string; value: string };
type Unit = { stringUnit?: StringUnit; variations?: { plural: Record<string, { stringUnit: StringUnit }> } };

/** Düz çeviri ya da çoğul biçimlerin hepsi. */
const unitsOf = (u: Unit | undefined): StringUnit[] =>
  !u ? [] : u.stringUnit ? [u.stringUnit] : Object.values(u.variations?.plural ?? {}).map((v) => v.stringUnit);
type Catalog = { sourceLanguage: string; strings: Record<string, { localizations?: Record<string, Unit> }> };

const load = (name: string): Catalog =>
  JSON.parse(readFileSync(new URL(`../../Masalcik/Resources/${name}`, import.meta.url), "utf-8"));

// %@, %lld, %1$@ … biçim belirteçleri (türüyle birlikte, sırasız)
const specifiers = (s: string) =>
  (s.match(/%(?:\d+\$)?(?:lld|ld|d|@|f)/g) ?? []).map((x) => x.replace(/\d+\$/, "")).sort();

for (const file of ["Localizable.xcstrings", "InfoPlist.xcstrings"]) {
  test(`${file}: her anahtar Türkçe ve İngilizce çevrilmiş`, () => {
    const cat = load(file);
    assert.equal(cat.sourceLanguage, "tr");
    const keys = Object.keys(cat.strings);
    assert.ok(keys.length > 0);
    for (const key of keys) {
      for (const lang of ["tr", "en"]) {
        const units = unitsOf(cat.strings[key].localizations?.[lang]);
        assert.ok(units.length > 0 && units.every((u) => u.value.trim().length > 0), `[${lang}] eksik: ${key}`);
        assert.ok(units.every((u) => u.state === "translated"), `[${lang}] onaylanmamış: ${key}`);
      }
    }
  });

  test(`${file}: biçim belirteçleri dillerde aynı`, () => {
    const cat = load(file);
    for (const [key, entry] of Object.entries(cat.strings)) {
      for (const u of unitsOf(entry.localizations?.en)) {
        assert.deepEqual(specifiers(u.value), specifiers(key), `belirteç uyuşmazlığı: ${key} → ${u.value}`);
      }
    }
  });
}

test("İngilizce metinlerde Türkçe karakter kalmamış (özel adlar hariç)", () => {
  const allowed = /Fındık|Yıldız|Keloğlan|Masalcık/g;
  const cat = load("Localizable.xcstrings");
  for (const [key, entry] of Object.entries(cat.strings)) {
    for (const u of unitsOf(entry.localizations?.en)) {
      const en = u.value.replace(allowed, "");
      assert.doesNotMatch(en, /[çğıİöşüÇĞÖŞÜ]/, `İngilizce çeviride Türkçe karakter: ${key} → ${en}`);
    }
  }
});
