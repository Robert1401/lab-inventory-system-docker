"use strict";

/* =========================================
   HISTORIAL DE PRÉSTAMOS
   - Carga desde /api/prestamos
   - Filtra por fecha y estatus
   - Abre detalle al hacer clic en No. vale
   - Permite volver a Prestamos.html si el estado
     sigue en pendiente o en curso
========================================= */

const API_PRESTAMOS = "/api/prestamos";

const LS_KEYS = {
  DETALLE_TMP: "LE_hist_detalle_tmp",
  PRESTAMO_DATA: "LE_prestamo_data",
  PRESTAMO_STATUS: "LE_prestamo_status",
  VALE: "LE_vale_payload"
};

const $H = (id) => document.getElementById(id);

let prestamosCache = [];

/* =========================
   Helpers
========================= */
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

function readJSON_H(k, fb = null) {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : fb;
  } catch {
    return fb;
  }
}

function setJSON_H(k, v) {
  localStorage.setItem(k, JSON.stringify(v));
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }

  return data;
}

/* =========================
   Estado / fechas
========================= */
function normalizaEstado(valor) {
  const v = String(valor || "").toLowerCase().trim();

  if (v === "pend" || v === "pendientes" || v === "pendiente") return "pendiente";
  if (v === "curso" || v === "encurso" || v === "en-curso" || v === "en_curso") return "en_curso";
  if (v === "devuelto" || v === "devueltos") return "devuelto";
  if (v === "rechazado" || v === "rechazados") return "rechazado";
  if (v === "todos") return "todos";

  return v;
}

function textoEstado(estado) {
  const e = normalizaEstado(estado);

  if (e === "pendiente") return "Pendiente";
  if (e === "en_curso") return "En curso";
  if (e === "devuelto") return "Devuelto";
  if (e === "rechazado") return "Rechazado";
  return "Desconocido";
}

function claseEstado(estado) {
  const e = normalizaEstado(estado);

  if (e === "pendiente") return "st-pendiente";
  if (e === "en_curso") return "st-en-curso";
  if (e === "devuelto") return "st-devuelto";
  if (e === "rechazado") return "st-rechazado";
  return "";
}

function fechaCoincideHist(fechaRegistro, filtroFecha) {
  if (!filtroFecha) return true;
  if (!fechaRegistro) return false;
  return String(fechaRegistro).slice(0, 10) === filtroFecha;
}

function getFiltersHist() {
  const fecha = $H("fFecha")?.value || "";
  const tipoRaw = $H("fTipo")?.value || "todos";

  return {
    fecha,
    tipo: normalizaEstado(tipoRaw)
  };
}

/* =========================
   API
========================= */
async function cargarPrestamosDesdeAPI() {
  const response = await fetchJson(API_PRESTAMOS, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  });

  const arr = Array.isArray(response.data) ? response.data : [];
  prestamosCache = arr;
  return arr;
}

/* =========================
   Render
========================= */
function renderPrestamosHist() {
  const tbody = $H("tbodyPrestamos");
  if (!tbody) return;

  const { fecha: filtroFecha, tipo } = getFiltersHist();

  let rows = prestamosCache.slice();

  rows = rows.filter((p) => {
    const estado = normalizaEstado(p.estado || "");
    if (estado === "rechazado") return false;
    if (!fechaCoincideHist(p.fecha, filtroFecha)) return false;
    if (tipo !== "todos" && estado !== tipo) return false;
    return true;
  });

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="empty">
          No hay registros que coincidan con el filtro.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((p) => {
    const estadoNorm = normalizaEstado(p.estado);
    const estadoTxt = textoEstado(estadoNorm);
    const estadoCls = claseEstado(estadoNorm);

    return `
      <tr data-id="${escapeHTML(String(p.id_Prestamo || ""))}">
        <td class="link-cell td-folio">${escapeHTML(p.noVale || "—")}</td>
        <td>
          ${escapeHTML(p.fecha || "— — —")}
          <span style="font-size:0.75rem;opacity:.7;">
            ${p.hora ? escapeHTML(" " + p.hora) : ""}
          </span>
        </td>
        <td>
          <span class="status-pill ${estadoCls}" data-status="${escapeHTML(estadoNorm)}">
            ${escapeHTML(estadoTxt)}
          </span>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("tr").forEach((tr) => {
    const id = Number(tr.dataset.id);
    const prestamo = prestamosCache.find((x) => Number(x.id_Prestamo) === id);
    if (!prestamo) return;

    const tdFolio = tr.querySelector(".td-folio");
    const pill = tr.querySelector(".status-pill");
    const estadoNorm = normalizaEstado(prestamo.estado);

    tdFolio?.addEventListener("click", () => {
      setJSON_H(LS_KEYS.DETALLE_TMP, prestamo);
      window.location.href = "DetallePrestamo.html";
    });

    if (estadoNorm === "pendiente" || estadoNorm === "en_curso") {
      pill.style.cursor = "pointer";

      pill.addEventListener("click", () => {
        setJSON_H(LS_KEYS.PRESTAMO_DATA, prestamo);
        localStorage.setItem(LS_KEYS.PRESTAMO_STATUS, estadoNorm);
        localStorage.removeItem(LS_KEYS.VALE);
        window.location.href = "Prestamos.html";
      });
    } else {
      pill.style.cursor = "default";
    }
  });
}

/* =========================
   Carga inicial
========================= */
async function initHistorialPrestamos() {
  const tbody = $H("tbodyPrestamos");

  try {
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" class="empty">
            Cargando historial...
          </td>
        </tr>
      `;
    }

    await cargarPrestamosDesdeAPI();
    renderPrestamosHist();
  } catch (err) {
    console.error("HistorialPrestamos:", err);

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" class="empty">
            No se pudo cargar el historial de préstamos.
          </td>
        </tr>
      `;
    }
  }
}

/* =========================
   Eventos
========================= */
document.addEventListener("DOMContentLoaded", () => {
  $H("btnFiltrar")?.addEventListener("click", renderPrestamosHist);

  $H("btnLimpiar")?.addEventListener("click", () => {
    if ($H("fFecha")) $H("fFecha").value = "";
    if ($H("fTipo")) $H("fTipo").value = "todos";
    renderPrestamosHist();
  });

  initHistorialPrestamos();
});