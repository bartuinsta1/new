---
tags: [kurulum, risk]
---
# Canlıya Geçiş Kontrol Listesi

- [ ] Paper modda en az 2–4 hafta ve 30+ kapanmış işlem
- [ ] [[İşlem Günlüğü]]'nde net sonuç pozitif, kazanma oranı ve ortalama kazanç [[Gerçekçi Beklentiler]]'deki matematiği tutuyor
- [ ] `python -m bot backtest <COIN> --days 180` ile en az 5 coinde test edildi
- [ ] API anahtarı: sadece spot, **çekim kapalı**, IP kısıtlı
- [ ] Bot için ayrı alt hesap, içinde sadece kaybetmeyi göze aldığım tutar
- [ ] Telegram bildirimleri çalışıyor
- [ ] `.env → BOT_MODE=live` ve ilk gün `max_open_positions: 2`
