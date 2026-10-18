// Ajans OS arayüzü. Veriler ve triyaj mantığı src/*.ts dosyalarından derlenen ./src/*.js modüllerinden gelir.
import { SISTEMLER } from "./src/sistemler.js";
import { KATEGORILER } from "./src/tipler.js";
import { kurulumSirasi, bul } from "./src/kayit.js";
import { SINYALLER, DEPARTMANLAR, BEYIN, GOZLEM, INSAN_DEVRI, KAYIT_SISTEMI, ISLETME_GIRDILERI } from "./src/ekip.js";
import { triyaj, KESINTILER } from "./src/beyin.js";
import { ENTEGRASYONLAR, GRUPLAR, eksikler, gerekenler, aylikMaliyet } from "./src/entegrasyonlar.js";

const icerik = document.getElementById("icerik");
const SEKMELER = ["panel", "sistemler", "ekip", "entegrasyonlar", "maliyet"];
const OTOMASYON = { manuel: "Manuel", yari: "Yarı otomatik", tam: "Tam otomatik" };
const KIM = { sen: "Sana", "satis-ekibi": "Satış ekibine" };
const KIME = { sen: "Sen", "satis-ekibi": "Satış ekibi" };

// ---- Kişisel durum (yalnızca bu tarayıcıda) ----
const ANAHTAR = "ajans-os:v1";
function oku() {
  try { return JSON.parse(localStorage.getItem(ANAHTAR)) ?? {}; } catch { return {}; }
}
const durum = Object.assign({ bagli: [], musteri: 10, paket: 3000, kapsam: "tam", kategori: "hepsi" }, oku());
function kaydet() {
  try { localStorage.setItem(ANAHTAR, JSON.stringify(durum)); } catch { /* depolama kapalı: oturum içinde çalışmaya devam */ }
}
const bagliSet = () => new Set(durum.bagli);

// ---- Yardımcılar ----
const kac = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const para = (n) => "$" + Math.round(n).toLocaleString("tr-TR");
const hazirMi = (id, set = bagliSet()) => eksikler(id, set).length === 0;
const durumCip = (id, set = bagliSet()) => {
  const eks = eksikler(id, set);
  if (eks.length === 0) return `<span class="chip ok">Canlıya hazır</span>`;
  return `<span class="chip warn" title="${kac(eks.map((e) => e.ad).join(", "))}">${eks.length} bağlantı eksik</span>`;
};
const depAdi = (id) => DEPARTMANLAR.find((d) => d.id === id)?.ad ?? id;

function etkiliSonraki(set) {
  // Bağlanınca en çok sistemi/departmanı canlıya alacak yuva; eşitlikte en çok hedefi açan
  const hedefler = [...SISTEMLER.map((s) => s.id), ...DEPARTMANLAR.map((d) => d.id)];
  let enIyi = null;
  for (const e of ENTEGRASYONLAR.filter((e) => !set.has(e.id))) {
    const sonra = new Set(set).add(e.id);
    const acilan = hedefler.filter((h) => !hazirMi(h, set) && hazirMi(h, sonra)).length;
    const dokunan = e.sistemler.length + e.departmanlar.length;
    if (!enIyi || acilan > enIyi.acilan || (acilan === enIyi.acilan && dokunan > enIyi.dokunan)) enIyi = { e, acilan, dokunan };
  }
  return enIyi;
}

function bagla(id) {
  if (!durum.bagli.includes(id)) durum.bagli.push(id);
  kaydet();
  ciz();
}
function kopar(id) {
  durum.bagli = durum.bagli.filter((x) => x !== id);
  kaydet();
  ciz();
}

