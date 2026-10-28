// Tüm grafikler prosedürel çizilir: görsel dosyası yok, her ekranda keskin.
import type { BreedDef, FurnitureDef, MessKind, RoomDef } from './data';

type Ctx = CanvasRenderingContext2D;

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export type Pose = 'sit' | 'loaf' | 'sleep';

/** (x, y) kedinin yere değdiği alt orta nokta. s = kabaca kedinin yüksekliği. */
export function drawCat(ctx: Ctx, x: number, y: number, s: number, b: BreedDef, pose: Pose, t: number, seed = 0, happy = false) {
  const line = shade(b.base, -0.45);
  const lw = Math.max(1, s * 0.035);
  const fl = b.fluffy ? 1.1 : 1;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = line;

  // gölge
  ctx.fillStyle = 'rgba(40,25,15,0.18)';
  ellipse(ctx, x, y, s * (pose === 'sit' ? 0.42 : 0.6), s * 0.08);
  ctx.fill();

  const breathe = Math.sin(t * 2 + seed) * 0.02;
  const sway = Math.sin(t * 1.6 + seed * 3);

  if (pose === 'sit') {
    // kuyruk
    ctx.strokeStyle = b.base;
    ctx.lineWidth = s * 0.13 * fl;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.25, y - s * 0.12);
    ctx.quadraticCurveTo(x + s * 0.7, y - s * 0.1, x + s * (0.55 + sway * 0.08), y - s * (0.55 + sway * 0.05));
    ctx.stroke();
    ctx.strokeStyle = line;
    ctx.lineWidth = lw;

    const by = y - s * 0.32;
    const brx = s * 0.36 * fl, bry = s * (0.36 + breathe) * fl;
    ctx.fillStyle = b.base;
    ellipse(ctx, x, by, brx, bry);
    ctx.fill();
    ctx.stroke();
    bodyMarks(ctx, b, x, by, brx, bry, s);
    // patiler
    ctx.fillStyle = b.belly ?? b.base;
    ellipse(ctx, x - s * 0.13, y - s * 0.03, s * 0.1, s * 0.06);
    ctx.fill(); ctx.stroke();
    ellipse(ctx, x + s * 0.13, y - s * 0.03, s * 0.1, s * 0.06);
    ctx.fill(); ctx.stroke();

    drawHead(ctx, x, y - s * (0.78 + breathe * 0.5), s * 0.3 * (b.fluffy ? 1.05 : 1), b, happy ? 'happy' : blink(t, seed) ? 'closed' : 'open', line, lw, Math.sin(t * 0.7 + seed) * 0.06);
  } else {
    const sleeping = pose === 'sleep';
    const by = y - s * 0.22;
    const brx = s * 0.5 * fl, bry = s * (0.24 + breathe) * fl;
    // kuyruk gövdeye sarılı
    ctx.strokeStyle = b.base;
    ctx.lineWidth = s * 0.12 * fl;
    ctx.beginPath();
    ctx.moveTo(x + brx * 0.85, by + bry * 0.2);
    ctx.quadraticCurveTo(x + brx * 0.9, y + s * 0.02, x + brx * (0.1 + (sleeping ? 0 : sway * 0.1)), y - s * 0.01);
    ctx.stroke();
    ctx.strokeStyle = line;
    ctx.lineWidth = lw;
    ctx.fillStyle = b.base;
    ellipse(ctx, x + s * 0.05, by, brx, bry);
    ctx.fill(); ctx.stroke();
    bodyMarks(ctx, b, x + s * 0.05, by, brx, bry, s);
    // kuyruk ucu önde
    ctx.strokeStyle = b.base;
    ctx.lineWidth = s * 0.11 * fl;
    ctx.beginPath();
    ctx.moveTo(x + brx * 0.6, y - s * 0.03);
    ctx.quadraticCurveTo(x, y + s * 0.02, x - brx * 0.35, y - s * 0.04);
    ctx.stroke();
    ctx.strokeStyle = line;
    ctx.lineWidth = lw;
    const hx = x - s * 0.32;
    const hy = y - s * (sleeping ? 0.3 : 0.42);
    drawHead(ctx, hx, hy, s * 0.27 * (b.fluffy ? 1.05 : 1), b, sleeping || blink(t, seed) ? 'closed' : happy ? 'happy' : 'open', line, lw, sleeping ? 0.25 : 0);
    if (sleeping) {
      const zt = (t * 0.5 + seed) % 1;
      ctx.fillStyle = `rgba(90,80,120,${1 - zt})`;
      ctx.font = `bold ${Math.round(s * (0.16 + zt * 0.1))}px system-ui, sans-serif`;
      ctx.fillText('z', hx + s * (0.25 + zt * 0.2), hy - s * (0.3 + zt * 0.4));
    }
  }
  ctx.restore();
}

function blink(t: number, seed: number): boolean {
  return (t + seed * 1.7) % 4.3 < 0.13;
}

function bodyMarks(ctx: Ctx, b: BreedDef, x: number, y: number, rx: number, ry: number, s: number) {
  ctx.save();
  ellipse(ctx, x, y, rx, ry);
  ctx.clip();
  if (b.belly) {
    ctx.fillStyle = b.belly;
    ellipse(ctx, x, y + ry * 0.35, rx * 0.55, ry * 0.7);
    ctx.fill();
  }
  if (b.patch && b.id !== 'siyam') {
    ctx.fillStyle = b.patch;
    ellipse(ctx, x + rx * 0.45, y - ry * 0.3, rx * 0.5, ry * 0.45);
    ctx.fill();
    if (b.id === 'calico') {
      ctx.fillStyle = '#3a302c';
      ellipse(ctx, x - rx * 0.55, y + ry * 0.1, rx * 0.35, ry * 0.35);
      ctx.fill();
    }
  }
  if (b.stripes) {
    ctx.strokeStyle = b.stripes;
    ctx.lineWidth = s * 0.05;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * rx * 0.35, y - ry);
      ctx.quadraticCurveTo(x + i * rx * 0.35 + rx * 0.15, y - ry * 0.3, x + i * rx * 0.3, y + ry * 0.1);
      ctx.stroke();
    }
  }
  if (b.id === 'gece') {
    ctx.fillStyle = '#f5e27a';
    for (let i = 0; i < 6; i++) {
      ellipse(ctx, x + Math.cos(i * 2.4) * rx * 0.7, y + Math.sin(i * 1.7) * ry * 0.6, s * 0.018, s * 0.018);
      ctx.fill();
    }
  }
  ctx.restore();
}

