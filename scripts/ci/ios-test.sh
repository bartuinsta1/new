#!/usr/bin/env bash
# iOS derleme ve testleri (CI ve yerel Mac). Kullanım: scripts/ci/ios-test.sh unit|ui
# Simülatör: kurulu ilk iPhone (Xcode sürümüne göre değişir). Snapshot testleri CI'da atlanır: referans görseller
# tek bir simülatörde kaydedilir ve commit'lenir (bkz. docs/kalite.md).
set -euo pipefail
cd "$(dirname "$0")/../.."
KIND="${1:-unit}"
DEVICE=$(xcrun simctl list devices available | grep -Eo 'iPhone [0-9]+( Pro)?( Max)? \(' | head -1 | sed 's/ ($//')
[[ -n "$DEVICE" ]] || { echo "iPhone simülatörü bulunamadı"; xcrun simctl list devices available; exit 1; }
echo "Simülatör: $DEVICE"
mkdir -p build
ARGS=(-project Masalcik.xcodeproj -scheme Masalcik -destination "platform=iOS Simulator,name=$DEVICE"
      -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO)
if [[ "$KIND" == "unit" ]]; then
  SEL=(-only-testing:MasalcikTests -skip-testing:MasalcikTests/SnapshotTests)
else
  SEL=(-only-testing:MasalcikUITests)
fi
set +e
xcodebuild test "${ARGS[@]}" "${SEL[@]}" -resultBundlePath "build/$KIND.xcresult" > "build/$KIND.log" 2>&1
STATUS=$?
set -e
# Özet: derleme hataları, başarısız testler ve sonuç satırı
grep -E "error:|✘|failed|Failing tests|\*\* (TEST|BUILD)" "build/$KIND.log" | head -300 || true
tail -5 "build/$KIND.log"
exit $STATUS
