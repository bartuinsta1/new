// Tüm çizim yollarını sahte bir canvas üzerinde çalıştırır. Gerçek canvas negatif yarıçapta
// (ellipse/arc) hata fırlatır ve NaN koordinatları sessizce yutar; ikisini de yakalıyoruz.
import { describe, expect, it } from 'vitest';
import { BREEDS, FURNITURE, MESS_KINDS, ROOMS, WALLPAPERS } from '../src/data';
import { drawCat, drawEmptySlot, drawFurniture, drawMess, drawRoom, drawWall, seasonOf, type Pose } from '../src/draw';

function fakeCtx() {
  const problems: string[] = [];
  const gradient = { addColorStop: () => undefined };
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(t, k: string) {
      if (k in t) return t[k];
      return (...args: unknown[]) => {
        for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) problems.push(`${k}(${args.join(',')})`);
        if (k === 'ellipse' && ((args[2] as number) < 0 || (args[3] as number) < 0)) problems.push(`ellipse negatif yarıçap`);
        if (k === 'arc' && (args[2] as number) < 0) problems.push('arc negatif yarıçap');
        if (k === 'arcTo' && (args[4] as number) < 0) problems.push('arcTo negatif yarıçap');
        if (k.startsWith('create')) return gradient;
        return undefined;
      };
    },
    set(t, k: string, v) {
      t[k] = v;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, problems };
}

describe('çizimler', () => {
  it('her kedi her pozda ve her zamanda hatasız çizilir', () => {
    const { ctx, problems } = fakeCtx();
    for (const b of BREEDS)
      for (const pose of ['sit', 'loaf', 'sleep'] as Pose[])
        for (const t of [0, 1.3, 77.7]) {
          drawCat(ctx, 100, 200, 60, b, pose, t, 3, false);
          drawCat(ctx, 100, 200, 60, b, pose, t, 3, true);
        }
    expect(problems).toEqual([]);
  });

  it('her mobilya, dağınıklık ve boş alan hatasız çizilir (küçük ekranda da)', () => {
    const { ctx, problems } = fakeCtx();
    for (const u of [12, 80])
      for (const t of [0, 5.5]) {
        for (const f of FURNITURE) drawFurniture(ctx, f, 100, 300, u, t);
        for (const k of MESS_KINDS) drawMess(ctx, k, 50, 50, u, t, 9);
        drawEmptySlot(ctx, 10, 10, u, t, true);
      }
    expect(problems).toEqual([]);
  });

  it('her oda her saatte, mevsimde ve duvar kâğıdıyla çizilir', () => {
    const { ctx, problems } = fakeCtx();
    for (const r of ROOMS)
      for (const hour of [0, 6, 12, 17, 21])
        for (let month = 0; month < 12; month++) drawRoom(ctx, r, 360, 560, 3, hour, seasonOf(month), month === 10, undefined);
    for (const w of WALLPAPERS) for (const r of ROOMS) drawWall(ctx, r, w, 360, 260);
    // aşırı küçük ve geniş sahneler (tablet / bölünmüş ekran)
    drawRoom(ctx, ROOMS[0], 120, 140, 1, 12, 'winter', true, WALLPAPERS[0]);
    drawRoom(ctx, ROOMS[0], 1024, 700, 1, 12, 'summer', false, undefined);
    expect(problems).toEqual([]);
  });
});
