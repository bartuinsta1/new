import './style.css';
import {
  BREEDS, BREED_BY_ID, FURNITURE, FURNITURE_BY_ID, RARITY_LABEL, ROOMS, ROOM_BY_ID, TAG_INFO,
  type FurnitureDef,
} from './data';
import {
  bestSeatFor, buyFurniture, catAt, catchUp, catIncome, claimDaily, cleanMess, dailyAmount, dayKey,
  freeSeats, isMatch, levelOf, levelProgress, load, newGame, placeCat, removeFurniture, resetSave,
  roomComfort, save, tick, totalIncome, unlockRoom, type Cat, type GameEvent, type GameState, type Seat,
} from './game';
import { drawCat, drawEmptySlot, drawFurniture, drawMess, drawRoom, seasonOf, seatPoints } from './draw';
import { setMusic, setSfx, sfx, unlockAudio } from './audio';

// ---------- durum ----------
const params = new URLSearchParams(location.search);
const monthOverride = params.has('month') ? Number(params.get('month')) : null;
const month = () => monthOverride ?? new Date().getMonth();
const hourOverride = params.has('hour') ? Number(params.get('hour')) : null;
const hour = () => hourOverride ?? new Date().getHours();
const isFestive = () => month() === 10 || month() === 11;

let state: GameState = load() ?? newGame();
let currentRoom = 'salon';
let selectedCat: number | null = null;
const petted = new Map<number, number>(); // uid -> zaman (sn)
const incomeAcc = new Map<number, { amt: number; since: number }>();
let time = 0;

setMusic(state.settings.music);
setSfx(state.settings.sfx);

// ---------- DOM ----------
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('scene');
const ctx = canvas.getContext('2d')!;
const stage = $('stage');
const floaters = $('floaters');
const queueEl = $('queue');
const roomsEl = $('rooms');
const sheetWrap = $('sheet-wrap');
const sheetBody = $('sheet-body');
const hintEl = $('hint');
const toastEl = $('toast');

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2.5);
  W = stage.clientWidth;
  H = stage.clientHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
}
new ResizeObserver(resize).observe(stage);
resize();

const unit = () => Math.min(W * 0.22, H * 0.17);

// ---------- yardımcılar ----------
const fmt = (n: number) => {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1).replace('.0', '') + 'B';
  return n.toLocaleString('tr-TR');
};
const fmtTime = (sec: number) => {
  sec = Math.max(0, Math.round(sec));
  if (sec >= 3600) return `${Math.floor(sec / 3600)} sa ${Math.floor((sec % 3600) / 60)} dk`;
  if (sec >= 60) return `${Math.floor(sec / 60)} dk ${sec % 60} sn`;
  return `${sec} sn`;
};

let toastTimer = 0;
function toast(msg: string) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function floater(text: string, x: number, y: number, big = false) {
  const el = document.createElement('div');
  el.className = 'floater' + (big ? ' big' : '');
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  floaters.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

function catCanvas(breedId: string, size: number, pose: 'sit' | 'loaf' | 'sleep' = 'sit', happy = false): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size * DPR;
  c.height = size * DPR;
  const g = c.getContext('2d')!;
  g.scale(DPR, DPR);
  drawCat(g, size / 2 - (pose === 'sit' ? size * 0.06 : -size * 0.04), size * 0.9, size * (pose === 'sit' ? 0.72 : 0.62), BREED_BY_ID[breedId], pose, 0.6, 0, happy);
  return c;
}

function furnitureCanvas(f: FurnitureDef, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w * DPR;
  c.height = h * DPR;
  const g = c.getContext('2d')!;
  g.scale(DPR, DPR);
  const tall = ['tree', 'bookshelf', 'lamp', 'fireplace', 'hammock'].includes(f.kind);
  const u = tall ? h * 0.72 : Math.min(w * 0.75, h * 1.1);
  drawFurniture(g, f, w / 2, h * 0.9, u, 0.5);
  return c;
}

// ---------- sahne geometrisi ----------
interface SlotGeo { x: number; y: number }
function slotGeo(slot: number): SlotGeo {
  const s = ROOM_BY_ID[currentRoom].slots[slot];
  return { x: s.x * W, y: s.y * H };
}

