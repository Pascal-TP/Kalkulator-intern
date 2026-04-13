import { parseCsvSemicolon, euro, clampNumber } from "./lib.js";

let CONFIG = null;
let PRICE_ROWS = [];
let PRICE_BY_ART = new Map();

const state = {
  customerType: "ndf",
  systemTypeId: null,
  areaM2: 0,
  installers: 2,
  distanceKm: 0,
  discountPct: null,
  discountAbs: null,
  cart: [], // {artikelnummer, kurztext, ek, menge, einheit}
};

function byId(id){ return document.getElementById(id); }

async function loadConfig(){
  const res = await fetch("./config.json");
  CONFIG = await res.json();
}

async function loadPriceList(){
  const res = await fetch("./preisliste_ek.csv");
  const text = await res.text();
  PRICE_ROWS = parseCsvSemicolon(text).map(r => ({
    bereich: r["Bereich"] ?? "",
    typ: r["Typ"] ?? "",
    artikelnummer: String(r["Artikelnummer"] ?? "").trim(),
    kurztext: r["Kurztext"] ?? "",
    ek: Number(String(r["EK"] ?? "").replace(",", "."))
  })).filter(r => r.artikelnummer && Number.isFinite(r.ek));

  PRICE_BY_ART = new Map(PRICE_ROWS.map(r => [r.artikelnummer, r]));
}

function mountSystemSelect(){
  const sel = byId("systemType");
  sel.innerHTML = "";
  for (const s of CONFIG.montageleistung_m2_pro_8h_pro_monteur) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = `${s.label} (${s.value} m²/8h/Monteur)`;
    sel.appendChild(opt);
  }
  state.systemTypeId = sel.value || CONFIG.montageleistung_m2_pro_8h_pro_monteur[0]?.id || null;
}

function getSystemPerf(){
  const s = CONFIG.montageleistung_m2_pro_8h_pro_monteur.find(x => x.id === state.systemTypeId);
  return s?.value ?? 0;
}

function basis(){
  return CONFIG.basisdaten;
}

// --------- Engine (vereinfachte Excel-Logik) ----------
function calc(){
  const b = basis();
  const area = clampNumber(state.areaM2, 0, 1e9);
  const installers = clampNumber(state.installers, 1, 50);
  const perf = getSystemPerf(); // m² / 8h / Monteur

  // Montagezeit: Stunden pro Monteur = Fläche / Leistung * 8
  const hoursPerMonteur = perf > 0 ? (area / perf) * 8 : 0;
  const laborHoursTotal = hoursPerMonteur * installers;

  const laborCost = laborHoursTotal * (b.stundensatz.monteur ?? 0);

  // Material (EK)
  let materialEK = 0;
  for (const it of state.cart) {
    const qty = clampNumber(it.menge, 0, 1e9);
    materialEK += qty * it.ek;
  }

  // Zwischensumme
  const subtotal = laborCost + materialEK;

  // Gemeinkosten + Gewinn (auf subtotal)
  const overhead = subtotal * ((b.gemeinkosten_pct ?? 0) / 100);
  const profit = subtotal * ((b.gewinn_pct ?? 0) / 100);

  let total = subtotal + overhead + profit;

  // Rabattlogik
  // - optionaler Rabatt% aus Eingabe (überschreibt nicht automatisch)
  // - PJ: wenn kein Rabatt% eingegeben -> Standard aus Basisdaten (Rabatt PJ %)
  let rabattPct = null;
  if (state.discountPct != null && state.discountPct !== "") {
    rabattPct = clampNumber(state.discountPct, 0, 100);
  } else if (state.customerType === "pj") {
    rabattPct = clampNumber(b.rabatt_pj_pct ?? 0, 0, 100);
  }
  if (rabattPct != null) {
    total = total * (1 - rabattPct / 100);
  }

  // pauschaler Rabatt €
  const rabattAbs = state.discountAbs != null && state.discountAbs !== "" ? clampNumber(state.discountAbs, 0, 1e12) : null;
  if (rabattAbs != null) total = Math.max(0, total - rabattAbs);

  return {
    perf,
    hours: laborHoursTotal,
    laborCost,
    materialEK,
    subtotal,
    overhead,
    profit,
    total
  };
}

// --------- UI ----------
function renderSearch(rows){
  const tbody = byId("searchTable").querySelector("tbody");
  tbody.innerHTML = "";
  for (const r of rows.slice(0, 50)) {
    const tr = document.createElement("tr");
    tr.dataset.art = r.artikelnummer;
    tr.innerHTML = `
      <td>${escapeHtml(r.artikelnummer)}</td>
      <td>${escapeHtml(r.kurztext)}</td>
      <td class="right">${euro(r.ek)}</td>
    `;
    tr.addEventListener("click", () => {
      tbody.querySelectorAll("tr").forEach(x => x.classList.remove("selected"));
      tr.classList.add("selected");
    });
    tbody.appendChild(tr);
  }
}

function getSelectedSearchArticle(){
  const tr = byId("searchTable").querySelector("tbody tr.selected");
  if (!tr) return null;
  const art = tr.dataset.art;
  return PRICE_BY_ART.get(art) || null;
}

