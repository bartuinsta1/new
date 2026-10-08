#!/usr/bin/env python3
"""Swift kaynaklarındaki yerelleştirilebilir metinleri Localizable.xcstrings'e ekler.
Xcode derleme sırasında da otomatik çıkarım yapar (SWIFT_EMIT_LOC_STRINGS); bu betik,
katalogun Xcode açılmadan da eksiksiz ve gözden geçirilebilir olmasını sağlar.
Kullanım: python3 scripts/extract_strings.py
"""
import json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "Masalcik"
CATALOG = SRC / "Resources" / "Localizable.xcstrings"

# Interpolasyonları format belirteçlerine çevir (Int → %lld, diğerleri → %@).
INT_HINTS = ("minutes", "durationMinutes", "filled", "total", "count")

def to_key(lit: str) -> str:
    def repl(m):
        expr = m.group(1)
        return "%lld" if any(h in expr for h in INT_HINTS) else "%@"
    return re.sub(r"\\\(([^()]*(?:\([^()]*\)[^()]*)*)\)", repl, lit)

PATTERNS = [
    r'String\(localized:\s*"((?:[^"\\]|\\.)*)"',
    r'\bText\("((?:[^"\\]|\\.)*)"\)',
    r'BubbleButton\("((?:[^"\\]|\\.)*)"',
    r'accessibilityLabel:\s*"((?:[^"\\]|\\.)*)"',
    r'\bsection\("((?:[^"\\]|\\.)*)"',
    r'\bPicker\("((?:[^"\\]|\\.)*)"',
]

keys = set()
for f in SRC.rglob("*.swift"):
    text = f.read_text(encoding="utf-8")
    for p in PATTERNS:
        for m in re.finditer(p, text):
            lit = m.group(1)
            if lit.strip():
                keys.add(to_key(lit).replace('\\"', '"'))

existing = {"sourceLanguage": "tr", "strings": {}, "version": "1.0"}
if CATALOG.exists():
    existing = json.loads(CATALOG.read_text(encoding="utf-8"))
for k in sorted(keys):
    existing["strings"].setdefault(k, {})
existing["strings"] = dict(sorted(existing["strings"].items()))
CATALOG.write_text(json.dumps(existing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"{len(keys)} anahtar, katalogda toplam {len(existing['strings'])}")
