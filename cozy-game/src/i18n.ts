// Türkçe / İngilizce metinler. Veri kimliklerine göre isimler de burada çevrilir.
import type { BreedDef, FurnitureDef, ProductId, Rarity, RoomDef, Tag, UpgradeDef, WallpaperDef } from './data';

export type Lang = 'tr' | 'en';

let lang: Lang = 'tr';

export function detectLang(): Lang {
  if (typeof navigator === 'undefined') return 'tr';
  const l = (navigator.languages?.[0] ?? navigator.language ?? 'tr').toLowerCase();
  return l.startsWith('tr') ? 'tr' : 'en';
}

export function setLang(l: Lang) {
  lang = l;
  if (typeof document === 'undefined') return;
  document.documentElement.lang = l;
  document.title = t('title');
}

export function getLang(): Lang {
  return lang;
}

const TR = {
  title: 'Mırnav Hanı',
  door: 'Kapıda',
  album: 'Kedi albümü',
  menu: 'Ayarlar',
  shopBtn: 'Han geliştirme',
  close: 'Kapat',
  queueEmpty: 'Kar yağıyor… yakında biri gelir.',
  queueFull: 'Yeni misafir için boş yer lazım.',
  newBadge: 'YENİ',
  catAria: '{name}, {breed}, {tag} yer sever',
  catInfo: '{name} ({breed}) · {icon} {tag} yerleri sever',
  noSeat: 'Boş yer yok! Bir mobilya ekle.',
  noSeatPlus: 'Boş yer yok! Boş “+” alana mobilya koy.',
  perfectSpot: '💖 Tam sevdiği yer!',
  newInAlbum: '📖 Yeni kedi albüme eklendi: {breed}!',
  levelTitle: 'Han {level}. seviyeye ulaştı!',
  levelText: 'Kasabada adın duyuluyor. Daha çok kedi kapını çalacak.',
  levelFurn: '🛋️ Yeni mobilyalar: {list}',
  levelRooms: '🚪 Açılabilir oda: {list}',
  levelBreeds: '🐾 Yeni ziyaretçiler gelebilir: {list}',
  levelUpg: '🛍️ Yeni geliştirmeler: {list}',
  great: 'Harika!',
  roomOpenText: 'Hanı genişletme zamanı! Bu odada 6 yeni mobilya alanı var.',
  roomLockedText: 'Bu oda {level}. seviyede açılır. Kedileri mutlu ederek kalp topla.',
  open: 'Aç · {price} 🐟',
  levelLock: '🔒 Seviye {level}',
  roomOpened: '{room} açıldı! Hadi döşeyelim.',
  furnShop: 'Mobilya Dükkânı',
  furnShopSub: '{room} · Konfor {comfort} · Kediler sevdikleri {icons} yerlerde 2× mutlu olur.',
  lvShort: 'Sv {level}',
  needFish: '{n} balık daha lazım 🐟',
  needLevel: 'Seviye {level} gerekli ❤️',
  occupied: 'Burası dolu.',
  seatsComfort: '{seats} yer · ✨+{comfort} konfor',
  remove: 'Kaldır (+{n} 🐟)',
  emptySeat: 'Şu an boş. Kapıdaki bir kediyi seçip buraya dokun.',
  decorOnly: 'Dekor: odadaki tüm kedilerin konforunu artırır.',
  likes: '{icon} {tag} sever',
  perMin: '/dk',
  refund: '+{n} 🐟 geri alındı',
  albumTitle: 'Kedi Albümü',
  albumSub: '{seen} / {total} cins ağırlandı. Mevsimlik kediler sadece belirli aylarda gelir.',
  winter: '❄️ Kış',
  autumn: '🍂 Sonbahar',
  levelPlus: 'Seviye {level}+',
  menuTitle: 'Han Defteri',
  menuSub: '{title} · Seviye {level}',
  statServed: 'ağırlanan kedi',
  statCleaned: 'temizlik',
  statFish: 'toplam balık',
  statHearts: 'sevgi ❤️',
  music: '🎵 Müzik',
  sfx: '🔔 Efektler',
  language: '🌍 Dil',
  homeScreen: '📱 Telefonda tarayıcı menüsünden “Ana Ekrana Ekle” deyip uygulama gibi oynayabilirsin. İnternetsiz de çalışır.',
  privacy: 'Gizlilik politikası',
  reset: 'Hanı sıfırla',
  resetConfirm: 'Tüm ilerleme silinecek. Emin misin?',
  levelToast: 'Seviye {level} · {cur}/{need} ❤️ — kedileri sevdiği yerlere koy, dağınıklığı topla.',
  fishToast: 'Dakikada {rate} 🐟 · Misafirler ayrılırken bahşiş bırakır.',
  hint0: 'Kapıda bir kedi bekliyor! Ona dokun 👆',
  hint1: 'Şimdi parlayan mindere dokun. (Kediye ikinci kez dokunursan en iyi yere kendisi geçer.)',
  hint2: 'Daha çok misafir için kesikli “+” alana dokunup mobilya al. Kediler 🔥🌙🧶🪟 türlerini sever.',
  hint3: 'Kedilerin dağınıklıklarına ✨ dokunarak topla.',
  hint4: 'Biriken balıklarla 🛍️ düğmesinden hanı geliştirebilirsin.',
  leaveFloat: '👋 {name} +{fish}🐟 +{hearts}❤️',
  leaveToast: '👋 {name} teşekkür etti: +{fish}🐟 +{hearts}❤️',
  awayBanner: '🌙 {time} yoktun. Misafirler <b>{fish} 🐟</b> kazandırdı{left}.',
  awayLeft: ', {n} kedi teşekkür edip ayrıldı',
  festival: '❄️ <b>İlk Kar Festivali</b> başladı! Nadir <b>{breed}</b> kedisi bu mevsim kapını çalabilir.',
  autumnBanner: '🍂 Sonbahar geldi! Nadir <b>{breed}</b> kedisi ortalıkta dolaşıyor.',
  welcomeNew: 'Mırnav Hanı’na hoş geldin',
  welcomeBack: 'Tekrar hoş geldin!',
  welcomeNewText: 'Dağ kasabasına kış geliyor. Bu eski hanı, soğukta kalan kediler için sıcacık bir yuvaya çevir.',
  welcomeBackText: 'Şömine çıtırdıyor, kediler seni bekliyor.',
  daily: '🎁 Günlük hediye: {n} 🐟',
  dailyTaken: '🎁 +{n} 🐟 alındı. Yarın yine gel!',
  openDoor: 'Kapıyı aç',
  continue: 'Devam et',
  awayToast: 'Sen yokken +{n} 🐟',
  upgTitle: 'Han Geliştirme',
  upgSub: 'Biriken balıklarını hanı büyütmeye harca.',
  tabUpg: '🛠️ Geliştirmeler',
  tabPaper: '🎨 Duvar Kâğıtları',
  upgLevel: 'Seviye {n}/{max}',
  maxed: 'Tamamlandı ✓',
  paperSub: 'Bir kez al, istediğin odaya uygula. Şu an: {room}',
  paperDefault: 'Odanın kendi rengi',
  apply: 'Uygula',
  applied: 'Uygulandı ✓',
  free: 'Ücretsiz',
  boughtPaper: '{name} alındı ve uygulandı!',
  boughtUpg: '{name} geliştirildi!',
  tabShop: '💎 Paketler',
  shopSub: 'Oyun tamamen ücretsiz. Paketler isteğe bağlı; hanın gelişimine destek olur.',
  shopWeb: '📱 Paketler App Store ve Google Play uygulamasında satın alınabilir.',
  shopLoading: 'Mağaza yükleniyor…',
  shopUnavailable: 'Mağazaya şu an ulaşılamıyor. İnternet bağlantını kontrol edip tekrar dene.',
  restore: 'Satın alımları geri yükle',
  restored: '{n} paket geri yüklendi ✓',
  restoredNone: 'Geri yüklenecek paket bulunamadı.',
  owned: 'Sende var ✓',
  popular: 'En sevilen',
  best: 'En avantajlı',
  thanks: 'Teşekkürler! +{fish} 🐟',
  thanksPack: 'Teşekkürler! {name} açıldı 💛',
  pending: 'Ödeme onay bekliyor. Onaylanınca paketin gelecek.',
  purchaseError: 'Satın alma tamamlanamadı. Ücret alınmadıysa tekrar deneyebilirsin.',
  exclusiveLock: '❄️ Kış Masalı Paketi’ne özel',
  supporterBadge: '💛 Han Dostu: +%25 balık, 24 saat çevrimdışı',
  p_mh_fish_small: 'Bir Kova Balık',
  p_mh_fish_medium: 'Balık Sepeti',
  p_mh_fish_large: 'Balıkçı Teknesi',
  p_mh_winter_pack: 'Kış Masalı Paketi',
  p_mh_supporter: 'Han Dostu',
  d_mh_fish_small: '{fish} 🐟',
  d_mh_fish_medium: '{fish} 🐟',
  d_mh_fish_large: '{fish} 🐟',
  d_mh_winter_pack: 'Kuzey Işıkları duvar kâğıdı, Kar Küresi Yatağı ve {fish} 🐟',
  d_mh_supporter: 'Kalıcı +%25 balık, 24 saat çevrimdışı kazanç ve {fish} 🐟',
  thousand: 'B',
  h: 'sa',
  m: 'dk',
  s: 'sn',
};

