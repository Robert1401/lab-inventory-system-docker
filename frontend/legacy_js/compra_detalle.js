"use strict";

/* ============================================================================
   compra_detalle.js (versión corregida y completa)
   - Forzado de nombres de material (sin “Material #…” ni “(Sin nombre)”)
   - Si no se puede resolver el nombre, se oculta la fila
   - Mantiene compatibilidad con API (try/catch) y usa fallback local
============================================================================ */

/* ===================== Config API (opcional) ===================== */
const API_BASE = `${window.location.origin}/backend/api_lab_elec.php`;

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { ok: false, error: "BAD_JSON", raw: text }; }
  if (!res.ok || data.ok === false) throw new Error((data && (data.message || data.error)) || `HTTP ${res.status}`);
  return data;
}
async function apiGetDetallePorFecha(fechaISO){ return fetchJson(`${API_BASE}?view=compra&fecha=${encodeURIComponent(fechaISO)}`); }
async function apiGetCompraPorId(id){ return fetchJson(`${API_BASE}?view=compra&id=${encodeURIComponent(id)}`); }

/* ===================== LocalStorage ===================== */
const LS = { materiales: "LE_materiales", compras: "LE_compras", auxiliar: "auxiliarNombre" };
const getMatsLocal    = () => { try { return JSON.parse(localStorage.getItem(LS.materiales) || "[]"); } catch { return []; } };
const getComprasLocal = () => { try { return JSON.parse(localStorage.getItem(LS.compras)    || "[]"); } catch { return []; } };
const getAuxLocal     = () => localStorage.getItem(LS.auxiliar) || "Juan Vázquez Rodríguez";

/* ===================== Alias y políticas ===================== */
/** Mapa de alias para IDs que no estén en el catálogo local */
const NAME_ALIAS = {
  1:    "Resistor 220Ω",
  2:    "Capacitor Electrolítico 10µF",
  3:    "Protoboard 830 puntos",
  1004: "Cable Dupont M-M (paquete 40)",
  // 21: "Cable jumper M-H (paquete 20)",  // <- descomenta / edita si conoces el nombre
};

/** Si true, oculta filas cuyo nombre no pueda resolverse */
const FORCE_DROP_UNKNOWN = true;