// ---- Sayfalar ----
function panel() {
  const set = bagliSet();
  const sHazir = SISTEMLER.filter((s) => hazirMi(s.id, set)).length;
  const dHazir = DEPARTMANLAR.filter((d) => hazirMi(d.id, set)).length;
  const bagliEnt = ENTEGRASYONLAR.filter((e) => set.has(e.id));
  const sonraki = etkiliSonraki(set);
  const dalgalar = kurulumSirasi(SISTEMLER);
  const yuzde = (a, b) => Math.round((a / b) * 100);

  return `
  <section class="blok">
    <span class="eyebrow">Sosyal medya ajansı · aylık $100K hedefi</span>
    <h1>Ajansının işletim sistemi</h1>
    <p class="lead">22 iş sistemi ve onların üstünde çalışan yapay zekâ ekibi. Araçlarını bağladıkça sistemler tek tek canlıya geçer.</p>
  </section>
  <div class="stats">
    ${stat("Bağlı entegrasyon", `${bagliEnt.length}<small> / ${ENTEGRASYONLAR.length}</small>`, yuzde(bagliEnt.length, ENTEGRASYONLAR.length))}
    ${stat("Canlıya hazır sistem", `${sHazir}<small> / 22</small>`, yuzde(sHazir, 22))}
    ${stat("Hazır departman", `${dHazir}<small> / ${DEPARTMANLAR.length}</small>`, yuzde(dHazir, DEPARTMANLAR.length))}
    ${stat("Aylık araç maliyeti", para(aylikMaliyet(bagliEnt, durum.musteri)), null, `${durum.musteri} müşteriyle, bağlı araçlar`)}
  </div>
  ${sonraki ? `
  <section class="card">
    <span class="eyebrow">Sıradaki en etkili bağlantı</span>
    <div class="row">
      <div class="int-head"><div class="logo">${kac(sonraki.e.ad[0])}</div><div><h2>${kac(sonraki.e.ad)}</h2><p class="muted small">${kac(sonraki.e.saglayicilar.join(" · "))}</p></div></div>
      ${baglaDugmesi(sonraki.e)}
    </div>
    <p>${kac(sonraki.e.aciklama)} ${sonraki.acilan > 0 ? `Bağlarsan <b>${sonraki.acilan}</b> sistem/departman hemen canlıya hazır olur.` : `${sonraki.dokunan} sistem ve departmanın ihtiyacı var.`}</p>
  </section>` : `<section class="note">Tüm entegrasyonlar bağlı. Sistemlerin hepsi canlıya hazır.</section>`}
  <section class="blok">
    <h2>Kurulum sırası</h2>
    <p class="lead small">Her dalga, öncekiler kurulduktan sonra paralel kurulabilir. Yeşil olanlar canlıya hazır.</p>
    <div class="waves">
      ${dalgalar.map((d, i) => `
        <div class="wave"><span class="eyebrow">Dalga ${i + 1}</span>
          <div class="chips">${d.map((s) => `<a href="#sistemler" data-ac="${s.id}" class="chip ${hazirMi(s.id, set) ? "ok" : ""}" style="text-decoration:none">${s.no}. ${kac(s.ad)}</a>`).join("")}</div>
        </div>`).join("")}
    </div>
  </section>
  <section class="blok">
    <h2>Departmanlar</h2>
    <div class="grid">
      ${DEPARTMANLAR.map((d) => `
        <div class="card"><div class="row"><h3>${kac(d.ad)}</h3>${durumCip(d.id, set)}</div>
        <p class="muted small">${kac(d.gorev)}</p></div>`).join("")}
    </div>
  </section>`;
}

function stat(etiket, deger, oran, alt) {
  return `<div class="stat"><span class="eyebrow">${etiket}</span><b>${deger}</b>
    ${oran === null ? `<small>${alt}</small>` : `<div class="bar"><span style="width:${oran}%"></span></div>`}</div>`;
}

