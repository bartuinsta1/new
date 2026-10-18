import { KATEGORILER, type Sistem } from "./tipler.ts";

const OTOMASYON_ETIKETI = { manuel: "Manuel", yari: "Yarı otomatik", tam: "Tam otomatik" } as const;

/** Tanımlardaki hataları döndürür; boş dizi = geçerli. */
export function dogrula(sistemler: Sistem[]): string[] {
  const hatalar: string[] = [];
  const idler = new Set<string>();

  sistemler.forEach((s, i) => {
    const yer = `#${s.no} ${s.id}`;
    if (s.no !== i + 1) hatalar.push(`${yer}: numara sırası bozuk (beklenen ${i + 1})`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) hatalar.push(`${yer}: id kebab-case olmalı`);
    if (idler.has(s.id)) hatalar.push(`${yer}: id tekrarlanıyor`);
    idler.add(s.id);
    if (!(s.kategori in KATEGORILER)) hatalar.push(`${yer}: bilinmeyen kategori ${s.kategori}`);
    for (const alan of ["ad", "adEn", "amac", "sahip"] as const) {
      if (!s[alan].trim()) hatalar.push(`${yer}: ${alan} boş`);
    }
    for (const alan of ["girdiler", "ciktilar", "adimlar", "metrikler", "araclar"] as const) {
      if (s[alan].length === 0) hatalar.push(`${yer}: ${alan} boş olamaz`);
    }
    if (s.bagimliliklar.includes(s.id)) hatalar.push(`${yer}: kendine bağımlı`);
  });

  for (const s of sistemler) {
    for (const b of s.bagimliliklar) {
      if (!idler.has(b)) hatalar.push(`#${s.no} ${s.id}: bilinmeyen bağımlılık ${b}`);
    }
  }
  if (hatalar.length === 0 && kurulumSirasi(sistemler) === null) hatalar.push("Bağımlılıklarda döngü var");
  return hatalar;
}

/**
 * Bağımlılıklara göre kurulum dalgaları: her dalgadaki sistemler, önceki dalgalar kurulduktan sonra
 * paralel kurulabilir. Döngü varsa null.
 */
export function kurulumSirasi(sistemler: Sistem[]): Sistem[][] | null {
  const kurulan = new Set<string>();
  const kalan = [...sistemler];
  const dalgalar: Sistem[][] = [];
  while (kalan.length > 0) {
    const dalga = kalan.filter((s) => s.bagimliliklar.every((b) => kurulan.has(b)));
    if (dalga.length === 0) return null;
    dalga.forEach((s) => kurulan.add(s.id));
    dalgalar.push(dalga);
    for (const s of dalga) kalan.splice(kalan.indexOf(s), 1);
  }
  return dalgalar;
}

/** Bu sisteme bağımlı olan sistemler (bozulursa kimler etkilenir). */
export function bagimlilar(sistemler: Sistem[], id: string): Sistem[] {
  return sistemler.filter((s) => s.bagimliliklar.includes(id));
}

export function bul(sistemler: Sistem[], anahtar: string): Sistem | undefined {
  return sistemler.find((s) => s.id === anahtar || String(s.no) === anahtar);
}

function tetikleyiciMetni(s: Sistem): string {
  const t = s.tetikleyici;
  if (t.tur === "olay") return `Olay: ${t.olay}`;
  if (t.tur === "zamanlama") return `Zamanlama: ${t.ne_zaman}`;
  return `Manuel: ${t.kim}`;
}

export function sistemMarkdown(s: Sistem, tumu: Sistem[]): string {
  const ad = (id: string) => {
    const b = bul(tumu, id);
    return b ? `[#${b.no} ${b.ad}](#${b.no}-${b.id})` : id;
  };
  const besledigi = bagimlilar(tumu, s.id).map((b) => ad(b.id));
  const satirlar = [
    `### <a id="${s.no}-${s.id}"></a>${s.no}. ${s.ad} _(${s.adEn})_`,
    "",
    `> ${s.amac}`,
    "",
    `| | |`,
    `|---|---|`,
    `| **Kategori** | ${KATEGORILER[s.kategori]} |`,
    `| **Sahibi** | ${s.sahip} |`,
    `| **Otomasyon** | ${OTOMASYON_ETIKETI[s.otomasyon]} |`,
    `| **Tetikleyici** | ${tetikleyiciMetni(s)} |`,
    `| **Girdiler** | ${s.girdiler.join(" · ")} |`,
    `| **Çıktılar** | ${s.ciktilar.join(" · ")} |`,
    `| **Araçlar** | ${s.araclar.join(" · ")} |`,
    `| **Dayandığı sistemler** | ${s.bagimliliklar.map(ad).join(" · ") || "—"} |`,
    `| **Beslediği sistemler** | ${besledigi.join(" · ") || "—"} |`,
    "",
    "**Adımlar**",
    "",
    ...s.adimlar.map((a, i) => `${i + 1}. ${a}`),
    "",
    "**Başarı ölçütleri**",
    "",
    ...s.metrikler.map((m) => `- ${m.ad}: **${m.hedef}**`),
    "",
  ];
  return satirlar.join("\n");
}

export function katalogMarkdown(sistemler: Sistem[]): string {
  const dalgalar = kurulumSirasi(sistemler);
  if (!dalgalar) throw new Error("Bağımlılıklarda döngü var");

  const parcalar = [
    "# Sosyal Medya Ajansı — 22 Sistem Kataloğu",
    "",
    "> Bu dosya `npm run katalog` ile `src/sistemler.ts` dosyasından üretilir; elle düzenlemeyin.",
    "",
    "## Özet",
    "",
    "| # | Sistem | Kategori | Sahibi | Otomasyon |",
    "|---|---|---|---|---|",
    ...sistemler.map(
      (s) => `| ${s.no} | [${s.ad}](#${s.no}-${s.id}) | ${KATEGORILER[s.kategori]} | ${s.sahip} | ${OTOMASYON_ETIKETI[s.otomasyon]} |`,
    ),
    "",
    "## Kurulum sırası",
    "",
    "Her dalga, önceki dalgalar kurulduktan sonra paralel kurulabilir.",
    "",
    ...dalgalar.map((d, i) => `${i + 1}. **Dalga ${i + 1}:** ${d.map((s) => `#${s.no} ${s.ad}`).join(", ")}`),
    "",
    "## Bağımlılık haritası",
    "",
    "```mermaid",
    "flowchart LR",
    ...sistemler.map((s) => `  ${s.id.replaceAll("-", "_")}["${s.no}. ${s.ad}"]`),
    ...sistemler.flatMap((s) => s.bagimliliklar.map((b) => `  ${b.replaceAll("-", "_")} --> ${s.id.replaceAll("-", "_")}`)),
    "```",
    "",
  ];

  for (const [anahtar, baslik] of Object.entries(KATEGORILER)) {
    const grup = sistemler.filter((s) => s.kategori === anahtar);
    if (grup.length === 0) continue;
    parcalar.push(`## ${baslik}`, "", ...grup.map((s) => sistemMarkdown(s, sistemler)));
  }
  return parcalar.join("\n");
}
