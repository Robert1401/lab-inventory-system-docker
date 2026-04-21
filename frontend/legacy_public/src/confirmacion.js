"use strict";

/* ------------------------------------------------------------------
   Confirmación de Pedido
   - Lee LE_confirmacionJC o el último de LE_pedidos
   - Pinta meta y tabla correctamente
   - La casita:
       • guarda LE_confirmacionJC actualizado
       • genera LE_vale_payload para préstamos
       • marca LE_prestamo_status = "pendiente"
       • redirige al menú de alumnos
------------------------------------------------------------------- */

const REDIRECT_AL_FINALIZAR = true;
const URL_MENU_ALUMNOS = "../alumnos-inicial.html";

const LS_KEYS = {
  CONF: "LE_confirmacionJC",
  PEDS: "LE_pedidos",
  USER: "LE_user",
  VALE: "LE_vale_payload",
  PRESTAMO_STATUS: "LE_prestamo_status",
  PRESTAMO_DATA: "LE_prestamo_data",
};

const $ = (id) => document.getElementById(id);

function readJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function todayParts() {
  const d = new Date();
  return {
    yyyy: d.getFullYear(),
    mm: String(d.getMonth() + 1).padStart(2, "0"),
    dd: String(d.getDate()).padStart(2, "0"),
    hh: String(d.getHours()).padStart(2, "0"),
    mi: String(d.getMinutes()).padStart(2, "0"),
  };
}

function todayISO() {
  const { yyyy, mm, dd } = todayParts();
  return `${yyyy}-${mm}-${dd}`;
}

function nowHM() {
  const { hh, mi } = todayParts();
  return `${hh}:${mi}`;
}

/* =========================================================
   MESA AUTOMÁTICA
========================================================= */
const MESAS_TOTALES = 12;

function getMesaMapKeys() {
  const { yyyy, mm, dd } = todayParts();
  return {
    mapKey: `LE_mesa_map_${yyyy}${mm}${dd}`,
    seqKey: `LE_mesa_seq_${yyyy}${mm}${dd}`,
  };
}

function getMesaForToday(alumnoNombre) {
  const nombre = String(alumnoNombre || "").trim() || "SIN_NOMBRE";
  const { mapKey, seqKey } = getMesaMapKeys();

  const map = readJSON(mapKey, {});

  if (map[nombre]) {
    return map[nombre];
  }

  let seq = Number(readJSON(seqKey, 0)) || 0;
  seq = (seq % MESAS_TOTALES) + 1;

  localStorage.setItem(seqKey, JSON.stringify(seq));

  const mesa = `M${seq}`;
  map[nombre] = mesa;
  writeJSON(mapKey, map);

  return mesa;
}

/* =========================================================
   HELPERS DE NORMALIZACIÓN
========================================================= */
function getAlumnoNombre(alumno) {
  if (!alumno) return "";

  if (typeof alumno === "string") {
    return alumno.trim();
  }

  if (typeof alumno === "object") {
    return String(
      alumno.nombreCompleto ||
      alumno.nombre ||
      alumno.alumno ||
      ""
    ).trim();
  }

  return "";
}

function getAlumnoNoControl(alumno) {
  if (!alumno || typeof alumno !== "object") return "";
  return String(
    alumno.noControl ||
    alumno.numeroControl ||
    alumno.no_control ||
    ""
  ).trim();
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((it) => ({
      material: String(
        it.material ??
        it.nombre ??
        it.descripcion ??
        ""
      ).trim(),
      cantidad: Number(it.cantidad ?? it.qty ?? 0) || 0,
      descripcion: String(
        it.descripcion ??
        it.material ??
        it.nombre ??
        ""
      ).trim(),
    }))
    .filter((it) => it.material);
}

function getUltimoDeHistorial() {
  const historial = readJSON(LS_KEYS.PEDS, []);
  if (!Array.isArray(historial) || !historial.length) return null;
  return historial[historial.length - 1] || null;
}

