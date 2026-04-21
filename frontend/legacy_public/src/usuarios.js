"use strict";

/* =========================
   Endpoints
========================= */
const API = "/api/personas";
const API_CARRERAS = "/api/carreras";

/* =========================
   Helpers DOM
========================= */
const $ = (s) => document.querySelector(s);

const form = $("#formPersona");
const selTipo = $("#tipo");
const selCarrera = $("#carrera");
const fieldCarrera = document.getElementById("fieldCarrera");
const fieldPwd = document.getElementById("fieldPwd");

const inpCtrl = $("#control");
const inpNom = $("#nombre");
const inpPat = $("#paterno");
const inpMat = $("#materno");
const inpPwd = $("#pwd");
const helpCtrl = $("#controlHelp");
const carreraHelp = $("#carreraHelp");
const pwdHelp = $("#pwdHelp");

const btnGuardar = $("#btnGuardar");
const btnActualizar = $("#btnActualizar");
const btnEliminar = $("#btnEliminar");
const btnCancelar = $("#btnCancelar");
const tblBody = document.querySelector("#tblPersonas tbody");
const btnEye = document.getElementById("togglePwd");
const homeLink = document.querySelector(".fab-home");

/* =========================
   Estado
========================= */
let cache = [];
const draftStore = new Map();
let lastTipo = "";

/* =========================
   Normalización
========================= */
function normStr(s = "") {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

function sameFullName(a, b) {
  return normStr(a.nombre) === normStr(b.nombre) &&
    normStr(a.paterno) === normStr(b.paterno) &&
    normStr(a.materno) === normStr(b.materno);
}

function existsFullNameCrossRole(nombre, paterno, materno, tipo, ignoreControl = null) {
  const tgt = { nombre, paterno, materno };

  return cache.some(x => {
    const sameName = sameFullName(tgt, {
      nombre: x.nombre,
      paterno: x.apellidoPaterno,
      materno: x.apellidoMaterno
    });

    const otherType = (x.tipo || "") !== (tipo || "");
    const notSameControl = ignoreControl ? (String(x.numeroControl) !== String(ignoreControl)) : true;

    return sameName && otherType && notSameControl;
  });
}

/* =========================
   Utils
========================= */
const isBlank = (s) => !s || s.trim().length === 0;

function titleCase(s = "") {
  return s.toLowerCase().replace(/\s+/g, " ").trim()
    .replace(/\b([a-záéíóúñü])/g, m => m.toUpperCase());
}

function escapeHTML(s = "") {
  return s.replace(/[&<>"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[c]));
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._id);
  toast._id = setTimeout(() => t.classList.remove("show"), 1800);
}

/* =========================
   Confirmación
========================= */
function showConfirm(text = "¿Seguro que deseas continuar?", opts = {}) {
  const overlay = document.getElementById("confirmOverlay");
  if (!overlay) return Promise.resolve(confirm(text));

  const card = overlay.querySelector(".confirm-card");
  const icon = overlay.querySelector(".confirm-icon");
  const title = overlay.querySelector("#c-title");
  const txt = overlay.querySelector("#c-text");
  const okBtn = overlay.querySelector("#c-ok");
  const noBtn = overlay.querySelector("#c-cancel");

  title.textContent = opts.title || "Confirmación";
  txt.textContent = text;
  icon.textContent = opts.icon || "❓";
  okBtn.textContent = opts.okText || "Sí, continuar";
  noBtn.textContent = opts.cancelText || "Cancelar";

  overlay.hidden = false;

  return new Promise(resolve => {
    const close = (val) => {
      card.style.animation = "cardOut .14s ease forwards";
      overlay.style.animation = "fadeOutConfirm .14s ease forwards";
      setTimeout(() => {
        overlay.hidden = true;
        overlay.style.animation = "";
        resolve(val);
      }, 150);

      okBtn.removeEventListener("click", onOK);
      noBtn.removeEventListener("click", onNO);
      window.removeEventListener("keydown", onKey);
      overlay.removeEventListener("click", onBackdrop);
    };

    const onOK = () => close(true);
    const onNO = () => close(false);
    const onKey = (e) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    const onBackdrop = (e) => {
      if (e.target === overlay) close(false);
    };

    okBtn.addEventListener("click", onOK);
    noBtn.addEventListener("click", onNO);
    window.addEventListener("keydown", onKey);
    overlay.addEventListener("click", onBackdrop);
  });
}

/* =========================
   Fetch helper
========================= */
async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.error || data.success === false) {
    throw new Error(data.message || data.error || `Error (${res.status})`);
  }

  return data;
}

