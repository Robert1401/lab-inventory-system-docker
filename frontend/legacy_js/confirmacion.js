"use strict";

/* ------------------------------------------------------------------
   Confirmación de Pedido (vinculada a solicitud-materiales y préstamos)
   - Lee LE_confirmacionJC o último LE_pedidos
   - Pinta meta y tabla
   - La CASITA hace:
       • Guarda LE_confirmacionJC actualizado
       • Genera LE_vale_payload para Prestamos.js
       • Marca LE_prestamo_status = "pendiente"
       • Redirige al menú de alumnos SIN mostrar mensajes
------------------------------------------------------------------- */

const REDIRECT_AL_FINALIZAR = true;
const URL_MENU_ALUMNOS      = "../alumnos-inicial.html";

const LS_KEYS = {
  CONF: "LE_confirmacionJC",
  PEDS: "LE_pedidos"
};

const $ = (id) => document.getElementById(id);
const readJSON  = (k, fb=null)=>{ try{ return JSON.parse(localStorage.getItem(k)||"null") ?? fb; }catch{ return fb; } };
const writeJSON = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

const todayParts = () => {
  const d=new Date();
  return {
    yyyy: d.getFullYear(),
    mm:   String(d.getMonth()+1).padStart(2,"0"),
    dd:   String(d.getDate()).padStart(2,"0"),
    hh:   String(d.getHours()).padStart(2,"0"),
    mi:   String(d.getMinutes()).padStart(2,"0"),
  };
};
const todayISO = () => { const {yyyy,mm,dd}=todayParts(); return `${yyyy}-${mm}-${dd}`; };
const nowHM    = () => { const {hh,mi}=todayParts(); return `${hh}:${mi}`; };

/* ===== Mesa auto (M1..M12) ===== */
const MESAS_TOTALES = 12;

function getMesaMapKeys(){
  const {yyyy,mm,dd} = todayParts();
  return {
    mapKey: `LE_mesa_map_${yyyy}${mm}${dd}`,
    seqKey: `LE_mesa_seq_${yyyy}${mm}${dd}`,
  };
}
function getMesaForToday(alumno){
  const name = String(alumno||"").trim() || "SIN_NOMBRE";
  const {mapKey, seqKey} = getMesaMapKeys();
  const map = readJSON(mapKey, {});

  if (map[name]) return map[name];

  let seq = Number(readJSON(seqKey, 0)) || 0;
  seq = (seq % MESAS_TOTALES) + 1;
  writeJSON(seqKey, seq);
  const mesa = `M${seq}`;
  map[name] = mesa;
  writeJSON(mapKey, map);
  return mesa;
}

/* ===== Normalización de items ===== */
function normItems(items){
  if (!Array.isArray(items)) return [];
  return items.map(it => ({
    material: (it.material ?? it.nombre ?? it.name ?? "").toString().trim(),
    cantidad: Number(it.cantidad ?? it.qty ?? 0) || 0,
    descripcion: (it.descripcion ?? it.detalle ?? "").toString().trim()
  })).filter(x=>x.material);
}

/* ===== Fallback al último del historial ===== */
function getUltimoDeHistorial(){
  const hist = readJSON(LS_KEYS.PEDS, []);
  if (!Array.isArray(hist) || !hist.length) return null;
  return hist[hist.length-1] || null;
}

/* ===== Construye payload base (desde LE_confirmacionJC) ===== */
function buildPayloadBase(){
  let p = readJSON(LS_KEYS.CONF, null);

  // Si no hubiera nada guardado, usamos el último de LE_pedidos
  if (!p) p = getUltimoDeHistorial();
  if (!p) p = {};

  const alumno  = (p.alumno  ?? "").toString().trim();
  const carrera = (p.carrera ?? "").toString().trim();
  const materia = (p.materia ?? "").toString().trim();
  const docente = (p.docente ?? "").toString().trim();
  const folio   = (p.folio   ?? "").toString().trim();
  const fecha   = (p.fecha   ?? todayISO()).toString().trim();
  const hora    = (p.hora    ?? `${nowHM()}:00`).toString().trim();
  let   mesa    = (p.mesa    ?? "").toString().trim();

  // Si no se guardó mesa en el payload, calculamos una
  if (!mesa) mesa = getMesaForToday(alumno);

  const items = normItems(p.items);

  return { alumno, carrera, materia, docente, folio, fecha, hora, mesa, items };
}