function renderCart(){
  const tbody = byId("cartTable").querySelector("tbody");
  tbody.innerHTML = "";
  for (const [idx, it] of state.cart.entries()) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(it.artikelnummer)}</td>
      <td>${escapeHtml(it.kurztext)}</td>
      <td class="right"><input data-idx="${idx}" class="field__control" style="width:110px" type="number" min="0" step="0.01" value="${it.menge}"></td>
      <td>${escapeHtml(it.einheit || "")}</td>
      <td class="right">${euro(it.ek)}</td>
      <td class="right">${euro(it.ek * it.menge)}</td>
      <td class="right"><button class="btn btn--ghost" data-del="${idx}">✕</button></td>
    `;
    tbody.appendChild(tr);
  }

  // qty listeners
  tbody.querySelectorAll("input[data-idx]").forEach(inp => {
    inp.addEventListener("input", () => {
      const i = Number(inp.dataset.idx);
      const v = Number(String(inp.value).replace(",", "."));
      if (Number.isFinite(v)) state.cart[i].menge = v;
      recalc();
    });
  });

  // delete listeners
  tbody.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.del);
      state.cart.splice(i, 1);
      recalc();
    });
  });
}

function recalc(){
  // read inputs
  state.customerType = byId("customerType").value;
  state.systemTypeId = byId("systemType").value;
  state.areaM2 = Number(String(byId("areaM2").value).replace(",", "."));
  state.installers = Number(String(byId("installers").value).replace(",", "."));
  state.distanceKm = Number(String(byId("distanceKm").value).replace(",", "."));
  state.discountPct = byId("discountPct").value;
  state.discountAbs = byId("discountAbs").value;

  // hint
  const h = byId("hintBox");
  const baseDisc = (basis().rabatt_pj_pct ?? 0);
  if (state.customerType === "pj" && (!state.discountPct || String(state.discountPct).trim()==="")) {
    h.innerHTML = `PJ-Standardrabatt aktiv: <strong>${baseDisc}%</strong> (überschreibbar über Rabatt %).`;
  } else {
    h.textContent = "";
  }

  const r = calc();

  byId("kpiHours").textContent = r.hours ? (r.hours.toFixed(2) + " h") : "–";
  byId("kpiLabor").textContent = euro(r.laborCost);
  byId("kpiSubtotal").textContent = euro(r.subtotal);
  byId("kpiOverhead").textContent = euro(r.overhead);
  byId("kpiProfit").textContent = euro(r.profit);
  byId("kpiTotal").textContent = euro(r.total);

  byId("matTotal").textContent = euro(r.materialEK);

  renderCart();
}

function exportCartCsv(){
  const header = ["Artikelnummer","Kurztext","Menge","Einheit","EP_EK"];
  const lines = [header.join(";")];
  for (const it of state.cart) {
    lines.push([
      it.artikelnummer,
      it.kurztext.replace(/\s+/g," ").trim(),
      String(it.menge).replace(".",","),
      it.einheit || "",
      String(it.ek).replace(".",",")
    ].map(csvEsc).join(";"));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "kalkulation_positionen.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

function csvEsc(v){
  const s = String(v ?? "");
  return (s.includes(";") || s.includes("\n") || s.includes("\"")) ? `"${s.replace(/"/g,'""')}"` : s;
}
function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

// --------- Boot ----------
async function boot(){
  await loadConfig();
  await loadPriceList();

  mountSystemSelect();

  // initial search
  renderSearch(PRICE_ROWS);

  // listeners
  ["customerType","systemType","areaM2","installers","distanceKm","discountPct","discountAbs"].forEach(id => {
    byId(id).addEventListener("input", recalc);
    byId(id).addEventListener("change", recalc);
  });

  byId("search").addEventListener("input", () => {
    const q = byId("search").value.trim().toLowerCase();
    const filtered = !q ? PRICE_ROWS : PRICE_ROWS.filter(r =>
      r.artikelnummer.toLowerCase().includes(q) || (r.kurztext || "").toLowerCase().includes(q)
    );
    renderSearch(filtered);
  });

  byId("btnAddSelected").addEventListener("click", () => {
    const r = getSelectedSearchArticle();
    if (!r) return alert("Bitte zuerst einen Artikel in der Tabelle auswählen.");
    // Wenn schon im Warenkorb: Menge +1
    const existing = state.cart.find(x => x.artikelnummer === r.artikelnummer);
    if (existing) existing.menge = clampNumber(existing.menge + 1, 0, 1e9);
    else state.cart.push({ artikelnummer: r.artikelnummer, kurztext: r.kurztext, ek: r.ek, menge: 1, einheit: "" });
    recalc();
  });

  byId("btnReset").addEventListener("click", () => {
    state.customerType = "ndf";
    state.cart = [];
    byId("customerType").value = "ndf";
    byId("areaM2").value = "";
    byId("installers").value = "2";
    byId("distanceKm").value = "";
    byId("discountPct").value = "";
    byId("discountAbs").value = "";
    recalc();
  });

  byId("btnExport").addEventListener("click", exportCartCsv);

  recalc();
}

boot().catch(err => {
  console.error(err);
  alert("Fehler beim Laden. Bitte Konsole prüfen.");
});
