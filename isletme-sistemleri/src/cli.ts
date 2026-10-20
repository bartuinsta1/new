import { writeFileSync } from "node:fs";
import { SISTEMLER } from "./sistemler.ts";
import { KATEGORILER } from "./tipler.ts";
import { bagimlilar, bul, dogrula, katalogMarkdown, kurulumSirasi, sistemMarkdown } from "./kayit.ts";
import { dogrulaEkip, ekipMarkdown } from "./ekip-katalog.ts";
import { araclarMarkdown } from "./araclar-katalog.ts";
import { triyaj } from "./beyin.ts";

const [komut = "liste", arg] = process.argv.slice(2);

const hatalar = [...dogrula(SISTEMLER), ...dogrulaEkip(SISTEMLER)];
if (hatalar.length > 0) {
  console.error("Sistem tanımlarında hata var:\n" + hatalar.map((h) => `  - ${h}`).join("\n"));
  process.exit(1);
}

switch (komut) {
  case "liste": {
    for (const [anahtar, baslik] of Object.entries(KATEGORILER)) {
      console.log(`\n${baslik}`);
      for (const s of SISTEMLER.filter((s) => s.kategori === anahtar)) {
        console.log(`  ${String(s.no).padStart(2)}. ${s.ad}  (${s.id})`);
      }
    }
    break;
  }
  case "goster": {
    const s = arg ? bul(SISTEMLER, arg) : undefined;
    if (!s) {
      console.error("Kullanım: npm run goster -- <no|id>");
      process.exit(1);
    }
    console.log(sistemMarkdown(s, SISTEMLER));
    break;
  }
  case "kurulum": {
    kurulumSirasi(SISTEMLER)!.forEach((dalga, i) => {
      console.log(`\nDalga ${i + 1}`);
      for (const s of dalga) console.log(`  ${String(s.no).padStart(2)}. ${s.ad}`);
    });
    break;
  }
  case "etki": {
    const s = arg ? bul(SISTEMLER, arg) : undefined;
    if (!s) {
      console.error("Kullanım: npm run etki -- <no|id>");
      process.exit(1);
    }
    // Bu sistem durursa zincirleme etkilenen her şey
    const etkilenen = new Map<string, number>();
    const kuyruk = [s.id];
    while (kuyruk.length > 0) {
      for (const b of bagimlilar(SISTEMLER, kuyruk.shift()!)) {
        if (!etkilenen.has(b.id)) {
          etkilenen.set(b.id, b.no);
          kuyruk.push(b.id);
        }
      }
    }
    console.log(`#${s.no} ${s.ad} durursa etkilenenler (${etkilenen.size}):`);
    for (const id of etkilenen.keys()) console.log(`  - #${bul(SISTEMLER, id)!.no} ${bul(SISTEMLER, id)!.ad}`);
    break;
  }
  case "katalog": {
    const yol = new URL("../KATALOG.md", import.meta.url);
    writeFileSync(yol, katalogMarkdown(SISTEMLER));
    writeFileSync(new URL("../EKIP.md", import.meta.url), ekipMarkdown(SISTEMLER));
    writeFileSync(new URL("../ARACLAR.md", import.meta.url), araclarMarkdown());
    console.log(`KATALOG.md, EKIP.md ve ARACLAR.md yazıldı (${SISTEMLER.length} sistem)`);
    break;
  }
  case "triyaj": {
    if (!arg) {
      console.error(`Kullanım: npm run triyaj -- '{"sinyal":"yorum-ve-dm","metin":"Fiyat nedir?"}'`);
      process.exit(1);
    }
    console.log(JSON.stringify(triyaj(JSON.parse(arg)), null, 2));
    break;
  }
  default:
    console.error("Komutlar: liste | goster <no|id> | kurulum | etki <no|id> | katalog | triyaj <json>");
    process.exit(1);
}
