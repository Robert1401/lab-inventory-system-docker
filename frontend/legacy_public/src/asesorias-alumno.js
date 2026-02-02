/* =========================================================
   Asesorías – Alumno
   - Lista de asesorías desde /backend/asesorias.php
   - Alumno actual desde localStorage LE_user
   - Inscribir / cancelar via backend:
       * POST   ?action=inscribir
       * DELETE ?action=cancelar&id_asesoria=..&no_control=..
       * GET    ?action=mis&no_control=..
========================================================= */

"use strict";

/* ---------------- CONFIG / HELPERS ---------------- */

const API_ASESORIAS = "/backend/asesorias.php";
const LS_USER_KEY   = "LE_user";
const PERSONAS_API  = "http://localhost:8000/backend/personas_api.php";

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);

// 🔧 corregido: sin +1 al día
const todayISO = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const parseHHMM = (s) => {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(s || "");
  if (!m) return null;
  const h = +m[1];
  const mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
};

const parseRangoTxt = (txt) => {
  const p = (txt || "").split("-");
  if (p.length !== 2) return null;
  const a = parseHHMM(p[0]);
  const b = parseHHMM(p[1]);
  if (a == null || b == null || b <= a) return null;
  return { ini: a, fin: b };
};

const statusFrom = (fecha, hora) => {
  const hoy = todayISO();
  if (fecha < hoy) return "Finalizada";
  if (fecha > hoy) return "Pendiente";
  const r = parseRangoTxt(hora);
  if (!r) return "Pendiente";
  const now = new Date();
  const m = now.getHours() * 60 + now.getMinutes();
  if (m < r.ini) return "Pendiente";
  if (m > r.fin) return "Finalizada";
  return "En curso";
};

// mini fetch que espera formato {ok:true,data:[...]}
async function jfetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }
  if (!res.ok || !data || data.ok === false) {
    const msg = (data && (data.error || data.msg)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  // si viene {ok:true,data:[...]} regresamos .data
  return data.data != null ? data.data : data;
}

/* ---------------- ALUMNO ACTUAL ---------------- */

function getAlumnoActual() {
  try {
    const u = JSON.parse(localStorage.getItem(LS_USER_KEY) || "null");
    if (!u) return null;
    const no_control =
      u.noControl || u.nocontrol || u.numeroControl || u.no_control || "";
    const nombre =
      u.nombreCompleto ||
      [u.nombre, u.apellidoPaterno, u.apellidoMaterno]
        .filter(Boolean)
        .join(" ")
        .trim();
    if (!no_control) return null;
    return { no_control, nombre: nombre || "Alumno" };
  } catch {
    return null;
  }
}

/* ---------------- MODAL BONITO (alert / confirm) ---------------- */

let modalOverlay = null;

function ensureModal() {
  if (modalOverlay) return modalOverlay;

  modalOverlay = document.createElement("div");
  modalOverlay.id = "aa-modal-overlay";
  modalOverlay.style.cssText = `
    position:fixed; inset:0; z-index:9999;
    display:none; align-items:center; justify-content:center;
    background:rgba(0,0,0,.45);
    backdrop-filter:blur(4px);
  `;

  const box = document.createElement("div");
  box.id = "aa-modal-box";
  box.style.cssText = `
    width: min(480px, 95%);
    background:#fff; border-radius:18px;
    box-shadow:0 18px 40px rgba(0,0,0,.4);
    padding:20px 22px;
    font-family:system-ui,Segoe UI,Roboto,Arial;
  `;

  box.innerHTML = `
    <h2 id="aa-modal-title"
        style="margin:0 0 10px; font-size:18px; color:#5b0c0c; font-weight:800;">
      Aviso
    </h2>
    <p id="aa-modal-msg"
       style="margin:0 0 18px; font-size:15px; color:#374151; line-height:1.5;">
    </p>
    <div style="display:flex; justify-content:flex-end; gap:10px;">
      <button id="aa-modal-cancel"
              style="padding:8px 14px; border-radius:999px; border:none;
                     background:#e5e7eb; color:#111827; font-weight:600; cursor:pointer;">
        Cancelar
      </button>
      <button id="aa-modal-ok"
              style="padding:8px 18px; border-radius:999px; border:none;
                     background:#5b0c0c; color:#fff; font-weight:700; cursor:pointer;">
        Aceptar
      </button>
    </div>
  `;

  modalOverlay.appendChild(box);
  document.body.appendChild(modalOverlay);
  return modalOverlay;
}

function modalAlert(message, title = "Aviso") {
  return new Promise((resolve) => {
    const overlay = ensureModal();
    const t = overlay.querySelector("#aa-modal-title");
    const msg = overlay.querySelector("#aa-modal-msg");
    const btnOk = overlay.querySelector("#aa-modal-ok");
    const btnCancel = overlay.querySelector("#aa-modal-cancel");

    t.textContent = title;
    msg.textContent = message;
    btnCancel.style.display = "none";

    const clean = () => {
      overlay.style.display = "none";
      document.body.classList.remove("aa-modal-open");
      btnOk.onclick = null;
      btnCancel.onclick = null;
      overlay.onclick = null;
    };

    btnOk.onclick = () => {
      clean();
      resolve(true);
    };

    overlay.onclick = (e) => {
      if (e.target === overlay) {
        clean();
        resolve(true);
      }
    };

    document.body.classList.add("aa-modal-open");
    overlay.style.display = "flex";
  });
}

function modalConfirm(message, title = "Confirmar") {
  return new Promise((resolve) => {
    const overlay = ensureModal();
    const t = overlay.querySelector("#aa-modal-title");
    const msg = overlay.querySelector("#aa-modal-msg");
    const btnOk = overlay.querySelector("#aa-modal-ok");
    const btnCancel = overlay.querySelector("#aa-modal-cancel");

    t.textContent = title;
    msg.textContent = message;
    btnCancel.style.display = "inline-block";

    const clean = () => {
      overlay.style.display = "none";
      document.body.classList.remove("aa-modal-open");
      btnOk.onclick = null;
      btnCancel.onclick = null;
      overlay.onclick = null;
    };

    btnOk.onclick = () => {
      clean();
      resolve(true);
    };
    btnCancel.onclick = () => {
      clean();
      resolve(false);
    };
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        clean();
        resolve(false);
      }
    };

    document.body.classList.add("aa-modal-open");
    overlay.style.display = "flex";
  });
}

