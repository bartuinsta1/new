// Ajans OS arayüzü. Veriler ve triyaj mantığı src/*.ts dosyalarından derlenen ./src/*.js modüllerinden gelir.
import { SISTEMLER } from "./src/sistemler.js";
import { KATEGORILER } from "./src/tipler.js";
import { bul } from "./src/kayit.js";
import { SINYALLER, DEPARTMANLAR, BEYIN } from "./src/ekip.js";
import { triyaj, KESINTILER } from "./src/beyin.js";
import { ENTEGRASYONLAR, eksikler, gerekenler, aylikMaliyet } from "./src/entegrasyonlar.js";

const icerik = document.getElementById("icerik");
const OTOMASYON = { manuel: "Manuel", yari: "Yarı otomatik", tam: "Tam otomatik" };
const KIME = { sen: "sana", "satis-ekibi": "satış ekibine" };
const HEDEFLER = [...SISTEMLER.map((s) => s.id), ...DEPARTMANLAR.map((d) => d.id)];

// ---- Kişisel durum (yalnızca bu tarayıcıda) ----
const ANAHTAR = "ajans-os:v1";
const durum = Object.assign({ bagli: [], musteri: 10, paket: 3000, kapsam: "tam" }, (() => {
  try { return JSON.parse(localStorage.getItem(ANAHTAR)) ?? {}; } catch { return {}; }
})());
const ui = { kategori: "hepsi", ara: "", senaryo: 0, olay: null, acik: null };
function kaydet() {
  try { localStorage.setItem(ANAHTAR, JSON.stringify(durum)); } catch { /* depolama kapalı: oturum içinde çalışır */ }
}
const bagliSet = () => new Set(durum.bagli);

// ---- Yardımcılar ----
const kac = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const para = (n) => "$" + Math.round(n).toLocaleString("tr-TR");
const hazirMi = (id, set = bagliSet()) => eksikler(id, set).length === 0;
const hazirSayisi = (set) => HEDEFLER.filter((h) => hazirMi(h, set)).length;
const sistemAdi = (id) => bul(SISTEMLER, id)?.ad ?? DEPARTMANLAR.find((d) => d.id === id)?.ad ?? id;
const harf = (ad) => ad.trim()[0].toLocaleUpperCase("tr-TR");

function halka(oran, boyut, kalinlik, ic) {
  const r = (boyut - kalinlik) / 2, c = 2 * Math.PI * r;
  return `<div class="ring" style="width:${boyut}px;height:${boyut}px">
    <svg width="${boyut}" height="${boyut}" viewBox="0 0 ${boyut} ${boyut}" aria-hidden="true">
      <circle class="track" cx="${boyut / 2}" cy="${boyut / 2}" r="${r}" fill="none" stroke-width="${kalinlik}"/>
      <circle class="fill" cx="${boyut / 2}" cy="${boyut / 2}" r="${r}" fill="none" stroke-width="${kalinlik}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - oran)}"/>
    </svg><div>${ic}</div></div>`;
}
const avatar = (e, on) => `<div class="avatar ${on ? "on" : "off"}" aria-hidden="true"><span>${kac(harf(e.ad))}</span></div>`;

// Kurulum yolu: boş kümeden başlayıp her adımda en çok hedefi canlıya alan yuvayı seçer (eşitlikte en çok
// hedefe dokunanı). Sıra sabittir; kullanıcı istediği sırada bağlayabilir.
const YOL = (() => {
  const set = new Set(), yol = [];
  while (yol.length < ENTEGRASYONLAR.length) {
    let enIyi = null;
    for (const e of ENTEGRASYONLAR.filter((e) => !set.has(e.id))) {
      const sonra = new Set(set).add(e.id);
      const acar = HEDEFLER.filter((h) => !hazirMi(h, set) && hazirMi(h, sonra));
      const puan = [acar.length, e.sistemler.length + e.departmanlar.length];
      if (!enIyi || puan[0] > enIyi.puan[0] || (puan[0] === enIyi.puan[0] && puan[1] > enIyi.puan[1])) enIyi = { e, acar, puan };
    }
    set.add(enIyi.e.id);
    yol.push(enIyi);
  }
  return yol;
})();

