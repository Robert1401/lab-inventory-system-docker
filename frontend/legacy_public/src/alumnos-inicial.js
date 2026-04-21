/* =========================================================
   alumnos-inicial.js — CORREGIDO PARA BACKEND NODE/EXPRESS
========================================================= */

"use strict";

/* ================== CONFIG ================== */
const API_PRESTAMOS = "/api/prestamos";

/* ================== STORAGE KEYS ================== */
const KEYS = {
  USER: "LE_user",
  FORM_CTX: "LE_form_ctx",
  LOAN_STATUS: "LE_prestamo_status",
  LOAN_DATA: "LE_prestamo_data",
};

/* ================== SELECTORES ================== */
const $ = (s) => document.querySelector(s);

/* ================== HELPERS ================== */
function readJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const titleCase = (str = "") =>
  String(str)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .trim();

function buildNombreCompleto(u) {
  if (!u || typeof u !== "object") return "";

  if (u.nombreCompleto) return titleCase(u.nombreCompleto);

  const parts = [
    u.nombre,
    u.apellidoPaterno,
    u.apellidoMaterno,
  ]
    .filter(Boolean)
    .map((s) => String(s).trim());

  return titleCase(parts.join(" "));
}

function getCurrentUser() {
  const user = readJSON(KEYS.USER, null);
  if (!user || typeof user !== "object") return null;

  const numeroControl = String(
    user.numeroControl ?? user.noControl ?? user.nocontrol ?? ""
  ).trim();

  const nombreCompleto = buildNombreCompleto(user);

  if (!numeroControl) return null;

  return {
    numeroControl,
    nombreCompleto: nombreCompleto || "Alumno",
  };
}

function obtenerNombreAlumno() {
  const user = getCurrentUser();
  if (user?.nombreCompleto) return user.nombreCompleto;
  return "Alumno";
}

function obtenerNoControl() {
  const user = getCurrentUser();
  return user?.numeroControl || "";
}

/* ================== FETCH ================== */
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

/* ================== INBOX / NOTIFICACIONES ================== */
function loadInbox(noControl) {
  if (!noControl) return [];
  return readJSON(`LE_inbox_${noControl}`, []) || [];
}

function renderBell(noControl) {
  const header = document.querySelector("header");
  if (!header || !noControl) return;

  header.style.position = "relative";

  let bell = document.getElementById("notifBell");
  if (!bell) {
    bell = document.createElement("button");
    bell.id = "notifBell";
    bell.type = "button";
    bell.style.cssText = `
      position:absolute;
      right:20px;
      top:18px;
      width:38px;
      height:38px;
      border-radius:999px;
      border:none;
      background:#ffffff;
      box-shadow:0 6px 18px rgba(0,0,0,.20);
      display:inline-flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      color:#7a0000;
      font-size:18px;
      z-index:10;
    `;
    bell.innerHTML = `
      <i class="fa-solid fa-bell"></i>
      <span id="notifBadge" style="
        position:absolute;
        top:-4px;
        right:-4px;
        min-width:18px;
        height:18px;
        padding:0 4px;
        border-radius:999px;
        background:#ef4444;
        color:#fff;
        font-size:11px;
        display:none;
        align-items:center;
        justify-content:center;
        font-weight:700;
      "></span>
    `;
    header.appendChild(bell);
  }

  const inbox = loadInbox(noControl);
  const badge = document.getElementById("notifBadge");
  const count = inbox.length;

  if (badge) {
    if (count > 0) {
      badge.textContent = count > 9 ? "9+" : String(count);
      badge.style.display = "inline-flex";
    } else {
      badge.style.display = "none";
    }
  }

  bell.onclick = () => {
    const data = loadInbox(noControl);

    if (!data.length) {
      alert("No tienes notificaciones nuevas.");
      return;
    }

    const old = document.getElementById("notifOverlay");
    if (old) old.remove();

    const overlay = document.createElement("div");
    overlay.id = "notifOverlay";
    overlay.style.cssText = `
      position:fixed;
      inset:0;
      z-index:100000;
      background:rgba(0,0,0,.45);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
    `;

    const panel = document.createElement("div");
    panel.style.cssText = `
      background:#fff;
      border-radius:16px;
      padding:14px 18px;
      max-width:420px;
      width:90%;
      max-height:70vh;
      overflow:auto;
      box-shadow:0 18px 40px rgba(0,0,0,.30);
      font-family:system-ui,Segoe UI,Roboto,Arial;
    `;

    panel.innerHTML = `
      <h3 style="margin:0 0 8px;font-size:16px;color:#7a0000">
        Notificaciones
      </h3>
      ${data.map((n) => `
        <div style="padding:8px 0;border-bottom:1px solid #eee;">
          <div style="font-size:12px;color:#6b7280;">${n.ts || ""}</div>
          <div style="font-size:14px;color:#111827;">${n.mensaje || ""}</div>
        </div>
      `).join("")}
      <button type="button" id="notifCerrar" style="
        margin-top:12px;
        padding:8px 12px;
        border-radius:10px;
        border:none;
        background:#7a0000;
        color:#fff;
        font-weight:700;
        cursor:pointer;
      ">Cerrar</button>
    `;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    document.getElementById("notifCerrar").onclick = () => {
      overlay.remove();
      localStorage.removeItem(`LE_inbox_${noControl}`);
      renderBell(noControl);
    };

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  };
}

