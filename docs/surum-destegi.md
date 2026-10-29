# Hangi iOS sürümlerini ve cihazları destekliyoruz?

**Karar: iOS 17 ve üstü** (iOS 17, 18, 26 ve sonrası). Yani en yeni sürüm değil, son 4 büyük sürüm.

| En düşük sürüm | En eski desteklenen iPhone | Tahmini kapsam (Apple yalnızca kendi verisini yayınlar; App Store Connect › Analytics ile doğrulayın) | Bedeli |
|---|---|---|---|
| **iOS 17 (seçilen)** | iPhone XS / XR (2018) | Aktif iPhone'ların ~%95'i | Yok: uygulama zaten SwiftData ve Observation ile yazıldı |
| iOS 16 | iPhone 8 / X (2017) | +%2–3 | Kalıcılık (SwiftData → Core Data) ve tüm modeller (Observation → ObservableObject) yeniden yazılır; ~2–3 hafta iş |
| iOS 15 | iPhone 6s / 7 (2015–16) | +%1–2 daha | Yukarıdakine ek olarak birçok SwiftUI bileşeni (ContentUnavailableView, yeni onChange, Grid…) elden yazılır |

"5–10 sürüm geriye" yerine iOS 17'yi seçmemin nedeni: iOS 16 ve 15'i eklemek cihazların yalnızca birkaç yüzdesini
kazandırıyor, ama uygulamanın veri katmanının tamamını yeniden yazmayı gerektiriyor. Bu da her yeni özelliği iki
kez test etmek demek. Çocuk uygulamalarında "eski, el değiştirmiş cihaz" gerçek bir durum, bu yüzden 2018 cihazlarını
(iPhone XS/XR, 6. nesil iPad) özellikle hedefliyoruz ve onlara göre optimize ettik.

## Eski cihaz optimizasyonu (`PerformanceBudget`, Core/Utilities/Performance.swift)

Şu durumlarda süs animasyonları kendiliğinden hafifler; içerik, ses ve akış hiç değişmez:
- 2018–2019 cihaz aileleri (iPhone XS/XR, 6.–7. nesil iPad, 2018 iPad Pro) ya da 3,5 GB'tan az bellek,
- **Düşük Güç Modu** açık,
- cihaz ısınmış (`thermalState` serious/critical).

| | Normal | Hafif |
|---|---|---|
| Gece gökyüzü yıldızı / ateşböceği | 70 / 14 | 36 / 6 |
| Gökyüzü kare hızı | 24 fps | 12 fps |
| "Masal yazılıyor" ekranında uçuşan yıldızlar | var | yok |

Her cihazda geçerli olanlar (Adım 11): harita zemini kaydırırken yeniden çizilmez, masal ilerleyip ekran %80
karardığında gökyüzü animasyonu tamamen durur, Hareketi Azalt açıksa tüm süs animasyonları durur.

## iPad
1.0 yalnızca iPhone için yayınlanır (`TARGETED_DEVICE_FAMILY = 1`). iPad'de uygulama iPhone uyumluluk modunda
çalışır. Düzen iPad'e hazır (geniş ekran düzenleri var); 1.1'de 13" iPad ekran görüntüleriyle iPad desteği açılır.

## Android (Play Store)
Bu turda yapılmadı (karar: önce App Store). Android için önerilen: Kotlin + Jetpack Compose, `minSdk 26`
(Android 8.0, 2017 — son ~10 sürüm, cihazların ~%97'si), `targetSdk` Play'in o yılki zorunlu düzeyi.
Sunucu, metinler ve tasarım belirteçleri aynen kullanılır.
