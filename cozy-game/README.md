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

## Sürümler ve fiyat

| Sürüm | Nerede | Fiyat |
|---|---|---|
| Tam sürüm (iOS + Android) | App Store, Google Play (Capacitor) | Tek seferlik ~25 TL, reklam ve uygulama içi satın alma yok |
| Web demosu | https://bartuinsta1.github.io/new/ | Ücretsiz, 4. seviyede durur ve mağazaya yönlendirir |

Diller: Türkçe ve İngilizce (telefonun diline göre otomatik; ayarlardan değiştirilebilir). İngilizce adı **Snowpaw Inn**.
Mağaza metinleri, fiyatlandırma adımları ve yayın kontrol listesi: [`store/README.md`](store/README.md).

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
npm run build:demo  # web demosu (4. seviye sınırı)
npm run android     # Android Studio'da açar
npm run ios         # Xcode'da açar (Mac)
```

- Yerel uygulama: Capacitor 8 (`android/`, `ios/`). İkonlar ve açılış ekranı `assets/` içinden üretilir.
- GitHub Actions (`.github/workflows/cozy-game.yml`) her push'ta şunları yapar:
  - testleri çalıştırır,
  - web demosunu `gh-pages` dalına yayınlar,
  - indirilebilir bir debug APK üretir,
  - iOS'un derlendiğini kontrol eder.

Test için URL parametreleri: `?month=10` (Kasım), `?hour=21` (gece).

## Sonraki adımlar
- Geliştirici hesapları: Apple yıllık 99 $, Google tek seferlik 25 $. Ücretli uygulama için vergi ve banka bilgileri gerekli.
- İmzalı sürümler: Android için keystore, iOS için Apple sertifikası (`store/README.md`).
- Mağaza ekran görüntüleri: oyundan alınabilir (`?month=10&hour=21` ile karlı gece).
