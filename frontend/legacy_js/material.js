// =========================
// API CONFIG
// =========================
const API = "/backend/agregar-materiales.php";

// =========================
// Mini helper DOM
// =========================
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// =========================
// Fetch JSON helper
// =========================
async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {}
  if (!res.ok || (data && data.ok === false)) {
    const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data; // {ok:boolean, data:any}
}

// =========================
// API layer ({ok,data})
// =========================
let materialsCache = []; // última lista

async function apiList() {
  const r = await fetchJson(API, { method: "GET" });
  const arr = Array.isArray(r.data) ? r.data : [];

  const list = arr.map((m) => ({
    id: String(m.id_Material),
    clave: m.clave || "",
    nombre: m.nombre || "",
    maximo:
      Number(
        m.max_por_alumno ??
          m.maxPorAlumno ??
          m.maximo ??
          m.maximo_por_alumno ??
          0
      ) || 0,
    id_Estado: Number(m.id_Estado || 1),
  }));

  materialsCache = list;
  return list;
}

async function apiCreate({ clave, nombre, maximo }) {
  const body = JSON.stringify({
    clave,
    nombre,
    max_por_alumno: Number(maximo) || 0,
  });
  const r = await fetchJson(API, { method: "POST", body });
  const id = r?.data?.id_Material;
  if (!id) throw new Error("No se recibió el identificador del material.");
  return id;
}

async function apiUpdate({ id, clave, nombre, maximo }) {
  const body = JSON.stringify({
    id_Material: Number(id),
    clave,
    nombre,
    max_por_alumno: Number(maximo) || 0,
  });
  await fetchJson(API, { method: "PUT", body });
}

async function apiDelete(id) {
  await fetchJson(`${API}?id_Material=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

async function apiPurgeInactive() {
  await fetchJson(`${API}?inactive=1`, { method: "DELETE" });
}

// =========================
// Local fallback
// =========================
const LS_CATALOGO = "LE_MATERIALES_LOCAL";
const uid = () =>
  crypto?.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);
const getCat = () => JSON.parse(localStorage.getItem(LS_CATALOGO) || "[]");
const setCat = (arr) =>
  localStorage.setItem(LS_CATALOGO, JSON.stringify(arr || []));

// =========================
// Notificaciones & modal
// =========================
const modalRoot = document.getElementById("modal-root");
function addVeil() {
  if (!modalRoot.querySelector(".veil")) {
    document.body.classList.add("is-blurred");
    const v = document.createElement("div");
    v.className = "veil";
    modalRoot.appendChild(v);
  }
}
function removeVeil() {
  const v = modalRoot.querySelector(".veil");
  if (v) v.remove();
  document.body.classList.remove("is-blurred");
}
const typeIcon = (t) =>
  ({
    success: "fa-solid fa-circle-check",
    info: "fa-solid fa-circle-info",
    warn: "fa-solid fa-triangle-exclamation",
    error: "fa-solid fa-circle-xmark",
  }[t] || "fa-regular fa-bell");

function notifyCenter(text, type = "info", ms = 3000, withBlur = true) {
  if (withBlur) addVeil();
  const toast = document.createElement("div");
  toast.className = `toast-center ${type}`;
  toast.innerHTML = `<i class="${typeIcon(
    type
  )}"></i><span>${text}</span>`;
  modalRoot.appendChild(toast);
  setTimeout(() => {
    toast.remove();
    if (withBlur) removeVeil();
  }, ms + 220);
}

