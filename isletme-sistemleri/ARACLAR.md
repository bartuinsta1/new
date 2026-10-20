# Araçlar ve alternatifleri

> Bu dosya `npm run katalog` ile `src/entegrasyonlar.ts` dosyasından üretilir; elle düzenlemeyin.

Her araç için üç seçenek vardır; hepsi o işin gerekliliklerini karşılar. Fiyatlar 10 marka için
aylık yaklaşık değerdir; abone olmadan önce sağlayıcının sayfasından kontrol edin.

## Satış ve müşteri

### CRM

**Gereklilikler:** Kişi ve fırsat kaydı · Aşamalı satış hattı · API veya webhook (n8n bağlantısı)

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | GoHighLevel, HubSpot | $197 | — |
| Ekonomik | HubSpot Ücretsiz CRM | Ücretsiz | Otomatik e-posta dizisi yok; takip mesajlarını n8n gönderir. |
| Alternatif | Attio Ücretsiz | Ücretsiz | 3 kullanıcıya kadar ücretsiz, API açık; esnek veri modeli. |

### WhatsApp Business

**Gereklilikler:** Müşteriye mesaj ve hatırlatma · API ile otomasyon

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | WATI (hazır WhatsApp paneli) | $64 | — |
| Ekonomik | WhatsApp Cloud API | $5 | Müşterinin başlattığı konuşmalar ücretsiz; hatırlatmalar mesaj başı ücretli. |
| Alternatif | Twilio WhatsApp | $10 | Kurulumu kolay; Meta ücretine ek mesaj başı küçük bir ücret. |

### Randevu takvimi

**Gereklilikler:** Herkese açık randevu sayfası · Takvim eşitleme · Hatırlatma

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | Cal.com, Calendly | $15 | — |
| Ekonomik | Cal.com Ücretsiz | Ücretsiz | — |
| Alternatif | Google Takvim randevu planlama | Ücretsiz | Ücretsiz Gmail hesabında temel randevu sayfası; ödeme ve gelişmiş formlar için Workspace gerekir. |

### Ödeme

**Gereklilikler:** Kartla tahsilat · Abonelik / tekrarlayan ödeme

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | Stripe, iyzico | Ücretsiz | — |
| Ekonomik | iyzico / Stripe | Ücretsiz | Aylık ücret yok, işlem başına komisyon. |
| Alternatif | PayTR | Ücretsiz | Türkiye'de yaygın; aylık ücret yok, işlem başına komisyon. Şirket gerekir. |

### E-posta pazarlama

**Gereklilikler:** Liste ve otomatik dizi · API

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | Mailchimp, Klaviyo | $50 | — |
| Ekonomik | Brevo Ücretsiz | Ücretsiz | Günde 300 e-posta. |
| Alternatif | MailerLite Ücretsiz | Ücretsiz | 1.000 aboneye kadar ücretsiz, otomasyon dahil. |

## Sosyal medya ve reklam

### Instagram ve Facebook

**Gereklilikler:** Yorum ve DM okuma · Hesap istatistikleri · Gönderi yayını

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | Meta Business | Ücretsiz | — |
| Ekonomik | Meta Business (ücretsiz) | Ücretsiz | — |
| Alternatif | Instagram API (Instagram ile Giriş) | Ücretsiz | Facebook sayfası gerekmeden profesyonel hesaba doğrudan bağlanır; Meta uygulama incelemesi ister. |

### TikTok, LinkedIn, YouTube

**Gereklilikler:** Yayın · Temel istatistik

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | TikTok, LinkedIn, YouTube | Ücretsiz | — |
| Ekonomik | Platform API'leri (ücretsiz) | Ücretsiz | — |
| Alternatif | Buffer Ücretsiz | Ücretsiz | 3 kanala kadar ücretsiz; daha fazlası kanal başına ücretli. |

### Reklam hesapları