let toastZaman;
function bildir(metin) {
  const t = document.getElementById("toast");
  t.textContent = metin;
  t.hidden = false;
  clearTimeout(toastZaman);
  toastZaman = setTimeout(() => (t.hidden = true), 3200);
}

function bagla(id) {
  const once = hazirSayisi(bagliSet());
  if (!durum.bagli.includes(id)) durum.bagli.push(id);
  kaydet();
  const fark = hazirSayisi(bagliSet()) - once;
  const e = ENTEGRASYONLAR.find((x) => x.id === id);
  bildir(`${e.ad} bağlandı${fark > 0 ? ` · ${fark} sistem/departman canlıya geçti` : ""}`);
  ciz(false);
}
function kopar(id) {
  durum.bagli = durum.bagli.filter((x) => x !== id);
  kaydet();
  bildir(`${ENTEGRASYONLAR.find((x) => x.id === id).ad} bağlantısı kaldırıldı`);
  ciz(false);
}
function baglaDugmesi(e, kucuk) {
  if (bagliSet().has(e.id)) return `<button class="ghost" data-kopar="${e.id}">Kaldır</button>`;
  const etiket = kucuk ? `${kac(e.ad)} bağla` : "Bağla";
  const stil = kucuk ? ' style="min-height:36px;padding:8px 14px;font-size:14px"' : "";
  if (e.baglantiUrl) return `<a class="btn primary" href="${kac(e.baglantiUrl)}" target="_blank" rel="noopener" data-bagla="${e.id}"${stil}>${etiket}</a>`;
  return `<button class="primary" data-bagla="${e.id}"${stil}>${etiket}</button>`;
}

// ---- Kenar çubuğu özeti ----
function ozet() {
  const n = SISTEMLER.filter((s) => hazirMi(s.id)).length;
  document.getElementById("ozet").innerHTML = `${halka(n / 22, 56, 7, "")}<div><b>${n} / 22</b><span>sistem canlıya hazır</span></div>`;
}

// ---- Başla ----
function basla() {
  const set = bagliSet();
  const sHazir = SISTEMLER.filter((s) => hazirMi(s.id, set)).length;
  const sonraki = YOL.find((a) => !set.has(a.e.id));
  const bitti = YOL.filter((a) => set.has(a.e.id)).length;
  const acarMetni = (a) => {
    const liste = a.acar.length ? a.acar : [...a.e.sistemler, ...a.e.departmanlar];
    const ilk = liste.slice(0, 3).map((id) => `<span class="chip ${a.acar.length ? "ok" : ""}">${kac(sistemAdi(id))}</span>`).join("");
    return ilk + (liste.length > 3 ? `<span class="chip">+${liste.length - 3}</span>` : "");
  };

  return `
  <section class="panel hero">
    <div class="big-ring">${halka(sHazir / 22, 132, 12, `<b>%${Math.round((sHazir / 22) * 100)}</b><small>canlı</small>`)}</div>
    <div class="hero-text">
      <span class="tag">Sosyal medya ajansı · aylık $100K hedefi</span>
      <h1>${sonraki ? (bitti === 0 ? "Ajansını adım adım kur" : `${sHazir} sistem hazır. Devam edelim.`) : "Her şey bağlı. Ajansın canlıda."}</h1>
      <p class="lead">${sonraki
        ? `Sıradaki adım: <b>${kac(sonraki.e.ad)}</b>. ${kac(sonraki.e.aciklama)}`
        : "22 sistem ve yapay zekâ ekibinin tüm departmanları çalışmaya hazır."}</p>
      ${sonraki ? `<div class="next">${baglaDugmesi(sonraki.e)}<span class="muted small">${bitti} / ${YOL.length} adım tamam</span></div>` : ""}
    </div>
  </section>

  <section class="stack">
    <div><h2>Kurulum yolu</h2><p class="muted small">Sıra, her adım en çok sistemi açacak şekilde hesaplandı. İstediğin sırada da bağlayabilirsin.</p></div>
    <ol class="path panel">
      ${YOL.map((a, i) => {
        const on = set.has(a.e.id);
        return `<li class="${on ? "done" : a === sonraki ? "next" : ""}">
          <span class="step">${String(i + 1).padStart(2, "0")}</span>
          ${avatar(a.e, on)}
          <div class="step-body">
            <h3>${kac(a.e.ad)} <span class="muted small" style="font-weight:400">· ${kac(a.e.saglayicilar.join(", "))}</span></h3>
            <div class="chips">${on ? `<span class="chip ok dot">Bağlı${a.e.baglantiUrl ? "" : " (deneme)"}</span>` : acarMetni(a)}</div>
          </div>
          ${baglaDugmesi(a.e)}
        </li>`;
      }).join("")}
    </ol>
  </section>`;
}

