---
tür: pano
tags: [pano]
---
# 🧠 Kripto İkinci Beyin · Pano

Bu vault botun hafızası ve senin karar defterin. Bot her işlemi, analizi ve günü buraya yazar; sen de dersleri, kara listeyi ve izleme listesini buradan yönetirsin. Bot bir sonraki turda bunları okur.

> [!warning] Önce oku
> [[Gerçekçi Beklentiler]] · Varsayılan mod **paper** (sanal para). Gerçek paraya geçmeden önce [[Canlıya Geçiş Kontrol Listesi]].

## Haritalar
- **Strateji:** [[Strateji]] · [[İzleme Listesi]] · [[Gerçekçi Beklentiler]]
- **Analiz:** [[Göstergeler]] · [[Haber Analizi]] · [[Kırmızı Bayraklar]] · [[Piyasa Bağlamı]]
- **Risk:** [[Risk Yönetimi]] · [[Pozisyon Büyüklüğü]] · [[Çıkış Kuralları]] · [[Kara Liste]]
- **Kayıtlar:** [[İşlem Günlüğü]] · [[Dersler]]
- **Kurulum:** [[Entegrasyon]] · [[Canlıya Geçiş Kontrol Listesi]]

## Açık pozisyonlar
> Dataview eklentisi gerekir (Ayarlar → Topluluk eklentileri → Dataview).

```dataview
TABLE sembol, giriş_fiyatı AS "Giriş", maliyet AS "$", skor, stop, açılış, mod
FROM "06 İşlemler"
WHERE tür = "işlem" AND durum = "açık"
SORT açılış DESC
```

## Son kapanan işlemler
```dataview
TABLE sembol, kar_zarar AS "K/Z $", kar_zarar_yüzde AS "K/Z %", skor, kapanış
FROM "06 İşlemler"
WHERE tür = "işlem" AND durum = "kapalı"
SORT kapanış DESC
LIMIT 15
```

## Toplam performans
```dataview
TABLE WITHOUT ID mod AS "Mod", length(rows) AS "İşlem", sum(rows.kar_zarar) AS "Net $", round(length(filter(rows.kar_zarar, (x) => x > 0)) / length(rows) * 100) AS "Kazanma %"
FROM "06 İşlemler"
WHERE tür = "işlem" AND durum = "kapalı"
GROUP BY mod
```
