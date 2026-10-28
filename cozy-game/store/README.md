# Mağaza yayını: App Store + Google Play

**Model:** Tek seferlik ücretli uygulama, yaklaşık **25 TL**. Uygulama içi satın alma ve reklam yok. Web'de ücretsiz bir demo var (4. seviyede durur).

## Fiyat
| Mağaza | Nasıl |
|---|---|
| Google Play | Play Console › Monetize › Pricing. Türkiye için **24,99 TL** girilebilir; diğer ülkeler otomatik çevrilir, istersen elle ayarla. |
| App Store | App Store Connect › Pricing and Availability. Apple sabit fiyat noktaları kullanır: Türkiye'yi **temel ülke** seç ve 25 TL'ye en yakın noktayı (ör. 24,99 TL) seç. Diğer ülkeler otomatik hesaplanır. |

> Ücretli uygulama satmak için: Apple'da **Paid Apps Agreement** ile vergi ve banka bilgileri, Google'da **ödeme profili** gerekir. Geliştirici hesapları ücretlidir: Apple yıllık 99 $, Google tek seferlik 25 $.

## Kimlik
- Paket / Bundle ID: `com.mirnavhani.game` (yayından önce değiştirilecekse `capacitor.config.ts`, Android `applicationId` ve Xcode'da birlikte değiştir)
- Kategori: Oyunlar › Simülasyon (ikincil: Gündelik)
- Yaş: 4+ / PEGI 3 / Everyone. Şiddet, reklam ve sohbet yok.
- Gizlilik: **Veri toplanmıyor** (App Store "Data Not Collected"; Play "No data collected").
- Gizlilik politikası URL'si: `https://bartuinsta1.github.io/new/privacy.html`

## Derleme
```bash
cd cozy-game
npm ci
npm run android   # Android Studio açılır › Build › Generate Signed Bundle (AAB)
npm run ios       # Xcode açılır (Mac gerekir) › Signing'de takımını seç › Product › Archive
```
GitHub Actions her push'ta test edilebilir bir **debug APK** üretir (Actions › Mırnav Hanı › Artifacts). Bunu telefona kurup deneyebilirsin; mağazaya yüklemek için yukarıdaki imzalı sürüm gerekir.

---

## 🇹🇷 Türkçe mağaza metni

**Ad (30):** Mırnav Hanı: Kedi Pansiyonu
**Alt başlık (30):** Karlı kasabada sıcak bir yuva
**Anahtar kelimeler (100):** kedi,cozy,rahatlatıcı,pansiyon,idle,koleksiyon,dekorasyon,kış,sakin,tatlı,kedi oyunu,offline

**Tanıtım metni (170):**
İlk kar yağdı! Soğukta kalan kedilere kapını aç, sevdikleri köşeyi bul ve eski hanı kasabanın en sıcak yerine çevir.

**Açıklama:**
Dağ kasabasına kış geldi. Kapında üşüyen bir kedi bekliyor…

Mırnav Hanı, sokak kedileri için sıcacık bir pansiyon işlettiğin rahatlatıcı bir oyun. Acele yok, süre yok, ceza yok. Sadece mırıltılar, şömine çıtırtısı ve camdan süzülen kar.

🐾 18 KEDİ CİNSİNİ AĞIRLA
Tekir, Van kedisi, Ankara, Siyam, kocaman Maine Coon… Her kedinin bir huyu var: kimi şömine başını sever, kimi pencereden kar izlemeyi, kimi karton kutuyu. Onları sevdikleri yere koy, mutluluktan mırlasınlar.

🛋️ HANINI DÖŞE
Minderler, kedi ağaçları, örgü iglo, kadife kanepe, sıcak çikolata tezgâhı ve taş şömine. Salonu, Mutfağı, Çatı Katını ve Kış Serasını aç.

✨ TOPARLA, GELİŞTİR, KOLEKSİYON YAP
Yün yumaklarını ve karlı pati izlerini topla. Hanını geliştir, duvar kâğıtlarını değiştir, kedi albümünü doldur.

❄️ MEVSİMLER VE GERÇEK ZAMAN
Pencere gerçek saate göre gündüz, akşam ya da gece görünür. Kasım'da İlk Kar Festivali başlar ve nadir Kartopu kedisi kapını çalar.

🌙 SEN YOKKEN DE AÇIK
Han sen yokken de işler. Döndüğünde misafirlerin bahşişleri seni bekler.

• Tek seferlik ödeme: reklam yok, uygulama içi satın alma yok
• İnternetsiz oynanır
• Hiçbir veri toplanmaz
• Türkçe ve İngilizce

---

## 🇬🇧 English store text

**Name (30):** Snowpaw Inn: Cozy Cat Hotel
**Subtitle (30):** A warm home in a snowy town
**Keywords (100):** cat,cozy,relaxing,idle,inn,hotel,collect,decorate,winter,cute,kitten,offline,calm,pet

**Promotional text (170):**
The first snow has fallen! Open your door to cats out in the cold, find each one's favorite spot, and turn an old inn into the warmest place in town.

**Description:**
Winter has come to the mountain town, and a shivering cat is waiting at your door…

Snowpaw Inn is a relaxing game about running a cozy inn for stray cats. No rush, no timers, no penalties. Just purring, a crackling fire and snow drifting past the window.

🐾 HOST 18 CAT BREEDS
Tabbies, Van cats, Angoras, Siamese, a giant fluffy "Big Bear"… Every cat has a favorite kind of spot: by the fire, at the window watching snow, or inside a cardboard box. Seat them where they love to be and watch them purr.

🛋️ DECORATE YOUR INN
Cushions, cat trees, a knitted igloo, a velvet sofa, a hot cocoa counter and a stone fireplace. Open the Living Room, Kitchen, Attic and Winter Greenhouse.

✨ TIDY, UPGRADE, COLLECT
Sweep up yarn balls and snowy paw prints. Upgrade the inn, swap wallpapers and fill your cat album.

❄️ SEASONS & REAL TIME
The window follows your real clock: day, dusk and starry night. In November the First Snow Festival begins, and the rare Snowball cat may visit.

🌙 OPEN WHILE YOU'RE AWAY
The inn keeps running while you're away, and grateful guests leave tips for when you return.

• One-time purchase: no ads, no in-app purchases
• Plays offline
• No data collected
• English and Turkish