**Gereklilikler:** Kampanya yönetimi · Bütçe ve harcama verisi · Lead başı maliyet

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | Meta Ads, TikTok Ads, Google Ads | Ücretsiz | — |
| Ekonomik | Reklam hesapları (ücretsiz) | Ücretsiz | Reklam bütçesi müşteriden. |
| Alternatif | LinkedIn Ads | Ücretsiz | Kurucu ve uzman kitlesi için; lead maliyeti daha yüksek ama nitelik daha iyi. Bütçe müşteriden. |

### DM otomasyonu

**Gereklilikler:** Anahtar kelimeli yorum yakalama · DM'den otomatik yanıt · Yapay zekâya aktarım

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | ManyChat | $115 | — |
| Ekonomik | ManyChat Ücretsiz | Ücretsiz | 1.000 kişiye kadar. Aşan müşteride Pro'ya geç ve ücretini pakete ekle. |
| Alternatif | n8n + Instagram mesajlaşma webhook'u | Ücretsiz | Ücretsiz ve sınırsız kişi; kurulumu teknik, Meta uygulama incelemesi ister. |

### Değerlendirmeler

**Gereklilikler:** Değerlendirme okuma · Yanıt verme

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | Google İşletme Profili | Ücretsiz | — |
| Ekonomik | Google İşletme Profili (ücretsiz) | Ücretsiz | — |
| Alternatif | Trustpilot Ücretsiz | Ücretsiz | Ücretsiz işletme profili; Google'dan sonra ikinci kaynak. |

### Yayın planlama

**Gereklilikler:** Çoklu platform zamanlama · Müşteri başına ayrı hesap

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | Metricool, Later | $60 | — |
| Ekonomik | Meta Business Suite + platformların kendi planlayıcıları | Ücretsiz | Her markayı kendi panelinden planlarsın. Tek panel istersen Metricool (marka başına ücretli) ya da Postiz (en az 4 GB RAM sunucu, daha çok bakım). |
| Alternatif | Buffer Essentials | $60 | Kanal başına ~$6; marka başına bir kanal hesabıyla. |

## Yapay zekâ ve ses

### Claude API

**Gereklilikler:** Türkçe doğal metin · Kısa yanıt süresi (DM için) · API ile otomasyon

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | Anthropic | $130 | — |
| Ekonomik | Claude Haiku 5.5 + Sonnet 5.5 | $15 | DM, triyaj ve özetler Haiku 5.5 ile; içerik metni Sonnet 5.5 ile. Önbellek ve toplu işleme açık. |
| Alternatif | Claude Batch API + Haiku 5.5 | $10 | Haftalık içerik toplu üretilir (%50 indirim, birkaç saat içinde döner); DM yanıtları Haiku 5.5 ile anında. |

### Ses ve telefon

**Gereklilikler:** Türkçe doğal ses · Seslendirme dosyası üretme

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | ElevenLabs, Twilio | $70 | — |
| Ekonomik | ElevenLabs Starter (seslendirme) | $5 | Ayda ~30 dk seslendirme, Flash modelle ~60 dk: Reels dış sesi ve DM/WhatsApp sesli notları. Canlı telefon asistanı yok (dakika başı ücretli); Creator planı $22. |
| Alternatif | Azure Konuşma Hizmeti (Türkçe nöral ses) | Ücretsiz | Ayda 500 bin karaktere kadar ücretsiz katman; ses klonlama yok. |

### Görüşme kaydı

**Gereklilikler:** Görüşme kaydı · Türkçe döküm

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | Fireflies, tl;dv | $40 | — |
| Ekonomik | tl;dv Ücretsiz | Ücretsiz | Döküm Claude'a gider, özeti Claude çıkarır. |
| Alternatif | Fireflies Ücretsiz | Ücretsiz | Türkçe döküm destekler; ücretsizde depolama sınırlı. |

## Operasyon ve ekip

### Tasarım ve kurgu

**Gereklilikler:** Carousel ve kapak tasarımı · Kısa video kurgusu · Marka şablonu

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | Canva, CapCut | $40 | — |
| Ekonomik | Canva Ücretsiz + CapCut Ücretsiz | Ücretsiz | Marka kiti gerekince Canva Pro. |
| Alternatif | Adobe Express Ücretsiz + DaVinci Resolve | Ücretsiz | İkisi de ücretsiz; DaVinci profesyonel kurgu için, öğrenmesi daha uzun. |