function confirmCenter({
  title = "Confirmación",
  text = "¿Continuar?",
  okText = "Sí",
  cancelText = "No",
}) {
  return new Promise((resolve) => {
    addVeil();
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true">
        <h3 class="modal-title">${title}</h3>
        <p class="modal-text">${text}</p>
        <div class="modal-actions">
          <button class="btn-ghost" data-act="cancel">${cancelText}</button>
          <button class="btn-line"  data-act="ok">${okText}</button>
        </div>
      </div>`;
    const close = (val) => {
      modal.remove();
      removeVeil();
      resolve(val);
    };
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close(false);
    });
    modal.querySelector('[data-act="cancel"]').onclick = () => close(false);
    modal.querySelector('[data-act="ok"]').onclick = () => close(true);
    modalRoot.appendChild(modal);
  });
}

// =========================
// Normalización + DUP estrictos
// =========================
const removeAccents = (s) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const norm = (s) =>
  removeAccents(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
const canonClave = (s) =>
  removeAccents(String(s || "")).toLowerCase().replace(/[^a-z0-9]/g, "");

function jaccardTokens(a, b) {
  const A = new Set(norm(a).split(" ").filter(Boolean));
  const B = new Set(norm(b).split(" ").filter(Boolean));
  if (!A.size && !B.size) return 1;
  let inter = 0;
  A.forEach((t) => {
    if (B.has(t)) inter++;
  });
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}
function levenshtein(a, b) {
  const n = a.length,
    m = b.length;
  if (!n) return m;
  if (!m) return n;
  const dp = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(0)
  );
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[n][m];
}

const claveCasiIdentica = (a, b) => {
  const ca = canonClave(a),
    cb = canonClave(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  return levenshtein(ca, cb) <= 1;
};
const nombreCasiIdentico = (a, b) => {
  const na = norm(a),
    nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const SA = na.split(" ").filter(Boolean).sort().join(" ");
  const SB = nb.split(" ").filter(Boolean).sort().join(" ");
  if (SA === SB) return true;
  if (Math.max(na.length, nb.length) >= 10 && levenshtein(na, nb) <= 1)
    return true;
  if (jaccardTokens(na, nb) >= 0.985) return true;
  return false;
};

function findDuplicateStrict({ idIgnore = null, clave, nombre }, dataset) {
  for (const row of dataset) {
    if (idIgnore != null && String(row.id) === String(idIgnore)) continue;
    if (claveCasiIdentica(clave, row.clave))
      return { field: "clave", with: row.clave, reason: "duplicada" };
    if (nombreCasiIdentico(nombre, row.nombre))
      return { field: "nombre", with: row.nombre, reason: "casi_identica" };
  }
  return null;
}

// =========================
// Página
// =========================
document.addEventListener("DOMContentLoaded", () => {
  const inputClave = $("#clave");
  const inputNombre = $("#nombre");
  const inputMaximo = $("#maximo");
  const stockHint = $("#stockHint");
  const tbody = $("#tablaMateriales tbody");

  const btnGuardar = $("#btnGuardar");
  const btnActualizar = $("#btnActualizar");
  const btnEliminar = $("#btnEliminar");
  const homeLink = document.querySelector(".icono-home");

  const onlySpaces = (s) => !String(s || "").trim().length;
  const countWords = (s) =>
    String(s || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

  let idSel = null;
  let original = { clave: "", nombre: "", maximo: 0 };
  let useAPI = true;
  let lastDup = null;

  const setHint = (t) => (stockHint.textContent = t);
  const setDefaultHint = () =>
    setHint("Escribe primero la clave para habilitar el nombre.");
  const setFieldError = (el, on, title = "") => {
    el.style.outline = on ? "2px solid #cf2d2d" : "";
    if (title) el.title = title;
    else el.removeAttribute("title");
  };

  function datasetNow() {
    return useAPI
      ? materialsCache
      : getCat().map((x) => ({
          id: String(x.id),
          clave: x.clave,
          nombre: x.nombre,
          maximo: Number(x.maximo || 0),
        }));
  }

  const isDirty = () =>
    idSel != null &&
    (norm(inputClave.value) !== norm(original.clave) ||
      norm(inputNombre.value) !== norm(original.nombre) ||
      Number(inputMaximo.value || 0) !== Number(original.maximo || 0));

  const hasUnsaved = () => {
    const any =
      (inputClave.value || "").trim() ||
      (inputNombre.value || "").trim() ||
      (inputMaximo.value || "").trim();
    return idSel == null ? !!any : isDirty();
  };

  function enforceNameLock() {
    const creating = idSel == null;
    const hasClave = !!(inputClave.value || "").trim();
    inputNombre.disabled = creating && !hasClave;
    if (inputNombre.disabled) {
      setDefaultHint();
      setFieldError(inputNombre, false);
    }
  }

  async function actualizarHintByClave() {
    const c = (inputClave.value || "").trim();
    if (!c) {
      setDefaultHint();
      return;
    }
    if (lastDup && lastDup.field === "clave") {
      setHint(`🔁 Clave duplicada (“${lastDup.with}”).`);
      return;
    }
    setHint(`Clave actual: ${c}`);
  }

  function updateButtons() {
    const clave = inputClave.value || "";
    const nombre = inputNombre.value || "";
    const maximoStr = inputMaximo.value || "";
    const maxNum = Number(maximoStr);

    const ready =
      !!clave.trim().length &&
      !!nombre.trim().length &&
      !!maximoStr.trim().length &&
      !/^\s/.test(clave) &&
      !/^\s/.test(nombre) &&
      Number.isFinite(maxNum) &&
      maxNum >= 1;

    lastDup = ready
      ? findDuplicateStrict(
          { idIgnore: idSel, clave, nombre },
          datasetNow()
        )
      : null;
    if (!ready) lastDup = null;

    if (lastDup) {
      if (lastDup.field === "clave") {
        setFieldError(inputClave, true, "Clave duplicada");
        setFieldError(inputNombre, false);
        setHint(`🔁 Clave duplicada (“${lastDup.with}”).`);
      } else {
        setFieldError(inputNombre, true, "Nombre casi idéntico");
        setFieldError(inputClave, false);
        setHint(`🔁 Nombre casi idéntico a “${lastDup.with}”.`);
      }
    } else {
      setFieldError(inputClave, false);
      setFieldError(inputNombre, false);
      if (!clave.trim()) setDefaultHint();
    }

    if (idSel == null) {
      btnGuardar.disabled = !ready || !!lastDup;
      btnActualizar.disabled = true;
      btnEliminar.disabled = true;
    } else {
      const changed = isDirty();
      btnGuardar.disabled = true;
      btnActualizar.disabled = !ready || !changed || !!lastDup;
      btnEliminar.disabled = changed;
    }

    enforceNameLock();
  }

  function limpiarSeleccion() {
    $$("#tablaMateriales tbody tr").forEach((r) =>
      r.classList.remove("seleccionada")
    );
    idSel = null;
    original = { clave: "", nombre: "", maximo: 0 };
    inputClave.value = "";
    inputNombre.value = "";
    inputMaximo.value = "";
    lastDup = null;
    setFieldError(inputClave, false);
    setFieldError(inputNombre, false);
    setFieldError(inputMaximo, false);
    setDefaultHint();
    updateButtons();
  }

  function renderFromArray(arr) {
    tbody.innerHTML = arr
      .map((row) => {
        const max = Number(row.maximo || 0);
        const maxText = max > 0 ? max : "—";
        return `
      <tr data-id="${row.id}">
        <td>${row.clave}</td>
        <td>${row.nombre}</td>
        <td>${maxText}</td>
      </tr>`;
      })
      .join("");

    $$("#tablaMateriales tbody tr").forEach((tr) => {
      tr.addEventListener("click", () => {
        $$("#tablaMateriales tbody tr").forEach((r) =>
          r.classList.remove("seleccionada")
        );
        tr.classList.add("seleccionada");
        const id = tr.dataset.id;
        const row = arr.find((x) => String(x.id) === String(id));
        if (!row) return;
        idSel = id;
        original = {
          clave: row.clave,
          nombre: row.nombre,
          maximo: Number(row.maximo || 0),
        };
        inputClave.value = row.clave;
        inputNombre.value = row.nombre;
        inputNombre.disabled = false; // en editar se habilita
        inputMaximo.value =
          Number(row.maximo || 0) > 0 ? String(row.maximo) : "";
        setHint(`Editando: ${row.clave}`);
        lastDup = null;
        updateButtons();
      });
    });
    updateButtons();
  }

  async function render() {
    if (useAPI) {
      try {
        const list = await apiList();
        setCat(
          list.map((x) => ({
            id: x.id,
            clave: x.clave,
            nombre: x.nombre,
            maximo: Number(x.maximo || 0),
          }))
        );
        renderFromArray(
          list.map((x) => ({
            id: x.id,
            clave: x.clave,
            nombre: x.nombre,
            maximo: Number(x.maximo || 0),
          }))
        );
        try {
          await apiPurgeInactive();
        } catch {}
        return;
      } catch {
        useAPI = false;
        notifyCenter(
          "No se pudo conectar con el servidor de materiales. Trabajarás en modo local.",
          "warn",
          2600
        );
      }
    }
    const local = getCat();
    materialsCache = local.map((x) => ({
      id: String(x.id),
      clave: x.clave,
      nombre: x.nombre,
      maximo: Number(x.maximo || 0),
      id_Estado: 1,
    }));
    renderFromArray(materialsCache);
  }

  function leerForm() {
    return {
      clave: (inputClave.value || "").trim(),
      nombre: (inputNombre.value || "").trim(),
      maximo: Number(inputMaximo.value || 0),
    };
  }

  function validar({ clave, nombre, maximo }) {
    if (!clave || onlySpaces(clave)) return "Ingresa una clave válida.";
    if (!nombre || onlySpaces(nombre)) return "Ingresa un nombre válido.";
    if (clave.startsWith(" ") || nombre.startsWith(" "))
      return "No puede iniciar con espacio.";
    if (clave.length > 10) return "La clave tiene máximo 10 caracteres.";
    if (!Number.isFinite(maximo) || maximo < 1)
      return "Ingresa un máximo por alumno mayor o igual a 1.";
    if (countWords(nombre) > 100)
      return "El nombre no puede superar las 100 palabras.";
    return null;
  }

  // ===== Guardar =====
  btnGuardar?.addEventListener("click", async () => {
    const form = leerForm();
    const err = validar(form);
    if (err) {
      notifyCenter(err, "warn", 2200, false);
      return;
    }

    const dup = findDuplicateStrict(
      { idIgnore: null, clave: form.clave, nombre: form.nombre },
      datasetNow()
    );
    if (dup) {
      notifyCenter(
        dup.field === "clave"
          ? "La clave ya existe en el catálogo."
          : `El nombre es casi idéntico a “${dup.with}”.`,
        "warn",
        2200,
        false
      );
      updateButtons();
      return;
    }

    if (useAPI) {
      try {
        await apiCreate(form);
        notifyCenter("Material guardado.", "success", 1600, false);
        await render();
        limpiarSeleccion();
        $("#clave")?.focus();
        return;
      } catch {
        useAPI = false;
        notifyCenter(
          "No se pudo guardar en el servidor. Se activó el modo local.",
          "warn",
          2200
        );
      }
    }

    // Local
    const data = getCat();
    const dupLocal = findDuplicateStrict(
      { idIgnore: null, clave: form.clave, nombre: form.nombre },
      data
    );
    if (dupLocal) {
      notifyCenter(
        dupLocal.field === "clave"
          ? "La clave ya existe en el catálogo."
          : `El nombre es casi idéntico a “${dupLocal.with}”.`,
        "warn",
        2200,
        false
      );
      updateButtons();
      return;
    }
    data.push({ id: uid(), ...form });
    setCat(data);
    await render();
    limpiarSeleccion();
    $("#clave")?.focus();
  });

  // ===== Actualizar =====
  btnActualizar?.addEventListener("click", async () => {
    if (idSel == null) return;
    const form = leerForm();
    const err = validar(form);
    if (err) {
      notifyCenter(err, "warn", 2200, false);
      return;
    }

    const dup = findDuplicateStrict(
      { idIgnore: idSel, clave: form.clave, nombre: form.nombre },
      datasetNow()
    );
    if (dup) {
      notifyCenter(
        dup.field === "clave"
          ? "La clave ya existe en el catálogo."
          : `El nombre es casi idéntico a “${dup.with}”.`,
        "warn",
        2200,
        false
      );
      updateButtons();
      return;
    }

    if (useAPI) {
      try {
        await apiUpdate({ id: idSel, ...form });
        notifyCenter("Material actualizado.", "success", 1600, false);
        await render();
        limpiarSeleccion();
        return;
      } catch {
        useAPI = false;
        notifyCenter(
          "No se pudo actualizar en el servidor. Se activó el modo local.",
          "warn",
          2200
        );
      }
    }

    // Local
    const data = getCat();
    const idx = data.findIndex((x) => String(x.id) === String(idSel));
    if (idx < 0) return;
    const dupLocal = findDuplicateStrict(
      { idIgnore: idSel, clave: form.clave, nombre: form.nombre },
      data
    );
    if (dupLocal) {
      notifyCenter(
        dupLocal.field === "clave"
          ? "La clave ya existe en el catálogo."
          : `El nombre es casi idéntico a “${dupLocal.with}”.`,
        "warn",
        2200,
        false
      );
      updateButtons();
      return;
    }
    data[idx] = { ...data[idx], ...form };
    setCat(data);
    render();
    limpiarSeleccion();
  });

  // ===== Eliminar =====
  btnEliminar?.addEventListener("click", async () => {
    if (idSel == null) return;
    const ok = await confirmCenter({
      title: "Eliminar material",
      text: "¿Seguro que deseas eliminarlo?",
      okText: "Eliminar",
      cancelText: "Cancelar",
    });
    if (!ok) return;

    if (useAPI) {
      try {
        await apiDelete(idSel);
        notifyCenter("Material eliminado.", "success", 1400, false);
        await render();
        limpiarSeleccion();
        return;
      } catch {
        useAPI = false;
        notifyCenter(
          "No se pudo eliminar en el servidor. Se activó el modo local.",
          "warn",
          2200
        );
      }
    }
    const data = getCat().filter((x) => String(x.id) !== String(idSel));
    setCat(data);
    render();
    limpiarSeleccion();
  });

  // ===== Campos =====
  async function onClaveInput() {
    if (inputClave.value.length > 10)
      inputClave.value = inputClave.value.slice(0, 10);
    if (/^\s/.test(inputClave.value))
      inputClave.value = inputClave.value.trimStart();
    enforceNameLock();
    updateButtons();
    await actualizarHintByClave();
  }
  inputClave.addEventListener("input", onClaveInput);

  inputNombre.addEventListener("input", () => {
    if (/^\s/.test(inputNombre.value))
      inputNombre.value = inputNombre.value.trimStart();
    if (countWords(inputNombre.value) > 100) {
      const palabras = inputNombre.value.trim().split(/\s+/).slice(0, 100);
      inputNombre.value = palabras.join(" ");
    }
    updateButtons();
  });

  inputMaximo.addEventListener("input", () => {
    let v = inputMaximo.value;
    if (/^\s/.test(v)) v = v.trimStart();
    let n = Number(v);
    if (!Number.isFinite(n) || n < 1) {
      // no corregimos automáticamente, solo dejamos que el validador avise
    } else if (n > 999) {
      n = 999;
      inputMaximo.value = String(n);
    }
    updateButtons();
  });

  // ===== Casita =====
  if (homeLink) {
    homeLink.addEventListener("click", async (e) => {
      if (!hasUnsaved()) return;
      e.preventDefault();
      const ok = await confirmCenter({
        title: "Salir sin guardar",
        text: "Tienes datos sin terminar. Si sales se perderán.\n¿Deseas salir?",
        okText: "Sí",
        cancelText: "No",
      });
      if (ok) {
        limpiarSeleccion();
        window.location.href = homeLink.href;
      }
    });
  }

  // ===== Init =====
  (async () => {
    inputNombre.disabled = true; // bloqueado hasta que haya clave en modo nuevo
    await render();
    setDefaultHint();
    await actualizarHintByClave();
    updateButtons();

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") limpiarSeleccion();
      if (e.key === "Enter") {
        if (idSel == null && !btnGuardar.disabled) {
          e.preventDefault();
          btnGuardar.click();
        } else if (idSel != null && !btnActualizar.disabled) {
          e.preventDefault();
          btnActualizar.click();
        }
      }
    });
  })();
});

/* -------------------------------------------------------
   PUBLICACIÓN DE CATÁLOGO para otros módulos (inventario)
   - Expone: window.Materiales.lista  (array)
             window.Materiales.getAll (función -> array/Promise)
   - Formato de cada item: { id_Material, nombre, clave, maximo }
---------------------------------------------------------*/
(function publishCatalogIntegration() {
  window.Materiales = window.Materiales || {};

  function buildCatalogFromCurrentData() {
    let src = Array.isArray(
      typeof materialsCache !== "undefined" ? materialsCache : null
    )
      ? materialsCache
      : [];

    if (!src.length && typeof getCat === "function") {
      const local = getCat();
      src = Array.isArray(local)
        ? local.map((x) => ({
            id: String(x.id),
            clave: x.clave || "",
            nombre: x.nombre || "",
            maximo: Number(x.maximo || 0),
            id_Estado: 1,
          }))
        : [];
    }

    const catalog = src.map((m) => ({
      id_Material: String(m.id),
      nombre: m.nombre || "",
      clave: m.clave || "",
      maximo: Number(m.maximo || 0),
    }));

    return catalog;
  }

  function publishCatalog() {
    const catalog = buildCatalogFromCurrentData();
    window.Materiales.lista = catalog;
    window.Materiales.getAll = async () => catalog;
    try {
      window.dispatchEvent(
        new CustomEvent("material_catalog_updated", {
          detail: { size: catalog.length },
        })
      );
    } catch {}
  }

  window.__publishMaterialCatalog = publishCatalog;
  publishCatalog();
})();