function seatGeo(seat: Seat) {
  const f = FURNITURE_BY_ID[state.rooms[seat.room].furniture[seat.slot]!];
  const p = seatPoints(f)[seat.seat];
  const g = slotGeo(seat.slot);
  const u = unit();
  return { x: g.x + p.dx * u, y: g.y + p.dy * u, size: u * 0.95 * p.scale, pose: p.pose };
}

type Hit =
  | { kind: 'mess'; id: number }
  | { kind: 'cat'; cat: Cat }
  | { kind: 'seat'; seat: Seat }
  | { kind: 'furniture'; slot: number }
  | { kind: 'empty'; slot: number };

function hitTest(px: number, py: number): Hit | null {
  const u = unit();
  const room = state.rooms[currentRoom];
  if (!room) return null;
  // dağınıklıklar
  for (const m of state.messes) {
    if (m.room !== currentRoom) continue;
    if (Math.hypot(px - m.x * W, py - m.y * H) < u * 0.42) return { kind: 'mess', id: m.id };
  }
  // seçili kedi varken koltuklar
  if (selectedCat !== null) {
    let best: { seat: Seat; d: number } | null = null;
    for (const s of freeSeats(state)) {
      if (s.room !== currentRoom) continue;
      const g = seatGeo(s);
      const d = Math.hypot(px - g.x, py - (g.y - g.size * 0.3));
      if (d < u * 0.6 && (!best || d < best.d)) best = { seat: s, d };
    }
    if (best) return { kind: 'seat', seat: best.seat };
  }
  // kediler (öndekiler önce)
  const guests = state.guests.filter((c) => c.room === currentRoom).map((c) => ({ c, g: seatGeo(c as Seat) }));
  guests.sort((a, b) => b.g.y - a.g.y);
  for (const { c, g } of guests) {
    if (Math.hypot(px - g.x, py - (g.y - g.size * 0.35)) < g.size * 0.5) return { kind: 'cat', cat: c };
  }
  // mobilya / boş slot
  const order = room.furniture.map((_, i) => i).sort((a, b) => slotGeo(b).y - slotGeo(a).y);
  for (const i of order) {
    const g = slotGeo(i);
    const f = room.furniture[i];
    if (f) {
      const def = FURNITURE_BY_ID[f];
      const tall = ['tree', 'bookshelf', 'lamp', 'fireplace', 'hammock', 'radiator'].includes(def.kind) ? 1.15 : 0.7;
      if (px > g.x - u * 0.55 && px < g.x + u * 0.55 && py > g.y - u * tall && py < g.y + u * 0.12)
        return { kind: 'furniture', slot: i };
    } else if (Math.hypot(px - g.x, (py - g.y) * 1.6) < u * 0.45) {
      return { kind: 'empty', slot: i };
    }
  }
  return null;
}

// ---------- girdi ----------
let audioUnlocked = false;
canvas.addEventListener('pointerdown', (e) => {
  if (!audioUnlocked) { unlockAudio(); audioUnlocked = true; }
  const r = canvas.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  const hit = hitTest(px, py);
  if (!hit) {
    if (selectedCat !== null) { selectedCat = null; renderQueue(); }
    return;
  }
  switch (hit.kind) {
    case 'mess': {
      const m = state.messes.find((x) => x.id === hit.id)!;
      const res = cleanMess(state, hit.id);
      if (!res) return;
      sfx('clean');
      floater(`+${res.fish}🐟`, m.x * W, m.y * H);
      if (res.hearts) floater('+1❤️', m.x * W + 30, m.y * H - 20);
      if (res.levelUp) onLevelUp(res.levelUp);
      sparkle(m.x * W, m.y * H);
      if (state.tutorial === 3) advanceTutorial();
      break;
    }
    case 'seat': {
      const cat = state.queue.find((c) => c.uid === selectedCat);
      if (cat && placeCat(state, cat.uid, hit.seat)) onPlaced(cat);
      break;
    }
    case 'cat': {
      petCat(hit.cat);
      break;
    }
    case 'furniture': {
      sfx('tap');
      openFurnitureSheet(hit.slot);
      break;
    }
    case 'empty': {
      sfx('tap');
      openShop(hit.slot);
      break;
    }
  }
  refreshHud();
});

