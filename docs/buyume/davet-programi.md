# Davet programı ve paylaşım linki

**Kural:** davet eden ve edilen 1 hafta Premium kazanır.

1. Ebeveyn bir masalı paylaşır (Ebeveyn Köşesi › Masal geçmişi › Paylaş) ya da yalnızca davet kodunu gönderir
   (Hesap › Arkadaşını davet et).
2. Bağlantı `masalcik.app/s/<jeton>` web önizlemesini açar (`web/s/index.html`): masalın başı, "Dinle", paylaşanın
   **davet kodu**, App Store düğmesi. Uygulama yüklüyse Universal Link ile uygulamada açılır.
3. Arkadaş uygulamayı indirir → Ebeveyn Köşesi › Hesap › "Arkadaşınızın kodu" → ikisine de 7 gün Premium
   (`POST /referral/redeem`).

**Neden kod elle giriliyor?** Yüklemeden sonra bağlantıyı hatırlayan ("deferred deep link") çözümler üçüncü taraf
SDK ve cihaz parmak izi gerektirir; Kids kategorisinde ikisini de istemiyoruz.

**Sınırlar:** hesap başına bir kez kod; kendi kodu ve karşılıklı davet yok; davet eden yılda en çok 12 hafta kazanır
(davet edilen her zaman kazanır). Ödül App Store aboneliğinden ayrı tutulur.

**WhatsApp veli grubu mesajı (öneri, uygulama otomatik doldurur):**
> Masalcık'ta çocuğumuz her gece kendi masalının kahramanı oluyor. Uygulamayı indirip Ebeveyn Köşesi › Hesap
> bölümüne PMK7QX kodunu yazarsan ikimiz de 1 hafta Premium kazanırız: [App Store bağlantısı]
