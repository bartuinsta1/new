// Mağaza katmanı: App Store / Google Play (yerel), test için sahte mağaza, web'de kapalı.
// Oyun mantığı satın almayı `grantPurchase` ile işler; burası sadece mağazayla konuşur.
import { PRODUCTS, PRODUCT_BY_ID, type ProductId } from './data';

export interface StoreProduct {
  id: ProductId;
  price: string;
}

export interface Purchase {
  productId: string;
  transactionId: string;
}

export type PurchaseResult =
  | { ok: true; purchase: Purchase; finish: () => Promise<void> }
  | { ok: false; reason: 'cancelled' | 'pending' | 'unavailable' | 'error'; message?: string };

export interface Store {
  readonly kind: 'native' | 'mock' | 'none';
  /** ürün fiyatlarını getirir (mağazanın yerel para birimiyle) */
  load(): Promise<StoreProduct[]>;
  purchase(id: ProductId): Promise<PurchaseResult>;
  /** kalıcı ürünleri geri yükler */
  restore(): Promise<Purchase[]>;
  /**
   * Uygulama kapanmadan tamamlanamamış ya da başka yerden onaylanmış (Ask to Buy, bekleyen ödeme)
   * satın almalar için dinleyici. `handle` ödülü verip kaydetmeli; sonra işlem mağazada kapatılır.
   */
  onRecovered(handle: (p: Purchase) => void): Promise<void>;
}

export function pickStore(): Store {
  const params = new URLSearchParams(location.search);
  if (params.get('store') === 'mock') return new MockStore();
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
  if (cap?.isNativePlatform?.()) return new NativeStore(cap.getPlatform?.() === 'ios' ? 'ios' : 'android');
  return new NoStore();
}

class NoStore implements Store {
  readonly kind = 'none' as const;
  async load() { return []; }
  async purchase(): Promise<PurchaseResult> { return { ok: false, reason: 'unavailable' }; }
  async restore() { return []; }
  async onRecovered() {}
}

/** Geliştirme ve uçtan uca testler için: gerçek para yok. */
export class MockStore implements Store {
  readonly kind = 'mock' as const;
  private owned = new Set<string>();
  private n = 0;
  async load() {
    const prices: Record<ProductId, string> = {
      mh_fish_small: '₺39,99', mh_fish_medium: '₺179,99', mh_fish_large: '₺399,99',
      mh_winter_pack: '₺129,99', mh_supporter: '₺219,99',
    };
    return PRODUCTS.map((p) => ({ id: p.id, price: prices[p.id] }));
  }
  async purchase(id: ProductId): Promise<PurchaseResult> {
    if (new URLSearchParams(location.search).get('mockfail') === id) return { ok: false, reason: 'cancelled' };
    if (PRODUCT_BY_ID[id].kind === 'nonconsumable') this.owned.add(id);
    return { ok: true, purchase: { productId: id, transactionId: `mock-${Date.now()}-${++this.n}` }, finish: async () => {} };
  }
  async restore() {
    return [...this.owned].map((id, i) => ({ productId: id, transactionId: `mock-restore-${i}` }));
  }
  async onRecovered() {}
}

type Plugin = typeof import('@capgo/native-purchases');

class NativeStore implements Store {
  readonly kind = 'native' as const;
  private mod: Promise<Plugin> | null = null;
  constructor(private platform: 'ios' | 'android') {}

  private plugin() {
    // Eklenti sadece uygulamada yüklenir; web paketi hafif kalır.
    if (!this.mod) {
      this.mod = import('@capgo/native-purchases').then(async (m) => {
        // Ödül kaydedilmeden işlem kapanmasın: kapatmayı biz yaparız.
        await m.NativePurchases.configure({ autoFinishTransactions: false });
        return m;
      });
    }
    return this.mod;
  }

  async load(): Promise<StoreProduct[]> {
    const { NativePurchases, PURCHASE_TYPE } = await this.plugin();
    const { isBillingSupported } = await NativePurchases.isBillingSupported();
    if (!isBillingSupported) return [];
    const { products } = await NativePurchases.getProducts({
      productIdentifiers: PRODUCTS.map((p) => p.id),
      productType: PURCHASE_TYPE.INAPP,
    });
    return products
      .filter((p) => PRODUCT_BY_ID[p.identifier as ProductId])
      .map((p) => ({ id: p.identifier as ProductId, price: p.priceString }));
  }

  private finisher(m: Plugin, productId: string, transactionId: string, purchaseToken?: string) {
    const consumable = PRODUCT_BY_ID[productId as ProductId]?.kind === 'consumable';
    return async () => {
      try {
        if (this.platform === 'ios') await m.NativePurchases.finishTransaction({ transactionId });
        else if (purchaseToken && consumable) await m.NativePurchases.consumePurchase({ purchaseToken });
        else if (purchaseToken) await m.NativePurchases.acknowledgePurchase({ purchaseToken });
      } catch {
        // Bir sonraki açılışta getUnfinishedTransactions ile yeniden denenir.
      }
    };
  }

  async purchase(id: ProductId): Promise<PurchaseResult> {
    const m = await this.plugin();
    try {
      const t = await m.NativePurchases.purchaseProduct({
        productIdentifier: id,
        productType: m.PURCHASE_TYPE.INAPP,
        quantity: 1,
        isConsumable: false,
        autoAcknowledgePurchases: false,
      });
      if (t.purchaseState && /pending/i.test(t.purchaseState)) return { ok: false, reason: 'pending' };
      const transactionId = t.transactionId || t.purchaseToken || t.orderId || '';
      return {
        ok: true,
        purchase: { productId: t.productIdentifier || id, transactionId },
        finish: this.finisher(m, t.productIdentifier || id, t.transactionId, t.purchaseToken),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, reason: /cancel/i.test(message) ? 'cancelled' : 'error', message };
    }
  }

  async restore(): Promise<Purchase[]> {
    const m = await this.plugin();
    await m.NativePurchases.restorePurchases().catch(() => undefined);
    const { purchases } = await m.NativePurchases.getPurchases(
      this.platform === 'ios' ? { onlyCurrentEntitlements: true } : { productType: m.PURCHASE_TYPE.INAPP },
    );
    return purchases
      .filter((t) => PRODUCT_BY_ID[t.productIdentifier as ProductId]?.kind === 'nonconsumable')
      .filter((t) => !t.revocationDate)
      .map((t) => ({ productId: t.productIdentifier, transactionId: t.transactionId || t.purchaseToken || '' }));
  }

  async onRecovered(handle: (p: Purchase) => void): Promise<void> {
    const m = await this.plugin();
    const take = async (t: { productIdentifier: string; transactionId: string; purchaseToken?: string; purchaseState?: string; revocationDate?: string }) => {
      if (!PRODUCT_BY_ID[t.productIdentifier as ProductId] || t.revocationDate) return;
      if (t.purchaseState && /pending/i.test(t.purchaseState)) return;
      handle({ productId: t.productIdentifier, transactionId: t.transactionId || t.purchaseToken || '' });
      await this.finisher(m, t.productIdentifier, t.transactionId, t.purchaseToken)();
    };
    const { transactions } = await m.NativePurchases.getUnfinishedTransactions().catch(() => ({ transactions: [] }));
    for (const t of transactions) await take(t);
    await m.NativePurchases.addListener('transactionUpdated', (t) => void take(t));
  }
}
