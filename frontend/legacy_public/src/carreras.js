/* =========================================================
   CARRERAS – CRUD (Node/Express + MySQL) via NGINX /api
   - Carga tabla al abrir
   - Selección de fila
   - Botones inteligentes (Guardar/Actualizar/Eliminar)
   - Toast + confirm modal
========================================================= */

/* ✅ Importante: usar la misma origin (nginx) */
const API = "/api/carreras";

/* ========= Elementos ========= */
const tabla       = document.getElementById("tabla-carreras"); // <tbody id="tabla-carreras">
const inputNombre = document.getElementById("nombre");

const btnGuardar    = document.querySelector(".guardar");
const btnActualizar = document.querySelector(".actualizar");
const btnEliminar   = document.querySelector(".eliminar");
const homeLink      = document.querySelector(".iconos .icono"); // casita

let carreras = [];
let idSeleccionado = null;
let nombreOriginal = "";

/* ========= Toast ========= */
function showToast(message, type = "info", duration = 2200) {
  const host = document.getElementById("toast");
  if (!host) { alert(message); return; }

  const icons = { success: "✓", error: "✕", info: "ℹ︎", warn: "⚠︎" };

  host.innerHTML = `
    <div class="toast-card ${type}" role="status" aria-live="polite" aria-atomic="true">
      <div class="toast-icon">${icons[type] || "ℹ︎"}</div>
      <div class="toast-text">${message}</div>
    </div>
  `;
  host.classList.add("show");

  const hide = () => { host.classList.remove("show"); host.innerHTML = ""; };

  const t = setTimeout(hide, duration);
  host.onclick = () => { clearTimeout(t); hide(); };
}

/* ========= Confirm ========= */
function showConfirm(texto) {
  const modal     = document.getElementById("confirm");
  const card      = modal?.querySelector(".confirm-card");
  const label     = document.getElementById("confirm-text");
  const btnOk     = document.getElementById("confirm-aceptar");
  const btnCancel = document.getElementById("confirm-cancelar");

  return new Promise((resolve) => {
    if (!modal || !card || !label || !btnOk || !btnCancel) {
      resolve(window.confirm(texto || "¿Seguro que deseas continuar?"));
      return;
    }

    label.textContent = texto || "¿Seguro que deseas continuar?";
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");

    const onOk       = (e) => { e.stopPropagation(); close(true); };
    const onCancel   = (e) => { e?.stopPropagation?.(); close(false); };
    const onBackdrop = (e) => { if (!card.contains(e.target)) close(false); };
    const onKey      = (e) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter")  close(true);
    };

    function close(v) {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      btnOk.removeEventListener("click", onOk);
      btnCancel.removeEventListener("click", onCancel);
      modal.removeEventListener("click", onBackdrop);
      window.removeEventListener("keydown", onKey);
      resolve(v);
    }

    btnOk.addEventListener("click", onOk, { once: true });
    btnCancel.addEventListener("click", onCancel, { once: true });
    modal.addEventListener("click", onBackdrop);
    window.addEventListener("keydown", onKey);
  });
}

/* ========= Fetch helper (robusto) ========= */
async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);

  // intenta leer JSON, si no, lee texto
  const ct = res.headers.get("content-type") || "";
  let data = null;

  if (ct.includes("application/json")) {
    try { data = await res.json(); } catch { data = null; }
  } else {
    const t = await res.text().catch(() => "");
    data = t ? { message: t } : null;
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || `Error (${res.status}).`;
    throw new Error(msg);
  }

  if (data?.error) throw new Error(data.error);
  return data;
}

