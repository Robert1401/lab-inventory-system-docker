/* =========================================================
   CARRERAS – CRUD (Node/Express + MySQL)
========================================================= */

const API = "/api/carreras";

/* ========= Elementos ========= */
const tabla = document.getElementById("tabla-carreras");
const inputNombre = document.getElementById("nombre");

const btnGuardar = document.querySelector(".guardar");
const btnActualizar = document.querySelector(".actualizar");
const btnEliminar = document.querySelector(".eliminar");
const homeLink = document.querySelector(".iconos .icono");

let carreras = [];
let idSeleccionado = null;
let nombreOriginal = "";

/* ========= Toast ========= */
function showToast(message, type = "info", duration = 2200) {
  const host = document.getElementById("toast");
  if (!host) {
    alert(message);
    return;
  }

  const icons = {
    success: "✅",
    error: "❌",
    info: "ℹ️",
    warn: "⚠️"
  };

  host.innerHTML = `
    <div class="toast-card ${type}" role="status" aria-live="polite" aria-atomic="true">
      <div class="toast-icon">${icons[type] || "ℹ️"}</div>
      <div class="toast-text">${message}</div>
    </div>
  `;
  host.classList.add("show");

  const hide = () => {
    host.classList.remove("show");
    host.innerHTML = "";
  };

  const t = setTimeout(hide, duration);
  host.onclick = () => {
    clearTimeout(t);
    hide();
  };
}

