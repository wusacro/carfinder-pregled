// Preglednik izvoza. Čita podaci.json, po potrebi ih otključa lozinkom i
// iscrtava tablicu i kartu. Nema poslužitelja i nema nijedne radnje koja
// bi išta mijenjala - to je i smisao: "samo gledanje" ovdje nije postavka
// nego činjenica, jer takvih funkcija u ovoj datoteci nema.

const STUPCI = [
  { k: "naslov", n: "Auto", tip: "auto" },
  { k: "cijena", n: "Cijena", tip: "broj", jed: " €" },
  { k: "pad", n: "Pad", tip: "pad" },
  { k: "stojiDana", n: "Stoji", tip: "stoji" },
  { k: "trziste", n: "Tržište", tip: "postotak" },
  { k: "pogon", n: "Pogon", tip: "pogon" },
  { k: "boja", n: "Boja", tip: "boja" },
  { k: "km", n: "km", tip: "broj" },
  { k: "godina", n: "1. reg.", tip: "broj" },
  { k: "mjesto", n: "Mjesto", tip: "tekst" },
  { k: "doZg", n: "Do ZG", tip: "broj", jed: " km" },
  { k: "pdv", n: "PDV", tip: "pdv" },
  { k: "vlasnika", n: "Povijest", tip: "povijest" },
  { k: "opremaBroj", n: "Oprema", tip: "oprema" },
];

// Iste kratice koje nosi tablica u aplikaciji (USAGE_FLAG_SHORT).
const OZNAKE = { EX_RENTAL: "RC", EMPLOYEE_CAR: "ZP", DEMO_CAR: "DE" };
const POGON = {
  PLUG_IN_HYBRID: "e-Hybrid", MILD_HYBRID: "mild", PETROL: "benzinac",
  DIESEL: "dizel", ELECTRIC: "struja",
};
const BOJE = {
  CRNA: "crna", BIJELA: "bijela", SIVA: "siva", SREBRNA: "srebrna",
  PLAVA: "plava", CRVENA: "crvena", ZELENA: "zelena", SMEDA: "smeđa",
  ZUTA: "žuta", NARANCASTA: "narančasta", LJUBICASTA: "ljubičasta",
};