function petCat(cat: Cat) {
  const g = seatGeo(cat as Seat);
  const last = petted.get(cat.uid) ?? -99;
  sfx('purr');
  floater('💕', g.x, g.y - g.size * 0.8);
  if (time - last > 30) {
    state.fish += 1;
    floater('+1🐟', g.x + 24, g.y - g.size * 0.5);
  }
  petted.set(cat.uid, time);
}

function sparkle(x: number, y: number) {
  for (let i = 0; i < 3; i++) setTimeout(() => floater('✨', x + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 30), i * 90);
}

function onPlaced(cat: Cat) {
  const breed = BREED_BY_ID[cat.breed];
  const g = seatGeo(cat as Seat);
  sfx('place');
  const match = isMatch(state, cat);
  floater(match ? '💖 Tam sevdiği yer!' : '😊', g.x, g.y - g.size, match);
  if (state.album[cat.breed] === 1) toast(`📖 Yeni kedi albüme eklendi: ${breed.name}!`);
  selectedCat = null;
  renderQueue();
  if (state.tutorial <= 1) advanceTutorial(2);
}

function onLevelUp(level: number) {
  sfx('level');
  const unlocked = FURNITURE.filter((f) => f.unlockLevel === level).map((f) => f.name);
  const rooms = ROOMS.filter((r) => r.unlockLevel === level).map((r) => r.name);
  const breeds = BREEDS.filter((b) => b.minLevel === level && !b.months).map((b) => b.name);
  openSheet(`
    <div class="hero">
      <div class="big">🏡✨</div>
      <h2>Han ${level}. seviyeye ulaştı!</h2>
      <p>Kasabada adın duyuluyor. Daha çok kedi kapını çalacak.</p>
    </div>
    <div class="stack">
      ${unlocked.length ? `<div class="banner">🛋️ Yeni mobilyalar: ${unlocked.join(', ')}</div>` : ''}
      ${rooms.length ? `<div class="banner">🚪 Açılabilir oda: ${rooms.join(', ')}</div>` : ''}
      ${breeds.length ? `<div class="banner">🐾 Yeni ziyaretçiler gelebilir: ${breeds.join(', ')}</div>` : ''}
      <button class="btn" data-close>Harika!</button>
    </div>`);
}

// ---------- kuyruk ----------
function renderQueue() {
  queueEl.innerHTML = '';
  if (!state.queue.length) {
    const e = document.createElement('div');
    e.className = 'empty';
    e.textContent = freeSeats(state).length ? 'Kar yağıyor… yakında biri gelir.' : 'Yeni misafir için boş yer lazım.';
    queueEl.appendChild(e);
  }
  for (const cat of state.queue) {
    const b = document.createElement('button');
    b.className = 'qcat' + (cat.uid === selectedCat ? ' sel' : '');
    b.setAttribute('aria-label', `${cat.name}, ${BREED_BY_ID[cat.breed].name}, ${TAG_INFO[cat.pref].label} yer sever`);
    b.appendChild(catCanvas(cat.breed, 64));
    const p = document.createElement('span');
    p.className = 'pref';
    p.textContent = TAG_INFO[cat.pref].icon;
    b.appendChild(p);
    if (!state.album[cat.breed]) {
      const n = document.createElement('span');
      n.className = 'new';
      n.textContent = 'YENİ';
      b.appendChild(n);
    }
    b.onclick = () => {
      if (!audioUnlocked) { unlockAudio(); audioUnlocked = true; }
      sfx('tap');
      if (selectedCat === cat.uid) {
        // ikinci dokunuş: en iyi yere otomatik yerleştir
        const seat = bestSeatFor(state, cat);
        if (seat && placeCat(state, cat.uid, seat)) {
          if (seat.room !== currentRoom) switchRoom(seat.room);
          onPlaced(cat);
        } else {
          toast('Boş yer yok! Bir mobilya ekle.');
          sfx('error');
        }
      } else {
        selectedCat = cat.uid;
        const free = freeSeats(state);
        const b = BREED_BY_ID[cat.breed];
        toast(`${cat.name} (${b.name}) · ${TAG_INFO[cat.pref].icon} ${TAG_INFO[cat.pref].label} yerleri sever`);
        if (!free.length) {
          toast('Boş yer yok! Boş "+" alana mobilya koy.');
        } else if (!free.some((s) => s.room === currentRoom)) {
          switchRoom(free[0].room);
        }
        if (state.tutorial === 0) advanceTutorial();
      }
      renderQueue();
    };
    queueEl.appendChild(b);
  }
}

