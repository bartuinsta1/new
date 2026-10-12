// App Store (StoreKit 2) imzalı veri doğrulaması — JWS + x5c sertifika zinciri.
//
// StoreKit 2 işlemleri (`Transaction.jwsRepresentation`) ve App Store Server Notifications V2 (`signedPayload`)
// ES256 JWS'tir. Başlıktaki `x5c` = [yaprak, ara (WWDR), kök]. Doğrulama:
//   1. Kök sertifikanın SHA-256 parmak izi sabitlenmiş Apple Root CA - G3 ile aynı mı?
//   2. Her sertifika bir üsttekiyle imzalanmış mı, adları zincirleniyor mu, tarihleri geçerli mi?
//   3. Ara sertifikada Apple WWDR işareti (1.2.840.113635.100.6.2.1), yaprakta App Store alındı imzalama
//      işareti (1.2.840.113635.100.6.11.1) var mı?
//   4. JWS imzası yaprak anahtarıyla doğru mu?
// Ardından yük okunur; paket kimliği ve ortam (Production/Sandbox) uygulamanınkiyle eşleşmeli.
//
// Bilerek bağımlılık yok: küçük bir DER okuyucu + `node:crypto` (createPublicKey/verify) Deno'da da çalışır;
// `X509Certificate` sınıfının Deno uyumluluğu kısmi olduğu için kullanılmadı.
// Varsayım: çevrimiçi doğrulama yapıyoruz, sertifika tarihleri "şimdi"ye göre denetlenir (OCSP denetimi yok;
// iptal edilmiş Apple sertifikası pratikte görülmedi — Apple'ın resmi kütüphanesi de varsayılan olarak kapatır).
import { Buffer } from "node:buffer";
import { createHash, createPublicKey, verify as cryptoVerify } from "node:crypto";

/**
 * Apple Root CA - G3 (https://www.apple.com/certificateauthority/AppleRootCA-G3.cer) SHA-256 parmak izi.
 * ÜRETİMDEN ÖNCE: sertifikayı Apple'dan indirip `openssl x509 -inform der -fingerprint -sha256` ile
 * bu değeri teyit edin (bu ortamdan apple.com'a erişilemedi). `APPLE_ROOT_CA_SHA256` ile değiştirilebilir.
 */
export const APPLE_ROOT_CA_G3_SHA256 = "63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179";

const OID_WWDR_INTERMEDIATE = "1.2.840.113635.100.6.2.1";
const OID_APPSTORE_RECEIPT_SIGNING = "1.2.840.113635.100.6.11.1";
const OID_ECDSA_SHA256 = "1.2.840.10045.4.3.2";
const OID_ECDSA_SHA384 = "1.2.840.10045.4.3.3";

export class AppStoreVerificationError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export type AppStoreEnvironment = "Production" | "Sandbox" | "Xcode" | "LocalTesting";

/** JWSTransactionDecodedPayload — kullandığımız alanlar. Tarihler epoch milisaniye. */
export interface TransactionPayload {
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  productId: string;
  purchaseDate: number;
  expiresDate?: number;
  revocationDate?: number;
  /** Satın alırken `appAccountToken` = Supabase kullanıcı kimliği (UUID). */
  appAccountToken?: string;
  /** 1 = tanıtım teklifi (bizde 7 günlük ücretsiz deneme). */
  offerType?: number;
  offerDiscountType?: string;
  environment: AppStoreEnvironment;
  type?: string;
  signedDate?: number;
}

/** App Store Server Notifications V2 — `responseBodyV2DecodedPayload`. */
export interface NotificationPayload {
  notificationType: string;
  subtype?: string;
  notificationUUID: string;
  data?: { bundleId?: string; environment?: AppStoreEnvironment; signedTransactionInfo?: string };
  signedDate?: number;
}

export interface AppStoreVerifierOptions {
  bundleId: string;
  /** Kabul edilen ortamlar. Üretim: ["Production"]; TestFlight/App Review için "Sandbox" da gerekir. */
  environments: AppStoreEnvironment[];
  rootFingerprintSha256?: string;
  now?: () => Date;
}

/** Sunucunun kullandığı arayüz (testlerde sahtesi verilebilir). */
export interface AppStoreVerifier {
  verifyTransaction(jws: string): Promise<TransactionPayload>;
  verifyNotification(jws: string): Promise<NotificationPayload>;
}

export class JwsAppStoreVerifier implements AppStoreVerifier {
  private opts: Required<AppStoreVerifierOptions>;
  constructor(opts: AppStoreVerifierOptions) {
    this.opts = {
      ...opts,
      rootFingerprintSha256: opts.rootFingerprintSha256 ?? APPLE_ROOT_CA_G3_SHA256,
      now: opts.now ?? (() => new Date()),
    };
  }