/* ================== UI ================== */
function pintarBannerBienvenida(nombre) {
  const header = $("header");
  if (!header) return;

  $("#bienvenidaNombre")?.remove();

  const noCtrl = obtenerNoControl();

  const banner = document.createElement("div");
  banner.id = "bienvenidaNombre";
  banner.style.cssText = `
    margin:14px auto 0;
    padding:10px 16px;
    border-radius:14px;
    background:linear-gradient(180deg,#b8191b,#8f0f11);
    color:#fff;
    font-weight:800;
    letter-spacing:.3px;
    box-shadow:0 10px 30px rgba(178,14,16,.25);
    display:inline-flex;
    align-items:center;
    gap:10px;
  `;

  banner.innerHTML = `
    <i class="fa-solid fa-user" aria-hidden="true" style="opacity:.9"></i>
    <span style="font-size:clamp(14px,2.2vw,18px)">
      Bienvenido, <b>${nombre}</b>${noCtrl ? ` · NC: <b>${noCtrl}</b>` : ""}
    </span>
  `;

  header.appendChild(banner);
}

function styleCard(a, mode) {
  if (!a) return;

  a.style.pointerEvents = "";
  a.style.filter = "";
  a.style.background = "";
  a.style.boxShadow = "";
  a.style.border = "";
  a.style.opacity = "";

  switch (mode) {
    case "disabled-grey":
      a.style.pointerEvents = "none";
      a.style.filter = "grayscale(1) opacity(.55)";
      a.style.background = "linear-gradient(180deg,#f5f5f5,#eeeeee)";
      a.style.boxShadow = "inset 0 0 0 1px #e6e6e6";
      break;

    case "pending-yellow":
      a.style.pointerEvents = "none";
      a.style.background = "linear-gradient(180deg,#fff7e6,#ffe8b3)";
      a.style.boxShadow = "inset 0 0 0 1px #f1c77a, 0 8px 24px rgba(241,199,122,.35)";
      break;

    case "active-green":
      a.style.pointerEvents = "auto";
      a.style.background = "linear-gradient(180deg,#ecfdf5,#d1fae5)";
      a.style.boxShadow = "inset 0 0 0 1px #86efac, 0 8px 24px rgba(34,197,94,.25)";
      break;

    case "disabled-red":
      a.style.pointerEvents = "none";
      a.style.background = "linear-gradient(180deg,#ffe4e6,#fecaca)";
      a.style.boxShadow = "inset 0 0 0 1px #fca5a5, 0 8px 24px rgba(239,68,68,.22)";
      break;
  }
}

function dropAviso(texto, icon = "fa-circle-info") {
  const grid = $(".grid3");
  if (!grid) return;

  $("#avisoPrestamo")?.remove();

  const aviso = document.createElement("div");
  aviso.id = "avisoPrestamo";
  aviso.style.cssText = `
    margin:14px 0;
    padding:10px 14px;
    border-radius:12px;
    background:#fff;
    color:#7a0000;
    font-weight:700;
    box-shadow:0 6px 20px rgba(0,0,0,.06);
  `;
  aviso.innerHTML = `
    <i class="fa-solid ${icon}" aria-hidden="true"></i>
    <span id="avisoText"> ${texto}</span>
  `;

  grid.parentElement.insertBefore(aviso, grid);
}

/* ================== FALLBACK LOCAL ================== */
function lsGetStatus() {
  return localStorage.getItem(KEYS.LOAN_STATUS) || null;
}

function lsGetLoan() {
  return readJSON(KEYS.LOAN_DATA, null);
}

function lsHasItems(loan) {
  return loan && Array.isArray(loan.items) && loan.items.length > 0;
}