// ---------- odalar ----------
function switchRoom(id: string) {
  currentRoom = id;
  renderRooms();
}

function renderRooms() {
  roomsEl.innerHTML = '';
  const lvl = levelOf(state.hearts);
  for (const r of ROOMS) {
    const owned = !!state.rooms[r.id];
    const b = document.createElement('button');
    b.className = 'room-tab' + (r.id === currentRoom ? ' on' : '') + (owned ? '' : ' locked');
    b.innerHTML = `<span class="ri">${owned ? r.icon : lvl >= r.unlockLevel ? '🔓' : '🔒'}</span>${r.name}`;
    if (owned) {
      const messes = state.messes.filter((m) => m.room === r.id).length;
      const free = freeSeats(state).filter((s) => s.room === r.id).length;
      if (messes) b.insertAdjacentHTML('beforeend', `<span class="badge">${messes}</span>`);
      else if (free && selectedCat !== null) b.insertAdjacentHTML('beforeend', `<span class="badge seat">${free}</span>`);
    } else if (lvl >= r.unlockLevel) {
      b.insertAdjacentHTML('beforeend', `<span class="badge seat">!</span>`);
    }
    b.onclick = () => {
      sfx('tap');
      if (owned) switchRoom(r.id);
      else openUnlock(r.id);
    };
    roomsEl.appendChild(b);
  }
}

function openUnlock(id: string) {
  const r = ROOM_BY_ID[id];
  const lvl = levelOf(state.hearts);
  const canLevel = lvl >= r.unlockLevel;
  openSheet(`
    <div class="hero">
      <div class="big">${r.icon}</div>
      <h2>${r.name}</h2>
      <p>${canLevel ? 'Hanı genişletme zamanı! Bu odada 6 yeni mobilya alanı var.' : `Bu oda ${r.unlockLevel}. seviyede açılır. Kedileri mutlu ederek kalp topla.`}</p>
    </div>
    <button class="btn" id="unlock-btn" ${canLevel && state.fish >= r.price ? '' : 'disabled'} style="width:100%">
      ${canLevel ? `Aç · ${fmt(r.price)} 🐟` : `🔒 Seviye ${r.unlockLevel}`}
    </button>`);
  $('unlock-btn').onclick = () => {
    const res = unlockRoom(state, id);
    if (res === 'ok') {
      sfx('buy');
      closeSheet();
      switchRoom(id);
      toast(`${r.name} açıldı! Hadi döşeyelim.`);
      save(state);
    } else {
      sfx('error');
    }
  };
}

// ---------- sayfalar ----------
function openSheet(html: string) {
  sheetBody.innerHTML = html;
  sheetWrap.hidden = false;
  sheetBody.querySelectorAll<HTMLElement>('[data-close]').forEach((el) => (el.onclick = closeSheet));
}
function closeSheet() {
  sheetWrap.hidden = true;
  sheetBody.innerHTML = '';
}
$('sheet-close').onclick = closeSheet;
sheetWrap.addEventListener('pointerdown', (e) => {
  if (e.target === sheetWrap) closeSheet();
});

function openShop(slot: number) {
  const lvl = levelOf(state.hearts);
  openSheet(`
    <h2>Mobilya Dükkânı</h2>
    <p class="sub">${ROOM_BY_ID[currentRoom].name} · Konfor ${roomComfort(state, currentRoom)} · Kediler sevdikleri ${Object.values(TAG_INFO).map((t) => t.icon).join('')} yerlerde 2× mutlu olur.</p>
    <div class="grid" id="shop-grid"></div>`);
  const grid = $('shop-grid');
  for (const f of FURNITURE) {
    const locked = lvl < f.unlockLevel;
    const card = document.createElement('button');
    card.className = 'card' + (locked ? ' locked' : '') + (state.fish < f.price ? ' poor' : '');
    card.appendChild(furnitureCanvas(f, 150, 86));
    card.insertAdjacentHTML('beforeend', `
      <div class="nm">${f.name}</div>
      <div class="meta">${f.tag ? `<span>${TAG_INFO[f.tag].icon} ${TAG_INFO[f.tag].label}</span>` : ''}${f.seats ? `<span>🐱×${f.seats}</span>` : ''}<span>✨+${f.comfort}</span></div>
      <div class="meta">${f.desc}</div>
      <div class="price">${fmt(f.price)} 🐟</div>
      ${locked ? `<span class="lock">🔒 Sv ${f.unlockLevel}</span>` : ''}`);
    card.onclick = () => {
      const res = buyFurniture(state, currentRoom, slot, f.id);
      if (res === 'ok') {
        sfx('buy');
        closeSheet();
        const g = slotGeo(slot);
        sparkle(g.x, g.y - unit() * 0.3);
        if (state.tutorial === 2) advanceTutorial();
        save(state);
        refreshHud();
        renderQueue();
      } else {
        sfx('error');
        toast(res === 'fish' ? `${fmt(f.price - state.fish)} balık daha lazım 🐟` : res === 'level' ? `Seviye ${f.unlockLevel} gerekli ❤️` : 'Burası dolu.');
      }
    };
    grid.appendChild(card);
  }
}

