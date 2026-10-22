---
tags: [risk, moc]
---
# Risk Yönetimi

| Kural | Varsayılan | Ayar |
|---|---|---|
| Giriş tutarı | 10–15 $ (skora göre) | `position.stake_min_usd / stake_max_usd` |
| En fazla açık pozisyon | 5 | `position.max_open_positions` |
| Toplam açık risk | 75 $ | `position.max_total_exposure_usd` |
| Günlük zarar limiti | 20 $ → o gün yeni alım yok | `position.daily_loss_limit_usd` |
| Stop sonrası bekleme | 12 saat aynı coine girme | `position.cooldown_hours_after_loss` |

Detay: [[Pozisyon Büyüklüğü]] · [[Çıkış Kuralları]] · [[Kara Liste]]

## API anahtarı güvenliği
- Sadece **spot işlem** izni ver. **Çekim (withdraw) iznini asla açma.**
- IP kısıtlaması ekle (botun çalıştığı sunucunun IP'si).
- Bot için ayrı bir alt hesap ve sadece ayırdığın kadar bakiye kullan.