/* =========================
   Password strength
========================= */
function passwordStrength(pwd = "") {
  if (isBlank(pwd)) return { score: 0, label: "Muy débil", color: "#b00020" };

  const s = pwd;
  const L = s.length;
  const hasLower = /[a-z]/.test(s);
  const hasUpper = /[A-Z]/.test(s);
  const hasDigit = /\d/.test(s);
  const hasSym = /[^A-Za-z0-9]/.test(s);

  const classes = [hasLower, hasUpper, hasDigit, hasSym].filter(Boolean).length;

  let score = 0;
  if (L >= 4) score = 1;
  if (L >= 6) score = 2;
  if (L >= 8) score = 3;
  if (L >= 10) score = 4;

  if (score < 4 && classes >= 3) score = Math.min(4, score + 1);
  if (classes <= 1) score = Math.max(0, score - 1);

  score = Math.max(0, Math.min(4, score));

  const labels = ["Muy débil", "Débil", "Aceptable", "Fuerte", "Muy fuerte"];
  const colors = ["#b00020", "#d88400", "#b0a000", "#0f8b2d", "#0a6cc0"];
  return { score, label: labels[score], color: colors[score] };
}

/* =========================
   Cargar carreras
========================= */
async function loadCarreras() {
  if (!selCarrera) return;

  try {
    const data = await fetchJson(API_CARRERAS);

    selCarrera.innerHTML = '<option value="" hidden>Seleccione…</option>';

    if (!Array.isArray(data) || data.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Sin carreras disponibles";
      selCarrera.appendChild(opt);
      return;
    }

    data.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id_Carrera;
      opt.textContent = c.nombre;
      selCarrera.appendChild(opt);
    });

    if (carreraHelp) {
      carreraHelp.textContent = "Obligatorio solo para Alumno.";
      carreraHelp.style.color = "#6b6b6b";
    }
  } catch (err) {
    console.error("Error al cargar carreras:", err);
    selCarrera.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "⚠ Error al cargar carreras";
    selCarrera.appendChild(opt);

    if (carreraHelp) {
      carreraHelp.textContent = "⚠ No se pudieron cargar las carreras.";
      carreraHelp.style.color = "#b00020";
    }

    toast("⚠ No se pudieron cargar las carreras.");
  }
}

/* =========================
   Init
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  btnActualizar.disabled = true;
  btnEliminar.disabled = true;
  btnCancelar.disabled = true;

  if (fieldCarrera) fieldCarrera.style.display = "none";

  lastTipo = selTipo.value || "";

  await loadCarreras();
  await loadTable();
  lockFieldsByTipo();
  if (hasTipoSelected()) applyTipoRules();
  renderFiltered();
  syncButtons();
});

/* =========================
   Eventos
========================= */
btnEye?.addEventListener("click", () => {
  const isPwd = inpPwd.type === "password";
  inpPwd.type = isPwd ? "text" : "password";
  btnEye.innerHTML = `<i class="fa-regular ${isPwd ? "fa-eye-slash" : "fa-eye"}"></i>`;
});

selTipo.addEventListener("change", () => {
  const prev = lastTipo;
  const next = selTipo.value || "";

  if (prev && hasDirtyData()) {
    draftStore.set(prev, { data: readForm(), expire: Date.now() + 3000 });
  }

  lockFieldsByTipo();
  if (hasTipoSelected()) applyTipoRules();

  if (!restoreDraftIfFresh(next)) {
    clearInputsForNewType();
  }

  renderFiltered();
  syncButtons();
  lastTipo = next;
});

inpCtrl.addEventListener("input", onControlInput);

[inpNom, inpPat, inpMat].forEach(el => {
  el.addEventListener("input", () => {
    if (isBlank(el.value)) el.value = el.value.trim();
    syncButtons();
  });
});

inpPwd.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Tab") e.preventDefault();
});

inpPwd.addEventListener("beforeinput", (e) => {
  if (e.inputType === "insertText" && /\s/.test(e.data || "")) e.preventDefault();
});

