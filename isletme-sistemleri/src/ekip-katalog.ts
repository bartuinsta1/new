import { existsSync } from "node:fs";
import { BEYIN, DEPARTMANLAR, GOZLEM, INSAN_DEVRI, ISLETME_GIRDILERI, KAYIT_SISTEMI, SINYALLER } from "./ekip.ts";
import { KESINTILER } from "./beyin.ts";
import type { Sistem } from "./tipler.ts";

const BILGI_DIZINI = new URL("../bilgi/", import.meta.url);

/** Ekip tanımındaki hatalar; boş dizi = geçerli. */
export function dogrulaEkip(sistemler: Sistem[]): string[] {
  const hatalar: string[] = [];
  const depIdleri = new Set(DEPARTMANLAR.map((d) => d.id));
  const sistemIdleri = new Set(sistemler.map((s) => s.id));

  for (const s of SINYALLER) {
    if (!depIdleri.has(s.departman)) hatalar.push(`Sinyal ${s.id}: bilinmeyen departman ${s.departman}`);
  }
  for (const d of DEPARTMANLAR) {
    if (!SINYALLER.some((s) => s.departman === d.id)) hatalar.push(`Departman ${d.id}: hiçbir sinyal yönlenmiyor`);
    for (const id of d.sistemler) {
      if (!sistemIdleri.has(id)) hatalar.push(`Departman ${d.id}: bilinmeyen sistem ${id}`);
    }
    for (const dosya of d.bilgi) {
      if (!existsSync(new URL(dosya, BILGI_DIZINI))) hatalar.push(`Departman ${d.id}: bilgi/${dosya} yok`);
    }
  }
  return hatalar;
}

export function ekipMarkdown(sistemler: Sistem[]): string {
  const sistemAdi = (id: string) => {
    const s = sistemler.find((x) => x.id === id)!;
    return `[#${s.no} ${s.ad}](KATALOG.md#${s.no}-${s.id})`;
  };
  const dep = (id: string) => DEPARTMANLAR.find((d) => d.id === id)!.ad;
  const kimAdi = { sen: "Sen", "satis-ekibi": "Satış ekibi" } as const;
  const nid = (id: string) => id.replaceAll("-", "_");

  return [
    "# Yapay Zekâ Sosyal Medya Ekibi",
    "",
    "> Bu dosya `npm run katalog` ile `src/ekip.ts` ve `src/beyin.ts` dosyalarından üretilir; elle düzenlemeyin.",
    "",
    "**Claude yazar, kurallar karar verir, ElevenLabs konuşur, sen yalnızca onaylarsın.**",
    "",
    "## Akış",
    "",
    "```mermaid",
    "flowchart TB",
    `  subgraph S["01 · Sinyaller"]`,
    ...SINYALLER.map((s) => `    sin_${nid(s.id)}["${s.ad}"]`),
    "  end",
    `  subgraph K["02 · Kayıt sistemi + 04 · İşletme girdileri"]`,
    ...KAYIT_SISTEMI.map((k) => `    kay_${nid(k.id)}["${k.ad}"]`),
    ...ISLETME_GIRDILERI.map((g) => `    gir_${nid(g.id)}["${g.ad}"]`),
    "  end",
    `  subgraph B["03 · Beyin — Büyüme Direktörü"]`,
    `    ${BEYIN.map((b) => `bey_${nid(b.id)}["${b.ad}"]`).join(" --> ")}`,
    "  end",
    `  subgraph D["05 · Departmanlar"]`,
    ...DEPARTMANLAR.map((d) => `    dep_${nid(d.id)}["${d.ad}"]`),
    "  end",
    `  subgraph G["06 · Veri ve gözlem"]`,
    ...GOZLEM.map((g) => `    goz_${nid(g.id)}["${g.ad}"]`),
    "  end",
    `  subgraph I["07 · İnsana devir"]`,
    ...INSAN_DEVRI.map((h) => `    ins_${nid(h.id)}["${h.ad}"]`),
    "  end",
    `  BL[("Bilgi katmanı · bilgi/*.md")]`,
    `  KS{{"Döngüyü kesen durumlar"}}`,
    "  S --> B",
    "  K --> B",
    "  BL --> B",
    "  B --> D",
    "  D --> G",
    "  G --> B",
    "  D -. onay .-> I",
    "  KS -. durdur .-> I",
    "```",
    "",
    "## 01 · Sinyaller",
    "",
    "| Sinyal | Kaynaklar | Yönlendiği departman |",
    "|---|---|---|",
    ...SINYALLER.map((s) => `| ${s.ad} (\`${s.id}\`) | ${s.kaynaklar.join(", ")} | ${dep(s.departman)} |`),
    "",
    "## 02 · Kayıt sistemi",
    "",
    ...KAYIT_SISTEMI.map((k) => `- **${k.ad}** — ${k.araclar.join(", ")}`),
    "",
    "## 04 · İşletme girdileri",
    "",
    ...ISLETME_GIRDILERI.map((g) => `- **${g.ad}** — ${g.aciklama}`),
    "",
    "## 03 · Beyin",
    "",
    "| Rol | Görev | Araç |",
    "|---|---|---|",
    ...BEYIN.map((b) => `| ${b.ad} | ${b.gorev} | ${b.arac} |`),
    "",
    "## 05 · Departmanlar",
    "",
    ...DEPARTMANLAR.flatMap((d) => [
      `### ${d.ad}`,
      "",
      `> ${d.gorev}`,
      "",
      ...d.yapar.map((y) => `- ${y}`),
      "",
      `- **Araçlar:** ${d.araclar.join(", ")}`,
      `- **Okuduğu bilgi:** ${d.bilgi.map((b) => `[${b}](bilgi/${b})`).join(", ")}`,
      `- **İnsan onayı:** ${d.insanOnayi ? "Evet — yayından/gönderimden önce" : "Hayır — kurallar içinde kendi çalışır"}`,
      `- **Çalıştırdığı sistemler:** ${d.sistemler.map(sistemAdi).join(", ")}`,
      "",
    ]),
    "## 06 · Veri ve gözlem",
    "",
    "| Metrik | Cevapladığı soru | Hedef |",
    "|---|---|---|",
    ...GOZLEM.map((g) => `| ${g.ad} | ${g.soru} | ${g.hedef} |`),
    "",
    "## 07 · İnsana devir",
    "",
    ...INSAN_DEVRI.map((h) => `- **${h.ad}** (${h.kanal}) — ${h.aciklama}`),
    "",
    "## Döngüyü kesen durumlar",
    "",
    "Triyaj bunlardan birini görürse otomatik akış durur ve iş insana geçer (`src/beyin.ts`).",
    "",
    "| Durum | Ne yapılır | Kime |",
    "|---|---|---|",
    ...KESINTILER.map((k) => `| ${k.ad} | ${k.eylem} | ${kimAdi[k.kime]} |`),
    "",
  ].join("\n");
}