/* ---------------- DOCENTES (para nombre) ---------------- */

let PROFESORES = [];
let PROF_MAP = {}; // id_Profesor -> nombreCompleto

async function loadProfesores() {
  if (PROFESORES.length) return; // ya cargados

  try {
    const res = await fetch(`${PERSONAS_API}?action=list`);
    const data = await res.json();
    const personas = (data && data.data) ? data.data : [];

    const docentes = personas.filter(
      (p) => String(p.tipo || "").toLowerCase() === "docente"
    );

    PROFESORES = docentes.map((p, idx) => ({
      id_Profesor: String(p.numeroControl || p.no_control || idx + 1),
      nombreCompleto: [p.nombre, p.apellidoPaterno, p.apellidoMaterno]
        .filter(Boolean)
        .join(" ")
        .trim(),
    }));

    PROF_MAP = {};
    PROFESORES.forEach((p) => {
      PROF_MAP[p.id_Profesor] = p.nombreCompleto;
    });
  } catch (e) {
    console.error("Error cargando docentes desde PERSONAS_API", e);
    PROFESORES = [];
    PROF_MAP = {};
  }
}

/* ---------------- ESTADO EN MEMORIA ---------------- */

let ASESORIAS_CACHE = []; // lista completa
let MIS_IDS = new Set();  // ids en los que está inscrito el alumno

/* ---------------- BACKEND CALLS ---------------- */

// carga todas las asesorías
async function loadAsesorias() {
  try {
    // primero nos aseguramos de tener el mapa de docentes
    await loadProfesores();

    const raw = await jfetch(API_ASESORIAS); // espera data:[...]
    ASESORIAS_CACHE = (raw || []).map((x) => {
      const horaTxt = x.hora || x.horario || "";
      const fecha = x.fecha || x.dia || "";
      const cupoTotal = Number(x.cupo_total ?? x.cupoTotal ?? x.cupo ?? 0);
      const cupoActual = Number(x.cupo_actual ?? x.cupoActual ?? 0);

      const idProf = String(x.id_profesor ?? x.id_Profesor ?? "");

      const fromBackend = (
        x.docenteNombre ||
        x.docente ||
        x.profesor ||
        x.auxiliarNombre ||
        ""
      ).trim();

      const fromMap = (PROF_MAP[idProf] || "").trim();

      // nombre final del docente
      const docenteNombre = fromBackend || fromMap || "";

      const auxiliarNombre =
        x.auxiliarNombre || x.auxiliar || docenteNombre || "";

      return {
        id: String(x.id),
        titulo: x.titulo,
        descripcion: x.descripcion || "",
        fecha,
        hora: horaTxt,
        cupoTotal,
        cupoActual,
        docenteNombre,
        auxiliarNombre,
        status: statusFrom(fecha, horaTxt),
      };
    });
  } catch (e) {
    console.error("Error cargando asesorías:", e);
    ASESORIAS_CACHE = [];
  }
}

