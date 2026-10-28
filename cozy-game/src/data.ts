// Statik oyun verisi: kedi cinsleri, mobilyalar, odalar, dağınıklıklar.

export type Tag = 'sicak' | 'sessiz' | 'oyun' | 'manzara';

export const TAG_INFO: Record<Tag, { label: string; icon: string }> = {
  sicak: { label: 'Sıcak', icon: '🔥' },
  sessiz: { label: 'Sessiz', icon: '🌙' },
  oyun: { label: 'Oyuncu', icon: '🧶' },
  manzara: { label: 'Manzara', icon: '🪟' },
};

export type Rarity = 1 | 2 | 3 | 4;

export interface BreedDef {
  id: string;
  name: string;
  rarity: Rarity;
  minLevel: number;
  /** ana renk, ikinci renk (lekeler), göz rengi */
  base: string;
  patch: string | null;
  stripes: string | null;
  eyes: [string, string];
  belly: string | null;
  foldEars?: boolean;
  fluffy?: boolean;
  /** sadece belirli aylarda gelir (0 = Ocak) */
  months?: number[];
  blurb: string;
}

export const BREEDS: BreedDef[] = [
  { id: 'tekir', name: 'Tekir', rarity: 1, minLevel: 1, base: '#9a8a76', patch: null, stripes: '#5b4d3d', eyes: ['#9bbf4a', '#9bbf4a'], belly: '#d8cbb8', blurb: 'Mahallenin bilgesi. Her şeyi görmüştür.' },
  { id: 'sarman', name: 'Sarman', rarity: 1, minLevel: 1, base: '#e8a04c', patch: null, stripes: '#c0722a', eyes: ['#e2b43a', '#e2b43a'], belly: '#f6dcb4', blurb: 'Tek beyin hücresi, kocaman bir kalp.' },
  { id: 'duman', name: 'Duman', rarity: 1, minLevel: 1, base: '#8d929c', patch: null, stripes: null, eyes: ['#e3b33e', '#e3b33e'], belly: null, blurb: 'Sessizce gelir, sessizce yatağınızı çalar.' },
  { id: 'kara', name: 'Kömür', rarity: 1, minLevel: 1, base: '#2e2a2b', patch: null, stripes: null, eyes: ['#e6c43a', '#e6c43a'], belly: null, blurb: 'Gece gibi kara, şans gibi tatlı.' },
  { id: 'smokin', name: 'Smokin', rarity: 1, minLevel: 2, base: '#2b2829', patch: null, stripes: null, eyes: ['#9fcf5a', '#9fcf5a'], belly: '#f4f1ea', blurb: 'Her an bir baloya hazır.' },
  { id: 'pamuk', name: 'Pamuk', rarity: 2, minLevel: 2, base: '#f5f1ea', patch: null, stripes: null, eyes: ['#7fb4e0', '#7fb4e0'], belly: null, fluffy: true, blurb: 'Bulut olmayı denemiş, kedi olmuş.' },
  { id: 'calico', name: 'Üç Renk', rarity: 2, minLevel: 2, base: '#f3ece2', patch: '#e09a4a', stripes: null, eyes: ['#d6a43a', '#d6a43a'], belly: null, blurb: 'Lekeleri bir harita; hazine hep mama kabında.' },
  { id: 'findik', name: 'Fındık', rarity: 2, minLevel: 3, base: '#7a5236', patch: null, stripes: '#5a3a24', eyes: ['#cf9b3b', '#cf9b3b'], belly: '#b8906c', blurb: 'Kokusu bile kahverengi.' },
  { id: 'siyam', name: 'Siyam', rarity: 2, minLevel: 3, base: '#efe2cc', patch: '#5a4334', stripes: null, eyes: ['#5aa0e6', '#5aa0e6'], belly: null, blurb: 'Fikirlerini yüksek sesle paylaşır.' },
  { id: 'scottish', name: 'Kıvrık', rarity: 3, minLevel: 4, base: '#b6aea4', patch: null, stripes: '#8a8178', eyes: ['#e0a73c', '#e0a73c'], belly: '#e2dbd2', foldEars: true, blurb: 'Kulakları bile kibar.' },
  { id: 'ankara', name: 'Ankara', rarity: 3, minLevel: 4, base: '#fbf8f2', patch: null, stripes: null, eyes: ['#7cc4a2', '#7cc4a2'], belly: null, fluffy: true, blurb: 'Zarif, beyaz ve biraz ukala.' },
  { id: 'van', name: 'Van Kedisi', rarity: 3, minLevel: 5, base: '#fbf8f2', patch: '#d4914c', stripes: null, eyes: ['#5aa0e6', '#e3b33e'], belly: null, blurb: 'Bir gözü deniz, bir gözü bal. Suyu sever!' },
  { id: 'mainecoon', name: 'Koca Ayı', rarity: 3, minLevel: 6, base: '#6b5444', patch: null, stripes: '#3f3127', eyes: ['#c9b03c', '#c9b03c'], belly: '#d9c7b0', fluffy: true, blurb: 'Kocaman, yumuşacık bir dev.' },
  { id: 'bal', name: 'Bal Köpüğü', rarity: 3, minLevel: 6, base: '#f2d29a', patch: null, stripes: '#ddb06c', eyes: ['#88b64a', '#88b64a'], belly: '#fbf0dc', fluffy: true, blurb: 'Tadı da var gibi.' },
  { id: 'sfenks', name: 'Çıplak Paşa', rarity: 4, minLevel: 7, base: '#e8bfae', patch: '#d79f8c', stripes: null, eyes: ['#7cc4a2', '#7cc4a2'], belly: null, blurb: 'Kazak giymeyi çok sever.' },
  { id: 'gece', name: 'Yıldız Gecesi', rarity: 4, minLevel: 8, base: '#2f3356', patch: null, stripes: null, eyes: ['#f5e27a', '#f5e27a'], belly: '#4d5384', blurb: 'Tüylerinde takımyıldızlar var gibi.' },
  { id: 'kartopu', name: 'Kartopu', rarity: 4, minLevel: 1, base: '#ffffff', patch: '#cfe4f5', stripes: null, eyes: ['#7fb4e0', '#7fb4e0'], belly: null, fluffy: true, months: [10, 11, 0, 1], blurb: 'İlk karla gelir, baharda kaybolur.' },
  { id: 'balkabagi', name: 'Balkabağı', rarity: 4, minLevel: 1, base: '#e07a2a', patch: '#3b2a1a', stripes: '#b85a16', eyes: ['#f5e27a', '#f5e27a'], belly: null, months: [8, 9, 10], blurb: 'Sonbaharın ruhu. Tarçın kokar.' },
];

