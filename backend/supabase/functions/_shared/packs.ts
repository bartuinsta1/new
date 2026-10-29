// Masal Dükkanı (§ büyüme): tek seferlik, kalıcı paketler (App Store "Non-Consumable").
// Kurallar: jeton/kredi yok; bir kez alınır, hep kalır; Aile Paylaşımı açık; Premium'a DAHİL DEĞİL (ayrı ve açık).
// Satın alma ekranı yalnızca ebeveyn kapısının arkasında; çocuk tarafında sahip olunmayan paket içeriği gösterilmez.
// Katalog sunucuda tutulur (fiyat App Store'dan gelir); yeni paket = buraya bir kayıt + App Store Connect'te ürün.
import type { Language, Region } from "./contract.ts";

export type PackKind = "stories" | "outfits";

export interface PackStory { id: string; tr: string; en: string; region: Region; minutes: 5 | 10 | 15 }

export interface PackDef {
  id: string;               // App Store ürün kimliği
  kind: PackKind;
  tr: { title: string; description: string };
  en: { title: string; description: string };
  stories?: PackStory[];
  /** iOS `Outfit.key` değerleri (OutfitArt ile çizilir). */
  outfits?: string[];
}

export const PACKS: PackDef[] = [
  {
    id: "masalcik.pack.dedekorkut", kind: "stories",
    tr: { title: "Dede Korkut'tan Esintiler", description: "Kopuz ezgileri, yaylalar ve ozanlar: dört sakin uyku masalı." },
    en: { title: "Tales from Dede Korkut", description: "Lute songs, high meadows and wandering bards: four calm bedtime tales." },
    stories: [
      { id: "lib-dk-kopuz", tr: "Kopuzun Uyku Ezgisi", en: "The Lute's Sleepy Song", region: "storyteller_plane", minutes: 10 },
      { id: "lib-dk-bozat", tr: "Boz At ile Yayla Yolu", en: "The Grey Horse and the Meadow Road", region: "storyteller_plane", minutes: 10 },
      { id: "lib-dk-ozan", tr: "Küçük Ozan ve Yıldız Çadırı", en: "The Little Bard and the Star Tent", region: "star_hill", minutes: 10 },
      { id: "lib-dk-ceylan", tr: "Ceylan Yavrusu ile Pınar", en: "The Fawn by the Spring", region: "whisper_forest", minutes: 5 },
    ],
  },
  {
    id: "masalcik.pack.space", kind: "stories",
    tr: { title: "Uzay Yolculuğu", description: "Aya giden balondan gezegen ninnisine, yıldızların arasında dört masal." },
    en: { title: "Space Journey", description: "From a balloon to the moon to a planets' lullaby: four tales among the stars." },
    stories: [
      { id: "lib-space-balon", tr: "Ay'a Giden Balon", en: "The Balloon to the Moon", region: "star_hill", minutes: 10 },
      { id: "lib-space-kuyruklu", tr: "Kuyruklu Yıldızın Uykusu", en: "The Comet Who Needed a Nap", region: "star_hill", minutes: 10 },
      { id: "lib-space-gezegen", tr: "Gezegenlerin Ninnisi", en: "The Planets' Lullaby", region: "star_hill", minutes: 15 },
      { id: "lib-space-yastik", tr: "Yıldız Tozu Yastığı", en: "The Stardust Pillow", region: "sleep_house", minutes: 5 },
    ],
  },
  {
    id: "masalcik.pack.outfits.bayram", kind: "outfits",
    tr: { title: "Bayram Giysileri", description: "Altı arkadaşın her birine bayramlık şapka, atkı, taç ya da kurdele." },
    en: { title: "Festive Outfits", description: "A festive hat, scarf, crown or bow for each of the six friends." },
    outfits: ["pamuk_crown_bayram", "findik_bow_bayram", "lodos_scarf_bayram", "nur_crown_bayram",
              "yildiz_bow_bayram", "kaptan_midye_nightcap_bayram"],
  },
];

export const PACK_IDS: readonly string[] = PACKS.map((p) => p.id);

export const packOfStory = (storyId: string) => PACKS.find((p) => p.stories?.some((s) => s.id === storyId));

/** İstemciye giden katalog (dile göre), sahiplik bilgisiyle. */
export function packCatalog(lang: Language, owned: string[]) {
  return PACKS.map((p) => ({
    id: p.id, kind: p.kind, title: p[lang].title, description: p[lang].description, owned: owned.includes(p.id),
    stories: (p.stories ?? []).map((s) => ({ id: s.id, title: s[lang], region: s.region, duration_minutes: s.minutes })),
    outfits: p.outfits ?? [],
  }));
}

/** Sahip olunan tek seferlik ürünler. Bir App Store işlemi (originalTransactionId) aynı anda tek hesaptadır. */
export interface PurchaseStore {
  owned(userId: string): Promise<string[]>;
  /** Geri yüklemede başka hesaptaki aynı işlem bu hesaba taşınır (abonelikle aynı kural). */
  grant(userId: string, productId: string, originalTransactionId: string, environment: string): Promise<void>;
  /** İade / iptal. */
  revoke(originalTransactionId: string): Promise<void>;
  ownerOf(originalTransactionId: string): Promise<string | null>;
  deleteUser(userId: string): Promise<void>;
}

export class MemoryPurchaseStore implements PurchaseStore {
  private rows = new Map<string, { userId: string; productId: string; revoked: boolean }>(); // otid →
  async owned(userId: string) {
    return [...new Set([...this.rows.values()].filter((r) => r.userId === userId && !r.revoked).map((r) => r.productId))];
  }
  async grant(userId: string, productId: string, otid: string, _environment: string) {
    this.rows.set(otid, { userId, productId, revoked: false });
  }
  async revoke(otid: string) { const r = this.rows.get(otid); if (r) r.revoked = true; }
  async ownerOf(otid: string) { return this.rows.get(otid)?.userId ?? null; }
  async deleteUser(userId: string) { for (const [k, v] of this.rows) if (v.userId === userId) this.rows.delete(k); }
}
