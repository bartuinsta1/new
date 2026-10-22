---
tags: [strateji]
---
# Strateji

**Amaç:** 10–15 $'lık küçük girişlerle, analizi olumlu coinlere girip 2x–3x hedeflemek; hedefe gidemeyenden erken ve küçük zararla çıkmak.

## Döngü (her 5 dakikada bir)
1. **Pozisyonları yönet** → [[Çıkış Kuralları]] (stop, 2x/3x kademeli satış, iz süren stop, kârı koruma, süre).
2. **Tara** → hacmi 3M $ üstü USDT pariteleri + [[İzleme Listesi]] − [[Kara Liste]].
3. **Ön eleme** → sadece teknik skor (ucuz).
4. **Tam analiz** → umut vaat edenler için haber + piyasa ([[Haber Analizi]], [[Piyasa Bağlamı]]).
5. **Karar** → toplam skor ≥ 40 ve hiç veto yoksa **AL**. Tutar skora göre 10→15 $ ([[Pozisyon Büyüklüğü]]).
6. **Kaydet** → işlem notu, coin notu, günlük not.

## Skor nasıl oluşur
| Blok | Ağırlık | İçerik |
|---|---|---|
| Teknik | %55 | [[Göstergeler]]: trend, RSI, MACD, hacim, ADX, Bollinger, momentum, volatilite, OBV, direnç |
| Haber | %25 | [[Haber Analizi]]: RSS + CryptoPanic, zaman ağırlıklı duygu, isteğe bağlı Claude |
| Piyasa | %20 | [[Piyasa Bağlamı]]: BTC yönü, korku/açgözlülük, likidite, spread, 24s pompa |

Her etken bir **artı** ya da **eksi** olarak işlem notuna yazılır. Her blok −100..+100'e normalize edilir. Bilgi olmayan blok (ör. hiç haber yok) hesaba katılmaz, ağırlığı diğerlerine dağılır.

## Vetolar (skor ne olursa olsun alma)
- BTC 24 saatte −%6'dan fazla düşmüş
- Son 24 saatte coin hakkında [[Kırmızı Bayraklar|kırmızı bayrak]] haberi
- RSI > 85
- Spread > %0.6

## Ayarlar
Tüm sayılar `config.yaml`'da. Değiştirdiğin her ayarı tarihiyle [[Dersler]]'e yaz ki neyin işe yaradığını bil.
