#!/usr/bin/env node
// Bir bölüm videosundan widget arka planı olacak sahne karelerini çıkarır.
//
//   node scripts/extract-scenes.mjs <video> <bölüm-no> [--times 0,10,22.5] [--max 6]
//
// - --times verilmezse ffmpeg sahne geçişlerini bulur, her geçişten 0.8 sn sonrasını alır
//   (yazı animasyonu oturmuş olur) ve aralarından en fazla --max tanesini eşit aralıkla seçer.
// - Kare, altyazı kartının ÜSTÜNDE kalan kare bölgeden kırpılır (1080x1920 videoda y≈70..1150),
//   böylece widget'taki kendi kartımızla çakışan yazı kalmaz. Son 4 saniye (kapanış kartı) atlanır.
// - Çıktı: content/scenes/<no>-<k>.jpg (1080x1080) ve words.json'daki "scenes" listesi güncellenir.
//
// En temiz sonuç için: kurgu programından altyazısız sahne kareleri dışa aktarıp
// content/scenes/<no>-<k>.jpg adıyla koymak ve `node scripts/sync-content.mjs` çalıştırmak yeterli.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const timesArg = opt("times");
const max = Number(opt("max") ?? 6);
const [video, noArg] = args;
const no = Number(noArg);
if (!video || !Number.isInteger(no) || no < 1) {
  console.error("kullanım: node scripts/extract-scenes.mjs <video> <bölüm-no> [--times 0,10] [--max 6]");
  process.exit(1);
}

const probe = (entries) => execFileSync("ffprobe", ["-v", "error", "-show_entries", entries, "-of", "csv=p=0", video]).toString().trim();
const duration = Number(probe("format=duration"));
const [width, height] = probe("stream=width,height").split("\n")[0].split(",").map(Number);

function sceneCuts() {
  const out = execFileSync("ffmpeg", [
    "-hide_banner", "-i", video, "-vf", "select='gt(scene,0.2)',showinfo", "-an", "-f", "null", "-",
  ], { stdio: ["ignore", "ignore", "pipe"] }).toString();
  return [...out.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
}

let times;
if (timesArg) {
  times = timesArg.split(",").map(Number);
} else {
  const cuts = [0, ...sceneCuts()].map((t) => t + 0.8).filter((t) => t < duration - 4);
  // Birbirine 2 sn'den yakın geçişleri tek say (yazı animasyonu da sahne geçişi sanılabiliyor).
  const distinct = cuts.filter((t, i) => i === 0 || t - cuts[i - 1] > 2);
  const step = Math.max(1, distinct.length / max);
  times = Array.from({ length: Math.min(max, distinct.length) }, (_, i) => distinct[Math.floor(i * step)]);
}

// Altyazı kartı 1920 yüksekliğin ~%61'inde başlıyor; kare bölge onun hemen üstünde biter.
const side = Math.min(width, Math.round(height * 0.5625));
const bottom = Math.round(height * 0.6);
const top = Math.max(0, bottom - side);
const pad = String(no).padStart(2, "0");
const outDir = join(root, "content", "scenes");
mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (f.startsWith(`${pad}-`)) unlinkSync(join(outDir, f));

const scenes = times.map((t, i) => {
  const name = `${pad}-${i + 1}.jpg`;
  execFileSync("ffmpeg", [
    "-v", "error", "-y", "-ss", String(t), "-i", video, "-frames:v", "1",
    "-vf", `crop=${side}:${side}:${Math.round((width - side) / 2)}:${top},scale=1080:1080`,
    "-q:v", "3", join(outDir, name),
  ]);
  return `scenes/${name}`;
});

const wordsPath = join(root, "content", "words.json");
const data = JSON.parse(readFileSync(wordsPath, "utf8"));
const word = data.words.find((w) => w.no === no);
if (!word) throw new Error(`words.json içinde ${no} numaralı bölüm yok`);
word.scenes = scenes;
writeFileSync(wordsPath, JSON.stringify(data, null, 2) + "\n");
console.log(`${word.word}: ${scenes.length} sahne → ${scenes.join(", ")} (zamanlar: ${times.map((t) => t.toFixed(1)).join(", ")})`);