/* =========================================================
   CONSTRUIR PAYLOAD BASE
========================================================= */
function buildPayloadBase() {
  let p = readJSON(LS_KEYS.CONF, null);

  if (!p) {
    p = getUltimoDeHistorial();
  }

  if (!p) {
    p = {};
  }

  const alumnoNombre = getAlumnoNombre(p.alumno);
  const alumnoNoControl =
    getAlumnoNoControl(p.alumno) ||
    String(
      readJSON(LS_KEYS.USER, null)?.numeroControl ||
      readJSON(LS_KEYS.USER, null)?.noControl ||
      ""
    ).trim();

  const fecha = String(p.fecha || todayISO()).trim();
  const hora = String(p.hora || `${nowHM()}:00`).trim();

  const folio = String(
    p.folio ||
    p.noVale ||
    ""
  ).trim();

  const materia = String(
    p.materia ||
    ""
  ).trim();

  const docente = String(
    p.docente ||
    p.maestro ||
    ""
  ).trim();

  const carrera = String(
    p.carrera ||
    ""
  ).trim();

  let mesa = String(p.mesa || "").trim();
  if (!mesa) {
    mesa = getMesaForToday(alumnoNombre);
  }

  const items = normalizeItems(p.items);

  return {
    alumno: {
      nombreCompleto: alumnoNombre,
      noControl: alumnoNoControl,
    },
    fecha,
    hora,
    folio,
    materia,
    docente,
    carrera,
    mesa,
    items,
  };
}

/* =========================================================
   RENDER
========================================================= */
function render(payload) {
  if ($("metaAlumno")) {
    $("metaAlumno").textContent = payload.alumno.nombreCompleto || "—";
  }

  if ($("metaFecha")) {
    $("metaFecha").textContent = payload.fecha || "—";
  }

  if ($("metaHora")) {
    $("metaHora").textContent = payload.hora || "—";
  }

  if ($("metaVale")) {
    $("metaVale").textContent = payload.folio || "—";
  }

  if ($("metaMateria")) {
    $("metaMateria").textContent = payload.materia || "—";
  }

  if ($("metaMaestro")) {
    $("metaMaestro").textContent = payload.docente || "—";
  }

  if ($("metaMesa")) {
    $("metaMesa").textContent = payload.mesa || "—";
  }

  const tbody = $("tbodyPedido");
  const empty = $("emptyState");

  if (!tbody) return;

  tbody.innerHTML = "";

  if (!payload.items.length) {
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;

  payload.items.forEach((it) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${it.cantidad}</td>
      <td>${it.descripcion || it.material}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* =========================================================
   ACEPTAR PEDIDO / CASITA
========================================================= */
function onAceptarPedido(payload) {
  writeJSON(LS_KEYS.CONF, {
    alumno: payload.alumno,
    fecha: payload.fecha,
    hora: payload.hora,
    folio: payload.folio,
    noVale: payload.folio,
    materia: payload.materia,
    docente: payload.docente,
    maestro: payload.docente,
    carrera: payload.carrera,
    mesa: payload.mesa,
    items: payload.items,
  });

  const valePayload = {
    fecha: payload.fecha,
    hora: payload.hora,
    noVale: payload.folio,
    materia: payload.materia,
    maestro: payload.docente,
    mesa: payload.mesa,
    alumno: {
      nombreCompleto: payload.alumno.nombreCompleto || "",
      noControl: payload.alumno.noControl || "",
    },
    items: payload.items.map((it) => ({
      material: it.material,
      cantidad: it.cantidad,
      descripcion: it.descripcion || it.material,
    })),
  };

  localStorage.setItem(LS_KEYS.VALE, JSON.stringify(valePayload));
  localStorage.setItem(LS_KEYS.PRESTAMO_STATUS, "pendiente");
  localStorage.removeItem(LS_KEYS.PRESTAMO_DATA);

  if (REDIRECT_AL_FINALIZAR) {
    window.location.href = URL_MENU_ALUMNOS;
  }
}

/* =========================================================
   INIT
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  const payload = buildPayloadBase();

  const conf = readJSON(LS_KEYS.CONF, {}) || {};
  writeJSON(LS_KEYS.CONF, {
    ...conf,
    alumno: payload.alumno,
    fecha: payload.fecha,
    hora: payload.hora,
    folio: payload.folio,
    noVale: payload.folio,
    materia: payload.materia,
    docente: payload.docente,
    maestro: payload.docente,
    carrera: payload.carrera,
    mesa: payload.mesa,
    items: payload.items,
  });

  render(payload);

  const btnHome = $("btnHome");
  if (btnHome) {
    btnHome.addEventListener("click", () => onAceptarPedido(payload));
  }

  console.group("%cConfirmación — datos vinculados", "color:#0b7a39;font-weight:700");
  console.log("LE_confirmacionJC:", readJSON(LS_KEYS.CONF, null));
  console.log("Último de LE_pedidos:", getUltimoDeHistorial());
  console.log("LE_vale_payload:", readJSON(LS_KEYS.VALE, null));
  console.log("LE_prestamo_status:", localStorage.getItem(LS_KEYS.PRESTAMO_STATUS));
  console.groupEnd();
});