# Sözlük kaynak dosyaları

Her satır: `kelime | köken | anlam | tetikleyiciler`

- **anlam** ≤ 120 karakter.
- **tetikleyiciler** (isteğe bağlı, virgülle): klavyenin "buna X denir" demesi için Türkçe kök/ifadeler.
  Kelimenin başı eşleşir: `özle` → özledim, özlüyorum değil (ü), özlem. En az 3 harf. Çok kelimeli olabilir: `içim burkul`.
- `#` ile başlayan satırlar yorumdur.

`node scripts/build-dictionary.mjs` bu dosyaları + `words.json`'daki 50 bölümü birleştirip `content/dictionary.json` üretir.
