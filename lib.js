export function parseCsvSemicolon(text){
  const lines = String(text||"").replace(/^\uFEFF/,"").split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return [];
  const header = splitLine(lines[0]).map(h => h.trim());
  const rows = [];
  for (let i=1;i<lines.length;i++){
    const cols = splitLine(lines[i]);
    const row = {};
    for (let c=0;c<header.length;c++){
      row[header[c]] = (cols[c] ?? "").trim();
    }
    rows.push(row);
  }
  return rows;

  function splitLine(line){
    // Minimal CSV parser: ; delimiter, quotes supported
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i=0;i<line.length;i++){
      const ch = line[i];
      if (ch === '"'){
        if (inQ && line[i+1] === '"'){ cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ';' && !inQ){
        out.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }
}

export function euro(n){
  const v = Number(n);
  if (!Number.isFinite(v)) return "–";
  return v.toLocaleString("de-DE",{ style:"currency", currency:"EUR" });
}

export function clampNumber(n, min, max){
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}
