"use strict";

/* =========================================
   devolucion.js (Alumno) — MEJORADO
   Flujo:
   1) Lee usuario logueado
   2) Intenta consultar préstamos al backend
   3) Busca préstamo activo del alumno
   4) Si no lo encuentra, usa fallback de localStorage
   5) Muestra datos y materiales
   6) Al confirmar, marca devuelto_solicitado=true
========================================= */

const API_PRESTAMOS = "/api/prestamos";

const D_KEYS = {
  USER: "LE_user",
  STATUS: "LE_prestamo_status",
  DATA: "LE_prestamo_data"
};

const state = {
  usuario: null,
  prestamoActivo: null,
  cargando: false
};

const $ = (id) => document.getElementById(id);

/* ========== STORAGE ========== */
function readJSON(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function setJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ========== HELPERS ========== */
function titleCase(str = "") {
  return String(str)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatHoyISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function normalizeNC(v) {
  return String(v ?? "").trim();
}

function getUsuarioActual() {
  const user = readJSON(D_KEYS.USER, {}) || {};
  state.usuario = user;
  return user;
}

function getNumeroControlUsuario() {
  const u = getUsuarioActual();

  const posibles = [
    u?.numeroControl,
    u?.noControl,
    u?.control,
    u?.id,
    u?.usuario?.numeroControl,
    u?.alumno?.numeroControl
  ];

  for (const val of posibles) {
    const limpio = normalizeNC(val);
    if (limpio) return limpio;
  }

  return "";
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Error HTTP ${res.status}`);
  }

  if (data?.ok === false || data?.success === false) {
    throw new Error(data?.message || data?.error || "Operación no válida");
  }

  return data;
}

async function apiListPrestamos() {
  return fetchJson(API_PRESTAMOS, { method: "GET" });
}

/* ========== NOTICE ========== */
function showNotice({
  title = "Listo",
  message = "",
  type = "info",
  duration = 2200
} = {}) {
  const host = $("noticeHost");
  if (!host) return;

  const iconMap = {
    success: "✔️",
    info: "ℹ️",
    warn: "⚠️",
    error: "⛔"
  };

  const icon = iconMap[type] || iconMap.info;

  host.innerHTML = `
    <div class="notice-card">
      <div class="notice-head">
        <div class="notice-icon ${type}">${icon}</div>
        <div>
          <h3 class="notice-title">${title}</h3>
          <p class="notice-msg">${message}</p>
        </div>
      </div>
    </div>
  `;

  host.classList.add("show");

  clearTimeout(showNotice._t);
  showNotice._t = setTimeout(() => {
    host.classList.remove("show");
    host.innerHTML = "";
  }, duration);

  host.onclick = () => {
    clearTimeout(showNotice._t);
    host.classList.remove("show");
    host.innerHTML = "";
  };
}

/* ========== MATCH PRESTAMO ========== */
function esPrestamoActivo(p) {
  const estado = String(p?.estado || "").trim().toLowerCase();
  return estado === "aprobado" || estado === "en_curso";
}

function tieneItems(p) {
  return Array.isArray(p?.items) && p.items.length > 0;
}

function encontrarPrestamoActivo(prestamos, numeroControl) {
  if (!Array.isArray(prestamos)) return null;

  const nc = normalizeNC(numeroControl);

  const delAlumno = prestamos.filter((p) => {
    const pNC = normalizeNC(p?.numeroControl || p?.alumno?.noControl);
    return pNC === nc;
  });

  if (!delAlumno.length) return null;

  const activosConItems = delAlumno.filter((p) => esPrestamoActivo(p) && tieneItems(p));
  if (activosConItems.length) {
    return activosConItems[0];
  }

  const activos = delAlumno.filter((p) => esPrestamoActivo(p));
  if (activos.length) {
    return activos[0];
  }

  return null;
}

function obtenerPrestamoLocalValido(numeroControl) {
  const local = readJSON(D_KEYS.DATA, null);
  const status = String(localStorage.getItem(D_KEYS.STATUS) || "").trim().toLowerCase();

  if (!local) return null;

  const ncLocal = normalizeNC(local?.numeroControl || local?.alumno?.noControl);
  const ncUser = normalizeNC(numeroControl);

  if (ncLocal && ncUser && ncLocal !== ncUser) return null;

  const estadoLocal = String(local?.estado || status || "").trim().toLowerCase();

  if ((estadoLocal === "aprobado" || estadoLocal === "en_curso") && tieneItems(local)) {
    return local;
  }

  return null;
}

/* ========== RENDER ========== */
function renderLista(items = []) {
  const lista = $("listaPrestamos");
  if (!lista) return;

  lista.innerHTML = "";

  if (!Array.isArray(items) || !items.length) {
    lista.innerHTML = `
      <div class="item" style="justify-content:center;color:#777">
        No hay materiales pendientes por devolver.
      </div>
    `;
    return;
  }

  items.forEach((it, idx) => {
    const material = it.material || it.descripcion || `Material ${idx + 1}`;
    const cantidad = Number(it.cantidad || 0);

    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `
      <i class="fa-solid fa-clipboard-list icono"></i>
      <input type="text" value="${material} — x${cantidad}" readonly>
    `;
    lista.appendChild(row);
  });
}

function setValue(id, value) {
  const el = $(id);
  if (el) el.value = value ?? "";
}

function renderPrestamo(loan) {
  renderLista(loan.items || []);

  setValue("fecha", formatHoyISO());
  setValue("noVale", loan.noVale || "");
  setValue("materia", loan.materia || "");
  setValue("maestro", loan.maestro || "");
  setValue("mesa", loan.mesa || "");
  setValue("numeroControl", loan.numeroControl || loan.alumno?.noControl || "");
  setValue("alumno", titleCase(loan.alumno?.nombre || ""));

  const btn = $("btnConfirmar");
  if (btn) btn.disabled = false;
}

function renderSinPrestamo() {
  renderLista([]);

  setValue("fecha", formatHoyISO());
  setValue("noVale", "");
  setValue("materia", "");
  setValue("maestro", "");
  setValue("mesa", "");
  setValue("numeroControl", "");
  setValue("alumno", "");

  const btn = $("btnConfirmar");
  if (btn) btn.disabled = true;
}

function renderError(message) {
  const lista = $("listaPrestamos");
  if (lista) {
    lista.innerHTML = `
      <div class="item" style="justify-content:center;color:#991b1b">
        ${message}
      </div>
    `;
  }

  const btn = $("btnConfirmar");
  if (btn) btn.disabled = true;
}

/* ========== CARGA PRINCIPAL ========== */
async function cargarPrestamoActivo() {
  state.cargando = true;

  try {
    const numeroControl = getNumeroControlUsuario();

    if (!numeroControl) {
      const local = obtenerPrestamoLocalValido("");
      if (local) {
        state.prestamoActivo = local;
        renderPrestamo(local);
        return;
      }

      throw new Error("No se encontró el número de control del alumno.");
    }

    let prestamo = null;

    try {
      const resp = await apiListPrestamos();
      const prestamos = Array.isArray(resp.data) ? resp.data : [];
      prestamo = encontrarPrestamoActivo(prestamos, numeroControl);
    } catch (apiErr) {
      console.warn("No se pudo consultar backend, usando fallback local:", apiErr);
    }

    if (!prestamo) {
      prestamo = obtenerPrestamoLocalValido(numeroControl);
    }

    state.prestamoActivo = prestamo || null;

    if (!prestamo) {
      renderSinPrestamo();
      showNotice({
        title: "Sin préstamo activo",
        message: "No hay materiales para devolver.",
        type: "warn"
      });
      return;
    }

    const snapshot = {
      ...prestamo,
      alumno: prestamo.alumno || {
        nombre: "",
        noControl: prestamo.numeroControl || numeroControl
      }
    };

    setJSON(D_KEYS.DATA, snapshot);
    localStorage.setItem(D_KEYS.STATUS, snapshot.estado || "aprobado");

    renderPrestamo(snapshot);
  } catch (err) {
    console.error("cargarPrestamoActivo:", err);

    const local = obtenerPrestamoLocalValido(getNumeroControlUsuario());
    if (local) {
      state.prestamoActivo = local;
      renderPrestamo(local);
      return;
    }

    renderError(err.message || "No se pudo cargar la devolución.");
    showNotice({
      title: "Error",
      message: err.message || "No se pudo cargar la devolución.",
      type: "error",
      duration: 2600
    });
  } finally {
    state.cargando = false;
  }
}

/* ========== ACCIONES ========== */
function confirmarDevolucion() {
  const loan = state.prestamoActivo;

  if (!loan || !Array.isArray(loan.items) || !loan.items.length) {
    showNotice({
      title: "Nada que devolver",
      message: "No hay préstamo activo.",
      type: "warn"
    });
    return;
  }

  const fechaDev = $("fecha")?.value || formatHoyISO();

  const actualizado = {
    ...loan,
    devuelto_solicitado: true,
    devuelto_en_solicitud: new Date().toISOString(),
    devolucion_meta: {
      fecha: fechaDev
    }
  };

  setJSON(D_KEYS.DATA, actualizado);
  localStorage.setItem(D_KEYS.STATUS, loan.estado || "aprobado");

  showNotice({
    title: "Devolución registrada",
    message: "Espera a que el auxiliar revise el material.",
    type: "success",
    duration: 1800
  });

  setTimeout(() => {
    window.location.href = "../alumnos-inicial.html";
  }, 1200);
}

function cancelar() {
  showNotice({
    title: "Cancelado",
    message: "Regresando al menú…",
    type: "info",
    duration: 1200
  });

  setTimeout(() => {
    window.location.href = "../alumnos-inicial.html";
  }, 900);
}

/* ========== INIT ========== */
document.addEventListener("DOMContentLoaded", async () => {
  setValue("fecha", formatHoyISO());

  $("btnConfirmar")?.addEventListener("click", confirmarDevolucion);
  $("btnCancelar")?.addEventListener("click", cancelar);

  await cargarPrestamoActivo();
});