---
tags: [gösterge, moc]
---
# Göstergeler (teknik blok, %55)

Bot hepsini `bot/indicators.py`'de hesaplar, puanlamayı `bot/analysis.py → technical_factors` yapar.

| Etken | En fazla | Artı | Eksi | Not |
|---|---|---|---|---|
| [[EMA ve Trend\|Ana trend]] | ±15 | Fiyat > EMA50 > EMA200 | Fiyat < EMA50 < EMA200 | |
| [[EMA ve Trend\|Kısa trend]] | ±8 | EMA20 > EMA50 | EMA20 < EMA50 | |
| [[RSI]] | ±15 | 48–68 sağlıklı; <30 ve dönüyor | >78 aşırı alım | >85 veto |
| [[MACD]] | ±10 | Histogram + ve büyüyor | − ve derinleşiyor | |
| [[Hacim ve OBV\|Hacim]] | ±10 | Yeşil mumda 1.8x+ hacim | Kırmızı mumda 1.8x+ | |
| [[ADX]] | ±8 | ADX>25 ve +DI>−DI | ADX>25 ve −DI>+DI | |
| [[Bollinger]] | ±8 | Sıkışmadan yukarı kırılım | Üst bandın çok dışında | |
| Momentum | ±8 | 24 mumda > +%5 | < −%10 | |
| [[ATR ve Volatilite\|Volatilite]] | ±6 | ATR %2–12 | ATR >%12 ya da <%2 | 2–3x için hareket şart |
| [[Hacim ve OBV\|OBV]] | ±5 | Birikim | Dağıtım | |
| Zirve/direnç | ±6 | 50 mum zirvesini kırıyor | Dirence %2'den yakın | |

Puanları değiştirmek istersen `technical_factors` fonksiyonunu düzenle ve `python -m bot backtest` ile karşılaştır.