inpPwd.addEventListener("paste", (e) => {
  e.preventDefault();
  const txt = (e.clipboardData?.getData("text") || "").replace(/\s+/g, "");
  const start = inpPwd.selectionStart ?? inpPwd.value.length;
  const end = inpPwd.selectionEnd ?? inpPwd.value.length;
  const next = (inpPwd.value.slice(0, start) + txt + inpPwd.value.slice(end)).slice(0, 10);
  inpPwd.value = next;
  const pos = Math.min(start + txt.length, 10);
  inpPwd.setSelectionRange(pos, pos);
  onPwdInput();
});

inpPwd.addEventListener("input", onPwdInput);

if (homeLink) {
  homeLink.addEventListener("click", async (e) => {
    if (hasDirtyData()) {
      e.preventDefault();
      const ok = await showConfirm(
        "Tienes datos sin terminar. Si sales se perderán.\n¿Deseas salir?",
        { title: "Salir al inicio", icon: "🏠", okText: "Sí, salir", cancelText: "Seguir aquí" }
      );
      if (ok) window.location.href = homeLink.href;
    }
  });
}

form.addEventListener("input", syncButtons);
form.addEventListener("change", syncButtons);

/* =========================
   Botón Cancelar
========================= */
btnCancelar.addEventListener("click", async () => {
  if (!hasDirtyData()) {
    btnCancelar.disabled = true;
    return;
  }

  const ok = await showConfirm(
    "Se limpiará el formulario y se cancelará la edición actual.\n¿Deseas continuar?",
    { title: "Cancelar cambios", icon: "↩️", okText: "Sí, cancelar", cancelText: "Seguir editando" }
  );

  if (!ok) return;

  form.reset();
  if (selCarrera) selCarrera.value = "";
  applyTipoRules();

  pwdHelp.textContent = "Máximo 10 caracteres. La fuerza máxima se alcanza en 10.";
  pwdHelp.style.color = "#6b6b6b";
  helpCtrl.style.color = "#6b6b6b";

  btnActualizar.disabled = true;
  btnEliminar.disabled = true;
  btnCancelar.disabled = true;
  syncButtons();
});

/* =========================
   Guardar
========================= */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const p = readForm();
  if (!validateBeforeSubmit(p)) return;

  if (p.tipo !== "Docente" && !isBlank(p.password)) {
    const st = passwordStrength(p.password);
    if (p.password.length < 10 || st.score <= 1) {
      const ok = await showConfirm(
        `La contraseña se evaluó como "${st.label}" (${p.password.length}/10).\n¿Deseas guardarla así?`,
        { title: "Contraseña poco segura", icon: "🔐", okText: "Guardar así", cancelText: "Mejorarla" }
      );
      if (!ok) return;
    }
  }

  try {
    const data = await fetchJson(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p)
    });

    toast(data.message || "✅ Persona guardada.");

    clearDraft(p.tipo);
    form.reset();
    if (selCarrera) selCarrera.value = "";
    lockFieldsByTipo();
    if (hasTipoSelected()) applyTipoRules();

    await loadTable();
    renderFiltered();
    btnActualizar.disabled = true;
    btnEliminar.disabled = true;
    btnCancelar.disabled = true;
    syncButtons();

    pwdHelp.textContent = "Máximo 10 caracteres. La fuerza máxima se alcanza en 10.";
    pwdHelp.style.color = "#6b6b6b";
  } catch (err) {
    toast(err.message || "❌ Error al guardar.");
  }
});

/* =========================
   Actualizar
========================= */
btnActualizar.addEventListener("click", async () => {
  const p = readForm();

  if (!p.control) return toast("Indica el número de control.");

  const digits = digitsByTipo(p.tipo);
  if (!new RegExp(`^\\d{${digits}}$`).test(p.control)) {
    return toast(`⚠ Debe tener ${digits} dígitos.`);
  }

  if (p.tipo !== "Docente" && !isBlank(p.password)) {
    const st = passwordStrength(p.password);
    if (p.password.length < 10 || st.score <= 1) {
      const ok = await showConfirm(
        `La contraseña se evaluó como "${st.label}" (${p.password.length}/10).\n¿Deseas actualizarla así?`,
        { title: "Contraseña poco segura", icon: "🔐", okText: "Actualizar así", cancelText: "Mejorarla" }
      );
      if (!ok) return;
    }
  }

  if (existsFullNameCrossRole(p.nombre, p.paterno, p.materno, p.tipo, p.control)) {
    return toast("⚠ Ese nombre completo ya está usado en otro tipo.");
  }

  try {
    const data = await fetchJson(API, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p)
    });

    toast(data.message || "✅ Registro actualizado.");
    clearDraft(p.tipo);

    await loadTable();
    renderFiltered();
    syncButtons();
  } catch (err) {
    toast(err.message || "❌ Error al actualizar.");
  }
});