// ---- Sistemler ----
function sistemler() {
  return `
  <section class="stack">
    <span class="tag">Katalog</span>
    <h1>22 sistem</h1>
    <p class="lead">Bir sisteme dokun: ne işe yaradığını, adımlarını ve çalışması için neyin eksik olduğunu gör.</p>
  </section>
  <div class="toolbar">
    <label class="search" for="ara">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input id="ara" type="search" placeholder="Sistem ara: CRM, NPS, onboarding…" aria-label="Sistem ara" value="${kac(ui.ara)}" autocomplete="off">
    </label>
    <select id="kategori" class="cat" aria-label="Süz">
      ${[["hepsi", "Tüm sistemler"], ["hazir", "Canlıya hazır olanlar"], ["kilitli", "Bağlantı bekleyenler"], ...Object.entries(KATEGORILER)].map(([k, ad]) => `<option value="${k}" ${ui.kategori === k ? "selected" : ""}>${kac(ad)}</option>`).join("")}
    </select>
  </div>
  <div class="panel sys-list" id="sys-list">${sistemListesi()}</div>`;
}

function sistemListesi() {
  const set = bagliSet();
  const q = ui.ara.trim().toLocaleLowerCase("tr-TR");
  const liste = SISTEMLER.filter((s) => {
    if (ui.kategori === "hazir" && !hazirMi(s.id, set)) return false;
    if (ui.kategori === "kilitli" && hazirMi(s.id, set)) return false;
    if (ui.kategori in KATEGORILER && s.kategori !== ui.kategori) return false;
    return !q || `${s.ad} ${s.adEn} ${s.amac} ${s.sahip}`.toLocaleLowerCase("tr-TR").includes(q);
  });
  if (!liste.length) return `<p class="empty">${q ? `“${kac(ui.ara)}” için sistem bulunamadı.` : "Bu süzgece uyan sistem yok."}</p>`;
  const tetik = (t) => (t.tur === "olay" ? `Şu olunca: ${t.olay}` : t.tur === "zamanlama" ? `Zamanlı: ${t.ne_zaman}` : `Elle: ${t.kim}`);
  return liste.map((s) => {
    const eks = eksikler(s.id, set);
    return `
    <details class="sys" id="s-${s.id}" ${ui.acik === s.id ? "open" : ""}>
      <summary>
        <span class="num">${String(s.no).padStart(2, "0")}</span>
        <span class="sys-name"><b>${kac(s.ad)}</b><span>${kac(KATEGORILER[s.kategori])} · ${kac(s.sahip)}</span></span>
        ${eks.length ? `<span class="chip warn dot">${eks.length} bağlantı eksik</span>` : `<span class="chip ok dot">Canlıya hazır</span>`}
        <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
      </summary>
      <div class="sys-body">
        <p>${kac(s.amac)}</p>
        ${eks.length ? `<div class="lock"><b>Çalışması için bağla:</b><div class="row">${eks.map((e) => baglaDugmesi(e, true)).join("")}</div></div>` : ""}
        <div class="cols">
          <div><h4>Ne zaman çalışır</h4><p>${kac(tetik(s.tetikleyici))}</p><p class="muted small">${OTOMASYON[s.otomasyon]}</p></div>
          <div><h4>Başarı ölçütleri</h4><ul>${s.metrikler.map((m) => `<li>${kac(m.ad)}: <b>${kac(m.hedef)}</b></li>`).join("")}</ul></div>
        </div>
        <div class="cols">
          <div><h4>Adımlar</h4><ol>${s.adimlar.map((x) => `<li>${kac(x)}</li>`).join("")}</ol></div>
          <div><h4>Girdi</h4><ul>${s.girdiler.map((x) => `<li>${kac(x)}</li>`).join("")}</ul><h4 style="margin-top:14px">Çıktı</h4><ul>${s.ciktilar.map((x) => `<li>${kac(x)}</li>`).join("")}</ul></div>
        </div>
        <div class="cols">
          <div><h4>Kullandığı araçlar</h4><div class="chips">${gerekenler(s.id).map((e) => `<span class="chip ${set.has(e.id) ? "ok" : ""}">${kac(e.ad)}</span>`).join("")}</div></div>
          <div><h4>Önce kurulmalı</h4><div class="chips">${s.bagimliliklar.map((b) => `<span class="chip">${bul(SISTEMLER, b).no}. ${kac(bul(SISTEMLER, b).ad)}</span>`).join("") || `<span class="muted small">Yok, ilk kurulacaklardan</span>`}</div></div>
        </div>
      </div>
    </details>`;
  }).join("");
}

