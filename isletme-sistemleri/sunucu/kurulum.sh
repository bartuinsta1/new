#!/usr/bin/env bash
# Temiz bir Ubuntu 24.04 sunucuda bir kez çalıştırılır: sudo ./kurulum.sh otomasyon.ajansin.com
set -euo pipefail
cd "$(dirname "$0")"

ALAN="${1:?Kullanım: sudo ./kurulum.sh <alan-adı>}"

echo "→ Sistem güncelleniyor ve otomatik güvenlik güncellemeleri açılıyor"
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl ufw unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "→ Güvenlik duvarı: yalnızca SSH, HTTP, HTTPS"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

if ! command -v docker >/dev/null; then
  echo "→ Docker kuruluyor"
  curl -fsSL https://get.docker.com | sh
fi

if [ ! -f .env ]; then
  echo "→ .env oluşturuluyor"
  sed -e "s|^ALAN_ADI=.*|ALAN_ADI=${ALAN}|" \
      -e "s|^N8N_ENCRYPTION_KEY=.*|N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)|" .env.ornek > .env
  chmod 600 .env
  echo "   .env içindeki N8N_ENCRYPTION_KEY'i şifre yöneticine kaydet. Kaybolursa yedekler açılmaz."
fi

echo "→ Günlük yedek (03:00) zamanlanıyor"
echo "0 3 * * * root $(pwd)/yedek.sh >> /var/log/ajans-yedek.log 2>&1" > /etc/cron.d/ajans-yedek

docker compose up -d
echo "✓ Hazır: https://${ALAN} (DNS kaydı bu sunucunun IP'sini göstermeli; HTTPS sertifikası birkaç dakikada alınır)"
