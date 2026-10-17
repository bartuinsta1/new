// Davet programı (§9): "Davet eden ve edilen 1 hafta Premium kazanır."
// Akış: ebeveyn masal paylaşır → bağlantıda davet kodu → arkadaş uygulamayı indirir → Ebeveyn Köşesi › Hesap ›
// "Davet kodu" → ikisine de 7 gün Premium. Üçüncü taraf "deferred deep link" SDK'sı yok (Kids kategorisi):
// kod elle girilir (6 karakter, karışmayan harfler).
//
// Kötüye kullanım sınırları (VARSAYIM, ayarlanabilir):
//   • her hesap ömründe yalnızca bir kez kod kullanır, kendi kodunu kullanamaz,
//   • davet eden yılda en fazla 12 ödül alır (anonim hesap açarak sonsuz Premium üretilemez),
//   • kod kullanan hesap, davet edeni zaten davet etmiş olamaz (A→B, B→A döngüsü yok).
export const REFERRAL_REWARD_DAYS = 7;
export const REFERRAL_MAX_REWARDS_PER_YEAR = 12;

/** Karışmayan harf ve rakamlar (0/O, 1/I/L yok). */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newReferralCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Kullanıcının yazdığını normalize eder: boşluk/tire atılır, büyük harf (Türkçe "i" → "I"). */
export function normalizeReferralCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, "").toLocaleUpperCase("en-US");
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}

export interface Redemption { inviter: string; invitee: string; at: Date }

export interface ReferralStore {
  /** Kullanıcının kalıcı kodu; yoksa oluşturur. */
  codeFor(userId: string): Promise<string>;
  ownerOf(code: string): Promise<string | null>;
  redemptionBy(invitee: string): Promise<Redemption | null>;
  rewardsSince(inviter: string, since: Date): Promise<number>;
  record(r: Redemption): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}

export class MemoryReferralStore implements ReferralStore {
  private codes = new Map<string, string>();      // userId → code
  private owners = new Map<string, string>();     // code → userId
  private redemptions: Redemption[] = [];

  async codeFor(userId: string) {
    let code = this.codes.get(userId);
    while (!code || (this.owners.has(code) && this.owners.get(code) !== userId)) code = newReferralCode();
    this.codes.set(userId, code);
    this.owners.set(code, userId);
    return code;
  }
  async ownerOf(code: string) { return this.owners.get(code) ?? null; }
  async redemptionBy(invitee: string) { return this.redemptions.find((r) => r.invitee === invitee) ?? null; }
  async rewardsSince(inviter: string, since: Date) {
    return this.redemptions.filter((r) => r.inviter === inviter && r.at >= since).length;
  }
  async record(r: Redemption) { this.redemptions.push(r); }
  async deleteUser(userId: string) {
    const code = this.codes.get(userId);
    if (code) this.owners.delete(code);
    this.codes.delete(userId);
    // Kayıtlar kimlik içerdiği için silinir; "bir kez kullanma" kuralı yeni hesapta yeniden başlar (kabul edilen risk).
    this.redemptions = this.redemptions.filter((r) => r.inviter !== userId && r.invitee !== userId);
  }
}
