/* =========================================================
   Gestión de Asesorías
   Frontend completo y adaptado al backend actual
========================================================= */
(() => {
  "use strict";

  const API_ASESORIAS = "/api/asesorias";
  const API_MATERIAS = "/api/materias";
  const API_PERSONAS = "/api/personas";

  const $ = (id) => document.getElementById(id);
  const qs = (selector) => document.querySelector(selector);

  let ASESORIAS_CACHE = [];
  let DOCENTES_CACHE = [];
  let MATERIAS_CACHE = [];
  let ALUMNOS_CACHE = [];

  const DOCENTE_MAP = new Map();
  const ALUMNO_MAP = new Map();

  function getLoggedUser() {
    try {
      return JSON.parse(localStorage.getItem("LE_user") || "null");
    } catch {
      return null;
    }
  }

  function esc(value = "") {
    return String(value).replace(/[&<>"']/g, (m) => {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return map[m];
    });
  }

  function todayISO() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  function toTitleCase(text = "") {
    return String(text)
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  function parseHHMM(text = "") {
    const match = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(text));
    if (!match) return null;

    const hh = Number(match[1]);
    const mm = Number(match[2]);

    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return hh * 60 + mm;
  }

  function parseRange(text = "") {
    const parts = String(text).split("-");
    if (parts.length !== 2) return null;

    const ini = parseHHMM(parts[0]);
    const fin = parseHHMM(parts[1]);

    if (ini == null || fin == null || fin <= ini) return null;
    return { ini, fin };
  }

  function formatRange(ini, fin) {
    return `${ini} - ${fin}`;
  }

  const MAX_END_MINUTES = 16 * 60;

  function getStatusFromDate(fecha, hora) {
    const hoy = todayISO();

    if (!fecha) return "Pendiente";
    if (fecha < hoy) return "Finalizada";
    if (fecha > hoy) return "Pendiente";

    const range = parseRange(hora || "");
    if (!range) return "Pendiente";

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (currentMinutes < range.ini) return "Pendiente";
    if (currentMinutes > range.fin) return "Finalizada";
    return "En curso";
  }

  function normalizeApiArray(json) {
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.data)) return json.data;
    if (Array.isArray(json?.asesorias)) return json.asesorias;
    return [];
  }

  function toast(message, type = "info", duration = 2200) {
    let host = $("asesorias-toast-host");

    if (!host) {
      host = document.createElement("div");
      host.id = "asesorias-toast-host";
      host.style.cssText = `
        position: fixed;
        left: 50%;
        bottom: 24px;
        transform: translateX(-50%);
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        align-items: center;
        pointer-events: none;
      `;
      document.body.appendChild(host);
    }

    const card = document.createElement("div");
    card.style.cssText = `
      pointer-events: auto;
      color: #fff;
      padding: 12px 16px;
      border-radius: 14px;
      font-weight: 700;
      box-shadow: 0 10px 25px rgba(0,0,0,.30);
      max-width: 520px;
      text-align: center;
    `;

    if (type === "success") card.style.background = "#065f46";
    else if (type === "error") card.style.background = "#991b1b";
    else if (type === "warn") card.style.background = "#92400e";
    else card.style.background = "#7a0000";

    card.textContent = message;
    host.appendChild(card);

    setTimeout(() => {
      card.remove();
    }, duration);
  }

  function askConfirm(message) {
    return Promise.resolve(window.confirm(message));
  }

  async function fetchJSON(url, options = {}) {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    });

    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok) {
      const msg =
        json?.message ||
        json?.error ||
        json?.mensaje ||
        `HTTP ${res.status}`;
      throw new Error(msg);
    }

    if (json && json.ok === false) {
      throw new Error(json.message || json.error || "Error del servidor");
    }

    if (json && json.success === false) {
      throw new Error(json.message || json.error || "Error del servidor");
    }

    return json;
  }

  async function apiPersonas() {
    const json = await fetchJSON(API_PERSONAS);
    const rows = normalizeApiArray(json);

    DOCENTE_MAP.clear();
    ALUMNO_MAP.clear();

    const docentes = [];
    const alumnos = [];

    rows.forEach((p, index) => {
      const tipo = String(p.tipo || "").trim().toLowerCase();
      const numeroControl = String(
        p.numeroControl ?? p.no_control ?? p.noControl ?? ""
      ).trim();

      const nombreCompleto = [
        p.nombre,
        p.apellidoPaterno,
        p.apellidoMaterno,
      ]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (!nombreCompleto) return;

      if (tipo === "docente") {
        const item = {
          id: numeroControl || String(index + 1),
          nombreCompleto,
        };
        docentes.push(item);
        DOCENTE_MAP.set(String(item.id), item.nombreCompleto);
      }

      if (tipo === "alumno") {
        const item = {
          numeroControl,
          nombreCompleto,
        };
        alumnos.push(item);
        ALUMNO_MAP.set(String(numeroControl), nombreCompleto);
      }
    });

    docentes.sort((a, b) =>
      a.nombreCompleto.localeCompare(b.nombreCompleto, "es", {
        sensitivity: "base",
      })
    );

    alumnos.sort((a, b) =>
      a.nombreCompleto.localeCompare(b.nombreCompleto, "es", {
        sensitivity: "base",
      })
    );

    DOCENTES_CACHE = docentes;
    ALUMNOS_CACHE = alumnos;
  }

  async function apiMaterias() {
    const json = await fetchJSON(API_MATERIAS);
    const rows = normalizeApiArray(json);

    const materias = rows
      .filter((m) => m.id_Estado == null || Number(m.id_Estado) === 1)
      .map((m) => ({
        id: Number(m.id_Materia ?? m.id ?? 0),
        nombre: String(m.nombre ?? m.materia ?? "").trim(),
      }))
      .filter((m) => m.nombre.length > 0)
      .sort((a, b) =>
        a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
      );

    MATERIAS_CACHE = materias;
  }

  async function apiListAsesorias() {
    const json = await fetchJSON(API_ASESORIAS);
    const rows = normalizeApiArray(json);

    ASESORIAS_CACHE = rows.map((x) => {
      const id = String(
        x.id ??
        x.id_Asesoria ??
        x.id_asesoria ??
        ""
      ).trim();

      const titulo = String(
        x.materia ??
        x.nombre ??
        x.titulo ??
        ""
      ).trim();

      const idProfesor = String(
        x.id_profesor ??
        x.id_Profesor ??
        ""
      ).trim();

      const docenteNombre =
        x.docenteNombre ||
        x.docente_nombre ||
        x.docente ||
        DOCENTE_MAP.get(idProfesor) ||
        "";

      const horaBase = String(
        x.hora ??
        x.hora_inicio ??
        ""
      ).trim();

      return {
        id,
        titulo,
        id_profesor: idProfesor,
        docenteNombre: docenteNombre || "",
        descripcion: String(x.descripcion ?? "").trim(),
        fecha: String(x.fecha ?? "").trim(),
        hora: horaBase,
        cupoTotal: Number(x.cupo_total ?? x.cupoTotal ?? x.cupo ?? 0),
        cupoActual: Number(x.cupo_actual ?? x.cupoActual ?? x.inscritos ?? 0),
        alumnos: Array.isArray(x.alumnos) ? x.alumnos : [],
        status:
          x.status ||
          x.estado ||
          getStatusFromDate(
            String(x.fecha ?? "").trim(),
            horaBase
          ),
      };
    });

    return ASESORIAS_CACHE;
  }

  async function apiCreateAsesoria(payload) {
    return fetchJSON(API_ASESORIAS, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async function apiUpdateAsesoria(id, payload) {
    return fetchJSON(`${API_ASESORIAS}/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async function apiDeleteAsesoria(id) {
    return fetchJSON(`${API_ASESORIAS}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async function fillDocentes(selectedValue = "") {
    const select = $("docente");
    if (!select) return;

    select.disabled = true;
    select.innerHTML = `<option value="">Cargando...</option>`;

    try {
      if (!DOCENTES_CACHE.length) {
        await apiPersonas();
      }

      select.innerHTML =
        `<option value="">— Selecciona —</option>` +
        DOCENTES_CACHE.map(
          (d) =>
            `<option value="${esc(d.id)}">${esc(d.nombreCompleto)}</option>`
        ).join("");

      if (selectedValue) {
        select.value = String(selectedValue);
      }
    } catch (err) {
      console.error(err);
      select.innerHTML = `<option value="">(Sin docentes)</option>`;
    } finally {
      select.disabled = false;
    }
  }

  async function fillMaterias(selectedText = "") {
    const select = $("materia");
    if (!select) return;

    select.disabled = true;
    select.innerHTML = `<option value="">Cargando...</option>`;

    try {
      if (!MATERIAS_CACHE.length) {
        await apiMaterias();
      }

      select.innerHTML =
        `<option value="">— Selecciona materia —</option>` +
        MATERIAS_CACHE.map(
          (m) =>
            `<option value="${esc(m.nombre)}">${esc(m.nombre)}</option>`
        ).join("");

      if (selectedText) {
        select.value = String(selectedText);
      }
    } catch (err) {
      console.error(err);
      select.innerHTML = `<option value="">(Sin materias)</option>`;
    } finally {
      select.disabled = false;
    }
  }

  let timeOptionsBuilt = false;

  function buildTimeOptions() {
    const horaIni = $("horaIni");
    const horaFin = $("horaFin");

    if (!horaIni || !horaFin || timeOptionsBuilt) return;
    timeOptionsBuilt = true;

    const times = [];
    for (let m = 7 * 60; m <= MAX_END_MINUTES; m += 30) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      times.push(`${hh}:${mm}`);
    }

    horaIni.innerHTML = times
      .slice(0, -1)
      .map((t) => `<option value="${t}">${t}</option>`)
      .join("");

    horaFin.innerHTML = times
      .map((t) => `<option value="${t}">${t}</option>`)
      .join("");

    horaIni.value = "14:00";
    horaFin.value = "16:00";

    function syncEndOptions() {
      const startMin = parseHHMM(horaIni.value) ?? 0;

      [...horaFin.options].forEach((opt) => {
        const val = parseHHMM(opt.value);
        opt.disabled = val == null || val <= startMin || val > MAX_END_MINUTES;
      });

      const endMin = parseHHMM(horaFin.value);
      if (endMin == null || endMin <= startMin || endMin > MAX_END_MINUTES) {
        const next = [...horaFin.options].find((opt) => !opt.disabled);
        if (next) horaFin.value = next.value;
      }

      updateButtonsState();
    }

    horaIni.addEventListener("change", syncEndOptions);
    horaFin.addEventListener("change", updateButtonsState);

    syncEndOptions();
  }

  function isFormValid() {
    const materia = ($("materia")?.value || "").trim();
    const docente = ($("docente")?.value || "").trim();
    const descripcion = ($("descripcion")?.value || "").trim();
    const fecha = ($("fecha")?.value || "").trim();
    const cupo = parseInt(($("cupo")?.value || "").trim(), 10);

    let horaTexto = "";
    if ($("horaIni") && $("horaFin")) {
      horaTexto = formatRange($("horaIni").value, $("horaFin").value);
    }

    const rango = parseRange(horaTexto);

    if (!materia) return false;
    if (!docente) return false;
    if (!descripcion) return false;
    if (!fecha || fecha < todayISO()) return false;
    if (!rango) return false;
    if (rango.fin > MAX_END_MINUTES) return false;
    if (!Number.isInteger(cupo) || cupo < 1 || cupo > 50) return false;

    return true;
  }

  function updateButtonsState() {
    const form = qs(".modal-form");
    if (!form) return;

    const submitBtn = form.querySelector("[type='submit']");
    if (!submitBtn) return;

    submitBtn.disabled = !isFormValid();
  }

  function wireFormValidation() {
    [
      "materia",
      "docente",
      "descripcion",
      "fecha",
      "horaIni",
      "horaFin",
      "cupo",
    ].forEach((id) => {
      const el = $(id);
      if (!el) return;

      el.addEventListener("input", updateButtonsState);
      el.addEventListener("change", updateButtonsState);
    });
  }

  function renderEmpty(container) {
    container.innerHTML = `
      <div class="empty-wrap">
        <div class="empty-icon" aria-hidden="true">📚</div>
        <div class="empty-title">No hay asesorías</div>
        <div class="empty-sub">Crea una nueva asesoría con el botón de arriba.</div>
      </div>
    `;
  }

  function renderList(list) {
    const container = $("asesoriasContainer");
    if (!container) return;

    if (!Array.isArray(list) || !list.length) {
      renderEmpty(container);
      return;
    }

    const ordered = [...list].sort((a, b) => {
      const score = (status) => {
        const st = String(status || "").toLowerCase();
        if (st === "en curso") return 0;
        if (st === "pendiente") return 1;
        return 2;
      };

      const sa = score(a.status);
      const sb = score(b.status);

      if (sa !== sb) return sa - sb;
      if (a.fecha !== b.fecha) return String(a.fecha).localeCompare(String(b.fecha));
      return String(a.titulo).localeCompare(String(b.titulo), "es", {
        sensitivity: "base",
      });
    });

    container.innerHTML = ordered
      .map((item) => {
        const status = String(item.status || "");
        const statusClass =
          status === "En curso"
            ? "status-en-curso"
            : status === "Pendiente"
            ? "status-pendiente"
            : "status-finalizada";

        return `
          <div class="asesoria-card" data-id="${esc(item.id)}">
            <h2 class="card-title">${esc(item.titulo)}</h2>

            <div class="card-info">
              <p class="info-item">
                <span class="icon">👨‍🏫</span>
                <strong>Docente:</strong> ${esc(item.docenteNombre || "—")}
              </p>

              <p class="info-item">
                <span class="icon">📝</span>
                <strong>Descripción:</strong> ${esc(item.descripcion || "—")}
              </p>

              <p class="info-item">
                <span class="icon">📅</span>
                <strong>Fecha:</strong> ${esc(item.fecha || "—")}
              </p>

              <p class="info-item">
                <span class="icon">🕐</span>
                <strong>Hora:</strong> ${esc(item.hora || "—")}
              </p>

              <p class="info-item">
                <span class="icon">👥</span>
                <strong>Cupo:</strong> ${item.cupoActual}/${item.cupoTotal}
              </p>

              <div class="status-wrapper">
                <span class="status-badge ${statusClass}">
                  ${esc(status.toUpperCase())}
                </span>
              </div>
            </div>

            <div class="card-actions">
              <button class="btn-edit" data-action="edit" data-id="${esc(item.id)}">✏️ Editar</button>
              <button class="btn-view" data-action="view" data-id="${esc(item.id)}">👁️ Ver inscritos</button>
              <button class="btn-delete" data-action="delete" data-id="${esc(item.id)}" data-title="${esc(item.titulo)}">🗑️ Eliminar</button>
            </div>
          </div>
        `;
      })
      .join("");

    container.querySelectorAll("[data-action='edit']").forEach((btn) => {
      btn.addEventListener("click", () => openEditModal(btn.dataset.id));
    });

    container.querySelectorAll("[data-action='view']").forEach((btn) => {
      btn.addEventListener("click", () => openStudentsModal(btn.dataset.id));
    });

    container.querySelectorAll("[data-action='delete']").forEach((btn) => {
      btn.addEventListener("click", () =>
        openDelete(btn.dataset.id, btn.dataset.title)
      );
    });
  }

  async function render() {
    try {
      const list = await apiListAsesorias();
      renderList(list);
    } catch (err) {
      console.error(err);
      const container = $("asesoriasContainer");
      if (container) renderEmpty(container);
      toast("No se pudo cargar la lista.", "error");
    }
  }

  function resetModalForm() {
    if ($("asesoriaId")) $("asesoriaId").value = "";
    if ($("materia")) $("materia").value = "";
    if ($("docente")) $("docente").value = "";
    if ($("descripcion")) $("descripcion").value = "";
    if ($("fecha")) $("fecha").value = "";
    if ($("cupo")) $("cupo").value = "";

    if ($("horaIni")) $("horaIni").value = "14:00";
    if ($("horaFin")) $("horaFin").value = "16:00";
  }

  async function openModal() {
    const modal = $("modal");
    if (!modal) return;

    $("modalTitle").textContent = "Crear Nueva Asesoría";
    resetModalForm();

    await Promise.all([fillMaterias(), fillDocentes()]);

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    updateButtonsState();
  }

  function closeModal() {
    const modal = $("modal");
    if (!modal) return;

    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  }

  async function openEditModal(id) {
    const asesoria = ASESORIAS_CACHE.find((a) => String(a.id) === String(id));
    if (!asesoria) {
      toast("No se encontró la asesoría.", "error");
      return;
    }

    const modal = $("modal");
    if (!modal) return;

    $("modalTitle").textContent = "Editar Asesoría";
    $("asesoriaId").value = asesoria.id;

    await Promise.all([
      fillMaterias(asesoria.titulo),
      fillDocentes(asesoria.id_profesor),
    ]);

    $("descripcion").value = asesoria.descripcion || "";
    $("fecha").value = asesoria.fecha || "";
    $("cupo").value = String(asesoria.cupoTotal || "");

    const range = parseRange(asesoria.hora || "");
    if (range && $("horaIni") && $("horaFin")) {
      const iniH = String(Math.floor(range.ini / 60)).padStart(2, "0");
      const iniM = String(range.ini % 60).padStart(2, "0");
      const finH = String(Math.floor(range.fin / 60)).padStart(2, "0");
      const finM = String(range.fin % 60).padStart(2, "0");

      $("horaIni").value = `${iniH}:${iniM}`;
      $("horaIni").dispatchEvent(new Event("change"));
      $("horaFin").value = `${finH}:${finM}`;
    }

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    updateButtonsState();
  }

  async function saveAsesoria(event) {
    event.preventDefault();

    const user = getLoggedUser();

    if (!user || !user.numeroControl) {
      toast("No se encontró la sesión del auxiliar. Vuelve a iniciar sesión.", "error", 3000);
      return;
    }

    const id = ($("asesoriaId")?.value || "").trim();
    const materia = ($("materia")?.value || "").trim();
    const docente = ($("docente")?.value || "").trim();
    const descripcion = ($("descripcion")?.value || "").trim();
    const fecha = ($("fecha")?.value || "").trim();
    const cupo = parseInt(($("cupo")?.value || "").trim(), 10);

    const horaIni = $("horaIni")?.value || "";
    const horaFin = $("horaFin")?.value || "";
    const hora = formatRange(horaIni, horaFin);

    if (!materia) {
      toast("Selecciona una materia.", "warn");
      return;
    }

    if (!docente) {
      toast("Selecciona un docente.", "warn");
      return;
    }

    if (!descripcion) {
      toast("Escribe la descripción.", "warn");
      return;
    }

    if (!fecha || fecha < todayISO()) {
      toast("Selecciona una fecha válida.", "warn");
      return;
    }

    const range = parseRange(hora);
    if (!range) {
      toast("Selecciona una hora válida.", "warn");
      return;
    }

    if (range.fin > MAX_END_MINUTES) {
      toast("La asesoría no puede terminar después de las 16:00.", "warn");
      return;
    }

    if (!Number.isInteger(cupo) || cupo < 1 || cupo > 50) {
      toast("El cupo debe estar entre 1 y 50.", "warn");
      return;
    }

    const payload = {
      materia,
      docente,
      descripcion,
      fecha,
      hora,
      cupo,
      auxiliar: Number(user.numeroControl)
    };

    try {
      if (id) {
        await apiUpdateAsesoria(id, payload);
        toast("Asesoría actualizada correctamente.", "success");
      } else {
        await apiCreateAsesoria(payload);
        toast("Asesoría guardada correctamente.", "success");
      }

      closeModal();
      await render();
    } catch (err) {
      console.error(err);
      toast(err.message || "No se pudo guardar la asesoría.", "error");
    }
  }

  async function openDelete(id, title) {
    const ok = await askConfirm(
      `¿Seguro que deseas eliminar la asesoría "${title}"?`
    );
    if (!ok) return;

    try {
      await apiDeleteAsesoria(id);
      toast("Asesoría eliminada correctamente.", "success");
      await render();
    } catch (err) {
      console.error(err);
      toast(err.message || "No se pudo eliminar la asesoría.", "error");
    }
  }

  function openStudentsModal(id) {
    const modal = $("studentsModal");
    const listContainer = $("studentsList");
    const title = $("studentsModalTitle");

    if (!modal || !listContainer || !title) return;

    const asesoria = ASESORIAS_CACHE.find((a) => String(a.id) === String(id));
    if (!asesoria) {
      toast("No se encontró la asesoría.", "error");
      return;
    }

    title.textContent = `Alumnos Inscritos — ${asesoria.titulo}`;

    const alumnos = Array.isArray(asesoria.alumnos) ? asesoria.alumnos : [];

    if (!alumnos.length) {
      listContainer.innerHTML = `
        <div class="empty-wrap">
          <div class="empty-title">No hay alumnos inscritos</div>
          <div class="empty-sub">Cupo actual: ${asesoria.cupoActual}/${asesoria.cupoTotal}</div>
        </div>
      `;
    } else {
      listContainer.innerHTML = `
        <div class="students-summary">
          <strong>Cupo actual:</strong> ${asesoria.cupoActual}/${asesoria.cupoTotal}
        </div>
        <div class="students-items">
          ${alumnos
            .map((al, index) => {
              const nc = String(
                al.no_control ?? al.numeroControl ?? al.noControl ?? ""
              ).trim();

              const nombre =
                al.nombreCompleto ||
                al.nombre ||
                ALUMNO_MAP.get(nc) ||
                `Alumno ${index + 1}`;

              return `
                <div class="student-item">
                  <strong>${esc(toTitleCase(nombre))}</strong><br>
                  <span>No. Control: ${esc(nc || "—")}</span>
                </div>
              `;
            })
            .join("")}
        </div>
      `;
    }

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
  }

  function closeStudentsModal() {
    const modal = $("studentsModal");
    if (!modal) return;

    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  }

  function wireModalCloseBehavior() {
    const modal = $("modal");
    const studentsModal = $("studentsModal");

    if (modal) {
      modal.addEventListener("mousedown", (e) => {
        if (e.target === modal) closeModal();
      });
    }

    if (studentsModal) {
      studentsModal.addEventListener("mousedown", (e) => {
        if (e.target === studentsModal) closeStudentsModal();
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeModal();
        closeStudentsModal();
      }
    });
  }

  function setupMinDate() {
    const fecha = $("fecha");
    if (!fecha) return;
    fecha.min = todayISO();
  }

  async function init() {
    buildTimeOptions();
    setupMinDate();
    wireFormValidation();
    wireModalCloseBehavior();

    try {
      await Promise.all([apiPersonas(), apiMaterias()]);
    } catch (err) {
      console.error(err);
    }

    await render();
  }

  window.openModal = openModal;
  window.closeModal = closeModal;
  window.saveAsesoria = saveAsesoria;
  window.closeStudentsModal = closeStudentsModal;

  document.addEventListener("DOMContentLoaded", init);
})();