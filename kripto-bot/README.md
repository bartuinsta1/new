# Kripto Al-Sat Botu + Obsidian İkinci Beyin

Alımdan önce **artı/eksi** ve **haber analizi** yapan, 10–15 $'lık girişlerle 2x–3x hedefleyen, kârdayken analiz bozulursa satan bir spot trade botu. Bot bütün kararlarını, gerekçeleriyle birlikte bir **Obsidian vault**'una (`vault/`) yazar. Sen de kara listeyi, izleme listesini ve dersleri aynı vault'tan yönetirsin.

> ⚠️ Varsayılan mod **paper**: gerçek fiyat, sanal para. Kripto çok risklidir, 2–3x hedefi her işlemde tutmaz. Önce `vault/01 Strateji/Gerçekçi Beklentiler.md` notunu oku. Bu yazılım yatırım tavsiyesi değildir.

## Nasıl çalışır
```
her 5 dk ─► açık pozisyonlar: stop / 2x'te %50 sat / 3x'te hepsini sat / iz süren stop / kârı koru / süre
         └► tarama: hacim ≥ 3M $ + İzleme Listesi − Kara Liste
              └► teknik ön eleme ─► haber + piyasa analizi ─► skor ≥ 40 ve veto yok ─► AL (10–15 $)
                                                                └► Obsidian: işlem notu, coin notu, günlük not
```
| Blok | Ağırlık | Hesaplananlar |
|---|---|---|
| Teknik | %55 | EMA20/50/200, RSI, MACD, ADX/±DI, Bollinger (%B, sıkışma), ATR %, hacim oranı, OBV, 24 mum momentum, 50 mum zirvesi |
| Haber | %25 | Binance/Upbit listeleme-delist duyuruları, her 60 sn anlık takip (elindeki coinde hack/delist haberi → anında sat), RSS (CoinDesk, Cointelegraph, Decrypt, Bitcoin Magazine), CryptoPanic, zaman ağırlıklı duygu, kırmızı bayrak vetosu, isteğe bağlı Claude ile yorum |
| Piyasa | %20 | BTC 24s ve trend, Korku & Açgözlülük endeksi, likidite, spread, 24s pompa |

## Kurulum
```bash
cd kripto-bot
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp config.example.yaml config.yaml     # ayarlar
cp .env.example .env                   # anahtarlar (git'e girmez)
python -m pytest -q                    # testler
```
Obsidian → **Open folder as vault** → `kripto-bot/vault`. Pano tabloları için Topluluk eklentilerinden **Dataview**'ı kur.

## Komutlar
```bash
python -m bot analyze SOL/USDT          # tek coin: artılar, eksiler, haberler
python -m bot scan                      # tüm adayların skorları (işlem yapmaz)
python -m bot once                      # tek tur (paper modda sanal alım/satım)
python -m bot run                       # sürekli çalış
python -m bot status                    # bakiye, açık pozisyonlar, kazanma oranı
python -m bot backtest SOL/USDT --days 180   # geçmiş veride test (teknik blok)
python -m bot backtest X/USDT --csv veri.csv # kendi verinle test
python -m bot backtest --top 20 --hours 72   # hacimce ilk 20 coin, son 72 saat; kârlıysa yapılacaklar listesini basar
python -m bot optimize --top 20 --days 180   # ayar taraması: eğitim/sınav ayrımı, 5 pozisyon limitli portföy
python -m bot news SOL PEPE                  # canlı haber akışı (listeleme/delist, duygu puanı)
python -m bot notify-test                    # Telegram bildirim testi
```
Docker ile sunucuda: `docker compose up -d --build` (önce `config.yaml` ve `.env` oluştur).

## Entegrasyon
| Ne | Nasıl |
|---|---|
| Borsa | `exchange.id`: ccxt'nin desteklediği her borsa (binance, bybit, okx, kucoin, gateio, mexc, bitget, btcturk...) |
| Gerçek işlem | `.env` → `EXCHANGE_API_KEY/SECRET`, `BOT_MODE=live`. Anahtara **sadece spot** izni ver, **çekimi kapat**, IP kısıtla |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| Webhook | `WEBHOOK_URL`: Discord/Slack/n8n/Zapier/Make. JSON: `{content, text, event: start\|buy\|sell\|error, mode, data}` |
| Haber API | `CRYPTOPANIC_TOKEN` |
| Claude ile haber yorumu | `ANTHROPIC_API_KEY` + `news.llm.enabled: true` |
| Python'dan | `Bot(load_config()).run_once()`; kendi borsa sınıfın için `bot/exchange.py` içindeki `MarketData` + `Broker` |

## Klasörler
```
bot/            kod: indicators, analysis (artı/eksi), news, risk (çıkış kuralları), engine, journal (Obsidian), exchange, backtest
tests/          sahte borsa ile uçtan uca testler
vault/          Obsidian ikinci beyin (strateji, göstergeler, haber, risk, coinler, işlemler, günlük, dersler)
state/          pozisyonlar ve sanal cüzdan (git'e girmez)
```

## Önemli ayarlar (`config.yaml`)
| Ayar | Varsayılan |
|---|---|
| `position.stake_min_usd / stake_max_usd` | 10 / 15 |
| `exits.take_profit` | +%25'te %50, +%60'ta kalan (2x/3x seçeneği yorumda) |
| `exits.stop_loss_pct` | %15 |
| `exits.trailing` | %40 kârdan sonra zirvenin %20 altı |
| `exits.profit_protect` | %8+ kârdayken skor −10 altına düşerse sat |
| `analysis.buy_threshold` | 50 |
| `position.max_open_positions / max_total_exposure_usd / daily_loss_limit_usd` | 5 / 75 $ / 20 $ |