// ---- Yapay zekâ ekibi ----
const SENARYOLAR = [
  { ad: "Instagram'dan soru", alt: "Paketleri soran yeni bir DM", olay: { sinyal: "yorum-ve-dm", metin: "Merhaba, kişisel marka paketleriniz neler?" } },
  { ad: "1 yıldızlı yorum", alt: "Google'da kızgın bir değerlendirme", olay: { sinyal: "degerlendirme", puan: 1, metin: "Hiç dönüş yapmadılar, çok kötü." } },
  { ad: "Reklam bütçesi doldu", alt: "Aylık $5.000'ın tamamı harcandı", olay: { sinyal: "reklam-performansi", harcama: 5000, butce: 5000, cpl: 48, ortalamaCpl: 45 } },
  { ad: "Lead maliyeti uçtu", alt: "Lead başı $50'den $92'ye çıktı", olay: { sinyal: "reklam-performansi", harcama: 2100, butce: 5000, cpl: 92, ortalamaCpl: 50 } },
  { ad: "Arayan insan istiyor", alt: "Telefonda gerçek biriyle görüşmek istiyor", olay: { sinyal: "satis-aramasi", metin: "Gerçek bir kişiyle konuşabilir miyim?" } },
  { ad: "Büyük müşteri", alt: "Ayda $15.000'lık bir teklif talebi", olay: { sinyal: "lead-formu", tahminiDeger: 15000, metin: "3 kurucu için LinkedIn ve Instagram yönetimi istiyoruz." } },
  { ad: "Yayın saati geldi", alt: "Onaylı Reels'in paylaşım zamanı", olay: { sinyal: "yayin-zamani", metin: "Salı 19:00 · Reels · ‘3 hata’ serisi" } },
  { ad: "Rakip kampanya açtı", alt: "Rakipten yeni bir lansman reklamı", olay: { sinyal: "rakip-reklamlari", yeniLansman: true, metin: "Rakip %30 indirimli paket duyurdu." } },
];
const ALANLAR = {
  "reklam-performansi": [["harcama", "Harcama ($)"], ["butce", "Bütçe ($)"], ["cpl", "Güncel lead maliyeti ($)"], ["ortalamaCpl", "7 günlük ortalama ($)"]],
  degerlendirme: [["puan", "Yıldız (1–5)"]],
  "yorum-ve-dm": [["olumsuzYorumSonSaat", "Son 1 saatte olumsuz yorum"], ["tahminiDeger", "Fırsatın aylık değeri ($)"]],
  "lead-formu": [["tahminiDeger", "Fırsatın aylık değeri ($)"]],
  "satis-aramasi": [["tahminiDeger", "Fırsatın aylık değeri ($)"]],
};