function openFurnitureSheet(slot: number) {
  const id = state.rooms[currentRoom].furniture[slot]!;
  const f = FURNITURE_BY_ID[id];
  const guests = state.guests.filter((c) => c.room === currentRoom && c.slot === slot);
  openSheet(`
    <h2>${f.name}</h2>
    <p class="sub">${f.tag ? `${TAG_INFO[f.tag].icon} ${TAG_INFO[f.tag].label} · ` : ''}${f.seats} yer · ✨+${f.comfort} konfor</p>
    <div class="stack" id="guest-list"></div>
    <div class="row" style="margin-top:14px">
      <button class="btn ghost" id="remove-btn" ${guests.length ? 'disabled' : ''}>Kaldır (+${fmt(Math.floor(f.price / 2))} 🐟)</button>
    </div>`);
  const list = $('guest-list');
  if (!guests.length && f.seats) list.innerHTML = `<p class="sub">Şu an boş. Kapıdaki bir kediyi seçip buraya dokun.</p>`;
  if (!f.seats) list.innerHTML = `<p class="sub">Dekor: odadaki tüm kedilerin konforunu artırır.</p>`;
  for (const c of guests) {
    const b = BREED_BY_ID[c.breed];
    const row = document.createElement('div');
    row.className = 'guest';
    row.appendChild(catCanvas(c.breed, 64, 'sit', true));
    const match = isMatch(state, c);
    row.insertAdjacentHTML('beforeend', `
      <div class="info"><b>${c.name}</b> · ${b.name}<br>
      <span class="tag ${match ? 'match' : ''}">${TAG_INFO[c.pref].icon} ${TAG_INFO[c.pref].label} sever${match ? ' ✓' : ''}</span>
      <span class="tag">${RARITY_LABEL[b.rarity]}</span><br>
      🐟 ${(catIncome(state, c) * 60).toFixed(1)}/dk · ⏳ ${fmtTime(c.remaining)}</div>`);
    list.appendChild(row);
  }
  $('remove-btn').onclick = () => {
    const refund = removeFurniture(state, currentRoom, slot);
    if (refund !== null) {
      sfx('tap');
      toast(`+${refund} 🐟 geri alındı`);
      closeSheet();
      refreshHud();
      save(state);
    }
  };
}

function openAlbum() {
  const seen = BREEDS.filter((b) => state.album[b.id]).length;
  openSheet(`
    <h2>Kedi Albümü</h2>
    <p class="sub">${seen} / ${BREEDS.length} cins ağırlandı. Mevsimlik kediler sadece belirli aylarda gelir.</p>
    <div class="grid album" id="album-grid"></div>`);
  const grid = $('album-grid');
  for (const b of BREEDS) {
    const count = state.album[b.id] ?? 0;
    const card = document.createElement('div');
    card.className = 'card' + (count ? '' : ' unknown');
    const cv = catCanvas(b.id, 92, 'sit', !!count);
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.appendChild(cv);
    card.appendChild(thumb);
    const season = b.months ? (b.months.includes(10) && b.months.includes(0) ? '❄️ Kış' : '🍂 Sonbahar') : '';
    card.insertAdjacentHTML('beforeend', `
      <div class="nm">${count ? b.name : '???'}</div>
      <div class="meta"><span>${'★'.repeat(b.rarity)}${'☆'.repeat(4 - b.rarity)}</span>${season ? `<span>${season}</span>` : ''}${count ? `<span>×${count}</span>` : ''}</div>
      <div class="meta">${count ? b.blurb : `Seviye ${b.minLevel}+`}</div>`);
    grid.appendChild(card);
  }
}

