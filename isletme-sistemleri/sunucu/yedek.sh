#!/usr/bin/env bash
# n8n verisinin (iş akışları, bağlantılar, ayarlar) yedeği. Günlük cron ile çalışır; son 14 yedek tutulur.
# İsteğe bağlı: YEDEK_UZAK=gdrive:ajans-yedek tanımlıysa rclone ile sunucu dışına da kopyalar.
set -euo pipefail
cd "$(dirname "$0")"

HEDEF=/root/yedekler
mkdir -p "$HEDEF"
DOSYA="$HEDEF/n8n-$(date +%F-%H%M).tar.gz"
PROJE="$(docker compose config --format json | sed -n 's/.*"name": *"\([^"]*\)".*/\1/p' | head -1)"

docker run --rm -v "${PROJE}_n8n_veri:/veri:ro" -v "$HEDEF:/yedek" alpine \
  tar czf "/yedek/$(basename "$DOSYA")" -C /veri .
cp .env "$HEDEF/env-yedek"
chmod 600 "$HEDEF/env-yedek"

ls -1t "$HEDEF"/n8n-*.tar.gz | tail -n +15 | xargs -r rm --

if [ -n "${YEDEK_UZAK:-}" ] && command -v rclone >/dev/null; then
  rclone copy "$DOSYA" "$YEDEK_UZAK"
fi
echo "✓ Yedek: $DOSYA"
