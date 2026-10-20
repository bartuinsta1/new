import { ENTEGRASYONLAR, GRUPLAR, secenek, type Secenek } from "./entegrasyonlar.ts";

// Her yuvanın gereklilikleri ve üç seçeneği (standart / ekonomik / alternatif), 10 marka için aylık maliyetle.
const ORNEK_MARKA = 10;
const tutar = (s: Secenek) => {
  const t = s.sabit + s.musteriBasi * ORNEK_MARKA;
  return t ? `$${Math.round(t)}` : "Ücretsiz";
};

export function araclarMarkdown(): string {
  const satirlar = [
    "# Araçlar ve alternatifleri",
    "",
    "> Bu dosya `npm run katalog` ile `src/entegrasyonlar.ts` dosyasından üretilir; elle düzenlemeyin.",
    "",
    `Her araç için üç seçenek vardır; hepsi o işin gerekliliklerini karşılar. Fiyatlar ${ORNEK_MARKA} marka için`,
    "aylık yaklaşık değerdir; abone olmadan önce sağlayıcının sayfasından kontrol edin.",
    "",
  ];
  for (const [g, baslik] of Object.entries(GRUPLAR)) {
    satirlar.push(`## ${baslik}`, "");
    for (const e of ENTEGRASYONLAR.filter((x) => x.grup === g)) {
      satirlar.push(
        `### ${e.ad}`,
        "",
        `**Gereklilikler:** ${e.gereksinimler.join(" · ")}`,
        "",
        "| Seçenek | Sağlayıcı | Aylık | Not |",
        "|---|---|---|---|",
        ...(["standart", "ekonomik", "alternatif"] as const).map((k) => {
          const s = secenek(e, k);
          return `| ${k[0].toUpperCase() + k.slice(1)} | ${s.saglayici} | ${tutar(s)} | ${s.not || "—"} |`;
        }),
        "",
      );
    }
  }
  return satirlar.join("\n");
}
