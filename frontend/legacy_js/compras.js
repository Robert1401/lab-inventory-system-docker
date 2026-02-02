"use strict";

/* ===================== LocalStorage keys ===================== */
const LS = {
  compras:    "LE_compras",
  pendientes: "LE_carrito_pend",
  auxiliar:   "auxiliarNombre",
};

const getComprasLocal = () => {
  try { return JSON.parse(localStorage.getItem(LS.compras) || "[]"); }
  catch { return []; }
};
const getPendLocal = () => {
  try { return JSON.parse(localStorage.getItem(LS.pendientes) || "[]"); }
  catch { return []; }
};
const getAuxLocal = () => localStorage.getItem(LS.auxiliar) || "—";

/* ===================== Utils básicas ===================== */
const iso = (s) => (s || "").slice(0, 10);
function isoToDMY(isoDate){
  if(!isoDate) return "";
  const [y,m,d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}
function notifyInline(msg){
  const tb = document.getElementById("tbodyRecibo");
  if (!tb) return;
  tb.innerHTML = `<tr><td colspan="3" class="empty">${msg}</td></tr>`;
}

/* ===================== Catálogo/alias + política (igual a compra_detalle) ===================== */
function looksGenericName(name=""){
  const s = String(name).trim().toLowerCase();
  if (!s) return true;
  if (s === "(sin nombre)") return true;
  if (/^material\s*#\d+$/i.test(name)) return true;
  if (/^id\s*\d+$/i.test(name)) return true;
  return false;
}

// Índice de materiales desde LE_materiales
const MAT_INDEX = new Map();   // id (string) -> nombre
(function buildMatIndex(){
  let mats = [];
  try { mats = JSON.parse(localStorage.getItem("LE_materiales") || "[]"); } catch { mats = []; }
  for (const m of (mats || [])) {
    const id = String(m.id_Material ?? m.id ?? m.ID ?? m.id_material ?? "").trim();
    if (!id) continue;
    const nombre = m.nombre ?? m.Nombre ?? m.descripcion ?? m.Descripcion ?? m.material ?? m.Material ?? "";
    if (nombre) MAT_INDEX.set(id, nombre);
  }
})();

// Alias manuales (extiende estos si identificas más)
const NAME_ALIAS = {
  1:    "Resistor 220Ω",
  2:    "Capacitor Electrolítico 10µF",
  3:    "Protoboard 830 puntos",
  1004: "Cable Dupont M-M (paquete 40)",
  // 21:   "Cable jumper M-H (paquete 20)",
};

// Si es true, descarta (no cuenta ni muestra) los materiales sin nombre real
const FORCE_DROP_UNKNOWN = true;

function resolveMaterialName(id, nombreOriginal){
  const idStr = String(id ?? "").trim();

  // Catálogo local
  if (idStr && MAT_INDEX.has(idStr)) {
    const n = MAT_INDEX.get(idStr);
    if (n && !looksGenericName(n)) return n;
  }
  // Alias manual
  const idNum = Number(idStr);
  if (Number.isFinite(idNum) && NAME_ALIAS[idNum]) return NAME_ALIAS[idNum];

  // Nombre que venga en la compra (si sirve)
  if (nombreOriginal && !looksGenericName(nombreOriginal)) return nombreOriginal;

  // Política
  if (FORCE_DROP_UNKNOWN) return null;

  return "Material sin catálogo";
}

/* ===================== Agrupar por fecha (todas las compras) ===================== */
/** 
 * Suma cantidades de UNA compra aplicando la misma política que en compra_detalle:
 * - Solo suma items cuyo nombre se pueda resolver (catálogo/alias/nombre útil)
 * - Si FORCE_DROP_UNKNOWN=true, los desconocidos NO suman
 */
function safePurchaseTotal(compra){
  const items = Array.isArray(compra?.items) ? compra.items : [];
  let total = 0;
  for (const it of items) {
    const idM = it.id_Material ?? it.id ?? it.material_id;
    const nombre = resolveMaterialName(idM, it.nombre);
    if (nombre == null) continue; // se descarta si no se puede nombrar
    total += Number(it.cantidad || 0);
  }
  return total;
}

function groupByDateAll(purchases, includePendientes){
  const map = new Map();

  for(const c of (purchases || [])){
    const f = iso(c.fecha);
    if(!f) continue;
    const cant = safePurchaseTotal(c); // <— mismo criterio que detalle
    if(!map.has(f)) map.set(f,{ iso:f, ids:[], cantidad:0 });
    const o = map.get(f);
    o.ids.push(Number(c.id_compra));
    o.cantidad += cant;
  }

  if(includePendientes){
    for(const p of (getPendLocal() || [])){
      const f = iso(p.fechaISO);
      if(!f) continue;

      // Intento resolver nombre del pendiente también
      const idM = p.id_Material ?? p.id ?? p.material_id;
      const nombre = resolveMaterialName(idM, p.nombre);
      const cantPend = (nombre == null) ? 0 : Number(p.cantidad || 0);

      if(!map.has(f)) map.set(f,{ iso:f, ids:[], cantidad:0 });
      map.get(f).cantidad += cantPend;
    }
  }

  const arr = Array.from(map.values());
  arr.forEach(v=>{
    v.idRef = v.ids.length ? v.ids.reduce((m,x)=>Math.min(m,x), Infinity) : null;
  });
  return arr.sort((a,b)=> b.iso.localeCompare(a.iso)); // más recientes primero
}

/* ===================== Render ===================== */
function renderGroupedRows(grouped){
  const tb = document.getElementById("tbodyRecibo");
  if (!tb) return;

  if(!grouped.length){
    tb.innerHTML = `<tr><td colspan="3" class="empty">No hay compras registradas.</td></tr>`;
    return;
  }

  tb.innerHTML = grouped.map(g=>{
    const idText = (g.idRef !== null) ? String(g.idRef) : "—";
    const link = `<a href="./compra-detalle.html?fecha=${encodeURIComponent(g.iso)}"
                    title="Ver materiales de ese día"
                    style="text-decoration:none; color:#7a0000; font-weight:800">${idText}</a>`;
    return `<tr>
      <td style="text-align:center">${link}</td>
      <td>${g.cantidad}</td>
      <td>${isoToDMY(g.iso)}</td>
    </tr>`;
  }).join("");
}

/* ===================== Filtro / Búsqueda ===================== */
/**
 * Acepta:
 *  - d, dd, dd/mm, dd/mm/aaaa
 *  - cualquier cadena con dígitos (p.ej. "9" => días 09,19,29; "11" => 11/.., etc.)
 */
function filterByQuery(grouped, qRaw){
  const q = (qRaw || "").trim();
  if (!q) return grouped;

  // patrón de fecha flexible: d, dd, dd/mm, dd/mm/aaaa
  const m = q.match(/^(\d{1,2})(?:\/(\d{1,2})(?:\/(\d{4}))?)?$/);

  if (m){
    const dWanted = String(m[1]).padStart(2,"0");
    const mWanted = m[2] ? String(m[2]).padStart(2,"0") : null;
    const yWanted = m[3] || null;

    return grouped.filter(g=>{
      const [d,mm,yy] = isoToDMY(g.iso).split("/");
      if (!mWanted) {
        // solo día: contiene esos dígitos (permite "9" => 09,19,29)
        return d.includes(dWanted);
      }
      if (!yWanted) {
        // día y mes exactos
        return d === dWanted && mm === mWanted;
      }
      // día, mes y año exactos
      return d === dWanted && mm === mWanted && yy === yWanted;
    });
  }

  // Si no es formato dd/... usamos "contiene dígitos" en la fecha DMY
  const onlyDigits = q.replace(/\D/g,"");
  if (!onlyDigits) return grouped;

  return grouped.filter(g=>{
    const dmy = isoToDMY(g.iso).replace(/\D/g,""); // "ddmmyyyy"
    return dmy.includes(onlyDigits);
  });
}

/* ===================== Cargar ===================== */
async function loadAndRender(){
  const auxInfo = document.getElementById("auxInfo");
  const totales = document.getElementById("totalesInfo");
  const meta    = document.getElementById("fechaMeta");
  const qInput  = document.getElementById("qFecha");
  const btnBuscar = document.getElementById("btnBuscar");

  try {
    meta.textContent = "Todas las compras";
    auxInfo.textContent = `Auxiliar: ${getAuxLocal()}`;

    let grouped = groupByDateAll(getComprasLocal(), true);
    renderGroupedRows(grouped);
    if (totales) totales.textContent = `${grouped.length} ${grouped.length===1?"registro":"registros"}`;

    const applyFilter = ()=>{
      const q = qInput?.value || "";
      const data = filterByQuery(grouped, q);
      renderGroupedRows(data);
      if (totales) totales.textContent = `${data.length} ${data.length===1?"registro":"registros"}`;
      meta.textContent = q ? `Filtro: ${q}` : "Todas las compras";
    };

    btnBuscar?.addEventListener("click", (e)=>{ e.preventDefault(); applyFilter(); });
    qInput?.addEventListener("input", applyFilter);
    qInput?.addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); applyFilter(); }});

    // Auto-refresh si cambian datos en otra pestaña
    window.addEventListener("storage",(e)=>{
      if ([LS.compras, LS.pendientes].includes(e.key)) {
        grouped = groupByDateAll(getComprasLocal(), true);
        const q = qInput?.value || "";
        const data = filterByQuery(grouped, q);
        renderGroupedRows(data);
        if (totales) totales.textContent = `${data.length} ${data.length===1?"registro":"registros"}`;
      }
    });

  } catch (err){
    console.error("[compras.js] Error:", err);
    notifyInline("Ocurrió un error al cargar las compras.");
    if (totales) totales.textContent = "0 registros";
    if (auxInfo) auxInfo.textContent = "Auxiliar: —";
    if (meta) meta.textContent = "Todas las compras";
  }
}

document.addEventListener("DOMContentLoaded", ()=>{
  // ✅ Regresar a la página correcta
  document.getElementById("navBack")?.addEventListener("click", ()=>{
    window.location.href = "./Registro-Compras.html";
  });

  // Texto provisional mientras pinta:
  notifyInline("Cargando…");
  loadAndRender();
});
