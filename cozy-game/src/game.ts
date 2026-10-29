// Saf oyun mantığı: DOM/canvas bilmez, test edilebilir.
import {
  BREEDS, BREED_BY_ID, CAT_NAMES, FURNITURE_BY_ID, LEVEL_HEARTS, MAX_LEVEL, MESS_KINDS,
  PRODUCT_BY_ID, RARITY_WEIGHT, ROOMS, ROOM_BY_ID, SUPPORTER_INCOME, SUPPORTER_OFFLINE_HOURS, UPGRADE_BY_ID,
  WALLPAPER_BY_ID, type BreedDef, type MessKind, type ProductId, type Tag, type UpgradeId,
} from './data';

export type Rand = () => number;

export interface Cat {
  uid: number;
  breed: string;
  name: string;
  pref: Tag;
  /** misafir olarak kalacağı toplam süre (sn) */
  stay: number;
  /** yerleştirildiyse kalan süre (sn) */
  remaining: number;
  room?: string;
  slot?: number;
  seat?: number;
}

export interface Mess {
  id: number;
  room: string;
  kind: MessKind;
  x: number;
  y: number;
}

export interface RoomState {
  furniture: (string | null)[];
  wallpaper?: string;
}

export interface GameState {
  v: 1;
  fish: number;
  hearts: number;
  totalFish: number;
  rooms: Record<string, RoomState>;
  queue: Cat[];
  guests: Cat[];
  messes: Mess[];
  album: Record<string, number>;
  nextId: number;
  catTimer: number;
  messTimer: number;
  lastSeen: number;
  lastDaily: string | null;
  cleaned: number;
  served: number;
  tutorial: number;
  upgrades: Partial<Record<UpgradeId, number>>;
  wallpapers: string[];
  /** sahip olunan kalıcı uygulama içi ürünler */
  owned: ProductId[];
  /** işlenmiş satın alma kimlikleri: aynı işlem iki kez ödüllendirilmez */
  txns: string[];
  settings: { music: boolean; sfx: boolean; lang: 'tr' | 'en' | null };
}

export type GameEvent =
  | { type: 'arrive'; cat: Cat }
  | { type: 'leave'; cat: Cat; fish: number; hearts: number }
  | { type: 'mess'; mess: Mess }
  | { type: 'levelup'; level: number };

export const QUEUE_MAX = 3;
export const MESS_PER_ROOM = 4;
export const BASE_INCOME = 0.08;
export const OFFLINE_CAP = 12 * 3600;

export function newGame(now = Date.now()): GameState {
  const salon: RoomState = { furniture: [null, 'cushion', null, null, null, null] };
  return {
    v: 1,
    fish: 40,
    hearts: 0,
    totalFish: 0,
    rooms: { salon },
    queue: [],
    guests: [],
    messes: [],
    album: {},
    nextId: 1,
    catTimer: 3,
    messTimer: 25,
    lastSeen: now,
    lastDaily: null,
    cleaned: 0,
    served: 0,
    tutorial: 0,
    upgrades: {},
    wallpapers: [],
    owned: [],
    txns: [],
    settings: { music: true, sfx: true, lang: null },
  };
}

export function upg(s: GameState, id: UpgradeId): number {
  return s.upgrades[id] ?? 0;
}

export function owns(s: GameState, id: ProductId): boolean {
  return s.owned.includes(id);
}

export function offlineCap(s: GameState): number {
  return owns(s, 'mh_supporter') ? SUPPORTER_OFFLINE_HOURS * 3600 : OFFLINE_CAP;
}

export function levelOf(hearts: number): number {
  let lvl = 1;
  for (let i = 0; i < LEVEL_HEARTS.length; i++) if (hearts >= LEVEL_HEARTS[i]) lvl = i + 1;
  return lvl;
}

