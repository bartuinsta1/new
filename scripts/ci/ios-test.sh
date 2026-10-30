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
# Özet: derleme hataları ve başarısız testler (CoreData simülatör gürültüsü hariç)
grep -E "error:|\*\* (TEST|BUILD)" "build/$KIND.log" | grep -v "CoreData" | sort -u | head -80 || true
echo "---- Test özeti ----"
xcrun xcresulttool get test-results summary --path "build/$KIND.xcresult" --format json 2>/dev/null > "build/$KIND-summary.json" || true
python3 - "build/$KIND-summary.json" <<'PY' || true
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(0)
print(f"Sonuç: {d.get('result')}  geçen: {d.get('passedTests')}  kalan: {d.get('failedTests')}  atlanan: {d.get('skippedTests')}")
for f in d.get("testFailures", [])[:60]:
    print(f"✘ {f.get('targetName','')}/{f.get('testName','')}: {f.get('failureText','')[:300]}")
PY
exit $STATUS
