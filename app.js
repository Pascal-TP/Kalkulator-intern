const steps = [
  'Projekt & Grunddaten', 'Etagen / Optionen', 'Fahrt & Personal', 'Grundparameter', 'Einzelpreise', 'Ergebnis'
];
let currentStep = 1;
let activeFloor = 0;
let prices = [];
const floors = [1,2,3,4].map(n => ({
  active: n === 1,
  name: `Etage ${n}`,
  description: n === 1 ? 'EG / Hauptfläche' : '',
  area: n === 1 ? 120 : 0,
  spacing: 15,
  insulationLayers: n === 1 ? 1 : 0,
  insulationPrice: 4.29,
  system: n === 1 ? 'Tacker' : 'Keine Auswahl',
  systemPrice: n === 1 ? 2.98 : 0,
  pipePrice: 0.60,
  foil: true,
  foilPrice: 0.35,
  thermowhite: false,
  thermoM3: 0,
  thermoPrice: 22.31,
  milling: false,
  millingPrice: 0,
  extraPriceM2: 0,
  sub: false,
  subPriceM2: 0
}));

const q = id => document.getElementById(id);
const n = id => Number(String(q(id)?.value || 0).replace(',', '.')) || 0;
const eur = v => (Number(v)||0).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
const num = v => (Number(v)||0).toLocaleString('de-DE',{minimumFractionDigits:2, maximumFractionDigits:2});
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function init(){
  renderSteps();
  renderFloorTabs();
  renderFloorEditor();
  bindEvents();
  loadCsvFromServer();
  updateAll();
}

function bindEvents(){
  document.body.addEventListener('input', e => { if(e.target.matches('input,select')) updateAll(); });
  document.body.addEventListener('change', e => { if(e.target.matches('input,select')) updateAll(); });
  q('nextBtn').addEventListener('click', () => { if(currentStep < steps.length){ currentStep++; showStep(); }});
  q('prevBtn').addEventListener('click', () => { if(currentStep > 1){ currentStep--; showStep(); }});
  q('recalcBtn').addEventListener('click', updateAll);
  q('resetBtn').addEventListener('click', () => location.reload());
  q('priceSearch').addEventListener('input', renderPriceTable);
  q('copyResultBtn').addEventListener('click', copyResult);
  q('csvUpload').addEventListener('change', handleCsvUpload);
}

function renderSteps(){
  q('stepList').innerHTML = steps.map((s,i) => `<div class="step-item clickable ${i+1===currentStep?'active':''}" data-step="${i+1}"><span class="step-number">${i+1}</span><span>${s}</span></div>`).join('');
  q('stepList').querySelectorAll('.step-item').forEach(el => el.addEventListener('click', () => { currentStep = Number(el.dataset.step); showStep(); }));
}

function showStep(){
  document.querySelectorAll('.step-panel').forEach(p => p.classList.toggle('active', Number(p.dataset.panel) === currentStep));
  q('prevBtn').disabled = currentStep === 1;
  q('nextBtn').textContent = currentStep === steps.length ? 'Fertig' : 'Weiter';
  if(currentStep === steps.length) renderResult();
  renderSteps();
}

function renderFloorTabs(){
  q('floorTabs').innerHTML = floors.map((f,i) => `<button class="summary-floor-tab ${i===activeFloor?'active':''}" data-floor="${i}">${esc(f.name)}${f.active?'':' (aus)'}</button>`).join('');
  q('floorTabs').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { activeFloor = Number(b.dataset.floor); renderFloorTabs(); renderFloorEditor(); }));
}

