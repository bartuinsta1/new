// Deneme kodu: biçim, depolar (bellek + PostgREST), kimlik doğrulama, hız sınırı.
// Deno (Supabase Edge) ve Node testlerinde aynı kod çalışır; dış bağımlılık yok.

export const DEFAULT_TRIAL_DAYS = 60;
// Karışan harfler yok (I, O, 0, 1). 32 harf × 8 = 40 bit; tahmine karşı ayrıca hız sınırı var.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newTrialCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(8);
  const chars = Array.from(bytes, (b) => ALPHABET[b % 32]).join("");
  return `BN-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** Kullanıcının yazdığı kodu normalize eder: boşluk/tire/küçük harf toleranslı. Geçersizse null. */
export function normalizeTrialCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[\s-]/g, "").replace(/^BN/, "");
  if (raw.length !== 8 || [...raw].some((c) => !ALPHABET.includes(c))) return null;
  return `BN-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export interface TrialRecord {
  userId: string;
  code: string;
  trialDays: number;
  issuedAt: Date;
  redeemedAt: Date | null;
  partnerUserId: string | null;
}

export interface TrialStore {
  byUser(userId: string): Promise<TrialRecord | null>;
  byCode(code: string): Promise<TrialRecord | null>;
  /** Yoksa ekler; kod çakışırsa false döner (çağıran yeni kodla dener). */
  insert(rec: TrialRecord): Promise<boolean>;
  /** Yalnızca henüz kullanılmamışsa işaretler; başarılıysa true. */
  markRedeemed(code: string, partnerUserId: string, at: Date): Promise<boolean>;
  deleteUser(userId: string): Promise<void>;
}

export class MemoryTrialStore implements TrialStore {
  rows = new Map<string, TrialRecord>();
  async byUser(userId: string) { return this.rows.get(userId) ?? null; }
  async byCode(code: string) { return [...this.rows.values()].find((r) => r.code === code) ?? null; }
  async insert(rec: TrialRecord) {
    if (this.rows.has(rec.userId) || (await this.byCode(rec.code))) return false;
    this.rows.set(rec.userId, { ...rec });
    return true;
  }
  async markRedeemed(code: string, partnerUserId: string, at: Date) {
    const r = await this.byCode(code);
    if (!r || r.redeemedAt) return false;
    r.redeemedAt = at;
    r.partnerUserId = partnerUserId;
    return true;
  }
  async deleteUser(userId: string) { this.rows.delete(userId); }
}

type Row = { user_id: string; code: string; trial_days: number; issued_at: string; redeemed_at: string | null; partner_user_id: string | null };
const fromRow = (r: Row): TrialRecord => ({
  userId: r.user_id, code: r.code, trialDays: r.trial_days, issuedAt: new Date(r.issued_at),
  redeemedAt: r.redeemed_at ? new Date(r.redeemed_at) : null, partnerUserId: r.partner_user_id,
});

/** Supabase PostgREST + Auth Admin üzerinden; service_role anahtarı yalnızca sunucuda. */
export class RestTrialStore implements TrialStore {
  private url: string;
  private serviceKey: string;
  private fetcher: typeof fetch;
  constructor(url: string, serviceKey: string, fetcher: typeof fetch = fetch) {
    this.url = url; this.serviceKey = serviceKey; this.fetcher = fetcher;
  }

  private req(path: string, init: RequestInit = {}) {
    return this.fetcher(`${this.url}${path}`, {
      ...init,
      headers: {
        apikey: this.serviceKey, authorization: `Bearer ${this.serviceKey}`, "content-type": "application/json",
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  }
  private async one(query: string) {
    const res = await this.req(`/rest/v1/trial_codes?${query}&limit=1`);
    if (!res.ok) throw new Error(`trial_codes okunamadı: ${res.status}`);
    const rows = (await res.json()) as Row[];
    return rows[0] ? fromRow(rows[0]) : null;
  }
  byUser(userId: string) { return this.one(`user_id=eq.${encodeURIComponent(userId)}`); }
  byCode(code: string) { return this.one(`code=eq.${encodeURIComponent(code)}`); }
  async insert(rec: TrialRecord) {
    const res = await this.req("/rest/v1/trial_codes", {
      method: "POST",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({ user_id: rec.userId, code: rec.code, trial_days: rec.trialDays, issued_at: rec.issuedAt.toISOString() }),
    });
    if (res.status === 409) return false; // benzersizlik çakışması
    if (!res.ok) throw new Error(`trial_codes yazılamadı: ${res.status}`);
    return true;
  }
  async markRedeemed(code: string, partnerUserId: string, at: Date) {
    // Koşullu güncelleme: redeemed_at boşsa. Aynı anda iki istek gelse de yalnızca biri kazanır.
    const res = await this.req(`/rest/v1/trial_codes?code=eq.${encodeURIComponent(code)}&redeemed_at=is.null`, {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ redeemed_at: at.toISOString(), partner_user_id: partnerUserId }),
    });
    if (!res.ok) throw new Error(`trial_codes güncellenemedi: ${res.status}`);
    return ((await res.json()) as Row[]).length === 1;
  }
  async deleteUser(userId: string) {
    // auth.users silinince trial_codes satırı da cascade ile gider.
    const res = await this.req(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new Error(`kullanıcı silinemedi: ${res.status}`);
  }
}

export interface AuthUser { id: string; email: string | null; emailConfirmed: boolean }
export interface AuthProvider { user(req: Request): Promise<AuthUser | null> }

/** Uygulamanın gönderdiği access token'ı Supabase Auth'a sorarak doğrular. */
export class SupabaseAuth implements AuthProvider {
  private url: string;
  private anonKey: string;
  private fetcher: typeof fetch;
  constructor(url: string, anonKey: string, fetcher: typeof fetch = fetch) {
    this.url = url; this.anonKey = anonKey; this.fetcher = fetcher;
  }
  async user(req: Request): Promise<AuthUser | null> {
    const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return null;
    const res = await this.fetcher(`${this.url}/auth/v1/user`, { headers: { apikey: this.anonKey, authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const u = (await res.json()) as { id: string; email?: string; email_confirmed_at?: string | null };
    return { id: u.id, email: u.email ?? null, emailConfirmed: Boolean(u.email_confirmed_at) };
  }
}

export class RateLimiter {
  private hits = new Map<string, number[]>();
  private max: number;
  private windowMs: number;
  private now: () => number;
  constructor(max: number, windowMs: number, now: () => number = Date.now) {
    this.max = max; this.windowMs = windowMs; this.now = now;
  }
  allow(key: string): boolean {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs);
    if (recent.length >= this.max) { this.hits.set(key, recent); return false; }
    recent.push(t);
    this.hits.set(key, recent);
    return true;
  }
}

/** Sabit zamanlı karşılaştırma (ortak uygulama gizli anahtarı için). */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}