function sistemler() {
  const set = bagliSet();
  const liste = SISTEMLER.filter((s) => durum.kategori === "hepsi" || s.kategori === durum.kategori);
  const tetik = (t) => (t.tur === "olay" ? `Olay: ${t.olay}` : t.tur === "zamanlama" ? `Zamanlama: ${t.ne_zaman}` : `Manuel: ${t.kim}`);
  return `
  <section class="blok">
    <span class="eyebrow">Katalog</span>
    <h1>22 sistem</h1>
    <p class="lead">Her sistemin amacı, sahibi, adımları, hedefleri ve çalışması için gereken bağlantılar.</p>
  </section>
  <div class="chips" role="group" aria-label="Kategori">
    ${[["hepsi", "Hepsi"], ...Object.entries(KATEGORILER)].map(([k, ad]) => `<button class="filter" data-kategori="${k}" aria-pressed="${durum.kategori === k}">${kac(ad)}</button>`).join("")}
  </div>
  <div class="list">
    ${liste.map((s) => `
    <details class="sys" id="s-${s.id}">
      <summary><span class="no">${String(s.no).padStart(2, "0")}</span>
        <span class="sys-ad"><b>${kac(s.ad)}</b><span>${kac(KATEGORILER[s.kategori])} · ${kac(s.sahip)} · ${OTOMASYON[s.otomasyon]}</span></span>
        ${durumCip(s.id, set)}</summary>
      <div class="sys-body">
        <p>${kac(s.amac)}</p>
        <div class="cols">
          <div><h4>Tetikleyici</h4><p>${kac(tetik(s.tetikleyici))}</p></div>
          <div><h4>Girdiler</h4><ul>${s.girdiler.map((x) => `<li>${kac(x)}</li>`).join("")}</ul></div>
          <div><h4>Çıktılar</h4><ul>${s.ciktilar.map((x) => `<li>${kac(x)}</li>`).join("")}</ul></div>
        </div>
        <div class="cols">
          <div><h4>Adımlar</h4><ol>${s.adimlar.map((x) => `<li>${kac(x)}</li>`).join("")}</ol></div>
          <div><h4>Başarı ölçütleri</h4><ul>${s.metrikler.map((m) => `<li>${kac(m.ad)}: <b>${kac(m.hedef)}</b></li>`).join("")}</ul></div>
        </div>
        <div class="cols">
          <div><h4>Gereken bağlantılar</h4><div class="chips">${gerekenler(s.id).map((e) => `<span class="chip ${set.has(e.id) ? "ok" : "warn"}">${kac(e.ad)}</span>`).join("")}</div></div>
          <div><h4>Dayandığı sistemler</h4><div class="chips">${s.bagimliliklar.map((b) => `<span class="chip plain">${bul(SISTEMLER, b).no}. ${kac(bul(SISTEMLER, b).ad)}</span>`).join("") || `<span class="muted small">Yok, ilk kurulacaklardan</span>`}</div></div>
        </div>
      </div>
    </details>`).join("")}
  </div>`;
}

const ORNEKLER = {
  "Rutin DM": { sinyal: "yorum-ve-dm", metin: "Merhaba, kişisel marka paketleriniz neler?" },
  "1 yıldızlı yorum": { sinyal: "degerlendirme", puan: 1, metin: "Hiç dönüş yapmadılar." },
  "Bütçe doldu": { sinyal: "reklam-performansi", harcama: 5000, butce: 5000, cpl: 48, ortalamaCpl: 45 },
  "Maliyet sıçradı": { sinyal: "reklam-performansi", harcama: 2100, butce: 5000, cpl: 92, ortalamaCpl: 50 },
  "İnsan istiyor": { sinyal: "satis-aramasi", metin: "Gerçek bir kişiyle konuşabilir miyim?" },
  "Büyük anlaşma": { sinyal: "lead-formu", tahminiDeger: 15000, metin: "3 kurucu için LinkedIn + Instagram yönetimi" },
};
let simOlay = { ...ORNEKLER["Rutin DM"] };

