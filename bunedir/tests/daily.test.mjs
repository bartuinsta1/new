import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dayIndex, entry, wordForDay, dictionaryForDay, dailyPool, REVIEW_SLOTS, SLOTS_PER_DAY, DICTIONARY_SLOT } from "../scripts/lib/daily.mjs";
import { prepare, suggest, fold, tokens } from "../scripts/lib/muse.mjs";

const data = JSON.parse(readFileSync(new URL("../content/words.json", import.meta.url)));
const dict = JSON.parse(readFileSync(new URL("../content/dictionary.json", import.meta.url))).entries;
const museVectors = JSON.parse(readFileSync(new URL("../content/muse-vectors.json", import.meta.url))).vectors;
const vectors = JSON.parse(readFileSync(new URL("../content/test-vectors.json", import.meta.url))).vectors;

test("gün sayısı yerel takvim tarihine göre; epoch öncesi negatif", () => {
  assert.equal(dayIndex(2026, 1, 1, "2026-01-01"), 0);
  assert.equal(dayIndex(2025, 12, 31, "2026-01-01"), -1);
  assert.equal(dayIndex(2027, 1, 1, "2026-01-01"), 365);
  assert.equal(dayIndex(2026, 3, 29, "2026-01-01"), 87, "yaz saati geçişi günü kaydırmaz");
});

test("her gün sıradaki kelime; 50 günde bir döner", () => {
  assert.equal(wordForDay(data.words, 0).no, 1);
  assert.equal(wordForDay(data.words, 49).no, 50);
  assert.equal(wordForDay(data.words, 50).no, 1);
  assert.equal(wordForDay(data.words, -1).no, 50);
});

test("hatırla dilimleri geçmiş kelimeleri gösterir, diğerleri bugünü", () => {
  const day = 100;
  for (let slot = 0; slot < SLOTS_PER_DAY; slot++) {
    const e = entry(data.words, dict, day, slot);
    const ago = REVIEW_SLOTS[slot] ?? 0;
    if (slot === DICTIONARY_SLOT) { assert.equal(e.kind, "dictionary"); assert.equal(e.dictId, dictionaryForDay(dict, day).id); continue; }
    assert.equal(e.kind, ago ? "review" : "today");
    assert.equal(e.no, wordForDay(data.words, day - ago).no);
  }
});

test("sahnesi olan kelimede arka plan dilimden dilime değişir", () => {
  const day = 8; // Teavün (no 9), 5 sahne
  const imgs = [0, 1, 2, 3].map((s) => entry(data.words, dict, day, s).image);
  assert.equal(new Set(imgs).size, 4);
  assert.ok(imgs.every((i) => i.startsWith("scenes/09-")));
});

test("test vektörleri güncel kurala uyuyor", () => {
  for (const v of vectors) {
    const [y, m, d] = v.date.split("-").map(Number);
    assert.equal(dayIndex(y, m, d, data.epoch), v.day);
    const e = entry(data.words, dict, v.day, v.slot);
    assert.deepEqual(e, { kind: v.kind, no: v.no, daysAgo: v.daysAgo, image: v.image, dictId: v.dictId });
  }
});

test("sözlük: 1000+ kelime, 100+ Japonca, günlük havuz bölüm ve gündelik kelime içermez", () => {
  assert.ok(dict.length >= 1000, `${dict.length}`);
  assert.ok(dict.filter((e) => e.origin === "Japonca").length >= 100);
  const pool = dailyPool(dict);
  assert.ok(pool.length > 500);
  assert.ok(pool.every((e) => !e.common && e.episode === undefined));
});

test("ilham motoru: Türkçe küçük harf, yarım kelimeye öneri yok, gündelik kelime susar", () => {
  assert.equal(fold("İSTANBUL Işık Ikigai"), "istanbul işik ikigai");
  assert.deepEqual(tokens("Ayşe'ye wabi-sabi!"), ["ayşe", "ye", "wabi", "sabi"]);
  const P = prepare(dict);
  assert.equal(suggest(P, "lagom bir hayat istiyorum ").kind, "word");
  assert.equal(suggest(P, "lago"), null);
  assert.equal(suggest(P, "hayat "), null);
  assert.equal(suggest(P, "iki "), null);
  assert.equal(suggest(P, "canım sıkılıyor ").kind, "feeling");
});

test("ilham vektörleri güncel kurala uyuyor", () => {
  const P = prepare(dict);
  for (const v of museVectors) assert.deepEqual(suggest(P, v.text), v.result, JSON.stringify(v.text));
});
