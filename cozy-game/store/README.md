# Mağaza yayını: App Store + Google Play

**Model:** Oyun **ücretsiz**. Reklam yok. İsteğe bağlı uygulama içi paketler var.
**Destek:** iOS 15 ve üstü (iOS 15–26, yaklaşık 6 ana sürüm), Android 7.0 ve üstü (API 24–36, 10 ana sürüm).

Mağaza metinleri ve görseller `fastlane/` klasöründe hazır. İstersen fastlane ile otomatik yükle, istersen elle kopyala.

```
fastlane/metadata/ios/{tr,en-US}/        ad, alt başlık, anahtar kelimeler, açıklama, tanıtım, URL'ler
fastlane/screenshots/ios/{tr,en-US}/     1290×2796 (6,9" iPhone)
fastlane/metadata/android/{tr-TR,en-US}/ başlık, kısa/uzun açıklama, sürüm notu
  images/phoneScreenshots/               1080×1920 (Play en fazla 2:1 oran ister)
  images/featureGraphic.png              1024×500
  images/icon.png                        512×512
```
Görselleri yeniden üretmek için: `npm run build && node scripts/store-assets.mjs`
Metin uzunlukları `tests/store-metadata.test.ts` ile denetleniyor (sınır aşılırsa test kırılır).

---

## 1. Uygulama içi ürünler

Ürün kimlikleri koddaki (`src/data.ts › PRODUCTS`) ile **birebir aynı** açılmalı.

| Ürün kimliği | Tür (Apple / Google) | Verdiği | Önerilen fiyat |
|---|---|---|---|
| `mh_fish_small` | Consumable / Tüketilebilir | 1.200 🐟 | 0,99 $ (~39,99 TL) |
| `mh_fish_medium` | Consumable / Tüketilebilir | 7.500 🐟 · "En sevilen" | 4,99 $ (~179,99 TL) |
| `mh_fish_large` | Consumable / Tüketilebilir | 20.000 🐟 · "En avantajlı" | 9,99 $ (~399,99 TL) |
| `mh_winter_pack` | Non-Consumable / Tek seferlik | Kuzey Işıkları duvar kâğıdı, Kar Küresi Yatağı, 2.000 🐟 | 2,99 $ (~129,99 TL) |
| `mh_supporter` | Non-Consumable / Tek seferlik | Kalıcı +%25 balık, 24 saat çevrimdışı kazanç, 3.000 🐟 | 4,99 $ (~219,99 TL) |

Ekranda görünen fiyatı oyun mağazadan alıyor: hangi fiyatı girersen o görünür, para birimi de otomatik ayarlanır.

**Ürün adları ve açıklamaları.** Apple'da ad en fazla 30, açıklama en fazla 45 karakter olabilir.

| Kimlik | TR ad | TR açıklama | EN ad | EN açıklama |
|---|---|---|---|---|
| mh_fish_small | Bir Kova Balık | 1.200 balık | Bucket of Fish | 1,200 fish |
| mh_fish_medium | Balık Sepeti | 7.500 balık | Fish Basket | 7,500 fish |
| mh_fish_large | Balıkçı Teknesi | 20.000 balık | Fishing Boat | 20,000 fish |
| mh_winter_pack | Kış Masalı Paketi | Kış duvar kâğıdı, Kar Küresi ve balık | Winter Tale Pack | Aurora wallpaper, Snow Globe and fish |
| mh_supporter | Han Dostu | +%25 balık, 24 saat çevrimdışı, balık | Inn Friend | +25% fish, 24h offline, bonus fish |

**İnceleme notu** (App Review / Play inceleme ekibine):
> The game is fully playable for free. Optional packs are in the 🛍️ button › "💎 Packs" tab (tapping the fish counter also opens it). "Restore purchases" is at the bottom of the same tab. No account or login is required.

### Teknik ayrıntılar (koddaki karşılıkları)
- **Sağlam teslimat:** Ödül önce oyuna işlenip kaydediliyor, işlem mağazada ancak ondan sonra kapatılıyor (`autoFinishTransactions: false`). Uygulama arada kapanırsa yarım kalan işlem bir sonraki açılışta tamamlanıyor (`getUnfinishedTransactions`).
- **Çift ödül koruması:** Aynı işlem kimliği iki kez ödül vermiyor (`grantPurchase` › `txns`).
- **Geri yükleme:** Tek seferlik paketler mağazadan geri yükleniyor. "Hanı sıfırla" satın alımları silmiyor.
- **Bekleyen ödemeler:** Ask to Buy ve Play'deki bekleyen ödemeler onaylanınca dinleyici paketi teslim ediyor.
- **Doğrulama:** Sunucusuz, cihaz üzerinde. Tek oyunculu ve çevrimdışı bir oyun için yeterli. StoreKit 2 işlemleri zaten Apple imzalı (JWS); doğrulanamayanları eklenti eliyor.