function ekip() {
  const set = bagliSet();
  return `
  <section class="blok">
    <span class="eyebrow">Claude yazar · kurallar karar verir · ElevenLabs konuşur · sen onaylarsın</span>
    <h1>Yapay zekâ ekibi</h1>
    <p class="lead">Sinyaller beyne gelir, beyin doğru departmana yönlendirir. Para, itibar ya da insan isteği söz konusuysa akış durur ve iş insana geçer.</p>
  </section>
  <div class="flow">
    ${katman("01", "Sinyaller", SINYALLER.map((s) => s.ad))}
    <div class="arrow">↓</div>
    ${katman("02 · 04", "Kayıt sistemi ve işletme girdileri", [...KAYIT_SISTEMI, ...ISLETME_GIRDILERI].map((k) => k.ad))}
    <div class="arrow">↓</div>
    <div class="layer brain"><div><span class="eyebrow">03</span><h3>Beyin</h3></div>
      <div class="cols">${BEYIN.map((b) => `<div><h4>${kac(b.ad)}</h4><p class="small">${kac(b.gorev)}</p><p class="muted small">${kac(b.arac)}</p></div>`).join("")}</div></div>
    <div class="arrow">↓</div>
    <div class="layer"><div><span class="eyebrow">05</span><h3>Departmanlar</h3></div>
      <div class="chips">${DEPARTMANLAR.map((d) => `<span class="chip ${hazirMi(d.id, set) ? "ok" : ""}">${kac(d.ad)}${d.insanOnayi ? " · onaylı" : ""}</span>`).join("")}</div></div>
    <div class="arrow">↓</div>
    ${katman("06", "Veri ve gözlem", GOZLEM.map((g) => g.ad))}
    <div class="arrow">↓</div>
    ${katman("07", "İnsana devir", INSAN_DEVRI.map((h) => h.ad))}
  </div>

  <section class="blok">
    <h2>Triyaj simülatörü</h2>
    <p class="lead small">Bir olay gir, beyin canlı olarak nereye yönlendirdiğini ve insana devredip devretmediğini göstersin. Bu, sistemin gerçek karar kodu.</p>
    <div class="chips">${Object.keys(ORNEKLER).map((k) => `<button data-ornek="${kac(k)}">${kac(k)}</button>`).join("")}</div>
    <div class="sim">
      <form class="fields card" id="sim">
        <label class="f full">Sinyal<select id="f-sinyal">${SINYALLER.map((s) => `<option value="${s.id}" ${simOlay.sinyal === s.id ? "selected" : ""}>${kac(s.ad)}</option>`).join("")}</select></label>
        <label class="f full">Mesaj / metin<textarea id="f-metin">${kac(simOlay.metin ?? "")}</textarea></label>
        ${sayi("puan", "Değerlendirme yıldızı (1–5)")}
        ${sayi("tahminiDeger", "Fırsatın aylık değeri ($)")}
        ${sayi("harcama", "Reklam harcaması ($)")}
        ${sayi("butce", "Reklam bütçesi ($)")}
        ${sayi("cpl", "Güncel lead başı maliyet ($)")}
        ${sayi("ortalamaCpl", "7 günlük ort. lead maliyeti ($)")}
        ${sayi("olumsuzYorumSonSaat", "Son 1 saatte olumsuz yorum")}
        <div class="full chips">
          <label class="chk"><input type="checkbox" id="f-reddedildi" ${simOlay.reklamDurumu === "reddedildi" ? "checked" : ""}>Reklam reddedildi</label>
          <label class="chk"><input type="checkbox" id="f-lansman" ${simOlay.yeniLansman ? "checked" : ""}>Rakip yeni lansman yaptı</label>
        </div>
      </form>
      <div class="result" id="sim-sonuc" aria-live="polite">${simSonuc()}</div>
    </div>
  </section>

  <section class="blok">
    <h2>Döngüyü kesen durumlar</h2>
    <div class="scroll"><table>
      <thead><tr><th>Durum</th><th>Ne yapılır</th><th>Kime</th></tr></thead>
      <tbody>${KESINTILER.map((k) => `<tr><td>${kac(k.ad)}</td><td>${kac(k.eylem)}</td><td>${KIME[k.kime]}</td></tr>`).join("")}</tbody>
    </table></div>
  </section>`;
}

function katman(no, ad, ogeler) {
  return `<div class="layer"><div><span class="eyebrow">${no}</span><h3>${ad}</h3></div>
    <div class="chips">${ogeler.map((o) => `<span class="chip plain">${kac(o)}</span>`).join("")}</div></div>`;
}
function sayi(alan, etiket) {
  return `<label class="f">${etiket}<input type="number" inputmode="decimal" id="f-${alan}" value="${simOlay[alan] ?? ""}"></label>`;
}

function simSonuc() {
  const r = triyaj(simOlay);
  const sinif = r.kesintiler.length ? "crit" : r.otomatik ? "ok" : "warn";
  const baslik = r.kesintiler.length
    ? `Akış durdu · ${KIM[r.devir]} devredildi`
    : r.otomatik ? "İnsan dokunmadan tamamlanır" : "Hazırlanır, senin onayına gelir";
  return `
    <div class="verdict ${sinif}"><span class="eyebrow" style="color:inherit">Sonuç</span><b>${baslik}</b></div>
    <div class="card">
      <div><span class="eyebrow">Departman</span><h3>${kac(depAdi(r.departman))}</h3></div>
      <div><span class="eyebrow">Beynin adımları</span><div class="steps">${r.adimlar.map((a) => `<span>${kac(BEYIN.find((b) => b.id === a).ad)}</span>`).join("")}</div></div>
      ${r.kesintiler.length ? `<div><span class="eyebrow">Yakalanan durumlar</span><ul>${r.kesintiler.map((k) => `<li><b>${kac(k.ad)}</b>: ${kac(k.eylem)}</li>`).join("")}</ul></div>` : ""}
    </div>`;
}

