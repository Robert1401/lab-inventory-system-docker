/* =========================================================
   alumnos-inicial.js — COMPLETO (con campanita, sin contador)
========================================================= */

"use strict";

/* ================== CONFIG ================== */
const API_BASE = "/backend/alumnos_inicial.php";
const COOLDOWN_DEFAULT_MIN = 120;

/* ================== STORAGE KEYS ================== */
const KEYS = {
  USER: "LE_user",
  FORM_CTX: "LE_form_ctx",
  LOAN_STATUS: "LE_prestamo_status",
  LOAN_DATA: "LE_prestamo_data",
  CLEAR_ON_ENTRY: [
    "LE_form_ctx",
    "LE_tmp_solicitud_vale",
    "LE_num_vale",
    "SV_SEARCH_Q",
    "SV_FLOW_ACTIVE",
  ],
};

/* ================== SELECTORES ================== */
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

/* ================== STATE ================== */
let cooldownTimer = null;

/* ================== HELPERS (texto/usuario) ================== */
const titleCase = (str = "") =>
  String(str)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ")
    .trim();

function buildNombreCompleto(u) {
  if (!u) return "";
  if (u.nombreCompleto) return titleCase(u.nombreCompleto);
  if (u.nombre && !u.apellidoPaterno && !u.apellidoMaterno) return titleCase(u.nombre);
  const parts = [u.nombre, u.apellidoPaterno, u.apellidoMaterno]
    .filter(Boolean)
    .map((s) => String(s).trim());
  return titleCase(parts.join(" "));
}

function obtenerNombreAlumno() {
  let user = null, ctx = null;
  try { user = JSON.parse(localStorage.getItem(KEYS.USER) || "null"); } catch {}
  try { ctx  = JSON.parse(localStorage.getItem(KEYS.FORM_CTX) || "null"); } catch {}
  const n1 = buildNombreCompleto(user);
  const n2 = ctx && ctx.alumno ? titleCase(ctx.alumno) : "";
  return n1 || n2 || "Alumno";
}

function obtenerNoControl() {
  try {
    const u = JSON.parse(localStorage.getItem(KEYS.USER) || "null");
    return u?.noControl || u?.nocontrol || u?.numeroControl || "";
  } catch { return ""; }
}

/* ================== NOTIFICACIONES (campanita) ================== */

function loadInbox(noControl){
  if(!noControl) return [];
  try {
    return JSON.parse(localStorage.getItem(`LE_inbox_${noControl}`) || "[]") || [];
  } catch {
    return [];
  }
}

