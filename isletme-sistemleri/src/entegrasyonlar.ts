// Entegrasyon yuvaları: her yuva bir yeteneği temsil eder (ör. "CRM") ve önerilen sağlayıcıları listeler.
// `baglantiUrl` tek tıkla bağlanma adresidir (OAuth / Zapier / Composio vb.); boşsa site yuvayı
// "adres bekleniyor" olarak gösterir. Bir sistem veya departman, onu listeleyen tüm yuvalar
// bağlandığında canlıya hazır sayılır. Maliyetler aylık USD tahminidir: sabit + müşteri başı.
// İki plan vardır: "standart" önerilen ücretli araçlarla, "ekonomik" ücretsiz katmanlar ve kendi sunucunda
// çalışan açık kaynak araçlarla kurar. Ekonomik planda `atla` işaretli yuvalar ilk aşamada gerekmez.

export interface Entegrasyon {
  id: string;
  ad: string;
  saglayicilar: string[];
  grup: "satis" | "sosyal" | "yapayZeka" | "operasyon" | "veri";
  aciklama: string;
  sistemler: string[];
  departmanlar: string[];
  maliyet: { sabit: number; musteriBasi: number };
  ekonomik: Secenek & { atla?: boolean };
  /** Bu yuvadaki her seçeneğin karşılaması gereken asgari işlevler */
  gereksinimler: string[];
  /** Standart ve ekonomik dışında, gereksinimleri karşılayan üçüncü seçenek */
  alternatif: Secenek;
  baglantiUrl: string;
}

export interface Secenek {
  saglayici: string;
  sabit: number;
  musteriBasi: number;
  not: string;
}

/** Bir yuvada hangi seçeneğin kullanıldığı; plan varsayılanı belirler, kullanıcı yuva başına değiştirebilir. */
export type Secim = "standart" | "ekonomik" | "alternatif";

export type Plan = "standart" | "ekonomik";

export const PLANLAR = {
  ekonomik: { ad: "Ekonomik", aciklama: "Ücretsiz katmanlar ve kendi sunucunda açık kaynak araçlar. Başlangıç ve 30 müşteriye kadar." },
  standart: { ad: "Standart", aciklama: "Önerilen ücretli araçlar: daha az sınır, daha az bakım, sesli asistan dahil." },
} as const;

export const GRUPLAR = {
  satis: "Satış ve müşteri",
  sosyal: "Sosyal medya ve reklam",
  yapayZeka: "Yapay zekâ ve ses",
  operasyon: "Operasyon ve ekip",
  veri: "Veri ve raporlama",
} as const;

