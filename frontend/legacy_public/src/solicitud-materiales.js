(() => {
  "use strict";

  const API_BASE = "http://localhost:3000/api";
  const USUARIOS_API = `${API_BASE}/usuarios`;
  const MATERIAS_API = `${API_BASE}/materias`;
  const MATERIALES_API = `${API_BASE}/materiales`;

 const HOME_URL = "../alumnos-inicial.html";
const LOGO_LEFT_URL = absoluteUrl("../../assets/logo1.png");
const LOGO_RIGHT_URL = absoluteUrl("../../assets/escudo.png");
const MESAS_TOTALES = 12;

  const PDF_CACHE_KEY = "LE_LAST_PDF_BLOB_URL";
  const PDF_META_KEY = "LE_LAST_PDF_META";
  const PDF_VIEW_MINUTES = 5;
  const PDF_VIEW_MS = PDF_VIEW_MINUTES * 60 * 1000;

  const $ = (selector) => document.querySelector(selector);

  const norm = (s = "") =>
    String(s)
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();

  const esc = (s = "") =>
    String(s).replace(/[&<>"']/g, (c) => {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });

  const clean = (v) => (v == null ? "" : String(v).trim());

  function readLS(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeLS(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error("Error guardando localStorage:", key, err);
    }
  }

  function removeLS(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  function readSS(key, fallback = null) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeSS(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error("Error guardando sessionStorage:", key, err);
    }
  }

  function removeSS(key) {
    try {
      sessionStorage.removeItem(key);
    } catch {}
  }

  function nowParts() {
    const d = new Date();
    return {
      yyyy: d.getFullYear(),
      mm: String(d.getMonth() + 1).padStart(2, "0"),
      dd: String(d.getDate()).padStart(2, "0"),
      hh: String(d.getHours()).padStart(2, "0"),
      mi: String(d.getMinutes()).padStart(2, "0"),
      ss: String(d.getSeconds()).padStart(2, "0"),
    };
  }

  function fullName(p) {
    return [p?.nombre, p?.apP, p?.apM]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function absoluteUrl(path) {
    return new URL(path, window.location.href).href;
  }

  function samePdfMeta(a, b) {
    return (
      a &&
      b &&
      a.noVale === b.noVale &&
      a.fecha === b.fecha &&
      a.hora === b.hora &&
      a.mesa === b.mesa &&
      a.itemsCount === b.itemsCount
    );
  }

  /* =========================================================
     LIMPIEZA DE ELEMENTOS EXTRAÑOS
  ========================================================= */
  function hideBrokenShimejiArtifacts() {
    const ids = [
      "shimeji",
      "announceOverlay",
      "shimejiBubble",
      "shimejiActions",
      "shimejiImg",
      "shHelp",
      "shTips",
      "shNews",
    ];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        try {
          el.remove();
        } catch {}
      }
    });

    document.querySelectorAll("button").forEach((btn) => {
      const txt = (btn.textContent || "").trim().toLowerCase();
      if (txt === "ayuda" || txt === "tip" || txt === "anuncio") {
        const parent = btn.parentElement;
        if (parent) {
          try {
            parent.remove();
          } catch {}
        }
      }
    });
  }

  /* =========================================================
     TOAST
  ========================================================= */
  function toast(msg, kind = "info") {
    const el = $("#toastCenter");
    if (!el) return;

    el.className = "";
    el.id = "toastCenter";

    el.classList.add(
      kind === "ok" || kind === "success"
        ? "toast-ok"
        : kind === "warn"
        ? "toast-warn"
        : kind === "danger" || kind === "error"
        ? "toast-danger"
        : "toast-info"
    );

    el.textContent = msg;
    el.classList.add("show");

    setTimeout(() => {
      el.classList.remove("show");
    }, 1800);
  }

  /* =========================================================
     OVERLAY PDF
  ========================================================= */
  const PDF_UI = {
    overlay: null,
    fill: null,
    text: null,
    msg: null,
    title: null,
    bot: null,
  };

  let overlaySpeakToken = 0;

  function initPdfOverlay() {
    PDF_UI.overlay = $("#pdfOverlay");
    PDF_UI.fill = $("#pdfProgressFill");
    PDF_UI.text = $("#pdfProgressText");
    PDF_UI.msg = $("#pdfMessage");
    PDF_UI.title = $("#pdfTitle");
    PDF_UI.bot = $("#pdfBotImg");

    if (PDF_UI.bot) {
      PDF_UI.bot.src = "/public/assets/shimeji.png";
    }
  }

  async function speakOverlay(text, speed = 18) {
    const token = ++overlaySpeakToken;
    if (!PDF_UI.msg) return;

    const content = String(text || "");
    let current = "";

    for (const ch of content) {
      if (token !== overlaySpeakToken) return;
      current += ch;
      PDF_UI.msg.textContent = current;
      await wait(speed);
    }
  }

  function openPdfOverlay() {
    if (!PDF_UI.overlay) return;
    document.body.classList.add("pdf-loading");
    PDF_UI.overlay.classList.remove("hidden");
    PDF_UI.overlay.setAttribute("aria-hidden", "false");
    setPdfProgress(0, "Preparando el PDF...", "Preparando tu solicitud");
  }

  function closePdfOverlay() {
    if (!PDF_UI.overlay) return;
    PDF_UI.overlay.classList.add("hidden");
    PDF_UI.overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("pdf-loading");
  }

  function setPdfProgress(percent, message, title = null) {
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));

    if (PDF_UI.fill) PDF_UI.fill.style.width = `${safePercent}%`;
    if (PDF_UI.text) PDF_UI.text.textContent = `${safePercent}%`;
    if (PDF_UI.msg && message) PDF_UI.msg.textContent = message;
    if (PDF_UI.title && title) PDF_UI.title.textContent = title;
  }

  async function progressStep(percent, message, title = null, delay = 420) {
    setPdfProgress(percent, message, title);
    speakOverlay(message).catch(() => {});
    await wait(delay);
  }

  async function finishPdfLoadingOk(msg = "PDF creado correctamente.") {
    setPdfProgress(100, msg, "Proceso completado");
    await wait(900);
    closePdfOverlay();
  }

  async function finishPdfLoadingError(msg = "No se pudo crear el PDF.") {
    setPdfProgress(100, msg, "Ocurrió un problema");
    await wait(1100);
    closePdfOverlay();
  }

  /* =========================================================
     FETCH JSON
  ========================================================= */
  async function fetchJSON(url, options = {}) {
    try {
      const resp = await fetch(url, options);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (err) {
      console.error("fetchJSON error:", url, err);
      return null;
    }
  }

  /* =========================================================
     ESTADO
  ========================================================= */
  const state = {
    items: [],
    saved: false,
  };

  /* =========================================================
     FECHA / HORA / FOLIO
  ========================================================= */
  function setFechaHoraHoy() {
    const { yyyy, mm, dd, hh, mi } = nowParts();
    const inpFecha = $("#fecha");
    const inpHora = $("#hora");

    if (inpFecha) {
      const today = `${yyyy}-${mm}-${dd}`;
      inpFecha.value = today;
      inpFecha.min = today;
      inpFecha.max = today;

      inpFecha.addEventListener("change", () => {
        inpFecha.value = today;
        toast("La fecha solo puede ser la de hoy.", "warn");
      });
    }

    if (inpHora) inpHora.value = `${hh}:${mi}`;
  }

  function nextVale() {
    const { yyyy, mm, dd } = nowParts();
    const key = `LE_vale_seq_${yyyy}${mm}${dd}`;
    let seq = Number(readLS(key, 0)) || 0;
    seq += 1;
    writeLS(key, seq);
    return `VALE-${seq}`;
  }

  function setFolio() {
    const inp = $("#folio");
    if (inp) inp.value = nextVale();
  }

function setAlumnoYCarrera() {
  const alumnoInput = $("#alumno");
  const carreraInput = $("#carrera");
  const user = readLS("LE_user", null);

  const nombreUsuario =
    user?.nombreCompleto ||
    user?.nombre ||
    [user?.nombre, user?.apellidoPaterno, user?.apellidoMaterno].filter(Boolean).join(" ").trim();

  if (alumnoInput) {
    alumnoInput.value = nombreUsuario || "Alumno";
    if (user?.numeroControl) {
      alumnoInput.dataset.noControl = String(user.numeroControl);
    }
  }

  if (user?.carrera && carreraInput) {
    carreraInput.value = user.carrera;
  } else if (carreraInput) {
    carreraInput.value = "Ingeniería en Sistemas Computacionales";
  }
}
  /* =========================================================
     VALIDACIONES
  ========================================================= */
  function metaFieldsComplete() {
    const ids = [
      "fecha", "hora", "folio", "alumno", "carrera",
      "auxiliar", "docente", "materiaAcad", "mesa"
    ];

    for (const id of ids) {
      const el = $("#" + id);
      if (el && !clean(el.value)) return false;
    }

    return true;
  }

  function validMaterial() {
    return clean($("#materialSearch")?.value).length > 0;
  }

  function validCantidad() {
    const inp = $("#cantidad");
    const n = Number(inp?.value || "");
    if (!Number.isFinite(n) || n <= 0) return false;

    const max = Number(inp?.dataset?.maxAllowed || "0") || 0;
    if (max > 0 && n > max) return false;

    return true;
  }

  /* =========================================================
     CARGA DE CATÁLOGOS
  ========================================================= */
  async function getUsuarios() {
    const resp = await fetchJSON(USUARIOS_API);
    if (!resp || !Array.isArray(resp.data)) return [];
    return resp.data;
  }

  async function loadAuxiliaresSelect() {
    const sel = $("#auxiliar");
    if (!sel) return;

    const usuarios = await getUsuarios();
    const auxs = usuarios.filter((u) => norm(u.rol) === "auxiliar");

    sel.innerHTML = `<option value="">Seleccione auxiliar…</option>`;

    auxs
      .sort((a, b) => fullName(a).localeCompare(fullName(b), "es", { sensitivity: "base" }))
      .forEach((u) => {
        const nombre = fullName(u);
        if (!nombre) return;

        const opt = document.createElement("option");
        opt.value = nombre;
        opt.textContent = nombre;
        opt.dataset.id = clean(u.numeroControl || u.id || "");
        sel.appendChild(opt);
      });

    sel.value = "";
  }

  async function loadDocentesSelect() {
    const sel = $("#docente");
    if (!sel) return;

    const usuarios = await getUsuarios();
    const docs = usuarios.filter((u) => norm(u.rol) === "docente");

    sel.innerHTML = `<option value="">Seleccione docente…</option>`;

    docs
      .sort((a, b) => fullName(a).localeCompare(fullName(b), "es", { sensitivity: "base" }))
      .forEach((u) => {
        const nombre = fullName(u);
        if (!nombre) return;

        const opt = document.createElement("option");
        opt.value = nombre;
        opt.textContent = nombre;
        opt.dataset.id = clean(u.numeroControl || u.id || "");
        sel.appendChild(opt);
      });

    sel.value = "";
  }

  async function loadMateriasSelect() {
    const sel = $("#materiaAcad");
    if (!sel) return;

    const resp = await fetchJSON(MATERIAS_API);
    const materias = Array.isArray(resp?.data) ? resp.data : [];

    sel.innerHTML = `<option value="">Seleccione materia…</option>`;

    materias
      .sort((a, b) =>
        String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", {
          sensitivity: "base",
        })
      )
      .forEach((m) => {
        const nombre = clean(m.nombre);
        if (!nombre) return;

        const opt = document.createElement("option");
        opt.value = nombre;
        opt.textContent = nombre;
        opt.dataset.id = clean(m.id_Materia || "");
        sel.appendChild(opt);
      });

    sel.value = "";
  }

  function loadMesasSelect() {
    const sel = $("#mesa");
    if (!sel) return;

    sel.innerHTML = `<option value="">Seleccione mesa…</option>`;

    for (let i = 1; i <= MESAS_TOTALES; i++) {
      const mesa = `M${i}`;
      const opt = document.createElement("option");
      opt.value = mesa;
      opt.textContent = mesa;
      sel.appendChild(opt);
    }

    sel.value = "";
  }

  /* =========================================================
     CATÁLOGO DE MATERIALES
  ========================================================= */
  const Catalog = {
    list: [],
    mapItem: new Map(),

    async sync() {
      const resp = await fetchJSON(MATERIALES_API);
      const arr = Array.isArray(resp?.data) ? resp.data : [];

      const list = arr
        .map((m) => ({
          id: String(m.id_Material ?? ""),
          nombre: clean(m.nombre),
          clave: clean(m.clave),
          maxAlumno: Number(m.max_por_alumno) || 0,
          disponible: Number(m.disponible) || 0,
        }))
        .filter((m) => m.nombre)
        .sort((a, b) =>
          a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
        );

      this.list = list;
      this.mapItem.clear();
      list.forEach((m) => this.mapItem.set(norm(m.nombre), m));
    },

    getItemByName(name) {
      return this.mapItem.get(norm(name)) || null;
    },
  };

  /* =========================================================
     STOCK / CANTIDAD
  ========================================================= */
  function requestedSoFar(materialName) {
    const key = norm(materialName);
    let total = 0;

    for (const item of state.items) {
      if (norm(item.material) === key) total += Number(item.cantidad) || 0;
    }

    return total;
  }

  function computeEffectiveMax(materialName) {
    const item = Catalog.getItemByName(materialName) || {};
    const maxAlumno = Number(item.maxAlumno) || 0;
    const stockTotal = Number(item.disponible) || 0;
    const yaEnTabla = requestedSoFar(materialName);
    const stockRestante = Math.max(0, stockTotal - yaEnTabla);

    let maxFinal = 0;

    if (maxAlumno > 0 && stockRestante > 0) maxFinal = Math.min(maxAlumno, stockRestante);
    else if (maxAlumno === 0 && stockRestante > 0) maxFinal = stockRestante;

    return { maxAlumno, stockTotal, stockRestante, maxFinal };
  }

  function computeAndSetQtyMax(materialName) {
    const inp = $("#cantidad");
    if (!inp) return 0;

    const info = computeEffectiveMax(materialName);
    const max = info.maxFinal;

    inp.dataset.maxAllowed = String(max);
    inp.dataset.stockTotal = String(info.stockTotal);
    inp.dataset.stockRestante = String(info.stockRestante);
    inp.max = max > 0 ? String(max) : "";

    return max;
  }

  function applyLimitFromMaterial() {
    const name = clean($("#materialSearch")?.value);
    const inp = $("#cantidad");
    const plus = $("#plusQty");

    if (!inp) return;

    const max = name ? computeAndSetQtyMax(name) : 0;
    const metaOk = metaFieldsComplete();

    if (plus) plus.disabled = state.saved || !(metaOk && name && max > 0);

    const n = Number(inp.value || "");
    if (max > 0 && Number.isFinite(n) && n > max) {
      inp.value = String(max);
      toast(`Máx. permitido para "${name}" = ${max}.`, "warn");
    }

    updateActionStates();
  }

  function ensureCantidadValidaOrWarn() {
    const inp = $("#cantidad");
    const name = clean($("#materialSearch")?.value);
    const n = Number(inp?.value || "");
    const max = Number(inp?.dataset?.maxAllowed || "0") || 0;
    const stockTotal = Number(inp?.dataset?.stockTotal || "0") || 0;

    if (!name) {
      toast("Busca y elige un material.", "warn");
      $("#materialSearch")?.focus();
      return false;
    }

    if (stockTotal <= 0) {
      toast(`No hay existencias de "${name}".`, "warn");
      return false;
    }

    if (!Number.isFinite(n) || n <= 0) {
      toast("Tiene que poner un número válido.", "warn");
      inp?.focus();
      return false;
    }

    if (max > 0 && n > max) {
      toast(`Máx. permitido para "${name}" es ${max}.`, "warn");
      inp.value = String(max);
      return false;
    }

    return true;
  }

  /* =========================================================
     FINDER
  ========================================================= */
  const Finder = {
    input: null,
    hidden: null,
    list: null,
    activeIndex: -1,

    init() {
      this.input = $("#materialSearch");
      this.hidden = $("#material");
      this.list = $("#finderList");

      if (!this.input || !this.list) return;

      this.input.addEventListener("focus", () => {
        if (state.saved) return;
        this.render("");
      });

      this.input.addEventListener("input", () => {
        if (state.saved) return;
        this.render(this.input.value);
      });

      this.input.addEventListener("keydown", (e) => this.onKey(e));

      document.addEventListener("click", (e) => {
        if (!this.list.contains(e.target) && e.target !== this.input) this.hide();
      });
    },

    hide() {
      this.list.classList.add("hidden");
      this.list.innerHTML = "";
      this.activeIndex = -1;
      this.input?.setAttribute("aria-expanded", "false");
    },

    highlight(text, q) {
      if (!q) return esc(text);

      const src = text.normalize("NFD").toLowerCase();
      const needle = q.normalize("NFD").toLowerCase();
      const idx = src.indexOf(needle);

      if (idx < 0) return esc(text);

      return (
        esc(text.slice(0, idx)) +
        `<span class="fi-hl">${esc(text.slice(idx, idx + q.length))}</span>` +
        esc(text.slice(idx + q.length))
      );
    },

    filterList(q) {
      if (!q) return Catalog.list;
      const needle = norm(q);
      return Catalog.list.filter((m) => norm(m.nombre).includes(needle));
    },

    render(query) {
      const q = clean(query);
      const items = this.filterList(q);

      let html = "";
      let header = "";

      items.forEach((m, index) => {
        const first = (m.nombre[0] || "#").toUpperCase();

        if (first !== header) {
          header = first;
          html += `<div class="fi-sep">${esc(first)}</div>`;
        }

        const maxLabel = m.maxAlumno > 0 ? m.maxAlumno : "sin límite";
        const dispLabel = Number.isFinite(m.disponible) ? m.disponible : "—";

        html += `
          <div class="fi-item" role="option" data-idx="${index}">
            <div class="name">${this.highlight(m.nombre, q)}</div>
            <div class="meta" style="opacity:.65">
              ${m.clave ? esc(m.clave) : ""} · Máx: ${maxLabel} · Disp: ${dispLabel}
            </div>
          </div>
        `;
      });

      if (!html) {
        html = `<div class="fi-item" style="pointer-events:none;opacity:.65">Sin resultados</div>`;
      }

      this.list.innerHTML = html;
      this.list.classList.remove("hidden");
      this.input?.setAttribute("aria-expanded", "true");

      this.list.querySelectorAll(".fi-item[role='option']").forEach((el) => {
        el.addEventListener("click", () => {
          const idx = Number(el.getAttribute("data-idx"));
          this.choose(items[idx]);
        });
      });

      this.activeIndex = items.length ? 0 : -1;
      this.updateActive();
    },

    updateActive() {
      const nodes = this.list.querySelectorAll(".fi-item[role='option']");
      nodes.forEach((n) => n.classList.remove("active"));

      if (this.activeIndex >= 0 && nodes[this.activeIndex]) {
        nodes[this.activeIndex].classList.add("active");
        nodes[this.activeIndex].scrollIntoView({ block: "nearest" });
      }
    },

    onKey(e) {
      if (state.saved) return;

      const items = this.filterList(this.input.value);
      if (!items.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.activeIndex = Math.min(items.length - 1, this.activeIndex + 1);
        this.updateActive();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.activeIndex = Math.max(0, this.activeIndex - 1);
        this.updateActive();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (this.activeIndex >= 0) this.choose(items[this.activeIndex]);
      } else if (e.key === "Escape") {
        this.hide();
      }
    },

    choose(mat) {
      if (!mat || state.saved) return;

      this.input.value = mat.nombre;
      if (this.hidden) this.hidden.value = mat.id || "";

      this.hide();
      applyLimitFromMaterial();
      updateActionStates();
      $("#cantidad")?.focus();
    },
  };

  /* =========================================================
     UI / TABLA
  ========================================================= */
  function updateActionStates() {
    const btnPlus = $("#plusQty");
    const btnAdd = $("#agregar");
    const btnSave = $("#guardar");
    const btnCancel = $("#cancelarPedido");
    const btnView = $("#btnVerCompras");

    const metaOk = metaFieldsComplete();
    const hasMaterial = validMaterial();
    const hasCantidad = validCantidad();
    const hasRows = state.items.length > 0;

    if (state.saved) {
      if (btnPlus) btnPlus.disabled = true;
      if (btnAdd) btnAdd.disabled = true;
      if (btnSave) btnSave.disabled = true;
      if (btnCancel) btnCancel.disabled = true;
      if (btnView) btnView.disabled = false;
      return;
    }

    if (btnPlus) btnPlus.disabled = !(metaOk && hasMaterial);
    if (btnAdd) btnAdd.disabled = !(metaOk && hasMaterial && hasCantidad);
    if (btnSave) btnSave.disabled = !(metaOk && hasRows);
    if (btnCancel) btnCancel.disabled = !(metaOk && hasRows);
    if (btnView) btnView.disabled = !(metaOk && hasRows);
  }

  function renderTable() {
    const tbody = $("#tablaMateriales tbody");
    if (!tbody) return;

    if (!state.items.length) {
      tbody.innerHTML = "";
      updateActionStates();
      return;
    }

    tbody.innerHTML = state.items
      .map(
        (item, index) => `
          <tr>
            <td style="text-align:left">${esc(item.material)}</td>
            <td>${item.cantidad}</td>
            <td>${item.fechaIngreso || "—"}</td>
            <td>
              <div class="row-actions">
                <button class="icon-btn danger" data-del="${index}" title="Eliminar" ${state.saved ? "disabled" : ""}>
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `
      )
      .join("");

    if (!state.saved) {
      tbody.querySelectorAll("button[data-del]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const idx = Number(e.currentTarget.getAttribute("data-del"));
          state.items.splice(idx, 1);
          renderTable();
          applyLimitFromMaterial();
          $("#materialSearch")?.focus();
        });
      });
    }

    updateActionStates();
  }

  function resetMaterialEntry() {
    const search = $("#materialSearch");
    const hidden = $("#material");
    const qty = $("#cantidad");

    if (search) search.value = "";
    if (hidden) hidden.value = "";
    if (qty) {
      qty.value = "1";
      qty.dataset.maxAllowed = "";
      qty.dataset.stockTotal = "";
      qty.dataset.stockRestante = "";
    }

    Finder.hide();
  }

  function addCurrentRow() {
    if (state.saved) return;

    if (!metaFieldsComplete()) {
      toast("Primero llena todos los datos del encabezado.", "warn");
      return;
    }

    if (!validMaterial()) {
      toast("Busca y elige un material.", "warn");
      $("#materialSearch")?.focus();
      return;
    }

    if (!ensureCantidadValidaOrWarn()) return;

    const { yyyy, mm, dd } = nowParts();
    const material = clean($("#materialSearch")?.value);
    const cantidad = Number($("#cantidad")?.value || 0);
    const fechaIngreso = `${yyyy}-${mm}-${dd}`;

    state.items.push({ material, cantidad, fechaIngreso });

    renderTable();
    resetMaterialEntry();
    applyLimitFromMaterial();
    updateActionStates();
    $("#materialSearch")?.focus();
  }

  function incQty() {
    if (state.saved) return;

    if (!metaFieldsComplete()) {
      toast("Primero llena todos los datos del encabezado.", "warn");
      return;
    }

    const material = clean($("#materialSearch")?.value);
    if (!material) {
      toast("Selecciona un material antes de aumentar la cantidad.", "warn");
      $("#materialSearch")?.focus();
      return;
    }

    const inp = $("#cantidad");
    const info = computeEffectiveMax(material);
    const max = info.maxFinal;
    const current = Number(inp?.value || "0") || 0;
    const next = current + 1;

    if (max > 0 && next > max) {
      inp.value = String(max);
      toast(`Máx. permitido para "${material}" = ${max}.`, "warn");
    } else {
      inp.value = String(next);
    }

    updateActionStates();
  }

  /* =========================================================
     PAYLOAD
  ========================================================= */
  function buildSolicitudPayload() {
  const fecha = clean($("#fecha")?.value);
  const horaBase = clean($("#hora")?.value);
  const folio = clean($("#folio")?.value);
  const alumnoNombre = clean($("#alumno")?.value);
  const alumnoUser = readLS("LE_user", null);

  const noControl =
    clean($("#alumno")?.dataset?.noControl) ||
    clean(alumnoUser?.numeroControl || alumnoUser?.noControl || "");

  return {
    fecha,
    hora: horaBase ? `${horaBase}:00` : "",
    noVale: folio,
    auxiliar: clean($("#auxiliar")?.value),
    maestro: clean($("#docente")?.value),
    carrera: clean($("#carrera")?.value),
    alumno: {
      nombreCompleto: alumnoNombre,
      noControl,
    },
    materia: clean($("#materiaAcad")?.value),
    mesa: clean($("#mesa")?.value),
    items: state.items.map((it) => ({
      material: it.material,
      cantidad: Number(it.cantidad) || 0,
      descripcion: it.material,
      fechaIngreso: it.fechaIngreso || "",
    })),
  };
}
  function buildPdfMeta(payload) {
    return {
      noVale: payload.noVale,
      fecha: payload.fecha,
      hora: payload.hora,
      mesa: payload.mesa,
      itemsCount: Array.isArray(payload.items) ? payload.items.length : 0,
    };
  }

  function setPrestamoPendienteLocal(payload) {
  const snapshot = {
    estado: "pendiente",
    noVale: payload.noVale,
    fecha: payload.fecha,
    hora: payload.hora,
    materia: payload.materia,
    maestro: payload.maestro,
    mesa: payload.mesa,
    alumno: {
      nombre: payload.alumno?.nombreCompleto || "",
      noControl: payload.alumno?.noControl || "",
    },
    items: payload.items || [],
    enviado_en: `${payload.fecha || ""} ${payload.hora || ""}`.trim(),
  };

  localStorage.setItem("LE_prestamo_status", "pendiente");
  localStorage.setItem("LE_prestamo_data", JSON.stringify(snapshot));
}

