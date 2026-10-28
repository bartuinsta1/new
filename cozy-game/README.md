# 🐾 Mırnav Hanı

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
6. **Albüm.** 18 kedi cinsi. Mevsimlik efsaneviler: ❄️ *Kartopu* (Kasım–Şubat), 🍂 *Balkabağı* (Eylül–Kasım).
7. **Sen yokken de** han işler (en fazla 12 saat). Her gün bir hediye var. Kasım–Aralık'ta **İlk Kar Festivali** ışıkları yanar.

Pencere gerçek saate göre gündüz, akşam ya da gece görünür; dışarısı mevsime göre karlı ya da yapraklıdır.

## Teknik

- TypeScript + Vite. Çatı (framework) yok; tek bir Canvas sahnesi ve DOM arayüz.
- **Tüm grafikler kodla çiziliyor** (`src/draw.ts`), müzik ve efektler WebAudio ile üretiliyor (`src/audio.ts`). Görsel ya da ses dosyası yok; oyun yaklaşık 20 KB (gzip).
- Oyun mantığı saf ve test edilebilir (`src/game.ts`, `tests/`).
- PWA: telefonda "Ana Ekrana Ekle" ile uygulama gibi açılır ve internetsiz çalışır.

```bash
cd cozy-game
npm install
npm run dev      # telefondan aynı ağdaki IP ile açılabilir
npm test
npm run build    # dist/
```

Test için URL parametreleri: `?month=10` (Kasım), `?hour=21` (gece).

## Sonraki adımlar (karar bekleyenler)

- Mağaza yayını: Capacitor ile iOS/Android paketi mi, yoksa sadece web (PWA) mi?
- Gelir modeli: ücretli, reklamsız ücretsiz ya da kozmetik satın alımlar.
- Geç oyun için balık harcama alanı: mobilya renkleri, kedi kıyafetleri, mevsimlik süsler.
- Dil: şu an Türkçe; İngilizce eklenmeli mi?