let podaci = null;
let odabrani = 0;
let sort = { k: "cijena", smjer: 1 };
let karta = null;
// Prikaz i odabrani Target žive u adresi, pa se poveznica može poslati
// takva kakva je - "pogledaj kartu Formentora" je onda jedna adresa, a ne
// upute u tri koraka.
let naKarti = /[#&]karta=1/.test(location.hash);

const hr = new Intl.NumberFormat("hr-HR");

function boja(delta) {
  if (delta == null) return "#475569";
  if (delta <= -10) return "#047857";
  if (delta <= 0) return "#4d7c0f";
  if (delta <= 10) return "#c2410c";
  return "#b91c1c";
}

function celija(o, s) {
  const v = s.k === "opremaBroj" ? o.oprema.length : o[s.k];

  if (s.tip === "auto") {
    const oznake = (o.oznake ?? [])
      .map((z) => `<span class="oznaka" title="${esc(z.naziv)} — ${esc(z.opis)}">${OZNAKE[z.k] ?? z.k}</span>`)
      .join(" ");
    const pracen = o.pracen ? ' <span class="oznaka" title="Praćen">★</span>' : "";
    return `<a href="${o.url}" target="_blank" rel="noopener">${esc(o.naslov ?? "bez naslova")}</a> ${oznake}${pracen}`;
  }
  if (v == null || v === "") return '<span class="prazno">—</span>';
  if (s.tip === "broj") return hr.format(Math.round(v)) + (s.jed ?? "");
  if (s.tip === "pad") return `<span class="pad">▼ ${hr.format(Math.round(v))}</span>`;
  // Ispod 14 dana se ne prikazuje, isto kao u aplikaciji: dok oglas nije
  // odstajao, brojka ne govori ništa o prodavatelju.
  if (s.tip === "stoji") return v < 14 ? '<span class="prazno">—</span>' : v + " d";
  if (s.tip === "postotak") {
    const z = Math.round(v);
    return `<span style="color:${boja(v)}">${z > 0 ? "+" : ""}${z} %</span>`;
  }
  if (s.tip === "pogon") return POGON[v] ?? v;
  if (s.tip === "boja") return `<span title="${esc(o.bojaTekst ?? "")}">${BOJE[v] ?? v}</span>`;
  if (s.tip === "pdv") {
    if (v === "ELIGIBLE_NOW") return '<span class="dobro">ne</span>';
    const fali = [
      o.pdvMj ? `+${o.pdvMj} mj.` : null,
      o.pdvKm ? `+${hr.format(o.pdvKm)} km` : null,
    ].filter(Boolean).join(" ");
    return `<span class="lose">DA</span> <span class="prazno">${fali}</span>`;
  }
  if (s.tip === "povijest") {
    const d = [];
    if (o.vlasnika != null) d.push(`<span title="Vlasnika">${o.vlasnika}v</span>`);
    if (o.servisna) d.push(`<span class="dobro" title="Servisna: ${esc(o.servisna)}">SK</span>`);
    if (o.jamstvo === true) d.push('<span class="dobro" title="Ima jamstvo">J</span>');
    else if (o.jamstvo === false) d.push('<span class="prazno" title="Bez jamstva">J</span>');
    return d.join(" ") || '<span class="prazno">—</span>';
  }
  if (s.tip === "oprema") {
    const naj = podaci.targeti[odabrani].najviseOpreme || 1;
    const post = Math.round((v / naj) * 100);
    return `<span class="traka"><span style="width:${post}%"></span></span> <span class="prazno">${v}</span>`;
  }
  return esc(String(v));
}

function esc(s) {
  return String(s).replace(/[<>&"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
}

function redovi() {
  const t = podaci.targeti[odabrani];
  const broj = (id) => {
    const v = document.getElementById(id).value.trim();
    return v === "" ? null : Number(v);
  };
  const upit = document.getElementById("trazi").value.trim().toLowerCase();
  const cijenaOd = broj("cijenaOd"), cijenaDo = broj("cijenaDo");
  const kmOd = broj("kmOd"), kmDo = broj("kmDo");
  const pogonF = document.getElementById("pogonF").value;
  const bojaF = document.getElementById("bojaF").value;
  const samoBezPdv = document.getElementById("samoBezPdv").checked;

  let r = t.oglasi;
  if (upit) r = r.filter((o) => (o.naslov ?? "").toLowerCase().includes(upit));
  // Oglas bez cijene ili kilometraže NE ispada iz raspona: nepoznato nije
  // isto što i izvan granica, a ispasti tiho je gore nego pojaviti se.
  if (cijenaOd != null) r = r.filter((o) => o.cijena == null || o.cijena >= cijenaOd);
  if (cijenaDo != null) r = r.filter((o) => o.cijena == null || o.cijena <= cijenaDo);
  if (kmOd != null) r = r.filter((o) => o.km == null || o.km >= kmOd);
  if (kmDo != null) r = r.filter((o) => o.km == null || o.km <= kmDo);
  if (pogonF) r = r.filter((o) => o.pogon === pogonF);
  if (bojaF) r = r.filter((o) => o.boja === bojaF);
  if (samoBezPdv) r = r.filter((o) => o.pdv === "ELIGIBLE_NOW");

  const vrij = (o) => (sort.k === "opremaBroj" ? o.oprema.length : o[sort.k]);
  const s = STUPCI.find((x) => x.k === sort.k);
  return [...r].sort((a, b) => {
    const va = vrij(a), vb = vrij(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (s?.tip === "tekst" || s?.tip === "auto" || s?.tip === "pogon" || s?.tip === "boja")
      return String(va).localeCompare(String(vb), "hr") * sort.smjer;
    return (va - vb) * sort.smjer;
  });
}

function crtajTablicu() {
  const r = redovi();
  const glava = STUPCI.map(
    (s) =>
      `<th class="${s.tip === "tekst" ? "" : "d"}" data-k="${s.k}">${s.n}${
        sort.k === s.k ? (sort.smjer === 1 ? " ▲" : " ▼") : ""
      }</th>`,
  ).join("");
  const tijelo = r
    .map(
      (o) =>
        "<tr>" +
        STUPCI.map(
          (s) => `<td class="${s.tip === "tekst" ? "" : "d"}">${celija(o, s)}</td>`,
        ).join("") +
        "</tr>",
    )
    .join("");
  document.getElementById("tablica").innerHTML =
    `<thead><tr>${glava}</tr></thead><tbody>${tijelo}</tbody>`;
  document.querySelectorAll("th[data-k]").forEach((th) => {
    th.onclick = () => {
      const k = th.dataset.k;
      sort = { k, smjer: sort.k === k ? -sort.smjer : 1 };
      zapisiAdresu();
      crtajTablicu();
    };
  });
}

function crtajKartu() {
  const el = document.getElementById("karta");
  if (karta) { karta.remove(); karta = null; }
  karta = L.map(el);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18, attribution: "© OpenStreetMap",
  }).addTo(karta);
  const grupe = new Map();
  for (const o of redovi()) {
    if (o.lat == null) continue;
    const kljuc = `${o.lat.toFixed(4)}|${o.lon.toFixed(4)}`;
    if (!grupe.has(kljuc)) grupe.set(kljuc, { lat: o.lat, lon: o.lon, mjesto: o.mjesto, o: [] });
    grupe.get(kljuc).o.push(o);
  }
  const tocke = [];
  for (const g of grupe.values()) {
    const naj = g.o.reduce((n, o) => (o.trziste == null ? n : n == null ? o.trziste : Math.min(n, o.trziste)), null);
    L.circleMarker([g.lat, g.lon], {
      radius: Math.min(6 + Math.sqrt(g.o.length) * 3, 18),
      color: "#0f172a", fillColor: boja(naj), fillOpacity: 0.95, weight: 1.5,
    })
      .addTo(karta)
      .bindPopup(
        `<strong>${g.mjesto ?? "?"}</strong> · ${g.o.length}<br>` +
          g.o.slice(0, 10).map((o) =>
            `<a href="${o.url}" target="_blank" rel="noopener">${(o.naslov ?? "").slice(0, 44)}</a> — ${
              o.cijena != null ? hr.format(o.cijena) + " €" : "—"
            }`).join("<br>"),
      );
    tocke.push([g.lat, g.lon]);
  }
  if (tocke.length) karta.fitBounds(L.latLngBounds(tocke), { padding: [25, 25] });
  else karta.setView([51, 10], 6);
}

// Filtri žive u adresi, kao i odabrani Target i prikaz. Time se filtrirani
// pogled može poslati kakav jest - "evo ti eTSI od 29 do 30 tisuća" je onda
// jedna poveznica, a ne upute u pet koraka.
const POLJA = ["trazi", "cijenaOd", "cijenaDo", "kmOd", "kmDo", "pogonF", "bojaF"];

function zapisiAdresu() {
  const p = new URLSearchParams();
  p.set("t", String(odabrani));
  if (naKarti) p.set("karta", "1");
  for (const id of POLJA) {
    const v = document.getElementById(id).value.trim();
    if (v) p.set(id, v);
  }
  if (document.getElementById("samoBezPdv").checked) p.set("bezPdv", "1");
  if (sort.k !== "cijena" || sort.smjer !== 1) p.set("sort", `${sort.k}:${sort.smjer}`);
  history.replaceState(null, "", "#" + p.toString());
}

function citajAdresu() {
  const p = new URLSearchParams(location.hash.slice(1));
  for (const id of POLJA) {
    const v = p.get(id);
    if (v != null) document.getElementById(id).value = v;
  }
  document.getElementById("samoBezPdv").checked = p.get("bezPdv") === "1";
  const s = p.get("sort");
  if (s) {
    const [k, smjer] = s.split(":");
    sort = { k, smjer: Number(smjer) === -1 ? -1 : 1 };
  }
}

function osvjezi() {
  const r = redovi();
  const uk = podaci.targeti[odabrani].oglasa;
  document.getElementById("brojac").textContent =
    r.length === uk ? `${uk} oglasa` : `${r.length} od ${uk}`;
  if (naKarti) crtajKartu(); else crtajTablicu();
}

function napuniIzbornike() {
  const t = podaci.targeti[odabrani];
  const puni = (id, kljuc, nazivi) => {
    const el = document.getElementById(id);
    const prije = el.value;
    const vrijednosti = [...new Set(t.oglasi.map((o) => o[kljuc]).filter(Boolean))].sort();
    el.innerHTML =
      `<option value="">${el.dataset.sve}</option>` +
      vrijednosti.map((v) => `<option value="${v}">${nazivi[v] ?? v}</option>`).join("");
    if (vrijednosti.includes(prije)) el.value = prije;
  };
  puni("pogonF", "pogon", POGON);
  puni("bojaF", "boja", BOJE);
}

function pokreni() {
  document.getElementById("app").hidden = false;
  document.getElementById("izvezeno").textContent =
    "podaci od " + new Date(podaci.izvezeno).toLocaleString("hr-HR");
  const kartice = document.getElementById("kartice");
  kartice.innerHTML = podaci.targeti
    .map((t, i) => `<button data-i="${i}">${t.naziv.split("·")[0].trim()} <span class="sivo">${t.oglasa}</span></button>`)
    .join("");
  const oznaci = () =>
    kartice.querySelectorAll("button").forEach((b, i) =>
      b.classList.toggle("aktivan", i === odabrani));
  kartice.querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      odabrani = Number(b.dataset.i);
      oznaci(); napuniIzbornike(); zapisiAdresu(); osvjezi();
    };
  });
  const izAdrese = /[#&]t=(\d+)/.exec(location.hash);
  if (izAdrese) odabrani = Math.min(Number(izAdrese[1]), podaci.targeti.length - 1);
  oznaci();
  document.getElementById("karta").hidden = !naKarti;
  document.getElementById("omot").hidden = naKarti;
  document.getElementById("prikaz").textContent = naKarti ? "Tablica" : "Karta";
  document.getElementById("pogonF").dataset.sve = "Svaki pogon";
  document.getElementById("bojaF").dataset.sve = "Svaka boja";
  napuniIzbornike();
  // Filtri iz adrese se čitaju PRIJE prvog crtanja, inače se prvo
  // iscrta nefiltrirano pa tek onda primijeni - i to se vidi kao trzaj.
  citajAdresu();
  const promjena = () => { zapisiAdresu(); osvjezi(); };
  for (const id of ["trazi", "cijenaOd", "cijenaDo", "kmOd", "kmDo"])
    document.getElementById(id).oninput = promjena;
  for (const id of ["pogonF", "bojaF", "samoBezPdv"])
    document.getElementById(id).onchange = promjena;
  document.getElementById("ocisti").onclick = () => {
    for (const id of ["trazi", "cijenaOd", "cijenaDo", "kmOd", "kmDo", "pogonF", "bojaF"])
      document.getElementById(id).value = "";
    document.getElementById("samoBezPdv").checked = false;
    zapisiAdresu();
    osvjezi();
  };
  document.getElementById("prikaz").onclick = () => {
    naKarti = !naKarti;
    zapisiAdresu();
    document.getElementById("karta").hidden = !naKarti;
    document.getElementById("omot").hidden = naKarti;
    document.getElementById("prikaz").textContent = naKarti ? "Tablica" : "Karta";
    osvjezi();
  };
  osvjezi();
}