function renderBell(noControl){
  const header = document.querySelector("header");
  if (!header || !noControl) return;

  let bell = document.getElementById("notifBell");
  if (!bell){
    bell = document.createElement("button");
    bell.id = "notifBell";
    bell.type = "button";
    bell.style.cssText = `
      position:absolute;right:20px;top:18px;
      width:38px;height:38px;border-radius:999px;
      border:none;background:#ffffff;
      box-shadow:0 6px 18px rgba(0,0,0,.20);
      display:inline-flex;align-items:center;justify-content:center;
      cursor:pointer;color:#7a0000;font-size:18px;
    `;
    bell.innerHTML = `
      <i class="fa-solid fa-bell"></i>
      <span id="notifBadge" style="
        position:absolute;top:-4px;right:-4px;
        min-width:18px;height:18px;
        padding:0 4px;
        border-radius:999px;
        background:#ef4444;
        color:#fff;
        font-size:11px;
        display:none;
        align-items:center;justify-content:center;
        font-weight:700;
      "></span>
    `;
    header.appendChild(bell);
  }

  const inbox = loadInbox(noControl);
  const badge = document.getElementById("notifBadge");
  const count = inbox.length;

  if (badge){
    if (count > 0){
      badge.textContent = count > 9 ? "9+" : String(count);
      badge.style.display = "inline-flex";
    } else {
      badge.style.display = "none";
    }
  }

  bell.onclick = () => {
    const data = loadInbox(noControl);
    if (!data.length){
      alert("No tienes notificaciones nuevas.");
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = "notifOverlay";
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:100000;
      background:rgba(0,0,0,.45);
      display:flex;align-items:center;justify-content:center;
    `;
    const panel = document.createElement("div");
    panel.style.cssText = `
      background:#fff;border-radius:16px;
      padding:14px 18px;max-width:420px;width:90%;
      max-height:70vh;overflow:auto;
      box-shadow:0 18px 40px rgba(0,0,0,.30);
      font-family:system-ui,Segoe UI,Roboto,Arial;
    `;
    panel.innerHTML = `
      <h3 style="margin:0 0 8px;font-size:16px;color:#7a0000">
        Notificaciones
      </h3>
      ${data.map(n => `
        <div style="padding:6px 0;border-bottom:1px solid #eee;">
          <div style="font-size:12px;color:#6b7280;">${n.ts}</div>
          <div style="font-size:14px;color:#111827;">${n.mensaje}</div>
        </div>
      `).join("")}
      <button type="button" id="notifCerrar" style="
        margin-top:10px;padding:8px 12px;border-radius:10px;
        border:none;background:#7a0000;color:#fff;
        font-weight:700;cursor:pointer;
      ">Cerrar</button>
    `;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    document.getElementById("notifCerrar").onclick = () => {
      document.body.removeChild(overlay);
      localStorage.removeItem(`LE_inbox_${noControl}`);
      renderBell(noControl);
    };
  };
}

/* ================== HELPERS (UI) ================== */
function pintarBannerBienvenida(nombre) {
  const header = $("header");
  if (!header) return;
  $("#bienvenidaNombre")?.remove();

  const banner = document.createElement("div");
  banner.id = "bienvenidaNombre";
  banner.style.cssText = `
    margin:14px auto 0; padding:10px 16px; border-radius:14px;
    background:linear-gradient(180deg,#b8191b,#8f0f11);
    color:#fff; font-weight:800; letter-spacing:.3px;
    box-shadow:0 10px 30px rgba(178,14,16,.25);
    display:inline-flex; align-items:center; gap:10px
  `;
  banner.innerHTML = `
    <i class="fa-solid fa-user" aria-hidden="true" style="opacity:.9"></i>
    <span style="font-size:clamp(14px,2.2vw,18px)">Bienvenido, <b>${nombre}</b></span>
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
  aviso.style.cssText =
    "margin:14px 0; padding:10px 14px; border-radius:12px; background:#fff; color:#7a0000; font-weight:700; box-shadow:0 6px 20px rgba(0,0,0,.06)";
  aviso.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i> <span id="avisoText">${texto}</span>`;
  grid.parentElement.insertBefore(aviso, grid);
}

const formatTimeLeft = (ms) => {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

/* ================== API ================== */
async function apiEstadoAlumno(noControl) {
  const url = `${API_BASE}?action=estado&no_control=${encodeURIComponent(noControl)}`;
  const r = await fetch(url, { credentials: "same-origin" });

  if (!r.ok) throw new Error(`HTTP ${r.status}`);

  const j = await r.json();
  if (!j || j.ok === false) throw new Error(j?.msg || "Error al consultar estado");
  return j;
}

/* ================== FALLBACK localStorage ================== */
function lsGetStatus() {
  return localStorage.getItem(KEYS.LOAN_STATUS) || null;
}
function lsGetLoan() {
  try { return JSON.parse(localStorage.getItem(KEYS.LOAN_DATA) || "null"); } catch { return null; }
}
function lsHasItems(loan) {
  return loan && Array.isArray(loan.items) && loan.items.length > 0;
}
function lsCooldownMs(cooldownMin) {
  const loan = lsGetLoan();
  const iso = loan?.aprobado_en || loan?.aprobadoEn;
  if (!iso) return 0;
  const t0 = Date.parse(iso);
  if (!Number.isFinite(t0)) return 0;
  const cdMs = (cooldownMin || COOLDOWN_DEFAULT_MIN) * 60 * 1000;
  return t0 + cdMs - Date.now();
}

/* ================== LÓGICA PRINCIPAL ================== */
function limpiarTimers() {
  if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
}

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

  limpiarTimers();

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

  if (prest.estado === "en_curso") {
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
    } catch {
      // API falló -> usamos localStorage
    }
  }

  const statusRaw = lsGetStatus();
  const loan = lsGetLoan();

  let status = statusRaw;
  if (!status && lsHasItems(loan)) status = loan?.estado || "pendiente";

  let estado = null;

  if (!status && !lsHasItems(loan)) {
    estado = null;
  } else if (status === "pendiente") {
    estado = {
      prestamo: { estado: "pendiente", items: loan?.items || [] },
      cooldown: { minutes: COOLDOWN_DEFAULT_MIN, ms_restantes: 0 }
    };
  } else if (status === "en_curso") {
    const ms = Math.max(0, lsCooldownMs(COOLDOWN_DEFAULT_MIN));
    estado = {
      prestamo: { estado: "en_curso", items: loan?.items || [] },
      cooldown: { minutes: COOLDOWN_DEFAULT_MIN, ms_restantes: ms }
    };
  } else if (status === "rechazado") {
    estado = {
      prestamo: { estado: "rechazado", items: loan?.items || [] },
      cooldown: { minutes: COOLDOWN_DEFAULT_MIN, ms_restantes: 0 }
    };
  } else if (status === "devuelto") {
    estado = null;
  }

  aplicarEstadoUI(estado);
}

/* ================== RESET FLUJO SUAVE ================== */
function resetFlujoAlEntrar() {
  try {
    KEYS.CLEAR_ON_ENTRY.forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem("SV_SEARCH_Q");
    sessionStorage.removeItem("SV_FLOW_ACTIVE");
  } catch {}
}

/* ================== INIT ================== */
document.addEventListener("DOMContentLoaded", () => {
  resetFlujoAlEntrar();
  pintar();
});

window.addEventListener("storage", (e) => {
  if (e.key === KEYS.USER || e.key === KEYS.LOAN_STATUS || e.key === KEYS.LOAN_DATA) {
    pintar();
  }
});