type Eyes = 'open' | 'closed' | 'happy';

function drawHead(ctx: Ctx, x: number, y: number, r: number, b: BreedDef, eyes: Eyes, line: string, lw: number, tilt: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  const earC = b.id === 'siyam' ? b.patch! : b.base;
  // kulaklar
  for (const side of [-1, 1]) {
    ctx.fillStyle = earC;
    ctx.beginPath();
    if (b.foldEars) {
      ctx.moveTo(side * r * 0.75, -r * 0.45);
      ctx.quadraticCurveTo(side * r * 0.75, -r * 1.05, side * r * 0.2, -r * 0.85);
      ctx.closePath();
    } else {
      ctx.moveTo(side * r * 0.85, -r * 0.35);
      ctx.lineTo(side * r * 0.72, -r * 1.2);
      ctx.lineTo(side * r * 0.15, -r * 0.85);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    if (!b.foldEars) {
      ctx.fillStyle = '#f2b6b0';
      ctx.beginPath();
      ctx.moveTo(side * r * 0.7, -r * 0.55);
      ctx.lineTo(side * r * 0.66, -r * 1.0);
      ctx.lineTo(side * r * 0.32, -r * 0.8);
      ctx.closePath();
      ctx.fill();
    }
  }
  // yüz
  ctx.fillStyle = b.base;
  ellipse(ctx, 0, 0, r * 1.05, r * 0.92);
  ctx.fill();
  ctx.save();
  ellipse(ctx, 0, 0, r * 1.05, r * 0.92);
  ctx.clip();
  if (b.id === 'siyam') {
    ctx.fillStyle = b.patch!;
    ellipse(ctx, 0, r * 0.35, r * 0.55, r * 0.5);
    ctx.fill();
  } else if (b.patch) {
    ctx.fillStyle = b.patch;
    ellipse(ctx, -r * 0.6, -r * 0.45, r * 0.6, r * 0.5);
    ctx.fill();
  }
  if (b.stripes) {
    ctx.strokeStyle = b.stripes;
    ctx.lineWidth = r * 0.12;
    for (const dx of [-0.25, 0, 0.25]) {
      ctx.beginPath();
      ctx.moveTo(dx * r, -r * 0.92);
      ctx.lineTo(dx * r * 0.8, -r * 0.55);
      ctx.stroke();
    }
  }
  if (b.belly || b.id === 'smokin') {
    ctx.fillStyle = b.belly ?? '#fff';
    ellipse(ctx, 0, r * 0.5, r * 0.5, r * 0.38);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = line;
  ctx.lineWidth = lw;
  ellipse(ctx, 0, 0, r * 1.05, r * 0.92);
  ctx.stroke();

  // yanaklar
  ctx.fillStyle = 'rgba(240,130,130,0.35)';
  ellipse(ctx, -r * 0.6, r * 0.28, r * 0.18, r * 0.11);
  ctx.fill();
  ellipse(ctx, r * 0.6, r * 0.28, r * 0.18, r * 0.11);
  ctx.fill();

  // gözler
  const ex = r * 0.4, ey = -r * 0.05;
  const dark = b.base === '#2e2a2b' || b.base === '#2b2829' || b.base === '#2f3356';
  ctx.strokeStyle = dark ? '#d9d2c6' : '#3a2a22';
  ctx.lineWidth = r * 0.09;
  for (const [i, side] of [-1, 1].entries()) {
    if (eyes === 'open') {
      ctx.fillStyle = b.eyes[i];
      ellipse(ctx, side * ex, ey, r * 0.17, r * 0.2);
      ctx.fill();
      ctx.fillStyle = '#1e1714';
      ellipse(ctx, side * ex, ey, r * 0.07, r * 0.17);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ellipse(ctx, side * ex + r * 0.05, ey - r * 0.08, r * 0.045, r * 0.045);
      ctx.fill();
    } else if (eyes === 'happy') {
      ctx.beginPath();
      ctx.arc(side * ex, ey + r * 0.06, r * 0.14, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(side * ex, ey - r * 0.04, r * 0.14, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
  }
  // burun + ağız
  ctx.fillStyle = '#e88a8a';
  ctx.beginPath();
  ctx.moveTo(-r * 0.09, r * 0.2);
  ctx.lineTo(r * 0.09, r * 0.2);
  ctx.lineTo(0, r * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  ctx.arc(-r * 0.09, r * 0.32, r * 0.09, 0, Math.PI);
  ctx.arc(r * 0.09, r * 0.32, r * 0.09, 0, Math.PI);
  ctx.stroke();
  // bıyıklar
  ctx.strokeStyle = 'rgba(80,60,50,0.45)';
  ctx.lineWidth = r * 0.035;
  for (const side of [-1, 1]) {
    for (const dy of [0.2, 0.32]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.45, r * dy);
      ctx.lineTo(side * r * 1.25, r * (dy - 0.06 + (dy - 0.26)));
      ctx.stroke();
    }
  }
  ctx.restore();
}

export interface SeatPoint { dx: number; dy: number; pose: Pose; scale: number }

/** Mobilya üzerindeki kedi oturma noktaları (u birimi). */
export function seatPoints(f: FurnitureDef): SeatPoint[] {
  switch (f.kind) {
    case 'cushion': return [{ dx: 0, dy: -0.12, pose: 'loaf', scale: 1 }];
    case 'box': return [{ dx: 0, dy: -0.32, pose: 'sit', scale: 0.9 }];
    case 'basket': return [{ dx: 0, dy: -0.2, pose: 'sleep', scale: 0.95 }];
    case 'windowbed': return [{ dx: 0, dy: -0.22, pose: 'loaf', scale: 1 }];
    case 'radiator': return [{ dx: 0, dy: -0.62, pose: 'sleep', scale: 0.85 }];
    case 'tree': return [{ dx: -0.25, dy: -0.38, pose: 'loaf', scale: 0.75 }, { dx: 0.18, dy: -1.02, pose: 'sit', scale: 0.7 }];
    case 'bookshelf': return [{ dx: 0, dy: -1.12, pose: 'sleep', scale: 0.72 }];
    case 'sofa': return [{ dx: -0.26, dy: -0.32, pose: 'sleep', scale: 0.8 }, { dx: 0.28, dy: -0.32, pose: 'loaf', scale: 0.8 }];
    case 'hammock': return [{ dx: 0, dy: -0.45, pose: 'sleep', scale: 0.9 }];
    case 'igloo': return [{ dx: -0.08, dy: -0.06, pose: 'loaf', scale: 0.7 }, { dx: 0.3, dy: -0.02, pose: 'sit', scale: 0.65 }];
    case 'fireplace': return [{ dx: -0.32, dy: 0.05, pose: 'sleep', scale: 0.75 }, { dx: 0.34, dy: 0.05, pose: 'loaf', scale: 0.75 }];
    default: return [];
  }
}

/** (x, y) mobilyanın alt orta noktası. u = birim boyut. */
export function drawFurniture(ctx: Ctx, f: FurnitureDef, x: number, y: number, u: number, t: number) {
  const c = f.color, a = f.accent, line = shade(c, -0.4);
  ctx.save();
  ctx.lineWidth = Math.max(1, u * 0.025);
  ctx.strokeStyle = line;
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(40,25,15,0.16)';
  ellipse(ctx, x, y, u * 0.48, u * 0.08);
  ctx.fill();
  switch (f.kind) {
    case 'cushion': {
      ctx.fillStyle = c;
      ellipse(ctx, x, y - u * 0.1, u * 0.42, u * 0.13);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = a;
      ellipse(ctx, x, y - u * 0.13, u * 0.3, u * 0.07);
      ctx.fill();
      ctx.fillStyle = '#f3d27a';
      for (const s of [-1, 1]) { ellipse(ctx, x + s * u * 0.42, y - u * 0.1, u * 0.04, u * 0.04); ctx.fill(); }
      break;
    }
    case 'box': {
      ctx.fillStyle = shade(c, -0.15);
      ctx.fillRect(x - u * 0.34, y - u * 0.42, u * 0.68, u * 0.42);
      ctx.strokeRect(x - u * 0.34, y - u * 0.42, u * 0.68, u * 0.42);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x - u * 0.34, y - u * 0.42); ctx.lineTo(x - u * 0.48, y - u * 0.56); ctx.lineTo(x - u * 0.2, y - u * 0.5); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + u * 0.34, y - u * 0.42); ctx.lineTo(x + u * 0.48, y - u * 0.56); ctx.lineTo(x + u * 0.2, y - u * 0.5); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = a;
      ctx.beginPath(); ctx.moveTo(x - u * 0.1, y - u * 0.25); ctx.lineTo(x + u * 0.1, y - u * 0.25); ctx.stroke();
      break;
    }
    case 'basket': {
      ctx.fillStyle = a;
      ellipse(ctx, x, y - u * 0.26, u * 0.4, u * 0.1);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x - u * 0.42, y - u * 0.26);
      ctx.quadraticCurveTo(x - u * 0.4, y, x, y);
      ctx.quadraticCurveTo(x + u * 0.4, y, x + u * 0.42, y - u * 0.26);
      ctx.quadraticCurveTo(x, y - u * 0.12, x - u * 0.42, y - u * 0.26);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = shade(c, -0.25);
      for (let i = 1; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(x - u * 0.38, y - u * 0.06 * i); ctx.lineTo(x + u * 0.38, y - u * 0.06 * i); ctx.stroke();
      }
      break;
    }
    case 'windowbed': {
      ctx.fillStyle = shade(c, -0.2);
      roundRect(ctx, x - u * 0.45, y - u * 0.22, u * 0.9, u * 0.22, u * 0.06);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = c;
      roundRect(ctx, x - u * 0.42, y - u * 0.3, u * 0.84, u * 0.14, u * 0.07);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = a;
      for (let i = -3; i <= 3; i++) { ellipse(ctx, x + i * u * 0.11, y - u * 0.23, u * 0.025, u * 0.025); ctx.fill(); }
      break;
    }
    case 'radiator': {
      ctx.fillStyle = c;
      for (let i = -3; i <= 3; i++) {
        roundRect(ctx, x + i * u * 0.11 - u * 0.045, y - u * 0.55, u * 0.09, u * 0.52, u * 0.04);
        ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = a;
      roundRect(ctx, x - u * 0.42, y - u * 0.66, u * 0.84, u * 0.12, u * 0.05);
      ctx.fill(); ctx.stroke();
      // sıcak hava dalgaları
      ctx.strokeStyle = 'rgba(255,170,120,0.35)';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        const ph = t * 2 + i;
        ctx.moveTo(x + i * u * 0.25, y - u * 0.7);
        ctx.quadraticCurveTo(x + i * u * 0.25 + Math.sin(ph) * u * 0.05, y - u * 0.85, x + i * u * 0.25, y - u * 0.98);
        ctx.stroke();
      }
      break;
    }
    case 'tree': {
      ctx.fillStyle = a;
      ctx.fillRect(x - u * 0.06, y - u * 1.0, u * 0.12, u * 0.95);
      ctx.strokeRect(x - u * 0.06, y - u * 1.0, u * 0.12, u * 0.95);
      ctx.strokeStyle = shade(c, -0.15);
      for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(x - u * 0.06, y - u * (0.1 + i * 0.11)); ctx.lineTo(x + u * 0.06, y - u * (0.15 + i * 0.11)); ctx.stroke(); }
      ctx.strokeStyle = line;
      ctx.fillStyle = c;
      roundRect(ctx, x - u * 0.48, y - u * 0.08, u * 0.96, u * 0.08, u * 0.03); ctx.fill(); ctx.stroke();
      roundRect(ctx, x - u * 0.48, y - u * 0.42, u * 0.5, u * 0.08, u * 0.03); ctx.fill(); ctx.stroke();
      roundRect(ctx, x - u * 0.12, y - u * 1.06, u * 0.56, u * 0.08, u * 0.03); ctx.fill(); ctx.stroke();
      // sallanan oyuncak
      const sw = Math.sin(t * 2) * 0.15;
      ctx.strokeStyle = '#7a5a40';
      ctx.beginPath(); ctx.moveTo(x + u * 0.38, y - u * 0.98); ctx.lineTo(x + u * (0.38 + sw), y - u * 0.7); ctx.stroke();
      ctx.fillStyle = '#e06a6a';
      ellipse(ctx, x + u * (0.38 + sw), y - u * 0.66, u * 0.05, u * 0.05); ctx.fill();
      break;
    }
    case 'bookshelf': {
      ctx.fillStyle = c;
      ctx.fillRect(x - u * 0.38, y - u * 1.1, u * 0.76, u * 1.1);
      ctx.strokeRect(x - u * 0.38, y - u * 1.1, u * 0.76, u * 1.1);
      const books = ['#c96b5b', '#5f8fb4', '#e1b45a', '#6a9a62', '#9a6ab4', '#d98a5a'];
      for (let row = 0; row < 3; row++) {
        const ry = y - u * (0.08 + row * 0.33);
        ctx.fillStyle = shade(c, -0.3);
        ctx.fillRect(x - u * 0.33, ry - u * 0.27, u * 0.66, u * 0.27);
        let bx = x - u * 0.32;
        for (let i = 0; i < 6; i++) {
          const bw = u * (0.07 + ((i * 7 + row * 3) % 4) * 0.012);
          const bh = u * (0.2 + ((i * 5 + row) % 3) * 0.025);
          ctx.fillStyle = books[(i + row * 2) % books.length];
          ctx.fillRect(bx, ry - bh, bw, bh);
          bx += bw + u * 0.01;
        }
      }
      ctx.fillStyle = a;
      ctx.fillRect(x - u * 0.42, y - u * 1.14, u * 0.84, u * 0.06);
      break;
    }
    case 'sofa': {
      ctx.fillStyle = shade(c, -0.15);
      roundRect(ctx, x - u * 0.55, y - u * 0.62, u * 1.1, u * 0.4, u * 0.12);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = c;
      roundRect(ctx, x - u * 0.55, y - u * 0.34, u * 1.1, u * 0.28, u * 0.08);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = a;
      roundRect(ctx, x - u * 0.5, y - u * 0.36, u * 0.48, u * 0.08, u * 0.04); ctx.fill();
      roundRect(ctx, x + u * 0.02, y - u * 0.36, u * 0.48, u * 0.08, u * 0.04); ctx.fill();
      ctx.fillStyle = shade(c, -0.25);
      for (const s of [-1, 1]) { roundRect(ctx, x + s * u * 0.55 - u * 0.08, y - u * 0.5, u * 0.16, u * 0.44, u * 0.08); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#5a3a28';
      for (const s of [-1, 1]) ctx.fillRect(x + s * u * 0.45 - u * 0.03, y - u * 0.06, u * 0.06, u * 0.06);
      break;
    }
    case 'hammock': {
      ctx.strokeStyle = '#8a6a4a';
      ctx.beginPath(); ctx.moveTo(x - u * 0.45, y - u * 0.95); ctx.lineTo(x - u * 0.38, y - u * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + u * 0.45, y - u * 0.95); ctx.lineTo(x + u * 0.38, y - u * 0.5); ctx.stroke();
      const sw = Math.sin(t * 1.2) * u * 0.02;
      ctx.fillStyle = c;
      ctx.strokeStyle = line;
      ctx.beginPath();
      ctx.moveTo(x - u * 0.42, y - u * 0.52);
      ctx.quadraticCurveTo(x + sw, y - u * 0.1, x + u * 0.42, y - u * 0.52);
      ctx.quadraticCurveTo(x + sw, y - u * 0.3, x - u * 0.42, y - u * 0.52);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = a;
      ctx.beginPath(); ctx.moveTo(x - u * 0.3, y - u * 0.4); ctx.quadraticCurveTo(x, y - u * 0.18, x + u * 0.3, y - u * 0.4); ctx.stroke();
      break;
    }
    case 'igloo': {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, y, u * 0.5, Math.PI, 0);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = a;
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc(x, y, u * 0.5 * (i / 4) + u * 0.06, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
      ctx.fillStyle = shade(c, -0.45);
      ctx.beginPath();
      ctx.arc(x + u * 0.05, y, u * 0.2, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#f28b82';
      ellipse(ctx, x, y - u * 0.52, u * 0.07, u * 0.07); ctx.fill();
      break;
    }
    case 'fireplace': {
      ctx.fillStyle = c;
      ctx.fillRect(x - u * 0.5, y - u * 0.85, u * 1.0, u * 0.85);
      ctx.strokeRect(x - u * 0.5, y - u * 0.85, u * 1.0, u * 0.85);
      ctx.strokeStyle = shade(c, -0.2);
      for (let r = 0; r < 5; r++) for (let k = 0; k < 4; k++) {
        ctx.strokeRect(x - u * 0.5 + k * u * 0.25 + (r % 2) * u * 0.12, y - u * 0.85 + r * u * 0.17, u * 0.25, u * 0.17);
      }
      ctx.fillStyle = '#5a3a2a';
      ctx.fillRect(x - u * 0.6, y - u * 0.92, u * 1.2, u * 0.09);
      ctx.fillStyle = '#2a1c16';
      ctx.beginPath();
      ctx.moveTo(x - u * 0.28, y);
      ctx.lineTo(x - u * 0.28, y - u * 0.4);
      ctx.arc(x, y - u * 0.4, u * 0.28, Math.PI, 0);
      ctx.lineTo(x + u * 0.28, y);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const fl = Math.sin(t * 7 + i * 2) * 0.05;
        ctx.fillStyle = ['#f08a3c', '#f6c34a', '#fff1a8'][i];
        ctx.beginPath();
        const w = u * (0.2 - i * 0.05), h = u * (0.38 - i * 0.09 + fl);
        ctx.moveTo(x - w, y - u * 0.04);
        ctx.quadraticCurveTo(x - w * 0.8, y - h * 0.6, x, y - h);
        ctx.quadraticCurveTo(x + w * 0.8, y - h * 0.6, x + w, y - u * 0.04);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,170,90,0.12)';
      ellipse(ctx, x, y - u * 0.2, u * (0.9 + Math.sin(t * 5) * 0.03), u * 0.5);
      ctx.fill();
      break;
    }
    case 'plant': {
      ctx.fillStyle = a;
      ctx.beginPath();
      ctx.moveTo(x - u * 0.16, y - u * 0.3); ctx.lineTo(x + u * 0.16, y - u * 0.3); ctx.lineTo(x + u * 0.12, y); ctx.lineTo(x - u * 0.12, y); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = c;
      const sw = Math.sin(t) * 0.05;
      for (let i = 0; i < 6; i++) {
        const ang = -Math.PI / 2 + (i - 2.5) * 0.38 + sw;
        ellipse(ctx, x + Math.cos(ang) * u * 0.22, y - u * 0.32 + Math.sin(ang) * u * 0.25, u * 0.07, u * 0.17, ang + Math.PI / 2);
        ctx.fill(); ctx.stroke();
      }
      break;
    }
    case 'lamp': {
      const glow = ctx.createRadialGradient(x, y - u * 0.85, 0, x, y - u * 0.85, u * 0.9);
      glow.addColorStop(0, 'rgba(255,220,140,0.45)');
      glow.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = glow;
      ellipse(ctx, x, y - u * 0.85, u * 0.9, u * 0.9);
      ctx.fill();
      ctx.fillStyle = a;
      ctx.fillRect(x - u * 0.025, y - u * 0.8, u * 0.05, u * 0.8);
      ellipse(ctx, x, y - u * 0.02, u * 0.16, u * 0.05); ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x - u * 0.12, y - u * 1.02); ctx.lineTo(x + u * 0.12, y - u * 1.02); ctx.lineTo(x + u * 0.22, y - u * 0.78); ctx.lineTo(x - u * 0.22, y - u * 0.78); ctx.closePath();
      ctx.fill(); ctx.stroke();
      break;
    }
    case 'cocoa': {
      ctx.fillStyle = c;
      roundRect(ctx, x - u * 0.45, y - u * 0.5, u * 0.9, u * 0.5, u * 0.04);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = shade(c, 0.25);
      ctx.fillRect(x - u * 0.5, y - u * 0.56, u * 1.0, u * 0.08);
      for (const dx of [-0.25, 0.05, 0.3]) {
        ctx.fillStyle = a;
        roundRect(ctx, x + dx * u - u * 0.07, y - u * 0.72, u * 0.14, u * 0.16, u * 0.03);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#6b3e26';
        ellipse(ctx, x + dx * u, y - u * 0.71, u * 0.06, u * 0.02); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.moveTo(x + dx * u, y - u * 0.76);
        ctx.quadraticCurveTo(x + dx * u + Math.sin(t * 2 + dx * 9) * u * 0.05, y - u * 0.85, x + dx * u, y - u * 0.95);
        ctx.stroke();
        ctx.strokeStyle = line;
      }
      break;
    }
  }
  ctx.restore();
}

export function drawMess(ctx: Ctx, kind: MessKind, x: number, y: number, u: number, t: number, seed: number) {
  const s = u * 0.28;
  const bob = Math.sin(t * 3 + seed) * s * 0.04;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.lineCap = 'round';
  switch (kind) {
    case 'yarn': {
      ctx.strokeStyle = '#b85c7a';
      ctx.beginPath(); ctx.moveTo(s * 0.4, s * 0.2); ctx.bezierCurveTo(s * 1.2, s * 0.6, s * 1.4, -s * 0.2, s * 2, s * 0.3); ctx.stroke();
      ctx.fillStyle = '#e17a9a';
      ellipse(ctx, 0, 0, s * 0.5, s * 0.5); ctx.fill();
      ctx.strokeStyle = '#b85c7a';
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * s * 0.15, 0, s * 0.42, -1, 1); ctx.stroke(); }
      break;
    }
    case 'paws': {
      ctx.fillStyle = 'rgba(110,80,60,0.55)';
      for (let i = 0; i < 3; i++) {
        const px = (i - 1) * s * 0.9, py = (i % 2) * s * 0.5 - s * 0.2;
        ellipse(ctx, px, py, s * 0.2, s * 0.17); ctx.fill();
        for (let k = -1; k <= 1; k++) { ellipse(ctx, px + k * s * 0.15, py - s * 0.25, s * 0.07, s * 0.07); ctx.fill(); }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ellipse(ctx, s * 0.9, -s * 0.5, s * 0.08, s * 0.08); ctx.fill();
      break;
    }
    case 'milk': {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.ellipse(0, s * 0.1, s * 0.9, s * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ellipse(ctx, s * 0.7, s * 0.25, s * 0.25, s * 0.12); ctx.fill();
      ctx.fillStyle = '#7fa6c9';
      roundRect(ctx, -s * 0.7, -s * 0.35, s * 0.6, s * 0.4, s * 0.1); ctx.fill();
      break;
    }
    case 'leaf': {
      const cols = ['#d9773a', '#c9a23a', '#b84a32'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = cols[i];
        ellipse(ctx, (i - 1) * s * 0.6, (i % 2) * s * 0.3, s * 0.35, s * 0.18, i * 0.9 + seed);
        ctx.fill();
      }
      break;
    }
    case 'fur': {
      ctx.fillStyle = 'rgba(200,190,180,0.9)';
      for (let i = 0; i < 4; i++) { ellipse(ctx, Math.cos(i * 1.6) * s * 0.4, Math.sin(i * 1.6) * s * 0.2, s * 0.3, s * 0.22); ctx.fill(); }
      ctx.strokeStyle = 'rgba(160,150,140,0.8)';
      ctx.lineWidth = s * 0.04;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * 1.3) * s * 0.7, Math.sin(i * 1.3) * s * 0.35); ctx.stroke(); }
      break;
    }
  }
  // parıltı ipucu
  const tw = (Math.sin(t * 4 + seed * 2) + 1) / 2;
  ctx.fillStyle = `rgba(255,255,255,${0.4 + tw * 0.5})`;
  star(ctx, s * 0.6, -s * 0.7, s * 0.18 * (0.6 + tw * 0.4));
  ctx.restore();
}

