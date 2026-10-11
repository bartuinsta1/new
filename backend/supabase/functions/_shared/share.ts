// Paylaşım bağlantıları (§3.7, §9): ebeveyn bir masalı WhatsApp'ta paylaşır; bağlantı web önizleme sayfasını açar.
// Bağlantı tahmin edilemez bir jetondur, 30 gün sonra geçersizleşir ve hesap silinince silinir.
export interface ShareEntry {
  token: string;
  userId: string;
  storyId: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface ShareStore {
  save(e: ShareEntry): Promise<void>;
  get(token: string): Promise<ShareEntry | null>;
  deleteUser(userId: string): Promise<void>;
}

export class MemoryShareStore implements ShareStore {
  entries = new Map<string, ShareEntry>();
  async save(e: ShareEntry) { this.entries.set(e.token, e); }
  async get(token: string) { return this.entries.get(token) ?? null; }
  async deleteUser(userId: string) {
    for (const [k, v] of this.entries) if (v.userId === userId) this.entries.delete(k);
  }
}

export const SHARE_TTL_DAYS = 30;

/** 128 bit rastgele, URL güvenli jeton. */
export function newShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