export const ENTEGRASYONLAR: Entegrasyon[] = [
  {
    id: "crm",
    ad: "CRM",
    saglayicilar: ["GoHighLevel", "HubSpot"],
    grup: "satis",
    aciklama: "Lead'ler, fırsatlar ve satış hattı. Satış tarafının temeli.",
    sistemler: ["satis-crm", "satis-panosu", "onboarding-akisi", "musteri-saglik-skoru", "gelmeyene-yeniden-randevu", "yz-randevu-ayarlayici", "yz-takip-mesajlari"],
    departmanlar: ["lead-yakalama", "satis-yaniti", "besleme-yeniden-hedefleme"],
    maliyet: { sabit: 197, musteriBasi: 0 },
    ekonomik: { saglayici: "HubSpot Ücretsiz CRM", sabit: 0, musteriBasi: 0, not: "Otomatik e-posta dizisi yok; takip mesajlarını n8n gönderir." },
    gereksinimler: ["Kişi ve fırsat kaydı", "Aşamalı satış hattı", "API veya webhook (n8n bağlantısı)"],
    alternatif: { saglayici: "Attio Ücretsiz", sabit: 0, musteriBasi: 0, not: "3 kullanıcıya kadar ücretsiz, API açık; esnek veri modeli." },
    baglantiUrl: "",
  },
  {
    id: "claude",
    ad: "Claude API",
    saglayicilar: ["Anthropic"],
    grup: "yapayZeka",
    aciklama: "Beynin yazan ve kontrol eden kısmı: içerik, DM yanıtı, özet, puanlama.",
    sistemler: ["gorusme-oncesi-arastirma", "kendini-kuran-sunum", "satis-gorusmesi-puanlayici", "yz-randevu-ayarlayici", "yz-takip-mesajlari", "yz-musteri-ozetleri", "yz-genel-mudur-yardimcisi"],
    departmanlar: ["pazar-istihbarati", "reklam", "icerik-studyosu", "yayin", "lead-yakalama", "satis-yaniti", "besleme-yeniden-hedefleme", "itibar"],
    maliyet: { sabit: 30, musteriBasi: 10 },
    ekonomik: { saglayici: "Claude Haiku 5.5 + Sonnet 5.5", sabit: 0, musteriBasi: 1.5, not: "DM, triyaj ve özetler Haiku 5.5 ile; içerik metni Sonnet 5.5 ile. Önbellek ve toplu işleme açık." },
    gereksinimler: ["Türkçe doğal metin", "Kısa yanıt süresi (DM için)", "API ile otomasyon"],
    alternatif: { saglayici: "Claude Batch API + Haiku 5.5", sabit: 0, musteriBasi: 1, not: "Haftalık içerik toplu üretilir (%50 indirim, birkaç saat içinde döner); DM yanıtları Haiku 5.5 ile anında." },
    baglantiUrl: "",
  },
  {
    id: "meta",
    ad: "Instagram ve Facebook",
    saglayicilar: ["Meta Business"],
    grup: "sosyal",
    aciklama: "Hesap istatistikleri, yorumlar, DM'ler ve yayın.",
    sistemler: ["sonuc-takibi"],
    departmanlar: ["yayin", "satis-yaniti", "pazar-istihbarati"],
    maliyet: { sabit: 0, musteriBasi: 0 },
    ekonomik: { saglayici: "Meta Business (ücretsiz)", sabit: 0, musteriBasi: 0, not: "" },
    gereksinimler: ["Yorum ve DM okuma", "Hesap istatistikleri", "Gönderi yayını"],
    alternatif: { saglayici: "Instagram API (Instagram ile Giriş)", sabit: 0, musteriBasi: 0, not: "Facebook sayfası gerekmeden profesyonel hesaba doğrudan bağlanır; Meta uygulama incelemesi ister." },
    baglantiUrl: "",
  },
  {
    id: "diger-platformlar",
    ad: "TikTok, LinkedIn, YouTube",
    saglayicilar: ["TikTok", "LinkedIn", "YouTube"],
    grup: "sosyal",
    aciklama: "Diğer platformlarda yayın ve istatistik.",
    sistemler: ["sonuc-takibi"],
    departmanlar: ["yayin"],
    maliyet: { sabit: 0, musteriBasi: 0 },
    ekonomik: { saglayici: "Platform API'leri (ücretsiz)", sabit: 0, musteriBasi: 0, not: "" },
    gereksinimler: ["Yayın", "Temel istatistik"],
    alternatif: { saglayici: "Buffer Ücretsiz", sabit: 0, musteriBasi: 0, not: "3 kanala kadar ücretsiz; daha fazlası kanal başına ücretli." },
    baglantiUrl: "",
  },
  {
    id: "reklam-hesaplari",
    ad: "Reklam hesapları",
    saglayicilar: ["Meta Ads", "TikTok Ads", "Google Ads"],
    grup: "sosyal",
    aciklama: "Kampanya yönetimi, bütçe ve lead başı maliyet verisi.",
    sistemler: ["satis-panosu"],
    departmanlar: ["reklam", "besleme-yeniden-hedefleme", "lead-yakalama"],
    maliyet: { sabit: 0, musteriBasi: 0 },
    ekonomik: { saglayici: "Reklam hesapları (ücretsiz)", sabit: 0, musteriBasi: 0, not: "Reklam bütçesi müşteriden." },
    gereksinimler: ["Kampanya yönetimi", "Bütçe ve harcama verisi", "Lead başı maliyet"],
    alternatif: { saglayici: "LinkedIn Ads", sabit: 0, musteriBasi: 0, not: "Kurucu ve uzman kitlesi için; lead maliyeti daha yüksek ama nitelik daha iyi. Bütçe müşteriden." },
    baglantiUrl: "",
  },
  {
    id: "dm-otomasyonu",
    ad: "DM otomasyonu",
    saglayicilar: ["ManyChat"],
    grup: "sosyal",
    aciklama: "Anahtar kelimeli yorum ve DM'leri yakalayıp yapay zekâya iletir.",
    sistemler: ["yz-randevu-ayarlayici"],
    departmanlar: ["satis-yaniti", "lead-yakalama"],
    maliyet: { sabit: 15, musteriBasi: 10 },
    ekonomik: { saglayici: "ManyChat Ücretsiz", sabit: 0, musteriBasi: 0, not: "1.000 kişiye kadar. Aşan müşteride Pro'ya geç ve ücretini pakete ekle." },
    gereksinimler: ["Anahtar kelimeli yorum yakalama", "DM'den otomatik yanıt", "Yapay zekâya aktarım"],
    alternatif: { saglayici: "n8n + Instagram mesajlaşma webhook'u", sabit: 0, musteriBasi: 0, not: "Ücretsiz ve sınırsız kişi; kurulumu teknik, Meta uygulama incelemesi ister." },
    baglantiUrl: "",
  },
  {
    id: "ses",
    ad: "Ses ve telefon",
    saglayicilar: ["ElevenLabs", "Twilio"],
    grup: "yapayZeka",
    aciklama: "Gelen aramayı sesli karşılama, seslendirme, SMS.",
    sistemler: ["gelmeyene-yeniden-randevu"],
    departmanlar: ["satis-yaniti", "icerik-studyosu"],
    maliyet: { sabit: 40, musteriBasi: 3 },
    ekonomik: { saglayici: "ElevenLabs Starter (seslendirme)", sabit: 5, musteriBasi: 0, not: "Ayda ~30 dk seslendirme, Flash modelle ~60 dk: Reels dış sesi ve DM/WhatsApp sesli notları. Canlı telefon asistanı yok (dakika başı ücretli); Creator planı $22." },
    gereksinimler: ["Türkçe doğal ses", "Seslendirme dosyası üretme"],
    alternatif: { saglayici: "Azure Konuşma Hizmeti (Türkçe nöral ses)", sabit: 0, musteriBasi: 0, not: "Ayda 500 bin karaktere kadar ücretsiz katman; ses klonlama yok." },
    baglantiUrl: "",
  },
  {
    id: "whatsapp",
    ad: "WhatsApp Business",
    saglayicilar: ["WATI (hazır WhatsApp paneli)"],
    grup: "satis",
    aciklama: "Müşteri ve aday iletişimi, hatırlatmalar.",
    sistemler: ["sessiz-musteri-uyarisi", "gelmeyene-yeniden-randevu"],
    departmanlar: [],
    maliyet: { sabit: 49, musteriBasi: 1.5 },
    ekonomik: { saglayici: "WhatsApp Cloud API", sabit: 0, musteriBasi: 0.5, not: "Müşterinin başlattığı konuşmalar ücretsiz; hatırlatmalar mesaj başı ücretli." },
    gereksinimler: ["Müşteriye mesaj ve hatırlatma", "API ile otomasyon"],
    alternatif: { saglayici: "Twilio WhatsApp", sabit: 0, musteriBasi: 1, not: "Kurulumu kolay; Meta ücretine ek mesaj başı küçük bir ücret." },
    baglantiUrl: "",
  },
  {
    id: "takvim",
    ad: "Randevu takvimi",
    saglayicilar: ["Cal.com", "Calendly"],
    grup: "satis",
    aciklama: "Satış ve onboarding görüşmesi randevuları.",
    sistemler: ["onboarding-gorusmesi-48s", "yz-randevu-ayarlayici", "gelmeyene-yeniden-randevu"],
    departmanlar: ["satis-yaniti"],
    maliyet: { sabit: 15, musteriBasi: 0 },
    ekonomik: { saglayici: "Cal.com Ücretsiz", sabit: 0, musteriBasi: 0, not: "" },
    gereksinimler: ["Herkese açık randevu sayfası", "Takvim eşitleme", "Hatırlatma"],
    alternatif: { saglayici: "Google Takvim randevu planlama", sabit: 0, musteriBasi: 0, not: "Ücretsiz Gmail hesabında temel randevu sayfası; ödeme ve gelişmiş formlar için Workspace gerekir." },
    baglantiUrl: "",
  },
  {
    id: "odeme",
    ad: "Ödeme",
    saglayicilar: ["Stripe", "iyzico"],
    grup: "satis",
    aciklama: "Abonelik tahsilatı; ödeme gelince onboarding başlar.",
    sistemler: ["onboarding-akisi", "ceo-panosu"],
    departmanlar: [],
    maliyet: { sabit: 0, musteriBasi: 0 },
    ekonomik: { saglayici: "iyzico / Stripe", sabit: 0, musteriBasi: 0, not: "Aylık ücret yok, işlem başına komisyon." },
    gereksinimler: ["Kartla tahsilat", "Abonelik / tekrarlayan ödeme"],
    alternatif: { saglayici: "PayTR", sabit: 0, musteriBasi: 0, not: "Türkiye'de yaygın; aylık ücret yok, işlem başına komisyon. Şirket gerekir." },
    baglantiUrl: "",
  },
  {
    id: "eposta",
    ad: "E-posta pazarlama",
    saglayicilar: ["Mailchimp", "Klaviyo"],
    grup: "satis",
    aciklama: "Besleme dizileri ve bülten.",
    sistemler: [],
    departmanlar: ["besleme-yeniden-hedefleme"],
    maliyet: { sabit: 20, musteriBasi: 3 },
    ekonomik: { saglayici: "Brevo Ücretsiz", sabit: 0, musteriBasi: 0, not: "Günde 300 e-posta." },
    gereksinimler: ["Liste ve otomatik dizi", "API"],
    alternatif: { saglayici: "MailerLite Ücretsiz", sabit: 0, musteriBasi: 0, not: "1.000 aboneye kadar ücretsiz, otomasyon dahil." },
    baglantiUrl: "",
  },
  {
    id: "itibar",
    ad: "Değerlendirmeler",
    saglayicilar: ["Google İşletme Profili"],
    grup: "sosyal",
    aciklama: "Yorumları okuma ve yanıtlama.",
    sistemler: [],
    departmanlar: ["itibar"],
    maliyet: { sabit: 0, musteriBasi: 0 },
    ekonomik: { saglayici: "Google İşletme Profili (ücretsiz)", sabit: 0, musteriBasi: 0, not: "" },
    gereksinimler: ["Değerlendirme okuma", "Yanıt verme"],
    alternatif: { saglayici: "Trustpilot Ücretsiz", sabit: 0, musteriBasi: 0, not: "Ücretsiz işletme profili; Google'dan sonra ikinci kaynak." },
    baglantiUrl: "",
  },
  {
    id: "planlama",
    ad: "Yayın planlama",
    saglayicilar: ["Metricool", "Later"],
    grup: "sosyal",
    aciklama: "Çoklu platform zamanlama ve analiz.",
    sistemler: ["sonuc-takibi", "proje-panosu"],
    departmanlar: ["yayin"],
    maliyet: { sabit: 20, musteriBasi: 4 },
    ekonomik: { saglayici: "Meta Business Suite + platformların kendi planlayıcıları", sabit: 0, musteriBasi: 0, not: "Her markayı kendi panelinden planlarsın. Tek panel istersen Metricool (marka başına ücretli) ya da Postiz (en az 4 GB RAM sunucu, daha çok bakım)." },
    gereksinimler: ["Çoklu platform zamanlama", "Müşteri başına ayrı hesap"],
    alternatif: { saglayici: "Buffer Essentials", sabit: 0, musteriBasi: 6, not: "Kanal başına ~$6; marka başına bir kanal hesabıyla." },
    baglantiUrl: "",
  },
  {
    id: "tasarim",
    ad: "Tasarım ve kurgu",
    saglayicilar: ["Canva", "CapCut"],
    grup: "operasyon",
    aciklama: "Carousel, kapak, kısa video.",
    sistemler: [],
    departmanlar: ["icerik-studyosu"],
    maliyet: { sabit: 30, musteriBasi: 1 },
    ekonomik: { saglayici: "Canva Ücretsiz + CapCut Ücretsiz", sabit: 0, musteriBasi: 0, not: "Marka kiti gerekince Canva Pro." },
    gereksinimler: ["Carousel ve kapak tasarımı", "Kısa video kurgusu", "Marka şablonu"],
    alternatif: { saglayici: "Adobe Express Ücretsiz + DaVinci Resolve", sabit: 0, musteriBasi: 0, not: "İkisi de ücretsiz; DaVinci profesyonel kurgu için, öğrenmesi daha uzun." },
    baglantiUrl: "",
  },
  {
    id: "calisma-alani",
    ad: "Çalışma alanı",
    saglayicilar: ["Notion"],
    grup: "operasyon",
    aciklama: "Portal, yol haritaları, SOP'lar ve içerik panosu.",
    sistemler: ["musteri-portali", "musteri-yol-haritasi", "proje-panosu", "sop-kutuphanesi"],
    departmanlar: ["icerik-studyosu"],
    maliyet: { sabit: 40, musteriBasi: 0 },
    ekonomik: { saglayici: "Notion Ücretsiz", sabit: 0, musteriBasi: 0, not: "Misafir sayısı sınırlı; müşteri portalı için yeterli." },
    gereksinimler: ["Müşteri portalı", "SOP ve yol haritası belgeleri", "Görev panosu"],
    alternatif: { saglayici: "Google Drive + Dokümanlar + E-Tablolar", sabit: 0, musteriBasi: 0, not: "Ücretsiz, herkes bilir; pano görünümü zayıf." },
    baglantiUrl: "",
  },
  {
    id: "ekip-iletisimi",
    ad: "Ekip iletişimi",
    saglayicilar: ["Slack"],
    grup: "operasyon",
    aciklama: "Uyarılar, gün sonu raporları, sabah brifingi ve onaylar.",
    sistemler: ["gun-sonu-raporlari", "sessiz-musteri-uyarisi", "yz-genel-mudur-yardimcisi"],
    departmanlar: [],
    maliyet: { sabit: 45, musteriBasi: 0 },
    ekonomik: { saglayici: "Slack Ücretsiz veya Telegram", sabit: 0, musteriBasi: 0, not: "Slack ücretsizde 90 günlük mesaj geçmişi." },
    gereksinimler: ["Uyarı ve rapor kanalı", "Bot / webhook desteği"],
    alternatif: { saglayici: "Discord", sabit: 0, musteriBasi: 0, not: "Ücretsiz, sınırsız mesaj geçmişi, webhook desteği." },
    baglantiUrl: "",
  },
  {
    id: "google",
    ad: "Google Workspace",
    saglayicilar: ["Gmail", "Drive", "Takvim"],
    grup: "operasyon",
    aciklama: "E-posta, dosya paylaşımı ve takvim.",
    sistemler: ["onboarding-akisi", "onboarding-gorusmesi-48s", "sessiz-musteri-uyarisi"],
    departmanlar: [],
    maliyet: { sabit: 50, musteriBasi: 0 },
    ekonomik: { saglayici: "Gmail + Google Takvim (ücretsiz)", sabit: 0, musteriBasi: 0, not: "Kendi alan adınla e-posta istersen Workspace gerekir." },
    gereksinimler: ["Kurumsal e-posta", "Takvim", "Dosya paylaşımı"],
    alternatif: { saglayici: "Zoho Mail Ücretsiz", sabit: 0, musteriBasi: 0, not: "Kendi alan adınla 5 kullanıcıya kadar ücretsiz plan (koşulları değişebilir)." },
    baglantiUrl: "",
  },
  {
    id: "is-akislari",
    ad: "İş akışları",
    saglayicilar: ["n8n", "Make"],
    grup: "operasyon",
    aciklama: "Sistemleri birbirine bağlayan otomasyonlar.",
    sistemler: ["onboarding-akisi", "gun-sonu-raporlari", "sessiz-musteri-uyarisi", "aylik-nps-anketi"],
    departmanlar: [],
    maliyet: { sabit: 25, musteriBasi: 0 },
    ekonomik: { saglayici: "n8n, kendi sunucunda (VPS)", sabit: 6, musteriBasi: 0, not: "Tek küçük sunucuda yalnızca n8n çalışır; bakım ayda ~30 dk (sunucu/BAKIM.md). Bakım istemezsen n8n Cloud." },
    gereksinimler: ["Sistemleri bağlama", "Zamanlanmış görevler", "Webhook"],
    alternatif: { saglayici: "Make Ücretsiz", sabit: 0, musteriBasi: 0, not: "Ayda 1.000 işleme kadar ücretsiz; sunucu bakımı yok. Büyüdükçe ücretli." },
    baglantiUrl: "",
  },
  {
    id: "formlar",
    ad: "Formlar ve anketler",
    saglayicilar: ["Tally", "Typeform"],
    grup: "operasyon",
    aciklama: "Marka formu, NPS anketi, gün sonu formu.",
    sistemler: ["onboarding-akisi", "aylik-nps-anketi", "gun-sonu-raporlari"],
    departmanlar: [],
    maliyet: { sabit: 29, musteriBasi: 0 },
    ekonomik: { saglayici: "Tally Ücretsiz", sabit: 0, musteriBasi: 0, not: "" },
    gereksinimler: ["Form ve anket", "Otomasyona veri gönderme"],
    alternatif: { saglayici: "Google Formlar", sabit: 0, musteriBasi: 0, not: "Ücretsiz, sınırsız yanıt; tasarım seçenekleri az." },
    baglantiUrl: "",
  },
  {
    id: "gorusme-kaydi",
    ad: "Görüşme kaydı",
    saglayicilar: ["Fireflies", "tl;dv"],
    grup: "yapayZeka",
    aciklama: "Görüşme kaydı ve dökümü.",
    sistemler: ["onboarding-gorusmesi-48s", "satis-gorusmesi-puanlayici", "yz-musteri-ozetleri"],
    departmanlar: [],
    maliyet: { sabit: 40, musteriBasi: 0 },
    ekonomik: { saglayici: "tl;dv Ücretsiz", sabit: 0, musteriBasi: 0, not: "Döküm Claude'a gider, özeti Claude çıkarır." },
    gereksinimler: ["Görüşme kaydı", "Türkçe döküm"],
    alternatif: { saglayici: "Fireflies Ücretsiz", sabit: 0, musteriBasi: 0, not: "Türkçe döküm destekler; ücretsizde depolama sınırlı." },
    baglantiUrl: "",
  },
  {
    id: "web-verisi",
    ad: "Profil ve rakip verisi",
    saglayicilar: ["Apify"],
    grup: "veri",
    aciklama: "Aday ve rakip profillerinden istatistik çekme.",
    sistemler: ["gorusme-oncesi-arastirma"],
    departmanlar: ["pazar-istihbarati"],
    maliyet: { sabit: 49, musteriBasi: 0 },
    ekonomik: { saglayici: "Apify (aylık ücretsiz kredi)", sabit: 0, musteriBasi: 0.5, not: "" },
    gereksinimler: ["Rakip ve aday hesap istatistikleri"],
    alternatif: { saglayici: "Instagram Business Discovery API", sabit: 0, musteriBasi: 0, not: "Diğer işletme hesaplarının herkese açık istatistikleri ücretsiz; kişisel hesaplarda çalışmaz." },
    baglantiUrl: "",
  },
  {
    id: "sunum",
    ad: "Sunum",
    saglayicilar: ["Gamma", "Google Slides"],
    grup: "veri",
    aciklama: "Otomatik teklif sunumu.",
    sistemler: ["kendini-kuran-sunum"],
    departmanlar: [],
    maliyet: { sabit: 20, musteriBasi: 0 },
    ekonomik: { saglayici: "Google Slides", sabit: 0, musteriBasi: 0, not: "" },
    gereksinimler: ["Kişiselleştirilmiş teklif sunumu", "Şablondan otomatik üretim"],
    alternatif: { saglayici: "Canva sunum şablonları", sabit: 0, musteriBasi: 0, not: "Canva hesabınla ücretsiz; otomatik doldurma Canva Pro ister." },
    baglantiUrl: "",
  },
  {
    id: "veritabani",
    ad: "Veritabanı",
    saglayicilar: ["Supabase"],
    grup: "veri",
    aciklama: "Sağlık skoru, sonuçlar ve portal verisi.",
    sistemler: ["musteri-portali", "sonuc-takibi", "musteri-saglik-skoru", "ceo-panosu"],
    departmanlar: [],
    maliyet: { sabit: 25, musteriBasi: 0 },
    ekonomik: { saglayici: "Supabase Ücretsiz", sabit: 0, musteriBasi: 0, not: "" },
    gereksinimler: ["Yapılandırılmış veri", "API erişimi"],
    alternatif: { saglayici: "Airtable Ücretsiz", sabit: 0, musteriBasi: 0, not: "Taban başına 1.000 kayda kadar ücretsiz." },
    baglantiUrl: "",
  },
  {
    id: "raporlama",
    ad: "Raporlama",
    saglayicilar: ["Looker Studio Pro"],
    grup: "veri",
    aciklama: "CEO ve satış panoları.",
    sistemler: ["ceo-panosu", "satis-panosu"],
    departmanlar: [],
    maliyet: { sabit: 9, musteriBasi: 0 },
    ekonomik: { saglayici: "Looker Studio", sabit: 0, musteriBasi: 0, not: "" },
    gereksinimler: ["Pano ve grafik", "Veri kaynağı bağlama"],
    alternatif: { saglayici: "Databox Ücretsiz", sabit: 0, musteriBasi: 0, not: "3 veri kaynağına kadar ücretsiz." },
    baglantiUrl: "",
  },
];

