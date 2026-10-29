# 🐾 Mırnav Hanı · Snowpaw Inn

Karlı bir dağ kasabasında, soğukta kalan sokak kedileri için sıcacık bir han işlettiğin, telefona uygun, rahatlatıcı (cozy) bir oyun.

## Neden bu fikir? (Ekim sonu / Kasım 2026 verileri)

| Sinyal | Kaynak |
|---|---|
| Steam'de "cozy" etiketli oyun sayısı: 2024'te 389 → 2025'te 650 → 2026'da şimdiden 1.341 | PC Gamer |
| 2026'da en hızlı büyüyen cozy alt türleri: **idle/incremental**, **toparlama (tidying)**, **masaüstü yoldaşı**, **çiftlik idle** | Steam niş analizi (PC Gamer üzerinden) |
| Ekim 2026 mobil çıkışları kış ve hayvan temalı: *Winter Burrow* (App Store Editörün Seçimi), *Pusheen's Place* (Apple Arcade) | AppGamer |
| Kasım 2026: *Cat Secretary* (4 Kasım), Cozy Quest Steam Festivali (16–20 Kasım), kafe/han yönetimi oyunları (*Tailside*) | Screen Hype, Destructoid |
| Kalıcı mobil favoriler: *Neko Atsume 2*, *Heartopia*, *Stardew Valley* | Mobi.gg, CozyGameReviews |
| Uyarı: Etiket büyümesi satış büyümesi değil; tür kalabalık, öne çıkmak için net bir "kanca" gerekiyor | iTechGuides |

**Sonuç:** Büyüyen üç trendi (idle + toparlama + kediler) Kasım'ın kış/ilk kar havasıyla birleştiren, kısa oturumluk bir mobil oyun.
Kanca: *"Neko Atsume'nin kedi toplama keyfi + toparlamanın tatmini + kışın ilk karı."*

## Oynanış

1. **Kapıda bekleyen kediler.** Her kedinin bir cinsi ve bir tercihi var: 🔥 Sıcak, 🌙 Sessiz, 🧶 Oyuncu, 🪟 Manzara.
2. **Yerleştir.** Kediye dokun, sonra parlayan yere dokun. Kediye ikinci kez dokunursan en uygun yere kendisi geçer. Sevdiği türdeki yerde 2 kat mutlu olur 💖.
3. **Balık kazan.** Misafir kediler zamanla 🐟 kazandırır. Ayrılırken bahşiş ve ❤️ bırakırlar.
4. **Toparla.** Yün yumağı, karlı pati izi, dökülmüş süt, kuru yaprak ve tüy yumağı belirir. Dokunup topla; dağınıklık odanın konforunu düşürür.
5. **Döşe ve büyüt.** 14 mobilya, 4 oda (Salon, Mutfak, Çatı Katı, Kış Serası), 12 seviye.
6. **Han Geliştirme 🛍️.** Biriken balığın harcandığı yer:
   - 5 geliştirme (Sıcak Mama, Sihirli Süpürge, Kapı Zili, Örgü Battaniye, Kartpostal Rafı). Her seviyede fiyatları katlanır, bu yüzden oyunun sonunda da harcayacak yer kalır.
   - 7 koleksiyonluk duvar kâğıdı: bir kez alınır, istenen odaya uygulanır.
7. **Albüm.** 18 kedi cinsi. Mevsimlik efsaneviler: ❄️ *Kartopu* (Kasım–Şubat), 🍂 *Balkabağı* (Eylül–Kasım).
8. **Sen yokken de** han işler (en fazla 12 saat). Her gün bir hediye var. Kasım–Aralık'ta **İlk Kar Festivali** ışıkları yanar.

Pencere gerçek saate göre gündüz, akşam ya da gece görünür; dışarısı mevsime göre karlı ya da yapraklıdır.

## Sürümler ve gelir modeli

| Sürüm | Nerede | Fiyat |
|---|---|---|
| Uygulama (iOS + Android) | App Store, Google Play (Capacitor 8) | **Ücretsiz**, reklam yok, isteğe bağlı paketler |
| Web | https://bartuinsta1.github.io/new/ | Ücretsiz, tam oyun; paketler yalnızca uygulamada |

