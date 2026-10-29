// Ekonomi dengesi: dikkatli bir oyuncuyu taklit eden bot. Hile yok, satın alma yok.
import { describe, expect, it } from 'vitest';
import { FURNITURE, LEVEL_HEARTS, ROOMS, UPGRADES } from '../src/data';
import {
  bestSeatFor, buyFurniture, buyUpgrade, cleanMess, levelOf, newGame, placeCat, tick, totalIncome, unlockRoom,
} from '../src/game';

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function simulate(seconds: number, seed: number) {
  const s = newGame(0);
  const rand = rng(seed);
  const reached: Record<number, number> = {};
  for (let t = 0; t < seconds; t++) {
    tick(s, 1, rand, 10);
    if (t % 8 === 0) for (const c of [...s.queue]) { const seat = bestSeatFor(s, c); if (seat) placeCat(s, c.uid, seat); }
    if (t % 15 === 0) for (const m of [...s.messes]) cleanMess(s, m.id);
    if (t % 20 === 0) {
      for (const r of ROOMS) unlockRoom(s, r.id);
      const lvl = levelOf(s.hearts);
      const opts = FURNITURE.filter((f) => !f.exclusive && f.unlockLevel <= lvl && f.price <= s.fish).sort((a, b) => b.price - a.price);
      outer: for (const [rid, rs] of Object.entries(s.rooms))
        for (let i = 0; i < 6; i++) if (!rs.furniture[i] && opts.length) { buyFurniture(s, rid, i, opts[0].id); break outer; }
      if (Object.values(s.rooms).every((r) => r.furniture.every(Boolean))) for (const u of UPGRADES) buyUpgrade(s, u.id);
    }
    expect(Number.isFinite(s.fish)).toBe(true);
    expect(s.fish).toBeGreaterThanOrEqual(0);
    const lvl = levelOf(s.hearts);
    if (!reached[lvl]) reached[lvl] = t;
  }
  return { s, reached };
}

describe('ekonomi dengesi', () => {
  it('ilk seviye atlama 3–15 dakika arasında (ne çok hızlı ne sıkıcı)', () => {
    const { reached } = simulate(20 * 60, 1);
    expect(reached[2]).toBeGreaterThan(3 * 60);
    expect(reached[2]).toBeLessThan(15 * 60);
  });

  it('kusursuz oynayan biri bile en üst seviyeye 1,5 saatten önce ulaşamaz ama 5 saatte ulaşır', () => {
    for (const seed of [1, 7, 42]) {
      const { reached, s } = simulate(5 * 3600, seed);
      expect(reached[LEVEL_HEARTS.length], `seed ${seed}`).toBeGreaterThan(1.5 * 3600);
      expect(levelOf(s.hearts)).toBe(LEVEL_HEARTS.length);
      expect(totalIncome(s)).toBeGreaterThan(0);
    }
  });

  it('balık oyun sonunda da harcanabiliyor (geliştirmeler bitmiyor)', () => {
    const { s } = simulate(5 * 3600, 3);
    expect(UPGRADES.some((u) => (s.upgrades[u.id] ?? 0) < u.max)).toBe(true);
  });
});
