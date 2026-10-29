import { afterEach, describe, expect, it } from 'vitest';
import { BREEDS, FURNITURE, PRODUCTS, ROOMS, UPGRADES, WALLPAPERS } from '../src/data';
import {
  __DICTS, breedBlurb, breedName, furnDesc, furnName, paperName, productDesc, productName, roomName, setLang, t, upgDesc, upgName,
} from '../src/i18n';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('çeviriler', () => {
  afterEach(() => setLang('tr'));

  it('TR ve EN aynı anahtarlara sahip', () => {
    expect(Object.keys(__DICTS.EN).sort()).toEqual(Object.keys(__DICTS.TR).sort());
  });

  it('her metinde iki dilde de aynı yer tutucular var', () => {
    for (const k of Object.keys(__DICTS.TR) as (keyof typeof __DICTS.TR)[]) {
      expect(placeholders(__DICTS.EN[k]), k).toEqual(placeholders(__DICTS.TR[k]));
      expect(__DICTS.EN[k].trim().length, k).toBeGreaterThan(0);
    }
  });

  it('yer tutucular doldurulur', () => {
    expect(t('levelTitle', { level: 3 })).toBe('Han 3. seviyeye ulaştı!');
    setLang('en');
    expect(t('levelTitle', { level: 3 })).toBe('The inn reached level 3!');
  });

  it('İngilizcede bütün oyun verilerinin kendi adı var (Türkçeye düşmüyor)', () => {
    setLang('en');
    for (const b of BREEDS) {
      expect(breedName(b), b.id).not.toBe(b.name);
      expect(breedBlurb(b)).not.toBe(b.blurb);
    }
    for (const f of FURNITURE) {
      expect(furnName(f), f.id).not.toBe(f.name);
      expect(furnDesc(f), f.id).not.toBe(f.desc);
    }
    for (const r of ROOMS) expect(roomName(r)).not.toBe(r.name);
    for (const u of UPGRADES) {
      expect(upgName(u)).not.toBe(u.name);
      expect(upgDesc(u)).not.toBe(u.desc);
    }
    for (const w of WALLPAPERS) expect(paperName(w), w.id).not.toBe(w.name);
    for (const p of PRODUCTS) {
      expect(productName(p.id)).not.toMatch(/^p_/);
      expect(productDesc(p.id, '1')).not.toContain('{');
    }
  });

  it('mağaza adları sınırlar içinde (App Store 30 karakter)', () => {
    for (const lang of ['tr', 'en'] as const) {
      setLang(lang);
      for (const p of PRODUCTS) expect(productName(p.id).length).toBeLessThanOrEqual(30);
    }
  });
});
