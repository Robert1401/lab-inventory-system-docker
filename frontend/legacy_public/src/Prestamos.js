"use strict";

/* =========================================================
   PRESTAMOS.JS — CORREGIDO
========================================================= */

/* =========================
   CONFIG
========================= */
const API_PRESTAMOS = "/api/prestamos";
const API_MATERIALES = "/api/materiales";

const KEYS = {
  VALE: "LE_vale_payload",
  FORM: "LE_form_ctx",
  USER: "LE_user",
  TMP: "LE_tmp_solicitud_vale",
  NUM: "LE_num_vale",
  STATUS: "LE_prestamo_status",
  DATA: "LE_prestamo_data",
};

const SESSION_KEYS = {
  SYNCING_VALE: "LE_syncing_vale_noVale",
  SYNCED_VALE: "LE_synced_vale_noVale",
};

/* =========================
   HELPERS
========================= */
const $ = (id) => document.getElementById(id);
const qs = (s) => document.querySelector(s);

const readJSON = (k, fb = null) => {
  try {
    return JSON.parse(localStorage.getItem(k) || "null") ?? fb;
  } catch {
    return fb;
  }
};

const setJSON = (k, v) => {
  localStorage.setItem(k, JSON.stringify(v));
};

const removeAccents = (s = "") =>
  String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const norm = (s = "") =>
  removeAccents(String(s)).toLowerCase().replace(/\s+/g, " ").trim();

const titleCase = (s = "") =>
  String(s)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

const nowHMS = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

function normalizeItemsAny(items) {
  if (!Array.isArray(items)) return [];
  return items.map((x) => ({
    material: x.material ?? x.nombre ?? x.name ?? x.etiqueta ?? x.descripcion ?? "",
    cantidad: Number.isFinite(x.cantidad) ? x.cantidad : parseInt(x.cantidad, 10) || 1,
    descripcion: x.descripcion ?? x.desc ?? x.detalle ?? x.material ?? x.nombre ?? "",
    id_Material: Number(x.id_Material || x.id_material || x.id || 0) || 0,
  }));
}

/* =========================
   FETCH
========================= */
async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || `Error HTTP ${res.status}`;
    throw new Error(msg);
  }

  if (data?.ok === false || data?.success === false) {
    throw new Error(data?.message || data?.error || "Operación no válida");
  }

  return data;
}

async function apiListPrestamos() {
  return fetchJson(API_PRESTAMOS, { method: "GET" });
}