/* ===================== Utils ===================== */
function q(key){ const p = new URLSearchParams(location.search); return p.get(key) || ""; }
function isoToDMY(iso){ if(!iso) return ""; const [y,m,d] = iso.slice(0,10).split("-"); return `${d}/${m}/${y}`; }
function escapeHTML(s=""){ return String(s).replace(/[&<>"]/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c])); }
function setInlineEmpty(msg){ const tb = document.getElementById("tbodyDetalle"); tb.innerHTML = `<tr><td colspan="2" class="empty">${msg}</td></tr>`; }
function looksGenericName(name=""){
  const s = String(name).trim().toLowerCase();
  if (!s) return true;
  if (s === "(sin nombre)") return true;
  if (/^material\s*#\d+$/i.test(name)) return true;
  if (/^id\s*\d+$/i.test(name)) return true;
  return false;
}

/* ===================== Índice de materiales (catálogo local) ===================== */
const MAT_INDEX = new Map();   // id (string) -> nombre
(function buildMatIndex(){
  const mats = getMatsLocal();
  for (const m of mats) {
    const id = String(m.id_Material ?? m.id ?? m.ID ?? m.id_material ?? "").trim();
    if (!id) continue;
    const nombre = m.nombre ?? m.Nombre ?? m.descripcion ?? m.Descripcion ?? m.material ?? m.Material ?? "";
    if (nombre) MAT_INDEX.set(id, nombre);
  }
})();

/* ===================== Resolución de nombre ===================== */
function resolveMaterialName(id, nombreOriginal){
  const idStr = String(id ?? "").trim();

  // 1) Catálogo local
  if (idStr && MAT_INDEX.has(idStr)) {
    const n = MAT_INDEX.get(idStr);
    if (n && !looksGenericName(n)) return n;
  }

  // 2) Alias manual
  const idNum = Number(idStr);
  if (Number.isFinite(idNum) && NAME_ALIAS[idNum]) return NAME_ALIAS[idNum];

  // 3) Nombre que venga en la compra (si es útil)
  if (nombreOriginal && !looksGenericName(nombreOriginal)) return nombreOriginal;

  // 4) Política de desconocidos
  if (FORCE_DROP_UNKNOWN) return null;

  // 5) Último recurso si no queremos ocultar:
  return "Material sin catálogo";
}

/* ===================== Render ===================== */
function renderRows(items, totalLabel){
  const tb = document.getElementById("tbodyDetalle");
  if (!items.length){ setInlineEmpty("Sin materiales para mostrar."); return; }
  let total = 0;
  const rows = items.map(it => {
    const c = Number(it.cantidad || 0); total += c;
    return `<tr><td>${escapeHTML(it.nombre)}</td><td>${c}</td></tr>`;
  });
  rows.push(`<tr>
    <td style="text-align:right; font-weight:800; border-top:2px solid #8b0000;">${totalLabel}</td>
    <td style="font-weight:800; border-top:2px solid #8b0000;">${total}</td>
  </tr>`);
  tb.innerHTML = rows.join("");
}

/* ===================== Vista por fecha / por id ===================== */
async function showByDate(fechaISO){
  document.getElementById("metaFecha").textContent = `Fecha de ingreso: ${isoToDMY(fechaISO)}`;

  // Intento vía API
  try {
    const resp = await apiGetDetallePorFecha(fechaISO);
    const generalId = resp.generalId ?? null;
    document.getElementById("idCompra").textContent = generalId !== null ? String(generalId) : "—";
    document.getElementById("auxInfo").textContent = `Auxiliar: ${resp.auxiliar || "—"}`;

    const fixed = (Array.isArray(resp.items) ? resp.items : [])
      .map(it => {
        const idM = it.id_Material ?? it.id ?? it.material_id;
        const nombre = resolveMaterialName(idM, it.nombre);
        return { nombre, cantidad: Number(it.cantidad || 0) };
      })
      .filter(x => x.nombre != null);

    renderRows(fixed, "Total del día");
    return;
  } catch {/* caemos al local */}
  
  // Fallback local: sumar todas las compras del día
  const compras = getComprasLocal().filter(c => (c.fecha||"").slice(0,10) === fechaISO);
  if (!compras.length){
    document.getElementById("idCompra").textContent = "—";
    setInlineEmpty("No hay compras registradas en esta fecha.");
    return;
  }

  // id de compra más bajo del día como referencia (N. Compra)
  const idGeneral = Math.min(...compras.map(c => Number(c.id_compra) || Infinity).filter(n => !Number.isNaN(n)));
  document.getElementById("idCompra").textContent = String(idGeneral);
  document.getElementById("auxInfo").textContent = `Auxiliar: ${getAuxLocal()}`;

  // Sumar cantidades por id_Material
  const sum = new Map(); // id_Material -> cantidad
  for (const c of compras){
    for (const it of (c.items||[])){
      const idM = it.id_Material ?? it.id ?? it.material_id;
      sum.set(idM, (sum.get(idM)||0) + Number(it.cantidad||0));
    }
  }

  const items = Array.from(sum.entries())
    .map(([idM, cant])=>{
      const nombre = resolveMaterialName(idM, "");
      return { nombre, cantidad: cant };
    })
    .filter(x => x.nombre != null)
    .sort((a,b)=> a.nombre.localeCompare(b.nombre,"es"));

  renderRows(items, "Total del día");
}

async function showById(id){
  // Intento vía API
  try {
    const resp = await apiGetCompraPorId(id);
    const c = resp.compra;
    document.getElementById("idCompra").textContent = String(c.id_compra);
    document.getElementById("metaFecha").textContent = `Fecha de ingreso: ${isoToDMY((c.fecha||"").slice(0,10))}`;
    document.getElementById("auxInfo").textContent = `Auxiliar: ${c.auxiliar || "—"}`;

    const items = (Array.isArray(c.items) ? c.items : [])
      .map(it => {
        const idM = it.id_Material ?? it.id ?? it.material_id;
        const nombre = resolveMaterialName(idM, it.nombre);
        return { nombre, cantidad: Number(it.cantidad||0) };
      })
      .filter(x => x.nombre != null);

    renderRows(items, "Total compra");
    return;
  } catch {/* caemos al local */}
  
  // Fallback local por id
  const compra = getComprasLocal().find(x => Number(x.id_compra) === Number(id));
  if (!compra){
    document.getElementById("idCompra").textContent = id;
    document.getElementById("metaFecha").textContent = "—";
    setInlineEmpty("No se encontró la compra.");
    return;
  }

  document.getElementById("idCompra").textContent = String(compra.id_compra);
  document.getElementById("metaFecha").textContent = `Fecha de ingreso: ${isoToDMY((compra.fecha||"").slice(0,10))}`;
  document.getElementById("auxInfo").textContent = `Auxiliar: ${getAuxLocal()}`;

  const items = (compra.items||[])
    .map(it=>{
      const idM = it.id_Material ?? it.id ?? it.material_id;
      const nombre = resolveMaterialName(idM, it.nombre);
      return { nombre, cantidad: Number(it.cantidad||0) };
    })
    .filter(x => x.nombre != null);

  renderRows(items, "Total compra");
}

/* ===================== Init ===================== */
document.addEventListener("DOMContentLoaded", ()=>{
  document.getElementById("navBack")?.addEventListener("click", ()=>{ window.location.href = "compras.html"; });
  const id    = q("id");
  const fecha = q("fecha");
  if (fecha){ showByDate(fecha.slice(0,10)); return; }
  if (id){ showById(id); return; }
  document.getElementById("idCompra").textContent = "—";
  document.getElementById("metaFecha").textContent = "—";
  setInlineEmpty('Parámetros inválidos. Usa <code>?fecha=YYYY-MM-DD</code> o <code>?id=N</code>.');
});