export function levelProgress(hearts: number): { level: number; cur: number; need: number } {
  const level = levelOf(hearts);
  if (level >= MAX_LEVEL) return { level, cur: 1, need: 1 };
  const lo = LEVEL_HEARTS[level - 1];
  const hi = LEVEL_HEARTS[level];
  return { level, cur: hearts - lo, need: hi - lo };
}

export function roomComfort(s: GameState, roomId: string): number {
  const room = s.rooms[roomId];
  if (!room) return 0;
  let c = 0;
  for (const f of room.furniture) if (f) c += FURNITURE_BY_ID[f].comfort;
  const messes = s.messes.filter((m) => m.room === roomId).length;
  return Math.max(0, c - messes * 2);
}

export interface Seat { room: string; slot: number; seat: number }

export function allSeats(s: GameState): Seat[] {
  const out: Seat[] = [];
  for (const [room, rs] of Object.entries(s.rooms)) {
    rs.furniture.forEach((f, slot) => {
      if (!f) return;
      for (let seat = 0; seat < FURNITURE_BY_ID[f].seats; seat++) out.push({ room, slot, seat });
    });
  }
  return out;
}

export function catAt(s: GameState, room: string, slot: number, seat: number): Cat | undefined {
  return s.guests.find((c) => c.room === room && c.slot === slot && c.seat === seat);
}

export function freeSeats(s: GameState): Seat[] {
  return allSeats(s).filter((x) => !catAt(s, x.room, x.slot, x.seat));
}

export function isMatch(s: GameState, cat: Cat): boolean {
  if (cat.room === undefined || cat.slot === undefined) return false;
  const f = s.rooms[cat.room]?.furniture[cat.slot];
  return !!f && FURNITURE_BY_ID[f].tag === cat.pref;
}

export function catIncome(s: GameState, cat: Cat): number {
  if (cat.room === undefined) return 0;
  const rarity = BREED_BY_ID[cat.breed]?.rarity ?? 1;
  const comfort = roomComfort(s, cat.room);
  return BASE_INCOME * (1 + comfort * 0.08) * (isMatch(s, cat) ? 2 : 1) * (1 + 0.2 * (rarity - 1)) * (1 + 0.1 * upg(s, 'mama')) * (owns(s, 'mh_supporter') ? SUPPORTER_INCOME : 1);
}

export function totalIncome(s: GameState): number {
  return s.guests.reduce((a, c) => a + catIncome(s, c), 0);
}

export function availableBreeds(level: number, month: number): BreedDef[] {
  return BREEDS.filter((b) => b.minLevel <= level && (!b.months || b.months.includes(month)));
}

export function pickBreed(level: number, month: number, rand: Rand): BreedDef {
  const list = availableBreeds(level, month);
  const total = list.reduce((a, b) => a + RARITY_WEIGHT[b.rarity], 0);
  let r = rand() * total;
  for (const b of list) {
    r -= RARITY_WEIGHT[b.rarity];
    if (r <= 0) return b;
  }
  return list[list.length - 1];
}

const TAGS: Tag[] = ['sicak', 'sessiz', 'oyun', 'manzara'];

export function makeCat(s: GameState, rand: Rand, month: number): Cat {
  const breed = pickBreed(levelOf(s.hearts), month, rand);
  const stay = Math.round((150 + rand() * 210) * (1 + 0.1 * upg(s, 'battaniye')));
  return {
    uid: s.nextId++,
    breed: breed.id,
    name: CAT_NAMES[Math.floor(rand() * CAT_NAMES.length)],
    pref: TAGS[Math.floor(rand() * TAGS.length)],
    stay,
    remaining: stay,
  };
}

function spawnMess(s: GameState, rand: Rand): Mess | null {
  const rooms = Object.keys(s.rooms).filter(
    (r) => s.guests.some((c) => c.room === r) && s.messes.filter((m) => m.room === r).length < MESS_PER_ROOM,
  );
  if (!rooms.length) return null;
  const room = rooms[Math.floor(rand() * rooms.length)];
  const mess: Mess = {
    id: s.nextId++,
    room,
    kind: MESS_KINDS[Math.floor(rand() * MESS_KINDS.length)],
    x: 0.1 + rand() * 0.8,
    y: 0.5 + rand() * 0.42,
  };
  s.messes.push(mess);
  return mess;
}