// carga ids de asesorías donde está inscrito el alumno actual
async function loadMisAsesorias(no_control) {
  MIS_IDS = new Set();
  if (!no_control) return;
  try {
    const raw = await jfetch(
      `${API_ASESORIAS}?action=mis&no_control=${encodeURIComponent(
        no_control
      )}`
    );
    (raw || []).forEach((r) => MIS_IDS.add(String(r.id_asesoria || r.id)));
  } catch (e) {
    console.warn("No se pudo cargar 'mis asesorías':", e.message);
  }
}

// inscribirse en asesoría
async function backendInscribir(id_asesoria, alumno) {
  const body = {
    id_asesoria: Number(id_asesoria),
    no_control: alumno.no_control,
    nombre: alumno.nombre,
  };
  await jfetch(`${API_ASESORIAS}?action=inscribir`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// cancelar inscripción
async function backendCancelar(id_asesoria, alumno) {
  const url =
    `${API_ASESORIAS}?action=cancelar` +
    `&id_asesoria=${encodeURIComponent(id_asesoria)}` +
    `&no_control=${encodeURIComponent(alumno.no_control)}`;
  await jfetch(url, { method: "DELETE" });
}

/* ---------------- RENDER: DISPONIBLES ---------------- */

function renderDisponibles() {
  const cont = $("#listaDisponibles");
  const empty = $("#emptyDisponibles");
  if (!cont || !empty) return;

  const hoy = todayISO();
  const list = ASESORIAS_CACHE.filter((s) => {
    const hayCupo = s.cupoActual < s.cupoTotal;
    const noInscrito = !MIS_IDS.has(s.id);
    return s.fecha >= hoy && hayCupo && noInscrito;
  });

  if (!list.length) {
    cont.innerHTML = "";
    cont.style.display = "none";
    empty.style.display = "flex";
    return;
  }

  cont.style.display = "grid";
  empty.style.display = "none";

  cont.innerHTML = list
    .map((s) => {
      const badgeClass =
        s.status === "En curso"
          ? "status-en-curso"
          : s.status === "Pendiente"
          ? "status-pendiente"
          : "status-finalizada";
      return `
      <div class="asesoria-card">
        <h2 class="card-title">${esc(s.titulo)}</h2>
        <div class="card-info">
          <p class="info-item">
            <span class="icon">👨‍🏫</span>
            <strong>Docente:</strong> ${esc(s.docenteNombre || "—")}
          </p>
          <p class="info-item">
            <span class="icon">📝</span>
            <strong>Descripción:</strong> ${esc(s.descripcion)}
          </p>
          <p class="info-item">
            <span class="icon">📅</span>
            <strong>Fecha:</strong> ${esc(s.fecha)}
          </p>
          <p class="info-item">
            <span class="icon">🕐</span>
            <strong>Hora:</strong> ${esc(s.hora)}
          </p>
          <p class="info-item">
            <span class="icon">👥</span>
            <strong>Cupo:</strong>
            <span class="cupos-count">
              ${s.cupoActual}/${s.cupoTotal}
            </span>
          </p>
          <div class="status-wrapper">
            <span class="status-badge ${badgeClass}">
              ${s.status.toUpperCase()}
            </span>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn-primary" data-act="ins" data-id="${s.id}">
            ✓ Inscribirme
          </button>
        </div>
      </div>
    `;
    })
    .join("");

  cont.querySelectorAll("[data-act='ins']").forEach((btn) => {
    btn.onclick = () => inscribirse(btn.dataset.id);
  });
}

/* ---------------- RENDER: MIS ASESORÍAS ---------------- */

function renderMis() {
  const cont = $("#listaMis");
  const empty = $("#emptyMis");
  if (!cont || !empty) return;

  const list = ASESORIAS_CACHE.filter((s) => MIS_IDS.has(s.id));

  if (!list.length) {
    cont.innerHTML = "";
    cont.style.display = "none";
    empty.style.display = "flex";
    return;
  }

  cont.style.display = "grid";
  empty.style.display = "none";

  cont.innerHTML = list
    .map((s) => {
      const badgeClass =
        s.status === "En curso"
          ? "status-en-curso"
          : s.status === "Pendiente"
          ? "status-pendiente"
          : "status-finalizada";
      const lleno = s.cupoActual >= s.cupoTotal;
      return `
      <div class="asesoria-card">
        <h2 class="card-title">${esc(s.titulo)}</h2>
        <div class="card-info">
          <p class="info-item">
            <span class="icon">👨‍🏫</span>
            <strong>Docente:</strong> ${esc(s.docenteNombre || "—")}
          </p>
          <p class="info-item">
            <span class="icon">📝</span>
            <strong>Descripción:</strong> ${esc(s.descripcion)}
          </p>
          <p class="info-item">
            <span class="icon">📅</span>
            <strong>Fecha:</strong> ${esc(s.fecha)}
          </p>
          <p class="info-item">
            <span class="icon">🕐</span>
            <strong>Hora:</strong> ${esc(s.hora)}
          </p>
          <p class="info-item">
            <span class="icon">👥</span>
            <strong>Cupo:</strong> ${s.cupoActual}/${s.cupoTotal}
            ${lleno ? '<span class="tag-full"> (Cupo lleno)</span>' : ""}
          </p>
          <div class="status-wrapper">
            <span class="status-badge ${badgeClass}">
              ${s.status.toUpperCase()}
            </span>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn-danger" data-act="cancel" data-id="${s.id}">
            ❌ Cancelar inscripción
          </button>
        </div>
      </div>
    `;
    })
    .join("");

  cont.querySelectorAll("[data-act='cancel']").forEach((btn) => {
    btn.onclick = () => cancelarInscripcion(btn.dataset.id);
  });
}

/* ---------------- ACCIONES (inscribir / cancelar) ---------------- */

async function inscribirse(id) {
  const alumno = getAlumnoActual();
  if (!alumno) {
    await modalAlert(
      "No se encontró la sesión del alumno. Vuelve a iniciar sesión.",
      "Sesión no válida"
    );
    return;
  }

  // 🔧 chequeo rápido de cupo lleno
  const asesoria = ASESORIAS_CACHE.find((s) => s.id === String(id));
  if (asesoria && asesoria.cupoActual >= asesoria.cupoTotal) {
    await modalAlert(
      "Esta asesoría ya se encuentra llena.",
      "Cupo lleno"
    );
    await loadAsesorias();
    renderDisponibles();
    renderMis();
    return;
  }

  const ok = await modalConfirm(
    "¿Deseas inscribirte en esta asesoría?",
    "Confirmar inscripción"
  );
  if (!ok) return;

  try {
    await backendInscribir(id, alumno);
    await Promise.all([loadAsesorias(), loadMisAsesorias(alumno.no_control)]);
    await modalAlert("Te has inscrito exitosamente.", "Listo");
    renderDisponibles();
    renderMis();
    switchView("mis");
  } catch (e) {
    console.error(e);
    await modalAlert(
      e.message || "No se pudo completar la inscripción.",
      "Error"
    );
  }
}

async function cancelarInscripcion(id) {
  const alumno = getAlumnoActual();
  if (!alumno) {
    await modalAlert(
      "No se encontró la sesión del alumno. Vuelve a iniciar sesión.",
      "Sesión no válida"
    );
    return;
  }

  const ok = await modalConfirm(
    "¿Seguro que deseas cancelar tu inscripción?",
    "Cancelar inscripción"
  );
  if (!ok) return;

  try {
    await backendCancelar(id, alumno);
    await Promise.all([loadAsesorias(), loadMisAsesorias(alumno.no_control)]);
    await modalAlert("Tu inscripción ha sido cancelada.", "Listo");
    renderDisponibles();
    renderMis();
    switchView("mis");
  } catch (e) {
    console.error(e);
    await modalAlert(
      e.message || "No se pudo cancelar la inscripción.",
      "Error"
    );
  }
}

/* ---------------- TABS / VISTAS ---------------- */

function switchView(view) {
  const vDisp = $("#viewDisponibles");
  const vMis = $("#viewMis");
  const tDisp = $("#tabDisponibles");
  const tMis = $("#tabMis");
  const title = $("#mainTitle");

  if (view === "mis") {
    vDisp.style.display = "none";
    vMis.style.display = "block";
    tDisp.classList.remove("active");
    tMis.classList.add("active");
    title.textContent = "MIS ASESORÍAS";
    renderMis();
  } else {
    vDisp.style.display = "block";
    vMis.style.display = "none";
    tDisp.classList.add("active");
    tMis.classList.remove("active");
    title.textContent = "ASESORÍAS DISPONIBLES";
    renderDisponibles();
  }
}
window.switchView = switchView;

// Sólo borra datos de prueba (si usas algo en localStorage en el futuro)
function clearData() {
  modalConfirm(
    "Esto borrará cualquier dato de prueba almacenado localmente.\n(No borra nada en la base de datos.)",
    "Limpiar datos de prueba"
  ).then((ok) => {
    if (!ok) return;
    // aquí puedes limpiar claves si llegas a usarlas
    // localStorage.removeItem("LO_QUE_SEA");
    modalAlert("Datos locales limpiados.");
  });
}
window.clearData = clearData;

/* ---------------- INIT ---------------- */

document.addEventListener("DOMContentLoaded", async () => {
  const alumno = getAlumnoActual();
  await loadProfesores();   // <- primero cargamos docentes
  await loadAsesorias();    // <- luego asesorías (ya con mapa id -> nombre)
  if (alumno) {
    await loadMisAsesorias(alumno.no_control);
  }
  switchView("disponibles");
});