export function star(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.35 : r;
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

export type Season = 'winter' | 'autumn' | 'spring' | 'summer';

export function seasonOf(month: number): Season {
  if (month === 10 || month === 11 || month <= 1) return 'winter';
  if (month >= 8) return 'autumn';
  if (month <= 4) return 'spring';
  return 'summer';
}

function skyColors(hour: number): [string, string] {
  if (hour >= 7 && hour < 16) return ['#9cc9ea', '#dcecf6'];
  if (hour >= 16 && hour < 19) return ['#e9a27a', '#f6d6a8'];
  if (hour >= 5 && hour < 7) return ['#b7a7d6', '#f3c9b4'];
  return ['#1d2547', '#3b4a7a'];
}

/** Oda arka planı: duvar, pencere (mevsim+saat), zemin, halı, süsler. */
export function drawRoom(ctx: Ctx, room: RoomDef, w: number, h: number, t: number, hour: number, season: Season, festive: boolean) {
  const wallH = h * 0.47;
  // duvar
  ctx.fillStyle = room.wall;
  ctx.fillRect(0, 0, w, wallH);
  ctx.fillStyle = room.wallDark;
  for (let x = 0; x < w; x += w / 12) ctx.fillRect(x, 0, w / 48, wallH);
  // süpürgelik
  ctx.fillStyle = shade(room.floor, -0.25);
  ctx.fillRect(0, wallH - h * 0.02, w, h * 0.025);

  // pencere
  const wx = w * 0.5, wy = h * 0.06, ww = Math.min(w * 0.44, h * 0.3), wh = h * 0.27;
  const [top, bot] = skyColors(hour);
  const g = ctx.createLinearGradient(0, wy, 0, wy + wh);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(wx - ww / 2, wy, ww, wh);
  ctx.save();
  ctx.beginPath();
  ctx.rect(wx - ww / 2, wy, ww, wh);
  ctx.clip();
  const night = hour < 5 || hour >= 19;
  if (night) {
    ctx.fillStyle = '#fff8d8';
    for (let i = 0; i < 14; i++) {
      const tw = (Math.sin(t * 2 + i * 7) + 1) / 2;
      ctx.globalAlpha = 0.4 + tw * 0.6;
      ellipse(ctx, wx - ww / 2 + ((i * 37) % 100) / 100 * ww, wy + ((i * 53) % 60) / 100 * wh, 1.2, 1.2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff4c4';
    ellipse(ctx, wx + ww * 0.28, wy + wh * 0.22, ww * 0.07, ww * 0.07);
    ctx.fill();
  }
  // tepeler + çam ağaçları
  const hill = season === 'winter' ? '#f4f7fb' : season === 'autumn' ? '#c99a5a' : '#8fbf6a';
  ctx.fillStyle = night ? shade(hill, -0.45) : hill;
  ctx.beginPath();
  ctx.moveTo(wx - ww / 2, wy + wh);
  ctx.quadraticCurveTo(wx - ww * 0.2, wy + wh * 0.55, wx + ww * 0.1, wy + wh * 0.75);
  ctx.quadraticCurveTo(wx + ww * 0.35, wy + wh * 0.6, wx + ww / 2, wy + wh * 0.72);
  ctx.lineTo(wx + ww / 2, wy + wh);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    const px = wx - ww * 0.42 + i * ww * 0.21, py = wy + wh * (0.82 + (i % 2) * 0.06);
    ctx.fillStyle = night ? '#24402f' : season === 'autumn' && i % 2 ? '#c4642c' : '#3f6b4a';
    ctx.beginPath();
    ctx.moveTo(px, py - wh * 0.28); ctx.lineTo(px - ww * 0.06, py); ctx.lineTo(px + ww * 0.06, py); ctx.closePath();
    ctx.fill();
    if (season === 'winter') {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(px, py - wh * 0.28); ctx.lineTo(px - ww * 0.025, py - wh * 0.18); ctx.lineTo(px + ww * 0.025, py - wh * 0.18); ctx.closePath(); ctx.fill();
    }
  }
  // kar / yaprak / yağmur
  if (season === 'winter' || season === 'autumn') {
    for (let i = 0; i < 26; i++) {
      const sp = 0.04 + (i % 5) * 0.012;
      const yy = ((t * sp + i * 0.137) % 1) * (wh + 10) + wy - 5;
      const xx = wx - ww / 2 + (((i * 0.61) % 1) * ww + Math.sin(t + i) * 6);
      if (season === 'winter') {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ellipse(ctx, xx, yy, 1.4 + (i % 3) * 0.6, 1.4 + (i % 3) * 0.6);
      } else {
        if (i % 3) continue;
        ctx.fillStyle = ['#d9773a', '#c9a23a', '#b84a32'][i % 3];
        ellipse(ctx, xx, yy, 3, 1.6, t * 2 + i);
      }
      ctx.fill();
    }
  }
  ctx.restore();
  // pencere çerçevesi
  ctx.strokeStyle = '#f7efe2';
  ctx.lineWidth = Math.max(3, ww * 0.035);
  ctx.strokeRect(wx - ww / 2, wy, ww, wh);
  ctx.beginPath();
  ctx.moveTo(wx, wy); ctx.lineTo(wx, wy + wh);
  ctx.moveTo(wx - ww / 2, wy + wh / 2); ctx.lineTo(wx + ww / 2, wy + wh / 2);
  ctx.stroke();
  ctx.fillStyle = '#f7efe2';
  ctx.fillRect(wx - ww / 2 - 6, wy + wh, ww + 12, Math.max(5, h * 0.015));
  if (season === 'winter') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(wx - ww / 2, wy + wh);
    for (let i = 0; i <= 10; i++) ctx.lineTo(wx - ww / 2 + (ww * i) / 10, wy + wh - 3 - (i % 2) * 3);
    ctx.lineTo(wx + ww / 2, wy + wh);
    ctx.fill();
  }
  // perdeler
  ctx.fillStyle = shade(room.wallDark, -0.25);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    const cx = wx + side * (ww / 2 + 4);
    ctx.moveTo(cx, wy - 6);
    ctx.lineTo(cx + side * ww * 0.18, wy - 6);
    ctx.quadraticCurveTo(cx + side * ww * 0.05, wy + wh * 0.6, cx + side * ww * 0.14, wy + wh + 8);
    ctx.lineTo(cx, wy + wh + 8);
    ctx.fill();
  }
  ctx.fillStyle = '#8a6a4a';
  ctx.fillRect(wx - ww / 2 - ww * 0.25, wy - 9, ww * 1.5, 4);

  roomDecor(ctx, room.id, w, h, t, wallH);

  // ışık zinciri (festive)
  if (festive) {
    ctx.strokeStyle = 'rgba(60,50,40,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const xx = (w * i) / 40;
      const yy = h * 0.025 + Math.sin((i / 40) * Math.PI * 4) ** 2 * h * 0.03;
      i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
    }
    ctx.stroke();
    const cols = ['#f6c34a', '#e86a6a', '#7cc4a2', '#7fb4e0'];
    for (let i = 1; i < 20; i++) {
      const xx = (w * i) / 20;
      const yy = h * 0.025 + Math.sin((i / 20) * Math.PI * 4) ** 2 * h * 0.03 + 4;
      const on = (Math.sin(t * 2 + i * 1.3) + 1) / 2;
      ctx.fillStyle = cols[i % 4];
      ctx.globalAlpha = 0.5 + on * 0.5;
      ellipse(ctx, xx, yy, 3, 4); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // zemin
  const fg = ctx.createLinearGradient(0, wallH, 0, h);
  fg.addColorStop(0, room.floorDark);
  fg.addColorStop(1, room.floor);
  ctx.fillStyle = fg;
  ctx.fillRect(0, wallH, w, h - wallH);
  ctx.strokeStyle = 'rgba(60,35,20,0.18)';
  ctx.lineWidth = 1;
  let row = 0;
  for (let y = wallH; y < h; y += h * 0.05, row++) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    for (let x = (row % 2) * w * 0.12; x < w; x += w * 0.24) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h * 0.05); ctx.stroke();
    }
  }
  // halı
  ctx.fillStyle = 'rgba(190,90,80,0.55)';
  ellipse(ctx, w * 0.5, h * 0.72, w * 0.42, h * 0.13);
  ctx.fill();
  ctx.strokeStyle = 'rgba(250,230,200,0.6)';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 6]);
  ellipse(ctx, w * 0.5, h * 0.72, w * 0.37, h * 0.105);
  ctx.stroke();
  ctx.setLineDash([]);

  // gece karartması + sıcak ışık
  if (night) {
    ctx.fillStyle = 'rgba(30,30,70,0.18)';
    ctx.fillRect(0, 0, w, h);
  }
}

