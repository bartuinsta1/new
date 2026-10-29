#!/usr/bin/env bash
# Android emülatöründe duman testi: kur, aç, çökme/JS hatası yok, oyun hazır.
# Kullanım: scripts/android-smoke.sh <api> <apk> [çıktı klasörü]
set -euo pipefail
API=$1
APK=$2
OUT=${3:-smoke}
PKG=com.mirnavhani.game
mkdir -p "$OUT"

adb install -r "$APK"
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity"
sleep 25

PID=$(adb shell pidof "$PKG" || true)
adb exec-out screencap -p > "$OUT/android-api$API.png"
adb logcat -d > "$OUT/logcat-api$API.txt"
WEBVIEW=$(adb shell dumpsys package com.google.android.webview | grep -m1 versionName || true)
echo "API $API · WebView: $WEBVIEW"

[ -n "$PID" ] || { echo "HATA: uygulama çalışmıyor"; exit 1; }
if grep -q "FATAL EXCEPTION" "$OUT/logcat-api$API.txt"; then
  grep -A20 "FATAL EXCEPTION" "$OUT/logcat-api$API.txt"; echo "HATA: çökme"; exit 1
fi
# Yakalanmamış hata (istisna ya da reddedilen söz) oyunun kendi sorunudur: testi düşürür.
if grep -E "Capacitor/Console.*Uncaught" "$OUT/logcat-api$API.txt"; then echo "HATA: yakalanmamış JavaScript hatası"; exit 1; fi
grep -q "MH_READY" "$OUT/logcat-api$API.txt" || { echo "HATA: oyun açılmadı (MH_READY yok)"; exit 1; }
# Diğer konsol hataları uyarıdır: Capacitor'ın erken güvenli alan enjeksiyonu ve emülatörde
# Play Store olmadığı için faturalandırmanın reddi beklenen durumlar (oyun bunları yakalıyor).
if grep -E " E Capacitor/Console" "$OUT/logcat-api$API.txt" > "$OUT/console-errors-api$API.txt"; then
  echo "UYARI: konsol hataları (testi düşürmez):"; cat "$OUT/console-errors-api$API.txt"
fi
echo "--- faturalandırma / eklenti günlüğü ---"
grep -iE "NativePurchases|BillingClient|billing" "$OUT/logcat-api$API.txt" | tail -15 || true
echo "API $API: oyun açıldı ✓"
