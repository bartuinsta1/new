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
if grep -E " E Capacitor/Console" "$OUT/logcat-api$API.txt"; then echo "HATA: JavaScript hatası"; exit 1; fi
grep -q "MH_READY" "$OUT/logcat-api$API.txt" || { echo "HATA: oyun açılmadı (MH_READY yok)"; exit 1; }
echo "API $API: oyun açıldı ✓"