function roomDecor(ctx: Ctx, id: string, w: number, h: number, t: number, wallH: number) {
  const s = Math.min(w * 0.13, h * 0.09);
  if (id === 'salon') {
    frame(ctx, w * 0.12, h * 0.12, s, 5);
    frame(ctx, w * 0.88, h * 0.16, s * 0.85, 8);
  } else if (id === 'mutfak') {
    // raf + kavanozlar
    for (const sx of [0.12, 0.88]) {
      const x = w * sx, y = h * 0.2;
      ctx.fillStyle = '#8a6a4a';
      ctx.fillRect(x - s * 0.8, y, s * 1.6, s * 0.12);
      const cols = ['#e9c46a', '#c96b5b', '#81b29a'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        roundRect(ctx, x - s * 0.7 + i * s * 0.5, y - s * 0.45, s * 0.36, s * 0.45, s * 0.06);
        ctx.fill();
        ctx.fillStyle = cols[i];
        ctx.fillRect(x - s * 0.66 + i * s * 0.5, y - s * 0.25, s * 0.28, s * 0.22);
        ctx.fillStyle = '#b5835a';
        ctx.fillRect(x - s * 0.72 + i * s * 0.5, y - s * 0.52, s * 0.4, s * 0.08);
      }
      // asılı tava
      ctx.strokeStyle = '#5a4a40';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y + s * 0.12); ctx.lineTo(x, y + s * 0.5); ctx.stroke();
      ctx.fillStyle = sx < 0.5 ? '#c97a4a' : '#6a6f78';
      ellipse(ctx, x, y + s * 0.85, s * 0.35, s * 0.35); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ellipse(ctx, x - s * 0.1, y + s * 0.75, s * 0.15, s * 0.1); ctx.fill();
    }
  } else if (id === 'cati') {
    // eğik çatı kirişleri
    ctx.fillStyle = '#7a5a44';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      const x0 = side < 0 ? 0 : w;
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0 + side * -w * 0.24, 0);
      ctx.lineTo(x0, wallH * 0.75);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#5e4434';
    ctx.fillRect(0, 0, w, h * 0.022);
    // asılı yıldız süsleri
    for (const [sx, len] of [[0.27, 0.12], [0.75, 0.16]] as const) {
      ctx.strokeStyle = 'rgba(80,60,50,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w * sx, 0); ctx.lineTo(w * sx, h * len); ctx.stroke();
      ctx.fillStyle = '#f6c34a';
      const sw = Math.sin(t * 1.5 + sx * 10) * 0.2;
      ctx.save(); ctx.translate(w * sx, h * len + s * 0.15); ctx.rotate(sw);
      star(ctx, 0, 0, s * 0.18);
      ctx.restore();
    }
  } else if (id === 'sera') {
    // cam bölmeler + sarkan sarmaşıklar
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    for (let x = w / 6; x < w; x += w / 6) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, wallH); ctx.stroke(); }
    for (const sx of [0.08, 0.92]) {
      const x = w * sx;
      ctx.fillStyle = '#c06a4a';
      roundRect(ctx, x - s * 0.3, h * 0.04, s * 0.6, s * 0.35, s * 0.08); ctx.fill();
      ctx.fillStyle = '#5f9a5a';
      for (let i = 0; i < 5; i++) {
        const sway = Math.sin(t * 1.1 + i) * s * 0.04;
        for (let k = 0; k < 5 + (i % 3); k++) {
          ellipse(ctx, x - s * 0.25 + i * s * 0.12 + sway * k * 0.3, h * 0.04 + s * 0.4 + k * s * 0.22, s * 0.07, s * 0.1, 0.5 * (k % 2 ? 1 : -1));
          ctx.fill();
        }
      }
    }
  }
}

