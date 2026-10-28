import { describe, expect, it } from 'vitest';
import {
  bestSeatFor, buyFurniture, catchUp, claimDaily, cleanMess, freeSeats, levelOf, load, newGame,
  placeCat, removeFurniture, save, tick, totalIncome, unlockRoom, OFFLINE_CAP,
  buyUpgrade, upgradeCost, useWallpaper, catIncome,
} from '../src/game';

function seq(...vals: number[]) {
  let i = 0;
  return () => vals[i++ % vals.length];
}
const half = () => 0.5;

describe('oyun mantığı', () => {
  it('yeni oyun bir minder ve kedisiz başlar', () => {
    const s = newGame(0);
    expect(freeSeats(s)).toHaveLength(1);
    expect(totalIncome(s)).toBe(0);
  });

  it('ilk kedi kısa sürede kapıya gelir ve yerleştirilince balık kazandırır', () => {
    const s = newGame(0);
    const ev = tick(s, 3, half, 10);
    expect(ev.some((e) => e.type === 'arrive')).toBe(true);
    const cat = s.queue[0];
    const seat = bestSeatFor(s, cat)!;
    expect(placeCat(s, cat.uid, seat)).toBe(true);
    expect(s.album[cat.breed]).toBe(1);
    const before = s.fish;
    tick(s, 10, half, 10);
    expect(s.fish).toBeGreaterThan(before);
  });

  it('kedi süresi dolunca ayrılır, kalp ve balık verir', () => {
    const s = newGame(0);
    tick(s, 3, half, 10);
    const cat = s.queue[0];
    placeCat(s, cat.uid, bestSeatFor(s, cat)!);
    const ev = tick(s, cat.stay + 1, half, 10);
    const leave = ev.find((e) => e.type === 'leave');
    expect(leave).toBeTruthy();
    expect(s.hearts).toBeGreaterThan(0);
    expect(s.guests).toHaveLength(0);
  });

  it('boş koltuk yoksa kuyruk birden fazla büyümez', () => {
    const s = newGame(0);
    for (let i = 0; i < 20; i++) tick(s, 30, half, 10);
    expect(s.queue.length).toBe(1);
  });

  it('mobilya alımı balık ve seviye kontrol eder', () => {
    const s = newGame(0);
    expect(buyFurniture(s, 'salon', 0, 'tree')).toBe('level');
    expect(buyFurniture(s, 'salon', 1, 'box')).toBe('occupied');
    expect(buyFurniture(s, 'salon', 0, 'box')).toBe('ok');
    expect(s.fish).toBe(15);
    expect(buyFurniture(s, 'salon', 2, 'basket')).toBe('fish');
    expect(removeFurniture(s, 'salon', 0)).toBe(12);
  });

  it('dağınıklık temizlemek balık ve her 5 temizlikte kalp verir', () => {
    const s = newGame(0);
    for (let i = 0; i < 5; i++) {
      s.messes.push({ id: 100 + i, room: 'salon', kind: 'yarn', x: 0.5, y: 0.6 });
      cleanMess(s, 100 + i);
    }
    expect(s.hearts).toBe(1);
    expect(s.fish).toBe(40 + 5 * 3);
  });

  it('oda açmak seviye ister', () => {
    const s = newGame(0);
    s.fish = 5000;
    expect(unlockRoom(s, 'mutfak')).toBe('level');
    s.hearts = 20;
    expect(levelOf(s.hearts)).toBe(3);
    expect(unlockRoom(s, 'mutfak')).toBe('ok');
    expect(s.rooms.mutfak.furniture).toHaveLength(6);
  });

  it('günlük hediye günde bir kez', () => {
    const s = newGame(0);
    expect(claimDaily(s, '2026-11-1')).toBe(60);
    expect(claimDaily(s, '2026-11-1')).toBe(0);
  });

  it('çevrimdışı ilerleme üst sınırlıdır', () => {
    const s = newGame(0);
    const r = catchUp(s, 100 * 3600 * 1000, seq(0.3, 0.7), 10);
    expect(r.seconds).toBe(OFFLINE_CAP);
  });

  it('kayıt ve yükleme', () => {
    const mem = new Map<string, string>();
    const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const s = newGame(0);
    s.fish = 123;
    save(s, st);
    expect(load(st)?.fish).toBe(123);
  });

  it('geliştirmeler pahalanır ve gelir artırır', () => {
    const s = newGame(0);
    s.fish = 10000;
    expect(buyUpgrade(s, 'mama')).toBe('level');
    s.hearts = 6;
    tick(s, 3, half, 10);
    const cat = s.queue[0];
    placeCat(s, cat.uid, bestSeatFor(s, cat)!);
    const before = catIncome(s, s.guests[0]);
    const c1 = upgradeCost(s, 'mama');
    expect(buyUpgrade(s, 'mama')).toBe('ok');
    expect(upgradeCost(s, 'mama')).toBeGreaterThan(c1);
    expect(catIncome(s, s.guests[0])).toBeCloseTo(before * 1.1);
    s.fish = 1e9;
    for (let i = 0; i < 30; i++) buyUpgrade(s, 'mama');
    expect(buyUpgrade(s, 'mama')).toBe('max');
  });

  it('duvar kağıdı bir kez alınır, her odaya uygulanır', () => {
    const s = newGame(0);
    s.hearts = 6;
    s.fish = 500;
    expect(useWallpaper(s, 'salon', 'cilek')).toBe('bought');
    expect(s.fish).toBe(100);
    expect(useWallpaper(s, 'salon', 'default')).toBe('applied');
    expect(s.rooms.salon.wallpaper).toBeUndefined();
    expect(useWallpaper(s, 'salon', 'cilek')).toBe('applied');
    expect(s.fish).toBe(100);
    expect(useWallpaper(s, 'salon', 'kar')).toBe('level');
  });
});