async function otkljucaj(sifra, lozinka) {
  const enc = new TextEncoder();
  const osnova = await crypto.subtle.importKey("raw", enc.encode(lozinka), "PBKDF2", false, ["deriveKey"]);
  const kljuc = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: b64(sifra.sol), iterations: 250000, hash: "SHA-256" },
    osnova, { name: "AES-GCM", length: 256 }, false, ["decrypt"],
  );
  const spojeno = new Uint8Array([...b64(sifra.sadrzaj), ...b64(sifra.oznaka)]);
  const otvoreno = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64(sifra.iv) }, kljuc, spojeno,
  );
  return JSON.parse(new TextDecoder().decode(otvoreno));
}

function b64(s) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

(async () => {
  const sirovo = await (await fetch("podaci.json")).json();
  if (!sirovo.sifrirano) { podaci = sirovo; pokreni(); return; }

  const prijava = document.getElementById("prijava");
  prijava.hidden = false;
  const polje = document.getElementById("lozinka");
  const greska = document.getElementById("greska");
  const probaj = async (lozinka) => {
    try {
      podaci = await otkljucaj(sirovo, lozinka);
      localStorage.setItem("carfinder-lozinka", lozinka);
      prijava.hidden = true;
      pokreni();
    } catch {
      greska.textContent = "Lozinka nije točna.";
      localStorage.removeItem("carfinder-lozinka");
    }
  };
  document.getElementById("otkljucaj").onclick = () => probaj(polje.value);
  polje.onkeydown = (e) => { if (e.key === "Enter") probaj(polje.value); };
  // Zapamćena lozinka: da se ne upisuje svaki put na mobitelu.
  const zapamcena = localStorage.getItem("carfinder-lozinka");
  if (zapamcena) probaj(zapamcena);
  polje.focus();
})();
