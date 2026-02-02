"use strict";

const LS_KEYS = {
  PEDIDOS: "LE_pedidos",
  DETALLE_TMP: "LE_hist_detalle_tmp"
};

const $H = (id) => document.getElementById(id);

const readJSON_H = (k, fb = []) => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : fb;
  } catch {
    return fb;
  }
};

/* ==== Normalización de estado ==== */
function normalizaEstado(valor) {
  const v = String(valor || "").toLowerCase().trim();

  if (v === "pendientes" || v === "pend" || v === "pendiente") return "pendiente";
  if (v === "en-curso" || v === "curso" || v === "encurso")   return "en_curso";
  if (v === "devueltos" || v === "devuelto")                  return "devuelto";
  if (v === "rechazado" || v === "rechazados")                return "rechazado";
  if (v === "todos")                                          return "todos";

  return v;
}

/* === Filtros === */

function getFiltersHist() {
  const fechaInput = $H("fFecha");
  const tipoInput  = $H("fTipo");

  const fecha = fechaInput ? fechaInput.value : "";
  const tipoRaw = tipoInput ? tipoInput.value : "todos";

  const tipo = normalizaEstado(tipoRaw || "todos");

  return { fecha, tipo };
}

function fechaCoincideHist(fechaRegistro, filtroFecha) {
  if (!filtroFecha) return true;
  if (!fechaRegistro) return false;
  return fechaRegistro === filtroFecha;
}

/* === Render de préstamos === */

function renderPrestamosHist() {
  const tbody = $H("tbodyPrestamos");
  if (!tbody) return;

  const hist = readJSON_H(LS_KEYS.PEDIDOS, []);
  if (!hist.length) {
    tbody.innerHTML = `
      <tr><td colspan="3" class="empty">
        No hay préstamos registrados todavía.
      </td></tr>`;
    return;
  }

  const { fecha: filtroFecha, tipo } = getFiltersHist();

  tbody.innerHTML = "";
  let count = 0;

  const vistos = new Set();   // para no repetir VALES

  for (let i = hist.length - 1; i >= 0; i--) {
    const p = hist[i];

    const folio = p.folio || p.noVale || "—";
    const fecha = p.fecha || "";
    const hora  = p.hora  || "";

    if (folio !== "—" && vistos.has(folio)) continue;
    if (folio !== "—") vistos.add(folio);

    let rawEst = normalizaEstado(p.estado || "");
    if (!rawEst) {
      if (p.devuelto_en) rawEst = "devuelto";
      else if (p.aprobado_en || p.aprobadoEn) rawEst = "en_curso";
      else rawEst = "pendiente";
    }

    // si está rechazado, no lo mostramos nunca
    if (rawEst === "rechazado") continue;

    const estadoParaFiltro = rawEst;

    if (!fechaCoincideHist(fecha, filtroFecha)) continue;
    if (tipo !== "todos" && estadoParaFiltro !== tipo) continue;

    let textoEst = "En curso";
    let clsEst   = "st-en-curso";

    if (rawEst === "pendiente") {
      textoEst = "Pendiente";
      clsEst   = "st-pendiente";
    } else if (rawEst === "devuelto") {
      textoEst = "Devuelto";
      clsEst   = "st-devuelto";
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="link-cell td-folio">${folio}</td>
      <td>${fecha || "— — —"}
        <span style="font-size:0.75rem;opacity:.7;">
          ${hora ? " " + hora : ""}
        </span>
      </td>
      <td>
        <span class="status-pill ${clsEst}">${textoEst}</span>
      </td>
    `;
    tbody.appendChild(tr);
    count++;

    const tdFolio = tr.querySelector(".td-folio");
    tdFolio.addEventListener("click", () => {
      localStorage.setItem(LS_KEYS.DETALLE_TMP, JSON.stringify(p));
      window.location.href = "DetallePrestamo.html";
    });

    const pill = tr.querySelector(".status-pill");

    if (rawEst === "devuelto") {
      pill.style.cursor = "default";
    } else if (rawEst === "en_curso" || rawEst === "pendiente") {
      pill.style.cursor = "pointer";
      pill.addEventListener("click", () => {
        localStorage.setItem("LE_prestamo_data", JSON.stringify(p));
        localStorage.setItem("LE_prestamo_status", rawEst || "en_curso");
        localStorage.removeItem("LE_vale_payload");

        window.location.href = "Prestamos.html";
      });
    }
  }

  if (!count) {
    tbody.innerHTML = `
      <tr><td colspan="3" class="empty">
        No hay registros que coincidan con el filtro.
      </td></tr>`;
  }
}

/* === INIT === */

document.addEventListener("DOMContentLoaded", () => {
  $H("btnFiltrar")?.addEventListener("click", renderPrestamosHist);

  $H("btnLimpiar")?.addEventListener("click", () => {
    if ($H("fFecha")) $H("fFecha").value = "";
    if ($H("fTipo"))  $H("fTipo").value  = "todos";
    renderPrestamosHist();
  });

  renderPrestamosHist();
});
