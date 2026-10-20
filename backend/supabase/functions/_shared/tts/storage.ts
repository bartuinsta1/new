// Ses dosyaları için Supabase Storage (REST API; bağımlılık yok). Kova ÖZELdir: masal sesleri çocuğun adını
// içerebilir; dosyalara yalnızca imzalı (süreli, tahmin edilemez) URL ile erişilir.
// VARSAYIM: imzalı URL 180 gün geçerli — masal yeniden dinlendiğinde ses yine çalsın; süre dolarsa istemci
// cihaz içi sese düşer (oynatıcı ses hatasında konuşma sentezine geçer, bkz. StoryAudioEngine).
import type { AudioStore } from "./tts.ts";

export class SupabaseStorageAudioStore implements AudioStore {
  private base: string;
  private headers: Record<string, string>;
  private bucket: string;
  private ttlSeconds: number;
  private fetchFn: typeof fetch;

  constructor(opts: { url: string; serviceKey: string; bucket: string; ttlSeconds?: number; fetchFn?: typeof fetch }) {
    this.base = `${opts.url.replace(/\/$/, "")}/storage/v1`;
    this.headers = { authorization: `Bearer ${opts.serviceKey}`, apikey: opts.serviceKey };
    this.bucket = opts.bucket;
    this.ttlSeconds = opts.ttlSeconds ?? 180 * 86_400;
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  private path(key: string) { return `${encodeURIComponent(this.bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`; }

  /** Dosya varsa imzalı URL; yoksa null. */
  async find(key: string): Promise<string | null> {
    const res = await this.fetchFn(`${this.base}/object/sign/${this.path(key)}`, {
      method: "POST", headers: { ...this.headers, "content-type": "application/json" },
      body: JSON.stringify({ expiresIn: this.ttlSeconds }),
    });
    if (res.status === 400 || res.status === 404) return null;   // Storage "Object not found" için 400 döner
    if (!res.ok) throw new Error(`storage_sign_${res.status}`);
    const { signedURL } = await res.json() as { signedURL: string };
    return `${this.base}${signedURL.startsWith("/") ? "" : "/"}${signedURL}`;
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<string> {
    const res = await this.fetchFn(`${this.base}/object/${this.path(key)}`, {
      method: "POST",
      headers: { ...this.headers, "content-type": contentType, "x-upsert": "true", "cache-control": "max-age=31536000" },
      body: new Uint8Array(bytes),
    });
    if (!res.ok) throw new Error(`storage_put_${res.status}`);
    const url = await this.find(key);
    if (!url) throw new Error("storage_put_missing");
    return url;
  }

  async deletePrefix(prefix: string): Promise<void> {
    for (;;) {
      const list = await this.fetchFn(`${this.base}/object/list/${encodeURIComponent(this.bucket)}`, {
        method: "POST", headers: { ...this.headers, "content-type": "application/json" },
        body: JSON.stringify({ prefix: prefix.replace(/\/$/, ""), limit: 1000, offset: 0 }),
      });
      if (!list.ok) throw new Error(`storage_list_${list.status}`);
      const items = await list.json() as { name: string }[];
      const names = items.filter((i) => i.name).map((i) => `${prefix.replace(/\/?$/, "/")}${i.name}`);
      if (names.length === 0) return;
      const del = await this.fetchFn(`${this.base}/object/${encodeURIComponent(this.bucket)}`, {
        method: "DELETE", headers: { ...this.headers, "content-type": "application/json" },
        body: JSON.stringify({ prefixes: names }),
      });
      if (!del.ok) throw new Error(`storage_delete_${del.status}`);
      if (items.length < 1000) return;
    }
  }
}
