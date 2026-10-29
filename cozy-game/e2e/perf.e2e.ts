// Performans: kare süresi, bellek sızıntısı ve paket boyutu bütçeleri.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';
import { BROWSER, closeBrowser, closeSheet, open, richState } from './helpers';

afterAll(closeBrowser);

describe('performans', () => {
  it('dolu bir odada kareler akıcı (60 fps hedefi)', async () => {
    const { page, close } = await open({ state: richState() });
    await closeSheet(page);
    const frames = await page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const out: number[] = [];
          let last = performance.now();
          const step = (now: number) => {
            out.push(now - last);
            last = now;
            if (out.length < 240) requestAnimationFrame(step);
            else resolve(out.slice(10));
          };
          requestAnimationFrame(step);
        }),
    );
    frames.sort((a, b) => a - b);
    const median = frames[Math.floor(frames.length / 2)];
    const p95 = frames[Math.floor(frames.length * 0.95)];
    console.log(`kare süresi: medyan ${median.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms`);
    // başsız tarayıcı yazılımla çizer; gerçek telefonda GPU ile çok daha hızlı
    expect(median).toBeLessThan(34);
    expect(p95).toBeLessThan(80);
    await close();
  });

  it('çizim süresi kare başına bütçe içinde', async () => {
    const { page, close } = await open({ state: richState() });
    await closeSheet(page);
    // rAF döngüsünün tek bir karesinin JS süresi
    const ms = await page.evaluate(async () => {
      const samples: number[] = [];
      const orig = window.requestAnimationFrame.bind(window);
      await new Promise<void>((done) => {
        let n = 0;
        window.requestAnimationFrame = (cb) =>
          orig((t) => {
            const a = performance.now();
            cb(t);
            samples.push(performance.now() - a);
            if (++n === 120) { window.requestAnimationFrame = orig; done(); }
          });
      });
      samples.sort((a, b) => a - b);
      return samples[Math.floor(samples.length / 2)];
    });
    console.log(`kare başına JS+çizim: ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThan(12);
    await close();
  });

  it.runIf(BROWSER === 'chromium')('uzun oturumda bellek büyümüyor', async () => {
    const { page, close } = await open({ state: richState() });
    await closeSheet(page);
    const heap = () => page.evaluate(() => (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize);
    await page.waitForTimeout(1500);
    const a = await heap();
    // 20 dakikalık oyunu hızlı sar + gerçek zamanlı 8 sn
    await page.evaluate(() => (window as unknown as { __mh: { advance: (n: number) => void } }).__mh.advance(1200));
    await page.waitForTimeout(8000);
    const b = await heap();
    console.log(`bellek: ${(a / 1e6).toFixed(1)} MB → ${(b / 1e6).toFixed(1)} MB`);
    expect(b - a).toBeLessThan(8e6);
    expect(await page.locator('.floater').count()).toBeLessThan(40); // uçan yazılar temizleniyor
    await close();
  });

  it('paket boyutu bütçesi', () => {
    const dir = join(__dirname, '..', 'dist', 'assets');
    const files = readdirSync(dir);
    const gz = (f: string) => gzipSync(readFileSync(join(dir, f))).length;
    const mainJs = files.filter((f) => f.endsWith('.js')).map(gz).sort((a, b) => b - a)[0];
    const total = files.reduce((n, f) => n + statSync(join(dir, f)).size, 0);
    console.log(`en büyük JS (gzip): ${(mainJs / 1024).toFixed(1)} KB, assets toplam: ${(total / 1024).toFixed(1)} KB`);
    expect(mainJs).toBeLessThan(60 * 1024);
    expect(total).toBeLessThan(300 * 1024);
  });
});
