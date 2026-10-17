// Ortak HTTP yardımcıları: JSON yanıt, kimlik, hız sınırlama, kullanım sayacı.
// Adım 1: bellek içi uygulamalar (sahte). Adım 5/10: Supabase Auth + Postgres tablolarına bağlanacak.
import type { Subscription } from "./appstore.ts";

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

/** Hata yanıtı. Kod hem gövdede hem `X-Error-Code` başlığında (akışlı istekte istemci gövdeyi okumadan ayırt eder). */
export const errorResponse = (status: number, code: string) => json({ error: code }, status, { "x-error-code": code });

/** Supabase fonksiyon yolunda fonksiyon adından sonraki parçalar: /functions/v1/stories/abc → ["abc"] */
export function pathAfter(req: Request, fn: string): string[] {
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  const i = parts.indexOf(fn);
  return i === -1 ? [] : parts.slice(i + 1);
}

export interface AuthProvider {
  /** Geçerli oturumun (anonim ya da Apple ile giriş) kullanıcı kimliği; yoksa null. */
  userId(req: Request): Promise<string | null>;
}

/** Sahte kimlik: "Bearer <userId>". Gerçekte supabase.auth.getUser(jwt). */
export const mockAuth: AuthProvider = {
  async userId(req) {
    const h = req.headers.get("authorization") ?? "";
    const m = /^Bearer\s+([\w-]{3,64})$/.exec(h);
    return m ? m[1] : null;
  },
};

/** Kayan pencere hız sınırlayıcı (kullanıcı başına). Üretimde Postgres/Redis'e taşınacak. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  private limit: number;
  private windowMs: number;
  private now: () => number;
  constructor(limit: number, windowMs: number, now: () => number = Date.now) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
  }
  allow(key: string): boolean {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(t);
    this.hits.set(key, recent);
    return true;
  }
}

/**
 * Supabase oturumu: ağ geçidi (`verify_jwt = true`) JWT imzasını doğrular; burada yalnızca yükten kullanıcı
 * kimliği okunur. Yalnızca oturum açmış (anonim dahil) kullanıcılar kabul edilir; "anon" anahtarı reddedilir.
 */
export const supabaseJwtAuth: AuthProvider = {
  async userId(req) {
    const m = /^Bearer\s+([\w-]+)\.([\w-]+)\.([\w-]+)$/.exec(req.headers.get("authorization") ?? "");
    if (!m) return null;
    try {
      const b64 = m[2].replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
      if (payload.role !== "authenticated") return null;
      if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
      return typeof payload.sub === "string" && payload.sub.length > 0 ? payload.sub : null;
    } catch {
      return null;
    }
  },
};

export interface EntitlementStore {
  isPremium(userId: string): Promise<boolean>;
  /** Geçerli (süresi dolmamış) abonelik; yoksa null. */
  subscription(userId: string): Promise<Subscription | null>;
  /**
   * Doğrulanmış aboneliği kullanıcıya bağlar. Aynı `originalTransactionId` başka bir kullanıcıdaysa oradan
   * alınır (aynı Apple Kimliği yeni cihazda "geri yükle" yaptığında abonelik yeni anonim hesaba taşınır;
   * bir abonelik aynı anda tek hesabı açar — paylaşım/çoğaltma engeli).
   */
  saveSubscription(userId: string, sub: Subscription): Promise<void>;
  /** App Store bildirimi hangi kullanıcıya ait? */
  userForOriginalTransaction(originalTransactionId: string): Promise<string | null>;
  /** İade / iptal: aboneliği kapatır. */
  revoke(originalTransactionId: string): Promise<void>;
  /**
   * Davet ödülü (§9): App Store aboneliğinden bağımsız, süreli Premium. Mevcut ödül süresinin ya da bugünün
   * üstüne eklenir. Apple aboneliği varsa ikisi birlikte geçerlidir (hangisi uzunsa).
   */
  grantBonusDays(userId: string, days: number, now: Date): Promise<Date>;
  bonusUntil(userId: string): Promise<Date | null>;
  /** Yalnızca testler ve yerel geliştirme: belirli bir tarihe kadar (null = süresiz) premium. */
  setPremium(userId: string, expiresAt: Date | null): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}