/** Bu planda kurulması gereken yuvalar. */
export function plandakiler(plan: Plan = "standart"): Entegrasyon[] {
  return ENTEGRASYONLAR.filter((e) => plan === "standart" || !e.ekonomik.atla);
}

/** Bir sistem ya da departman için bu planda gereken yuvalar. */
export function gerekenler(hedefId: string, plan: Plan = "standart"): Entegrasyon[] {
  return plandakiler(plan).filter((e) => e.sistemler.includes(hedefId) || e.departmanlar.includes(hedefId));
}

/** Bağlı yuvalara göre hazır olma: eksik yuvaların listesi; boşsa canlıya hazır. */
export function eksikler(hedefId: string, bagli: ReadonlySet<string>, plan: Plan = "standart"): Entegrasyon[] {
  return gerekenler(hedefId, plan).filter((e) => !bagli.has(e.id));
}

export function secenek(e: Entegrasyon, secim: Secim = "standart"): Secenek {
  if (secim === "ekonomik") return e.ekonomik;
  if (secim === "alternatif") return e.alternatif;
  return { saglayici: e.saglayicilar.join(", "), ...e.maliyet, not: "" };
}

/** Geriye dönük ad: plan, o plandaki varsayılan seçimdir. */
export const fiyat = secenek;

/** Aylık maliyet. `secimler` yuva başına seçimi değiştirir; verilmeyen yuvada plan geçerlidir. */
export function aylikMaliyet(
  entegrasyonlar: Entegrasyon[],
  musteriSayisi: number,
  plan: Plan = "standart",
  secimler: Readonly<Record<string, Secim>> = {},
): number {
  return entegrasyonlar.reduce((t, e) => {
    const f = secenek(e, secimler[e.id] ?? plan);
    return t + f.sabit + f.musteriBasi * musteriSayisi;
  }, 0);
}