function simOku() {
  const f = (id) => document.getElementById("f-" + id);
  const n = (id) => (f(id).value === "" ? undefined : Number(f(id).value));
  simOlay = {
    sinyal: f("sinyal").value,
    metin: f("metin").value,
    puan: n("puan"), tahminiDeger: n("tahminiDeger"), harcama: n("harcama"), butce: n("butce"),
    cpl: n("cpl"), ortalamaCpl: n("ortalamaCpl"), olumsuzYorumSonSaat: n("olumsuzYorumSonSaat"),
    reklamDurumu: f("reddedildi").checked ? "reddedildi" : undefined,
    yeniLansman: f("lansman").checked || undefined,
  };
  document.getElementById("sim-sonuc").innerHTML = simSonuc();
}

function baglaDugmesi(e) {
  if (bagliSet().has(e.id)) return `<button data-kopar="${e.id}">Bağlantıyı kaldır</button>`;
  if (e.baglantiUrl) return `<a class="btn primary" href="${kac(e.baglantiUrl)}" target="_blank" rel="noopener" data-bagla="${e.id}">Bağla</a>`;
  return `<button class="primary" data-bagla="${e.id}">Bağla</button>`;
}

function entegrasyonlar() {
  const set = bagliSet();
  const adresli = ENTEGRASYONLAR.filter((e) => e.baglantiUrl).length;
  return `
  <section class="blok">
    <span class="eyebrow">${set.size} / ${ENTEGRASYONLAR.length} bağlı</span>
    <h1>Entegrasyonlar</h1>
    <p class="lead">Her yuva bir yeteneği temsil eder. Bağladığında, ona ihtiyaç duyan sistem ve departmanlar canlıya bir adım yaklaşır.</p>
  </section>
  ${adresli < ENTEGRASYONLAR.length ? `<p class="note">${ENTEGRASYONLAR.length - adresli} yuvanın bağlantı adresi henüz girilmedi. Adresler <code>src/entegrasyonlar.ts</code> içindeki <code>baglantiUrl</code> alanından gelir. Adresi olmayan yuvalarda <b>Bağla</b> deneme amaçlı işaretler; bağlantı durumu yalnızca bu tarayıcıda saklanır.</p>` : ""}
  ${Object.entries(GRUPLAR).map(([g, ad]) => `
  <section class="blok">
    <h2>${ad}</h2>
    <div class="grid">
      ${ENTEGRASYONLAR.filter((e) => e.grup === g).map((e) => `
      <div class="card">
        <div class="row">
          <div class="int-head"><div class="logo">${kac(e.ad[0])}</div><div><h3>${kac(e.ad)}</h3><p class="muted small">${kac(e.saglayicilar.join(" · "))}</p></div></div>
        </div>
        <p class="small">${kac(e.aciklama)}</p>
        <p class="muted small">${e.sistemler.length} sistem · ${e.departmanlar.length} departman · ${e.maliyet.sabit || e.maliyet.musteriBasi ? `${para(e.maliyet.sabit)}${e.maliyet.musteriBasi ? ` + ${para(e.maliyet.musteriBasi)}/müşteri` : ""} aylık` : "Ücretsiz"}</p>
        <div class="chips" style="align-items:center">${baglaDugmesi(e)}${set.has(e.id) ? `<span class="chip ok">Bağlı${e.baglantiUrl ? "" : " · deneme"}</span>` : ""}</div>
      </div>`).join("")}
    </div>
  </section>`).join("")}`;
}

