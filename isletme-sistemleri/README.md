# İşletme Sistemleri — Sosyal Medya Ajansı

Kişisel markalara ve şirketlere sosyal medya hizmeti veren bir ajansın aylık 100 bin dolara ölçeklenmesi için
gereken 22 sistemin tek yerden tanımı. Her sistem için şunlar tanımlıdır: amaç, sahibi, otomasyon düzeyi,
tetikleyici, girdiler, çıktılar, adımlar, başarı ölçütleri (hedefli), önerilen araçlar ve diğer sistemlerle
bağımlılıklar.

Okumak için: **[KATALOG.md](KATALOG.md)** (özet tablo, kurulum sırası, bağımlılık haritası, 22 sistemin detayı).

Bu 22 sistemin üstünde pazarlamayı yürüten **yapay zekâ ekibi**: **[EKIP.md](EKIP.md)**.
Sinyaller → kayıt sistemi + işletme girdileri → beyin (triyaj, yazar, konuşur, kontrol) → 8 departman →
veri ve gözlem → insana devir. Ajanların okuduğu marka sesi, ideal müşteri, teklifler gibi bilgiler
[`bilgi/`](bilgi/) klasöründe doldurulacak şablonlar olarak durur. Bütçe dolması, lead maliyetinin
sıçraması, düşük puanlı yorum, insan isteyen arayan gibi durumlarda otomatik akış durur ve iş insana geçer.

## Site: Ajans OS

`site/` klasörü tüm sistemi bir kontrol paneline çevirir: canlıya hazır olma durumu, 22 sistem, yapay zekâ
ekibi ve triyaj simülatörü, entegrasyon yuvaları ve maliyet hesaplayıcı. Site, `src/*.ts` dosyalarından
derlenen modülleri kullanır; veri ve karar kodu komut satırıyla birebir aynıdır.

```bash
npm run sunucu              # derler ve http://localhost:8080 adresinde açar
```

**Entegrasyonları bağlamak:** `src/entegrasyonlar.ts` içindeki her yuvanın `baglantiUrl` alanına tek tıkla
bağlanma adresini (OAuth, Zapier, Composio vb.) yazın, sonra `npm run site`. Adresi olan yuvalarda **Bağla**
bu adresi yeni sekmede açar; adresi olmayanlarda deneme amaçlı işaretler. Bağlantı durumu şimdilik
tarayıcıda saklanır; gerçek durum için bağlantı servisinizin geri dönüşünü (callback) buraya bağlayın.

**Planlar:** Her entegrasyon yuvasının bir de `ekonomik` karşılığı vardır (ücretsiz katmanlar, kendi
sunucunda n8n + Postiz, Claude Haiku 5.5 ağırlıklı yapay zekâ). Ekonomik plan 10 müşteride ayda ~$33,
30 müşteride ~$83 tutar; sesli asistan ilk aşamada kapalıdır. Sınırlar sitenin Maliyet sayfasında listelenir.

## Kullanım (Node 22+, bağımlılık yok)

```bash
npm run liste               # kategoriye göre 22 sistem
npm run goster -- 8         # tek sistemin detayı (no veya id)
npm run kurulum             # bağımlılıklara göre kurulum dalgaları
npm run etki -- satis-crm   # bu sistem durursa zincirleme etkilenenler
npm run katalog             # KATALOG.md ve EKIP.md'yi yeniden üret
npm run triyaj -- '{"sinyal":"degerlendirme","puan":1}'   # bir olayı beyne ver: hangi departman, kime devir
npm test                    # tanımları doğrula (eksik alan, bilinmeyen bağımlılık, döngü, güncel katalog)
```

## Yapı

| Dosya | İçerik |
|---|---|
| `src/tipler.ts` | `Sistem` şeması, kategoriler, otomasyon düzeyleri |
| `src/sistemler.ts` | 22 sistemin tanımları — düzenlenecek tek yer |
| `src/kayit.ts` | Doğrulama, kurulum sırası, etki analizi, katalog üretimi |
| `src/ekip.ts` | Yapay zekâ ekibi: sinyaller, kayıt sistemi, beyin rolleri, departmanlar, gözlem, insana devir |
| `src/beyin.ts` | Triyaj: olayı departmana yönlendirme ve döngüyü kesen durumlar (eşikler ayarlanabilir) |
| `src/ekip-katalog.ts` | Ekip doğrulaması ve EKIP.md üretimi |
| `bilgi/*.md` | Bilgi katmanı şablonları |
| `src/cli.ts` | Komut satırı |

Bir sistemi değiştirdikten veya eklediğinizde `npm run katalog && npm test` çalıştırın.