  async verifyTransaction(jws: string): Promise<TransactionPayload> {
    const p = verifyJws(jws, this.opts.rootFingerprintSha256, this.opts.now()) as Partial<TransactionPayload>;
    if (typeof p.transactionId !== "string" || typeof p.originalTransactionId !== "string" ||
        typeof p.productId !== "string" || typeof p.purchaseDate !== "number") {
      throw new AppStoreVerificationError("malformed_payload");
    }
    if (p.bundleId !== this.opts.bundleId) throw new AppStoreVerificationError("wrong_bundle");
    if (!this.opts.environments.includes(p.environment as AppStoreEnvironment)) {
      throw new AppStoreVerificationError("wrong_environment");
    }
    return p as TransactionPayload;
  }

  async verifyNotification(jws: string): Promise<NotificationPayload> {
    const p = verifyJws(jws, this.opts.rootFingerprintSha256, this.opts.now()) as Partial<NotificationPayload>;
    if (typeof p.notificationType !== "string" || typeof p.notificationUUID !== "string") {
      throw new AppStoreVerificationError("malformed_payload");
    }
    if (p.data?.bundleId !== undefined && p.data.bundleId !== this.opts.bundleId) {
      throw new AppStoreVerificationError("wrong_bundle");
    }
    return p as NotificationPayload;
  }
}

// MARK: - JWS

function b64urlDecode(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new AppStoreVerificationError("malformed_jws");
  return new Uint8Array(Buffer.from(s, "base64url"));
}