/* ========= Confirm ========= */
function showConfirm(texto) {
  const modal = document.getElementById("confirm");
  const card = modal?.querySelector(".confirm-card");
  const label = document.getElementById("confirm-text");
  const btnOk = document.getElementById("confirm-aceptar");
  const btnCancel = document.getElementById("confirm-cancelar");

  return new Promise((resolve) => {
    if (!modal || !card || !label || !btnOk || !btnCancel) {
      resolve(window.confirm(texto || "¿Seguro que deseas continuar?"));
      return;
    }

    label.textContent = texto || "¿Seguro que deseas continuar?";
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");

    const onOk = (e) => {
      e.stopPropagation();
      close(true);
    };

    const onCancel = (e) => {
      e.stopPropagation();
      close(false);
    };

    const onBackdrop = (e) => {
      if (!card.contains(e.target)) close(false);
    };

    const onKey = (e) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
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

/* ========= Fetch helper ========= */
async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);

  const ct = res.headers.get("content-type") || "";
  let data = null;

  if (ct.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
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

/* ========= Normalización ========= */
function normalize(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function limpiarTextoCarrera(s) {
  return normalize(s)
    .replace(/\b(ingenieria|ingeniería|licenciatura|lic|ing)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s) {
  return limpiarTextoCarrera(s).split(" ").filter(Boolean);
}

function jaccard(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));

  let inter = 0;
  A.forEach((x) => {
    if (B.has(x)) inter++;
  });

  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function esNombreMuyParecido(a, b) {
  const na = limpiarTextoCarrera(a);
  const nb = limpiarTextoCarrera(b);

  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const sim = jaccard(na, nb);
  return sim >= 0.75;
}

/* ========= Estado UI ========= */
function isDirty() {
  if (idSeleccionado == null) return false;
  return normalize(inputNombre.value) !== normalize(nombreOriginal);
}

function hasUnsavedOrIncomplete() {
  const texto = (inputNombre.value || "").trim();
  if (idSeleccionado == null) return texto.length > 0;
  return isDirty();
}

function updateButtonStates() {
  const hayTexto = (inputNombre.value || "").trim().length > 0;

  if (idSeleccionado == null) {
    btnGuardar.disabled = !hayTexto;
    btnActualizar.disabled = true;
    btnEliminar.disabled = true;
    btnEliminar.title = "";
    return;
  }

  const changed = isDirty();
  btnGuardar.disabled = true;
  btnActualizar.disabled = !hayTexto || !changed;
  btnEliminar.disabled = changed;
  btnEliminar.title = changed ? "Tienes cambios sin guardar. Actualiza primero." : "";
}

function limpiarSeleccion() {
  [...tabla.querySelectorAll("tr")].forEach((tr) => tr.classList.remove("seleccionada"));
  idSeleccionado = null;
  nombreOriginal = "";
  inputNombre.value = "";
  updateButtonStates();
}

function seleccionarFilaVisual(tr) {
  [...tabla.querySelectorAll("tr")].forEach((x) => x.classList.remove("seleccionada"));
  tr.classList.add("seleccionada");
}

/* ========= Tabla ========= */
function pintarTabla() {
  tabla.innerHTML = "";

  carreras.forEach((c) => {
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

/* ========= Cargar ========= */
async function cargarCarreras() {
  try {
    const data = await fetchJson(API, { method: "GET" });
    carreras = Array.isArray(data) ? data : [];

    carreras.sort((a, b) =>
      String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", {
        sensitivity: "base"
      })
    );

    pintarTabla();
  } catch (err) {
    console.error("cargarCarreras:", err);
    showToast(err.message || "No se pudieron cargar las carreras.", "error", 3200);
  }
}

/* ========= Validación ========= */
function existeNombre(nombre, idIgnorar = null) {
  return carreras.some((c) => {
    if (idIgnorar != null && c.id_Carrera === idIgnorar) return false;
    return esNombreMuyParecido(c.nombre, nombre);
  });
}

/* ========= Eventos ========= */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("[carreras.js] cargado ✅");

  await cargarCarreras();
  updateButtonStates();

  inputNombre.addEventListener("input", () => {
    inputNombre.value = inputNombre.value.replace(/[0-9]/g, "");
    updateButtonStates();
  });

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

/* ========= Guardar ========= */
btnGuardar.addEventListener("click", async () => {
  const nombre = (inputNombre.value || "").trim();
  if (!nombre) return showToast("Escribe un nombre.", "info");

  if (existeNombre(nombre)) {
    return showToast("Ya existe una carrera igual o demasiado parecida.", "warn", 2800);
  }

  try {
    const created = await fetchJson(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre })
    });

    carreras.push(created);
    carreras.sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
    );

    pintarTabla();
    limpiarSeleccion();
    showToast("Carrera guardada correctamente.", "success");
  } catch (err) {
    console.error("guardar:", err);
    showToast(err.message || "Error al guardar.", "error", 3200);
  }
});

/* ========= Actualizar ========= */
btnActualizar.addEventListener("click", async () => {
  if (idSeleccionado == null) return showToast("Selecciona una carrera.", "info");

  const nombre = (inputNombre.value || "").trim();
  if (!nombre) return showToast("Escribe un nombre.", "info");

  if (existeNombre(nombre, idSeleccionado)) {
    return showToast("Ya existe otra carrera igual o demasiado parecida.", "warn", 2800);
  }

  try {
    await fetchJson(API, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_Carrera: idSeleccionado, nombre })
    });

    const idx = carreras.findIndex((x) => x.id_Carrera === idSeleccionado);
    if (idx !== -1) carreras[idx].nombre = nombre;

    carreras.sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
    );

    pintarTabla();
    limpiarSeleccion();
    showToast("Carrera actualizada correctamente.", "success");
  } catch (err) {
    console.error("actualizar:", err);
    showToast(err.message || "Error al actualizar.", "error", 3200);
  }
});

/* ========= Eliminar ========= */
btnEliminar.addEventListener("click", async () => {
  if (idSeleccionado == null) return showToast("Selecciona una carrera.", "info");
  if (isDirty()) return showToast("Tienes cambios sin guardar. Actualiza primero.", "warn", 2600);

  const c = carreras.find((x) => x.id_Carrera === idSeleccionado);
  const nombreSel = c?.nombre || "esta carrera";

  const ok = await showConfirm(`Se eliminará "${nombreSel}".\n¿Deseas continuar?`);
  if (!ok) return;

  try {
    await fetchJson(`${API}?id=${encodeURIComponent(String(idSeleccionado))}`, {
      method: "DELETE"
    });

    carreras = carreras.filter((x) => x.id_Carrera !== idSeleccionado);
    pintarTabla();
    limpiarSeleccion();

    showToast("Carrera eliminada correctamente.", "success");
  } catch (err) {
    console.error("eliminar:", err);
    showToast(err.message || "Error al eliminar.", "error", 3200);
  }
});