/** Ücretsiz kullanım sayacı. Limit backend'de uygulanır — istemciye güvenilmez (§4.6). */
export interface UsageStore {
  personalStoriesOn(userId: string, day: string): Promise<number>;
  recordPersonalStory(userId: string, day: string): Promise<void>;
  /** Bu hafta açılan (farklı) kitaplık masalları. Aynı masalı tekrar dinlemek hakkı azaltmaz. */
  libraryStoriesInWeek(userId: string, week: string): Promise<string[]>;
  recordLibraryStory(userId: string, week: string, storyId: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}

export class MemoryStores implements UsageStore, EntitlementStore {
  private usage = new Map<string, number>();
  private library = new Map<string, Set<string>>();
  private subs = new Map<string, Subscription>();
  private owners = new Map<string, string>();
  private bonus = new Map<string, Date>();
  private now: () => Date;
  constructor(now: () => Date = () => new Date()) {
    this.now = now;
  }

  async personalStoriesOn(userId: string, day: string) { return this.usage.get(`${userId}:${day}`) ?? 0; }
  async recordPersonalStory(userId: string, day: string) {
    const k = `${userId}:${day}`;
    this.usage.set(k, (this.usage.get(k) ?? 0) + 1);
  }
  async libraryStoriesInWeek(userId: string, week: string) { return [...(this.library.get(`${userId}:${week}`) ?? [])]; }
  async recordLibraryStory(userId: string, week: string, storyId: string) {
    const k = `${userId}:${week}`;
    this.library.set(k, (this.library.get(k) ?? new Set()).add(storyId));
  }

  async isPremium(userId: string) {
    return (await this.subscription(userId)) !== null || (await this.bonusUntil(userId)) !== null;
  }
  async grantBonusDays(userId: string, days: number, now: Date) {
    const current = this.bonus.get(userId);
    const base = current && current > now ? current : now;
    const until = new Date(base.getTime() + days * 86_400_000);
    this.bonus.set(userId, until);
    return until;
  }
  async bonusUntil(userId: string) {
    const b = this.bonus.get(userId);
    return b && b > this.now() ? b : null;
  }
  async subscription(userId: string) {
    const s = this.subs.get(userId);
    return s && s.expiresAt > this.now() ? s : null;
  }
  async saveSubscription(userId: string, sub: Subscription) {
    const previous = this.owners.get(sub.originalTransactionId);
    if (previous && previous !== userId) this.subs.delete(previous);
    this.owners.set(sub.originalTransactionId, userId);
    this.subs.set(userId, sub);
  }
  async userForOriginalTransaction(id: string) { return this.owners.get(id) ?? null; }
  async revoke(originalTransactionId: string) {
    const owner = this.owners.get(originalTransactionId);
    if (owner && this.subs.get(owner)?.originalTransactionId === originalTransactionId) this.subs.delete(owner);
  }
  async setPremium(userId: string, expiresAt: Date | null) {
    await this.saveSubscription(userId, {
      productId: "masalcik.premium.yearly", expiresAt: expiresAt ?? new Date(8.64e15), isInTrial: false,
      originalTransactionId: `dev-${userId}`, environment: "Xcode",
    });
  }
  async deleteUser(userId: string) {
    this.subs.delete(userId);
    this.bonus.delete(userId);
    for (const [k, v] of [...this.owners]) if (v === userId) this.owners.delete(k);
    for (const k of [...this.usage.keys()]) if (k.startsWith(`${userId}:`)) this.usage.delete(k);
    for (const k of [...this.library.keys()]) if (k.startsWith(`${userId}:`)) this.library.delete(k);
  }
}

/** Günlük limit için gün anahtarı (Türkiye saati, UTC+3). */
export const istanbulDay = (d: Date) => new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10);

/** Haftalık kitaplık limiti için hafta anahtarı: Türkiye saatine göre o haftanın pazartesisi (YYYY-MM-DD). */
export function istanbulWeek(d: Date): string {
  const local = new Date(d.getTime() + 3 * 3600_000);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  return new Date(local.getTime() - daysSinceMonday * 86_400_000).toISOString().slice(0, 10);
}

/** Accept-Language başlığından desteklenen dil (varsayılan Türkçe). */
export function requestLanguage(req: Request): "tr" | "en" {
  return (req.headers.get("accept-language") ?? "").toLowerCase().startsWith("en") ? "en" : "tr";
}