async function apiCreatePrestamo(payload) {
  return fetchJson(API_PRESTAMOS, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function apiAprobarPrestamo(idPrestamo) {
  return fetchJson(`${API_PRESTAMOS}/${encodeURIComponent(idPrestamo)}/aprobar`, {
    method: "PUT",
  });
}

async function apiRechazarPrestamo(idPrestamo) {
  return fetchJson(`${API_PRESTAMOS}/${encodeURIComponent(idPrestamo)}/rechazar`, {
    method: "PUT",
  });
}

async function apiRegistrarDevolucion(idPrestamo, items) {
  return fetchJson(`${API_PRESTAMOS}/${encodeURIComponent(idPrestamo)}/devolucion`, {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
}

async function apiListMateriales() {
  return fetchJson(API_MATERIALES, { method: "GET" });
}

/* =========================
   UI TOAST
========================= */
function toast(msg, type = "info", ms = 1600) {
  const id = "toast-prestamos";
  let host = document.getElementById(id);

  if (!host) {
    host = document.createElement("div");
    host.id = id;
    host.style.cssText =
      "position:fixed;inset:auto 20px 20px auto;z-index:99999;max-width:360px";
    document.body.appendChild(host);
  }

  const card = document.createElement("div");
  card.style.cssText =
    "margin-top:10px;border-radius:12px;padding:10px 12px;color:#fff;box-shadow:0 10px 24px rgba(0,0,0,.25);font:14px/1.3 system-ui,Segoe UI,Roboto,Arial";
  card.style.background =
    type === "success"
      ? "#065f46"
      : type === "error"
      ? "#991b1b"
      : type === "warn"
      ? "#92400e"
      : "#1f2937";

  card.textContent = msg;
  host.appendChild(card);

  setTimeout(() => card.remove(), ms);
}

/* =========================
   UI NOTIFY
========================= */
function notify(message, type = "info", opts = {}) {
  const host = $("notify");
  if (!host) return;

  const title =
    opts.title ||
    (type === "ok" ? "Éxito" : type === "err" ? "Error" : "Aviso");

  const autoClose = Number.isFinite(opts.autoClose) ? opts.autoClose : 1600;
  const buttons = Array.isArray(opts.buttons) ? opts.buttons : [];

  const btnsHTML = buttons
    .map(
      (b, i) =>
        `<button type="button" class="nbtn ${b.kind || "nbtn-ghost"}" data-idx="${i}">${b.text}</button>`
    )
    .join("");

  host.innerHTML = `
    <style>
      #notify{
        display:grid;
        place-items:center;
        position:fixed;
        inset:0;
        pointer-events:none;
        z-index:99999;
      }
      #notify .card{
        min-width:280px;
        max-width:520px;
        border-radius:16px;
        padding:14px 16px;
        color:#fff;
        box-shadow:0 18px 48px rgba(0,0,0,.28);
        font-weight:600;
        opacity:0;
        transform:translateY(10px) scale(.98);
        transition:opacity .22s ease,transform .22s ease;
        pointer-events:auto;
      }
      #notify.show .card{
        opacity:1;
        transform:translateY(0) scale(1);
      }
      .ok{background:#065f46}
      .err{background:#991b1b}
      .info{background:#1f2937}
      .title-mini{
        font-weight:800;
        margin:0 0 4px;
        font-size:14px
      }
      .nrow{
        display:flex;
        gap:10px;
        justify-content:flex-end;
        margin-top:10px
      }
      .nbtn{
        padding:8px 12px;
        border-radius:10px;
        border:1px solid rgba(255,255,255,.25);
        background:rgba(255,255,255,.12);
        color:#fff;
        cursor:pointer;
        font-weight:700
      }
      .nbtn:hover{filter:brightness(1.08)}
      .nbtn-primary{background:#fff;color:#065f46;border-color:#fff}
      .nbtn-danger{background:#fff;color:#991b1b;border-color:#fff}
    </style>
    <div class="card ${type}">
      <div class="title-mini">${title}</div>
      <div>${message}</div>
      ${btnsHTML ? `<div class="nrow">${btnsHTML}</div>` : ""}
    </div>
  `;

  host.classList.add("show");

  if (buttons.length) {
    host.querySelectorAll(".nbtn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx, 10);
        const def = buttons[idx];
        try {
          def?.action?.();
        } finally {
          host.classList.remove("show");
          host.innerHTML = "";
        }
      });
    });
  }

  clearTimeout(notify._t);
  if (autoClose && !buttons.length) {
    notify._t = setTimeout(() => {
      host.classList.remove("show");
      host.innerHTML = "";
    }, autoClose);
  }
}

/* =========================
   ESTADO GLOBAL
========================= */
const state = {
  prestamos: [],
  materiales: [],
  actual: null,
  solicitudActiva: false,
  cargando: false,
};

let loadAllInFlight = false;
let actionInFlight = false;
let syncInFlight = false;
let storageReloadTimer = null;

/* =========================
   STORAGE
========================= */
function getStatusLocal() {
  return localStorage.getItem(KEYS.STATUS) || "pendiente";
}

function setStatusLocal(v) {
  localStorage.setItem(KEYS.STATUS, v);
}

function pushAlumnoInbox(noControl, mensaje) {
  if (!noControl || !mensaje) return;

  const key = `LE_inbox_${noControl}`;
  const inbox = readJSON(key, []);
  inbox.push({
    ts: `${todayISO()} ${nowHMS()}`,
    mensaje,
  });
  setJSON(key, inbox);
}

function clearValeLocal() {
  localStorage.removeItem(KEYS.VALE);
  localStorage.removeItem(KEYS.FORM);
  localStorage.removeItem(KEYS.TMP);
  localStorage.removeItem(KEYS.NUM);
}

/* =========================
   MAPEOS
========================= */
function getPayloadFromLocalVale() {
  let p = readJSON(KEYS.VALE, null);

  if (!p) {
    const d = readJSON(KEYS.DATA, null);
    if (d && d.items) {
      const al = d.alumno || {};
      p = {
        fecha: d.fecha || "",
        hora: d.hora || "",
        noVale: d.noVale || d.folio || "",
        materia: d.materia || "",
        maestro: d.maestro || "",
        mesa: d.mesa || "",
        alumno: {
          nombreCompleto: al.nombreCompleto || al.nombre || d.alumnoNombre || "",
          noControl: al.noControl || d.noControl || "",
        },
        items: normalizeItemsAny(d.items),
      };
    } else {
      p = {};
    }
  }

  p.items = normalizeItemsAny(p.items || []);

  return {
    fecha: p.fecha || "",
    hora: p.hora || "",
    noVale: p.noVale || "",
    materia: p.materia || "",
    maestro: p.maestro || "",
    mesa: p.mesa || "",
    alumno: titleCase(p.alumno?.nombreCompleto || p.alumno?.nombre || "Alumno"),
    noControl: String(p.alumno?.noControl || "").trim(),
    items: p.items,
  };
}

function mapPrestamoBackendToView(row) {
  return {
    id_Prestamo: Number(row.id_Prestamo || 0),
    numeroControl: String(row.numeroControl || ""),
    alumno: titleCase(row.alumno?.nombre || row.alumno || "Alumno"),
    fecha: row.fecha || "",
    hora: row.hora || "",
    noVale: row.noVale || row.no_vale || row.noValePrestamo || "",
    materia: row.materia || "",
    maestro: row.maestro || "",
    mesa: row.mesa || "",
    estado: row.estado || "pendiente",
    items: normalizeItemsAny(row.items || []),
  };
}

/* =========================
   MATERIAL
========================= */
function findMaterialIdByName(nombre) {
  const target = norm(nombre);
  const mat = state.materiales.find((m) => norm(m.nombre || "") === target);
  return Number(mat?.id_Material || 0) || 0;
}

/* =========================
   SYNC VALE
========================= */
async function syncLocalValeToBackend() {
  if (syncInFlight) return;

  const payload = getPayloadFromLocalVale();
  if (!payload.noVale || !payload.items.length) return;
  if (!payload.noControl) return;
  if (!payload.fecha || !payload.hora) return;
  if (!payload.materia || !payload.maestro || !payload.mesa) return;

  const yaExiste = state.prestamos.some(
    (p) => String(p.noVale) === String(payload.noVale)
  );
  if (yaExiste) {
    sessionStorage.setItem(SESSION_KEYS.SYNCED_VALE, payload.noVale);
    clearValeLocal();
    return;
  }

  const syncingVale = sessionStorage.getItem(SESSION_KEYS.SYNCING_VALE);
  const syncedVale = sessionStorage.getItem(SESSION_KEYS.SYNCED_VALE);

  if (syncingVale === payload.noVale || syncedVale === payload.noVale) {
    return;
  }

  if (!state.materiales.length) return;

  const itemsMapped = payload.items
    .map((it) => ({
      id_Material: it.id_Material || findMaterialIdByName(it.material || it.descripcion),
      cantidad: Number(it.cantidad || 0),
    }))
    .filter((it) => it.id_Material > 0 && it.cantidad > 0);

  if (!itemsMapped.length) {
    console.warn("No se pudieron mapear materiales del vale local al backend.");
    return;
  }

  syncInFlight = true;
  sessionStorage.setItem(SESSION_KEYS.SYNCING_VALE, payload.noVale);

  try {
    await apiCreatePrestamo({
      numeroControl: payload.noControl,
      fecha: payload.fecha,
      hora: payload.hora,
      noVale: payload.noVale,
      materia: payload.materia,
      maestro: payload.maestro,
      mesa: payload.mesa,
      items: itemsMapped,
    });

    sessionStorage.setItem(SESSION_KEYS.SYNCED_VALE, payload.noVale);
    clearValeLocal();
  } catch (err) {
    const msg = String(err?.message || "").toLowerCase();

    if (
      msg.includes("duplicate") ||
      msg.includes("duplicado") ||
      msg.includes("ya existe")
    ) {
      sessionStorage.setItem(SESSION_KEYS.SYNCED_VALE, payload.noVale);
      clearValeLocal();
    } else {
      console.error("No se pudo sincronizar el vale al backend:", err);
    }
  } finally {
    sessionStorage.removeItem(SESSION_KEYS.SYNCING_VALE);
    syncInFlight = false;
  }
}

/* =========================
   LOAD
========================= */
async function loadAll() {
  if (loadAllInFlight) return;
  loadAllInFlight = true;
  state.cargando = true;

  try {
    const matsResp = await apiListMateriales();
    state.materiales = Array.isArray(matsResp.data) ? matsResp.data : [];

    const presResp1 = await apiListPrestamos();
    state.prestamos = Array.isArray(presResp1.data)
      ? presResp1.data.map(mapPrestamoBackendToView)
      : [];

    await syncLocalValeToBackend();

    const presResp2 = await apiListPrestamos();
    state.prestamos = Array.isArray(presResp2.data)
      ? presResp2.data.map(mapPrestamoBackendToView)
      : [];

    pickPrestamoActual();
    mirrorCurrentToLocal();
    render();
  } catch (err) {
    console.error("loadAll:", err);
    notify(err.message || "No se pudo cargar préstamos.", "err", { autoClose: 1800 });
  } finally {
    state.cargando = false;
    loadAllInFlight = false;
  }
}

/* =========================
   PICK
========================= */
function pickPrestamoActual() {
  const prioridad = ["pendiente", "en_curso", "aprobado", "rechazado", "devuelto"];

  const sorted = state.prestamos
    .slice()
    .sort((a, b) => {
      const pa = prioridad.indexOf(a.estado);
      const pb = prioridad.indexOf(b.estado);
      if (pa !== pb) return pa - pb;

      const fa = `${a.fecha || ""} ${a.hora || ""}`;
      const fb = `${b.fecha || ""} ${b.hora || ""}`;
      return fb.localeCompare(fa);
    });

  state.actual = sorted[0] || null;
}

function mirrorCurrentToLocal() {
  if (!state.actual) {
    localStorage.removeItem(KEYS.DATA);
    localStorage.removeItem(KEYS.STATUS);
    return;
  }

  const prevData = readJSON(KEYS.DATA, {}) || {};

  const snapshot = {
    id_Prestamo: state.actual.id_Prestamo,
    estado: state.actual.estado,
    noVale: state.actual.noVale,
    fecha: state.actual.fecha,
    hora: state.actual.hora,
    materia: state.actual.materia,
    maestro: state.actual.maestro,
    mesa: state.actual.mesa,
    alumno: {
      nombre: state.actual.alumno,
      noControl: state.actual.numeroControl,
    },
    items: state.actual.items,
    aprobado_en: prevData.aprobado_en || null,
    devuelto_solicitado:
      prevData.devuelto_solicitado === true &&
      prevData.noVale === state.actual.noVale,
    cantidades_ok: Array.isArray(prevData.cantidades_ok) ? prevData.cantidades_ok : [],
    cantidades_daniado: Array.isArray(prevData.cantidades_daniado) ? prevData.cantidades_daniado : [],
  };

  setJSON(KEYS.DATA, snapshot);
  setStatusLocal(state.actual.estado);
}

/* =========================
   DEVOLUCION
========================= */
function validarCantidadesFila(okInput, badInput, total) {
  const ok = parseInt(okInput.value || "0", 10) || 0;
  const bad = parseInt(badInput.value || "0", 10) || 0;

  if (ok + bad > total) {
    badInput.value = Math.max(0, total - ok);
    toast("La suma no puede ser mayor a la cantidad prestada.", "warn");
  }

  updateButtonsDevolucion();
}

function updateButtonsDevolucion() {
  const okInputs = document.querySelectorAll(".cant-ok");
  const badInputs = document.querySelectorAll(".cant-daniado");

  const btnA = $("btnAprobar");
  const btnR = $("btnRechazar");

  if (!okInputs.length || okInputs.length !== badInputs.length) {
    if (btnA) btnA.disabled = true;
    if (btnR) btnR.disabled = true;
    return;
  }

  let allValid = true;

  okInputs.forEach((inpOk, idx) => {
    const inpBad = badInputs[idx];
    if (!inpBad) {
      allValid = false;
      return;
    }

    const total = Number(inpOk.dataset.totalItem || inpBad.dataset.totalItem || 0);
    const ok = parseInt(inpOk.value || "0", 10) || 0;
    const bad = parseInt(inpBad.value || "0", 10) || 0;

    if (total > 0 && (ok < 0 || bad < 0 || ok + bad !== total)) {
      allValid = false;
    }
  });

  if (btnA) btnA.disabled = !allValid || actionInFlight;
  if (btnR) btnR.disabled = !allValid || actionInFlight;
}

/* =========================
   RENDER
========================= */
function renderMeta(previewPendiente, devueltoPendiente) {
  const p = state.actual;

  const estadoEnCurso = p?.estado === "en_curso" || p?.estado === "aprobado";

  const debeOcultarMeta =
    previewPendiente ||
    (estadoEnCurso && !devueltoPendiente) ||
    p?.estado === "rechazado" ||
    p?.estado === "devuelto";

  if (debeOcultarMeta || !p) {
    if ($("fldFecha")) $("fldFecha").textContent = "— — —";
    if ($("fldHora")) $("fldHora").textContent = "— — —";
    if ($("fldNoVale")) $("fldNoVale").textContent = "— — —";
    if ($("fldMateria")) $("fldMateria").value = "";
    if ($("fldMaestro")) $("fldMaestro").value = "";
    if ($("fldMesa")) $("fldMesa").value = "";
    if ($("fldNoControl")) $("fldNoControl").value = "";
    return;
  }

  if ($("fldFecha")) $("fldFecha").textContent = p.fecha || "— — —";
  if ($("fldHora")) $("fldHora").textContent = p.hora || "— — —";
  if ($("fldNoVale")) $("fldNoVale").textContent = p.noVale || "— — —";
  if ($("fldMateria")) $("fldMateria").value = p.materia || "";
  if ($("fldMaestro")) $("fldMaestro").value = p.maestro || "";
  if ($("fldMesa")) $("fldMesa").value = p.mesa || "";
  if ($("fldNoControl")) $("fldNoControl").value = p.numeroControl || "";
}

function renderTabla(previewPendiente, devueltoPendiente) {
  const tb = $("tbodyMat");
  if (!tb) return;

  tb.innerHTML = "";

  const p = state.actual;
  if (!p || !Array.isArray(p.items) || !p.items.length) {
    tb.innerHTML = `<tr><td colspan="4" class="empty">Sin materiales</td></tr>`;
    return;
  }

  const estadoEnCurso = p.estado === "en_curso" || p.estado === "aprobado";

  if (estadoEnCurso && !devueltoPendiente) {
    tb.innerHTML = `
      <tr>
        <td colspan="4" class="empty">
          Ya aceptaste el préstamo del alumno <b>${p.alumno}</b>.<br>
          Material en uso. Esperando devolución.
        </td>
      </tr>
    `;
    return;
  }

  if (p.estado === "rechazado") {
    tb.innerHTML = `
      <tr>
        <td colspan="4" class="empty">
          La solicitud de préstamo del alumno <b>${p.alumno}</b> fue rechazada por el auxiliar.
        </td>
      </tr>
    `;
    return;
  }

  if (p.estado === "devuelto") {
    tb.innerHTML = `
      <tr>
        <td colspan="4" class="empty">
          Préstamo cerrado. Material devuelto y registrado.
        </td>
      </tr>
    `;
    return;
  }

  const tr = document.createElement("tr");
  const totalGlobal = p.items.reduce((s, it) => s + (Number(it.cantidad) || 0), 0);

  const tdAlumno = document.createElement("td");
  const tdMat = document.createElement("td");
  const tdCant = document.createElement("td");
  const tdEstado = document.createElement("td");

  tdAlumno.innerHTML = `
    <div style="font-weight:600;">${p.alumno || "—"}</div>
    <div style="font-size:12px;color:#4b5563;">No. Control: ${p.numeroControl || "—"}</div>
  `;

  const list = document.createElement("ol");
  list.style.margin = "0";
  list.style.paddingLeft = "18px";
  list.style.fontSize = "13px";

  p.items.forEach((it) => {
    const li = document.createElement("li");
    const q = Number(it.cantidad) || 0;
    li.textContent = `${it.material || it.descripcion || "—"} — ${q} pza${q === 1 ? "" : "s"}`;
    list.appendChild(li);
  });

  tdMat.appendChild(list);
  tdCant.textContent = totalGlobal || 0;
  tdCant.style.textAlign = "center";
  tdCant.style.fontWeight = "600";

  if (p.estado === "pendiente") {
    tdEstado.style.fontWeight = "600";

    if (previewPendiente) {
      tdEstado.textContent = "Haz clic para revisar";
      tdEstado.style.color = "#7a0000";
      tr.style.cursor = "pointer";

      tr.addEventListener("click", () => {
        state.solicitudActiva = true;
        render();
      });
    } else {
      tdEstado.textContent = "En espera de aprobación";
      tdEstado.style.color = "#7a0000";
    }
  } else if (devueltoPendiente) {
    tdEstado.style.background = "#7a0000";
    tdEstado.style.padding = "6px 10px";
    tdEstado.style.color = "#fff";
    tdEstado.style.fontSize = "12px";

    const data = readJSON(KEYS.DATA, {}) || {};
    const arrOk = Array.isArray(data.cantidades_ok) ? data.cantidades_ok : [];
    const arrBad = Array.isArray(data.cantidades_daniado) ? data.cantidades_daniado : [];

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "6px";

    p.items.forEach((it, idx) => {
      const total = Number(it.cantidad) || 0;

      const block = document.createElement("div");
      block.style.borderRadius = "6px";
      block.style.background = "rgba(0,0,0,.15)";
      block.style.padding = "4px 6px";

      const titulo = document.createElement("div");
      titulo.style.fontWeight = "700";
      titulo.style.marginBottom = "2px";
      titulo.textContent = `${it.material || it.descripcion || "Material"} (${total} pzas)`;

      const grid = document.createElement("div");
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "1fr 1fr";
      grid.style.gap = "4px";

      const bloqueOk = document.createElement("div");
      const bloqueBad = document.createElement("div");

      bloqueOk.innerHTML = `<div style="margin-bottom:2px;">✅ Buen estado</div>`;
      bloqueBad.innerHTML = `<div style="margin-bottom:2px;">⛔ Dañado</div>`;

      const inpOk = document.createElement("input");
      inpOk.type = "number";
      inpOk.min = "0";
      inpOk.max = String(total);
      inpOk.className = "cant-ok";
      inpOk.dataset.index = String(idx);
      inpOk.dataset.totalItem = String(total);
      inpOk.style.width = "100%";
      inpOk.style.padding = "4px 6px";
      inpOk.style.borderRadius = "6px";
      inpOk.style.border = "none";
      inpOk.style.outline = "none";
      inpOk.value = arrOk[idx] != null ? arrOk[idx] : total;

      const inpBad = document.createElement("input");
      inpBad.type = "number";
      inpBad.min = "0";
      inpBad.max = String(total);
      inpBad.className = "cant-daniado";
      inpBad.dataset.index = String(idx);
      inpBad.dataset.totalItem = String(total);
      inpBad.style.width = "100%";
      inpBad.style.padding = "4px 6px";
      inpBad.style.borderRadius = "6px";
      inpBad.style.border = "none";
      inpBad.style.outline = "none";
      inpBad.value = arrBad[idx] != null ? arrBad[idx] : 0;

      inpOk.addEventListener("input", () => validarCantidadesFila(inpOk, inpBad, total));
      inpBad.addEventListener("input", () => validarCantidadesFila(inpOk, inpBad, total));

      bloqueOk.appendChild(inpOk);
      bloqueBad.appendChild(inpBad);
      grid.appendChild(bloqueOk);
      grid.appendChild(bloqueBad);

      block.appendChild(titulo);
      block.appendChild(grid);

      wrap.appendChild(block);
    });

    tdEstado.appendChild(wrap);
  } else {
    tdEstado.textContent = "—";
  }

  tr.appendChild(tdAlumno);
  tr.appendChild(tdMat);
  tr.appendChild(tdCant);
  tr.appendChild(tdEstado);
  tb.appendChild(tr);

  if (devueltoPendiente) {
    updateButtonsDevolucion();
  }
}

function renderButtons(previewPendiente, devueltoPendiente) {
  const btnA = $("btnAprobar");
  const btnR = $("btnRechazar");

  if (!btnA || !btnR) return;

  const p = state.actual;
  if (!p || !p.items?.length) {
    btnA.disabled = true;
    btnR.disabled = true;
    return;
  }

  if (devueltoPendiente) {
    updateButtonsDevolucion();
    return;
  }

  let canApprove = false;
  let canReject = false;

  if (p.estado === "pendiente") {
    canApprove = Boolean(p.fecha) && Boolean(p.hora) && state.solicitudActiva && !previewPendiente;
    canReject = state.solicitudActiva && !previewPendiente;
  }

  btnA.disabled = !canApprove || actionInFlight;
  btnR.disabled = !canReject || actionInFlight;
}

function render() {
  const p = state.actual;
  const data = readJSON(KEYS.DATA, {}) || {};

  const estadoEnCurso = p?.estado === "en_curso" || p?.estado === "aprobado";

  const devueltoPendiente =
    estadoEnCurso &&
    data?.devuelto_solicitado === true &&
    data?.noVale === p?.noVale;

  const previewPendiente = p?.estado === "pendiente" && !state.solicitudActiva;

  renderMeta(previewPendiente, devueltoPendiente);
  renderTabla(previewPendiente, devueltoPendiente);
  renderButtons(previewPendiente, devueltoPendiente);
}

/* =========================
   ACCIONES
========================= */
async function aprobar() {
  if (actionInFlight) return;

  const p = state.actual;
  if (!p) {
    notify("No hay préstamo seleccionado.", "err", { autoClose: 1500 });
    return;
  }

  const data = readJSON(KEYS.DATA, {}) || {};
  const estadoEnCurso = p.estado === "en_curso" || p.estado === "aprobado";
  const devueltoPendiente =
    estadoEnCurso &&
    data.devuelto_solicitado === true &&
    data.noVale === p.noVale;

  actionInFlight = true;
  render();

  try {
    if (p.estado === "pendiente") {
      await apiAprobarPrestamo(p.id_Prestamo);

      localStorage.setItem(KEYS.STATUS, "en_curso");
      const actualData = readJSON(KEYS.DATA, {}) || {};
      actualData.estado = "en_curso";
      actualData.aprobado_en = new Date().toISOString();
      setJSON(KEYS.DATA, actualData);

      pushAlumnoInbox(
        p.numeroControl,
        `Tu solicitud ${p.noVale || ""} fue aprobada. Pasa por el material.`
      );

      notify(`Ya aceptaste el préstamo del alumno ${p.alumno}.`, "ok", {
        autoClose: 1600,
      });
      toast("Aprobado ✔", "success");

      state.solicitudActiva = false;
      await loadAll();
      return;
    }

    if (devueltoPendiente) {
      const itemsDevolucion = p.items.map((it, idx) => {
        const okInput = document.querySelector(`.cant-ok[data-index="${idx}"]`);
        const badInput = document.querySelector(`.cant-daniado[data-index="${idx}"]`);

        const cantidad_ok = parseInt(okInput?.value || "0", 10) || 0;
        const cantidad_daniado = parseInt(badInput?.value || "0", 10) || 0;

        let estado_material = "ok";
        if (cantidad_daniado > 0) estado_material = "daniado";
        else if (cantidad_ok < Number(it.cantidad || 0)) estado_material = "leve";

        return {
          id_Material: Number(it.id_Material || 0),
          cantidad_ok,
          cantidad_daniado,
          estado_material,
        };
      });

      await apiRegistrarDevolucion(p.id_Prestamo, itemsDevolucion);

      localStorage.setItem(KEYS.STATUS, "devuelto");
      const actualData = readJSON(KEYS.DATA, {}) || {};
      actualData.estado = "devuelto";
      actualData.devuelto_solicitado = false;
      actualData.cantidades_ok = [];
      actualData.cantidades_daniado = [];
      setJSON(KEYS.DATA, actualData);

      pushAlumnoInbox(
        p.numeroControl,
        `Tu devolución del vale ${p.noVale || ""} fue aceptada. Ya puedes solicitar nuevo material.`
      );

      notify("Devolución aceptada. El alumno ya puede volver a solicitar.", "ok", {
        autoClose: 1800,
      });
      toast("Devolución OK ✔", "success");

      await loadAll();
    }
  } catch (err) {
    console.error("aprobar:", err);
    notify(err.message || "No se pudo aprobar.", "err", { autoClose: 1800 });
  } finally {
    actionInFlight = false;
    render();
  }
}

async function rechazar() {
  if (actionInFlight) return;

  const p = state.actual;
  if (!p) return;

  const data = readJSON(KEYS.DATA, {}) || {};
  const estadoEnCurso = p.estado === "en_curso" || p.estado === "aprobado";
  const devueltoPendiente =
    estadoEnCurso &&
    data.devuelto_solicitado === true &&
    data.noVale === p.noVale;

  actionInFlight = true;
  render();

  try {
    if (p.estado === "pendiente") {
      await apiRechazarPrestamo(p.id_Prestamo);

      localStorage.setItem(KEYS.STATUS, "rechazado");
      const actualData = readJSON(KEYS.DATA, {}) || {};
      actualData.estado = "rechazado";
      setJSON(KEYS.DATA, actualData);

      pushAlumnoInbox(
        p.numeroControl,
        `Tu solicitud ${p.noVale || ""} fue rechazada.`
      );

      notify(`Ya rechazaste el préstamo del alumno ${p.alumno}.`, "info", {
        autoClose: 1500,
      });
      toast("Rechazado", "warn");

      state.solicitudActiva = false;
      await loadAll();
      return;
    }

    if (devueltoPendiente) {
      const itemsDevolucion = p.items.map((it, idx) => {
        const okInput = document.querySelector(`.cant-ok[data-index="${idx}"]`);
        const badInput = document.querySelector(`.cant-daniado[data-index="${idx}"]`);

        const cantidad_ok = parseInt(okInput?.value || "0", 10) || 0;
        const cantidad_daniado = parseInt(badInput?.value || "0", 10) || 0;

        let estado_material = "ok";
        if (cantidad_daniado > 0) estado_material = "daniado";
        else if (cantidad_ok < Number(it.cantidad || 0)) estado_material = "leve";

        return {
          id_Material: Number(it.id_Material || 0),
          cantidad_ok,
          cantidad_daniado,
          estado_material,
        };
      });

      await apiRegistrarDevolucion(p.id_Prestamo, itemsDevolucion);

      localStorage.setItem(KEYS.STATUS, "devuelto");
      const actualData = readJSON(KEYS.DATA, {}) || {};
      actualData.estado = "devuelto";
      actualData.devuelto_solicitado = false;
      actualData.cantidades_ok = [];
      actualData.cantidades_daniado = [];
      actualData.observacion_devolucion =
        "Devolución con material dañado o incompleto.";
      setJSON(KEYS.DATA, actualData);

      pushAlumnoInbox(
        p.numeroControl,
        `Tu devolución del vale ${p.noVale || ""} fue registrada con observaciones. Acude al laboratorio para revisar el material.`
      );

      notify("Devolución registrada con observaciones.", "info", {
        autoClose: 1800,
      });
      toast("Devolución con detalles", "warn");

      await loadAll();
    }
  } catch (err) {
    console.error("rechazar:", err);
    notify(err.message || "No se pudo rechazar.", "err", { autoClose: 1800 });
  } finally {
    actionInFlight = false;
    render();
  }
}

/* =========================
   HOME
========================= */
function shouldWarnExit() {
  return false;
}

function confirmExit(url) {
  notify("Tienes una solicitud/devolución en proceso. ¿Seguro que quieres salir?", "info", {
    buttons: [
      { text: "No", kind: "nbtn-ghost", action: () => {} },
      { text: "Sí", kind: "nbtn-primary", action: () => { window.location.href = url; } },
    ],
    autoClose: 0,
  });
}

/* =========================
   INIT
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  $("btnAprobar")?.addEventListener("click", aprobar);
  $("btnRechazar")?.addEventListener("click", rechazar);

  $("btnVerHistorial")?.addEventListener("click", () => {
    window.location.href = "./HistorialPrestamos.html";
  });

  const home = qs(".fab-home");
  if (home) {
    home.addEventListener("click", (e) => {
      if (shouldWarnExit()) {
        e.preventDefault();
        confirmExit(home.href);
      }
    });
  }

  window.addEventListener("storage", (e) => {
    if ([KEYS.VALE, KEYS.STATUS, KEYS.DATA, KEYS.FORM, KEYS.TMP, KEYS.NUM].includes(e.key)) {
      clearTimeout(storageReloadTimer);
      storageReloadTimer = setTimeout(() => {
        loadAll();
      }, 250);
    }
  });

  await loadAll();

  console.group("%cPréstamos — estado actual", "color:#2563eb;font-weight:700");
  console.log("prestamo actual:", state.actual);
  console.log("LE_vale_payload:", readJSON(KEYS.VALE, null));
  console.log("LE_prestamo_status:", getStatusLocal());
  console.log("LE_prestamo_data:", readJSON(KEYS.DATA, null));
  console.groupEnd();
});