### Çalışma alanı

**Gereklilikler:** Müşteri portalı · SOP ve yol haritası belgeleri · Görev panosu

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | Notion | $40 | — |
| Ekonomik | Notion Ücretsiz | Ücretsiz | Misafir sayısı sınırlı; müşteri portalı için yeterli. |
| Alternatif | Google Drive + Dokümanlar + E-Tablolar | Ücretsiz | Ücretsiz, herkes bilir; pano görünümü zayıf. |

### Ekip iletişimi

**Gereklilikler:** Uyarı ve rapor kanalı · Bot / webhook desteği

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | Slack | $45 | — |
| Ekonomik | Slack Ücretsiz veya Telegram | Ücretsiz | Slack ücretsizde 90 günlük mesaj geçmişi. |
| Alternatif | Discord | Ücretsiz | Ücretsiz, sınırsız mesaj geçmişi, webhook desteği. |

### Google Workspace

**Gereklilikler:** Kurumsal e-posta · Takvim · Dosya paylaşımı

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | Gmail, Drive, Takvim | $50 | — |
| Ekonomik | Gmail + Google Takvim (ücretsiz) | Ücretsiz | Kendi alan adınla e-posta istersen Workspace gerekir. |
| Alternatif | Zoho Mail Ücretsiz | Ücretsiz | Kendi alan adınla 5 kullanıcıya kadar ücretsiz plan (koşulları değişebilir). |

### İş akışları

**Gereklilikler:** Sistemleri bağlama · Zamanlanmış görevler · Webhook

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | n8n, Make | $25 | — |
| Ekonomik | n8n, kendi sunucunda (VPS) | $6 | Tek küçük sunucuda yalnızca n8n çalışır; bakım ayda ~30 dk (sunucu/BAKIM.md). Bakım istemezsen n8n Cloud. |
| Alternatif | Make Ücretsiz | Ücretsiz | Ayda 1.000 işleme kadar ücretsiz; sunucu bakımı yok. Büyüdükçe ücretli. |

### Formlar ve anketler

**Gereklilikler:** Form ve anket · Otomasyona veri gönderme

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | Tally, Typeform | $29 | — |
| Ekonomik | Tally Ücretsiz | Ücretsiz | — |
| Alternatif | Google Formlar | Ücretsiz | Ücretsiz, sınırsız yanıt; tasarım seçenekleri az. |

## Veri ve raporlama

### Profil ve rakip verisi

**Gereklilikler:** Rakip ve aday hesap istatistikleri

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | Apify | $49 | — |
| Ekonomik | Apify (aylık ücretsiz kredi) | $5 | — |
| Alternatif | Instagram Business Discovery API | Ücretsiz | Diğer işletme hesaplarının herkese açık istatistikleri ücretsiz; kişisel hesaplarda çalışmaz. |

### Sunum

**Gereklilikler:** Kişiselleştirilmiş teklif sunumu · Şablondan otomatik üretim

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | Gamma, Google Slides | $20 | — |
| Ekonomik | Google Slides | Ücretsiz | — |
| Alternatif | Canva sunum şablonları | Ücretsiz | Canva hesabınla ücretsiz; otomatik doldurma Canva Pro ister. |

### Veritabanı

**Gereklilikler:** Yapılandırılmış veri · API erişimi

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | Supabase | $25 | — |
| Ekonomik | Supabase Ücretsiz | Ücretsiz | — |
| Alternatif | Airtable Ücretsiz | Ücretsiz | Taban başına 1.000 kayda kadar ücretsiz. |

### Raporlama

**Gereklilikler:** Pano ve grafik · Veri kaynağı bağlama

| Seçenek | Sağlayıcı | Aylık | Not |
|---|---|---|---|
| Standart | Looker Studio Pro | $9 | — |
| Ekonomik | Looker Studio | Ücretsiz | — |
| Alternatif | Databox Ücretsiz | Ücretsiz | 3 veri kaynağına kadar ücretsiz. |