**Paketler** (🛍️ › 💎 Paketler ya da balık sayacına dokun):
- 3 balık paketi: 1.200, 7.500 ve 20.000 🐟.
- **Kış Masalı Paketi:** Kuzey Işıkları duvar kâğıdı, Kar Küresi Yatağı ve 2.000 🐟.
- **Han Dostu:** kalıcı +%25 balık, 24 saat çevrimdışı kazanç ve 3.000 🐟.

Satın almalar kayda işlenmeden mağazada kapatılmıyor, yarım kalanlar açılışta tamamlanıyor ve "Hanı sıfırla" paketleri silmiyor.

**Desteklenen sürümler:** iOS 15 ve üstü (yaklaşık son 6 ana sürüm), Android 7.0 ve üstü (API 24–36, son 10 ana sürüm). Eski motorlarda olmayan `roundRect`, `Object.fromEntries` ve `ResizeObserver` için yedekler var. Derleme hedefi Chrome 64 / Safari 15.

Diller: Türkçe ve İngilizce (telefonun diline göre; ayarlardan değiştirilebilir). İngilizce adı **Snowpaw Inn**.
Mağaza adımları, ürün kimlikleri ve kontrol listesi: [`store/README.md`](store/README.md).

## Teknik

- TypeScript + Vite. Çatı (framework) yok; tek bir Canvas sahnesi ve DOM arayüz.
- **Tüm grafikler kodla çiziliyor** (`src/draw.ts`), müzik ve efektler WebAudio ile üretiliyor (`src/audio.ts`). Görsel ya da ses dosyası yok; oyun yaklaşık 20 KB (gzip).
- Oyun mantığı saf ve test edilebilir (`src/game.ts`, `tests/`).
- PWA: telefonda "Ana Ekrana Ekle" ile uygulama gibi açılır ve internetsiz çalışır.

```bash
cd cozy-game
npm install
npm run dev         # telefondan aynı ağdaki IP ile açılabilir
npm test
npm run build       # tam sürüm (dist/)
npm run test:e2e    # uçtan uca testler (önce build); E2E_BROWSER=webkit|firefox
npm run android     # Android Studio'da açar
npm run ios         # Xcode'da açar (Mac)
```

- Yerel uygulama: Capacitor 8 (`android/`, `ios/`). İkonlar ve açılış ekranı `assets/` içinden üretilir.
- GitHub Actions (`.github/workflows/cozy-game.yml`) her push'ta şunları yapar:
  - testleri çalıştırır,
  - Chromium, WebKit (iOS motoru) ve Firefox'ta uçtan uca testleri çalıştırır,
  - web sürümünü `gh-pages` dalına yayınlar,
  - debug APK ve release AAB üretir (imza sırları varsa imzalı),
  - APK'yı Android 9, 12 ve 15 emülatörlerinde açıp kontrol eder,
  - iOS'u derler ve kurulu en eski ve en yeni iOS simülatöründe açar.

Test için URL parametreleri: `?month=10` (Kasım), `?hour=21` (gece).

## Testler

| Katman | Ne test ediliyor |
|---|---|
| Birim (Vitest, 50 test) | Oyun mantığı, satın alma hakları ve çift ödül koruması, eski kayıtların yüklenmesi, bozuk kayıt, veri tutarlılığı, iki dilin eşleşmesi, tüm çizimler (NaN ve negatif yarıçap denetimi), ekonomi dengesi (bot), mağaza metni sınırları |
| Uçtan uca (Playwright, 25 test) | İlk oyun akışı, kalıcılık ve çevrimdışı kazanç, odalar, geliştirmeler, duvar kâğıtları, dil değiştirme, satın alma (sahte mağaza: satın alma, iptal, geri yükleme, sıfırlama), eski motor benzetimi, 6 ekran boyutu, erişilebilirlik, internetsiz açılış, kare süresi, bellek, paket boyutu |
| Cihaz (CI) | Android 9, 12 ve 15 emülatörü; iOS simülatörü (kurulu en eski ve en yeni sürüm) |

## Sonraki adımlar
- Mağaza hesapları ve ürünlerin açılması: [`store/README.md`](store/README.md)
- Android imza anahtarını GitHub sırlarına ekle; iOS için Xcode'da takımını seç.
