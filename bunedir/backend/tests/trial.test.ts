import { test } from "node:test";
import assert from "node:assert/strict";
import { createTrialHandler } from "../supabase/functions/bunedir-trial/handler.ts";
import {
  type AuthProvider, MemoryTrialStore, newTrialCode, normalizeTrialCode, RateLimiter, RestTrialStore, safeEqual,
} from "../supabase/functions/bunedir-trial/trial.ts";

const NOW = new Date("2026-11-09T12:00:00Z");
const SECRET = "ortak-gizli";
// Token = kullanıcı kimliği; "anon-" ile başlayanların e-postası doğrulanmamış.
const auth: AuthProvider = {
  async user(req) {
    const t = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!t) return null;
    return { id: t, email: t.startsWith("anon-") ? null : `${t}@ornek.com`, emailConfirmed: !t.startsWith("anon-") };
  },
};

function setup(opts: { codes?: string[]; limit?: number } = {}) {
  const store = new MemoryTrialStore();
  const codes = opts.codes ? [...opts.codes] : undefined;
  const h = createTrialHandler({
    auth, store, limiter: new RateLimiter(opts.limit ?? 100, 60_000), partnerSecret: SECRET, now: () => NOW,
    newCode: codes ? () => codes.shift()! : undefined,
  });
  const call = (method: string, path: string, init: { user?: string; secret?: string; body?: unknown } = {}) =>
    h(new Request(`https://x.supabase.co/functions/v1/bunedir-trial${path}`, {
      method,
      headers: {
        ...(init.user ? { authorization: `Bearer ${init.user}` } : {}),
        ...(init.secret ? { "x-partner-secret": init.secret } : {}),
      },
      body: init.body === undefined ? undefined : typeof init.body === "string" ? init.body : JSON.stringify(init.body),
    }));
  const redeem = (code: unknown, partner_user_id: unknown = "p-1", secret = SECRET) =>
    call("POST", "/redeem", { secret, body: { code, partner_user_id } });
  return { store, call, redeem };
}

test("kod biçimi ve normalize", () => {
  for (let i = 0; i < 300; i++) assert.match(newTrialCode(), /^BN-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(normalizeTrialCode(" bn-abcd-2345 "), "BN-ABCD-2345");
  assert.equal(normalizeTrialCode("abcd 2345"), "BN-ABCD-2345");
  assert.equal(normalizeTrialCode("BN-ABCD-234O"), null, "O harfi yok");
  assert.equal(normalizeTrialCode("BN-ABC"), null);
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "abcd"), false);
});

test("doğrulanmış kullanıcı 60 günlük kod alır; tekrar sorunca aynı kod", async () => {
  const { call } = setup();
  const first = await (await call("GET", "", { user: "ayse" })).json();
  assert.equal(first.trial_days, 60);
  assert.equal(first.redeemed, false);
  const again = await (await call("GET", "", { user: "ayse" })).json();
  assert.equal(again.code, first.code);
  const other = await (await call("GET", "", { user: "mehmet" })).json();
  assert.notEqual(other.code, first.code);
});

test("girişsiz 401, e-postası doğrulanmamış 403", async () => {
  const { call } = setup();
  assert.equal((await call("GET", "")).status, 401);
  assert.equal((await call("GET", "", { user: "anon-1" })).status, 403);
  assert.equal((await call("PUT", "", { user: "ayse" })).status, 405);
  assert.equal((await call("GET", "/baska", { user: "ayse" })).status, 404);
});

test("kod çakışırsa yeni kodla dener", async () => {
  const { call } = setup({ codes: ["BN-AAAA-AAAA", "BN-AAAA-AAAA", "BN-BBBB-BBBB"] });
  assert.equal((await (await call("GET", "", { user: "a" })).json()).code, "BN-AAAA-AAAA");
  assert.equal((await (await call("GET", "", { user: "b" })).json()).code, "BN-BBBB-BBBB");
});

