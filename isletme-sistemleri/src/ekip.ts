// Yapay zekâ sosyal medya ekibi: 22 sistemin üstünde pazarlamayı uçtan uca yürüten katman.
// Akış: 01 Sinyaller → 02 Kayıt sistemi + 04 İşletme girdileri → 03 Beyin → 05 Departmanlar
//       → 06 Veri & gözlem → 07 İnsana devir. Yanında: bilgi katmanı (bilgi/*.md) ve döngüyü kesen durumlar.
// İlke: Claude yazar, kurallar karar verir, ElevenLabs konuşur, sen yalnızca onaylarsın.

export interface Sinyal {
  id: string;
  ad: string;
  kaynaklar: string[];
  departman: string;
}

export interface Departman {
  id: string;
  ad: string;
  gorev: string;
  yapar: string[];
  araclar: string[];
  bilgi: string[];
  /** Bu departmanın çıktısı yayına/gönderime çıkmadan önce insan onayı ister mi */
  insanOnayi: boolean;
  /** 22 sistemden hangilerini çalıştırır (sistemler.ts id'leri) */
  sistemler: string[];
}

export interface BeyinRolu {
  id: string;
  ad: string;
  gorev: string;
  arac: string;
}

export interface GozlemMetrigi {
  id: string;
  ad: string;
  soru: string;
  hedef: string;
}

export const SINYALLER: Sinyal[] = [
  { id: "rakip-reklamlari", ad: "Rakip reklamları", kaynaklar: ["Meta Reklam Kütüphanesi", "TikTok Creative Center"], departman: "pazar-istihbarati" },
  { id: "trendler", ad: "Trend sesler ve formatlar", kaynaklar: ["TikTok", "Instagram Reels", "Google Trends"], departman: "pazar-istihbarati" },
  { id: "yorum-ve-dm", ad: "Yorumlar ve DM'ler", kaynaklar: ["Instagram", "Facebook", "TikTok", "LinkedIn"], departman: "satis-yaniti" },
  { id: "web-ziyaretcisi", ad: "Web sitesi ziyaretçileri", kaynaklar: ["Meta Pixel", "Google Analytics"], departman: "besleme-yeniden-hedefleme" },
  { id: "lead-formu", ad: "Lead formları", kaynaklar: ["Meta Lead Ads", "Web formu", "Typeform"], departman: "lead-yakalama" },
  { id: "degerlendirme", ad: "Değerlendirmeler ve bahsetmeler", kaynaklar: ["Google İşletme Profili", "Trustpilot", "Etiketlemeler"], departman: "itibar" },
  { id: "satis-aramasi", ad: "Satış aramaları", kaynaklar: ["Telefon (Twilio)", "Zoom", "Fireflies"], departman: "satis-yaniti" },
  { id: "reklam-performansi", ad: "Reklam performansı", kaynaklar: ["Meta Ads", "TikTok Ads", "Google Ads"], departman: "reklam" },
  { id: "icerik-talebi", ad: "İçerik talebi", kaynaklar: ["İçerik takvimi", "Müşteri portalı"], departman: "icerik-studyosu" },
  { id: "yayin-zamani", ad: "Planlanmış yayın zamanı geldi", kaynaklar: ["İçerik takvimi"], departman: "yayin" },
];

export const KAYIT_SISTEMI = [
  { id: "musteriler-ve-firsatlar", ad: "Müşteriler ve fırsatlar", araclar: ["GoHighLevel / HubSpot"] },
  { id: "reklam-hesaplari", ad: "Reklam hesapları", araclar: ["Meta Business", "TikTok Ads", "Google Ads"] },
  { id: "icerik-takvimi", ad: "İçerik takvimi", araclar: ["Notion", "Metricool"] },
  { id: "varlik-kutuphanesi", ad: "Varlık kütüphanesi (görsel, video, marka kiti)", araclar: ["Google Drive", "Canva"] },
];

export const ISLETME_GIRDILERI = [
  { id: "butce", ad: "Bütçe", aciklama: "Aylık reklam bütçesi ve kanal dağılımı" },
  { id: "teklifler", ad: "Teklifler", aciklama: "Satılan paketler, fiyatlar, kampanyalar" },
  { id: "takvim", ad: "Takvim", aciklama: "Lansmanlar, özel günler, satış görüşmesi müsaitliği" },
  { id: "onaylar", ad: "Onaylar", aciklama: "Neyin kimden onay alacağı (bilgi/onay-kurallari.md)" },
];

