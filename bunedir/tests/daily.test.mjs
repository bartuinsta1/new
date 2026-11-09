import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dayIndex, entry, wordForDay, REVIEW_SLOTS, SLOTS_PER_DAY } from "../scripts/lib/daily.mjs";

const data = JSON.parse(readFileSync(new URL("../content/words.json", import.meta.url)));
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
    const e = entry(data.words, day, slot);
    const ago = REVIEW_SLOTS[slot] ?? 0;
    assert.equal(e.kind, ago ? "review" : "today");
    assert.equal(e.no, wordForDay(data.words, day - ago).no);
  }
});

test("sahnesi olan kelimede arka plan dilimden dilime değişir", () => {
  const day = 8; // Teavün (no 9), 5 sahne
  const imgs = [0, 1, 2, 3].map((s) => entry(data.words, day, s).image);
  assert.equal(new Set(imgs).size, 4);
  assert.ok(imgs.every((i) => i.startsWith("scenes/09-")));
});

test("test vektörleri güncel kurala uyuyor", () => {
  for (const v of vectors) {
    const [y, m, d] = v.date.split("-").map(Number);
    assert.equal(dayIndex(y, m, d, data.epoch), v.day);
    const e = entry(data.words, v.day, v.slot);
    assert.deepEqual({ kind: e.kind, no: e.no, daysAgo: e.daysAgo, image: e.image }, { kind: v.kind, no: v.no, daysAgo: v.daysAgo, image: v.image });
  }
});
