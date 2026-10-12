#!/usr/bin/env python3
"""Swift kaynaklarındaki yerelleştirilebilir metinleri Localizable.xcstrings'e ekler ve
scripts/translations/<dil>.json'daki çevirileri işler. Kaynak dil Türkçe; desteklenen diller: tr, en.
Xcode derleme sırasında da otomatik çıkarım yapar (SWIFT_EMIT_LOC_STRINGS); bu betik,
katalogun Xcode açılmadan da eksiksiz ve gözden geçirilebilir olmasını sağlar.
Kullanım: python3 scripts/extract_strings.py [--check]
  --check: eksik ya da kullanılmayan çeviri varsa hata koduyla çıkar (CI için).
"""
import json, re, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "Masalcik"
CATALOG = SRC / "Resources" / "Localizable.xcstrings"

# Interpolasyonları format belirteçlerine çevir (Int → %lld, diğerleri → %@).
# Tam eşleşme: interpolasyondaki ifade bunlardan biriyse tamsayıdır.
INT_EXPRS = {"minutes", "durationMinutes", "filled", "total", "count", "current", "i + 1", "n", "age", "week", "toGo", "f.appearances", "child.age", "child.stories.count",
             "family.expectedChildCount", "AppConfig.maxChildProfiles", "AppConfig.maxInterests", "story.durationMinutes",
             "d.rawValue", "m", "days"}

def to_key(lit: str) -> str:
    def repl(m):
        expr = m.group(1).strip()
        return "%lld" if expr in INT_EXPRS else "%@"
    return re.sub(r"\\\(([^()]*(?:\([^()]*\)[^()]*)*)\)", repl, lit)

PATTERNS = [
    r'String\(localized:\s*"((?:[^"\\]|\\.)*)"',
    r'\bText\("((?:[^"\\]|\\.)*)"\)',
    r'BubbleButton\("((?:[^"\\]|\\.)*)"',
    r'accessibilityLabel:\s*"((?:[^"\\]|\\.)*)"',
    r'\bsection\("((?:[^"\\]|\\.)*)"',
    r'\bPicker\("((?:[^"\\]|\\.)*)"',
    r'\bTextField\("((?:[^"\\]|\\.)*)"',
    r'\bDatePicker\("((?:[^"\\]|\\.)*)"',
    r'\bOnboardingHeader\(title:\s*"((?:[^"\\]|\\.)*)"',
    r'\b(?:subtitle|primaryTitle|secondaryTitle):\s*"((?:[^"\\]|\\.)*)"',
    r'LocalizedStringKey\??\s*=\s*"((?:[^"\\]|\\.)*)"',
    r'\b(?:Label|Button|Toggle|Section|Link|ContentUnavailableView|LabeledContent)\("((?:[^"\\]|\\.)*)"',
    r'\.(?:confirmationDialog|navigationTitle|alert)\("((?:[^"\\]|\\.)*)"',
]

keys = set()
for f in SRC.rglob("*.swift"):
    # Yorum satırlarını atla (/// ve // içindeki örnek kodlar anahtar değildir).
    text = "\n".join(l for l in f.read_text(encoding="utf-8").splitlines() if not l.lstrip().startswith("//"))
    for p in PATTERNS:
        for m in re.finditer(p, text):
            lit = m.group(1)
            if lit.strip():
                keys.add(to_key(lit).replace('\\"', '"'))

TRANSLATIONS = {
    lang: json.loads((ROOT / "scripts" / "translations" / f"{lang}.json").read_text(encoding="utf-8"))
    for lang in ("en",)
}

def unit(value) -> dict:
    """Düz çeviri ya da çoğul biçimler: {"one": "...", "other": "..."} → String Catalog plural varyasyonu."""
    if isinstance(value, dict):
        return {"variations": {"plural": {k: {"stringUnit": {"state": "translated", "value": v}} for k, v in value.items()}}}
    return {"stringUnit": {"state": "translated", "value": value}}

# Katalog her seferinde koddan yeniden üretilir: koddan silinen anahtar katalogda kalmaz.
catalog = {"sourceLanguage": "tr", "strings": {}, "version": "1.0"}
missing = {lang: [] for lang in TRANSLATIONS}
for k in sorted(keys):
    entry = {"localizations": {"tr": unit(k)}}
    for lang, table in TRANSLATIONS.items():
        if k in table:
            entry["localizations"][lang] = unit(table[k])
        else:
            missing[lang].append(k)
    catalog["strings"][k] = entry
CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

unused = {lang: sorted(set(t) - keys) for lang, t in TRANSLATIONS.items()}
print(f"{len(keys)} anahtar")
problems = False
for lang in TRANSLATIONS:
    if missing[lang]:
        problems = True
        print(f"[{lang}] EKSİK çeviri ({len(missing[lang])}):", *missing[lang], sep="\n  ")
    if unused[lang]:
        print(f"[{lang}] kullanılmayan çeviri ({len(unused[lang])}):", *unused[lang], sep="\n  ")
    if not missing[lang]:
        print(f"[{lang}] tam ✓")
if "--check" in sys.argv and (problems or any(unused.values())):
    sys.exit(1)