export const BEYIN: BeyinRolu[] = [
  { id: "triyaj", ad: "Triyaj", gorev: "Gelen her sinyali doğru departmana yönlendirir, döngüyü kesen durumları yakalar", arac: "Kurallar (src/beyin.ts) + Claude" },
  { id: "yazar", ad: "Yazar ve çalıştırır", gorev: "Metin, senaryo, yanıt ve reklam varyasyonlarını yazar; iş akışlarını çalıştırır", arac: "Claude API + n8n / Make" },
  { id: "konusur", ad: "Konuşur", gorev: "Gelen aramaları yanıtlar, sesli takip ve seslendirme üretir", arac: "ElevenLabs" },
  { id: "kontrol", ad: "İşi kontrol eder", gorev: "Her çıktıyı marka sesi, yasaklar ve kalite listesine göre denetler; geçemeyeni geri gönderir", arac: "Claude + bilgi/kalite-kontrol.md" },
];

export const DEPARTMANLAR: Departman[] = [
  {
    id: "pazar-istihbarati",
    ad: "Pazar istihbaratı",
    gorev: "Rakiplerin ve nişin ne yaptığını, neyin tuttuğunu izler; fikir ve açı üretir",
    yapar: ["Rakip reklam ve içerik takibi", "Trend ses/format tespiti", "Haftalık 'ne tutuyor' raporu", "Satış görüşmesi öncesi profil analizi"],
    araclar: ["Meta Reklam Kütüphanesi", "Apify", "Perplexity", "Claude"],
    bilgi: ["ideal-musteri.md", "rakipler.md"],
    insanOnayi: false,
    sistemler: ["gorusme-oncesi-arastirma", "musteri-yol-haritasi"],
  },
  {
    id: "reklam",
    ad: "Ücretli reklamlar",
    gorev: "Reklam metni ve varyasyonlarını üretir, bütçe içinde kampanyaları yönetir",
    yapar: ["Reklam metni ve kreatif varyasyonları", "A/B testi kurulumu", "Kötü reklamı durdurma, iyiyi ölçekleme", "Günlük bütçe kontrolü"],
    araclar: ["Meta Ads", "TikTok Ads", "Google Ads", "Claude"],
    bilgi: ["marka-sesi.md", "teklifler.md", "yasaklar.md"],
    insanOnayi: true,
    sistemler: ["satis-panosu", "sonuc-takibi"],
  },
  {
    id: "icerik-studyosu",
    ad: "İçerik stüdyosu",
    gorev: "Strateji ve içerik sütunlarından hook, senaryo, carousel ve görsel üretir",
    yapar: ["Hook ve senaryo yazımı", "Carousel ve kapak tasarımı", "Seslendirme (ElevenLabs)", "Kısa video kurgusu"],
    araclar: ["Claude", "Canva", "CapCut", "ElevenLabs", "Notion"],
    bilgi: ["marka-sesi.md", "icerik-sutunlari.md", "hook-kutuphanesi.md", "yasaklar.md"],
    insanOnayi: true,
    sistemler: ["proje-panosu", "sop-kutuphanesi", "musteri-yol-haritasi"],
  },
  {
    id: "yayin",
    ad: "Yayın",
    gorev: "Onaylı içerikleri doğru platformda doğru saatte yayınlar",
    yapar: ["Platforma göre biçimlendirme", "Zamanlama", "Açıklama, etiket ve CTA", "Yayın sonrası ilk saat takibi"],
    araclar: ["Metricool / Later", "Instagram", "TikTok", "LinkedIn", "YouTube"],
    bilgi: ["marka-sesi.md"],
    insanOnayi: false,
    sistemler: ["proje-panosu", "sonuc-takibi"],
  },
  {
    id: "lead-yakalama",
    ad: "Lead yakalama",
    gorev: "Her kaynaktan gelen lead'i CRM'e kaydeder, zenginleştirir ve niteler",
    yapar: ["Form/DM/reklam lead'ini CRM'e yazma", "Kaynak etiketleme (hangi içerik getirdi)", "Lead zenginleştirme", "Niteleme puanı"],
    araclar: ["Meta Lead Ads", "ManyChat", "Zapier", "GoHighLevel"],
    bilgi: ["ideal-musteri.md"],
    insanOnayi: false,
    sistemler: ["satis-crm", "yz-randevu-ayarlayici"],
  },
  {
    id: "satis-yaniti",
    ad: "Satış yanıtı",
    gorev: "DM, yorum ve aramalara dakikalar içinde yanıt verir, randevu alır",
    yapar: ["5 dakikada DM/yorum yanıtı", "Gelen aramayı sesli karşılama", "Niteleme soruları", "Takvimden randevu", "Gelmeyene yeniden randevu"],
    araclar: ["ManyChat", "ElevenLabs", "Twilio", "Cal.com", "Claude"],
    bilgi: ["marka-sesi.md", "teklifler.md", "itiraz-yanitlari.md", "sss.md"],
    insanOnayi: false,
    sistemler: ["yz-randevu-ayarlayici", "gelmeyene-yeniden-randevu", "gorusme-oncesi-arastirma"],
  },
  {
    id: "besleme-yeniden-hedefleme",
    ad: "Besleme ve yeniden hedefleme",
    gorev: "Henüz almaya hazır olmayanları e-posta, DM ve reklamla sıcak tutar",
    yapar: ["E-posta/DM besleme dizileri", "Site ziyaretçisine yeniden hedefleme", "Teklif sonrası takip", "Kaybedilen fırsatı yeniden canlandırma"],
    araclar: ["Meta Ads", "Mailchimp / Klaviyo", "GoHighLevel", "Claude"],
    bilgi: ["teklifler.md", "itiraz-yanitlari.md"],
    insanOnayi: false,
    sistemler: ["yz-takip-mesajlari"],
  },
  {
    id: "itibar",
    ad: "İtibar",
    gorev: "Değerlendirme ve bahsetmeleri izler, yanıtlar, mutlu müşteriden yorum ister",
    yapar: ["Değerlendirmelere yanıt", "Olumsuzu erken yakalama", "Mutlu müşteriden yorum ve video isteme", "Bahsetme takibi"],
    araclar: ["Google İşletme Profili", "Trustpilot", "Claude"],
    bilgi: ["marka-sesi.md", "yasaklar.md"],
    insanOnayi: true,
    sistemler: ["aylik-nps-anketi", "musteri-saglik-skoru"],
  },
];

