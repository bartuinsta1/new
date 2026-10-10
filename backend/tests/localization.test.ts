// iOS String Catalog'unun iki dilde de eksiksiz olduğunu doğrular (Xcode olmadan CI'da çalışır).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type Unit = { stringUnit: { state: string; value: string } };
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
        const unit = cat.strings[key].localizations?.[lang]?.stringUnit;
        assert.ok(unit && unit.value.trim().length > 0, `[${lang}] eksik: ${key}`);
        assert.equal(unit.state, "translated", `[${lang}] onaylanmamış: ${key}`);
      }
    }
  });

  test(`${file}: biçim belirteçleri dillerde aynı`, () => {
    const cat = load(file);
    for (const [key, entry] of Object.entries(cat.strings)) {
      const en = entry.localizations?.en?.stringUnit.value ?? "";
      assert.deepEqual(specifiers(en), specifiers(key), `belirteç uyuşmazlığı: ${key} → ${en}`);
    }
  });
}

test("İngilizce metinlerde Türkçe karakter kalmamış (özel adlar hariç)", () => {
  const allowed = /Fındık|Yıldız|Keloğlan|Masalcık/g;
  const cat = load("Localizable.xcstrings");
  for (const [key, entry] of Object.entries(cat.strings)) {
    const en = (entry.localizations?.en?.stringUnit.value ?? "").replace(allowed, "");
    assert.doesNotMatch(en, /[çğıİöşüÇĞÖŞÜ]/, `İngilizce çeviride Türkçe karakter: ${key} → ${en}`);
  }
});