function openMenu() {
  const lvl = levelOf(state.hearts);
  openSheet(`
    <h2>Han Defteri</h2>
    <p class="sub">Mırnav Hanı · Seviye ${lvl}</p>
    <div class="stats">
      <div class="stat"><b>${fmt(state.served)}</b><span>ağırlanan kedi</span></div>
      <div class="stat"><b>${fmt(state.cleaned)}</b><span>temizlik</span></div>
      <div class="stat"><b>${fmt(state.totalFish)}</b><span>toplam balık</span></div>
      <div class="stat"><b>${state.hearts}</b><span>sevgi ❤️</span></div>
    </div>
    <div class="stack" style="margin-top:12px">
      <label class="toggle">🎵 Müzik <input type="checkbox" id="opt-music" ${state.settings.music ? 'checked' : ''}></label>
      <label class="toggle">🔔 Efektler <input type="checkbox" id="opt-sfx" ${state.settings.sfx ? 'checked' : ''}></label>
      <div class="banner">📱 Telefonda tarayıcı menüsünden “Ana Ekrana Ekle” deyip uygulama gibi oynayabilirsin. İnternetsiz de çalışır.</div>
      <button class="btn ghost" id="reset-btn">Hanı sıfırla</button>
    </div>`);
  $<HTMLInputElement>('opt-music').onchange = (e) => {
    state.settings.music = (e.target as HTMLInputElement).checked;
    unlockAudio();
    setMusic(state.settings.music);
    save(state);
  };
  $<HTMLInputElement>('opt-sfx').onchange = (e) => {
    state.settings.sfx = (e.target as HTMLInputElement).checked;
    setSfx(state.settings.sfx);
    save(state);
  };
  $('reset-btn').onclick = () => {
    if (confirm('Tüm ilerleme silinecek. Emin misin?')) {
      resetSave();
      state = newGame();
      currentRoom = 'salon';
      selectedCat = null;
      closeSheet();
      renderAll();
      showHint();
    }
  };
}

$('btn-album').onclick = () => { sfx('tap'); openAlbum(); };
$('btn-menu').onclick = () => { sfx('tap'); openMenu(); };
$('level-pill').onclick = () => {
  const p = levelProgress(state.hearts);
  toast(`Seviye ${p.level} · ${p.cur}/${p.need} ❤️ — kedileri sevdiği yerlere koy, dağınıklığı topla.`);
};
$('fish-pill').onclick = () => toast(`Dakikada ${(totalIncome(state) * 60).toFixed(1)} 🐟 · Misafirler ayrılırken bahşiş bırakır.`);

// ---------- öğretici ----------
const HINTS = [
  'Kapıda bir kedi bekliyor! Ona dokun 👆',
  'Şimdi parlayan mindere dokun. (Kediye ikinci kez dokunursan en iyi yere kendisi geçer.)',
  'Daha çok misafir için kesikli “+” alana dokunup mobilya al. Kediler 🔥🌙🧶🪟 türlerini sever.',
  'Kedilerin dağınıklıklarına ✨ dokunarak topla.',
];
function showHint() {
  if (state.tutorial >= HINTS.length || !sheetWrap.hidden) { hintEl.hidden = true; return; }
  if (state.tutorial === 0 && !state.queue.length) { hintEl.hidden = true; return; }
  if (state.tutorial === 2 && state.fish < 20) { hintEl.hidden = true; return; }
  if (state.tutorial === 3 && !state.messes.some((m) => m.room === currentRoom)) { hintEl.hidden = true; return; }
  if (hintEl.textContent !== HINTS[state.tutorial]) hintEl.textContent = HINTS[state.tutorial];
  hintEl.hidden = false;
}
function advanceTutorial(to?: number) {
  state.tutorial = to ?? state.tutorial + 1;
  showHint();
}