export const CAT_NAMES = [
  'Mırmır', 'Pofuduk', 'Limon', 'Zeytin', 'Pışpış', 'Bulut', 'Lokum', 'Tarçın', 'Fıstık', 'Boncuk',
  'Minnoş', 'Paşa', 'Sultan', 'Karamel', 'Çörek', 'Simit', 'Ponçik', 'Kurabiye', 'Mısır', 'Nohut',
  'Biber', 'Pekmez', 'Gofret', 'Badem', 'Kestane', 'Ayva', 'Leblebi', 'Muhallebi', 'Kaymak', 'Peri',
  'Tombik', 'Lale', 'Kiraz', 'Mantı', 'Börek', 'Hurma', 'Sütlaç', 'Mocha', 'Maya', 'Bıdık',
];

export type FurnitureKind =
  | 'cushion' | 'basket' | 'box' | 'windowbed' | 'tree' | 'sofa' | 'fireplace'
  | 'radiator' | 'hammock' | 'igloo' | 'plant' | 'lamp' | 'bookshelf' | 'cocoa';

export interface FurnitureDef {
  id: string;
  kind: FurnitureKind;
  name: string;
  price: number;
  seats: number;
  /** odanın konforuna katkı */
  comfort: number;
  tag: Tag | null;
  unlockLevel: number;
  color: string;
  accent: string;
  desc: string;
}

