// Ortak HTTP yardımcıları: JSON yanıt, kimlik, hız sınırlama, kullanım sayacı.
// Adım 1: bellek içi uygulamalar (sahte). Adım 5/10: Supabase Auth + Postgres tablolarına bağlanacak.

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

export interface EntitlementStore {
  isPremium(userId: string): Promise<boolean>;
  setPremium(userId: string, expiresAt: Date | null): Promise<void>;
}

/** Ücretsiz kullanım sayacı. Limit backend'de uygulanır — istemciye güvenilmez (§4.6). */
export interface UsageStore {
  personalStoriesOn(userId: string, day: string): Promise<number>;
  recordPersonalStory(userId: string, day: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}

export class MemoryStores implements UsageStore, EntitlementStore {
  private usage = new Map<string, number>();
  private premium = new Map<string, Date | null>();
  private now: () => Date;
  constructor(now: () => Date = () => new Date()) {
    this.now = now;
  }

  async personalStoriesOn(userId: string, day: string) { return this.usage.get(`${userId}:${day}`) ?? 0; }
  async recordPersonalStory(userId: string, day: string) {
    const k = `${userId}:${day}`;
    this.usage.set(k, (this.usage.get(k) ?? 0) + 1);
  }
  async isPremium(userId: string) {
    if (!this.premium.has(userId)) return false;
    const exp = this.premium.get(userId);
    return exp === null || (exp !== undefined && exp > this.now());
  }
  async setPremium(userId: string, expiresAt: Date | null) { this.premium.set(userId, expiresAt); }
  async deleteUser(userId: string) {
    this.premium.delete(userId);
    for (const k of [...this.usage.keys()]) if (k.startsWith(`${userId}:`)) this.usage.delete(k);
  }
}

/** Günlük limit için gün anahtarı (Türkiye saati, UTC+3). */
export const istanbulDay = (d: Date) => new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10);

/** Accept-Language başlığından desteklenen dil (varsayılan Türkçe). */
export function requestLanguage(req: Request): "tr" | "en" {
  return (req.headers.get("accept-language") ?? "").toLowerCase().startsWith("en") ? "en" : "tr";
}