// ---------- HUD ----------
let lastFishShown = -1;
function refreshHud() {
  const f = Math.floor(state.fish);
  if (f !== lastFishShown) {
    $('fish').textContent = fmt(f);
    lastFishShown = f;
  }
  const rate = totalIncome(state) * 60;
  $('rate').textContent = rate > 0 ? `+${rate.toFixed(1)}/dk` : '';
  const p = levelProgress(state.hearts);
  $('lvl').textContent = String(p.level);
  $<HTMLElement>('lvlbar').style.width = `${(p.cur / p.need) * 100}%`;
  $('btn-album').classList.toggle('dot', false);
}

function renderAll() {
  renderQueue();
  renderRooms();
  refreshHud();
}

// ---------- olaylar ----------
function handleEvents(events: GameEvent[], quiet = false) {
  let needQueue = false, needRooms = false;
  for (const e of events) {
    switch (e.type) {
      case 'arrive':
        needQueue = true;
        if (!quiet) sfx('arrive');
        break;
      case 'leave': {
        needQueue = needRooms = true;
        incomeAcc.delete(e.cat.uid);
        petted.delete(e.cat.uid);
        if (!quiet && e.cat.room === currentRoom) {
          const g = slotGeo(e.cat.slot!);
          floater(`👋 ${e.cat.name} +${e.fish}🐟 +${e.hearts}❤️`, g.x, g.y - unit() * 0.8, true);
          sfx('leave');
        } else if (!quiet) {
          toast(`👋 ${e.cat.name} teşekkür etti: +${e.fish}🐟 +${e.hearts}❤️`);
        }
        break;
      }
      case 'mess':
        needRooms = true;
        break;
      case 'levelup':
        needRooms = true;
        if (!quiet) onLevelUp(e.level);
        break;
    }
  }
  if (needQueue) renderQueue();
  if (needRooms) renderRooms();
  if (events.length) showHint();
}

// ---------- döngü ----------
let last = performance.now();
let saveTimer = 0;
let hudTimer = 0;
function frame(now: number) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  time += dt;
  const before = new Map(state.guests.map((c) => [c.uid, catIncome(state, c) * dt]));
  const events = tick(state, dt, Math.random, month());
  handleEvents(events);
  for (const [uid, amt] of before) {
    const a = incomeAcc.get(uid) ?? { amt: 0, since: time };
    a.amt += amt;
    incomeAcc.set(uid, a);
    if (time - a.since > 5 && a.amt >= 1) {
      const cat = state.guests.find((c) => c.uid === uid);
      if (cat && cat.room === currentRoom) {
        const g = seatGeo(cat as Seat);
        floater(`+${Math.floor(a.amt)}🐟`, g.x, g.y - g.size * 0.9);
      }
      a.amt -= Math.floor(a.amt);
      a.since = time + Math.random() * 2;
    }
  }
  hudTimer += dt;
  if (hudTimer > 0.25) { refreshHud(); showHint(); hudTimer = 0; }
  saveTimer += dt;
  if (saveTimer > 5) {
    state.lastSeen = Date.now();
    save(state);
    saveTimer = 0;
  }
  draw();
  requestAnimationFrame(frame);
}

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const room = ROOM_BY_ID[currentRoom];
  const rs = state.rooms[currentRoom];
  drawRoom(ctx, room, W, H, time, hour(), seasonOf(month()), isFestive());
  if (!rs) return;
  const u = unit();
  const selCat = selectedCat !== null ? state.queue.find((c) => c.uid === selectedCat) : undefined;

  type D = { y: number; fn: () => void };
  const list: D[] = [];
  rs.furniture.forEach((fid, slot) => {
    const g = slotGeo(slot);
    if (!fid) {
      list.push({ y: g.y - 1000, fn: () => drawEmptySlot(ctx, g.x, g.y, u, time, false) });
      return;
    }
    const f = FURNITURE_BY_ID[fid];
    list.push({
      y: g.y,
      fn: () => {
        drawFurniture(ctx, f, g.x, g.y, u, time);
        seatPoints(f).forEach((p, seat) => {
          const cat = catAt(state, currentRoom, slot, seat);
          const sx = g.x + p.dx * u, sy = g.y + p.dy * u, size = u * 0.95 * p.scale;
          if (cat) {
            const happy = time - (petted.get(cat.uid) ?? -99) < 1.6;
            drawCat(ctx, sx, sy, size, BREED_BY_ID[cat.breed], happy ? 'sit' : p.pose, time, cat.uid, happy);
            if (isMatch(state, cat) && Math.sin(time * 1.3 + cat.uid) > 0.85) {
              ctx.font = `${Math.round(size * 0.25)}px system-ui`;
              ctx.textAlign = 'center';
              ctx.fillText('💗', sx + size * 0.35, sy - size * 1.05 - (Math.sin(time * 1.3 + cat.uid) - 0.85) * 60);
            }
          } else if (selCat) {
            const match = f.tag === selCat.pref;
            const pulse = (Math.sin(time * 5) + 1) / 2;
            ctx.save();
            ctx.fillStyle = match ? `rgba(255,120,150,${0.35 + pulse * 0.3})` : `rgba(255,255,255,${0.3 + pulse * 0.3})`;
            ctx.strokeStyle = match ? '#ff7896' : '#fff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(sx, sy - size * 0.25, size * 0.42, size * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.font = `${Math.round(size * 0.3)}px system-ui`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(match ? '💖' : '⬇️', sx, sy - size * 0.75 - pulse * 6);
            ctx.restore();
          }
        });
      },
    });
  });
  for (const m of state.messes) {
    if (m.room !== currentRoom) continue;
    list.push({ y: m.y * H + 1, fn: () => drawMess(ctx, m.kind, m.x * W, m.y * H, u, time, m.id) });
  }
  list.sort((a, b) => a.y - b.y);
  for (const d of list) d.fn();
}

