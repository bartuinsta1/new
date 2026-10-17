#!/usr/bin/env python3
"""App Store metin sınırlarını denetler: python3 scripts/check_appstore.py"""
import re, sys, pathlib
LIMITS = {"Ad": 30, "Name": 30, "Alt başlık": 30, "Subtitle": 30, "Anahtar kelimeler": 100, "Keywords": 100,
          "Tanıtım metni": 170, "Promotional text": 170, "Açıklama": 4000, "Description": 4000}
ok = True
for f in sorted(pathlib.Path(__file__).resolve().parent.parent.glob("docs/appstore/metadata-*.md")):
    text = f.read_text(encoding="utf-8")
    for m in re.finditer(r"^## (.+?)(?: \(\d+\))?\n(.*?)(?=^## |\Z)", text, re.S | re.M):
        name, body = m.group(1).strip(), re.sub(r"<!--.*?-->", "", m.group(2), flags=re.S).strip()
        if name not in LIMITS: continue
        n, limit = len(body), LIMITS[name]
        status = "✓" if n <= limit else "✗ SINIR AŞILDI"
        if n > limit: ok = False
        if name in ("Anahtar kelimeler", "Keywords") and ", " in body:
            ok = False; status += " (virgülden sonra boşluk olmamalı)"
        print(f"{f.name:18} {name:20} {n:5}/{limit:<5} {status}")
sys.exit(0 if ok else 1)
