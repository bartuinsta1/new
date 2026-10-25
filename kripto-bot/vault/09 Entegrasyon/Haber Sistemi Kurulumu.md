---
tags: [kurulum, haber]
---
# Haber Sistemi Kurulumu

Bot haberleri 4 katmanda takip eder. 1. katman kurulumsuz çalışır, diğerleri birer anahtar ister.

| # | Katman | Ne sağlar | Kurulum | Ücret |
|---|---|---|---|---|
| 1 | **Borsa duyuruları** (Binance listeleme + delist, Upbit) | Fiyatı en sert oynatan haberler: listeleme → pompa, delist → çöküş | Yok, açık gelir | Ücretsiz |
| 1 | **RSS** (Cointelegraph, CoinDesk, Decrypt, The Block, CryptoSlate, Bitcoin Magazine) | Genel kripto gündemi | Yok | Ücretsiz |
| 2 | **CryptoPanic** | Yüzlerce kaynaktan coin etiketli, dakikalık haber + topluluk oyları | Token al (aşağıda) | Ücretsiz plan var |
| 3 | **Claude ile yorum** | Haberi bağlamıyla okur: "hack iddiası yalanlandı"yı olumsuz saymaz, başka projenin hack'iyle seni sattırmaz | API anahtarı (aşağıda) | Kullandıkça, düşük |
| 4 | **Telegram** | Her alım/satım, acil haber çıkışı ve hata telefonuna bildirim | Bot oluştur (aşağıda) | Ücretsiz |

> [!tip] Neden 3. katman önemli
> Kelime listesi yöntemi "Bitcoin slides below $80K" gibi haberleri kaçırabiliyor, "soruşturma düşürüldü" gibi olumlu haberi olumsuz sayabiliyor. Gerçek parayla çalışmadan önce Claude yorumunu aç.

## 2. CryptoPanic token
1. https://cryptopanic.com → **Sign up** (e-posta ile)
2. https://cryptopanic.com/developers/api/ → **API key**'i kopyala
3. `.env` → `CRYPTOPANIC_TOKEN=buraya`

## 3. Claude API anahtarı
1. https://console.anthropic.com → hesap aç → **Billing**'den küçük bir bakiye yükle (ör. 5 $)
2. **API Keys** → **Create Key** → kopyala
3. `.env` → `ANTHROPIC_API_KEY=buraya`
4. `config.yaml` →
```yaml
news:
  llm:
    enabled: true
```
Bot sadece ön elemeyi geçen coinlerin haberlerini gönderir ve aynı haberi tekrar sormaz.

## 4. Telegram bildirimi
1. Telegram'da **@BotFather** → `/newbot` → isim ver → verdiği **token**'ı kopyala
2. Oluşan botunla sohbeti aç, **/start** yaz
3. Tarayıcıda `https://api.telegram.org/bot<TOKEN>/getUpdates` aç → `"chat":{"id":123456789` → bu sayı **chat id**
4. `.env` →
```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```
5. Dene: `python -m bot notify-test` → telefonuna "Test mesajı" gelmeli

## Kontrol
```bash
python -m bot news SOL PEPE      # canlı akış: coin etiketi + duygu puanı; 🟢LİSTELEME / 🔴DELİST / 🚩
```
Akış ayrıca vault'ta `03 Haber Analizi/Akış/` altına günlük olarak yazılır.

## Bot habere nasıl tepki verir
- Elindeki coin için **delist** duyurusu ya da hack/exploit haberi → **anında hepsini satar**
- Elindeki coinde çok olumsuz haber + pozisyon kârda → satar
- Borsada işlem gören bir coin için **Upbit/Binance listeleme** duyurusu → hemen tam analiz, teknik + piyasa da onaylarsa alır
- Haber tek başına alım sebebi değildir