/* ===== Render ===== */
function render(payload){
  $("metaAlumno")  && ( $("metaAlumno").textContent  = payload.alumno  || "—" );
  $("metaFecha")   && ( $("metaFecha").textContent   = payload.fecha   || "—" );
  $("metaHora")    && ( $("metaHora").textContent    = payload.hora    || "—" );
  $("metaVale")    && ( $("metaVale").textContent    = payload.folio   || "—" );
  $("metaMateria") && ( $("metaMateria").textContent = payload.materia || "—" );
  $("metaMaestro") && ( $("metaMaestro").textContent = payload.docente || "—" );
  $("metaMesa")    && ( $("metaMesa").textContent    = payload.mesa    || "—" );

  const tbody = $("tbodyPedido");
  const empty = $("emptyState");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (!payload.items.length){
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  payload.items.forEach(it=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${it.cantidad}</td>
      <td>${it.descripcion || it.material}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ===== Handler de “Aceptar pedido” (lo dispara la casita) ===== */
function onAceptarPedido(payload){
  // 1) Guardar confirmación normal
  writeJSON(LS_KEYS.CONF, payload);

  // 2) Obtener número de control del alumno
  let noControl = "";
  try {
    const u = JSON.parse(localStorage.getItem("LE_user") || "null");
    noControl = u?.noControl || u?.nocontrol || u?.numeroControl || "";
  } catch {}

  // 3) Construir VALE para Prestamos.js
  const valePayload = {
    fecha:   payload.fecha,
    hora:    payload.hora,
    noVale:  payload.folio,
    materia: payload.materia,
    maestro: payload.docente,
    mesa:    payload.mesa,
    alumno: {
      nombreCompleto: payload.alumno || "",
      noControl
    },
    items: payload.items.map(it => ({
      material: it.material,
      cantidad: it.cantidad,
      descripcion: it.descripcion
    }))
  };

  // 4) Dejar todo listo para la pantalla de préstamos
  localStorage.setItem("LE_vale_payload", JSON.stringify(valePayload));
  localStorage.setItem("LE_prestamo_status", "pendiente");
  localStorage.removeItem("LE_prestamo_data");

  // 5) Redirigir sin mostrar mensajes
  if (REDIRECT_AL_FINALIZAR) {
    window.location.href = URL_MENU_ALUMNOS;
  }
}

/* ===== Init ===== */
document.addEventListener("DOMContentLoaded", ()=>{
  const payload = buildPayloadBase();

  // Sincronizar mesa en LE_confirmacionJC si venía vacía
  const conf = readJSON(LS_KEYS.CONF, null) || {};
  if (!conf.mesa && payload.mesa){
    writeJSON(LS_KEYS.CONF, { ...conf, ...payload });
  }

  render(payload);

  // Casita que sustituye al botón "Aceptar pedido"
  const btnHome = document.getElementById("btnHome");
  if (btnHome) {
    btnHome.addEventListener("click", () => onAceptarPedido(payload));
  }

  console.group('%cConfirmación — datos vinculados','color:#0b7a39;font-weight:700');
  console.log('LE_confirmacionJC:', readJSON(LS_KEYS.CONF, null));
  console.log('Último de LE_pedidos:', getUltimoDeHistorial());
  console.log('LE_vale_payload:', readJSON("LE_vale_payload", null));
  console.log('LE_prestamo_status:', localStorage.getItem("LE_prestamo_status"));
  console.groupEnd();
});

document.addEventListener("DOMContentLoaded", () => {
  const payload = buildPayloadBase();

  // Actualizar LE_confirmacionJC con la mesa si venía vacía
  const conf = readJSON(LS_KEYS.CONF, null) || {};
  if (!conf.mesa && payload.mesa) {
    writeJSON(LS_KEYS.CONF, { ...conf, ...payload });
  }

  render(payload);

  // La casita hace la función de "Aceptar pedido"
  const btnHome = document.getElementById("btnHome");
  if (btnHome) {
    btnHome.addEventListener("click", () => onAceptarPedido(payload));
  }

  console.group('%cConfirmación — datos vinculados','color:#0b7a39;font-weight:700');
  console.log('LE_confirmacionJC:', readJSON(LS_KEYS.CONF, null));
  console.log('Último de LE_pedidos:', getUltimoDeHistorial());
  console.log('LE_vale_payload:', readJSON("LE_vale_payload", null));
  console.log('LE_prestamo_status:', localStorage.getItem("LE_prestamo_status"));
  console.groupEnd();
});