function departReward(s: GameState, cat: Cat): { fish: number; hearts: number } {
  const rarity = BREED_BY_ID[cat.breed]?.rarity ?? 1;
  const match = isMatch(s, cat);
  const comfort = roomComfort(s, cat.room!);
  const fish = Math.round((8 + rarity * 6 + comfort) * (1 + 0.15 * upg(s, 'kartpostal')));
  const hearts = 1 + (match ? 1 : 0) + (rarity >= 3 ? 1 : 0) + (comfort >= 12 ? 1 : 0);
  return { fish, hearts };
}

function addHearts(s: GameState, n: number, events: GameEvent[]) {
  const before = levelOf(s.hearts);
  s.hearts += n;
  const after = levelOf(s.hearts);
  if (after > before) events.push({ type: 'levelup', level: after });
}

/** Oyunu dt saniye ilerletir. */
export function tick(s: GameState, dt: number, rand: Rand, month: number): GameEvent[] {
  const events: GameEvent[] = [];
  const income = totalIncome(s) * dt;
  s.fish += income;
  s.totalFish += income;

  for (const cat of [...s.guests]) {
    cat.remaining -= dt;
    if (cat.remaining <= 0) {
      const r = departReward(s, cat);
      s.guests = s.guests.filter((c) => c !== cat);
      s.fish += r.fish;
      s.totalFish += r.fish;
      s.served++;
      events.push({ type: 'leave', cat, ...r });
      addHearts(s, r.hearts, events);
    }
  }

  s.catTimer -= dt;
  if (s.catTimer <= 0) {
    const level = levelOf(s.hearts);
    if (s.queue.length < QUEUE_MAX && (s.queue.length === 0 || freeSeats(s).length > s.queue.length)) {
      const cat = makeCat(s, rand, month);
      s.queue.push(cat);
      events.push({ type: 'arrive', cat });
    }
    s.catTimer = (Math.max(8, 26 - level * 1.5) + rand() * 12) * (1 - 0.07 * upg(s, 'zil'));
  }

  s.messTimer -= dt;
  if (s.messTimer <= 0) {
    const m = spawnMess(s, rand);
    if (m) events.push({ type: 'mess', mess: m });
    s.messTimer = 16 + rand() * 20;
  }
  return events;
}

/** Çevrimdışı geçen süreyi 5 sn adımlarla simüle eder. */
export function catchUp(s: GameState, now: number, rand: Rand, month: number): { seconds: number; fish: number; events: GameEvent[] } {
  const seconds = Math.min(offlineCap(s), Math.max(0, (now - s.lastSeen) / 1000));
  const fishBefore = s.fish;
  const events: GameEvent[] = [];
  let left = seconds;
  while (left > 0) {
    const step = Math.min(5, left);
    events.push(...tick(s, step, rand, month));
    left -= step;
  }
  s.lastSeen = now;
  return { seconds, fish: s.fish - fishBefore, events };
}

export function placeCat(s: GameState, uid: number, seat: Seat): boolean {
  const i = s.queue.findIndex((c) => c.uid === uid);
  if (i < 0 || catAt(s, seat.room, seat.slot, seat.seat)) return false;
  const f = s.rooms[seat.room]?.furniture[seat.slot];
  if (!f || seat.seat >= FURNITURE_BY_ID[f].seats) return false;
  const [cat] = s.queue.splice(i, 1);
  Object.assign(cat, seat);
  cat.remaining = cat.stay;
  s.guests.push(cat);
  s.album[cat.breed] = (s.album[cat.breed] ?? 0) + 1;
  if (s.catTimer > 6) s.catTimer = Math.min(s.catTimer, 10);
  return true;
}

