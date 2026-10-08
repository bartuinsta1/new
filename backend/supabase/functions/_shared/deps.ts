// Sahte bağımlılıklar (Adım 1). Not: her Edge Function ayrı bir isolate'te çalışır, bu yüzden bellek içi
// sayaçlar fonksiyonlar arasında paylaşılmaz. Adım 5/10'da Postgres tablolarına (bkz. migrations) bağlanacak.
import { MemoryStores, mockAuth, RateLimiter } from "./http.ts";

export const stores = new MemoryStores();
export const auth = mockAuth;
/** Kullanıcı başına dakikada 20 istek. */
export const limiter = new RateLimiter(20, 60_000);
