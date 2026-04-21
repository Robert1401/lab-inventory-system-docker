"use strict";

/* =========================================================
   DetallePrestamo.js
   - Lee detalle temporal desde localStorage
   - Si falta información, intenta recuperar desde /api/prestamos
   - Muestra meta + tabla de materiales
========================================================= */

const API_PRESTAMOS = "/api/prestamos";

const $d = (id) => document.getElementById(id);

function safeParseJSON(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function escapeHTML(str = "") {
  return String(str).replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    };
    return map[char] || char;
  });
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      `Error HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function getStoredDetail() {
  return safeParseJSON(localStorage.getItem("LE_hist_detalle_tmp"), null);
}

function getLookupKeys(detail) {
  if (!detail) {
    return {
      idPrestamo: "",
      folio: "",
      noVale: ""
    };
  }

  return {
    idPrestamo: String(detail.id_Prestamo || "").trim(),
    folio: String(detail.folio || "").trim(),
    noVale: String(detail.noVale || "").trim()
  };
}

async function fetchPrestamoFromAPI(detailHint) {
  const { idPrestamo, folio, noVale } = getLookupKeys(detailHint);

  if (!idPrestamo && !folio && !noVale) {
    return null;
  }

  const apiData = await fetchJson(API_PRESTAMOS, { method: "GET" });
  const rows = Array.isArray(apiData?.data) ? apiData.data : [];

  if (!rows.length) {
    return null;
  }

  let found = null;

  if (idPrestamo) {
    found = rows.find(
      (row) => String(row.id_Prestamo || "").trim() === idPrestamo
    );
  }

  if (!found && folio) {
    found = rows.find(
      (row) =>
        String(row.folio || row.noVale || "").trim() === folio
    );
  }

  if (!found && noVale) {
    found = rows.find(
      (row) =>
        String(row.noVale || row.folio || "").trim() === noVale
    );
  }

  return found || null;
}

function getAlumnoNombre(prestamo) {
  if (!prestamo) return "Alumno";

  if (prestamo.alumno) {
    if (typeof prestamo.alumno === "string") {
      return prestamo.alumno.trim() || "Alumno";
    }

    const alumnoObj = prestamo.alumno;
    const nombre =
      alumnoObj.nombre ||
      alumnoObj.nombreCompleto ||
      prestamo.alumnoNombre ||
      "";

    return nombre.trim() || "Alumno";
  }

  return String(prestamo.alumnoNombre || "Alumno").trim() || "Alumno";
}

function getNoControl(prestamo) {
  if (!prestamo) return "—";

  if (prestamo.alumno && typeof prestamo.alumno === "object") {
    return String(
      prestamo.alumno.noControl ||
      prestamo.numeroControl ||
      prestamo.noControl ||
      "—"
    ).trim() || "—";
  }

  return String(
    prestamo.numeroControl ||
    prestamo.noControl ||
    "—"
  ).trim() || "—";
}

function getFolio(prestamo) {
  return String(
    prestamo?.folio ||
    prestamo?.noVale ||
    "—"
  ).trim() || "—";
}

function getFecha(prestamo) {
  return String(prestamo?.fecha || "— — —").trim() || "— — —";
}

function getHora(prestamo) {
  return String(prestamo?.hora || "").trim();
}

function getMateria(prestamo) {
  return String(prestamo?.materia || "—").trim() || "—";
}

function getMaestro(prestamo) {
  return String(prestamo?.maestro || "—").trim() || "—";
}

function getMesa(prestamo) {
  return String(prestamo?.mesa || "—").trim() || "—";
}

function getEstado(prestamo) {
  const estado = normalizeText(prestamo?.estado || "");
  if (!estado) return "—";

  if (estado === "pendiente") return "Pendiente";
  if (estado === "en_curso") return "En curso";
  if (estado === "devuelto") return "Devuelto";
  if (estado === "rechazado") return "Rechazado";

  return prestamo.estado;
}

function getItems(prestamo) {
  if (!Array.isArray(prestamo?.items)) return [];

  return prestamo.items.map((item) => ({
    material: String(
      item.material ||
      item.descripcion ||
      item.nombre ||
      "—"
    ).trim() || "—",
    cantidad:
      item.cantidad != null && item.cantidad !== ""
        ? Number(item.cantidad)
        : "—",
    condicion:
      item.condicion != null && item.condicion !== ""
        ? String(item.condicion)
        : "",
    okCantidad:
      item.ok_cantidad != null && item.ok_cantidad !== ""
        ? Number(item.ok_cantidad)
        : null,
    daniadoCantidad:
      item.daniado_cantidad != null && item.daniado_cantidad !== ""
        ? Number(item.daniado_cantidad)
        : null
  }));
}

function renderEmpty(message = "No se encontró información del préstamo seleccionado.") {
  const metaDiv = $d("detalleMeta");
  const tbody = $d("detalleTbody");

  if (metaDiv) {
    metaDiv.innerHTML = `<p>${escapeHTML(message)}</p>`;
  }

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="2" class="empty">Sin datos.</td></tr>`;
  }
}

