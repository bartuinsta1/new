---
tags: [risk]
---
# Pozisyon Büyüklüğü

`tutar = 10 + (15 − 10) × (skor − eşik) / (100 − eşik)`

| Skor | Tutar |
|---|---|
| 40 (eşik) | 10.00 $ |
| 55 | 11.25 $ |
| 70 | 12.50 $ |
| 100 | 15.00 $ |

Bot ayrıca bakiyeyi, açık pozisyon sayısını, toplam riski, günlük zarar limitini ve borsanın en düşük emir tutarını kontrol eder (`bot/risk.py → can_open`). Alınmayan adayların nedeni log'a yazılır.