type Key = keyof typeof TR;

const EN: Record<Key, string> = {
  title: 'Snowpaw Inn',
  door: 'At door',
  album: 'Cat album',
  menu: 'Settings',
  shopBtn: 'Inn upgrades',
  close: 'Close',
  queueEmpty: 'Snow is falling… someone will come soon.',
  queueFull: 'You need a free spot for new guests.',
  newBadge: 'NEW',
  catAria: '{name}, {breed}, likes {tag} spots',
  catInfo: '{name} ({breed}) · loves {icon} {tag} spots',
  noSeat: 'No free spot! Add some furniture.',
  noSeatPlus: 'No free spot! Put furniture on an empty “+”.',
  perfectSpot: '💖 Their favorite spot!',
  newInAlbum: '📖 New cat added to the album: {breed}!',
  levelTitle: 'The inn reached level {level}!',
  levelText: 'Word is spreading around town. More cats will knock on your door.',
  levelFurn: '🛋️ New furniture: {list}',
  levelRooms: '🚪 Room available: {list}',
  levelBreeds: '🐾 New visitors may come: {list}',
  levelUpg: '🛍️ New upgrades: {list}',
  great: 'Lovely!',
  roomOpenText: 'Time to expand the inn! This room has 6 new furniture spots.',
  roomLockedText: 'This room opens at level {level}. Make cats happy to earn hearts.',
  open: 'Open · {price} 🐟',
  levelLock: '🔒 Level {level}',
  roomOpened: '{room} is open! Let’s decorate.',
  furnShop: 'Furniture Shop',
  furnShopSub: '{room} · Comfort {comfort} · Cats are 2× happier in their favorite {icons} spots.',
  lvShort: 'Lv {level}',
  needFish: '{n} more fish needed 🐟',
  needLevel: 'Level {level} required ❤️',
  occupied: 'This spot is taken.',
  seatsComfort: '{seats} spot(s) · ✨+{comfort} comfort',
  remove: 'Remove (+{n} 🐟)',
  emptySeat: 'Empty right now. Select a cat at the door and tap here.',
  decorOnly: 'Decor: raises the comfort of every cat in the room.',
  likes: 'loves {icon} {tag}',
  perMin: '/min',
  refund: '+{n} 🐟 refunded',
  albumTitle: 'Cat Album',
  albumSub: '{seen} / {total} breeds hosted. Seasonal cats only visit in certain months.',
  winter: '❄️ Winter',
  autumn: '🍂 Autumn',
  levelPlus: 'Level {level}+',
  menuTitle: 'Inn Journal',
  menuSub: '{title} · Level {level}',
  statServed: 'cats hosted',
  statCleaned: 'tidy-ups',
  statFish: 'total fish',
  statHearts: 'love ❤️',
  music: '🎵 Music',
  sfx: '🔔 Sounds',
  language: '🌍 Language',
  homeScreen: '📱 Use “Add to Home Screen” in your browser menu to play it like an app. Works offline too.',
  privacy: 'Privacy policy',
  reset: 'Reset the inn',
  resetConfirm: 'All progress will be deleted. Are you sure?',
  levelToast: 'Level {level} · {cur}/{need} ❤️ — seat cats in spots they love and tidy up.',
  fishToast: '{rate} 🐟 per minute · Guests leave tips when they go.',
  hint0: 'A cat is waiting at the door! Tap it 👆',
  hint1: 'Now tap the glowing cushion. (Tap the cat again to auto-seat it in the best spot.)',
  hint2: 'For more guests, tap a dashed “+” and buy furniture. Cats love 🔥🌙🧶🪟 spots.',
  hint3: 'Tap the ✨ messes the cats leave behind to tidy up.',
  hint4: 'Spend your savings on inn upgrades with the 🛍️ button.',
  leaveFloat: '👋 {name} +{fish}🐟 +{hearts}❤️',
  leaveToast: '👋 {name} says thanks: +{fish}🐟 +{hearts}❤️',
  awayBanner: '🌙 You were away for {time}. Guests earned <b>{fish} 🐟</b>{left}.',
  awayLeft: ', and {n} cats said goodbye',
  festival: '❄️ The <b>First Snow Festival</b> has begun! The rare <b>{breed}</b> may visit this season.',
  autumnBanner: '🍂 Autumn is here! The rare <b>{breed}</b> is wandering around.',
  welcomeNew: 'Welcome to Snowpaw Inn',
  welcomeBack: 'Welcome back!',
  welcomeNewText: 'Winter is coming to the mountain town. Turn this old inn into a cozy home for cats out in the cold.',
  welcomeBackText: 'The fire is crackling and the cats missed you.',
  daily: '🎁 Daily gift: {n} 🐟',
  dailyTaken: '🎁 +{n} 🐟 collected. Come back tomorrow!',
  openDoor: 'Open the door',
  continue: 'Continue',
  awayToast: '+{n} 🐟 while you were away',
  upgTitle: 'Inn Upgrades',
  upgSub: 'Spend your fish to grow the inn.',
  tabUpg: '🛠️ Upgrades',
  tabPaper: '🎨 Wallpapers',
  upgLevel: 'Level {n}/{max}',
  maxed: 'Maxed ✓',
  paperSub: 'Buy once, use in any room. Now editing: {room}',
  paperDefault: 'Room’s own color',
  apply: 'Apply',
  applied: 'Applied ✓',
  free: 'Free',
  boughtPaper: '{name} bought and applied!',
  boughtUpg: '{name} upgraded!',
  tabShop: '💎 Packs',
  shopSub: 'The game is completely free. Packs are optional and help the inn grow.',
  shopWeb: '📱 Packs can be bought in the App Store and Google Play app.',
  shopLoading: 'Loading the store…',
  shopUnavailable: 'The store can’t be reached right now. Check your connection and try again.',
  restore: 'Restore purchases',
  restored: '{n} pack(s) restored ✓',
  restoredNone: 'No packs to restore.',
  owned: 'Owned ✓',
  popular: 'Most loved',
  best: 'Best value',
  thanks: 'Thank you! +{fish} 🐟',
  thanksPack: 'Thank you! {name} unlocked 💛',
  pending: 'Payment is awaiting approval. Your pack will arrive once it’s approved.',
  purchaseError: 'The purchase couldn’t be completed. If you weren’t charged, you can try again.',
  exclusiveLock: '❄️ Winter Tale Pack exclusive',
  supporterBadge: '💛 Inn Friend: +25% fish, 24h offline',
  p_mh_fish_small: 'Bucket of Fish',
  p_mh_fish_medium: 'Fish Basket',
  p_mh_fish_large: 'Fishing Boat',
  p_mh_winter_pack: 'Winter Tale Pack',
  p_mh_supporter: 'Inn Friend',
  d_mh_fish_small: '{fish} 🐟',
  d_mh_fish_medium: '{fish} 🐟',
  d_mh_fish_large: '{fish} 🐟',
  d_mh_winter_pack: 'Northern Lights wallpaper, Snow Globe Bed and {fish} 🐟',
  d_mh_supporter: 'Permanent +25% fish, 24h offline earnings and {fish} 🐟',
  thousand: 'K',
  h: 'h',
  m: 'm',
  s: 's',
};

