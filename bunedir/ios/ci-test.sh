#!/usr/bin/env bash
# iOS derleme + birim testleri (CI ve yerel Mac). Önce: xcodegen generate
set -euo pipefail
cd "$(dirname "$0")"
DEVICE=$(xcrun simctl list devices available | grep -Eo 'iPhone [0-9]+( Pro)?( Max)? \(' | head -1 | sed 's/ ($//')
[[ -n "$DEVICE" ]] || { echo "iPhone simülatörü bulunamadı"; exit 1; }
echo "Simülatör: $DEVICE"
mkdir -p build
set +e
xcodebuild test -project BuNedir.xcodeproj -scheme BuNedir -destination "platform=iOS Simulator,name=$DEVICE" \
  -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO > build/test.log 2>&1
STATUS=$?
set -e
grep -E "error:|warning: .*Swift|✘|Test .*(passed|failed)|\*\* (TEST|BUILD)" build/test.log | sort -u | head -120 || true
exit $STATUS