/** Bir kediyi en uygun boş koltuğa koyar (eşleşen etiket öncelikli). */
export function bestSeatFor(s: GameState, cat: Cat): Seat | null {
  const free = freeSeats(s);
  if (!free.length) return null;
  const score = (x: Seat) => {
    const f = FURNITURE_BY_ID[s.rooms[x.room].furniture[x.slot]!];
    return (f.tag === cat.pref ? 100 : 0) + roomComfort(s, x.room);
  };
  return free.sort((a, b) => score(b) - score(a))[0];
}

export type BuyResult = 'ok' | 'fish' | 'level' | 'occupied' | 'locked';

export function buyFurniture(s: GameState, room: string, slot: number, id: string): BuyResult {
  const f = FURNITURE_BY_ID[id];
  const rs = s.rooms[room];
  if (!rs || !f) return 'locked';
  if (rs.furniture[slot]) return 'occupied';
  if (f.exclusive && !owns(s, f.exclusive)) return 'locked';
  if (levelOf(s.hearts) < f.unlockLevel) return 'level';
  if (s.fish < f.price) return 'fish';
  s.fish -= f.price;
  rs.furniture[slot] = id;
  return 'ok';
}

export function removeFurniture(s: GameState, room: string, slot: number): number | null {
  const rs = s.rooms[room];
  const id = rs?.furniture[slot];
  if (!id) return null;
  if (s.guests.some((c) => c.room === room && c.slot === slot)) return null;
  const refund = Math.floor(FURNITURE_BY_ID[id].price / 2);
  rs.furniture[slot] = null;
  s.fish += refund;
  return refund;
}

export function cleanMess(s: GameState, id: number): { fish: number; hearts: number; levelUp: number | null } | null {
  const i = s.messes.findIndex((m) => m.id === id);
  if (i < 0) return null;
  s.messes.splice(i, 1);
  const fish = 2 + levelOf(s.hearts) + 2 * upg(s, 'supurge');
  s.fish += fish;
  s.totalFish += fish;
  s.cleaned++;
  const events: GameEvent[] = [];
  const hearts = s.cleaned % 5 === 0 ? 1 : 0;
  if (hearts) addHearts(s, hearts, events);
  const lu = events.find((e) => e.type === 'levelup');
  return { fish, hearts, levelUp: lu && lu.type === 'levelup' ? lu.level : null };
}

export type UnlockResult = 'ok' | 'fish' | 'level' | 'owned';

export function unlockRoom(s: GameState, id: string): UnlockResult {
  const r = ROOM_BY_ID[id];
  if (s.rooms[id]) return 'owned';
  if (levelOf(s.hearts) < r.unlockLevel) return 'level';
  if (s.fish < r.price) return 'fish';
  s.fish -= r.price;
  s.rooms[id] = { furniture: [null, null, null, null, null, null] };
  return 'ok';
}

export function upgradeCost(s: GameState, id: UpgradeId): number {
  const u = UPGRADE_BY_ID[id];
  return Math.round(u.baseCost * Math.pow(u.growth, upg(s, id)));
}

export type UpgradeResult = 'ok' | 'fish' | 'level' | 'max';

export function buyUpgrade(s: GameState, id: UpgradeId): UpgradeResult {
  const u = UPGRADE_BY_ID[id];
  if (upg(s, id) >= u.max) return 'max';
  if (levelOf(s.hearts) < u.unlockLevel) return 'level';
  const cost = upgradeCost(s, id);
  if (s.fish < cost) return 'fish';
  s.fish -= cost;
  s.upgrades[id] = upg(s, id) + 1;
  return 'ok';
}

export type WallpaperResult = 'bought' | 'applied' | 'fish' | 'level' | 'locked';