function ekip() {
  const olay = ui.olay ?? SENARYOLAR[ui.senaryo].olay;
  const set = bagliSet();
  return `
  <section class="stack">
    <span class="tag">Claude yazar · kurallar karar verir · ElevenLabs konuşur · sen onaylarsın</span>
    <h1>Yapay zekâ ekibi ne yapar?</h1>
    <p class="lead">Bir durum seç, ekibin nasıl tepki verdiğini adım adım gör. Para, itibar ya da insan isteği söz konusu olduğunda iş sana geçer.</p>
  </section>
  <div class="scenarios" role="group" aria-label="Senaryolar">
    ${SENARYOLAR.map((s, i) => `<button class="scenario" data-senaryo="${i}" aria-pressed="${!ui.olay && ui.senaryo === i}"><b>${kac(s.ad)}</b><span>${kac(s.alt)}</span></button>`).join("")}
  </div>
  <section class="panel convo" id="convo" aria-live="polite">${akis(olay)}</section>
  <details class="custom" ${ui.olay ? "open" : ""}>
    <summary>＋ Kendi durumunu dene</summary>
    <form class="fields" id="sim">${simForm(olay)}</form>
  </details>
  <section class="stack">
    <h2>Departmanlar</h2>
    <div class="grid">
      ${DEPARTMANLAR.map((d) => {
        const eks = eksikler(d.id, set);
        return `<div class="panel dep"><h3>${kac(d.ad)}</h3><p class="muted small">${kac(d.gorev)}</p>
        <div class="chips">${eks.length ? `<span class="chip warn dot">${eks.length} bağlantı eksik</span>` : `<span class="chip ok dot">Hazır</span>`}${d.insanOnayi ? `<span class="chip">Onayınla çalışır</span>` : ""}</div></div>`;
      }).join("")}
    </div>
  </section>
  <section class="stack">
    <h2>Ekip ne zaman durur?</h2>
    <div class="panel stops">
      ${KESINTILER.map((k) => `<div class="stop-row"><div><b>${kac(k.ad)}</b><p class="muted small">${kac(k.eylem)}</p></div><span class="chip">${k.kime === "sen" ? "Sana gelir" : "Satış ekibine"}</span></div>`).join("")}
    </div>
  </section>`;
}

function akis(olay) {
  const r = triyaj(olay);
  const sinyal = SINYALLER.find((s) => s.id === olay.sinyal);
  const dep = DEPARTMANLAR.find((d) => d.id === r.departman);
  const ayrinti = [
    olay.puan !== undefined && `${olay.puan} yıldız`,
    olay.harcama !== undefined && olay.butce && `Harcama ${para(olay.harcama)} / ${para(olay.butce)}`,
    olay.cpl && `Lead maliyeti ${para(olay.cpl)}${olay.ortalamaCpl ? ` (ort. ${para(olay.ortalamaCpl)})` : ""}`,
    olay.tahminiDeger && `Değer ${para(olay.tahminiDeger)}/ay`,
    olay.olumsuzYorumSonSaat && `Son 1 saatte ${olay.olumsuzYorumSonSaat} olumsuz yorum`,
    olay.reklamDurumu === "reddedildi" && "Reklam reddedildi",
  ].filter(Boolean).join(" · ");
  const rol = (id) => BEYIN.find((b) => b.id === id);
  const adimlar = [`<li class="go"><i></i><div><b>Triyaj</b><p class="muted small">${kac(dep.ad)} departmanına yönlendirildi.</p></div></li>`];
  if (r.kesintiler.length) {
    for (const k of r.kesintiler) adimlar.push(`<li class="stop"><i></i><div><b>Durdu: ${kac(k.ad)}</b><p class="muted small">${kac(k.eylem)}.</p></div></li>`);
  } else {
    for (const id of r.adimlar.slice(1)) adimlar.push(`<li class="go"><i></i><div><b>${kac(rol(id).ad)}</b><p class="muted small">${kac(rol(id).gorev)}.</p></div></li>`);
  }
  const [sinif, baslik, alt] = r.kesintiler.length
    ? ["stop", `İş ${KIME[r.devir]} geçti`, "Yapay zekâ bu durumda kendi başına karar vermez."]
    : r.otomatik
      ? ["ok", "Sen hiçbir şey yapmadan tamamlanır", "Kurallar içinde kalan rutin iş."]
      : ["wait", "Hazırlanır, onayına gelir", "Tek dokunuşla onaylarsın; onaysız yayınlanmaz."];
  return `
    <div class="bubble"><span class="tag">${kac(sinyal.ad)} · ${kac(sinyal.kaynaklar[0])}</span>
      ${olay.metin ? `<span>${kac(olay.metin)}</span>` : ""}${ayrinti ? `<span class="muted small">${kac(ayrinti)}</span>` : ""}</div>
    <ol class="timeline">${adimlar.join("")}</ol>
    <div class="verdict ${sinif}"><b>${baslik}</b><span class="small">${alt}</span></div>`;
}

