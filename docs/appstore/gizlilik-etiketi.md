# App Store Gizlilik Etiketi ("App Privacy") — doldurma listesi

Kaynak: koddaki gerçek veri akışı (Adım 1–12). Bir veri türü eklenir/çıkarılırsa bu belge ve etiket birlikte güncellenir.
Apple kuralı: bizim adımıza işleyen hizmet sağlayıcılarına (Anthropic, Azure, ElevenLabs, Supabase) giden veriler de
"toplanan veri" sayılır.

## Özet cevaplar

| Soru | Cevap |
|---|---|
| Veri topluyor musunuz? | **Evet** |
| İzleme (tracking) yapıyor musunuz? | **Hayır** — reklam yok, üçüncü taraf SDK yok, veri aracılarıyla paylaşım yok, IDFA istenmez |
| Uygulamada üçüncü taraf reklam/analitik SDK'sı var mı? | **Hayır** |

## Toplanan veriler

| App Store kategorisi › tür | Ne | Amaç | Kullanıcıya bağlı mı? | Nerede / kim işler |
|---|---|---|---|---|
| **Kullanıcı İçeriği › Diğer Kullanıcı İçeriği** | Çocuğun adı, telaffuzu, yaşı, ilgi alanları, seçilen değerler; üretilen masal metinleri; tekrar eden karakter kartları | Uygulama İşlevselliği | Evet (anonim hesap) | Supabase (Postgres); masal üretimi için **Anthropic** (Claude API); seslendirme için **Microsoft Azure** (masal metni) |
| **Kullanıcı İçeriği › Ses Verisi** | Ebeveynin 1 dakikalık ses örneği (yalnızca Premium + ayrı açık rıza) | Uygulama İşlevselliği | Evet | **ElevenLabs** (ses klonu); örnek ve klon istenince silinir |
| **Kimlik Bilgileri › Kullanıcı Kimliği** | Cihaza bağlı anonim Supabase kullanıcı kimliği (UUID); StoreKit `appAccountToken` | Uygulama İşlevselliği | Evet | Supabase, Apple |
| **Satın Almalar › Satın Alma Geçmişi** | Abonelik ürünü, deneme durumu, bitiş tarihi, App Store işlem kimliği | Uygulama İşlevselliği | Evet | Supabase (sunucu doğrulaması), Apple |
| **Kullanım Verileri › Ürün Etkileşimi** | Anonim olaylar: onboarding adımı, masal başladı/bitti (bölge, ruh hali, süre yalnızca 5'er dakikalık aralık), paywall gösterildi/kapandı/satın alındı (yalnızca plan türü). Sunucuda yalnızca gün + olay + boyut başına sayaç tutulur | Analitik | **Hayır** (kimliksiz, toplu) | Kendi backend'imiz (`POST /events`) |

**Toplanmayanlar:** konum, kişiler, fotoğraflar, e-posta, telefon, ad-soyad (ebeveyn), sağlık, tarayıcı geçmişi,
arama geçmişi, reklam verisi, cihaz kimliği (IDFA/IDFV), çökme verisi (üçüncü taraf çökme SDK'sı yok; Apple'ın kendi
çökme raporları etikete girmez), performans verisi.

> Not: çocuğun "adı" Apple'ın "İletişim Bilgileri › Ad" türü değildir (o, kullanıcının kendi iletişim adıdır);
> masal kişiselleştirmesi için girilen içerik olarak "Diğer Kullanıcı İçeriği" altında beyan edilir. Temkinli tercih:
> App Review sorarsa "Ad" türünü de "Uygulama İşlevselliği / bağlı" olarak eklemekte sakınca yok.

## Kids kategorisi uyumu (Guideline 1.3, 5.1.4)
- Reklam ve üçüncü taraf analitik yok; veri reklam ya da profil çıkarma amacıyla kullanılmaz.
- Satın alma, dış bağlantılar (gizlilik politikası, destek e-postası, paylaşım, App Store aboneliği yönetimi) ebeveyn kapısının arkasında.
- Kişisel veri en aza indirilmiş: çocuk için yalnızca ad, yaş, ilgi alanları (+ isteğe bağlı telaffuz ve değerler).
- Hizmet sağlayıcılar yalnızca hizmeti vermek için işler; Anthropic API verileri model eğitiminde kullanmaz
  (ticari API koşulları) — sözleşme/DPA ile belgelenmeli.

## Saklama süreleri (sunucu)
| Veri | Süre |
|---|---|
| Hesap, çocuk profilleri, masallar, abonelik kaydı | Hesap silinene kadar (tek dokunuşla silme: Ebeveyn Köşesi › Hesap) |
| Ses örneği ve klon | Ebeveyn silene ya da hesap silinene kadar |
| Paylaşım bağlantıları | 30 gün |
| Seslendirme önbelleği (ses dosyaları) | Hesap silinince; üretimde en çok 90 gün (VARSAYIM) |
| Maliyet ve güvenlik logları | Kişisel veri yok (ad maskelenir: `{CHILD}`); 12 ay (VARSAYIM) |
| Anonim kullanım olayları | Toplu; 12 ay (VARSAYIM) |