/* =========================
   Eliminar
========================= */
btnEliminar.addEventListener("click", async () => {
  const tipo = (selTipo.value || "").trim();
  const ctrl = (inpCtrl.value || "").trim();
  const digits = digitsByTipo(tipo || "Alumno");

  if (!new RegExp(`^\\d{${digits}}$`).test(ctrl)) {
    return toast(`⚠ Número de control inválido (${digits} dígitos).`);
  }

  const ok = await showConfirm(
    `Se eliminará el registro con número de control ${ctrl}.`,
    { title: "Eliminar", icon: "🗑️", okText: "Eliminar", cancelText: "Cancelar" }
  );
  if (!ok) return;

  try {
    const data = await fetchJson(`${API}/${encodeURIComponent(ctrl)}`, {
      method: "DELETE"
    });

    toast(data.message || "🗑️ Eliminado.");

    clearDraft(tipo);
    form.reset();
    if (selCarrera) selCarrera.value = "";
    lockFieldsByTipo();
    if (hasTipoSelected()) applyTipoRules();

    await loadTable();
    renderFiltered();
    btnActualizar.disabled = true;
    btnEliminar.disabled = true;
    btnCancelar.disabled = true;
    syncButtons();
  } catch (err) {
    toast(err.message || "❌ Error al eliminar.");
  }
});

/* =========================
   Reglas por tipo
========================= */
function hasTipoSelected() {
  return !!(selTipo.value && selTipo.value.trim().length);
}

function setInputsEnabled(enabled) {
  [inpCtrl, inpNom, inpPat, inpMat, inpPwd, selCarrera].forEach(i => {
    if (!i) return;
    i.disabled = !enabled;
    if (!enabled) i.value = "";
  });
}

function lockFieldsByTipo() {
  const enabled = hasTipoSelected();
  setInputsEnabled(enabled);

  if (!enabled) {
    helpCtrl.textContent = "Primero selecciona el tipo de registro para habilitar los campos.";
    helpCtrl.style.color = "#b00020";

    pwdHelp.textContent = "Campo bloqueado hasta elegir tipo.";
    pwdHelp.style.color = "#6b6b6b";

    if (carreraHelp) {
      carreraHelp.textContent = "Obligatorio solo para Alumno.";
      carreraHelp.style.color = "#6b6b6b";
    }

    if (fieldCarrera) {
      fieldCarrera.style.display = "none";
      selCarrera.disabled = true;
      selCarrera.value = "";
    }

    btnGuardar.disabled = true;
    btnActualizar.disabled = true;
    btnEliminar.disabled = true;
    btnCancelar.disabled = true;
  } else {
    applyTipoRules();
  }
}

function digitsByTipo(tipo) {
  return (tipo === "Alumno") ? 8 : 4;
}

function applyTipoRules() {
  const tipo = (selTipo.value || "Alumno").trim();
  const digits = digitsByTipo(tipo);

  inpCtrl.maxLength = digits;
  inpCtrl.value = (inpCtrl.value || "").replace(/\D+/g, "").slice(0, digits);
  helpCtrl.textContent = `Solo números (exactamente ${digits} dígitos para ${tipo})`;
  helpCtrl.style.color = "#6b6b6b";

  if (fieldPwd) {
    if (tipo === "Docente") {
      fieldPwd.style.display = "none";
      inpPwd.value = "";
      inpPwd.disabled = true;
      pwdHelp.textContent = "No se requiere contraseña para Docente.";
      pwdHelp.style.color = "#6b6b6b";
    } else {
      fieldPwd.style.display = "";
      inpPwd.disabled = false;
      inpPwd.maxLength = 10;
      pwdHelp.textContent = "Máximo 10 caracteres. La fuerza máxima se alcanza en 10.";
      pwdHelp.style.color = "#6b6b6b";
    }
  }

  if (fieldCarrera && selCarrera) {
    if (tipo === "Alumno") {
      fieldCarrera.style.display = "flex";
      selCarrera.disabled = false;
    } else {
      fieldCarrera.style.display = "none";
      selCarrera.disabled = true;
      selCarrera.value = "";
    }
  }
}