function simForm(olay) {
  const alanlar = ALANLAR[olay.sinyal] ?? [];
  return `
    <label class="f full">Ne oldu?<select id="f-sinyal">${SINYALLER.map((s) => `<option value="${s.id}" ${olay.sinyal === s.id ? "selected" : ""}>${kac(s.ad)}</option>`).join("")}</select></label>
    <label class="f full">Mesaj<textarea id="f-metin" placeholder="Örn: Bir yetkiliyle görüşmek istiyorum">${kac(olay.metin ?? "")}</textarea></label>
    ${alanlar.map(([id, ad]) => `<label class="f">${ad}<input type="number" inputmode="decimal" id="f-${id}" value="${olay[id] ?? ""}"></label>`).join("")}
    ${olay.sinyal === "reklam-performansi" ? `<label class="chk full"><input type="checkbox" id="f-reddedildi" ${olay.reklamDurumu === "reddedildi" ? "checked" : ""}>Reklam reddedildi</label>` : ""}
    ${olay.sinyal === "rakip-reklamlari" ? `<label class="chk full"><input type="checkbox" id="f-lansman" ${olay.yeniLansman ? "checked" : ""}>Yeni lansman</label>` : ""}`;
}

function simOku(sinyalDegisti) {
  const f = (id) => document.getElementById("f-" + id);
  const olay = { sinyal: f("sinyal").value, metin: f("metin").value };
  if (!sinyalDegisti) {
    for (const [id] of ALANLAR[olay.sinyal] ?? []) if (f(id) && f(id).value !== "") olay[id] = Number(f(id).value);
    if (f("reddedildi")?.checked) olay.reklamDurumu = "reddedildi";
    if (f("lansman")?.checked) olay.yeniLansman = true;
  }
  ui.olay = olay;
  document.getElementById("convo").innerHTML = akis(olay);
  for (const b of document.querySelectorAll("[data-senaryo]")) b.setAttribute("aria-pressed", "false");
  if (sinyalDegisti) {
    document.getElementById("sim").innerHTML = simForm(olay);
    document.getElementById("f-sinyal").focus();
  }
}

// ---- Maliyet ----
function maliyet() {
  const set = bagliSet();
  const kume = durum.kapsam === "tam" ? ENTEGRASYONLAR : ENTEGRASYONLAR.filter((e) => set.has(e.id));
  const toplam = aylikMaliyet(kume, durum.musteri);
  const gelir = durum.musteri * durum.paket;
  const satirlar = kume.map((e) => ({ e, t: aylikMaliyet([e], durum.musteri) })).filter((x) => x.t > 0).sort((a, b) => b.t - a.t);
  const ucretsiz = kume.filter((e) => aylikMaliyet([e], durum.musteri) === 0);
  const enCok = satirlar[0]?.t || 1;
  return `
  <section class="stack">
    <span class="tag">Tahmin · reklam bütçesi ve maaşlar hariç</span>
    <h1>Aylık ne kadar tutar?</h1>
    <p class="lead">Müşteri sayını ve paket fiyatını gir; yazılım ve yapay zekâ maliyetini gör. Fiyatlar yaklaşıktır.</p>
  </section>
  <div class="panel controls">
    <label class="f">Müşteri sayısı: <b style="color:var(--ink)">${durum.musteri}</b><input type="range" id="musteri" min="1" max="60" value="${durum.musteri}"></label>
    <label class="f">Ortalama aylık paket ($)<input type="number" id="paket" min="0" step="100" value="${durum.paket}"></label>
    <div class="f">Hesaba katılanlar<div class="seg" role="group" aria-label="Hesaba katılanlar">
      <button data-kapsam="tam" aria-pressed="${durum.kapsam === "tam"}">Tüm araçlar</button>
      <button data-kapsam="bagli" aria-pressed="${durum.kapsam === "bagli"}">Sadece bağlılar</button></div></div>
  </div>
  <div class="figures">
    <div class="panel figure hl"><span class="tag">Aylık araç maliyeti</span><b>${para(toplam)}</b><span class="muted small">Müşteri başına ${para(toplam / durum.musteri)}</span></div>
    <div class="panel figure"><span class="tag">Aylık gelir</span><b>${para(gelir)}</b><span class="muted small">${durum.musteri} müşteri × ${para(durum.paket)}</span></div>
    <div class="panel figure"><span class="tag">Gelirin yüzde kaçı</span><b>%${gelir ? ((toplam / gelir) * 100).toFixed(1) : "—"}</b><span class="muted small">Asıl gider ekip maaşlarıdır</span></div>
  </div>
  <section class="panel">
    <div style="padding:20px 22px 6px"><h2>Nereye gidiyor?</h2></div>
    <div class="bars">
      ${satirlar.map(({ e, t }) => `<div class="bar-row"><span>${kac(e.ad)} <span class="muted small">${kac(e.saglayicilar[0])}</span></span><div class="track"><span style="width:${(t / enCok) * 100}%"></span></div><span class="v">${para(t)}</span></div>`).join("")
        || `<p class="muted">Henüz bağlı araç yok. “Tüm araçlar”ı seç ya da Başla sayfasından bağla.</p>`}
      ${ucretsiz.length ? `<p class="muted small">Ücretsiz: ${ucretsiz.map((e) => kac(e.ad)).join(", ")}</p>` : ""}
    </div>
  </section>`;
}