function renderFloorEditor(){
  const f = floors[activeFloor];
  q('floorEditor').innerHTML = `
  <div class="sub-block">
    <div class="floor-editor-head">
      <div class="field"><label>Bezeichnung</label><input class="floor-input" data-key="name" value="${esc(f.name)}"></div>
      <label class="inline-check"><input type="checkbox" data-key="active" ${f.active?'checked':''}> Etage aktiv</label>
    </div>
    <div class="form-grid">
      <div class="field"><label>Beschreibung</label><input data-key="description" value="${esc(f.description)}" placeholder="z.B. EG, OG, DG"></div>
      <div class="field"><label>Fläche (m²)</label><input type="number" step="0.01" data-key="area" value="${f.area}"></div>
    </div>
    <div class="form-grid three">
      <div class="field"><label>Verlegeabstand (cm)</label><select data-key="spacing">${[5,7.5,10,12.5,15,20,25,30,35,40].map(v=>`<option ${f.spacing==v?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label>Rohrpreis €/m</label><input type="number" step="0.01" data-key="pipePrice" value="${f.pipePrice}"></div>
      <div class="field"><label>Zusatz €/m²</label><input type="number" step="0.01" data-key="extraPriceM2" value="${f.extraPriceM2}"></div>
    </div>
  </div>
  <div class="sub-block">
    <h3>System / Ausführung</h3>
    <div class="form-grid three">
      <div class="field"><label>System</label><select data-key="system"><option>Keine Auswahl</option>${['Tacker','Klett','Noppe','Trockenbau FBH','nur Rohr Tacker','nur Rohr Klett','Fräsen'].map(v=>`<option ${f.system===v?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label>System EK €/m²</label><input type="number" step="0.01" data-key="systemPrice" value="${f.systemPrice}"></div>
      <div class="field"><label>Subunternehmer</label><select data-key="sub"><option value="false" ${!f.sub?'selected':''}>Nein</option><option value="true" ${f.sub?'selected':''}>Ja</option></select></div>
    </div>
    <div class="form-grid three">
      <div class="field"><label>Subunternehmer €/m²</label><input type="number" step="0.01" data-key="subPriceM2" value="${f.subPriceM2}"></div>
      <div class="field"><label>Fräsen aktiv</label><select data-key="milling"><option value="false" ${!f.milling?'selected':''}>Nein</option><option value="true" ${f.milling?'selected':''}>Ja</option></select></div>
      <div class="field"><label>Fräsen Zusatz €/m²</label><input type="number" step="0.01" data-key="millingPrice" value="${f.millingPrice}"></div>
    </div>
  </div>
  <div class="sub-block">
    <h3>Dämmung / Folie / ThermoWhite</h3>
    <div class="form-grid three">
      <div class="field"><label>Dämmung Lagen</label><select data-key="insulationLayers">${[0,1,2,3].map(v=>`<option ${f.insulationLayers==v?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label>Dämmung EK €/m² je Lage</label><input type="number" step="0.01" data-key="insulationPrice" value="${f.insulationPrice}"></div>
      <div class="field"><label>PE-/Rasterfolie</label><select data-key="foil"><option value="true" ${f.foil?'selected':''}>Ja</option><option value="false" ${!f.foil?'selected':''}>Nein</option></select></div>
      <div class="field"><label>Folie EK €/m²</label><input type="number" step="0.01" data-key="foilPrice" value="${f.foilPrice}"></div>
      <div class="field"><label>ThermoWhite</label><select data-key="thermowhite"><option value="false" ${!f.thermowhite?'selected':''}>Nein</option><option value="true" ${f.thermowhite?'selected':''}>Ja</option></select></div>
      <div class="field"><label>ThermoWhite Menge (m³)</label><input type="number" step="0.01" data-key="thermoM3" value="${f.thermoM3}"></div>
      <div class="field"><label>ThermoWhite EK €/m³</label><input type="number" step="0.01" data-key="thermoPrice" value="${f.thermoPrice}"></div>
    </div>
  </div>`;
  q('floorEditor').querySelectorAll('[data-key]').forEach(el => {
    el.addEventListener('input', updateFloorFromEditor);
    el.addEventListener('change', updateFloorFromEditor);
  });
}

function updateFloorFromEditor(){
  const f = floors[activeFloor];
  q('floorEditor').querySelectorAll('[data-key]').forEach(el => {
    const key = el.dataset.key;
    let val = el.type === 'checkbox' ? el.checked : el.value;
    if(['active','sub','milling','foil','thermowhite'].includes(key)) val = val === true || val === 'true';
    else if(!['name','description','system'].includes(key)) val = Number(String(val).replace(',','.')) || 0;
    f[key] = val;
  });
  renderFloorTabs();
  updateAll(false);
}

function pipeMetersPerM2(spacing){
  const map = {5:20, 7.5:15, 10:10, 12.5:8.5, 15:7, 20:5, 25:4, 30:3.5, 35:3, 40:2.5};
  return map[String(spacing)] || (100 / spacing);
}

function perfForFloor(f){
  if(f.system === 'Klett') return n('perfKlett');
  if(f.system === 'Noppe') return n('perfNoppe');
  if(f.system === 'Fräsen' || f.milling) return n('perfMilling');
  return n('perfTacker');
}

function calcFloor(f){
  if(!f.active || f.area <= 0) return {active:false, area:0, material:0, labor:0, total:0, priceM2:0, hours:0, pipeM:0};
  const waste = 1 + n('waste')/100;
  const pipeM = f.area * pipeMetersPerM2(f.spacing);
  const insulation = f.area * f.insulationLayers * f.insulationPrice * waste;
  const system = f.area * f.systemPrice * waste;
  const pipe = pipeM * f.pipePrice;
  const foil = f.foil ? f.area * f.foilPrice * waste : 0;
  const thermo = f.thermowhite ? f.thermoM3 * f.thermoPrice : 0;
  const milling = f.milling ? f.area * f.millingPrice : 0;
  const extra = f.area * f.extraPriceM2;
  const sub = f.sub ? f.area * f.subPriceM2 : 0;
  const material = insulation + system + pipe + foil + thermo + milling + extra + sub;
  const insPerf = f.insulationLayers === 1 ? n('perfIns1') : f.insulationLayers === 2 ? n('perfIns2') : f.insulationLayers === 3 ? n('perfIns3') : 0;
  const hoursIns = insPerf > 0 ? (f.area / insPerf) * 8 : 0;
  const hoursSystem = perfForFloor(f) > 0 && f.system !== 'Keine Auswahl' ? (f.area / perfForFloor(f)) * 8 : 0;
  const hoursFoil = f.foil && n('perfFoil') > 0 ? (f.area / n('perfFoil')) * 8 : 0;
  const hoursThermo = f.thermowhite && n('perfThermo') > 0 ? (f.thermoM3 / n('perfThermo')) * 8 * Math.max(1,n('workers')) : 0;
  const hours = hoursIns + hoursSystem + hoursFoil + hoursThermo;
  const avgRate = ((n('workers') * n('rateWorker')) + (n('journeymen') * n('rateJourneyman'))) / Math.max(1, n('workers') + n('journeymen'));
  const labor = hours * avgRate;
  const total = material + labor;
  return {active:true, area:f.area, material, labor, total, priceM2: total / f.area, hours, pipeM, insulation, system, pipe, foil, thermo, milling, extra, sub};
}

function calcAll(){
  const floorCalcs = floors.map(calcFloor);
  const area = floorCalcs.reduce((s,x)=>s+x.area,0);
  const material = floorCalcs.reduce((s,x)=>s+x.material,0);
  const labor = floorCalcs.reduce((s,x)=>s+x.labor,0);
  const hours = floorCalcs.reduce((s,x)=>s+x.hours,0);
  const kmCosts = q('calcKm').value === 'yes' ? n('distanceKm') * 2 * n('vehicles') * n('vehicleCostKm') : 0;
  const travelHours = q('calcKm').value === 'yes' && n('avgSpeed') > 0 ? n('distanceKm') * 2 / n('avgSpeed') * (n('workers') + n('journeymen')) : 0;
  const travelLabor = travelHours * n('rateWorker');
  const extras = kmCosts + travelLabor + n('islandFee') + n('hotelCost') + n('extraFees') + n('managerHours') * n('rateManager');
  const direct = material + labor + extras;
  const overhead = direct * n('overhead')/100;
  const subtotal = Math.max(direct + overhead, n('minJob'));
  const profit = subtotal * n('profit')/100;
  let total = subtotal + profit;
  const discount = total * n('discountPercent')/100 + n('discountFixed');
  total = Math.max(0, total - discount);
  const skonto = total * n('cashDiscount')/100;
  const afterSkonto = Math.max(0,total - skonto);
  return {floorCalcs, area, material, labor, hours, kmCosts, travelLabor, extras, direct, overhead, profit, discount, skonto, total, afterSkonto, priceM2: area ? total/area : 0, priceM2Skonto: area ? afterSkonto/area : 0};
}

function updateAll(repaintEditor=true){
  renderSummary();
  if(currentStep === 6) renderResult();
}

function renderSummary(){
  const c = calcAll();
  q('summaryContent').innerHTML = `
    <div class="summary-box calc-box"><strong>Preis netto</strong><span class="tag">${eur(c.total)}</span><span class="tag">${num(c.priceM2)} €/m²</span></div>
    <div class="summary-box"><strong>Fläche</strong>${num(c.area)} m²</div>
    <div class="summary-box"><strong>Material / Lohn</strong>${eur(c.material)} / ${eur(c.labor)}</div>
    <div class="summary-box"><strong>Stunden gesamt</strong>${num(c.hours)} h</div>
    ${floors.map((f,i)=>`<div class="summary-room-card"><div class="summary-room-title">${esc(f.name)} ${f.active?'':'(aus)'}</div><div class="summary-room-line"><span>Fläche</span><strong>${num(f.area)} m²</strong></div><div class="summary-room-line"><span>System</span><strong>${esc(f.system)}</strong></div></div>`).join('')}
  `;
}

function renderResult(){
  const c = calcAll();
  const floorRows = c.floorCalcs.map((x,i)=> x.active ? `<tr><td>${esc(floors[i].name)}</td><td>${num(x.area)} m²</td><td>${eur(x.material)}</td><td>${eur(x.labor)}</td><td>${num(x.hours)} h</td><td>${num(x.priceM2)} €/m²</td></tr>` : '').join('');
  q('resultOutput').innerHTML = `
    <div class="kpi-grid"><div class="kpi-card"><span>Gesamtpreis netto</span><strong>${eur(c.total)}</strong></div><div class="kpi-card"><span>Preis je m²</span><strong>${num(c.priceM2)} €/m²</strong></div><div class="kpi-card"><span>Gesamtfläche</span><strong>${num(c.area)} m²</strong></div><div class="kpi-card"><span>Stunden</span><strong>${num(c.hours)} h</strong></div></div>
    <div class="result-table-wrap"><table class="result-table"><thead><tr><th>Etage</th><th>Fläche</th><th>Material</th><th>Lohn</th><th>Zeit</th><th>€/m² direkt</th></tr></thead><tbody>${floorRows || '<tr><td colspan="6">Keine aktive Etage mit Fläche erfasst.</td></tr>'}</tbody></table></div>
    <div class="sub-block technical-result-box"><h3>Kostenblock</h3><div class="technical-grid"><div><span>Material</span><strong>${eur(c.material)}</strong></div><div><span>Lohn Montage</span><strong>${eur(c.labor)}</strong></div><div><span>Fahrt / Pauschalen / PL</span><strong>${eur(c.extras)}</strong></div><div><span>Direktkosten</span><strong>${eur(c.direct)}</strong></div><div><span>Gemeinkosten</span><strong>${eur(c.overhead)}</strong></div><div><span>Gewinn</span><strong>${eur(c.profit)}</strong></div><div><span>Rabatt</span><strong>${eur(c.discount)}</strong></div><div><span>Skonto nachrichtlich</span><strong>${eur(c.skonto)}</strong></div></div></div>
    <p class="warning-note">Entwurf zur internen Kalkulation. Die fachliche Prüfung der Rechenlogik, Artikelzuordnung und Montageleistungen muss durch die Verantwortlichen erfolgen.</p>`;
}

async function loadCsvFromServer(){
  try{
    const res = await fetch('preise.csv', {cache:'no-store'});
    if(res.ok){ prices = parseCsv(await res.text()); renderPriceTable(); return; }
  } catch(e) {}
  prices = [
    {artikel:'200215', name:'ROTH - Flipfix Tacker Systemplatte', ek:2.98},
    {artikel:'200145', name:'HEROTEC - Klettvlies tempusFLAT KLETT', ek:4.85},
    {artikel:'200171', name:'MAINCOR - MFL Noppenplatte Premium 11 mm', ek:6.69},
    {artikel:'200005', name:'AirPor EPS 035 DEO 20 mm', ek:1.43},
    {artikel:'200012', name:'ALUJET - Floorjet Speed Abdichtungsbahn', ek:2.23}
  ];
  renderPriceTable();
}
function parseCsv(text){
  const lines = text.split(/\r?\n/).filter(Boolean);
  const sep = lines[0]?.includes(';') ? ';' : ',';
  return lines.slice(1).map(line => {
    const parts = line.split(sep);
    return {artikel:parts[0]||'', name:parts.slice(1,-1).join(sep)||parts[1]||'', ek:Number(String(parts.at(-1)||0).replace(',','.'))||0};
  }).filter(x=>x.name || x.artikel);
}
function renderPriceTable(){
  const term = (q('priceSearch')?.value || '').toLowerCase();
  const shown = prices.filter(p => !term || (p.name+p.artikel).toLowerCase().includes(term)).slice(0,80);
  q('priceTable').querySelector('tbody').innerHTML = shown.map(p => `<tr><td>${esc(p.artikel)}</td><td>${esc(p.name)}</td><td><span class="price-pill">${eur(p.ek)}</span></td></tr>`).join('');
}
function handleCsvUpload(e){
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => { prices = parseCsv(reader.result); renderPriceTable(); };
  reader.readAsText(file, 'utf-8');
}
function copyResult(){
  const c = calcAll();
  const text = `NDF KalkPro Ergebnis\nProjekt: ${q('projectNo').value}\nKunde: ${q('customer').value}\nFläche: ${num(c.area)} m²\nGesamt netto: ${eur(c.total)}\nPreis netto: ${num(c.priceM2)} €/m²`;
  navigator.clipboard?.writeText(text);
}

document.addEventListener('DOMContentLoaded', init);