export const FURNITURE: FurnitureDef[] = [
  { id: 'cushion', kind: 'cushion', name: 'Yer Minderi', price: 20, seats: 1, comfort: 1, tag: 'sessiz', unlockLevel: 1, color: '#c97b6b', accent: '#e9a99a', desc: 'Basit ama yumuşacık.' },
  { id: 'box', kind: 'box', name: 'Karton Kutu', price: 25, seats: 1, comfort: 1, tag: 'oyun', unlockLevel: 1, color: '#c89a62', accent: '#a87c48', desc: 'Pahalı yatağı unutun, kutu yeter.' },
  { id: 'basket', kind: 'basket', name: 'Hasır Sepet', price: 45, seats: 1, comfort: 2, tag: 'sicak', unlockLevel: 1, color: '#b98a4e', accent: '#e8d7b8', desc: 'İçinde örgü battaniye var.' },
  { id: 'plant', kind: 'plant', name: 'Saksı Çiçeği', price: 35, seats: 0, comfort: 2, tag: null, unlockLevel: 1, color: '#5f9a5a', accent: '#c06a4a', desc: 'Odaya +2 konfor. Kediler koklamaya bayılır.' },
  { id: 'windowbed', kind: 'windowbed', name: 'Pencere Yatağı', price: 80, seats: 1, comfort: 2, tag: 'manzara', unlockLevel: 2, color: '#7b9fc4', accent: '#dfe9f3', desc: 'Kar yağışını izlemek için birinci sınıf koltuk.' },
  { id: 'lamp', kind: 'lamp', name: 'Sıcak Lamba', price: 60, seats: 0, comfort: 3, tag: null, unlockLevel: 2, color: '#e9c46a', accent: '#8a6a4a', desc: 'Odaya +3 konfor. Altın sarısı ışık.' },
  { id: 'radiator', kind: 'radiator', name: 'Kalorifer Yatağı', price: 110, seats: 1, comfort: 3, tag: 'sicak', unlockLevel: 3, color: '#e7e1d6', accent: '#d98b6a', desc: 'Kışın en çok kapışılan yer.' },
  { id: 'tree', kind: 'tree', name: 'Kedi Ağacı', price: 160, seats: 2, comfort: 3, tag: 'oyun', unlockLevel: 3, color: '#d9c3a0', accent: '#8a6a4a', desc: 'İki kat, iki kedi, sonsuz eğlence.' },
  { id: 'bookshelf', kind: 'bookshelf', name: 'Kitaplık', price: 140, seats: 1, comfort: 3, tag: 'sessiz', unlockLevel: 4, color: '#8a5a3c', accent: '#d8b26a', desc: 'En üst raf: kütüphane kedisinin yeri.' },
  { id: 'sofa', kind: 'sofa', name: 'Kadife Kanepe', price: 240, seats: 2, comfort: 4, tag: 'sessiz', unlockLevel: 4, color: '#7d6aa8', accent: '#a596cc', desc: 'Siz değil, kediler oturur.' },
  { id: 'hammock', kind: 'hammock', name: 'Pencere Hamağı', price: 260, seats: 1, comfort: 4, tag: 'manzara', unlockLevel: 5, color: '#e3a6a1', accent: '#f6dcd8', desc: 'Camdan sallanan hamak. Kuş izleme merkezi.' },
  { id: 'cocoa', kind: 'cocoa', name: 'Sıcak Çikolata Tezgâhı', price: 300, seats: 0, comfort: 6, tag: null, unlockLevel: 5, color: '#7a4a32', accent: '#f3e3cf', desc: 'Odaya +6 konfor. Kasım klasiği.' },
  { id: 'igloo', kind: 'igloo', name: 'Örgü İglo', price: 380, seats: 2, comfort: 5, tag: 'oyun', unlockLevel: 6, color: '#9cc3a8', accent: '#e9f3ec', desc: 'Örgüden bir kale. İçeride fısıltılar.' },
  { id: 'fireplace', kind: 'fireplace', name: 'Taş Şömine', price: 520, seats: 2, comfort: 7, tag: 'sicak', unlockLevel: 7, color: '#9a8f86', accent: '#f08a3c', desc: 'Hanın kalbi. Çıtırtılar ve mırıltılar.' },
];

export const FURNITURE_BY_ID: Record<string, FurnitureDef> = Object.fromEntries(FURNITURE.map((f) => [f.id, f]));
export const BREED_BY_ID: Record<string, BreedDef> = Object.fromEntries(BREEDS.map((b) => [b.id, b]));

export interface RoomDef {
  id: string;
  name: string;
  icon: string;
  unlockLevel: number;
  price: number;
  wall: string;
  wallDark: string;
  floor: string;
  floorDark: string;
  /** slot konumları, sahne genişliği/yüksekliğine göre 0..1 */
  slots: { x: number; y: number }[];
}

const SLOTS = [
  { x: 0.2, y: 0.56 }, { x: 0.5, y: 0.58 }, { x: 0.8, y: 0.56 },
  { x: 0.2, y: 0.8 }, { x: 0.5, y: 0.82 }, { x: 0.8, y: 0.8 },
];

export const ROOMS: RoomDef[] = [
  { id: 'salon', name: 'Salon', icon: '🛋️', unlockLevel: 1, price: 0, wall: '#e9d3b4', wallDark: '#d9bf9b', floor: '#a9744f', floorDark: '#946240', slots: SLOTS },
  { id: 'mutfak', name: 'Mutfak', icon: '🍲', unlockLevel: 3, price: 250, wall: '#cfe0c8', wallDark: '#b9cfb0', floor: '#c9a27a', floorDark: '#b48d66', slots: SLOTS },
  { id: 'cati', name: 'Çatı Katı', icon: '🌙', unlockLevel: 5, price: 1500, wall: '#c8bcd9', wallDark: '#b2a5c6', floor: '#8a6a52', floorDark: '#775a44', slots: SLOTS },
  { id: 'sera', name: 'Kış Serası', icon: '🌿', unlockLevel: 7, price: 4000, wall: '#cde6e6', wallDark: '#b4d3d3', floor: '#9b8b74', floorDark: '#877862', slots: SLOTS },
];

