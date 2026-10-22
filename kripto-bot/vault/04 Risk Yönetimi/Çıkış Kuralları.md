---
tags: [risk, strateji]
---
# Çıkış Kuralları

Kod: `bot/risk.py → exit_actions`. Sırayla kontrol edilir:

1. **Stop** — fiyat stop seviyesinin altındaysa hepsini sat.
   - Başlangıç: girişin %25 altı
   - Zirve %25 kârı görünce stop **giriş fiyatına** çekilir (başabaş)
   - Zirve %40 kârı görünce **iz süren stop**: zirvenin %20 altı (stop sadece yukarı gider)
2. **Kademeli kâr alma**
   - **2x** → pozisyonun **%50'si** satılır (ana para + biraz kâr cepte)
   - **3x** → **kalan hepsi** satılır
3. **Kârı koru** ("olası artıdayken sat") — en az %8 kârdayken analiz yeniden yapılır; skor −10'un altına düştüyse (trend döndü, kötü haber geldi) hepsini sat.
4. **Süre** — 14 gün (336 saat) dolunca sat.

Her satış işlem notunun **Satışlar** bölümüne, sebebiyle birlikte yazılır.

## Örnek
10 $ ile 1.00'dan alındı → stop 0.75
- 1.30 (zirve) → stop 1.003 (başabaş)
- 1.60 → iz süren stop 1.28
- 2.00 → 5 $'lık kısım ~10 $'a satıldı, kalan 5 $'lık kısım 3x'i bekliyor, stop 1.60
- 1.60'a düşerse kalan da satılır → toplam ≈ 10 + 8 = 18 $ (+%80)
