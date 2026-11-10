#!/usr/bin/env node
// content/sozluk/*.tsv + words.json (50 bölüm) → content/dictionary.json
//   node scripts/build-dictionary.mjs           → üret
//   node scripts/build-dictionary.mjs --check   → dosya güncel mi (CI)
// Sıra: günlük "sözlükten bir kelime" için diller karışık gelsin diye sabit tohumlu karıştırma.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fold, tokens } from "./lib/muse.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const content = join(root, "content");
const episodes = JSON.parse(readFileSync(join(content, "words.json"), "utf8")).words;

const errors = [];
const entries = [];
const seen = new Map();
const keyOf = (w) => tokens(w).join(" ");
const slug = (w) => fold(w).replace(/[çğışöü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ş: "s", ö: "o", ü: "u" })[c])
  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function add(e, where) {
  const key = keyOf(e.word);
  if (!key) { errors.push(`${where}: boş kelime`); return; }
  if (seen.has(key)) { errors.push(`${where}: "${e.word}" zaten var (${seen.get(key)})`); return; }
  seen.set(key, where);
  entries.push(e);
}

for (const w of episodes) {
  add({ id: `b-${w.slug}`, word: w.word, origin: w.origin, meaning: w.meaning, triggers: w.triggers ?? [], episode: w.no }, `bölüm ${w.no}`);
}

const files = readdirSync(join(content, "sozluk")).filter((f) => f.endsWith(".tsv")).sort();
for (const f of files) {
  readFileSync(join(content, "sozluk", f), "utf8").split("\n").forEach((line, i) => {
    if (!line.trim() || line.startsWith("#")) return;
    const where = `${f}:${i + 1}`;
    const [word, origin, meaning, trig = ""] = line.split("|").map((s) => s.trim());
    if (!word || !origin || !meaning) { errors.push(`${where}: kelime | köken | anlam gerekli`); return; }
    if (meaning.length > 130) errors.push(`${where}: anlam 130 karakteri aşıyor`);
    const triggers = trig.split(",").map((t) => t.trim()).filter(Boolean);
    for (const t of triggers) if (tokens(t).join("").length < 3) errors.push(`${where}: tetikleyici çok kısa: "${t}"`);
    add({ id: slug(word), word, origin, meaning, triggers }, where);
  });
}

const ids = new Set();
for (const e of entries) {
  if (ids.has(e.id)) errors.push(`kimlik çakışması: ${e.id}`);
  ids.add(e.id);
}

// Gündelik kelimeler: klavye bunlar için konuşmaz.
const common = readFileSync(join(content, "sozluk", "yaygin.txt"), "utf8").split("\n")
  .filter((l) => !l.startsWith("#")).flatMap((l) => l.split(",")).map((w) => keyOf(w.trim())).filter(Boolean);
const byKey = new Map(entries.map((e) => [keyOf(e.word), e]));
for (const k of new Set(common)) {
  const e = byKey.get(k);
  if (!e) errors.push(`yaygin.txt: sözlükte yok: ${k}`);
  else e.common = true;
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

// Sabit tohumlu karıştırma (mulberry32) — her derlemede aynı sıra.
let seed = 20261109;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const ordered = [...entries].sort((a, b) => a.id.localeCompare(b.id));
for (let i = ordered.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
}

const out = JSON.stringify({ note: "scripts/build-dictionary.mjs üretir; content/sozluk/*.tsv düzenleyin", count: ordered.length, entries: ordered }) + "\n";
const path = join(content, "dictionary.json");
if (process.argv.includes("--check")) {
  if (!existsSync(path) || readFileSync(path, "utf8") !== out) {
    console.error("content/dictionary.json güncel değil: node scripts/build-dictionary.mjs");
    process.exit(1);
  }
} else {
  writeFileSync(path, out);
}
const byOrigin = {};
for (const e of entries) {
  const o = e.origin.split(/[ (+]/)[0];
  byOrigin[o] = (byOrigin[o] ?? 0) + 1;
}
console.log(`sözlük: ${entries.length} kelime, ${entries.filter((e) => e.triggers.length).length} tanesinde tetikleyici`);
console.log(Object.entries(byOrigin).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", "));
