/* =========================================================
   Gestión de Asesorías (Docentes + Materias + Horario limitado)
========================================================= */
(() => {
  "use strict";

  // ---------- Config ----------
  const API = "/backend/asesorias.php";
  const MATERIAS_API = "/backend/materias.php";
  const PERSONAS_API = "http://localhost:8000/backend/personas_api.php";

  const $ = (id) => document.getElementById(id);
  const qs = (s) => document.querySelector(s);
  const esc = (s = "") =>
    String(s).replace(/[&<>"']/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
    );

  // ---------- Utilidades ----------
  const todayISO = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  };

  const parseHHMM = (s) => {
    const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(s || "");
    if (!m) return null;
    const h = +m[1],
      mi = +m[2];
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

  const MAX_MIN = 16 * 60; // 16:00 como máximo (fin)

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

  // ---------- Mini toasts ----------
  function toast(msg, type = "info", ms = 1800) {
    let host = $("nv-mini");
    if (!host) {
      host = document.createElement("div");
      host.id = "nv-mini";
      host.style.cssText =
        "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);" +
        "z-index:99999;display:flex;flex-direction:column;gap:10px;" +
        "align-items:center;pointer-events:none";
      document.body.appendChild(host);
    }
    const card = document.createElement("div");
    card.style.cssText =
      "pointer-events:auto;max-width:520px;color:#fff;border-radius:12px;" +
      "padding:10px 14px;font-weight:700;box-shadow:0 10px 26px rgba(0,0,0,.35)";
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

  // ---------- Fetch helper ----------
  async function jfetch(url, options = {}) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    if (!res.ok || !data || data.ok === false)
      throw new Error((data && data.error) || `HTTP ${res.status}`);
    // si viene {ok:true,data:[...]} regresamos .data
    return data.data != null ? data.data : data;
  }

  // ========================================================
  //   PERSONAS (DOCENTES + ALUMNOS)
  // ========================================================
  let PROFESORES = [];
  let PROF_MAP = {}; // id_Profesor -> nombreCompleto
  let ALUMNOS = [];
  let ALUM_MAP = {}; // no_control -> nombreCompleto

  async function apiProfesores() {
    try {
      const res = await fetch(`${PERSONAS_API}?action=list`);
      const data = await res.json();
      const personas = (data && data.data) ? data.data : [];

      const docentes = [];
      const alumnos = [];

      personas.forEach((p, idx) => {
        const tipo = String(p.tipo || "").toLowerCase();
        const id = String(
          p.numeroControl || p.no_control || p.noControl || idx + 1
        );
        const nombreCompleto = [p.nombre, p.apellidoPaterno, p.apellidoMaterno]
          .filter(Boolean)
          .join(" ")
          .trim();

        if (tipo === "docente") {
          docentes.push({ id_Profesor: id, nombreCompleto });
          if (id) PROF_MAP[id] = nombreCompleto;
        } else if (tipo === "alumno" || tipo === "estudiante") {
          alumnos.push({ no_control: id, nombreCompleto });
          if (id) ALUM_MAP[id] = nombreCompleto;
        }
      });

      docentes.sort((a, b) =>
        String(a.nombreCompleto).localeCompare(String(b.nombreCompleto), "es", {
          sensitivity: "base",
        })
      );

      ALUMNOS = alumnos;

      return docentes;
    } catch (e) {
      console.error("Error cargando personas desde PERSONAS_API", e);
      return [];
    }
  }

  async function loadProfesores() {
    PROFESORES = await apiProfesores();
    // PROF_MAP y ALUM_MAP ya se cargan dentro de apiProfesores()
  }

  // ========================================================
  //   API ASESORÍAS
  // ========================================================

  async function apiList() {
    const arr = await jfetch(API);
    return (arr || []).map((x) => {
      const id_profe = String(x.id_profesor || x.id_Profesor || "");
      const backendName = x.docenteNombre || x.docente || "";
      const docenteNombre = backendName || PROF_MAP[id_profe] || "";

      const auxiliarNombre =
        x.auxiliarNombre || x.auxiliar || docenteNombre || "";

      return {
        id: String(x.id),
        titulo: x.titulo,
        id_profesor: id_profe,
        docenteNombre,
        auxiliarNombre,
        descripcion: x.descripcion || "",
        fecha: x.fecha,
        hora: x.hora,
        cupoTotal: Number(x.cupo_total ?? x.cupoTotal ?? x.cupo ?? 0),
        cupoActual: Number(x.cupo_actual ?? x.cupoActual ?? 0),
        status: statusFrom(x.fecha, x.hora),
      };
    });
  }

  async function apiCreate(p) {
    await jfetch(API, { method: "POST", body: JSON.stringify(p) });
  }
  async function apiUpdate(p) {
    await jfetch(API, { method: "PUT", body: JSON.stringify(p) });
  }
  async function apiDelete(id) {
    await jfetch(`${API}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  // ---------- API Materias ----------
  async function apiMaterias() {
    const res = await fetch(MATERIAS_API, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data
      .filter((m) => m.id_Estado == null || Number(m.id_Estado) === 1)
      .map((m) => ({
        id: Number(m.id_Materia ?? m.id ?? 0),
        nombre: String(m.materia ?? m.nombre ?? "").trim(),
      }))
      .filter((m) => m.nombre.length);
  }

  // ========================================================
  //   Render listado
  // ========================================================

  async function render() {
    try {
      const list = await apiList();
      renderList(list);
    } catch (e) {
      console.error(e);
      renderList([]);
      toast("No se pudo cargar la lista.", "error");
    }
  }

  function renderList(list) {
    const cont = $("asesoriasContainer");
    if (!cont) return;

    if (!list.length) {
      cont.innerHTML = `
        <div class="empty-wrap">
          <div class="empty-icon" aria-hidden="true">📚</div>
          <div class="empty-title">No hay asesorías</div>
          <div class="empty-sub">Crea una nueva asesoría con el botón de arriba.</div>
        </div>`;
      return;
    }

    const ordered = [...list].sort((a, b) => {
      const score = (s) =>
        s.status === "En curso" ? 0 : s.status === "Pendiente" ? 1 : 2;
      const ra = score(a),
        rb = score(b);
      if (ra !== rb) return ra - rb;
      if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
      return a.titulo.localeCompare(b.titulo);
    });

    cont.innerHTML = ordered
      .map((s) => {
        const badge =
          s.status === "En curso"
            ? "status-en-curso"
            : s.status === "Pendiente"
            ? "status-pendiente"
            : "status-finalizada";
        return `
        <div class="asesoria-card" data-id="${s.id}">
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
            </p>
            <div class="status-wrapper">
              <span class="status-badge ${badge}">${s.status.toUpperCase()}</span>
            </div>
          </div>
          <div class="card-actions">
            <button class="btn-edit"   data-act="edit"   data-id="${s.id}">✏️ Editar</button>
            <button class="btn-view"
                    data-act="view"
                    data-id="${s.id}"
                    data-title="${esc(s.titulo)}"
                    data-cupo-actual="${s.cupoActual}"
                    data-cupo-total="${s.cupoTotal}">
              👁️ Ver inscritos
            </button>
            <button class="btn-delete"
                    data-act="delete"
                    data-id="${s.id}"
                    data-title="${esc(s.titulo)}">
              🗑️ Eliminar
            </button>
          </div>
        </div>`;
      })
      .join("");

    cont
      .querySelectorAll("[data-act='edit']")
      .forEach((b) => (b.onclick = () => openEditModal(b.dataset.id)));
    cont
      .querySelectorAll("[data-act='delete']")
      .forEach(
        (b) => (b.onclick = () => openDelete(b.dataset.id, b.dataset.title))
      );
    cont
      .querySelectorAll("[data-act='view']")
      .forEach((b) => {
        b.onclick = () =>
          openStudentsModal(
            b.dataset.id,
            b.dataset.title,
            Number(b.dataset.cupoActual),
            Number(b.dataset.cupoTotal)
          );
      });
  }

  // ========================================================
  //   Docentes / Materias (selects del modal)
  // ========================================================

  async function fillDocentes(selected = null) {
    const sel = $("docente");
    if (!sel) return;
    sel.disabled = true;
    sel.innerHTML = `<option value="">Cargando…</option>`;
    try {
      const list = PROFESORES.length ? PROFESORES : await apiProfesores();
      sel.innerHTML =
        `<option value="">— Selecciona —</option>` +
        list
          .map(
            (p) =>
              `<option value="${esc(p.id_Profesor)}">${esc(
                p.nombreCompleto
              )}</option>`
          )
          .join("");
      if (selected) sel.value = String(selected);
    } catch (e) {
      console.error(e);
      sel.innerHTML = `<option value="">(Sin docentes)</option>`;
    } finally {
      sel.disabled = false;
    }
  }

  async function fillMaterias(selectedText = null) {
    const sel = $("materia");
    if (!sel) return;
    sel.disabled = true;
    sel.innerHTML = `<option value="">Cargando…</option>`;
    try {
      const list = await apiMaterias();
      sel.innerHTML =
        `<option value="">— Selecciona materia —</option>` +
        list
          .map(
            (m) =>
              `<option value="${esc(m.nombre)}">${esc(m.nombre)}</option>`
          )
          .join("");
      if (selectedText) sel.value = selectedText;
    } catch {
      sel.innerHTML = `<option value="">(Sin materias)</option>`;
    } finally {
      sel.disabled = false;
    }
  }

  // ========================================================
  //   Validación de formulario
  // ========================================================

  function isFormValid() {
    const materiaSel = $("materia");
    const titulo = materiaSel
      ? (materiaSel.value || "").trim()
      : (($("titulo")?.value) || "").trim();
    const idProf = ($("docente")?.value || "").trim();
    const desc = ($("descripcion")?.value || "").trim();
    const fecha = ($("fecha")?.value || "").trim();

    let horaTxt = "";
    if ($("horaIni") && $("horaFin")) {
      const ini = $("horaIni").value;
      const fin = $("horaFin").value;
      horaTxt = `${ini} - ${fin}`;
    } else if ($("hora")) {
      horaTxt = ($("hora").value || "").trim();
    }

    const rango = parseRangoTxt(horaTxt);
    const cupo = parseInt(($("cupo")?.value || "").trim(), 10);

    const fechaOk = fecha && fecha >= todayISO();
    const rangoOk = !!rango && rango.fin <= MAX_MIN;
    const cupoOk = Number.isInteger(cupo) && cupo >= 1 && cupo <= 50;

    return !!(titulo && idProf && desc && fechaOk && rangoOk && cupoOk);
  }

  function updateButtonsState() {
    const form = qs(".modal-form");
    if (!form) return;
    const btnGuardar = form.querySelector("[type='submit']");
    const btnCancelar = form.querySelector(".btn-cancel");
    const ok = isFormValid();

    [btnGuardar, btnCancelar].forEach((btn) => {
      if (!btn) return;
      btn.disabled = !ok;
      btn.classList.toggle("btn-disabled", !ok);
    });
  }

  function wireFormValidation() {
    const ids = [
      "materia",
      "titulo",
      "docente",
      "descripcion",
      "fecha",
      "horaIni",
      "horaFin",
      "hora",
      "cupo",
    ];
    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", updateButtonsState);
      el.addEventListener("change", updateButtonsState);
    });
  }

  // ========================================================
  //   Horario
  // ========================================================

  let timeBuilt = false;
  function buildTimeOptions() {
    const ini = $("horaIni"),
      fin = $("horaFin");
    if (!ini || !fin || timeBuilt) return;
    timeBuilt = true;
    const parts = [];
    for (let m = 7 * 60; m <= MAX_MIN; m += 30) {
      const h = String(Math.floor(m / 60)).padStart(2, "0");
      const mi = String(m % 60).padStart(2, "0");
      parts.push(`${h}:${mi}`);
    }
    ini.innerHTML = parts
      .slice(0, -1)
      .map((v) => `<option value="${v}">${v}</option>`)
      .join("");
    fin.innerHTML = parts
      .map((v) => `<option value="${v}">${v}</option>`)
      .join("");

    ini.addEventListener("change", () => {
      const start = parseHHMM(ini.value) || 0;
      [...fin.options].forEach((o) => {
        o.disabled = parseHHMM(o.value) <= start;
      });
      if (parseHHMM(fin.value) <= start)
        fin.value = parts.find((v) => parseHHMM(v) > start) || "16:00";
      updateButtonsState();
    });

    fin.addEventListener("change", () => {
      if (parseHHMM(fin.value) > MAX_MIN) {
        fin.value = "16:00";
      }
      updateButtonsState();
    });

    ini.value = "14:00";
    fin.value = "16:00";
    ini.dispatchEvent(new Event("change"));
  }

  // ========================================================
  //   Modal crear / editar
  // ========================================================

  function openModalEmpty() {
    $("modalTitle").textContent = "Crear Nueva Asesoría";
    $("asesoriaId").value = "";
    const txtTitulo = $("titulo");
    if (txtTitulo) txtTitulo.value = "";
    const selMateria = $("materia");
    if (selMateria) selMateria.value = "";
    $("descripcion").value = "";
    $("fecha").value = "";
    if ($("horaIni") && $("horaFin")) {
      $("horaIni").value = "14:00";
      $("horaFin").value = "16:00";
    } else if ($("hora")) {
      $("hora").value = "14:00 - 16:00";
    }
    $("cupo").value = "";
    const m = $("modal");
    if (!m) return;
    m.style.display = "flex";
    m.setAttribute("aria-hidden", "false");
    updateButtonsState();
  }

  function closeModal() {
    const m = $("modal");
    if (!m) return;
    m.style.display = "none";
    m.setAttribute("aria-hidden", "true");
  }

  function wireModalClose() {
    const m = $("modal");
    if (!m) return;
    m.addEventListener("mousedown", (e) => {
      if (e.target === m) closeModal();
    });
    document.addEventListener("click", (e) => {
      const el = e.target;
      if (el.closest(".modal-close") || el.closest(".btn-cancel")) {
        e.preventDefault();
        closeModal();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (getComputedStyle(m).display !== "none") closeModal();
      }
    });
  }

  // ---------- Guardar ----------
  async function save(ev) {
    ev.preventDefault();

    const id = $("asesoriaId").value.trim();
    const materiaSel = $("materia");
    const titulo = materiaSel
      ? (materiaSel.value || "").trim()
      : (($("titulo")?.value) || "").trim();
    const idProf = $("docente").value.trim();
    const desc = $("descripcion").value.trim();
    const fecha = $("fecha").value;

    let horaTxt = "";
    if ($("horaIni") && $("horaFin")) {
      const ini = $("horaIni").value;
      const fin = $("horaFin").value;
      horaTxt = `${ini} - ${fin}`;
    } else {
      horaTxt = ($("hora")?.value || "").trim();
    }

    const cupo = parseInt($("cupo").value, 10);

    if (!titulo) {
      toast("Selecciona la materia (título).", "error");
      return;
    }
    if (!idProf || !desc) {
      toast("Completa docente y descripción.", "error");
      return;
    }
    if (!fecha || fecha < todayISO()) {
      toast("Selecciona una fecha válida (hoy o futuro).", "error");
      $("fecha").min = todayISO();
      return;
    }

    const rango = parseRangoTxt(horaTxt);
    if (!rango) {
      toast("Hora inválida. Usa HH:MM - HH:MM (fin > inicio).", "error");
      return;
    }
    if (rango.fin > MAX_MIN) {
      toast("No se aceptan asesorías después de las 16:00.", "error");
      return;
    }
    if (!(Number.isInteger(cupo) && cupo >= 1 && cupo <= 50)) {
      toast("Cupo total 1..50.", "error");
      return;
    }

    const payload = {
      id: id || undefined,
      titulo,
      id_profesor: Number(idProf),
      descripcion: desc,
      fecha,
      hora: horaTxt,
      cupoTotal: cupo,
      cupoActual: 0,
      auxiliar: 0,
    };

    try {
      if (id) await apiUpdate(payload);
      else await apiCreate(payload);
      toast("Asesoría guardada.", "success");
      closeModal();
      render();
    } catch (e) {
      toast(e.message || "No se pudo guardar.", "error");
    }
  }

  // ---------- Editar ----------
  async function openEditModal(id) {
    try {
      const list = await apiList();
      const s = list.find((x) => x.id === String(id));
      if (!s) return;

      await Promise.all([
        fillDocentes(s.id_profesor),
        fillMaterias(s.titulo),
      ]);

      $("modalTitle").textContent = "Editar Asesoría";
      $("asesoriaId").value = s.id;

      if ($("materia")) $("materia").value = s.titulo;
      if ($("titulo")) $("titulo").value = s.titulo;

      $("descripcion").value = s.descripcion;
      $("fecha").value = s.fecha;

      if ($("horaIni") && $("horaFin")) {
        const r = parseRangoTxt(s.hora);
        if (r) {
          const hh = (m) =>
            `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(
              m % 60
            ).padStart(2, "0")}`;
          $("horaIni").value = hh(r.ini);
          $("horaFin").value = hh(r.fin);
          $("horaIni").dispatchEvent(new Event("change"));
        }
      } else if ($("hora")) {
        $("hora").value = s.hora;
      }

      $("cupo").value = s.cupoTotal;

      const m = $("modal");
      m.style.display = "flex";
      m.setAttribute("aria-hidden", "false");
      updateButtonsState();
    } catch {
      toast("No se pudo abrir la edición.", "error");
    }
  }
  window.openEditModal = openEditModal;

  // ---------- Eliminar ----------
  async function openDelete(id, title) {
    if (!confirm(`¿Seguro que deseas eliminar la asesoría "${title}"?`)) return;
    try {
      await apiDelete(id);
      toast("Eliminada.", "success");
      render();
    } catch {
      toast("No se pudo eliminar.", "error");
    }
  }
  window.openDeleteModal = openDelete;

  // ========================================================
  //   Ver alumnos inscritos
  // ========================================================

  async function openStudentsModal(idAsesoria, titulo = "", cupoActual = 0, cupoTotal = 0) {
    const m = $("studentsModal");
    const title = $("studentsModalTitle");
    const listNode = $("studentsList");

    if (!m || !title || !listNode) {
      console.warn("Modal de alumnos no encontrado en el HTML.");
      return;
    }

    title.textContent = titulo
      ? `Alumnos inscritos – ${titulo}`
      : "Alumnos inscritos";

    listNode.innerHTML =
      `<div class="student-item"><div>Cargando lista…</div></div>`;
    m.style.display = "flex";
    m.setAttribute("aria-hidden", "false");

    try {
      const data = await jfetch(
        `${API}?action=inscritos&id_asesoria=${encodeURIComponent(idAsesoria)}`
      );
      const rows = Array.isArray(data) ? data : [];

      if (!rows.length) {
        title.textContent = titulo
          ? `Alumnos inscritos – ${titulo} (0/${cupoTotal || "?"})`
          : `Alumnos inscritos (0/${cupoTotal || "?"})`;
        listNode.innerHTML =
          `<div class="student-item"><div>Sin alumnos inscritos todavía.</div></div>`;
        return;
      }

      const inscritos = rows.length;
      const totalStr = cupoTotal ? ` / ${cupoTotal}` : "";
      const llenoStr =
        cupoTotal && inscritos >= cupoTotal ? " – CUPO LLENO" : "";

      title.textContent = titulo
        ? `Alumnos inscritos – ${titulo} (${inscritos}${totalStr})${llenoStr}`
        : `Alumnos inscritos (${inscritos}${totalStr})${llenoStr}`;

      listNode.innerHTML = rows
        .map((alum) => {
          const nc =
            alum.no_control ||
            alum.noControl ||
            alum.numeroControl ||
            alum.nocontrol ||
            "—";

          const baseNombre =
            alum.nombreCompleto || alum.nombre || alum.nombre_alumno || "";
          const apP =
            alum.apellidoPaterno || alum.apellido_paterno || alum.apellido || "";
          const apM =
            alum.apellidoMaterno || alum.apellido_materno || "";

          let nombreFull = [baseNombre, apP, apM]
            .filter(Boolean)
            .join(" ")
            .trim();

          let nombre = nombreFull || baseNombre || "—";

          // 🔴 AQUÍ forzamos el nombre COMPLETO usando PERSONAS_API si existe
          const idAlumno = String(nc);
          if (ALUM_MAP[idAlumno]) {
            nombre = ALUM_MAP[idAlumno]; // nombre completo desde personas_api
          }

          const correo = alum.correo || alum.email || alum.correoInstitucional || "";

          return `
          <div class="student-item">
            <div class="student-main">
              <strong>${esc(nombre)}</strong>
              <span class="student-nc">(${esc(nc)})</span>
            </div>
            ${
              correo
                ? `<div class="student-mail">${esc(correo)}</div>`
                : ""
            }
          </div>`;
        })
        .join("");
    } catch (e) {
      console.error(e);
      listNode.innerHTML = `
        <div class="student-item">
          <div>Error al cargar la lista de alumnos inscritos.</div>
        </div>`;
    }

    m.onclick = (e) => {
      if (e.target === m) closeStudentsModal();
    };
  }
  window.openStudentsModal = openStudentsModal;

  function closeStudentsModal() {
    const m = $("studentsModal");
    if (!m) return;
    m.style.display = "none";
    m.setAttribute("aria-hidden", "true");
  }
  window.closeStudentsModal = closeStudentsModal;

  // ========================================================
  //   Abrir modal crear
  // ========================================================

  window.openModal = async function () {
    await Promise.all([fillDocentes(), fillMaterias()]);
    buildTimeOptions();
    openModalEmpty();
  };

  // ========================================================
  //   Init
  // ========================================================

  document.addEventListener("DOMContentLoaded", async () => {
    await loadProfesores(); // carga docentes y alumnos (PROF_MAP y ALUM_MAP)
    render();

    if ($("fecha")) $("fecha").min = todayISO();
    const form = qs(".modal-form");
    if (form) form.addEventListener("submit", save);
    wireModalClose();
    buildTimeOptions();
    wireFormValidation();
    updateButtonsState();
  });
})();
