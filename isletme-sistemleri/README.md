# İşletme Sistemleri — Sosyal Medya Ajansı

Kişisel markalara ve şirketlere sosyal medya hizmeti veren bir ajansın aylık 100 bin dolara ölçeklenmesi için
gereken 22 sistemin tek yerden tanımı. Her sistem için şunlar tanımlıdır: amaç, sahibi, otomasyon düzeyi,
tetikleyici, girdiler, çıktılar, adımlar, başarı ölçütleri (hedefli), önerilen araçlar ve diğer sistemlerle
bağımlılıklar.

Okumak için: **[KATALOG.md](KATALOG.md)** (özet tablo, kurulum sırası, bağımlılık haritası, 22 sistemin detayı).

## Kullanım (Node 22+, bağımlılık yok)

```bash
npm run liste               # kategoriye göre 22 sistem
npm run goster -- 8         # tek sistemin detayı (no veya id)
npm run kurulum             # bağımlılıklara göre kurulum dalgaları
npm run etki -- satis-crm   # bu sistem durursa zincirleme etkilenenler
npm run katalog             # KATALOG.md'yi yeniden üret
npm test                    # tanımları doğrula (eksik alan, bilinmeyen bağımlılık, döngü, güncel katalog)
```

## Yapı

| Dosya | İçerik |
|---|---|
| `src/tipler.ts` | `Sistem` şeması, kategoriler, otomasyon düzeyleri |
| `src/sistemler.ts` | 22 sistemin tanımları — düzenlenecek tek yer |
| `src/kayit.ts` | Doğrulama, kurulum sırası, etki analizi, katalog üretimi |
| `src/cli.ts` | Komut satırı |

Bir sistemi değiştirdikten veya eklediğinizde `npm run katalog && npm test` çalıştırın.