test("ortak sunucu kodu bir kez kullanır; aynı kullanıcı tekrar edebilir", async () => {
  const { call, redeem } = setup();
  const { code } = await (await call("GET", "", { user: "ayse" })).json();

  const res = await redeem(code.toLowerCase().replace(/-/g, " "), "masal-42");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.trial_days, 60);
  assert.equal(body.trial_ends_at, "2027-01-08T12:00:00.000Z");

  const repeat = await redeem(code, "masal-42");
  assert.equal(repeat.status, 200);
  assert.equal((await repeat.json()).trial_ends_at, body.trial_ends_at);

  assert.equal((await redeem(code, "baskasi")).status, 409);
  assert.equal((await (await call("GET", "", { user: "ayse" })).json()).redeemed, true);
});

test("redeem: gizli anahtar, geçersiz kod ve gövde kontrolleri", async () => {
  const { redeem, call } = setup();
  assert.equal((await redeem("BN-ABCD-2345", "p", "yanlis")).status, 401);
  assert.equal((await redeem("BN-ABCD-2345")).status, 404);
  assert.equal((await redeem("??")).status, 400);
  assert.equal((await redeem("BN-ABCD-2345", "")).status, 400);
  assert.equal((await call("POST", "/redeem", { secret: SECRET, body: "{bozuk" })).status, 400);
  assert.equal((await call("GET", "/redeem", { secret: SECRET })).status, 405);
});

test("gizli anahtar tanımlı değilse redeem tamamen kapalı", async () => {
  const h = createTrialHandler({ auth, store: new MemoryTrialStore(), limiter: new RateLimiter(10, 1000), partnerSecret: "" });
  const res = await h(new Request("https://x/functions/v1/bunedir-trial/redeem", {
    method: "POST", headers: { "x-partner-secret": "" }, body: JSON.stringify({ code: "BN-ABCD-2345", partner_user_id: "p" }),
  }));
  assert.equal(res.status, 401);
});

test("redeem hız sınırı", async () => {
  const { redeem } = setup({ limit: 2 });
  await redeem("BN-ABCD-2345");
  await redeem("BN-ABCD-2345");
  assert.equal((await redeem("BN-ABCD-2345")).status, 429);
});

test("hesap silme kodu da siler", async () => {
  const { call, store, redeem } = setup();
  const { code } = await (await call("GET", "", { user: "ayse" })).json();
  assert.equal((await call("DELETE", "", { user: "ayse" })).status, 204);
  assert.equal(await store.byUser("ayse"), null);
  assert.equal((await redeem(code)).status, 404);
});

test("RestTrialStore PostgREST isteklerini doğru kurar", async () => {
  const calls: { url: string; method: string; body?: string }[] = [];
  const fake = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body as string | undefined });
    if (url.includes("redeemed_at=is.null")) return new Response("[]", { status: 200 });
    if (init.method === "POST") return new Response(null, { status: 409 });
    if (init.method === "DELETE") return new Response(null, { status: 404 });
    return new Response(JSON.stringify([{ user_id: "u", code: "BN-ABCD-2345", trial_days: 60, issued_at: NOW.toISOString(), redeemed_at: null, partner_user_id: null }]));
  }) as typeof fetch;
  const s = new RestTrialStore("https://p.supabase.co", "srv", fake);
  assert.equal((await s.byCode("BN-ABCD-2345"))?.userId, "u");
  assert.equal(await s.insert({ userId: "u", code: "BN-ABCD-2345", trialDays: 60, issuedAt: NOW, redeemedAt: null, partnerUserId: null }), false);
  assert.equal(await s.markRedeemed("BN-ABCD-2345", "p", NOW), false, "başkası önce kullanmış");
  await s.deleteUser("u");
  assert.deepEqual(calls.map((c) => c.method), ["GET", "POST", "PATCH", "DELETE"]);
  assert.match(calls[0].url, /trial_codes\?code=eq\.BN-ABCD-2345&limit=1$/);
  assert.match(calls[3].url, /\/auth\/v1\/admin\/users\/u$/);
});
