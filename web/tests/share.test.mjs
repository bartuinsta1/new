// Paylaşım önizleme sayfası (web/s/index.html) — gerçek tarayıcıda (Playwright, Chromium).
// Çalıştırma: node --test web/tests/share.test.mjs   (Playwright kurulu olmalı: npx playwright install chromium)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(here, "../s/index.html"), "utf8")
  .replace('content="https://YOUR-PROJECT.supabase.co/functions/v1"', 'content="/api"');
const { chromium } = await import("playwright").catch(() => import("/opt/node22/lib/node_modules/playwright/index.mjs"));

const SHARES = {
  "tok_valid_000000000001": { status: 200, body: {
    title: "Ela ve Uykucu Ay", language: "tr", region: "star_hill", preview_audio_url: null,
    app_store_url: "https://apps.apple.com/tr/app/masalcik/id0000000000", invite_code: "PMK7QX",
    paragraphs: ["Bir varmış bir yokmuş, Ela adında bir kız varmış.", "İkinci paragraf.", "Üçüncü paragraf."] } },
  "tok_english_00000000001": { status: 200, body: {
    title: "Robin and the Sleepy Moon", language: "en", region: "star_hill", preview_audio_url: null,
    app_store_url: "https://apps.apple.com/app/masalcik", invite_code: null, paragraphs: ["Once upon a time."] } },
  "tok_xss_000000000000001": { status: 200, body: {
    title: "<img src=x onerror=window.__pwned=1>", language: "tr", region: "star_hill", preview_audio_url: null,
    app_store_url: "javascript:alert(1)", invite_code: "<b>X</b>", paragraphs: ["<script>window.__pwned=1</script>"] } },
  "tok_expired_00000000001": { status: 410, body: { error: "expired" } },
};

let server, browser, base;
before(async () => {
  server = createServer((req, res) => {
    if (req.url.startsWith("/api/share/")) {
      const s = SHARES[decodeURIComponent(req.url.slice("/api/share/".length))] ?? { status: 404, body: { error: "not_found" } };
      res.writeHead(s.status, { "content-type": "application/json" });
      return res.end(JSON.stringify(s.body));
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  }).listen(0);
  base = `http://localhost:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

async function open(pathname, locale = "tr-TR") {
  const ctx = await browser.newContext({ locale });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(base + pathname);
  return page;
}

test("masal: başlık, ilk iki paragraf (+ soluk üçüncü), davet kodu, App Store bağlantısı", async () => {
  const page = await open("/s/tok_valid_000000000001");
  await page.waitForSelector("h1");
  assert.equal(await page.textContent("h1"), "Ela ve Uykucu Ay");
  assert.equal(await page.locator(".story p").count(), 3);
  assert.equal(await page.locator(".story p.faded").count(), 1);
  assert.equal(await page.textContent("#code"), "PMK7QX");
  assert.equal(await page.getAttribute("a.btn.store", "href"), "https://apps.apple.com/tr/app/masalcik/id0000000000");
  assert.equal(await page.getAttribute("html", "lang"), "tr");
  assert.match(await page.textContent(".safe"), /yapay zekâyla üretilir/);
});

test("İngilizce masal İngilizce arayüzle; davet kodu yoksa kod kutusu yok", async () => {
  const page = await open("/s/tok_english_00000000001", "en-GB");
  await page.waitForSelector("h1");
  assert.equal(await page.getAttribute("html", "lang"), "en");
  assert.match(await page.textContent("#listenLabel"), /Listen/);
  assert.equal(await page.locator("#code").count(), 0);
});

test("XSS: başlık, paragraf ve kod metin olarak basılır; javascript: bağlantısı çalışmaz", async () => {
  const page = await open("/s/tok_xss_000000000000001");
  await page.waitForSelector("h1");
  assert.equal(await page.textContent("h1"), "<img src=x onerror=window.__pwned=1>");
  assert.equal(await page.locator(".story img, .story script, #code b").count(), 0);
  assert.equal(await page.evaluate(() => window.__pwned), undefined);
  const href = await page.getAttribute("a.btn.store", "href");
  assert.ok(!href.startsWith("javascript:"), `güvensiz bağlantı: ${href}`);
});

test("süresi dolmuş, bilinmeyen ve bozuk jeton: dostça mesaj", async () => {
  for (const [p, re] of [["/s/tok_expired_00000000001", /süresi dolmuş/], ["/s/tok_unknown_0000000001", /bulunamadı/],
                         ["/s/<script>", /bulunamadı/]]) {
    const page = await open(p);
    await page.waitForSelector(".state");
    assert.match(await page.textContent(".state"), re, p);
  }
});