export function t(key: Key, vars?: Record<string, string | number>): string {
  let s = (lang === 'en' ? EN : TR)[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

// ---------- veri isimleri ----------
const BREED_EN: Record<string, [string, string]> = {
  tekir: ['Tabby', 'The neighborhood sage. Has seen it all.'],
  sarman: ['Ginger', 'One brain cell, enormous heart.'],
  duman: ['Smoky', 'Arrives silently, silently steals your bed.'],
  kara: ['Coal', 'Black as night, sweet as luck.'],
  smokin: ['Tuxedo', 'Always ready for a ball.'],
  pamuk: ['Cotton', 'Tried to be a cloud, became a cat.'],
  calico: ['Calico', 'Her patches are a map; the treasure is always the food bowl.'],
  findik: ['Hazelnut', 'Even smells brown.'],
  siyam: ['Siamese', 'Shares opinions loudly.'],
  scottish: ['Fold', 'Even the ears are polite.'],
  ankara: ['Angora', 'Elegant, white and a little smug.'],
  van: ['Van Cat', 'One eye sea, one eye honey. Loves water!'],
  mainecoon: ['Big Bear', 'A huge, squishy giant.'],
  bal: ['Honey Puff', 'Probably tastes sweet, too.'],
  sfenks: ['Bald Pasha', 'Loves wearing sweaters.'],
  gece: ['Starry Night', 'Constellations hide in the fur.'],
  kartopu: ['Snowball', 'Arrives with the first snow, vanishes in spring.'],
  balkabagi: ['Pumpkin', 'The soul of autumn. Smells like cinnamon.'],
};

const FURN_EN: Record<string, [string, string]> = {
  cushion: ['Floor Cushion', 'Simple but soft.'],
  box: ['Cardboard Box', 'Forget the fancy bed, a box will do.'],
  basket: ['Wicker Basket', 'With a knitted blanket inside.'],
  plant: ['Potted Plant', '+2 room comfort. Cats love sniffing it.'],
  windowbed: ['Window Bed', 'Front-row seat to the snowfall.'],
  lamp: ['Warm Lamp', '+3 room comfort. A golden glow.'],
  radiator: ['Radiator Bed', 'The most fought-over spot in winter.'],
  tree: ['Cat Tree', 'Two floors, two cats, endless fun.'],
  bookshelf: ['Bookshelf', 'Top shelf: reserved for the library cat.'],
  sofa: ['Velvet Sofa', 'The cats sit on it. Not you.'],
  hammock: ['Window Hammock', 'A hammock on the glass. Bird-watching HQ.'],
  cocoa: ['Hot Cocoa Counter', '+6 room comfort. A November classic.'],
  snowglobe: ['Snow Globe Bed', 'Winter Tale Pack exclusive. The snow never stops inside.'],
  igloo: ['Knitted Igloo', 'A castle of yarn. Whispers inside.'],
  fireplace: ['Stone Fireplace', 'The heart of the inn. Crackles and purrs.'],
};

const ROOM_EN: Record<string, string> = { salon: 'Living Room', mutfak: 'Kitchen', cati: 'Attic', sera: 'Greenhouse' };

const TAG_LABEL: Record<Lang, Record<Tag, string>> = {
  tr: { sicak: 'Sıcak', sessiz: 'Sessiz', oyun: 'Oyuncu', manzara: 'Manzara' },
  en: { sicak: 'Warm', sessiz: 'Quiet', oyun: 'Playful', manzara: 'View' },
};

const RARITY: Record<Lang, Record<Rarity, string>> = {
  tr: { 1: 'Sıradan', 2: 'Tatlı', 3: 'Nadir', 4: 'Efsanevi' },
  en: { 1: 'Common', 2: 'Cute', 3: 'Rare', 4: 'Legendary' },
};

const UPG_EN: Record<string, [string, string]> = {
  mama: ['Warm Meals', 'Fish earned by cats +10%'],
  supurge: ['Magic Broom', 'Tidy-up reward +2 🐟'],
  zil: ['Door Bell', 'Cats arrive 7% more often'],
  battaniye: ['Knitted Blanket', 'Cats stay 10% longer'],
  kartpostal: ['Postcard Rack', 'Farewell tips +15%'],
};

const PAPER_EN: Record<string, string> = {
  cilek: 'Strawberry Milk', nane: 'Peppermint', kar: 'Snowflake', balik: 'Fishy Print',
  gece: 'Midnight Blue', kalp: 'Sweethearts', altin: 'Gold Leaf', aurora: 'Northern Lights',
};

export const breedName = (b: BreedDef) => (lang === 'en' ? BREED_EN[b.id]?.[0] ?? b.name : b.name);
export const breedBlurb = (b: BreedDef) => (lang === 'en' ? BREED_EN[b.id]?.[1] ?? b.blurb : b.blurb);
export const furnName = (f: FurnitureDef) => (lang === 'en' ? FURN_EN[f.id]?.[0] ?? f.name : f.name);
export const furnDesc = (f: FurnitureDef) => (lang === 'en' ? FURN_EN[f.id]?.[1] ?? f.desc : f.desc);
export const roomName = (r: RoomDef) => (lang === 'en' ? ROOM_EN[r.id] ?? r.name : r.name);
export const tagLabel = (tag: Tag) => TAG_LABEL[lang][tag];
export const rarityLabel = (r: Rarity) => RARITY[lang][r];
export const upgName = (u: UpgradeDef) => (lang === 'en' ? UPG_EN[u.id]?.[0] ?? u.name : u.name);
export const upgDesc = (u: UpgradeDef) => (lang === 'en' ? UPG_EN[u.id]?.[1] ?? u.desc : u.desc);
export const paperName = (w: WallpaperDef) => (lang === 'en' ? PAPER_EN[w.id] ?? w.name : w.name);
export const productName = (id: ProductId) => t(`p_${id}` as Key);
export const productDesc = (id: ProductId, fish: string) => t(`d_${id}` as Key, { fish });

/** testler için */
export const __DICTS = { TR, EN };