function maliyet() {
  const set = bagliSet();
  const kume = durum.kapsam === "tam" ? ENTEGRASYONLAR : ENTEGRASYONLAR.filter((e) => set.has(e.id));
  const toplam = aylikMaliyet(kume, durum.musteri);
  const gelir = durum.musteri * durum.paket;
  const satirlar = kume.map((e) => ({ e, tutar: aylikMaliyet([e], durum.musteri) })).sort((a, b) => b.tutar - a.tutar);
  return `
  <section class="blok">
    <span class="eyebrow">Tahmin · yazılım ve yapay zekâ, reklam bütçesi ve maaşlar hariç</span>
    <h1>Aylık işletme maliyeti</h1>
    <p class="lead">Fiyatlar yaklaşık değerlerdir ve sağlayıcıların fiyat listesi değiştikçe sapabilir.</p>
  </section>
  <div class="card">
    <div class="cost-row">
      <label class="f">Müşteri sayısı: <b id="musteri-deger">${durum.musteri}</b><input type="range" id="musteri" min="1" max="60" value="${durum.musteri}"></label>
      <label class="f">Ortalama aylık paket ($)<input type="number" id="paket" min="0" step="100" value="${durum.paket}"></label>
      <label class="f">Kapsam<select id="kapsam"><option value="tam" ${durum.kapsam === "tam" ? "selected" : ""}>Tam kurulum (tüm araçlar)</option><option value="bagli" ${durum.kapsam === "bagli" ? "selected" : ""}>Yalnızca bağlı araçlar</option></select></label>
    </div>
  </div>
  <div class="stats">
    <div class="stat"><span class="eyebrow">Aylık araç maliyeti</span><span class="big">${para(toplam)}</span><small>Müşteri başına ${para(toplam / durum.musteri)}</small></div>
    <div class="stat"><span class="eyebrow">Aylık gelir</span><span class="big">${para(gelir)}</span><small>${durum.musteri} × ${para(durum.paket)}</small></div>
    <div class="stat"><span class="eyebrow">Gelire oranı</span><span class="big">%${gelir ? ((toplam / gelir) * 100).toFixed(1) : "—"}</span><small>Asıl gider ekip maaşlarıdır</small></div>
  </div>
  <div class="scroll"><table>
    <thead><tr><th>Araç</th><th>Sağlayıcı</th><th class="num">Sabit</th><th class="num">Müşteri başı</th><th class="num">Aylık</th></tr></thead>
    <tbody>${satirlar.map(({ e, tutar }) => `<tr><td>${kac(e.ad)}</td><td class="muted">${kac(e.saglayicilar.join(", "))}</td><td class="num">${para(e.maliyet.sabit)}</td><td class="num">${e.maliyet.musteriBasi ? para(e.maliyet.musteriBasi) : "—"}</td><td class="num"><b>${para(tutar)}</b></td></tr>`).join("") || `<tr><td colspan="5" class="muted">Henüz bağlı araç yok. Kapsamı “Tam kurulum” yap ya da Entegrasyonlar sekmesinden bağla.</td></tr>`}</tbody>
  </table></div>`;
}

// ---- Yönlendirme ve olaylar ----
const SAYFALAR = { panel, sistemler, ekip, entegrasyonlar, maliyet };
let acilacak = null;

function ciz() {
  const sekme = SEKMELER.includes(location.hash.slice(1)) ? location.hash.slice(1) : "panel";
  for (const a of document.querySelectorAll("#sekmeler a")) {
    if (a.getAttribute("href") === "#" + sekme) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  icerik.innerHTML = SAYFALAR[sekme]();
  if (acilacak) {
    const d = document.getElementById("s-" + acilacak);
    if (d) { d.open = true; d.scrollIntoView({ block: "start" }); }
    acilacak = null;
  }
}

window.addEventListener("hashchange", () => { ciz(); window.scrollTo(0, 0); });

document.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-bagla],[data-kopar],[data-kategori],[data-ornek],[data-ac]");
  if (!t) return;
  if (t.dataset.bagla) { bagla(t.dataset.bagla); }               // bağlantı adresi varsa link ayrıca yeni sekmede açılır
  else if (t.dataset.kopar) kopar(t.dataset.kopar);
  else if (t.dataset.kategori) { durum.kategori = t.dataset.kategori; kaydet(); ciz(); }
  else if (t.dataset.ornek) { simOlay = { ...ORNEKLER[t.dataset.ornek] }; ciz(); }
  else if (t.dataset.ac) { acilacak = t.dataset.ac; }
});

document.addEventListener("input", (ev) => {
  const id = ev.target.id;
  if (ev.target.closest("#sim")) return simOku();
  if (id === "musteri") { durum.musteri = Number(ev.target.value); kaydet(); ciz(); document.getElementById("musteri")?.focus(); }
  else if (id === "kapsam") { durum.kapsam = ev.target.value; kaydet(); ciz(); }
});
document.addEventListener("change", (ev) => {
  if (ev.target.id === "paket") { durum.paket = Math.max(0, Number(ev.target.value) || 0); kaydet(); ciz(); }
});
document.addEventListener("submit", (ev) => ev.preventDefault());

ciz();