/** İmzayı ve zinciri doğrular, yükü (JSON) döner. */
export function verifyJws(jws: string, rootFingerprintSha256: string, now: Date): unknown {
  const parts = jws.split(".");
  if (parts.length !== 3) throw new AppStoreVerificationError("malformed_jws");
  let header: { alg?: string; x5c?: unknown };
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
  } catch {
    throw new AppStoreVerificationError("malformed_jws");
  }
  if (header.alg !== "ES256") throw new AppStoreVerificationError("unsupported_alg");
  if (!Array.isArray(header.x5c) || header.x5c.length !== 3 || !header.x5c.every((c) => typeof c === "string")) {
    throw new AppStoreVerificationError("missing_chain");
  }
  const [leaf, intermediate, root] = (header.x5c as string[]).map((c) => parseCertificate(Buffer.from(c, "base64")));

  const fingerprint = createHash("sha256").update(root.der).digest("hex");
  if (fingerprint !== rootFingerprintSha256.toLowerCase().replace(/:/g, "")) {
    throw new AppStoreVerificationError("untrusted_root");
  }
  verifyIssued(root, root, now);
  verifyIssued(intermediate, root, now);
  verifyIssued(leaf, intermediate, now);
  if (!intermediate.extensionOids.includes(OID_WWDR_INTERMEDIATE)) {
    throw new AppStoreVerificationError("bad_intermediate");
  }
  if (!leaf.extensionOids.includes(OID_APPSTORE_RECEIPT_SIGNING)) throw new AppStoreVerificationError("bad_leaf");

  const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`);
  const ok = cryptoVerify("sha256", signingInput, { key: leaf.publicKey, dsaEncoding: "ieee-p1363" },
    b64urlDecode(parts[2]));
  if (!ok) throw new AppStoreVerificationError("bad_signature");

  try {
    return JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
  } catch {
    throw new AppStoreVerificationError("malformed_payload");
  }
}

// MARK: - Sertifika (minimal X.509 DER okuyucu)

interface Certificate {
  der: Uint8Array;
  tbs: Uint8Array;
  signatureAlgorithm: string;
  signature: Uint8Array;
  issuer: Uint8Array;
  subject: Uint8Array;
  notBefore: Date;
  notAfter: Date;
  publicKey: ReturnType<typeof createPublicKey>;
  extensionOids: string[];
}

function verifyIssued(cert: Certificate, issuer: Certificate, now: Date) {
  if (now < cert.notBefore || now > cert.notAfter) throw new AppStoreVerificationError("certificate_expired");
  if (Buffer.compare(Buffer.from(cert.issuer), Buffer.from(issuer.subject)) !== 0) {
    throw new AppStoreVerificationError("broken_chain");
  }
  const hash = cert.signatureAlgorithm === OID_ECDSA_SHA256 ? "sha256"
    : cert.signatureAlgorithm === OID_ECDSA_SHA384 ? "sha384" : null;
  if (!hash) throw new AppStoreVerificationError("unsupported_certificate");
  if (!cryptoVerify(hash, cert.tbs, { key: issuer.publicKey, dsaEncoding: "der" }, cert.signature)) {
    throw new AppStoreVerificationError("broken_chain");
  }
}

interface Tlv { tag: number; start: number; contentStart: number; end: number }

function readTlv(b: Uint8Array, pos: number): Tlv {
  if (pos + 2 > b.length) throw new AppStoreVerificationError("malformed_certificate");
  const tag = b[pos];
  let len = b[pos + 1];
  let p = pos + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 3 || p + n > b.length) throw new AppStoreVerificationError("malformed_certificate");
    len = 0;
    for (let i = 0; i < n; i++) len = (len << 8) | b[p + i];
    p += n;
  }
  if (p + len > b.length) throw new AppStoreVerificationError("malformed_certificate");
  return { tag, start: pos, contentStart: p, end: p + len };
}

function children(b: Uint8Array, parent: Tlv): Tlv[] {
  const out: Tlv[] = [];
  for (let p = parent.contentStart; p < parent.end;) {
    const t = readTlv(b, p);
    out.push(t);
    p = t.end;
  }
  return out;
}

function decodeOid(bytes: Uint8Array): string {
  const parts: number[] = [];
  let v = 0;
  for (const byte of bytes) {
    v = v * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) {
      parts.push(v);
      v = 0;
    }
  }
  const first = parts.shift() ?? 0;
  return [Math.min(2, Math.floor(first / 40)), first - 40 * Math.min(2, Math.floor(first / 40)), ...parts].join(".");
}

function decodeTime(b: Uint8Array, t: Tlv): Date {
  const s = new TextDecoder().decode(b.slice(t.contentStart, t.end));
  // UTCTime (0x17): YYMMDDHHMMSSZ, GeneralizedTime (0x18): YYYYMMDDHHMMSSZ
  const m = t.tag === 0x17 ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(s)
    : /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(s);
  if (!m) throw new AppStoreVerificationError("malformed_certificate");
  let year = Number(m[1]);
  if (t.tag === 0x17) year += year >= 50 ? 1900 : 2000;
  return new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])));
}

export function parseCertificate(der: Uint8Array): Certificate {
  const root = readTlv(der, 0);
  const [tbsT, algT, sigT] = children(der, root);
  if (!tbsT || !algT || !sigT || sigT.tag !== 0x03) throw new AppStoreVerificationError("malformed_certificate");
  const tbsFields = children(der, tbsT);
  let i = tbsFields[0]?.tag === 0xa0 ? 1 : 0; // [0] version
  i += 2; // serialNumber, signature
  const issuer = tbsFields[i++], validity = tbsFields[i++], subject = tbsFields[i++], spki = tbsFields[i++];
  if (!issuer || !validity || !subject || !spki) throw new AppStoreVerificationError("malformed_certificate");
  const [nb, na] = children(der, validity);

  const extensionOids: string[] = [];
  const extWrapper = tbsFields.slice(i).find((t) => t.tag === 0xa3);
  if (extWrapper) {
    const [extSeq] = children(der, extWrapper);
    for (const ext of children(der, extSeq)) {
      const [oid] = children(der, ext);
      if (oid?.tag === 0x06) extensionOids.push(decodeOid(der.slice(oid.contentStart, oid.end)));
    }
  }
  const [algOid] = children(der, algT);
  return {
    der,
    tbs: der.slice(tbsT.start, tbsT.end),
    signatureAlgorithm: decodeOid(der.slice(algOid.contentStart, algOid.end)),
    signature: der.slice(sigT.contentStart + 1, sigT.end), // BIT STRING: ilk bayt "kullanılmayan bit" sayısı
    issuer: der.slice(issuer.start, issuer.end),
    subject: der.slice(subject.start, subject.end),
    notBefore: decodeTime(der, nb),
    notAfter: decodeTime(der, na),
    publicKey: createPublicKey({ key: Buffer.from(der.slice(spki.start, spki.end)), format: "der", type: "spki" }),
    extensionOids,
  };
}

// MARK: - Abonelik durumu

/** Doğrulanmış işlemden abonelik kaydı (null: iade edilmiş / süresi dolmuş / abonelik değil). */
export function subscriptionFrom(tx: TransactionPayload, now: Date): Subscription | null {
  if (tx.revocationDate !== undefined) return null;
  if (tx.expiresDate === undefined || tx.expiresDate <= now.getTime()) return null;
  if (!PREMIUM_PRODUCTS.includes(tx.productId)) return null;
  return {
    productId: tx.productId,
    expiresAt: new Date(tx.expiresDate),
    isInTrial: tx.offerType === 1 && tx.offerDiscountType === "FREE_TRIAL",
    originalTransactionId: tx.originalTransactionId,
    environment: tx.environment,
  };
}

export const PREMIUM_PRODUCTS: readonly string[] = ["masalcik.premium.monthly", "masalcik.premium.yearly"];

export interface Subscription {
  productId: string;
  expiresAt: Date;
  isInTrial: boolean;
  originalTransactionId: string;
  environment: string;
}