/* =========================
   Tabla
========================= */
async function loadTable() {
  try {
    const data = await fetchJson(API);
    cache = data?.data || [];
  } catch {
    cache = [];
    toast("⚠ No se pudo cargar la lista.");
  }
}

function renderFiltered() {
  const tipo = (selTipo.value || "").trim();
  const rows = tipo ? cache.filter(p => p.tipo === tipo) : cache;
  renderTable(rows);
}

function renderTable(rows) {
  if (!rows.length) {
    tblBody.innerHTML = `<tr><td colspan="4" style="color:#777; padding:18px">Sin registros.</td></tr>`;
    return;
  }

  tblBody.innerHTML = rows
    .slice()
    .sort((a, b) => String(a.numeroControl).localeCompare(String(b.numeroControl)))
    .map(p => `
      <tr data-control="${p.numeroControl}">
        <td>${p.numeroControl}</td>
        <td>${escapeHTML(p.nombre)}</td>
        <td>${escapeHTML(p.apellidoPaterno)}</td>
        <td>${escapeHTML(p.apellidoMaterno)}</td>
      </tr>
    `).join("");
}

/* =========================
   Form helpers
========================= */
function readForm() {
  return {
    tipo: (selTipo.value || "").trim(),
    control: (inpCtrl.value || "").trim(),
    nombre: titleCase(inpNom.value || ""),
    paterno: titleCase(inpPat.value || ""),
    materno: titleCase(inpMat.value || ""),
    carrera: (selCarrera?.value || "").trim(),
    password: (inpPwd.value || "")
  };
}

function hasDirtyData() {
  const extra = selCarrera ? [selCarrera] : [];
  return [inpCtrl, inpNom, inpPat, inpMat, inpPwd, ...extra].some(i => i && !isBlank(i.value));
}

function clearInputsForNewType() {
  [inpCtrl, inpNom, inpPat, inpMat, inpPwd].forEach(i => i.value = "");
  if (selCarrera) selCarrera.value = "";

  pwdHelp.textContent = "Máximo 10 caracteres. La fuerza máxima se alcanza en 10.";
  pwdHelp.style.color = "#6b6b6b";
  helpCtrl.style.color = "#6b6b6b";

  if (carreraHelp) {
    carreraHelp.textContent = "Obligatorio solo para Alumno.";
    carreraHelp.style.color = "#6b6b6b";
  }
}

function restoreDraftIfFresh(tipo) {
  const d = draftStore.get(tipo);
  if (!d) return false;
  if (Date.now() > d.expire) {
    draftStore.delete(tipo);
    return false;
  }

  fillFieldsFromDraft(d.data);
  applyTipoRules();
  syncButtons();
  return true;
}

function clearDraft(tipo) {
  draftStore.delete(tipo);
}

function fillFieldsFromDraft(data) {
  inpCtrl.value = data.control || "";
  inpNom.value = data.nombre || "";
  inpPat.value = data.paterno || "";
  inpMat.value = data.materno || "";
  inpPwd.value = data.password || "";
  if (selCarrera) selCarrera.value = data.carrera || "";
  onPwdInput();
}

/* =========================
   Validaciones
========================= */
function validateBeforeSubmit(p) {
  if (!hasTipoSelected()) {
    toast("⚠ Selecciona el tipo de registro.");
    return false;
  }

  const necesitaPwd = (p.tipo !== "Docente");

  if (
    isBlank(p.tipo) || isBlank(p.control) || isBlank(p.nombre) ||
    isBlank(p.paterno) || isBlank(p.materno) ||
    (necesitaPwd && isBlank(p.password))
  ) {
    toast("⚠ Llena todos los campos obligatorios.");
    return false;
  }

  if (p.tipo === "Alumno" && isBlank(p.carrera)) {
    toast("⚠ Selecciona una carrera para el Alumno.");
    return false;
  }

  const digits = digitsByTipo(p.tipo);
  if (!new RegExp(`^\\d{${digits}}$`).test(p.control)) {
    toast(`⚠ El número de control debe tener exactamente ${digits} dígitos para ${p.tipo}.`);
    return false;
  }

  if (cache.some(x => String(x.numeroControl) === p.control)) {
    toast("⚠ Ese número de control ya está registrado.");
    return false;
  }

  if (existsFullNameCrossRole(p.nombre, p.paterno, p.materno, p.tipo, null)) {
    toast("⚠ Ese nombre completo ya está usado en otro tipo.");
    return false;
  }

  return true;
}