/** Sahip değilse satın alır; her durumda odaya uygular. 'default' oda rengine döner. */
export function useWallpaper(s: GameState, room: string, id: string): WallpaperResult {
  const rs = s.rooms[room];
  if (!rs) return 'locked';
  if (id === 'default') {
    delete rs.wallpaper;
    return 'applied';
  }
  const w = WALLPAPER_BY_ID[id];
  if (!w) return 'locked';
  if (w.exclusive) {
    if (!owns(s, w.exclusive)) return 'locked';
    rs.wallpaper = id;
    return 'applied';
  }
  if (s.wallpapers.includes(id)) {
    rs.wallpaper = id;
    return 'applied';
  }
  if (levelOf(s.hearts) < w.unlockLevel) return 'level';
  if (s.fish < w.price) return 'fish';
  s.fish -= w.price;
  s.wallpapers.push(id);
  rs.wallpaper = id;
  return 'bought';
}

export interface Grant {
  product: ProductId;
  fish: number;
  /** kalıcı ürün bu kayıtta ilk kez açıldı */
  unlocked: boolean;
}

const TXN_MEMORY = 300;

/**
 * Mağazadan gelen bir satın almayı oyuna işler. Aynı işlem kimliği ikinci kez gelirse
 * (yeniden başlatma, geri yükleme, mağaza tekrarı) hiçbir şey vermez ve null döner.
 * Kalıcı ürünlerin balık hediyesi bu kayıtta yalnızca bir kez verilir.
 */
export function grantPurchase(s: GameState, productId: string, transactionId: string): Grant | null {
  const p = PRODUCT_BY_ID[productId as ProductId];
  if (!p) return null;
  if (transactionId && s.txns.includes(transactionId)) return null;
  if (transactionId) {
    s.txns.push(transactionId);
    if (s.txns.length > TXN_MEMORY) s.txns.splice(0, s.txns.length - TXN_MEMORY);
  }
  if (p.kind === 'nonconsumable') {
    if (owns(s, p.id)) return { product: p.id, fish: 0, unlocked: false };
    s.owned.push(p.id);
  }
  s.fish += p.fish;
  return { product: p.id, fish: p.fish, unlocked: p.kind === 'nonconsumable' };
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function dailyAmount(s: GameState): number {
  return 40 + 20 * levelOf(s.hearts);
}

export function claimDaily(s: GameState, today: string): number {
  if (s.lastDaily === today) return 0;
  const amount = dailyAmount(s);
  s.fish += amount;
  s.lastDaily = today;
  return amount;
}

const SAVE_KEY = 'mirnav-hani-v1';

export function save(s: GameState, storage: Pick<Storage, 'setItem'> = localStorage) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* gizli sekme vb. */
  }
}

export function load(storage: Pick<Storage, 'getItem'> = localStorage): GameState | null {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as GameState;
    if (data.v !== 1) return null;
    const base = newGame(data.lastSeen);
    const merged = { ...base, ...data, settings: { ...base.settings, ...data.settings } };
    // bilinmeyen oda/mobilya kalıntılarını temizle
    for (const id of Object.keys(merged.rooms)) if (!ROOM_BY_ID[id]) delete merged.rooms[id];
    for (const rs of Object.values(merged.rooms)) {
      rs.furniture = rs.furniture.map((f) => (f && FURNITURE_BY_ID[f] ? f : null));
      if (rs.wallpaper && !WALLPAPER_BY_ID[rs.wallpaper]) delete rs.wallpaper;
    }
    merged.wallpapers = merged.wallpapers.filter((w) => WALLPAPER_BY_ID[w]);
    merged.owned = merged.owned.filter((p) => PRODUCT_BY_ID[p]);
    if (!Number.isFinite(merged.fish) || merged.fish < 0) merged.fish = 0;
    merged.guests = merged.guests.filter((c) => c.room && merged.rooms[c.room] && BREED_BY_ID[c.breed]);
    merged.queue = merged.queue.filter((c) => BREED_BY_ID[c.breed]);
    return merged;
  } catch {
    return null;
  }
}

export function resetSave(storage: Pick<Storage, 'removeItem'> = localStorage) {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    /* yoksay */
  }
}

export { ROOMS };
