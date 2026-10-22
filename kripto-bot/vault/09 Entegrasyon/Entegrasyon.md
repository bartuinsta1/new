---
tags: [kurulum]
---
# Entegrasyon

## Borsalar
`config.yaml → exchange.id` ile ccxt'nin desteklediği her borsa: `binance`, `bybit`, `okx`, `kucoin`, `gateio`, `mexc`, `bitget`, `htx`... Türk borsaları için ccxt listesine bak (ör. `btcturk` ccxt'de var); TL paritesi için `quote: TRY` yap ve giriş tutarlarını TL'ye göre güncelle.

## Bildirim
- **Telegram:** @BotFather → token, botuna bir mesaj at, `https://api.telegram.org/bot<TOKEN>/getUpdates` ile chat id'yi al → `.env`.
- **Webhook:** `WEBHOOK_URL` Discord/Slack webhook'u ya da n8n/Zapier/Make adresi olabilir. Gövde: `{content, text, event, mode, data}`. `event`: `start | buy | sell | error`. Google Sheets'e satır eklemek, e-posta atmak gibi akışları buradan kurarsın.

## Obsidian senkronu
- Vault klasörü: `kripto-bot/vault`. Obsidian → "Klasörü vault olarak aç".
- Bot sunucuda çalışıyorsa vault'u **Obsidian Git** eklentisi ya da Syncthing ile telefona/bilgisayara çek.
- Docker'da `./vault` klasörü konteynere bağlanır, bot oraya yazar.

## Claude ile haber analizi
`.env → ANTHROPIC_API_KEY`, `config.yaml → news.llm.enabled: true`. Sadece ön elemeyi geçen coinlerin haberleri gönderilir, aynı haber listesi tekrar sorulmaz (önbellek).

## Kod içinden
```python
from bot.config import load_config
from bot.engine import Bot
bot = Bot(load_config())
decisions = bot.run_once()            # tek tur
print(bot.status())
```
Başka borsa/aracı: `bot/exchange.py` içindeki `MarketData` + `Broker` metodlarını uygulayan bir sınıf yaz ve `Bot(cfg, exchange=Sinifin())` ver.