// ---- Yönlendirme ve olaylar ----
const SAYFALAR = { basla, sistemler, ekip, maliyet };
const ESKI = { panel: "basla", entegrasyonlar: "basla" };

function sekme() {
  const h = location.hash.slice(1);
  return SAYFALAR[h] ? h : ESKI[h] ?? "basla";
}
function ciz(basaDon = true) {
  const s = sekme();
  for (const a of document.querySelectorAll("#menu a")) {
    if (a.getAttribute("href") === "#" + s) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  const y = scrollY;
  icerik.innerHTML = SAYFALAR[s]();
  ozet();
  scrollTo(0, basaDon ? 0 : y);
}

window.addEventListener("hashchange", () => ciz(true));

document.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-bagla],[data-kopar],[data-senaryo],[data-kapsam],#sifirla");
  if (!t) return;
  if (t.id === "sifirla") { durum.bagli = []; kaydet(); bildir("Tüm bağlantılar sıfırlandı"); ciz(false); }
  else if (t.dataset.bagla) bagla(t.dataset.bagla); // adresi olan yuvada bağlantı ayrıca yeni sekmede açılır
  else if (t.dataset.kopar) kopar(t.dataset.kopar);
  else if (t.dataset.senaryo) { ui.senaryo = Number(t.dataset.senaryo); ui.olay = null; ciz(false); }
  else if (t.dataset.kapsam) { durum.kapsam = t.dataset.kapsam; kaydet(); ciz(false); }
});

// Açık sistem kartı yeniden çizimde açık kalsın
document.addEventListener("toggle", (ev) => {
  if (ev.target.matches?.("details.sys")) ui.acik = ev.target.open ? ev.target.id.slice(2) : ui.acik === ev.target.id.slice(2) ? null : ui.acik;
}, true);

document.addEventListener("input", (ev) => {
  const id = ev.target.id;
  if (ev.target.closest("#sim")) return simOku(id === "f-sinyal");
  if (id === "ara") { ui.ara = ev.target.value; document.getElementById("sys-list").innerHTML = sistemListesi(); }
  else if (id === "kategori") { ui.kategori = ev.target.value; document.getElementById("sys-list").innerHTML = sistemListesi(); }
  else if (id === "musteri") { durum.musteri = Number(ev.target.value); kaydet(); ciz(false); document.getElementById("musteri").focus(); }
});
document.addEventListener("change", (ev) => {
  if (ev.target.id === "paket") { durum.paket = Math.max(0, Number(ev.target.value) || 0); kaydet(); ciz(false); }
});
document.addEventListener("submit", (ev) => ev.preventDefault());

ciz(false);
