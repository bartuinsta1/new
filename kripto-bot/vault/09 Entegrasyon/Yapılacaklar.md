---
tags: [kurulum]
---
# Yapılacaklar

Backtest "kârlılık yüksek" çıktığında bot bu listeyi ekrana basar. İstediğin gibi düzenle.

1. [ ] Kurulum: `pip install -r requirements.txt`, `cp config.example.yaml config.yaml`, `cp .env.example .env`
2. [ ] Bağlantı testi: `python -m bot analyze SOL/USDT`. Hata verirse `exchange.id` değerini erişebildiğin borsa yap
3. [ ] Haber sistemi: [[Haber Sistemi Kurulumu]] (CryptoPanic, Claude, Telegram). Kontrol: `python -m bot notify-test` ve `python -m bot news`
4. [ ] Uzun test: `python -m bot backtest --top 20 --days 180`. 72 saat tek başına yetmez
5. [ ] Paper modda 7/24 çalıştır (VPS + `docker compose up -d --build`), 2–4 hafta / 30+ işlem bekle
6. [ ] Obsidian'da [[İşlem Günlüğü]]: net artıda mı, hangi skor aralığı kazandırıyor? Gerekirse `buy_threshold` artır
7. [ ] Borsada API anahtarı: sadece spot, **çekim kapalı**, IP kısıtlı. Ayrı alt hesap, sadece kaybetmeyi göze aldığın tutar
8. [ ] `.env` → `BOT_MODE=live`, ilk hafta `max_open_positions: 2`
