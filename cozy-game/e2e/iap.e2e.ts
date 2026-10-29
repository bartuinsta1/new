// Uygulama içi satın almalar: sahte mağaza (?store=mock) ile gerçek arayüz akışı.
import { afterAll, describe, expect, it } from 'vitest';
import { closeBrowser, closeSheet, fish, mh, open, richState, tapCanvas } from './helpers';

afterAll(closeBrowser);

const MOCK = '?test=1&store=mock';

describe('mağaza', () => {
  it('balık simgesi mağazayı açar; fiyatlar mağazadan gelir', async () => {
    const { page, errors, close } = await open({ path: MOCK, state: richState() });
    await closeSheet(page);
    await page.locator('#fish-pill').click();
    expect(await page.locator('[data-tab="shop"].on').count()).toBe(1);
    await page.locator('.iap button:not([disabled])').first().waitFor();
    const prices = await page.locator('.iap button').allTextContents();
    expect(prices.map((p) => p.trim())).toEqual(['₺39,99', '₺179,99', '₺399,99', '₺129,99', '₺219,99']);
    expect(await page.locator('#restore-btn').isVisible()).toBe(true);
    expect(errors).toEqual([]);
    await close();
  });

  it('balık paketi alınır; iptal edilen satın alma hiçbir şey vermez', async () => {
    const { page, errors, close } = await open({ path: `${MOCK}&mockfail=mh_fish_large`, state: richState() });
    await closeSheet(page);
    await page.locator('#fish-pill').click();
    await page.locator('.iap[data-product="mh_fish_small"] button:not([disabled])').waitFor();
    const f0 = await fish(page);
    await page.locator('.iap[data-product="mh_fish_small"] button').click();
    await page.waitForFunction((f) => (window as unknown as { __mh: { state: { fish: number } } }).__mh.state.fish >= f + 1200, f0);
    expect(await mh<number>(page, 'g.state.txns.length')).toBe(1);
    const f1 = await fish(page);
    await page.locator('.iap[data-product="mh_fish_large"] button').click();
    await page.waitForTimeout(300);
    expect(await fish(page)).toBeLessThan(f1 + 100);
    expect(errors).toEqual([]);
    await close();
  });

  it('Kış paketi: özel mobilya ve duvar kâğıdı açılır, buton "Sende var" olur', async () => {
    const { page, errors, close } = await open({ path: MOCK, state: richState() });
    await closeSheet(page);
    await page.locator('#fish-pill').click();
    const btn = page.locator('.iap[data-product="mh_winter_pack"] button');
    await page.locator('.iap[data-product="mh_winter_pack"] button:not([disabled])').waitFor();
    await btn.click();
    await page.waitForFunction(() => (window as unknown as { __mh: { state: { owned: string[] } } }).__mh.state.owned.includes('mh_winter_pack'));
    expect(await btn.isDisabled()).toBe(true);
    expect((await btn.textContent())?.trim()).toBe('Sende var ✓');
    // özel duvar kâğıdı uygulanabilir
    await page.locator('[data-tab="paper"]').click();
    await page.locator('#paper-grid .card').last().click();
    expect(await mh(page, 'g.state.rooms.salon.wallpaper')).toBe('aurora');
    await closeSheet(page);
    // Mutfakta boş alan → Kar Küresi alınabilir
    await page.locator('.room-tab').nth(1).click();
    await tapCanvas(page, await mh(page, 'g.slotPos(5)'));
    const card = page.locator('#shop-grid .card').last();
    expect(await card.locator('.lock').count()).toBe(0);
    await card.click();
    expect(await mh(page, 'g.state.rooms.mutfak.furniture[5]')).toBe('snowglobe');
    expect(errors).toEqual([]);
    await close();
  });

  it('Han Dostu rozeti ayarlarda görünür; sıfırlama satın alımları silmez', async () => {
    const { page, errors, close } = await open({ path: MOCK, state: richState() });
    await closeSheet(page);
    await page.locator('#fish-pill').click();
    await page.locator('.iap[data-product="mh_supporter"] button:not([disabled])').waitFor();
    await page.locator('.iap[data-product="mh_supporter"] button').click();
    await page.waitForFunction(() => (window as unknown as { __mh: { state: { owned: string[] } } }).__mh.state.owned.includes('mh_supporter'));
    await closeSheet(page);
    await page.locator('#btn-menu').click();
    expect(await page.locator('#sheet').textContent()).toContain('Han Dostu');
    page.once('dialog', (d) => void d.accept());
    await page.locator('#reset-btn').click();
    expect(await mh<string[]>(page, 'g.state.owned')).toEqual(['mh_supporter']);
    expect(await mh<number>(page, 'g.state.hearts')).toBe(0);
    // geri yükleme: zaten sahip → "bulunamadı"
    await closeSheet(page);
    await page.locator('#fish-pill').click();
    await page.locator('#restore-btn').click();
    expect(await page.locator('#toast').textContent()).toContain('Geri yüklenecek paket bulunamadı');
    expect(errors).toEqual([]);
    await close();
  });

  it('web sürümünde satın alma kapalı, uygulamaya yönlendirir', async () => {
    const { page, errors, close } = await open({ state: richState() });
    await closeSheet(page);
    expect(await mh(page, 'g.storeKind')).toBe('none');
    await page.locator('#btn-shop').click();
    await page.locator('[data-tab="shop"]').click();
    expect(await page.locator('#upg-body').textContent()).toContain('App Store ve Google Play');
    expect(await page.locator('.iap button:not([disabled])').count()).toBe(0);
    expect(await page.locator('#restore-btn').count()).toBe(0);
    expect(errors).toEqual([]);
    await close();
  });
});
