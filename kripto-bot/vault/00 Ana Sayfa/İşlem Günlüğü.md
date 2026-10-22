---
tags: [pano]
---
# İşlem Günlüğü

Bot her alımda `06 İşlemler/` altına bir not açar: neden alındı (artılar), neye rağmen alındı (eksiler), hangi haberler vardı, plan (stop/hedef). Satışlar aynı nota eklenir; kapanınca **Sonuç** ve **Ders** bölümü oluşur. Ders bölümünü sen doldur → önemli olanları [[Dersler]]'e taşı.

## Coin bazında sonuç
```dataview
TABLE length(rows) AS "İşlem", sum(rows.kar_zarar) AS "Net $"
FROM "06 İşlemler"
WHERE durum = "kapalı"
GROUP BY coin
SORT sum(rows.kar_zarar) DESC
```

## Skora göre başarı (eşik doğru mu?)
```dataview
TABLE length(rows) AS "İşlem", round(sum(rows.kar_zarar), 2) AS "Net $"
FROM "06 İşlemler"
WHERE durum = "kapalı"
GROUP BY choice(skor >= 60, "60+", choice(skor >= 50, "50-59", "40-49")) AS "Skor aralığı"
```

## Günler
```dataview
LIST FROM "07 Günlük" SORT file.name DESC LIMIT 14
```