// ---------- açılış ----------
function welcome() {
  const r = catchUp(state, Date.now(), Math.random, month());
  handleEvents(r.events, true);
  const left = r.events.filter((e) => e.type === 'leave');
  const today = dayKey(new Date());
  const dailyReady = state.lastDaily !== today;
  const bits: string[] = [];
  if (r.seconds > 120 && (r.fish >= 1 || left.length)) {
    bits.push(`<div class="banner">🌙 ${fmtTime(r.seconds)} yoktun. Misafirler <b>${fmt(r.fish)} 🐟</b> kazandırdı${left.length ? `, ${left.length} kedi teşekkür edip ayrıldı` : ''}.</div>`);
  }
  if (isFestive()) bits.push(`<div class="banner">❄️ <b>İlk Kar Festivali</b> başladı! Nadir <b>Kartopu</b> kedisi bu mevsim kapını çalabilir.</div>`);
  else if (month() === 8 || month() === 9) bits.push(`<div class="banner">🍂 Sonbahar geldi! Nadir <b>Balkabağı</b> kedisi ortalıkta dolaşıyor.</div>`);
  const isNew = state.served === 0 && state.guests.length === 0 && state.tutorial === 0;
  if (!dailyReady && !bits.length && !isNew) return;
  openSheet(`
    <div class="hero">
      <div class="big">${isNew ? '🏔️🐾' : '🏡☕'}</div>
      <h2>${isNew ? 'Mırnav Hanı’na hoş geldin' : 'Tekrar hoş geldin!'}</h2>
      <p>${isNew ? 'Dağ kasabasına kış geliyor. Bu eski hanı, soğukta kalan kediler için sıcacık bir yuvaya çevir.' : 'Şömine çıtırdıyor, kediler seni bekliyor.'}</p>
    </div>
    <div class="stack">
      ${bits.join('')}
      ${dailyReady ? `<button class="btn alt" id="daily-btn">🎁 Günlük hediye: ${dailyAmount(state)} 🐟</button>` : ''}
      <button class="btn" data-close>${isNew ? 'Kapıyı aç' : 'Devam et'}</button>
    </div>`);
  const d = document.getElementById('daily-btn');
  if (d) d.onclick = () => {
    const amt = claimDaily(state, today);
    sfx('buy');
    d.outerHTML = `<div class="banner">🎁 +${amt} 🐟 alındı. Yarın yine gel!</div>`;
    refreshHud();
    save(state);
  };
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    state.lastSeen = Date.now();
    save(state);
  } else {
    const r = catchUp(state, Date.now(), Math.random, month());
    handleEvents(r.events, true);
    if (r.fish >= 1 && r.seconds > 30) toast(`Sen yokken +${fmt(r.fish)} 🐟`);
    last = performance.now();
  }
});
window.addEventListener('pagehide', () => {
  state.lastSeen = Date.now();
  save(state);
});

renderAll();
welcome();
showHint();
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => undefined);
}
