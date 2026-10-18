import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SISTEMLER } from "../src/sistemler.ts";
import { DEPARTMANLAR } from "../src/ekip.ts";
import { ENTEGRASYONLAR, aylikMaliyet, eksikler, gerekenler } from "../src/entegrasyonlar.ts";
import { derle } from "../scripts/site.ts";

test("entegrasyonlar yalnızca var olan sistem ve departmanlara bağlanır", () => {
  const sistemIdleri = new Set(SISTEMLER.map((s) => s.id));
  const depIdleri = new Set(DEPARTMANLAR.map((d) => d.id));
  assert.equal(new Set(ENTEGRASYONLAR.map((e) => e.id)).size, ENTEGRASYONLAR.length);
  for (const e of ENTEGRASYONLAR) {
    for (const s of e.sistemler) assert.ok(sistemIdleri.has(s), `${e.id} → ${s}`);
    for (const d of e.departmanlar) assert.ok(depIdleri.has(d), `${e.id} → ${d}`);
  }
});

test("her sistem ve departman en az bir entegrasyonla canlıya alınabilir", () => {
  for (const id of [...SISTEMLER.map((s) => s.id), ...DEPARTMANLAR.map((d) => d.id)]) {
    assert.ok(gerekenler(id).length > 0, `${id} için entegrasyon yok`);
  }
});

test("hazır olma ve maliyet hesabı", () => {
  assert.deepEqual(eksikler("satis-crm", new Set(["crm"])), []);
  assert.ok(eksikler("yz-randevu-ayarlayici", new Set(["crm"])).length > 0);
  const tum = aylikMaliyet(ENTEGRASYONLAR, 25);
  assert.ok(tum > 1000 && tum < 2500, `25 müşteride tam kurulum ${tum}`);
});

test("site/ derlemesi güncel", () => {
  for (const [yol, icerik] of derle()) {
    assert.equal(readFileSync(new URL(`../${yol}`, import.meta.url), "utf8"), icerik, `${yol} eski — npm run site çalıştırın`);
  }
});
