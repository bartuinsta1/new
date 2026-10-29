import { describe, expect, it } from 'vitest';
import { PRODUCTS, SUPPORTER_INCOME } from '../src/data';
import {
  bestSeatFor, buyFurniture, catIncome, catchUp, grantPurchase, newGame, offlineCap, OFFLINE_CAP, owns, placeCat, tick,
  useWallpaper,
} from '../src/game';

const half = () => 0.5;

describe('uygulama içi satın alma', () => {
  it('balık paketi her yeni işlemde balık verir', () => {
    const s = newGame(0);
    expect(grantPurchase(s, 'mh_fish_small', 't1')).toEqual({ product: 'mh_fish_small', fish: 1200, unlocked: false });
    expect(grantPurchase(s, 'mh_fish_small', 't2')?.fish).toBe(1200);
    expect(s.fish).toBe(40 + 2400);
  });

  it('aynı işlem ikinci kez ödüllendirilmez (yeniden başlatma, geri yükleme, mağaza tekrarı)', () => {
    const s = newGame(0);
    grantPurchase(s, 'mh_fish_large', 'abc');
    expect(grantPurchase(s, 'mh_fish_large', 'abc')).toBeNull();
    expect(s.fish).toBe(40 + 20000);
  });

  it('bilinmeyen ürün yok sayılır', () => {
    const s = newGame(0);
    expect(grantPurchase(s, 'hile_urunu', 'x')).toBeNull();
    expect(s.fish).toBe(40);
  });

  it('kalıcı paket bir kez açılır; geri yüklemede hediye tekrar verilmez', () => {
    const s = newGame(0);
    expect(grantPurchase(s, 'mh_winter_pack', 'w1')).toEqual({ product: 'mh_winter_pack', fish: 2000, unlocked: true });
    expect(grantPurchase(s, 'mh_winter_pack', 'w-restore')).toEqual({ product: 'mh_winter_pack', fish: 0, unlocked: false });
    expect(s.owned).toEqual(['mh_winter_pack']);
    expect(s.fish).toBe(2040);
  });

  it('Kış paketi özel mobilya ve duvar kâğıdını açar', () => {
    const s = newGame(0);
    s.fish = 1000;
    expect(buyFurniture(s, 'salon', 0, 'snowglobe')).toBe('locked');
    expect(useWallpaper(s, 'salon', 'aurora')).toBe('locked');
    grantPurchase(s, 'mh_winter_pack', 'w1');
    expect(buyFurniture(s, 'salon', 0, 'snowglobe')).toBe('ok');
    expect(useWallpaper(s, 'salon', 'aurora')).toBe('applied');
    expect(s.rooms.salon.wallpaper).toBe('aurora');
  });

  it('Han Dostu kalıcı gelir çarpanı ve 24 saat çevrimdışı verir', () => {
    const s = newGame(0);
    tick(s, 3, half, 10);
    const cat = s.queue[0];
    placeCat(s, cat.uid, bestSeatFor(s, cat)!);
    const before = catIncome(s, s.guests[0]);
    expect(offlineCap(s)).toBe(OFFLINE_CAP);
    grantPurchase(s, 'mh_supporter', 's1');
    expect(owns(s, 'mh_supporter')).toBe(true);
    expect(catIncome(s, s.guests[0])).toBeCloseTo(before * SUPPORTER_INCOME);
    expect(offlineCap(s)).toBe(24 * 3600);
    expect(catchUp(s, 48 * 3600 * 1000, half, 10).seconds).toBe(24 * 3600);
  });

  it('işlem hafızası sınırlı kalır', () => {
    const s = newGame(0);
    for (let i = 0; i < 1000; i++) grantPurchase(s, 'mh_fish_small', `t${i}`);
    expect(s.txns.length).toBeLessThanOrEqual(300);
    expect(s.fish).toBe(40 + 1000 * 1200);
  });

  it('her ürün tanımlı ve işlenebilir', () => {
    for (const p of PRODUCTS) {
      const s = newGame(0);
      expect(grantPurchase(s, p.id, 'x')?.fish).toBe(p.fish);
    }
  });
});
