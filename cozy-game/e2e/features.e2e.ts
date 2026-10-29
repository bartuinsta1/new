// Odalar, geliştirmeler, duvar kâğıtları, albüm, dil ve ayarlar.
import { afterAll, describe, expect, it } from 'vitest';
import { BASE, closeBrowser, closeSheet, fish, mh, open, richState } from './helpers';

afterAll(closeBrowser);

describe('özellikler', () => {
  it('oda açma, oda değiştirme, geliştirme ve duvar kâğıdı', async () => {
    const { page, errors, close } = await open({ state: richState() });
    await closeSheet(page);

    // Çatı Katı: seviye 7'de açılabilir, 1500 balık
    await page.locator('.room-tab').nth(2).click();
    expect(await page.locator('#unlock-btn').isEnabled()).toBe(true);
    const f0 = await fish(page);
    await page.locator('#unlock-btn').click();
    expect(await mh(page, 'g.room')).toBe('cati');
    expect(await fish(page)).toBeLessThanOrEqual(f0 - 1500 + 2);
    // Kış Serası: seviye 7 yetiyor ama 4000 balık yok
    await page.locator('.room-tab').nth(3).click();
    expect(await page.locator('#unlock-btn').isDisabled()).toBe(true);
    await closeSheet(page);

    // geliştirme
    await page.locator('.room-tab').nth(0).click();
    await page.locator('#btn-shop').click();
    const upgBtn = page.locator('.upg').first().locator('button');
    await upgBtn.click();
    expect(await mh(page, 'g.state.upgrades.mama')).toBe(1);

    // duvar kâğıdı: satın al ve uygula, sonra varsayılana dön
    await page.locator('[data-tab="paper"]').click();
    await page.locator('#paper-grid .card').nth(1).click(); // Çilek Sütü
    expect(await mh(page, 'g.state.rooms.salon.wallpaper')).toBe('cilek');
    expect(await mh<string[]>(page, 'g.state.wallpapers')).toContain('cilek');
    await page.locator('#paper-grid .card').nth(0).click();
    expect(await mh(page, 'g.state.rooms.salon.wallpaper')).toBeUndefined();
    // özel duvar kâğıdı paket olmadan kilitli → mağaza sekmesine götürür
    await page.locator('#paper-grid .card').last().click();
    expect(await page.locator('[data-tab="shop"].on').count()).toBe(1);
    await closeSheet(page);

    // albüm
    await page.locator('#btn-album').click();
    expect(await page.locator('#album-grid .card').count()).toBe(18);
    expect(await page.locator('#album-grid .card.unknown').count()).toBe(17);
    await closeSheet(page);

    expect(errors).toEqual([]);
    await close();
  });

  it('dil değişir ve yeniden açılışta korunur; ses ayarları kalıcı', async () => {
    const { page, errors, close } = await open({ state: richState() });
    await closeSheet(page);
    await page.locator('#btn-menu').click();
    await page.locator('[data-lang="en"]').click();
    expect(await page.locator('#sheet h2').textContent()).toBe('Inn Journal');
    expect(await page.locator('#door-label').textContent()).toBe('At door');
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
    await page.locator('#opt-music').uncheck();
    await page.locator('#opt-sfx').uncheck();
    await closeSheet(page);
    await page.reload();
    await page.waitForFunction(() => !!(window as unknown as { __mh?: unknown }).__mh);
    expect(await page.title()).toBe('Snowpaw Inn');
    expect(await mh(page, 'g.state.settings')).toEqual({ music: false, sfx: false, lang: 'en' });
    expect(await page.locator('.room-tab').first().textContent()).toContain('Living Room');
    expect(errors).toEqual([]);
    await close();
  });

  it('İngilizce telefonda oyun İngilizce açılır', async () => {
    const { page, close } = await open({ ctx: { locale: 'en-GB' } });
    expect(await page.locator('#sheet h2').textContent()).toBe('Welcome to Snowpaw Inn');
    await close();
  });

  it('gizlilik sayfası açılır ve iki dili içerir', async () => {
    const { page, close } = await open();
    await page.goto(`${BASE}/privacy.html`);
    const text = await page.textContent('body');
    expect(text).toContain('Gizlilik Politikası');
    expect(text).toContain('Privacy Policy');
    expect(text).toContain('Ödeme bilgilerini biz görmeyiz');
    expect(text).toContain('Restore purchases');
    await close();
  });
});
