#!/usr/bin/env bash
# En son yedeği (ya da verilen dosyayı) geri yükler: sudo ./geri-al.sh [/root/yedekler/n8n-....tar.gz]
set -euo pipefail
cd "$(dirname "$0")"

DOSYA="${1:-$(ls -1t /root/yedekler/n8n-*.tar.gz | head -1)}"
PROJE="$(docker compose config --format json | sed -n 's/.*"name": *"\([^"]*\)".*/\1/p' | head -1)"
echo "→ Geri yükleniyor: $DOSYA"

docker compose stop n8n
docker run --rm -v "${PROJE}_n8n_veri:/veri" -v "$(dirname "$DOSYA"):/yedek:ro" alpine \
  sh -c "rm -rf /veri/* /veri/.[!.]* 2>/dev/null; tar xzf /yedek/$(basename "$DOSYA") -C /veri"
docker compose up -d
echo "✓ Geri yüklendi. Sürüm sorunu varsa .env içinde N8N_SURUM'u önceki sürüme sabitle ve 'docker compose up -d' çalıştır."