function onControlInput(e) {
  if (!hasTipoSelected()) return;

  const digits = digitsByTipo(selTipo.value || "Alumno");
  e.target.value = e.target.value.replace(/\D+/g, "").slice(0, digits);

  const v = e.target.value.trim();
  if (!v) {
    helpCtrl.textContent = `Solo números (exactamente ${digits} dígitos)`;
    helpCtrl.style.color = "#6b6b6b";
    btnActualizar.disabled = true;
    btnEliminar.disabled = true;
    syncButtons();
    return;
  }

  const found = cache.find(x => String(x.numeroControl) === v);

  if (found) {
    helpCtrl.textContent = `⚠ Ya está en uso por ${found.tipo}.`;
    helpCtrl.style.color = "#b00020";
    btnActualizar.disabled = false;
    btnEliminar.disabled = false;
  } else if (v.length < digits) {
    helpCtrl.textContent = `Debe tener ${digits} dígitos.`;
    helpCtrl.style.color = "#e57d00";
    btnActualizar.disabled = true;
    btnEliminar.disabled = true;
  } else {
    helpCtrl.textContent = "Disponible.";
    helpCtrl.style.color = "#2e7d32";
    btnActualizar.disabled = true;
    btnEliminar.disabled = true;
  }

  syncButtons();
}

function onPwdInput() {
  inpPwd.value = inpPwd.value.replace(/\s+/g, "").slice(0, 10);

  const s = inpPwd.value;
  if (!s) {
    pwdHelp.textContent = "Máximo 10 caracteres. La fuerza máxima se alcanza en 10.";
    pwdHelp.style.color = "#6b6b6b";
  } else {
    const st = passwordStrength(s);
    pwdHelp.textContent = `Seguridad: ${st.label} (${s.length}/10)`;
    pwdHelp.style.color = st.color;
  }

  syncButtons();
}

function syncButtons() {
  if (!hasTipoSelected()) {
    btnGuardar.disabled = true;
    btnActualizar.disabled = true;
    btnEliminar.disabled = true;
    btnCancelar.disabled = true;
    return;
  }

  const p = readForm();
  const digits = digitsByTipo(p.tipo || "Alumno");
  const necesitaPwd = (p.tipo !== "Docente");

  const baseFilled = !isBlank(p.tipo) && !isBlank(p.control) && !isBlank(p.nombre) &&
    !isBlank(p.paterno) && !isBlank(p.materno) &&
    (!necesitaPwd || !isBlank(p.password));

  const carreraNeeded = p.tipo === "Alumno";
  const carreraOk = !carreraNeeded || !isBlank(p.carrera);
  const filled = baseFilled && carreraOk;

  const okCtrl = new RegExp(`^\\d{${digits}}$`).test(p.control);
  const dupCtrl = !!cache.find(x => String(x.numeroControl) === p.control);
  const dupNameCross = existsFullNameCrossRole(p.nombre, p.paterno, p.materno, p.tipo, null);

  btnGuardar.disabled = !(filled && okCtrl && !dupCtrl && !dupNameCross);
  btnCancelar.disabled = !hasDirtyData();
}

/* =========================
   Selección de fila
========================= */
tblBody.addEventListener("click", (e) => {
  const tr = e.target.closest("tr");
  if (!tr) return;

  const ctrl = tr.dataset.control;
  const p = cache.find(x => String(x.numeroControl) === String(ctrl));
  if (!p) return;

  if (p.tipo && selTipo.value !== p.tipo) {
    selTipo.value = p.tipo;
    lockFieldsByTipo();
    applyTipoRules();
  }

  inpCtrl.value = p.numeroControl;
  inpNom.value = p.nombre;
  inpPat.value = p.apellidoPaterno;
  inpMat.value = p.apellidoMaterno;
  inpPwd.value = "";
  if (selCarrera) selCarrera.value = p.id_carrera || "";
  onPwdInput();

  btnActualizar.disabled = false;
  btnEliminar.disabled = false;
  btnCancelar.disabled = false;
  syncButtons();
});