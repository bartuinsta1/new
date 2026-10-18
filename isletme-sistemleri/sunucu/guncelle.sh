#!/usr/bin/env bash
# Ayda bir: önce yedek, sonra yeni sürüm. Sorun çıkarsa geri-al.sh ile önceki yedeğe dönülür.
set -euo pipefail
cd "$(dirname "$0")"

./yedek.sh
apt-get update -y && apt-get upgrade -y
docker compose pull
docker compose up -d
docker image prune -f

echo "→ n8n açılıyor, kontrol ediliyor…"
for i in $(seq 1 30); do
  if docker compose exec -T n8n wget -qO- http://localhost:5678/healthz >/dev/null 2>&1; then
    echo "✓ Güncelleme tamam, n8n çalışıyor."
    df -h / | tail -1 | awk '{print "  Disk: " $5 " dolu"}'
    exit 0
  fi
  sleep 5
done
echo "✗ n8n 150 saniyede açılmadı. 'docker compose logs n8n' ile bak ya da ./geri-al.sh çalıştır."
exit 1
