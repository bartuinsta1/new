import { describe, expect, it } from 'vitest';
import { load, newGame, resetSave, save } from '../src/game';

function memory(init?: Record<string, string>) {
  const m = new Map(Object.entries(init ?? {}));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
}

describe('kayıt sistemi', () => {
  it('ilk sürümün kaydı (geliştirme/satın alma alanları yok) sorunsuz yüklenir', () => {
    const old = {
      v: 1, fish: 321, hearts: 25, totalFish: 900, rooms: { salon: { furniture: ['cushion', null, 'box', null, null, null] } },
      queue: [], guests: [{ uid: 3, breed: 'tekir', name: 'Lokum', pref: 'sicak', stay: 200, remaining: 50, room: 'salon', slot: 0, seat: 0 }],
      messes: [], album: { tekir: 2 }, nextId: 9, catTimer: 5, messTimer: 9, lastSeen: 1, lastDaily: null,
      cleaned: 4, served: 7, tutorial: 4, settings: { music: false, sfx: true },
    };
    const s = load(memory({ 'mirnav-hani-v1': JSON.stringify(old) }))!;
    expect(s.fish).toBe(321);
    expect(s.upgrades).toEqual({});
    expect(s.wallpapers).toEqual([]);
    expect(s.owned).toEqual([]);
    expect(s.txns).toEqual([]);
    expect(s.settings).toEqual({ music: false, sfx: true, lang: null });
    expect(s.guests).toHaveLength(1);
  });

  it('bozuk veya yabancı kayıt oyunu çökertmez', () => {
    expect(load(memory({ 'mirnav-hani-v1': '{bozuk json' }))).toBeNull();
    expect(load(memory({ 'mirnav-hani-v1': JSON.stringify({ v: 99 }) }))).toBeNull();
    expect(load(memory())).toBeNull();
  });

  it('bilinmeyen mobilya, oda, kedi ve ürünler temizlenir; geçersiz balık düzeltilir', () => {
    const s = newGame(0) as unknown as Record<string, unknown> & ReturnType<typeof newGame>;
    s.rooms.salon.furniture[0] = 'uzay_gemisi';
    (s.rooms as Record<string, unknown>).zindan = { furniture: [] };
    s.guests.push({ uid: 1, breed: 'ejderha', name: 'x', pref: 'oyun', stay: 1, remaining: 1, room: 'salon', slot: 1, seat: 0 });
    (s.owned as string[]).push('sahte_paket');
    s.fish = -50;
    const st = memory();
    save(s, st);
    const l = load(st)!;
    expect(l.rooms.salon.furniture[0]).toBeNull();
    expect(l.rooms.zindan).toBeUndefined();
    expect(l.guests).toHaveLength(0);
    expect(l.owned).toEqual([]);
    expect(l.fish).toBe(0);
  });

  it('depolama hata verirse oyun devam eder (gizli sekme, dolu disk)', () => {
    const broken = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('quota'); },
      removeItem: () => { throw new Error('denied'); },
    };
    expect(load(broken)).toBeNull();
    expect(() => save(newGame(0), broken)).not.toThrow();
    expect(() => resetSave(broken)).not.toThrow();
  });
});
