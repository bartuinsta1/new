#!/usr/bin/env node
// İçeriği doğrular ve platformlar arası test vektörlerini üretir.
//   node scripts/check-content.mjs          → doğrula + content/test-vectors.json yaz
//   node scripts/check-content.mjs --check  → doğrula + vektörler güncel mi (CI)
// iOS ve Android içerik klasörünü kopyalamadan doğrudan kullanır (project.yml / build.gradle.kts).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dayIndex, entry, SLOTS_PER_DAY } from "./lib/daily.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = join(root, "content");
const data = JSON.parse(readFileSync(join(contentDir, "words.json"), "utf8"));

const errors = [];
if (!/^\d{4}-\d{2}-\d{2}$/.test(data.epoch)) errors.push("epoch YYYY-AA-GG olmalı");
const seen = new Set();
for (const w of data.words) {
  const at = `#${w.no} ${w.word}`;
  if (!Number.isInteger(w.no) || w.no < 1) errors.push(`${at}: no`);
  if (seen.has(w.no)) errors.push(`${at}: no tekrar ediyor`);
  seen.add(w.no);
  if (!/^[a-z0-9-]+$/.test(w.slug)) errors.push(`${at}: slug yalnızca a-z0-9-`);
  for (const k of ["word", "origin", "meaning", "oneLiner", "story"]) {
    if (typeof w[k] !== "string" || w[k].trim() === "") errors.push(`${at}: ${k} boş`);
  }
  // Widget'larda sığması için üst sınırlar (büyük widget'ta hikâye de görünür).
  if (w.meaning.length > 140) errors.push(`${at}: meaning 140 karakteri aşıyor (${w.meaning.length})`);
  if (w.oneLiner.length > 70) errors.push(`${at}: oneLiner 70 karakteri aşıyor (${w.oneLiner.length})`);
  if (w.story.length > 320) errors.push(`${at}: story 320 karakteri aşıyor (${w.story.length})`);
  for (const img of [w.cover, ...w.scenes]) {
    if (!existsSync(join(contentDir, img))) errors.push(`${at}: görsel yok: ${img}`);
  }
  if (w.reel !== null && !/^https:\/\/(www\.)?instagram\.com\//.test(w.reel)) errors.push(`${at}: reel instagram adresi olmalı`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

// Test vektörleri: farklı aylar, epoch öncesi, artık yıl, tüm dilimler.
const dates = [
  [2026, 1, 1], [2026, 1, 2], [2026, 2, 19], [2026, 11, 9], [2025, 12, 31], [2027, 3, 1], [2028, 2, 29],
];
const vectors = dates.flatMap(([y, m, d]) => {
  const day = dayIndex(y, m, d, data.epoch);
  return Array.from({ length: SLOTS_PER_DAY }, (_, slot) => ({ date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day, slot, ...entry(data.words, day, slot) }));
});
const out = JSON.stringify({ note: "scripts/check-content.mjs üretir; elle düzenlemeyin", vectors }, null, 2) + "\n";
const path = join(contentDir, "test-vectors.json");
if (process.argv.includes("--check")) {
  if (!existsSync(path) || readFileSync(path, "utf8") !== out) {
    console.error("content/test-vectors.json güncel değil: node scripts/check-content.mjs");
    process.exit(1);
  }
} else {
  writeFileSync(path, out);
}
console.log(`içerik tamam: ${data.words.length} kelime, ${data.words.reduce((n, w) => n + w.scenes.length, 0)} sahne`);
