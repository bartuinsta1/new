#!/usr/bin/env bash
# iOS simülatöründe duman testi: kurulu en eski ve en yeni iOS sürümlerinde aç, oyun hazır mı bak.
# Kullanım: scripts/ios-smoke.sh <App.app yolu> [çıktı klasörü]
set -euo pipefail
APP=$1
OUT=${2:-smoke}
BUNDLE=com.mirnavhani.game
mkdir -p "$OUT"

# en eski ve en yeni iOS çalışma zamanı + destekledikleri bir iPhone modeli
PAIRS=()
while IFS= read -r line; do PAIRS+=("$line"); done < <(xcrun simctl list -j runtimes | python3 -c '
import json, sys
rts = [r for r in json.load(sys.stdin)["runtimes"] if r["platform"] == "iOS" and r["isAvailable"]]
rts.sort(key=lambda r: [int(x) for x in r["version"].split(".")])
pick = [rts[0], rts[-1]] if len(rts) > 1 else rts
for r in pick:
    phones = [d for d in r["supportedDeviceTypes"] if d["productFamily"] == "iPhone"]
    print(r["identifier"], phones[0]["identifier"], r["version"])
')
echo "Denenecek iOS sürümleri: ${#PAIRS[@]}"

FAIL=0
for pair in "${PAIRS[@]}"; do
  read -r RUNTIME DEVTYPE VERSION <<< "$pair"
  echo "== iOS $VERSION ($DEVTYPE)"
  UDID=$(xcrun simctl create "smoke-$VERSION" "$DEVTYPE" "$RUNTIME" < /dev/null)
  xcrun simctl boot "$UDID" < /dev/null
  xcrun simctl bootstatus "$UDID" -b < /dev/null > /dev/null
  xcrun simctl install "$UDID" "$APP" < /dev/null
  # uygulamanın standart çıktısı (Capacitor konsol satırları) dosyaya; tamponsuz yazsın
  SIMCTL_CHILD_NSUnbufferedIO=YES xcrun simctl launch --stdout="$PWD/$OUT/ios-$VERSION.log" --stderr="$PWD/$OUT/ios-$VERSION.err" "$UDID" "$BUNDLE" < /dev/null
  # Oyun JavaScript'i çalışıyorsa her 5 sn'de kaydını WebView yerel deposuna yazar: oradan doğrula.
  DATA=$(xcrun simctl get_app_container "$UDID" "$BUNDLE" data < /dev/null)
  SAVED=""
  for _ in $(seq 1 30); do
    if grep -q "MH_READY" "$OUT/ios-$VERSION.log" 2>/dev/null; then SAVED="konsol"; break; fi
    for db in $(find "$DATA" -name "*.sqlite3" -path "*LocalStorage*" 2>/dev/null); do
      if sqlite3 "$db" "select key from ItemTable" 2>/dev/null | grep -q "mirnav-hani-v1"; then SAVED="kayıt"; fi
    done
    [ -n "$SAVED" ] && break
    sleep 2
  done
  sleep 3
  xcrun simctl io "$UDID" screenshot "$OUT/ios-$VERSION.png" < /dev/null > /dev/null || true
  if xcrun simctl spawn "$UDID" launchctl list < /dev/null | grep -q "$BUNDLE" && [ -n "$SAVED" ]; then
    echo "iOS $VERSION: oyun JavaScript'i çalışıyor (kanıt: $SAVED)"
    echo "iOS $VERSION: oyun açıldı ✓"
  else
    echo "HATA: iOS $VERSION'da oyun açılmadı"; tail -40 "$OUT/ios-$VERSION.log" "$OUT/ios-$VERSION.err" || true
    find "$DATA" -path "*WebKit*" 2>/dev/null | head -20; FAIL=1
  fi
  if grep -E "Uncaught" "$OUT/ios-$VERSION.log"; then echo "HATA: iOS $VERSION yakalanmamış JavaScript hatası"; FAIL=1; fi
  if grep -iE "\[error\]" "$OUT/ios-$VERSION.log"; then echo "UYARI: iOS $VERSION konsol hataları (testi düşürmez)"; fi
  xcrun simctl shutdown "$UDID" < /dev/null || true
  xcrun simctl delete "$UDID" < /dev/null || true
done
exit $FAIL