function pushAlumnoInbox(noControl, mensaje) {
  if (!noControl || !mensaje) return;

  const key = `LE_inbox_${noControl}`;
  let inbox = [];

  try {
    inbox = JSON.parse(localStorage.getItem(key) || "[]") || [];
  } catch {
    inbox = [];
  }

  inbox.push({
    ts: new Date().toLocaleString("es-MX"),
    mensaje,
  });

  localStorage.setItem(key, JSON.stringify(inbox));
}
  /* =========================================================
     PDF REAL PARA DESCARGA
  ========================================================= */
  function buildPDFMarkup(payload) {
    const rows = payload.items.length
      ? payload.items
          .map(
            (it) => `
              <tr>
                <td>${esc(String(it.cantidad || 0))}</td>
                <td>${esc(it.descripcion || it.material || "")}</td>
                <td>${esc(it.fechaIngreso || "—")}</td>
              </tr>
            `
          )
          .join("")
      : `
        <tr>
          <td colspan="3" class="pdf-empty">No hay materiales en el pedido.</td>
        </tr>
      `;

    return `
      <div class="pdf-page">
        <div class="pdf-shell">
          <div class="pdf-head">
            <div class="pdf-brand-box">TecNM</div>

            <div class="pdf-head-center">
              <div class="pdf-title">SOLICITUD DEPARTAMENTO DE</div>
              <div class="pdf-title">INGENIERÍA ELÉCTRICA–ELECTRÓNICA</div>
              <div class="pdf-subtitle">MATERIALES</div>
            </div>

            <div class="pdf-brand-box">ITS</div>
          </div>

          <div class="pdf-card">
            <div class="pdf-card-title">Pedido</div>

            <div class="pdf-info">
              <div><strong>Alumno:</strong> ${esc(payload.alumno?.nombreCompleto || "—")}</div>
              <div><strong>Fecha:</strong> ${esc(payload.fecha || "—")}</div>
              <div><strong>Hora:</strong> ${esc(payload.hora || "—")}</div>
              <div><strong>No. vale:</strong> ${esc(payload.noVale || "—")}</div>

              <div><strong>Materia:</strong> ${esc(payload.materia || "—")}</div>
              <div><strong>Maestro:</strong> ${esc(payload.maestro || "—")}</div>
              <div><strong>Mesa:</strong> ${esc(payload.mesa || "—")}</div>
              <div><strong>Carrera:</strong> ${esc(payload.carrera || "—")}</div>
            </div>

            <div class="pdf-block">
              <div class="pdf-block-title">Materiales solicitados</div>

              <table class="pdf-table">
                <thead>
                  <tr>
                    <th style="width:90px;">Cant.</th>
                    <th>Descripción</th>
                    <th style="width:140px;">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </div>

            <div class="pdf-note">
              Documento generado automáticamente por el sistema de solicitud de materiales.
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildPDFStyles() {
    return `
      <style>
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          background: #ffffff;
          font-family: 'Segoe UI', Arial, sans-serif;
          color: #252525;
        }

        .pdf-page {
          width: 794px;
          min-height: 1123px;
          margin: 0 auto;
          background: #ffffff;
          padding: 34px;
        }

        .pdf-shell {
          width: 100%;
          min-height: 100%;
          background: #f3f3f5;
          border-radius: 28px;
          padding: 28px;
        }

        .pdf-head {
          display: grid;
          grid-template-columns: 90px 1fr 90px;
          gap: 22px;
          align-items: center;
          border-bottom: 4px solid #8b0000;
          padding-bottom: 16px;
          margin-bottom: 22px;
        }

        .pdf-brand-box {
          width: 74px;
          height: 74px;
          border-radius: 16px;
          border: 2px solid #d0d0d0;
          background: #ffffff;
          color: #8b0000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 800;
          margin: 0 auto;
        }

        .pdf-head-center { text-align: center; }

        .pdf-title {
          color: #7a0000;
          font-weight: 900;
          font-size: 28px;
          line-height: 1.15;
        }

        .pdf-subtitle {
          color: #7a0000;
          font-weight: 900;
          font-size: 24px;
          margin-top: 4px;
        }

        .pdf-card {
          background: #e8e8eb;
          border-radius: 28px;
          padding: 24px;
        }

        .pdf-card-title {
          text-align: center;
          color: #b30000;
          font-size: 30px;
          font-weight: 900;
          margin-bottom: 18px;
        }

        .pdf-info {
          background: #ffffff;
          border-radius: 20px;
          padding: 18px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px 26px;
          font-size: 18px;
          line-height: 1.45;
        }

        .pdf-block {
          margin-top: 20px;
          background: #ffffff;
          border-radius: 20px;
          padding: 18px;
        }

        .pdf-block-title {
          font-size: 24px;
          font-weight: 800;
          color: #111111;
          margin-bottom: 14px;
        }

        .pdf-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          overflow: hidden;
          border-radius: 14px;
          font-size: 18px;
        }

        .pdf-table thead th {
          background: #e5e6ea;
          color: #111;
          text-align: left;
          padding: 14px 16px;
          font-weight: 800;
          border-bottom: 2px solid #d3d3d3;
        }

        .pdf-table tbody td {
          background: #fffdfd;
          padding: 14px 16px;
          border-bottom: 1px solid #ececec;
          vertical-align: top;
        }

        .pdf-table tbody tr:last-child td { border-bottom: none; }

        .pdf-empty {
          text-align: center;
          color: #666;
          padding: 60px 20px !important;
        }

        .pdf-note {
          margin-top: 20px;
          text-align: center;
          color: #6c6c6c;
          font-size: 14px;
        }
      </style>
    `;
  }

  async function generatePdfBlobUrl(payload) {
    if (typeof html2pdf === "undefined") {
      throw new Error("html2pdf no está cargado.");
    }

    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "-100000px";
    host.style.top = "0";
    host.style.width = "794px";
    host.style.minHeight = "1123px";
    host.style.background = "#ffffff";
    host.style.zIndex = "-1";
    host.style.overflow = "hidden";

    host.innerHTML = `
      ${buildPDFStyles()}
      ${buildPDFMarkup(payload)}
    `;

    document.body.appendChild(host);

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    try {
      const opt = {
        margin: 0,
        filename: `${payload.noVale || "solicitud"}.pdf`,
        image: { type: "jpeg", quality: 1 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: 794,
          windowHeight: 1123
        },
        jsPDF: {
          unit: "pt",
          format: "a4",
          orientation: "portrait"
        },
        pagebreak: {
          mode: ["avoid-all"]
        }
      };

      const worker = html2pdf().set(opt).from(host);
      const pdfObj = await worker.toPdf().get("pdf");
      const blob = pdfObj.output("blob");
      return URL.createObjectURL(blob);
    } finally {
      host.remove();
    }
  }

  async function ensurePdfReady(payload) {
    const nextMeta = buildPdfMeta(payload);
    const cachedBlobUrl = readSS(PDF_CACHE_KEY, null);
    const cachedMeta = readSS(PDF_META_KEY, null);

    if (cachedBlobUrl && samePdfMeta(cachedMeta, nextMeta)) {
      return cachedBlobUrl;
    }

    const oldBlob = readSS(PDF_CACHE_KEY, null);
    if (oldBlob) {
      try { URL.revokeObjectURL(oldBlob); } catch {}
    }

    const blobUrl = await generatePdfBlobUrl(payload);
    writeSS(PDF_CACHE_KEY, blobUrl);
    writeSS(PDF_META_KEY, nextMeta);
    return blobUrl;
  }

  async function descargarPdf(payload) {
    const blobUrl = await ensurePdfReady(payload);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${payload.noVale || "solicitud"}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* =========================================================
     VISTA TEMPORAL BONITA BASADA EN TU REFERENCIA
  ========================================================= */
  function buildPreviewRows(payload) {
    if (!payload.items.length) {
      return `
        <tr>
          <td colspan="2" class="preview-empty">
            <div class="preview-empty-icon">📦</div>
            <div>No hay materiales en el pedido.</div>
          </td>
        </tr>
      `;
    }

    return payload.items
      .map(
        (it) => `
          <tr>
            <td>${esc(String(it.cantidad || 0))}</td>
            <td>${esc(it.descripcion || it.material || "")}</td>
          </tr>
        `
      )
      .join("");
  }

  function openTemporaryPreviewWindow(payload) {
  const viewer = window.open("", "_blank");
  if (!viewer) {
    toast("Tu navegador bloqueó la ventana.", "warn");
    return;
  }

  const homeAbs = absoluteUrl(HOME_URL);
  const safeVale = esc(payload.noVale || "Solicitud");
  const safeAlumno = esc(payload.alumno?.nombreCompleto || "Alumno");
  const rows = buildPreviewRows(payload);

  viewer.document.open();
  viewer.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>${safeVale}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        * { box-sizing: border-box; }

        html, body {
          margin: 0;
          padding: 0;
          min-height: 100%;
          font-family: 'Segoe UI', Arial, sans-serif;
          background: radial-gradient(circle at center, #8b0000 10%, #2b0000 80%);
          color: #2a2a2a;
        }

        .top-progress {
          position: fixed;
          top: 0;
          left: 0;
          height: 6px;
          width: 100%;
          background: rgba(255,255,255,.18);
          z-index: 9999;
        }

        .top-progress > div {
          height: 100%;
          width: 100%;
          background: linear-gradient(90deg, #18b95a, #6df28f);
          transform-origin: left center;
          animation: shrinkLine ${PDF_VIEW_MS}ms linear forwards;
        }

        @keyframes shrinkLine {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }

        .viewer-topbar {
          position: fixed;
          top: 16px;
          left: 16px;
          right: 16px;
          z-index: 9998;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 12px;
        }

        .viewer-chip {
          background: rgba(255,255,255,.96);
          color: #7a0000;
          border-radius: 999px;
          box-shadow: 0 8px 28px rgba(0,0,0,.25);
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 700;
        }

        .page {
          width: min(1100px, 92vw);
          margin: 28px auto;
          background: #ffffff;
          border-radius: 26px;
          box-shadow: 0 0 35px rgba(0,0,0,.45);
          padding: 30px 40px;
          min-height: calc(100vh - 56px);
          position: relative;
        }

        .head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          border-bottom: 3px solid #8b0000;
          padding-bottom: 12px;
          margin-top: 18px;
        }

        .logo-real {
          width: 78px;
          height: 78px;
          object-fit: contain;
          display: block;
        }

        .head-center {
          flex: 1;
          text-align: center;
        }

        .head-title {
          color: #7a0000;
          font-weight: 900;
          font-size: 22px;
          line-height: 1.15;
        }

        .head-subtitle {
          color: #7a0000;
          font-weight: 900;
          font-size: 20px;
          margin-top: 4px;
        }

        .main-card {
          background: #ececef;
          border-radius: 22px;
          padding: 18px;
          margin-top: 18px;
        }

        .pedido-title {
          text-align: center;
          color: #b30000;
          font-size: 22px;
          font-weight: 900;
          margin: 6px 0 14px;
        }

        .info-card {
          background: #ffffff;
          border-radius: 18px;
          padding: 16px 18px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr;
          gap: 12px 22px;
          font-size: 15px;
        }

        .info-grid div {
          word-break: break-word;
        }

        .materials-card {
          background: #ffffff;
          border-radius: 18px;
          padding: 16px 16px 20px;
          margin-top: 16px;
        }

        .materials-title {
          font-size: 18px;
          font-weight: 800;
          color: #111;
          margin-bottom: 12px;
        }

        .materials-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          overflow: hidden;
          border-radius: 14px;
          font-size: 15px;
        }

        .materials-table thead th {
          background: #e9eaee;
          color: #111;
          text-align: left;
          padding: 12px 14px;
          font-weight: 800;
          border-bottom: 2px solid #ddd;
        }

        .materials-table tbody td {
          padding: 14px;
          border-bottom: 1px solid #ececec;
          background: #fffdfd;
        }

        .materials-table tbody tr:last-child td {
          border-bottom: none;
        }

        .preview-empty {
          text-align: center;
          color: #6b6b6b;
          padding: 42px 20px !important;
        }

        .preview-empty-icon {
          font-size: 28px;
          margin-bottom: 8px;
        }

        .note-toast {
          position: fixed;
          top: 72px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9998;
          background: rgba(255,255,255,.97);
          color: #7a0000;
          padding: 12px 18px;
          border-radius: 14px;
          box-shadow: 0 10px 28px rgba(0,0,0,.22);
          font-weight: 700;
          font-size: 14px;
          animation: fadeOutNote 5s ease forwards;
        }

        @keyframes fadeOutNote {
          0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          10% { opacity: 1; transform: translateX(-50%) translateY(0); }
          80% { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
        }

        .viewer-home-bottom {
          position: fixed;
          right: 22px;
          bottom: 22px;
          width: 62px;
          height: 62px;
          border: none;
          cursor: pointer;
          font-size: 28px;
          color: #b30000;
          background: linear-gradient(180deg, #ffffff, #f3f3f3);
          border-radius: 18px;
          box-shadow: 0 10px 26px rgba(0,0,0,.22);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform .18s ease, box-shadow .18s ease;
          z-index: 9998;
        }

        .viewer-home-bottom:hover {
          transform: translateY(-2px) scale(1.04);
          box-shadow: 0 14px 30px rgba(0,0,0,.28);
        }

        @media (max-width: 900px) {
          .info-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 600px) {
          .page {
            padding: 22px 18px;
          }

          .info-grid {
            grid-template-columns: 1fr;
          }

          .head-title {
            font-size: 18px;
          }

          .head-subtitle {
            font-size: 17px;
          }

          .logo-real {
            width: 58px;
            height: 58px;
          }
        }
      </style>
    </head>
    <body>
      <div class="top-progress"><div></div></div>

      <div class="viewer-topbar">
        <div class="viewer-chip">
          ${safeVale} · ${safeAlumno} · Vista temporal de 5 min
        </div>
      </div>

      <div class="note-toast">
        Tu solicitud ya fue enviada al auxiliar. En un momento te responderá.
      </div>

      <div class="page">
        <div class="head">
          <img class="logo-real" src="${LOGO_LEFT_URL}" alt="Logo izquierdo">

          <div class="head-center">
            <div class="head-title">SOLICITUD DEPARTAMENTO DE</div>
            <div class="head-title">INGENIERÍA ELÉCTRICA–ELECTRÓNICA</div>
            <div class="head-subtitle">MATERIALES</div>
          </div>

          <img class="logo-real" src="${LOGO_RIGHT_URL}" alt="Logo derecho">
        </div>

        <div class="main-card">
          <div class="pedido-title">Pedido</div>

          <div class="info-card">
            <div class="info-grid">
              <div><strong>Alumno:</strong> ${esc(payload.alumno?.nombreCompleto || "—")}</div>
              <div><strong>Fecha:</strong> ${esc(payload.fecha || "—")}</div>
              <div><strong>Hora:</strong> ${esc(payload.hora || "—")}</div>
              <div><strong>No. vale:</strong> ${esc(payload.noVale || "—")}</div>

              <div><strong>Materia:</strong> ${esc(payload.materia || "—")}</div>
              <div><strong>Maestro:</strong> ${esc(payload.maestro || "—")}</div>
              <div><strong>Mesa:</strong> ${esc(payload.mesa || "—")}</div>
              <div><strong>Carrera:</strong> ${esc(payload.carrera || "—")}</div>
            </div>
          </div>

          <div class="materials-card">
            <div class="materials-title">Materiales solicitados</div>

            <table class="materials-table">
              <thead>
                <tr>
                  <th style="width:140px;">Cantidad</th>
                  <th>Descripción</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <button class="viewer-home-bottom" id="goHomeBottom" title="Ir al inicio">🏠</button>

      <script>
        const HOME_URL = ${JSON.stringify(homeAbs)};
        const VIEW_MS = ${PDF_VIEW_MS};

        document.getElementById("goHomeBottom").addEventListener("click", () => {
          window.location.href = HOME_URL;
        });

        setTimeout(() => {
          window.location.href = HOME_URL;
        }, VIEW_MS);
      </script>
    </body>
    </html>
  `);
  viewer.document.close();
}

  /* =========================================================
     ACCIONES
  ========================================================= */
  async function guardarSolicitud() {
  if (state.saved) return;

  if (!metaFieldsComplete()) {
    toast("Llena todos los datos del encabezado antes de guardar.", "warn");
    return;
  }

  if (!state.items.length) {
    toast("Agrega por lo menos un material.", "warn");
    return;
  }

  const payload = buildSolicitudPayload();

  try {
    openPdfOverlay();

    await progressStep(12, "Validando los datos de la solicitud...", "Preparando tu solicitud", 500);

    writeLS("LE_confirmacionJC", payload);
    writeLS("LE_vale_payload", payload);

    setPrestamoPendienteLocal(payload);

    pushAlumnoInbox(
      payload.alumno?.noControl,
      `Tu solicitud ${payload.noVale} fue enviada al auxiliar. En un momento te responderá.`
    );

    await progressStep(30, "Guardando la solicitud en el sistema...", "Guardando solicitud", 650);

    state.saved = true;
    renderTable();
    updateActionStates();

    await progressStep(55, "Preparando el diseño del PDF tamaño A4...", "Generando PDF", 650);
    await progressStep(78, "Acomodando el contenido del PDF...", "Generando PDF", 650);

    await descargarPdf(payload);

    await progressStep(96, "El PDF ya quedó descargado correctamente.", "PDF listo", 300);
    await finishPdfLoadingOk("Solicitud guardada y enviada al auxiliar.");
    toast("Tu solicitud ya fue enviada al auxiliar.", "ok");
  } catch (err) {
    console.error("Error al guardar/generar PDF:", err);
    state.saved = false;
    renderTable();
    updateActionStates();
    await finishPdfLoadingError("No se pudo crear el PDF.");
  }
}

  function cancelarSolicitud() {
    if (state.saved) return;

    state.items = [];
    state.saved = false;
    renderTable();

    removeLS("LE_confirmacionJC");
    removeLS("LE_vale_payload");

    const oldBlob = readSS(PDF_CACHE_KEY, null);
    if (oldBlob) {
      try { URL.revokeObjectURL(oldBlob); } catch {}
    }

    removeSS(PDF_CACHE_KEY);
    removeSS(PDF_META_KEY);

    resetMaterialEntry();
    toast("Solicitud cancelada.", "info");
    updateActionStates();
  }

  async function verSolicitud() {
    if (!metaFieldsComplete()) {
      toast("Llena todos los datos del encabezado antes de continuar.", "warn");
      return;
    }

    if (!state.items.length) {
      toast("Agrega por lo menos un material.", "warn");
      return;
    }

    const payload = buildSolicitudPayload();
    writeLS("LE_confirmacionJC", payload);
    writeLS("LE_vale_payload", payload);

    try {
      openPdfOverlay();

      await progressStep(20, "Preparando la vista temporal de la solicitud...", "Abriendo solicitud", 320);
      await progressStep(70, "Cargando el diseño de la vista...", "Abriendo solicitud", 320);

      openTemporaryPreviewWindow(payload);

      await progressStep(100, "La solicitud ya se abrió en una nueva pestaña.", "Listo", 180);
      closePdfOverlay();
    } catch (err) {
      console.error("Error al abrir vista temporal:", err);
      await finishPdfLoadingError("No pude abrir la vista temporal de la solicitud.");
    }
  }

  /* =========================================================
     INIT
  ========================================================= */
  document.addEventListener("DOMContentLoaded", async () => {
    hideBrokenShimejiArtifacts();

    await Catalog.sync();

    Finder.init();
    initPdfOverlay();
    setFechaHoraHoy();
    setFolio();
    setAlumnoYCarrera();

    await loadAuxiliaresSelect();
    await loadDocentesSelect();
    await loadMateriasSelect();
    loadMesasSelect();

    $("#plusQty")?.addEventListener("click", incQty);
    $("#agregar")?.addEventListener("click", addCurrentRow);
    $("#guardar")?.addEventListener("click", guardarSolicitud);
    $("#cancelarPedido")?.addEventListener("click", cancelarSolicitud);
    $("#btnVerCompras")?.addEventListener("click", verSolicitud);

    [
      "fecha", "hora", "folio", "alumno", "carrera",
      "auxiliar", "docente", "materiaAcad", "mesa",
    ].forEach((id) => {
      const el = $("#" + id);
      if (!el) return;
      el.addEventListener("input", updateActionStates);
      el.addEventListener("change", updateActionStates);
    });

    $("#materialSearch")?.addEventListener("input", applyLimitFromMaterial);
    $("#materialSearch")?.addEventListener("change", applyLimitFromMaterial);

    $("#cantidad")?.addEventListener("input", () => {
      const inp = $("#cantidad");
      if (!inp) return;

      if (inp.value === "" || Number(inp.value) <= 0) {
        updateActionStates();
        return;
      }

      const max = Number(inp.dataset.maxAllowed || "0") || 0;
      const n = Number(inp.value) || 0;

      if (max > 0 && n > max) {
        inp.value = String(max);
        toast(`Máx. permitido = ${max}.`, "warn");
      }

      updateActionStates();
    });

    $("#cantidad")?.addEventListener("blur", () => {
      const inp = $("#cantidad");
      if (!inp) return;

      if (!validCantidad()) {
        inp.value = "";
        toast("Tiene que poner un número válido.", "warn");
      }

      updateActionStates();
    });

    applyLimitFromMaterial();
    renderTable();
    updateActionStates();
  });
})();