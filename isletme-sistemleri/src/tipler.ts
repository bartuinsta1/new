// Bir işletme sisteminin tanımı. Her sistem: neden var, ne zaman çalışır, neyi alıp neyi üretir,
// başarısı nasıl ölçülür ve hangi sistemlere dayanır.

export const KATEGORILER = {
  musteri: "Müşteri Deneyimi",
  onboarding: "Onboarding",
  operasyon: "Operasyon",
  tutundurma: "Müşteri Tutundurma",
  yonetim: "Yönetim",
  satis: "Satış",
  yapayZeka: "Yapay Zekâ Çalışanları",
} as const;

export type Kategori = keyof typeof KATEGORILER;

/** manuel: insan yapar · yari: sistem hazırlar, insan onaylar · tam: insan dokunmadan çalışır */
export type Otomasyon = "manuel" | "yari" | "tam";

export type Tetikleyici =
  | { tur: "olay"; olay: string }
  | { tur: "zamanlama"; ne_zaman: string }
  | { tur: "manuel"; kim: string };

export interface Metrik {
  ad: string;
  hedef: string;
}

export interface Sistem {
  no: number;
  id: string;
  ad: string;
  adEn: string;
  kategori: Kategori;
  amac: string;
  sahip: string;
  otomasyon: Otomasyon;
  tetikleyici: Tetikleyici;
  girdiler: string[];
  ciktilar: string[];
  adimlar: string[];
  metrikler: Metrik[];
  araclar: string[];
  bagimliliklar: string[];
}