function renderMeta(prestamo) {
  const metaDiv = $d("detalleMeta");
  if (!metaDiv) return;

  const fecha = getFecha(prestamo);
  const hora = getHora(prestamo);
  const folio = getFolio(prestamo);
  const materia = getMateria(prestamo);
  const maestro = getMaestro(prestamo);
  const mesa = getMesa(prestamo);
  const alumnoNombre = getAlumnoNombre(prestamo);
  const noCtrl = getNoControl(prestamo);
  const estado = getEstado(prestamo);

  metaDiv.innerHTML = `
    <p><b>No. vale:</b> ${escapeHTML(folio)}</p>
    <p><b>Fecha:</b> ${escapeHTML(fecha)}${hora ? ` &nbsp; ${escapeHTML(hora)}` : ""}</p>
    <p><b>Materia:</b> ${escapeHTML(materia)}</p>
    <p><b>Maestro:</b> ${escapeHTML(maestro)}</p>
    <p><b>Mesa:</b> ${escapeHTML(mesa)}</p>
    <p><b>Alumno:</b> ${escapeHTML(alumnoNombre)} &nbsp;&nbsp; <b>No. control:</b> ${escapeHTML(noCtrl)}</p>
    <p><b>Estatus:</b> ${escapeHTML(estado)}</p>
  `;
}

function renderItems(prestamo) {
  const tbody = $d("detalleTbody");
  if (!tbody) return;

  const items = getItems(prestamo);

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="2" class="empty">Sin materiales registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  items.forEach((item) => {
    const tr = document.createElement("tr");

    let cantidadTexto = item.cantidad;

    if (item.okCantidad != null || item.daniadoCantidad != null || item.condicion) {
      const extras = [];

      if (item.okCantidad != null) {
        extras.push(`Buen estado: ${item.okCantidad}`);
      }

      if (item.daniadoCantidad != null) {
        extras.push(`Dañado: ${item.daniadoCantidad}`);
      }

      if (item.condicion) {
        extras.push(`Condición: ${item.condicion}`);
      }

      cantidadTexto = `
        <div>${item.cantidad}</div>
        <div style="font-size:12px; opacity:.8; margin-top:4px;">${escapeHTML(extras.join(" | "))}</div>
      `;
    } else {
      cantidadTexto = escapeHTML(String(item.cantidad));
    }

    tr.innerHTML = `
      <td>${escapeHTML(item.material)}</td>
      <td>${cantidadTexto}</td>
    `;

    tbody.appendChild(tr);
  });
}

async function resolvePrestamoDetail() {
  const stored = getStoredDetail();

  if (!stored) {
    return null;
  }

  const hasUsefulData =
    Array.isArray(stored.items) && stored.items.length > 0;

  if (hasUsefulData) {
    return stored;
  }

  try {
    const fromApi = await fetchPrestamoFromAPI(stored);
    return fromApi || stored;
  } catch (error) {
    console.error("No se pudo consultar /api/prestamos:", error);
    return stored;
  }
}

async function initDetallePrestamo() {
  const metaDiv = $d("detalleMeta");
  const tbody = $d("detalleTbody");

  if (metaDiv) {
    metaDiv.innerHTML = "<p>Cargando detalle del préstamo...</p>";
  }

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="2" class="empty">Cargando...</td></tr>`;
  }

  try {
    const prestamo = await resolvePrestamoDetail();

    if (!prestamo) {
      renderEmpty();
      return;
    }

    renderMeta(prestamo);
    renderItems(prestamo);
  } catch (error) {
    console.error("Error al cargar detalle del préstamo:", error);
    renderEmpty("Ocurrió un error al cargar el detalle del préstamo.");
  }
}

document.addEventListener("DOMContentLoaded", initDetallePrestamo);