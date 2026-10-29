// Mağaza görsellerini oyundan üretir: iOS (1290×2796), Google Play (1080×1920), Play tanıtım görseli
// (1024×500) ve Play ikonu (512×512). Kullanım: npm run build && node scripts/store-assets.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { preview } from 'vite';

const PORT = 4190;
const BASE = `http://127.0.0.1:${PORT}`;
const out = (p) => `fastlane/${p}`;

const server = await preview({ preview: { port: PORT, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' });
const browser = await chromium.launch();

function state(lang) {
  const today = new Date();
  const g = (room, slot, seat, breed, pref, i) => ({ uid: 200 + i, breed, name: 'x', pref, stay: 3000, remaining: 3000, room, slot, seat });
  return {
    v: 1, fish: 2840, hearts: 210, totalFish: 0, nextId: 500, catTimer: 999, messTimer: 999, lastSeen: Date.now(),
    lastDaily: `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`, cleaned: 40, served: 60, tutorial: 9,
    upgrades: { mama: 4, supurge: 3, zil: 2 }, wallpapers: ['kar', 'gece', 'cilek'], owned: [], txns: [],
    settings: { music: false, sfx: false, lang },
    queue: [
      { uid: 90, breed: 'kartopu', name: 'Bulut', pref: 'sicak', stay: 300, remaining: 300 },
      { uid: 91, breed: 'van', name: 'Lokum', pref: 'manzara', stay: 300, remaining: 300 },
    ],
    messes: [{ id: 900, room: 'salon', kind: 'yarn', x: 0.62, y: 0.68 }],
    album: { tekir: 3, sarman: 2, kara: 2, van: 1, kartopu: 1, siyam: 2, pamuk: 1, calico: 2, findik: 1, scottish: 1, ankara: 1, mainecoon: 1 },
    rooms: {
      salon: { furniture: ['tree', 'fireplace', 'windowbed', 'sofa', 'lamp', 'radiator'] },
      mutfak: { furniture: ['box', 'cocoa', 'basket', 'plant', 'igloo', 'box'], wallpaper: 'cilek' },
      cati: { furniture: ['bookshelf', 'hammock', 'plant', 'sofa', 'lamp', 'cushion'], wallpaper: 'gece' },
      sera: { furniture: ['plant', 'fireplace', 'plant', 'basket', 'windowbed', 'igloo'] },
    },
    guests: [
      g('salon', 0, 0, 'calico', 'oyun', 0), g('salon', 0, 1, 'siyam', 'oyun', 1), g('salon', 1, 0, 'sarman', 'sicak', 2),
      g('salon', 1, 1, 'pamuk', 'sicak', 3), g('salon', 2, 0, 'kara', 'manzara', 4), g('salon', 3, 0, 'mainecoon', 'sessiz', 5),
      g('salon', 3, 1, 'tekir', 'sessiz', 6), g('salon', 5, 0, 'scottish', 'sicak', 7),
      g('cati', 0, 0, 'gece', 'sessiz', 8), g('cati', 1, 0, 'ankara', 'manzara', 9), g('cati', 3, 0, 'findik', 'sessiz', 10),
      g('cati', 3, 1, 'bal', 'sessiz', 11), g('cati', 5, 0, 'duman', 'sessiz', 12),
    ],
  };
}

async function shots(lang, viewport, dir) {
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: lang === 'tr' ? 'tr-TR' : 'en-US' });
  const page = await ctx.newPage();
  const go = async (hour) => {
    await page.goto(`${BASE}/privacy.html`);
    await page.evaluate((s) => localStorage.setItem('mirnav-hani-v1', JSON.stringify(s)), state(lang));
    await page.goto(`${BASE}/?month=10&hour=${hour}`);
    await page.waitForTimeout(500);
    if (await page.locator('[data-close]').count()) await page.click('[data-close]');
    await page.waitForTimeout(900);
  };
  await go(13);
  await page.screenshot({ path: `${dir}/1.png` });
  await go(22);
  await page.click('.room-tab:nth-child(3)');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${dir}/2.png` });
  await page.click('.room-tab:nth-child(1)');
  await page.click('.qcat');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${dir}/3.png` });
  await page.click('#btn-album');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/4.png` });
  await ctx.close();
}

async function featureGraphic(lang, file) {
  // oyunun gece salonu + başlık
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 500 }, locale: lang === 'tr' ? 'tr-TR' : 'en-US' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/privacy.html`);
  await page.evaluate((s) => localStorage.setItem('mirnav-hani-v1', JSON.stringify(s)), state(lang));
  await page.goto(`${BASE}/?month=10&hour=21`);
  await page.waitForTimeout(500);
  if (await page.locator('[data-close]').count()) await page.click('[data-close]');
  await page.waitForTimeout(800);
  const scene = await page.evaluate(() => document.getElementById('scene').toDataURL('image/png'));
  const title = lang === 'tr' ? 'Mırnav Hanı' : 'Snowpaw Inn';
  const tag = lang === 'tr' ? 'Kediler için sıcacık bir kış hanı' : 'A cozy winter inn for cats';
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:0;width:1024px;height:500px;overflow:hidden;background:#3b2b25;font-family:ui-rounded,system-ui,sans-serif}
    .bg{position:absolute;right:0;top:0;height:500px;width:620px;background:url(${scene}) center/cover;border-radius:0 0 0 40px}
    .fade{position:absolute;left:0;top:0;width:560px;height:500px;background:linear-gradient(90deg,#3b2b25 70%,rgba(59,43,37,0))}
    .t{position:absolute;left:56px;top:150px;color:#fff7ec}
    h1{font-size:76px;margin:0 0 12px;letter-spacing:-1px} p{font-size:30px;margin:0;color:#f2c14e;font-weight:700}
  </style><div class="bg"></div><div class="fade"></div><div class="t"><h1>${title}</h1><p>${tag}</p></div>`);
  await page.screenshot({ path: file });
  await ctx.close();
}

for (const [lang, ios, play] of [['tr', 'tr', 'tr-TR'], ['en', 'en-US', 'en-US']]) {
  await shots(lang, { width: 430, height: 932 }, out(`screenshots/ios/${ios}`)); // 1290×2796 (6,9")
  await shots(lang, { width: 360, height: 640 }, out(`metadata/android/${play}/images/phoneScreenshots`)); // 1080×1920
  await featureGraphic(lang, out(`metadata/android/${play}/images/featureGraphic.png`));
  // Play kendi köşe maskesini uygular: kare ikon
  const iconPage = await browser.newPage({ viewport: { width: 512, height: 512 } });
  const png = readFileSync('assets/icon-only.png').toString('base64');
  await iconPage.setContent(`<style>body{margin:0}</style><img src="data:image/png;base64,${png}" width="512" height="512">`);
  await iconPage.waitForTimeout(200);
  await iconPage.screenshot({ path: out(`metadata/android/${play}/images/icon.png`) });
  await iconPage.close();
}

await browser.close();
await new Promise((r) => server.httpServer.close(r));
console.log('mağaza görselleri hazır: fastlane/');