export const GOZLEM: GozlemMetrigi[] = [
  { id: "lead-basi-maliyet", ad: "Lead başı maliyet", soru: "Bir lead kaç liraya geliyor, kanala göre?", hedef: "Hedef CPL'nin altında" },
  { id: "lead-yanit-hizi", ad: "Lead'e yanıt hızı", soru: "Lead geldikten kaç dakika sonra ilk yanıt gitti?", hedef: "≤ 5 dk" },
  { id: "randevu-ve-odeme", ad: "Randevu ve ödeme", soru: "Kaç randevu alındı, kaçı ödemeye döndü?", hedef: "Görüşme → kapanış ≥ %25" },
  { id: "reklamdan-musteriye", ad: "Reklamdan müşteriye", soru: "Hangi reklam/içerik gerçekten ödeyen müşteri getirdi?", hedef: "Her müşterinin kaynağı bilinir" },
  { id: "ajan-etkinlik-kaydi", ad: "Ajan etkinlik kaydı", soru: "Hangi ajan ne yaptı, ne kadar sürdü, ne kadar tuttu, nerede hata yaptı?", hedef: "Tüm eylemler kayıtlı" },
];

export const INSAN_DEVRI = [
  { id: "sen", ad: "Sen (onaylar)", aciklama: "Reklam, içerik ve itibar yanıtlarını Slack/Telegram'dan tek tıkla onaylarsın", kanal: "Slack / Telegram" },
  { id: "satis-ekibi", ad: "Satış ekibin", aciklama: "Nitelikli randevular ve insan isteyen arayanlar devredilir", kanal: "CRM + takvim" },
  { id: "topluluk", ad: "Topluluk (isteğe bağlı)", aciklama: "Ücretli topluluk/eğitim üyelerinin yönetimi", kanal: "Skool / Discord" },
];
