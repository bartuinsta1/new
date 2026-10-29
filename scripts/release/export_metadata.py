#!/usr/bin/env python3
"""docs/appstore/metadata-*.md → fastlane/metadata/<dil>/*.txt ve ekran görüntülerini fastlane'e kopyalar.
Tek kaynak docs/appstore: metinler orada düzenlenir, bu betik fastlane'in beklediği dosyaları üretir."""
import pathlib, re, shutil

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "docs/appstore"
OUT = ROOT / "fastlane/metadata"
SHOTS = ROOT / "fastlane/screenshots"

FIELDS = {  # md başlığı → fastlane dosyası
    "Ad": "name.txt", "Name": "name.txt",
    "Alt başlık": "subtitle.txt", "Subtitle": "subtitle.txt",
    "Anahtar kelimeler": "keywords.txt", "Keywords": "keywords.txt",
    "Tanıtım metni": "promotional_text.txt", "Promotional text": "promotional_text.txt",
    "Açıklama": "description.txt", "Description": "description.txt",
    "Yenilikler (1.0)": "release_notes.txt", "What's new (1.0)": "release_notes.txt",
}
LOCALES = {"metadata-tr.md": ["tr"], "metadata-en.md": ["en-GB", "en-US"]}
COMMON = {
    "privacy_url.txt": {"tr": "https://masalcik.app/gizlilik", "en": "https://masalcik.app/en/privacy"},
    "support_url.txt": {"tr": "https://masalcik.app/destek", "en": "https://masalcik.app/en/support"},
    "marketing_url.txt": {"tr": "https://masalcik.app", "en": "https://masalcik.app/en"},
}

def sections(text: str):
    for m in re.finditer(r"^## (.+?)(?: \(\d+\))?\n(.*?)(?=^## |\Z)", text, re.S | re.M):
        yield m.group(1).strip(), re.sub(r"<!--.*?-->", "", m.group(2), flags=re.S).strip()

def main():
    for md, locales in LOCALES.items():
        text = (SRC / md).read_text(encoding="utf-8")
        for loc in locales:
            d = OUT / loc
            d.mkdir(parents=True, exist_ok=True)
            for title, body in sections(text):
                if title in FIELDS:
                    (d / FIELDS[title]).write_text(body + "\n", encoding="utf-8")
            lang = "tr" if loc == "tr" else "en"
            for name, urls in COMMON.items():
                (d / name).write_text(urls[lang] + "\n", encoding="utf-8")
    # Uygulama geneli
    (OUT / "copyright.txt").write_text("2026 Masalcık\n", encoding="utf-8")
    (OUT / "primary_category.txt").write_text("KIDS\n", encoding="utf-8")
    (OUT / "secondary_category.txt").write_text("EDUCATION\n", encoding="utf-8")
    review = OUT / "review_information"
    review.mkdir(exist_ok=True)
    notes = (SRC / "metadata-tr.md").read_text(encoding="utf-8").split("## App Review notları", 1)[1].strip()
    (review / "notes.txt").write_text(notes + "\n", encoding="utf-8")
    # Ekran görüntüleri: 6,9" iPhone (1290×2796 kabul edilir)
    src = SRC / "screenshots"
    if src.exists():
        for loc in ["tr"]:
            d = SHOTS / loc
            d.mkdir(parents=True, exist_ok=True)
            for f in sorted(src.glob(f"{loc}-*.png")):
                shutil.copy(f, d / f"iphone67_{f.name}")
    print(f"fastlane metadata → {OUT.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
