#!/usr/bin/env bash
# iOS simülatöründe duman testi: kurulu en eski ve en yeni iOS sürümlerinde aç, oyun hazır mı bak.
# Kullanım: scripts/ios-smoke.sh <App.app yolu> [çıktı klasörü]
set -euo pipefail
APP=$1
OUT=${2:-smoke}
BUNDLE=com.mirnavhani.game
mkdir -p "$OUT"

# en eski ve en yeni iOS çalışma zamanı + destekledikleri bir iPhone modeli
PAIRS=$(xcrun simctl list -j runtimes | python3 -c '
import json, sys
rts = [r for r in json.load(sys.stdin)["runtimes"] if r["platform"] == "iOS" and r["isAvailable"]]
rts.sort(key=lambda r: [int(x) for x in r["version"].split(".")])
pick = [rts[0], rts[-1]] if len(rts) > 1 else rts
for r in pick:
    phones = [d for d in r["supportedDeviceTypes"] if d["productFamily"] == "iPhone"]
    print(r["identifier"], phones[0]["identifier"], r["version"])
')

FAIL=0
while read -r RUNTIME DEVTYPE VERSION; do
  [ -n "$RUNTIME" ] || continue
  UDID=$(xcrun simctl create "smoke-$VERSION" "$DEVTYPE" "$RUNTIME")
  xcrun simctl boot "$UDID"
  xcrun simctl bootstatus "$UDID" -b >/dev/null
  xcrun simctl install "$UDID" "$APP"
  xcrun simctl launch --console-pty "$UDID" "$BUNDLE" > "$OUT/ios-$VERSION.log" 2>&1 &
  sleep 30
  xcrun simctl io "$UDID" screenshot "$OUT/ios-$VERSION.png" >/dev/null
  if xcrun simctl spawn "$UDID" launchctl list | grep -q "$BUNDLE" && grep -q "MH_READY" "$OUT/ios-$VERSION.log"; then
    echo "iOS $VERSION: oyun açıldı ✓"
  else
    echo "HATA: iOS $VERSION'da oyun açılmadı"; tail -40 "$OUT/ios-$VERSION.log"; FAIL=1
  fi
  if grep -iE "\[error\]|Uncaught" "$OUT/ios-$VERSION.log"; then echo "HATA: iOS $VERSION JavaScript hatası"; FAIL=1; fi
  xcrun simctl shutdown "$UDID" || true
  xcrun simctl delete "$UDID" || true
done <<< "$PAIRS"
exit $FAIL