---

## 2. Google Play Console

1. **Uygulama oluştur:** ad "Mırnav Hanı: Kedi Pansiyonu", varsayılan dil Türkçe, tür Oyun, **Ücretsiz**.
2. **Paket adı:** `com.mirnavhani.game`. İlk yüklemeden sonra değiştirilemez.
3. **İmza anahtarı** (bir kez yap, dosyayı ve şifreleri güvenli bir yerde sakla):
   ```bash
   keytool -genkey -v -keystore mirnav-release.jks -alias mirnav -keyalg RSA -keysize 2048 -validity 10000
   ```
   GitHub › Settings › Secrets and variables › Actions altına şu sırları ekle:
   - `ANDROID_KEYSTORE_BASE64` (değeri: `base64 -w0 mirnav-release.jks`)
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`

   Bundan sonra CI her push'ta **imzalı AAB** üretir (Actions › Artifacts › `mirnav-hani-release-aab`). Play App Signing'i açık bırak.
4. **Ürünler:** Monetize › Products › In-app products altında yukarıdaki 5 ürünü aç.
   - Not: Ürün oluşturabilmek için önce satın alma yetkisi olan bir AAB'nin herhangi bir test kanalına yüklenmiş olması gerekir. Önce 5. adımı yap.
5. **Test:** Testing › Internal testing'e AAB'yi yükle. Lisans test kullanıcılarını (Setup › License testing) ekleyerek gerçek para ödemeden satın almayı dene.
6. **App content:**
   - **Gizlilik politikası:** `https://bartuinsta1.github.io/new/privacy.html`
   - **Reklam:** Hayır
   - **Veri güvenliği:** "Veri toplanmıyor / paylaşılmıyor". Satın almaları Google Play işler; uygulama veri göndermez.
   - **Hedef kitle:** 13+ öner. Uygulama içi satın alma olduğu için "çocuklara yönelik" (Families) programına girmemek inceleme yükünü azaltır.
   - **İçerik derecelendirmesi (IARC):** şiddet yok, kumar yok, kullanıcı etkileşimi yok, **dijital satın alma: Evet** → PEGI 3 / Everyone beklenir.
7. **Mağaza kaydı:** `fastlane/metadata/android/` içeriğini gir ya da `fastlane supply` ile yükle.
8. **Hedef SDK:** 36 (Android 16). Google'ın 2026 şartını karşılıyor.

## 3. App Store Connect

1. **Apple Developer'da App ID:** `com.mirnavhani.game`. In-App Purchase yeteneği varsayılan olarak açık.
2. **Yeni uygulama:** ad "Mırnav Hanı: Kedi Pansiyonu", birincil dil Türkçe, SKU `mirnav-hani`.
3. **Fiyat:** Ücretsiz. **Uygulama içi satın almalar** bölümünde 5 ürünü aç (yukarıdaki tablo). Ürün başına 1 inceleme ekran görüntüsü gerekir: mağaza sekmesinin görüntüsü yeterli.
4. **Paid Applications Agreement** + vergi ve banka bilgileri. Ücretsiz uygulamada bile satın alma için zorunlu.
5. **Gizlilik:** "Data Not Collected". `PrivacyInfo.xcprivacy` hazır (izleme yok, toplanan veri yok).
6. **Yaş derecelendirmesi:** tüm sorulara "Yok" → 4+. "In-App Purchases" bilgisi otomatik görünür.
7. **Derleme (Mac + Xcode 16 ya da üstü):**
   ```bash
   cd cozy-game && npm ci && npm run ios
   ```
   Xcode'da: App › Signing & Capabilities › Team seç › **+ Capability › In-App Purchase**. Ardından Product › Archive › Distribute › App Store Connect.
8. **Sandbox testi:** Users and Access › Sandbox altında test hesabı aç, TestFlight sürümüyle satın almayı dene.
9. **Kayıt metinleri:** `fastlane/metadata/ios/` içeriğini gir ya da `fastlane deliver` ile yükle. Ekran görüntüleri `fastlane/screenshots/ios/` içinde.

## 4. Yayın öncesi kontrol listesi
- [ ] CI yeşil: birim, uçtan uca (Chromium/WebKit/Firefox), Android emülatör (API 28/31/35), iOS simülatör.
- [ ] İki mağazada 5 ürün açık ve kimlikler birebir aynı.
- [ ] Sandbox ve lisans testiyle her ürün en az bir kez satın alındı. Geri yükleme denendi.
- [ ] Gizlilik politikası adresi açılıyor (GitHub Pages: Settings › Pages › Source: `gh-pages`).
- [ ] Sürüm: `package.json › version` (sürüm adı); Android sürüm kodu CI çalışma numarası; iOS build numarası Xcode'da her yüklemede artırılır.
