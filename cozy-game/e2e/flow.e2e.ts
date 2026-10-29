// Yeni oyuncunun ilk dakikaları: gerçek tarayıcıda, gerçek dokunuşlarla.
import { afterAll, describe, expect, it } from 'vitest';
import { BASE, closeBrowser, closeSheet, fish, mh, open, tapCanvas } from './helpers';

afterAll(closeBrowser);

/** oyun gerçek zamanlı akıyor: test sırasında 1–2 balık daha gelebilir */
const near = (actual: number, expected: number) => {
  expect(actual).toBeGreaterThanOrEqual(expected);
  expect(actual).toBeLessThanOrEqual(expected + 2);
};

describe('ilk oyun akışı', () => {
  it('hoş geldin → hediye → kedi → yerleştir → kazan → mobilya → temizlik → sev', async () => {
    const { page, errors, close } = await open();

    // hoş geldin ve günlük hediye
    await expect(page.locator('#sheet h2').textContent()).resolves.toContain('Mırnav Hanı');
    await page.locator('#daily-btn').click();
    expect(await fish(page)).toBe(100);
    await closeSheet(page);

    // ilk kedi kapıya gelir
    await mh(page, 'g.advance(4)');
    expect(await page.locator('.qcat').count()).toBe(1);
    expect(await page.locator('#hint').isVisible()).toBe(true);

    // kediyi seç, sonra parlayan mindere dokun
    await page.locator('.qcat').click();
    expect(await page.locator('.qcat.sel').count()).toBe(1);
    await tapCanvas(page, await mh(page, "g.seatPos('salon', 1, 0)"));
    expect(await mh<number>(page, 'g.state.guests.length')).toBe(1);
    expect(await mh<number>(page, 'Object.keys(g.state.album).length')).toBe(1);

    // misafir balık kazandırır
    const before = await fish(page);
    await mh(page, 'g.advance(60)');
    expect(await fish(page)).toBeGreaterThan(before);

    // boş alana dokun → dükkân → karton kutu al
    await tapCanvas(page, await mh(page, 'g.slotPos(0)'));
    expect(await page.locator('#sheet h2').textContent()).toBe('Mobilya Dükkânı');
    const f0 = await fish(page);
    await page.locator('#shop-grid .card').nth(1).click(); // Karton Kutu, 25
    await page.locator('#sheet-wrap').waitFor({ state: 'hidden' });
    expect(await mh(page, "g.state.rooms.salon.furniture[0]")).toBe('box');
    near(await fish(page), f0 - 25);

    // dağınıklık çıkar → dokun → temizlenir
    await mh(page, "(g.state.messes.push({ id: 9001, room: 'salon', kind: 'yarn', x: 0.5, y: 0.9 }), 0)");
    const f1 = await fish(page);
    await tapCanvas(page, await mh(page, 'g.messPos(9001)'));
    expect(await mh<boolean>(page, 'g.state.messes.some((m) => m.id === 9001)')).toBe(false);
    expect(await fish(page)).toBeGreaterThan(f1);

    // kediyi sev (balık + mırlama)
    const f2 = await fish(page);
    await tapCanvas(page, await mh(page, "g.seatPos('salon', 1, 0)"));
    near(await fish(page), f2 + 1);
    expect(await page.locator('.floater').count()).toBeGreaterThan(0);

    // mobilyaya dokun → bilgi → boş olanı kaldır, yarı fiyat geri
    await tapCanvas(page, { ...(await mh<{ x: number; y: number }>(page, 'g.slotPos(0)')), y: (await mh<{ y: number }>(page, 'g.slotPos(0)')).y - 10 });
    expect(await page.locator('#remove-btn').isEnabled()).toBe(true);
    const f3 = await fish(page);
    await page.locator('#remove-btn').click();
    near(await fish(page), f3 + 12);

    // kedi ayrılınca kalp ve bahşiş verir, seviye çubuğu dolar
    await mh(page, 'g.advance(400)');
    expect(await mh<number>(page, 'g.state.hearts')).toBeGreaterThan(0);
    expect(await mh<number>(page, 'g.state.served')).toBeGreaterThan(0);

    expect(errors).toEqual([]);
    await close();
  });

  it('seviye atlayınca kutlama ekranı çıkar ve kilitler açılır', async () => {
    const { page, errors, close } = await open();
    await closeSheet(page);
    await mh(page, '(g.state.hearts = 5, g.state.queue.push({ uid: 77, breed: "tekir", name: "A", pref: "sessiz", stay: 5, remaining: 5 }), 0)');
    await mh(page, 'g.advance(1)');
    await page.locator('.qcat').click();
    await page.locator('.qcat').click(); // ikinci dokunuş: otomatik en iyi yer
    await mh(page, 'g.advance(10)');
    expect(await page.locator('#sheet h2').textContent()).toContain('2. seviye');
    expect(errors).toEqual([]);
    await close();
  });

  it('kayıt yeniden açılışta korunur ve uzakta geçen süre hesaplanır', async () => {
    const first = await open();
    await closeSheet(first.page);
    await mh(first.page, 'g.advance(4)');
    await first.page.locator('.qcat').click();
    await first.page.locator('.qcat').click();
    const ctx = first.page.context();
    await first.page.close(); // kapanırken kaydeder
    // bir saat önce ayrılmış gibi göster
    const page = await ctx.newPage();
    await page.goto(`${BASE}/privacy.html`);
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('mirnav-hani-v1')!);
      s.lastSeen = Date.now() - 3600e3;
      localStorage.setItem('mirnav-hani-v1', JSON.stringify(s));
    });
    await page.goto(`${BASE}/?test=1`);
    await page.waitForFunction(() => !!(window as unknown as { __mh?: unknown }).__mh);
    expect(await page.locator('#sheet').textContent()).toContain('yoktun');
    expect(await mh<number>(page, 'g.state.served')).toBeGreaterThan(0);
    expect(await mh<number>(page, 'Object.keys(g.state.album).length')).toBe(1);
    await first.close();
  });
});