export const ROOM_BY_ID: Record<string, RoomDef> = Object.fromEntries(ROOMS.map((r) => [r.id, r]));

export type MessKind = 'yarn' | 'paws' | 'milk' | 'leaf' | 'fur';
export const MESS_KINDS: MessKind[] = ['yarn', 'paws', 'milk', 'leaf', 'fur'];

/** Sevgi (kalp) eşikleri: index = seviye-1 */
export const LEVEL_HEARTS = [0, 6, 20, 45, 80, 130, 200, 290, 400, 540, 720, 950];
export const MAX_LEVEL = LEVEL_HEARTS.length;

export const RARITY_WEIGHT: Record<Rarity, number> = { 1: 60, 2: 26, 3: 11, 4: 4 };
export const RARITY_LABEL: Record<Rarity, string> = { 1: 'Sıradan', 2: 'Tatlı', 3: 'Nadir', 4: 'Efsanevi' };

/** Han geliştirmeleri: her seviyede fiyat katlanır, geç oyun için balık harcama alanı. */
export type UpgradeId = 'mama' | 'zil' | 'battaniye' | 'supurge' | 'kartpostal';
export interface UpgradeDef {
  id: UpgradeId;
  icon: string;
  name: string;
  desc: string;
  baseCost: number;
  growth: number;
  max: number;
  unlockLevel: number;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'mama', icon: '🍲', name: 'Sıcak Mama', desc: 'Kedilerin kazandırdığı balık +%10', baseCost: 150, growth: 1.75, max: 15, unlockLevel: 2 },
  { id: 'supurge', icon: '🧹', name: 'Sihirli Süpürge', desc: 'Temizlik ödülü +2 🐟', baseCost: 120, growth: 1.7, max: 10, unlockLevel: 2 },
  { id: 'zil', icon: '🔔', name: 'Kapı Zili', desc: 'Kediler %7 daha sık gelir', baseCost: 250, growth: 1.85, max: 8, unlockLevel: 3 },
  { id: 'battaniye', icon: '🧣', name: 'Örgü Battaniye', desc: 'Kediler %10 daha uzun kalır', baseCost: 300, growth: 1.8, max: 10, unlockLevel: 4 },
  { id: 'kartpostal', icon: '💌', name: 'Kartpostal Rafı', desc: 'Veda bahşişi +%15', baseCost: 400, growth: 1.85, max: 15, unlockLevel: 5 },
];
export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u])) as Record<UpgradeId, UpgradeDef>;

export type WallPattern = 'stripes' | 'dots' | 'snow' | 'fish' | 'stars' | 'hearts' | 'diamond';
export interface WallpaperDef {
  id: string;
  name: string;
  price: number;
  unlockLevel: number;
  wall: string;
  /** desen rengi */
  ink: string;
  pattern: WallPattern;
}

export const WALLPAPERS: WallpaperDef[] = [
  { id: 'cilek', name: 'Çilek Sütü', price: 400, unlockLevel: 2, wall: '#f3d6d3', ink: '#e8b7b2', pattern: 'dots' },
  { id: 'nane', name: 'Nane Şekeri', price: 800, unlockLevel: 3, wall: '#d4ecdd', ink: '#f4fbf6', pattern: 'stripes' },
  { id: 'kar', name: 'Kar Tanesi', price: 1500, unlockLevel: 4, wall: '#d6e5f2', ink: '#ffffff', pattern: 'snow' },
  { id: 'balik', name: 'Balık Desenli', price: 2500, unlockLevel: 5, wall: '#f4e7cb', ink: '#8fb1cf', pattern: 'fish' },
  { id: 'gece', name: 'Gece Mavisi', price: 4500, unlockLevel: 6, wall: '#3f4a6e', ink: '#f5e27a', pattern: 'stars' },
  { id: 'kalp', name: 'Kalpli Kâğıt', price: 8000, unlockLevel: 8, wall: '#f6e0e7', ink: '#e98aa6', pattern: 'hearts' },
  { id: 'altin', name: 'Altın Varak', price: 15000, unlockLevel: 10, wall: '#5a3f2e', ink: '#d8b26a', pattern: 'diamond' },
];
export const WALLPAPER_BY_ID: Record<string, WallpaperDef> = Object.fromEntries(WALLPAPERS.map((w) => [w.id, w]));
