// Otomatik üretildi: src/beyin.ts — elle düzenlemeyin, npm run site çalıştırın.
import { DEPARTMANLAR, SINYALLER } from "./ekip.js";

// Beynin triyaj adımı: her olayı bir departmana yönlendirir ve döngüyü kesen durumları yakalar.
// Bu kısım bilerek kural tabanlıdır — para, itibar ve insan isteği söz konusuyken karar
// modele bırakılmaz. Claude yalnızca "yazar" ve "kontrol" adımlarında devreye girer.

                       
                 
                 
                                    
                
                   
                 
                                                          
               
                       
                                        
                               
                        
                                      
                        
 

                          
                     
                     
                              
                    
                       
 

export const VARSAYILAN_ESIKLER          = {
  butceOrani: 1,
  cplSicrama: 1.5,
  olumsuzYorumSaatlik: 5,
  dusukPuan: 2,
  buyukAnlasma: 10_000,
};

                                         

                          
             
             
                
             
                                          
 

const INSAN_ISTEGI = /\b(insan|gerçek (bir )?(biri|kişi)|yetkili|temsilci|müdür|biriyle konuş|human|real person|manager)/i;

export const KESINTILER            = [
  {
    id: "butce-limiti",
    ad: "Bütçe limitine ulaşıldı",
    eylem: "Reklamları duraklat, bütçe artışı için onay iste",
    kime: "sen",
    kosul: (o, e) => o.harcama !== undefined && !!o.butce && o.harcama / o.butce >= e.butceOrani,
  },
  {
    id: "reklam-reddedildi",
    ad: "Reklam reddedildi",
    eylem: "Red gerekçesini ve düzeltilmiş metni onaya sun",
    kime: "sen",
    kosul: (o) => o.reklamDurumu === "reddedildi",
  },
  {
    id: "cpl-sicradi",
    ad: "Lead başı maliyet sıçradı",
    eylem: "Ölçeklemeyi durdur, olası nedenleri ve önerilen değişikliği raporla",
    kime: "sen",
    kosul: (o, e) => !!o.cpl && !!o.ortalamaCpl && o.cpl >= o.ortalamaCpl * e.cplSicrama,
  },
  {
    id: "rakip-lansmani",
    ad: "Rakip lansman yaptı",
    eylem: "Rakibin teklifini ve açısını özetle, karşı hamle önerisini onaya sun",
    kime: "sen",
    kosul: (o) => o.sinyal === "rakip-reklamlari" && o.yeniLansman === true,
  },
  {
    id: "ofke-yayiliyor",
    ad: "Öfkeli yorumlar yayılıyor",
    eylem: "Otomatik yanıtları durdur, tek bir resmi yanıt taslağını onaya sun",
    kime: "sen",
    kosul: (o, e) => (o.olumsuzYorumSonSaat ?? 0) >= e.olumsuzYorumSaatlik,
  },
  {
    id: "dusuk-puan",
    ad: "Tek / iki yıldızlı değerlendirme",
    eylem: "Kamuya açık yanıt taslağını onaya sun, müşteriyi özelden ara",
    kime: "sen",
    kosul: (o, e) => o.sinyal === "degerlendirme" && o.puan !== undefined && o.puan <= e.dusukPuan,
  },
  {
    id: "insan-istiyor",
    ad: "Arayan/yazan bir insan istiyor",
    eylem: "Konuşmayı özetiyle birlikte satış ekibine devret",
    kime: "satis-ekibi",
    kosul: (o) => INSAN_ISTEGI.test(o.metin ?? ""),
  },
  {
    id: "buyuk-anlasma",
    ad: "Büyük anlaşma masada",
    eylem: "Yapay zekâ yanıtını durdur, araştırma özetiyle satış ekibine devret",
    kime: "satis-ekibi",
    kosul: (o, e) => (o.tahminiDeger ?? 0) >= e.buyukAnlasma,
  },
];

                               
                    
                                                            
                    
                                                                      
                                                            
                     
                                                                                  
                    
 

export function triyaj(olay      , esikler          = VARSAYILAN_ESIKLER)               {
  const sinyal = SINYALLER.find((s) => s.id === olay.sinyal);
  if (!sinyal) throw new Error(`Bilinmeyen sinyal: ${olay.sinyal}`);
  const departman = DEPARTMANLAR.find((d) => d.id === sinyal.departman) ;

  const kesintiler = KESINTILER.filter((k) => k.kosul(olay, esikler)).map(({ id, ad, eylem, kime }) => ({ id, ad, eylem, kime }));
  const adimlar = ["triyaj", "yazar", ...(olay.sinyal === "satis-aramasi" ? ["konusur"] : []), "kontrol"];

  return {
    departman: departman.id,
    adimlar,
    kesintiler,
    devir: kesintiler[0]?.kime ?? null,
    otomatik: kesintiler.length === 0 && !departman.insanOnayi,
  };
}
