import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SISTEMLER } from "../src/sistemler.ts";
import { DEPARTMANLAR } from "../src/ekip.ts";
import { dogrulaEkip, ekipMarkdown } from "../src/ekip-katalog.ts";
import { triyaj } from "../src/beyin.ts";

test("ekip tanımı geçerli: sinyal, departman, sistem ve bilgi dosyası bağlantıları", () => {
  assert.deepEqual(dogrulaEkip(SISTEMLER), []);
  assert.equal(DEPARTMANLAR.length, 8);
});

test("rutin DM insan dokunmadan yanıtlanır", () => {
  const s = triyaj({ sinyal: "yorum-ve-dm", metin: "Merhaba, paketleriniz neler?" });
  assert.equal(s.departman, "satis-yaniti");
  assert.deepEqual(s.kesintiler, []);
  assert.equal(s.otomatik, true);
});

test("insan isteyen kişi satış ekibine devredilir", () => {
  const s = triyaj({ sinyal: "satis-aramasi", metin: "Bir yetkiliyle görüşmek istiyorum" });
  assert.equal(triyaj({ sinyal: "yorum-ve-dm", metin: "Gerçek bir kişiyle konuşabilir miyim?" }).devir, "satis-ekibi");
  assert.equal(s.devir, "satis-ekibi");
  assert.deepEqual(s.adimlar, ["triyaj", "yazar", "konusur", "kontrol"]);
});

test("bütçe dolunca ve CPL sıçrayınca reklam durur, sana gelir", () => {
  const s = triyaj({ sinyal: "reklam-performansi", harcama: 5000, butce: 5000, cpl: 90, ortalamaCpl: 50 });
  assert.deepEqual(s.kesintiler.map((k) => k.id), ["butce-limiti", "cpl-sicradi"]);
  assert.equal(s.devir, "sen");
  assert.equal(s.otomatik, false);

  const normal = triyaj({ sinyal: "reklam-performansi", harcama: 1000, butce: 5000, cpl: 55, ortalamaCpl: 50 });
  assert.deepEqual(normal.kesintiler, []);
  assert.equal(normal.otomatik, false, "reklam departmanı her zaman onay ister");
});

test("düşük puanlı değerlendirme ve öfke dalgası yakalanır", () => {
  assert.equal(triyaj({ sinyal: "degerlendirme", puan: 1 }).kesintiler[0]!.id, "dusuk-puan");
  assert.deepEqual(triyaj({ sinyal: "degerlendirme", puan: 5 }).kesintiler, []);
  assert.equal(triyaj({ sinyal: "yorum-ve-dm", olumsuzYorumSonSaat: 8 }).kesintiler[0]!.id, "ofke-yayiliyor");
});

test("büyük anlaşma ve rakip lansmanı insana gider", () => {
  assert.equal(triyaj({ sinyal: "lead-formu", tahminiDeger: 15_000 }).devir, "satis-ekibi");
  assert.equal(triyaj({ sinyal: "rakip-reklamlari", yeniLansman: true }).devir, "sen");
});

test("bilinmeyen sinyal reddedilir", () => {
  assert.throws(() => triyaj({ sinyal: "yok" }), /Bilinmeyen sinyal/);
});

test("EKIP.md güncel", () => {
  const dosya = readFileSync(new URL("../EKIP.md", import.meta.url), "utf8");
  assert.equal(dosya, ekipMarkdown(SISTEMLER), "npm run katalog çalıştırın");
});