/* ================== API ESTADO ALUMNO ================== */
async function apiEstadoAlumno(noControl) {
  const data = await apiListPrestamos();
  const rows = Array.isArray(data?.data) ? data.data : [];

  const propios = rows
    .filter((r) => String(r.numeroControl || "") === String(noControl))
    .sort((a, b) => {
      const prioridad = ["pendiente", "en_curso", "aprobado", "rechazado", "devuelto"];
      const pa = prioridad.indexOf(a.estado || "");
      const pb = prioridad.indexOf(b.estado || "");
      if (pa !== pb) return pa - pb;

      const fa = `${a.fecha || ""} ${a.hora || ""}`;
      const fb = `${b.fecha || ""} ${b.hora || ""}`;
      return fb.localeCompare(fa);
    });

  if (!propios.length) {
    return { prestamo: null };
  }

  return { prestamo: propios[0] };
}

/* ================== UI SEGÚN ESTADO ================== */
function aplicarEstadoUI(estado) {
  const grid = $(".grid3");
  if (!grid) return;

  const cards = grid.querySelectorAll("a.card--link");
  const cardSolic = cards[0];
  const cardDevol = cards[1];

  const setBase = () => {
    styleCard(cardSolic, "");
    styleCard(cardDevol, "disabled-grey");
  };

  if (!estado || !estado.prestamo) {
    setBase();
    dropAviso("No tienes préstamos activos. Puedes solicitar material.", "fa-circle-check");
    return;
  }

  const prest = estado.prestamo;

  if (prest.estado === "pendiente") {
    styleCard(cardSolic, "pending-yellow");
    styleCard(cardDevol, "pending-yellow");
    dropAviso(
      "Tu solicitud fue enviada al auxiliar. Espera a que sea aprobada o rechazada.",
      "fa-triangle-exclamation"
    );
    return;
  }

  if (prest.estado === "en_curso" || prest.estado === "aprobado") {
    styleCard(cardSolic, "disabled-red");
    styleCard(cardDevol, "active-green");
    dropAviso(
      "Tu solicitud fue aprobada y tienes un préstamo activo. Cuando termines, devuelve los materiales.",
      "fa-circle-check"
    );
    return;
  }

  if (prest.estado === "rechazado") {
    styleCard(cardSolic, "");
    styleCard(cardDevol, "disabled-grey");
    dropAviso(
      "Tu solicitud fue rechazada por el auxiliar. Puedes volver a intentar una nueva solicitud.",
      "fa-circle-info"
    );
    return;
  }

  if (prest.estado === "devuelto") {
    setBase();
    dropAviso("No tienes préstamos activos. Puedes solicitar material.", "fa-circle-check");
    return;
  }

  setBase();
  dropAviso("No se reconoció el estado. Puedes intentar una nueva solicitud.", "fa-circle-info");
}

/* ================== RESET SUAVE ================== */
function resetFlujoAlEntrar() {
  try {
    localStorage.removeItem("LE_form_ctx");
    localStorage.removeItem("LE_tmp_solicitud_vale");
    localStorage.removeItem("LE_num_vale");
    sessionStorage.removeItem("SV_SEARCH_Q");
    sessionStorage.removeItem("SV_FLOW_ACTIVE");
  } catch {}
}

/* ================== PINTAR ================== */
async function pintar() {
  const nombre = obtenerNombreAlumno();
  pintarBannerBienvenida(nombre);

  const noCtrl = obtenerNoControl();
  renderBell(noCtrl);

  if (noCtrl) {
    try {
      const estado = await apiEstadoAlumno(noCtrl);
      aplicarEstadoUI(estado);
      return;
    } catch (err) {
      console.warn("API no disponible, usando localStorage:", err?.message || err);
    }
  }

  const statusRaw = lsGetStatus();
  const loan = lsGetLoan();

  let status = statusRaw;
  if (!status && lsHasItems(loan)) {
    status = loan?.estado || "pendiente";
  }

  let estado = null;

  if (!status && !lsHasItems(loan)) {
    estado = null;
  } else if (status === "pendiente") {
    estado = { prestamo: { estado: "pendiente", items: loan?.items || [] } };
  } else if (status === "en_curso" || status === "aprobado") {
    estado = { prestamo: { estado: "en_curso", items: loan?.items || [] } };
  } else if (status === "rechazado") {
    estado = { prestamo: { estado: "rechazado", items: loan?.items || [] } };
  } else {
    estado = null;
  }

  aplicarEstadoUI(estado);
}

/* ================== INIT ================== */
document.addEventListener("DOMContentLoaded", () => {
  resetFlujoAlEntrar();
  pintar();
});

window.addEventListener("storage", (e) => {
  if (
    e.key === KEYS.USER ||
    e.key === KEYS.LOAN_STATUS ||
    e.key === KEYS.LOAN_DATA
  ) {
    pintar();
  }
});
