// Siteyi derler: src/*.ts → site/src/*.js (tipler silinir, mantık aynen kalır) ve
// site/sayfa.html → site/index.html (kendi sunucunda barındırmak için tam HTML belgesi).
// Böylece site ile komut satırı aynı tanımları ve aynı triyaj kodunu kullanır.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const KOK = new URL("../", import.meta.url);
const MODULLER = ["tipler", "sistemler", "kayit", "ekip", "beyin", "entegrasyonlar"];

export function derle(): Map<string, string> {
  const cikti = new Map<string, string>();
  for (const ad of MODULLER) {
    const kaynak = readFileSync(new URL(`src/${ad}.ts`, KOK), "utf8");
    const js = stripTypeScriptTypes(kaynak).replace(/from "\.\/([a-z-]+)\.ts"/g, 'from "./$1.js"');
    cikti.set(`site/src/${ad}.js`, `// Otomatik üretildi: src/${ad}.ts — elle düzenlemeyin, npm run site çalıştırın.\n${js}`);
  }
  const sayfa = readFileSync(new URL("site/sayfa.html", KOK), "utf8");
  cikti.set(
    "site/index.html",
    `<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${sayfa}</body>\n</html>\n`,
  );
  return cikti;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(new URL("site/src/", KOK), { recursive: true });
  for (const [yol, icerik] of derle()) writeFileSync(new URL(yol, KOK), icerik);
  console.log("site/ derlendi");
}
