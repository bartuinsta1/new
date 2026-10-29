import { describe, expect, it } from 'vitest';
import {
  BREEDS, FURNITURE, LEVEL_HEARTS, PRODUCTS, ROOMS, UPGRADES, WALLPAPERS, CAT_NAMES, MESS_KINDS,
} from '../src/data';
import { seatPoints } from '../src/draw';
import { availableBreeds } from '../src/game';

const hex = /^#[0-9a-f]{6}$/i;
const unique = (xs: string[]) => new Set(xs).size === xs.length;

describe('veri tutarlılığı', () => {
  it('tüm kimlikler benzersiz', () => {
    for (const list of [BREEDS, FURNITURE, ROOMS, UPGRADES, WALLPAPERS, PRODUCTS] as { id: string }[][]) {
      expect(unique(list.map((x) => x.id))).toBe(true);
    }
  });

  it('her oturulabilir mobilyanın koltuk sayısı kadar oturma noktası var', () => {
    for (const f of FURNITURE) {
      expect(seatPoints(f), f.id).toHaveLength(f.seats);
      expect(f.price).toBeGreaterThanOrEqual(0);
      expect(f.comfort).toBeGreaterThan(0);
      expect(f.color).toMatch(hex);
      expect(f.accent).toMatch(hex);
    }
  });

  it('kedi renkleri geçerli', () => {
    for (const b of BREEDS) {
      for (const c of [b.base, b.patch, b.stripes, b.belly, ...b.eyes]) if (c) expect(c, b.id).toMatch(hex);
      for (const m of b.months ?? []) expect(m).toBeGreaterThanOrEqual(0);
    }
  });

  it('her ay ve her seviyede gelebilecek en az bir kedi var', () => {
    for (let lvl = 1; lvl <= LEVEL_HEARTS.length; lvl++)
      for (let month = 0; month < 12; month++) expect(availableBreeds(lvl, month).length).toBeGreaterThan(0);
  });

  it('mevsimlik kediler sadece kendi aylarında gelir', () => {
    expect(availableBreeds(12, 10).some((b) => b.id === 'kartopu')).toBe(true);
    expect(availableBreeds(12, 6).some((b) => b.id === 'kartopu')).toBe(false);
  });

  it('seviye eşikleri artan', () => {
    for (let i = 1; i < LEVEL_HEARTS.length; i++) expect(LEVEL_HEARTS[i]).toBeGreaterThan(LEVEL_HEARTS[i - 1]);
  });

  it('odalar 6 alanlı ve alanlar sahnenin içinde', () => {
    for (const r of ROOMS) {
      expect(r.slots).toHaveLength(6);
      for (const s of r.slots) {
        expect(s.x).toBeGreaterThan(0);
        expect(s.x).toBeLessThan(1);
        expect(s.y).toBeGreaterThan(0.47);
        expect(s.y).toBeLessThan(1);
      }
    }
  });

  it('özel ürünler var olan bir pakete bağlı', () => {
    const ids = new Set(PRODUCTS.map((p) => p.id));
    for (const x of [...FURNITURE, ...WALLPAPERS]) if (x.exclusive) expect(ids.has(x.exclusive)).toBe(true);
  });

  it('ürünler mağaza kurallarına uygun kimlikte', () => {
    for (const p of PRODUCTS) {
      expect(p.id).toMatch(/^[a-z0-9_.]{1,100}$/); // Play ve App Store ortak kural
      expect(p.fish).toBeGreaterThan(0);
    }
    // balık paketleri büyüdükçe birim fiyatı ucuzlamalı (fiyat sıralı varsayımıyla miktar artmalı)
    const fishPacks = PRODUCTS.filter((p) => p.kind === 'consumable').map((p) => p.fish);
    expect([...fishPacks].sort((a, b) => a - b)).toEqual(fishPacks);
  });

  it('isim ve dağınıklık listeleri dolu', () => {
    expect(CAT_NAMES.length).toBeGreaterThan(20);
    expect(MESS_KINDS.length).toBeGreaterThan(3);
  });
});
