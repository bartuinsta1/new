# Sunucu bakımı

Ekonomik planda sunucuda **yalnızca n8n** (iş akışları) çalışır; önüne otomatik HTTPS veren Caddy konur.
Paylaşım planlama, CRM, formlar gibi her şey ücretsiz bulut katmanlarında durur, yani bakımını
yaptığın tek şey bu küçük sunucudur.

## Ne kadar sürer?

| İş | Sıklık | Süre | Nasıl |
|---|---|---|---|
| Yedek | Her gün 03:00 | 0 dk | Otomatik (`yedek.sh`, son 14 gün tutulur) |
| Güvenlik yamaları | Her gün | 0 dk | Otomatik (Ubuntu unattended-upgrades) |
| HTTPS sertifikası | 60–90 günde bir | 0 dk | Otomatik (Caddy yeniler) |
| Eski kayıt temizliği | Sürekli | 0 dk | Otomatik (n8n 14 günden eski çalıştırmaları siler) |
| n8n + sistem güncellemesi | Ayda bir | ~10 dk | `sudo ./guncelle.sh` |
| Göz atma: disk, yedek, hata veren akış | Ayda bir | ~10 dk | Aşağıdaki kontrol listesi |
| Bir şey bozulursa | Yılda birkaç kez | 15–60 dk | `sudo ./geri-al.sh` |

**Normal bir ayda toplam ~20–30 dakika.** En kötü durumda (güncelleme bir akışı bozdu) bir saat.

## İlk kurulum (bir kez, ~30 dk)

1. Hetzner / DigitalOcean / Contabo'dan en küçük Ubuntu 24.04 sunucuyu aç (2 GB RAM yeter, ayda ~$5–6).
   Panelden **otomatik anlık görüntü (snapshot)** seçeneğini aç: ayda ~$1 ek, tüm sunucunun yedeği.
2. Alan adında `otomasyon.ajansin.com` için sunucunun IP'sine bir A kaydı ekle.
3. Bu `sunucu/` klasörünü sunucuya kopyala ve çalıştır:
   ```bash
   sudo ./kurulum.sh otomasyon.ajansin.com
   ```
4. `.env` içindeki `N8N_ENCRYPTION_KEY`'i şifre yöneticine kaydet. Bu anahtar olmadan yedekteki
   bağlantı şifreleri açılmaz.
5. `https://otomasyon.ajansin.com` adresinde n8n hesabını oluştur.

## Aylık kontrol listesi (~10 dk)

- [ ] `sudo ./guncelle.sh` → "✓ Güncelleme tamam" yazmalı, disk %80'in altında olmalı
- [ ] `ls -lh /root/yedekler` → dünün tarihli bir yedek var mı
- [ ] n8n'de **Executions** sayfasında kırmızı (hatalı) çalıştırma var mı; varsa hangi akış, neden
- [ ] (İsteğe bağlı) yedeği sunucu dışına al: `rclone` kur, `YEDEK_UZAK=gdrive:ajans-yedek` tanımla

## Ne bozulabilir, ne yapılır?

| Belirti | Sebep | Çözüm |
|---|---|---|
| Güncellemeden sonra akış hata veriyor | n8n yeni sürümde bir düğümü değiştirdi | `sudo ./geri-al.sh`, sonra `.env` içinde `N8N_SURUM`'u eski sürüme sabitle |
| Site açılmıyor | Sunucu yeniden başladı ya da disk doldu | `docker compose ps`, `df -h`; disk doluysa `docker system prune` |
| Instagram/Meta bağlantısı düştü | Erişim anahtarının süresi doldu (sunucuyla ilgisi yok) | n8n'de o bağlantıyı yeniden yetkilendir |
| Sunucu tamamen gitti | Sağlayıcı sorunu | Yeni sunucu aç, `kurulum.sh`, sonra `geri-al.sh` ile son yedeği yükle (~30 dk) |

## Hiç bakım istemezsen

**n8n Cloud** kullan: sunucu, yedek ve güncelleme onlarda. En küçük paket ayda yaklaşık $20–24, yani
ekonomik planın toplamı ~$15–20 artar. Kişisel olarak teknik işlerle uğraşmak istemiyorsan bu
değişime değer; o zaman bu klasörü hiç kullanmazsın.