/* =========================================================
   Estado UI
========================================================= */
function normalize(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isDirty() {
  if (idSeleccionado == null) return false;
  return normalize(inputNombre.value) !== normalize(nombreOriginal);
}

function hasUnsavedOrIncomplete() {
  const texto = (inputNombre.value || "").trim();
  if (idSeleccionado == null) return texto.length > 0; // escribió algo sin guardar
  return isDirty(); // está editando
}

function updateButtonStates() {
  const hayTexto = (inputNombre.value || "").trim().length > 0;

  if (idSeleccionado == null) {
    // Modo NUEVO
    btnGuardar.disabled    = !hayTexto;
    btnActualizar.disabled = true;
    btnEliminar.disabled   = true;
    btnEliminar.title = "";
    return;
  }

  // Modo EDICIÓN
  const changed = isDirty();
  btnGuardar.disabled    = true;
  btnActualizar.disabled = !hayTexto || !changed;
  btnEliminar.disabled   = changed; // no dejar borrar si está editando
  btnEliminar.title = changed ? "Tienes cambios sin guardar. Actualiza primero." : "";
}

function limpiarSeleccion() {
  [...tabla.querySelectorAll("tr")].forEach(tr => tr.classList.remove("seleccionada"));
  idSeleccionado = null;
  nombreOriginal = "";
  inputNombre.value = "";
  updateButtonStates();
}

function seleccionarFilaVisual(tr) {
  [...tabla.querySelectorAll('tr')].forEach(x => x.classList.remove("seleccionada"));
  tr.classList.add("seleccionada");
}

/* =========================================================
   Render tabla
========================================================= */
function pintarTabla() {
  tabla.innerHTML = "";

  carreras.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${c.nombre}</td>`;

    tr.addEventListener("click", () => {
      seleccionarFilaVisual(tr);
      idSeleccionado = c.id_Carrera;
      nombreOriginal = c.nombre;
      inputNombre.value = c.nombre;
      updateButtonStates();
    });

    tabla.appendChild(tr);
  });
}

/* =========================================================
   Cargar carreras
========================================================= */
async function cargarCarreras() {
  try {
    const data = await fetchJson(API, { method: "GET" });
    carreras = Array.isArray(data) ? data : [];
    pintarTabla();
  } catch (err) {
    console.error("cargarCarreras:", err);
    showToast(err.message || "No se pudieron cargar las carreras.", "error", 3200);
  }
}

/* =========================================================
   Duplicado simple (exacto normalizado)
========================================================= */
function existeNombre(nombre, idIgnorar = null) {
  const n = normalize(nombre);
  return carreras.some(c => (idIgnorar == null || c.id_Carrera !== idIgnorar) && normalize(c.nombre) === n);
}

/* =========================================================
   Eventos
========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  // Si el JS realmente se ejecuta, verás esto en consola:
  console.log("[carreras.js] cargado ✅");

  await cargarCarreras();
  updateButtonStates();

  inputNombre.addEventListener("input", updateButtonStates);

  // Confirmación al salir por casita si hay cambios
  homeLink?.addEventListener("click", async (e) => {
    if (!hasUnsavedOrIncomplete()) return;
    e.preventDefault();

    const ok = await showConfirm(
      "Tienes datos sin guardar.\nSi sales ahora, perderás los cambios.\n\n¿Deseas salir igualmente?"
    );

    if (ok) window.location.href = homeLink.href;
    else showToast("Edición conservada.", "info", 1800);
  });
});

/* =========================================================
   Guardar (nuevo)
========================================================= */
btnGuardar.addEventListener("click", async () => {
  const nombre = (inputNombre.value || "").trim();
  if (!nombre) return showToast("Escribe un nombre.", "info");

  if (existeNombre(nombre)) {
    return showToast("❗ Esa carrera ya existe (duplicado).", "warn", 2600);
  }

  try {
    const created = await fetchJson(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre })
    });

    // tu API retorna {id_Carrera, nombre}
    carreras.push(created);
    // ordenar como tu query ORDER BY nombre
    carreras.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

    pintarTabla();
    limpiarSeleccion();
    showToast("✅ Guardado.", "success");
  } catch (err) {
    console.error("guardar:", err);
    showToast(err.message || "Error al guardar.", "error", 3200);
  }
});

/* =========================================================
   Actualizar
========================================================= */
btnActualizar.addEventListener("click", async () => {
  if (idSeleccionado == null) return showToast("Selecciona una carrera.", "info");

  const nombre = (inputNombre.value || "").trim();
  if (!nombre) return showToast("Escribe un nombre.", "info");

  if (existeNombre(nombre, idSeleccionado)) {
    return showToast("❗ Ya existe otra carrera con ese nombre.", "warn", 2600);
  }

  try {
    await fetchJson(API, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_Carrera: idSeleccionado, nombre })
    });

    const idx = carreras.findIndex(x => x.id_Carrera === idSeleccionado);
    if (idx !== -1) carreras[idx].nombre = nombre;

    carreras.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
    pintarTabla();
    limpiarSeleccion();

    showToast("✏️ Actualizada.", "success");
  } catch (err) {
    console.error("actualizar:", err);
    showToast(err.message || "Error al actualizar.", "error", 3200);
  }
});

/* =========================================================
   Eliminar
========================================================= */
btnEliminar.addEventListener("click", async () => {
  if (idSeleccionado == null) return showToast("Selecciona una carrera.", "info");
  if (isDirty()) return showToast("Tienes cambios sin guardar. Actualiza primero.", "warn", 2600);

  const c = carreras.find(x => x.id_Carrera === idSeleccionado);
  const nombreSel = c?.nombre || "esta carrera";

  const ok = await showConfirm(`Se borrará: "${nombreSel}".\n¿Seguro?`);
  if (!ok) return;

  try {
    await fetchJson(`${API}?id=${encodeURIComponent(String(idSeleccionado))}`, { method: "DELETE" });

    carreras = carreras.filter(x => x.id_Carrera !== idSeleccionado);
    pintarTabla();
    limpiarSeleccion();

    showToast("🗑️ Eliminada.", "success");
  } catch (err) {
    console.error("eliminar:", err);
    showToast(err.message || "Error al eliminar.", "error", 3200);
  }
});