function frame(ctx: Ctx, x: number, y: number, s: number, seed: number) {
  ctx.fillStyle = '#8a6a4a';
  ctx.fillRect(x - s / 2 - 3, y - s / 2 - 3, s + 6, s * 0.8 + 6);
  ctx.fillStyle = '#f6efe3';
  ctx.fillRect(x - s / 2, y - s / 2, s, s * 0.8);
  // küçük kedi silüeti ya da balık
  ctx.fillStyle = ['#e8a04c', '#7d6aa8', '#5f9a5a', '#c96b5b'][seed % 4];
  if (seed % 2) {
    ellipse(ctx, x, y - s * 0.05, s * 0.25, s * 0.12);
    ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + s * 0.2, y - s * 0.05); ctx.lineTo(x + s * 0.38, y - s * 0.18); ctx.lineTo(x + s * 0.38, y + s * 0.08); ctx.fill();
  } else {
    ellipse(ctx, x, y + s * 0.05, s * 0.18, s * 0.15); ctx.fill();
    ellipse(ctx, x, y - s * 0.14, s * 0.12, s * 0.1); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - s * 0.12, y - s * 0.18); ctx.lineTo(x - s * 0.08, y - s * 0.3); ctx.lineTo(x - s * 0.02, y - s * 0.2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + s * 0.12, y - s * 0.18); ctx.lineTo(x + s * 0.08, y - s * 0.3); ctx.lineTo(x + s * 0.02, y - s * 0.2); ctx.fill();
  }
}

/** Boş slot: kesikli "+" daire. */
export function drawEmptySlot(ctx: Ctx, x: number, y: number, u: number, t: number, highlight: boolean) {
  ctx.save();
  const pulse = 1 + Math.sin(t * 3) * 0.04;
  ctx.strokeStyle = highlight ? 'rgba(255,255,255,0.95)' : 'rgba(255,248,235,0.6)';
  ctx.fillStyle = highlight ? 'rgba(255,255,255,0.25)' : 'rgba(255,248,235,0.12)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ellipse(ctx, x, y - u * 0.05, u * 0.38 * pulse, u * 0.13 * pulse);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,248,235,0.85)';
  ctx.font = `600 ${Math.round(u * 0.22)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', x, y - u * 0.06);
  ctx.restore();
}
