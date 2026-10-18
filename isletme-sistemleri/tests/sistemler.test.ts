import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SISTEMLER } from "../src/sistemler.ts";
import { bagimlilar, dogrula, katalogMarkdown, kurulumSirasi } from "../src/kayit.ts";
import type { Sistem } from "../src/tipler.ts";

test("22 sistemin tamamı tanımlı ve geçerli", () => {
  assert.equal(SISTEMLER.length, 22);
  assert.deepEqual(dogrula(SISTEMLER), []);
});

test("kurulum sırası her sistemi bağımlılıklarından sonra kurar", () => {
  const dalgalar = kurulumSirasi(SISTEMLER)!;
  assert.equal(dalgalar.flat().length, 22);
  const sira = new Map(dalgalar.flatMap((d, i) => d.map((s) => [s.id, i] as const)));
  for (const s of SISTEMLER) {
    for (const b of s.bagimliliklar) assert.ok(sira.get(b)! < sira.get(s.id)!, `${b} → ${s.id}`);
  }
});

test("döngü ve bilinmeyen bağımlılık yakalanır", () => {
  const kopya: Sistem[] = structuredClone(SISTEMLER);
  kopya[12]!.bagimliliklar = ["yz-genel-mudur-yardimcisi"]; // satis-crm → ... → satis-crm
  assert.ok(dogrula(kopya).includes("Bağımlılıklarda döngü var"));

  const kopya2: Sistem[] = structuredClone(SISTEMLER);
  kopya2[0]!.bagimliliklar = ["yok-boyle-bir-sistem"];
  assert.match(dogrula(kopya2)[0]!, /bilinmeyen bağımlılık/);
});

test("CRM, satış ve onboarding'in temelidir", () => {
  const ids = bagimlilar(SISTEMLER, "satis-crm").map((s) => s.id);
  assert.ok(ids.includes("onboarding-akisi"));
  assert.ok(ids.includes("yz-randevu-ayarlayici"));
});

test("KATALOG.md güncel", () => {
  const dosya = readFileSync(new URL("../KATALOG.md", import.meta.url), "utf8");
  assert.equal(dosya, katalogMarkdown(SISTEMLER), "npm run katalog çalıştırın");
});
