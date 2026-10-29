// Eski cihazlar, farklı ekranlar, erişilebilirlik ve internetsiz çalışma.
import { afterAll, describe, expect, it } from 'vitest';
import { BASE, BROWSER, closeBrowser, closeSheet, getBrowser, mh, open, richState, tapCanvas } from './helpers';

afterAll(closeBrowser);

/** iOS 15 WKWebView ve Chrome 64 WebView'da olmayan API'leri sayfa açılmadan siler. */
const OLD_ENGINE = `
  delete CanvasRenderingContext2D.prototype.roundRect;
  delete window.ResizeObserver;
  delete Object.fromEntries;
  delete Array.prototype.at;
  delete Array.prototype.findLast;
  delete String.prototype.replaceAll;
  delete window.structuredClone;
`;

async function canvasPainted(page: import('playwright').Page) {
  return page.evaluate(() => {
    const c = document.getElementById('scene') as HTMLCanvasElement;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    const colors = new Set<number>();
    for (let i = 0; i < d.length; i += 4 * 97) colors.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    return colors.size;
  });
}

describe('uyumluluk', () => {
  it('eski motorda (iOS 15 / Android WebView 64 eksikleri) oyun hatasız çalışır', async () => {
    const { page, errors, close } = await open({ init: OLD_ENGINE, state: richState() });
    expect(await page.evaluate(() => 'roundRect' in CanvasRenderingContext2D.prototype)).toBe(false);
    await closeSheet(page);
    await page.waitForTimeout(500);
    expect(await canvasPainted(page)).toBeGreaterThan(40);
    // dükkân önizlemeleri ve albüm de roundRect kullanıyor
    await page.locator('.room-tab').nth(1).click();
    await tapCanvas(page, await mh(page, 'g.slotPos(5)'));
    expect(await page.locator('#sheet h2').textContent()).toBe('Mobilya Dükkânı');
    await closeSheet(page);
    await page.locator('#btn-album').click();
    await page.setViewportSize({ width: 360, height: 640 }); // ResizeObserver yerine resize olayı
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => (document.getElementById('scene') as HTMLCanvasElement).width)).toBeGreaterThan(300);
    expect(errors).toEqual([]);
    await close();
  });

  for (const vp of [
    { name: 'iPhone SE (1. nesil)', width: 320, height: 568 },
    { name: 'küçük Android', width: 360, height: 640 },
    { name: 'iPhone 13', width: 390, height: 844 },
    { name: 'iPhone Pro Max', width: 430, height: 932 },
    { name: 'iPad dikey', width: 768, height: 1024 },
    { name: 'tablet yatay', width: 1024, height: 768 },
  ]) {
    it(`${vp.name} ${vp.width}×${vp.height}: taşma yok, her şey ekranda`, async () => {
      const { page, errors, close } = await open({ state: richState(), ctx: { viewport: { width: vp.width, height: vp.height } } });
      await closeSheet(page);
      const r = await page.evaluate(() => {
        const rect = (id: string) => document.getElementById(id)!.getBoundingClientRect();
        const tabs = [...document.querySelectorAll('.room-tab')].map((e) => e.getBoundingClientRect());
        return {
          scrollW: document.documentElement.scrollWidth,
          scrollH: document.documentElement.scrollHeight,
          menuRight: rect('btn-menu').right,
          stageH: rect('stage').height,
          tabsBottom: Math.max(...tabs.map((t) => t.bottom)),
          tabsMinW: Math.min(...tabs.map((t) => t.width)),
        };
      });
      expect(r.scrollW).toBeLessThanOrEqual(vp.width);
      expect(r.scrollH).toBeLessThanOrEqual(vp.height);
      expect(r.menuRight).toBeLessThanOrEqual(vp.width);
      expect(r.tabsBottom).toBeLessThanOrEqual(vp.height);
      expect(r.stageH).toBeGreaterThan(vp.height * 0.4);
      expect(r.tabsMinW).toBeGreaterThan(50);
      // açılır sayfalar da sığmalı ve kapanabilmeli
      await page.locator('#btn-shop').click();
      const sheet = await page.locator('#sheet').boundingBox();
      expect(sheet!.width).toBeLessThanOrEqual(vp.width);
      await page.locator('[data-tab="shop"]').click();
      const tabs = await page.locator('.tabs button').evaluateAll((els) => els.map((e) => e.scrollWidth <= e.clientWidth + 1));
      expect(tabs.every(Boolean)).toBe(true);
      await page.locator('#sheet-close').click();
      expect(errors).toEqual([]);
      await close();
    });
  }

  it('erişilebilirlik: her düğmenin adı var, dokunma hedefleri yeterli, dil etiketi doğru', async () => {
    const { page, close } = await open({ state: richState() });
    await closeSheet(page);
    const issues = await page.evaluate(() => {
      const out: string[] = [];
      for (const b of document.querySelectorAll('button')) {
        const name = (b.getAttribute('aria-label') ?? b.textContent ?? '').trim();
        if (!name) out.push(`adsız düğme: ${b.outerHTML.slice(0, 60)}`);
        const r = b.getBoundingClientRect();
        if (r.width && (r.width < 36 || r.height < 36)) out.push(`küçük hedef ${Math.round(r.width)}×${Math.round(r.height)}: ${name}`);
      }
      return out;
    });
    expect(issues).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('tr');
    expect(await page.locator('[role="dialog"]').count()).toBe(1);
    await close();
  });

  it.runIf(BROWSER === 'chromium')('ilk açılıştan sonra internetsiz de açılır (PWA)', async () => {
    const b = await getBrowser();
    const ctx = await b.newContext({ locale: 'tr-TR', serviceWorkers: 'allow' });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // servis çalışanı bu yüklemeyi önbelleğe alır
    await page.waitForLoadState('networkidle');
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector('#scene');
    expect(await page.title()).toBe('Mırnav Hanı');
    await ctx.close();
  });
});
