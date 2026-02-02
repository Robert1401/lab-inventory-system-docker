/* ========================================================= 
   Solicitud de Materiales (Alumnos)
   - Usa catálogo de /backend/agregar-materiales.php
     y window.Materiales.lista para:
       * id_Material
       * nombre
       * clave
       * max_por_alumno (límite por alumno)
   - Stock disponible:
       * Suma de compras en LE_compras + LE_compra_detalle,
         agrupado por id_Material
       * MENOS piezas dañadas:
           - LE_danios
           - LE_movimientos con tipo "Daño" / "Baja por daño"
   - Máximo que puede pedir el alumno:
       * Si hay límite por alumno y stock:
           maxEfectivo = min(max_por_alumno, stockDisponible - yaEnTabla)
       * Si sólo hay stock:
           maxEfectivo = stockDisponible - yaEnTabla
       * Si sólo hay límite:
           maxEfectivo = max_por_alumno
       * Si no hay stock → no permite pedir.
========================================================= */
(function () {
  "use strict";

  // ---------- ENDPOINTS ----------
  const USUARIOS_API     = "/backend/usuarios.php";
  const MATERIAS_API     = "/backend/materias.php";
  const MATERIALES_API   = "/backend/agregar-materiales.php";
  const CONFIRMACION_URL = "confirmacion.html";

  const MESAS_TOTALES = 12;

  // ---------- Helpers básicos ----------
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const norm = (s) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  const clean = (v) => (v == null ? "" : String(v).trim());

  const fullName = (p) =>
    [
      p?.nombre,
      p?.apellidoP || p?.apellido_p || p?.apP,
      p?.apellidoM || p?.apellido_m || p?.apM,
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

  function readLS(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  }
  function writeLS(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function nowParts() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return { yyyy, mm, dd, hh, mi, ss };
  }

  // ---------- Toast centrado ----------
  function toast(msg, kind = "info") {
    const el = $("#toastCenter");
    if (!el) {
      alert(msg);
      return;
    }
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
    setTimeout(() => el.classList.remove("show"), 1600);
  }

  // ---------- fetch JSON ----------
  async function fetchJSON(url, options = {}) {
    try {
      const resp = await fetch(url, options);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (err) {
      console.error("fetchJSON error", url, err);
      return null;
    }
  }

  /* =========================================================
     FECHA / HORA / FOLIO
  ========================================================== */
  function setFechaHoraHoy() {
    const { yyyy, mm, dd, hh, mi } = nowParts();
    const inpFecha = $("#fecha");
    const inpHora  = $("#hora");

    if (inpFecha) {
      const today = `${yyyy}-${mm}-${dd}`;
      inpFecha.value = today;
      inpFecha.min = today;
      inpFecha.max = today;
      inpFecha.addEventListener("change", () => {
        inpFecha.value = today;
        toast("La fecha solo puede ser la de HOY.", "warn");
      });
    }
    if (inpHora) inpHora.value = `${hh}:${mi}`;
  }

  function nextVale() {
    const { yyyy, mm, dd } = nowParts();
    const key = `LE_vale_seq_${yyyy}${mm}${dd}`;
    let seq = Number(readLS(key)) || 0;
    seq += 1;
    writeLS(key, seq);
    return `VALE-${seq}`;
  }

  function setFolio() {
    const inp = $("#folio");
    if (inp) inp.value = nextVale();
  }

  function setAlumnoYCarrera() {
    const a = $("#alumno");
    const c = $("#carrera");
    if (a) a.value = "Mariana Mota Piña";
    if (c) c.value = "Ingeniería en Sistemas Computacionales";
  }

  /* =========================================================
     CARGA SELECTS (Auxiliar / Docente / Materia / Mesa)
  ========================================================== */

  async function getUsuarios() {
    const pools = [];

    let backend = await fetchJSON(`${USUARIOS_API}?accion=listar`);
    if (!backend) backend = await fetchJSON(USUARIOS_API);

    if (backend) {
      if (Array.isArray(backend)) pools.push(backend);
      else if (Array.isArray(backend.data)) pools.push(backend.data);
      else if (Array.isArray(backend.usuarios)) pools.push(backend.usuarios);
      else if (Array.isArray(backend.usuariosData)) pools.push(backend.usuariosData);
    }

    if (Array.isArray(window.Usuarios?.lista)) pools.push(window.Usuarios.lista);
    if (Array.isArray(window.USUARIOS)) pools.push(window.USUARIOS);
    if (Array.isArray(window.usuarios)) pools.push(window.usuarios);
    if (Array.isArray(window.personas)) pools.push(window.personas);

    if (typeof window.Usuarios?.getAll === "function") {
      try {
        const a = await window.Usuarios.getAll();
        if (Array.isArray(a)) pools.push(a);
      } catch {}
    }
    if (typeof window.Usuarios?.listar === "function") {
      try {
        const a = await window.Usuarios.listar();
        if (Array.isArray(a)) pools.push(a);
      } catch {}
    }

    const ls1 = readLS("LE_usuarios");
    if (Array.isArray(ls1)) pools.push(ls1);
    const ls2 = readLS("LE_personas");
    if (Array.isArray(ls2)) pools.push(ls2);
    const ls3 = readLS("usuarios");
    if (Array.isArray(ls3)) pools.push(ls3);

    const out = [];
    const seen = new Set();

    for (const arr of pools) {
      for (const it of arr || []) {
        const o = typeof it === "object" && it ? it : {};
        const id = Number(
          o.id ?? o.idPersona ?? o.id_persona ?? o.clave ?? o.no_control ?? o.matricula
        );
        const nombre = o.nombre ?? o.Name ?? o.nombres ?? "";
        const apP = o.apellidoP ?? o.apellido_p ?? o.paterno ?? "";
        const apM = o.apellidoM ?? o.apellido_m ?? o.materno ?? "";
        const rol =
          o.rol ?? o.rolUsuario ?? o.rol_usuario ?? o.perfil ?? o.tipo ?? o.tipoUsuario ?? "";
        const k = `${id}|${nombre}|${apP}|${apM}|${rol}`;
        if (!seen.has(k)) {
          seen.add(k);
          out.push({ id, nombre, apP, apM, rol, _raw: o });
        }
      }
    }
    return out;
  }

  async function loadAuxiliaresSelect() {
    const sel = $("#auxiliar");
    if (!sel) return;
    const usuarios = await getUsuarios();

    let auxs = usuarios.filter((u) => norm(u.rol).includes("auxiliar"));
    if (!auxs.length) auxs = usuarios.slice();

    sel.innerHTML = `<option value="">Seleccione auxiliar…</option>`;
    auxs
      .sort((a, b) =>
        fullName(a).localeCompare(fullName(b), "es", { sensitivity: "base" })
      )
      .forEach((u) => {
        const name = fullName(u);
        if (!name) return;
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
      });

    sel.value = "";
  }

  async function loadDocentesSelect() {
    const sel = $("#docente");
    if (!sel) return;
    const usuarios = await getUsuarios();

    let docs = usuarios.filter((u) => {
      const r = norm(u.rol);
      return (
        r.includes("docente") ||
        r.includes("maestro") ||
        r.includes("profesor") ||
        r.includes("prof") ||
        r.includes("teacher")
      );
    });
    if (!docs.length) docs = usuarios.slice();

    sel.innerHTML = `<option value="">Seleccione docente…</option>`;
    docs
      .sort((a, b) =>
        fullName(a).localeCompare(fullName(b), "es", { sensitivity: "base" })
      )
      .forEach((u) => {
        const name = fullName(u);
        if (!name) return;
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
      });

    sel.value = "";
  }

  async function loadMateriasSelect() {
    const sel = $("#materiaAcad");
    if (!sel) return;
    const pools = [];

    let backend = await fetchJSON(`${MATERIAS_API}?accion=listar`);
    if (!backend) backend = await fetchJSON(MATERIAS_API);

    if (backend) {
      if (Array.isArray(backend)) pools.push(backend);
      else if (Array.isArray(backend.data)) pools.push(backend.data);
      else if (Array.isArray(backend.materias)) pools.push(backend.materias);
    }

    const lsMat = readLS("LE_materias");
    if (Array.isArray(lsMat)) pools.push(lsMat);
    if (Array.isArray(window.Materias?.lista)) pools.push(window.Materias.lista);
    if (Array.isArray(window.MATERIAS)) pools.push(window.MATERIAS);
    if (Array.isArray(window.materias)) pools.push(window.materias);
    if (Array.isArray(window.MATERIAS_DATA)) pools.push(window.MATERIAS_DATA);

    const map = new Map();

    for (const arr of pools) {
      for (const it of arr || []) {
        const o = typeof it === "object" && it ? it : {};
        const nombre =
          o.nombre ?? o.Nombre ?? o.descripcion ?? o.Descripcion ?? o.materia ?? o.Materia ?? "";
        if (!nombre) continue;
        const key = norm(nombre);
        if (!map.has(key)) map.set(key, clean(nombre));
      }
    }

    sel.innerHTML = `<option value="">Seleccione materia…</option>`;
    Array.from(map.values())
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))
      .forEach((name) => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
      });

    sel.value = "";
  }

  function loadMesasSelect() {
    const sel = $("#mesa");
    if (!sel) return;
    sel.innerHTML = `<option value="">Seleccione mesa…</option>`;
    for (let i = 1; i <= MESAS_TOTALES; i++) {
      const v = `M${i}`;
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    }
    sel.value = "";
  }

  /* ========================================================
     STOCK desde compras (LE_compras + LE_compra_detalle)
     - Regresa Map id_Material -> cantidadTotal
     - Suma bien las compras
     - Resta piezas dañadas evitando doble conteo:
         * LE_danios
         * LE_movimientos con tipo "Daño" / "Baja por daño"
  ========================================================= */
  function buildStockById() {
    const stock = new Map();

    const add = (id, cant) => {
      const k = String(id || "").trim();
      const n = Number(cant);
      if (!k || !Number.isFinite(n) || n <= 0) return;
      stock.set(k, (stock.get(k) || 0) + n);
    };

    const sub = (id, cant) => {
      const k = String(id || "").trim();
      const n = Number(cant);
      if (!k || !Number.isFinite(n) || n <= 0) return;
      const cur = stock.get(k) || 0;
      const next = cur - n;
      stock.set(k, next > 0 ? next : 0);
    };

    // 1) SUMAR COMPRAS
    try {
      const compras = JSON.parse(localStorage.getItem("LE_compras") || "[]");
      if (Array.isArray(compras)) {
        for (const c of compras) {
          for (const it of c.items || []) {
            const id = it.id_Material ?? it.id ?? it.material_id;
            const cant =
              it.cantidad ?? it.qty ?? it.unidades ?? it.piezas ?? it.Cantidad ?? 0;
            add(id, cant);
          }
        }
      }
    } catch {}

    try {
      const det = JSON.parse(localStorage.getItem("LE_compra_detalle") || "[]");
      if (Array.isArray(det)) {
        for (const r of det) {
          const id =
            r.id_Material ?? r.id_material ?? r.material_id ?? r.id ?? r.ID;
          const cant =
            r.cantidad ?? r.qty ?? r.unidades ?? r.piezas ?? r.Cantidad ?? 0;
          add(id, cant);
        }
      }
    } catch {}

    // 2) REUNIR TODOS LOS DAÑOS
    const damageEntries = [];

    // 2.a) LE_danios
    try {
      const danios = JSON.parse(localStorage.getItem("LE_danios") || "[]");
      if (Array.isArray(danios)) {
        for (const d of danios) {
          const id =
            d.id_Material ?? d.id_material ?? d.material_id ?? d.id ?? d.ID;
          const cant =
            d.cantidad ?? d.qty ?? d.unidades ?? d.piezas ?? d.Cantidad ?? 0;
          const folio = d.folio || d.id_prestamo || d.noVale || "";
          damageEntries.push({ id, cant, folio });
        }
      }
    } catch {}

    // 2.b) LE_movimientos tipo "Daño" / "Baja por daño"
    const normLocal = (s) =>
      (s || "")
        .toString()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .trim();

    try {
      const movs = JSON.parse(localStorage.getItem("LE_movimientos") || "[]");
      if (Array.isArray(movs)) {
        for (const r of movs) {
          const tipoRaw =
            r.tipo_movimiento ?? r.tipo ?? r.movimiento ?? r.mov ?? "";
          const tipo = normLocal(tipoRaw);

          if (
            !tipo.includes("dano") && // "daño" -> "dano"
            !tipo.includes("baja dano") &&
            !tipo.includes("baja por dano")
          ) {
            continue;
          }

          const id =
            r.id_Material ?? r.id_material ?? r.material_id ?? r.id ?? r.ID;
          const cant =
            r.cantidad ?? r.qty ?? r.unidades ?? r.piezas ?? r.Cantidad ?? 0;
          const folio = r.folio || r.id_prestamo || r.noVale || "";
          damageEntries.push({ id, cant, folio });
        }
      }
    } catch {}

    // 3) RESTAR DAÑOS SIN DUPLICAR
    const seen = new Set();

    for (const d of damageEntries) {
      const idStr = String(d.id || "").trim();
      const cantNum = Number(d.cant) || 0;
      const folio = d.folio || "";
      if (!idStr || cantNum <= 0) continue;

      const key = `${idStr}|${cantNum}|${folio}`;
      if (seen.has(key)) continue;
      seen.add(key);

      sub(idStr, cantNum);
    }

    return stock;
  }

  /* =========================================================
     CATÁLOGO DE MATERIALES (de agregar-materiales)
     - id_Material, nombre, clave, max_por_alumno, disponible
  ========================================================== */
  const Catalog = {
    list: [],            // [{id, nombre, clave, maxAlumno, disponible}]
    mapMax: new Map(),   // norm(nombre) -> maxAlumno
    mapItem: new Map(),  // norm(nombre) -> item

    async sync() {
      const pools = [];

      // 1) Backend principal
      let backendArr = [];
      const api = await fetchJSON(MATERIALES_API);
      if (api) {
        backendArr = Array.isArray(api.data)
          ? api.data
          : Array.isArray(api)
          ? api
          : [];
        if (backendArr.length) pools.push(backendArr);
      }

      // 2) Datos publicados por agregar-materiales.js
      if (Array.isArray(window.Materiales?.lista)) pools.push(window.Materiales.lista);
      if (Array.isArray(window.MATERIAL_CATALOGO)) pools.push(window.MATERIAL_CATALOGO);

      // 3) LocalStorage como respaldo
      const ls1 = readLS("LE_MATERIALES_LOCAL");
      if (Array.isArray(ls1)) pools.push(ls1);
      const ls2 = readLS("LE_materiales");
      if (Array.isArray(ls2)) pools.push(ls2);

      const map = new Map(); // norm(nombre) -> {id, nombre, clave, maxAlumno}

      for (const arr of pools) {
        for (const it of arr || []) {
          const o = typeof it === "object" && it ? it : {};

          const id =
            o.id_Material ?? o.id ?? o.ID ?? o.id_material ?? o.Id ?? null;

          const nombre =
            o.nombre ?? o.Nombre ?? o.descripcion ?? o.material ?? o.Material ?? "";
          if (!nombre) continue;

          const clave = clean(o.clave ?? o.Clave ?? "");

          const rawMax = Number(
            o.max_por_alumno ??
              o.maxAlumno ??
              o.max_alumno ??
              o.max_prestamo ??
              o.maxAlumnoPiezas ??
              o.maxPorAlumno ??
              0
          );
          const max = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 0;

          const key = norm(nombre);

          if (!map.has(key)) {
            map.set(key, {
              id: id != null ? String(id) : "",
              nombre: clean(nombre),
              clave,
              maxAlumno: max, // 0 = sin límite por alumno
              disponible: 0,
            });
          } else {
            const cur = map.get(key);
            if (!cur.id && id != null) cur.id = String(id);
            if (!cur.clave && clave) cur.clave = clave;
            if (cur.maxAlumno === 0 && max > 0) cur.maxAlumno = max;
          }
        }
      }

      // stock ya con daños restados
      const stockById = buildStockById();
      const list = Array.from(map.values()).map((m) => {
        const disp = m.id ? stockById.get(m.id) || 0 : 0;
        m.disponible = Number.isFinite(disp) && disp > 0 ? disp : 0;
        return m;
      });

      list.sort((a, b) =>
        a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
      );

      this.list = list;
      this.mapMax.clear();
      this.mapItem.clear();

      list.forEach((m) => {
        const k = norm(m.nombre);
        this.mapMax.set(k, m.maxAlumno);
        this.mapItem.set(k, m);
      });
    },

    getMaxForName(name) {
      const key = norm(name || "");
      if (!key) return 0;
      const v = this.mapMax.get(key);
      return Number.isFinite(v) && v > 0 ? v : 0;
    },

    getItemByName(name) {
      const key = norm(name || "");
      if (!key) return null;
      return this.mapItem.get(key) || null;
    },
  };

  /* =========================================================
     ESTADO + VALIDACIONES
  ========================================================== */
  const state = {
    items: [], // {material, cantidad, fechaIngreso}
  };

  // --- NUEVO: validar que todos los campos de encabezado estén llenos ---
  function metaFieldsComplete() {
    const ids = [
      "fecha",
      "hora",
      "folio",
      "alumno",
      "carrera",
      "auxiliar",
      "docente",
      "materiaAcad",
      "mesa",
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

  function requestedSoFar(materialName) {
    const key = norm(materialName);
    let total = 0;
    for (const it of state.items) {
      if (norm(it.material) === key) {
        total += Number(it.cantidad) || 0;
      }
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

    if (maxAlumno > 0 && stockRestante > 0) {
      maxFinal = Math.min(maxAlumno, stockRestante);
    } else if (maxAlumno > 0 && stockRestante <= 0) {
      maxFinal = 0;
    } else if (maxAlumno === 0 && stockRestante > 0) {
      maxFinal = stockRestante;
    } else {
      maxFinal = 0;
    }

    return {
      maxAlumno,
      stockTotal,
      stockRestante,
      maxFinal,
    };
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
     FINDER de materiales (usa Catalog.list)
  ========================================================== */
  const Finder = {
    input: null,
    hidden: null,
    list: null,
    activeIndex: -1,

    init() {
      this.input  = $("#materialSearch");
      this.hidden = $("#material");
      this.list   = $("#finderList");
      this.activeIndex = -1;

      if (!this.input || !this.list) return;

      this.input.addEventListener("focus", () => this.render(""));
      this.input.addEventListener("input", () => this.render(this.input.value));
      this.input.addEventListener("keydown", (e) => this.onKey(e));

      document.addEventListener("click", (e) => {
        if (!this.list.contains(e.target) && e.target !== this.input) this.hide();
      });
    },

    hide() {
      this.list.classList.add("hidden");
      this.list.innerHTML = "";
      this.activeIndex = -1;
      this.input.setAttribute("aria-expanded", "false");
    },

    highlight(name, q) {
      if (!q) return esc(name);
      const src = name.normalize("NFD").toLowerCase();
      const needle = q.normalize("NFD").toLowerCase();
      const i = src.indexOf(needle);
      if (i < 0) return esc(name);
      return (
        esc(name.slice(0, i)) +
        `<span class="fi-hl">${esc(name.slice(i, i + q.length))}</span>` +
        esc(name.slice(i + q.length))
      );
    },

    filterList(q) {
      if (!q) return Catalog.list;
      const needle = norm(q);
      return Catalog.list.filter((m) => norm(m.nombre).includes(needle));
    },

    render(query) {
      const q = (query || "").trim();
      const items = this.filterList(q);
      let html = "";
      let head = "";

      items.forEach((m, idx) => {
        const L = (m.nombre[0] || "#").toUpperCase();
        if (L !== head) {
          head = L;
          html += `<div class="fi-sep">${esc(L)}</div>`;
        }
        const maxLabel = m.maxAlumno > 0 ? m.maxAlumno : "sin límite";
        const dispLabel = Number.isFinite(m.disponible) ? m.disponible : "—";

        html += `
          <div class="fi-item" role="option" data-idx="${idx}">
            <div class="name">${this.highlight(m.nombre, q)}</div>
            <div class="meta" style="opacity:.65">
              ${m.clave ? esc(m.clave) : ""} · Máx: ${maxLabel} · Disp: ${dispLabel}
            </div>
          </div>`;
      });

      if (!html) {
        html =
          `<div class="fi-item" style="pointer-events:none;opacity:.65">` +
          `Sin resultados</div>`;
      }

      this.list.innerHTML = html;
      this.list.classList.remove("hidden");
      this.input.setAttribute("aria-expanded", "true");

      this.list
        .querySelectorAll(".fi-item[role='option']")
        .forEach((el) => {
          el.addEventListener("click", () => {
            const idx = Number(el.getAttribute("data-idx"));
            this.choose(items[idx]);
          });
        });

      this.activeIndex = items.length ? 0 : -1;
      this.updateActive(items);
    },

    updateActive(items) {
      const nodes = this.list.querySelectorAll(".fi-item[role='option']");
      nodes.forEach((n) => n.classList.remove("active"));
      if (this.activeIndex >= 0 && nodes[this.activeIndex]) {
        nodes[this.activeIndex].classList.add("active");
        nodes[this.activeIndex].scrollIntoView({ block: "nearest" });
      }
    },

    onKey(e) {
      const items = this.filterList(this.input.value);
      if (!items.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.activeIndex = Math.min(
          items.length - 1,
          this.activeIndex + 1
        );
        this.updateActive(items);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.activeIndex = Math.max(0, this.activeIndex - 1);
        this.updateActive(items);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (this.activeIndex >= 0) this.choose(items[this.activeIndex]);
      } else if (e.key === "Escape") {
        this.hide();
      }
    },

    choose(mat) {
      this.input.value = mat.nombre;
      if (this.hidden) this.hidden.value = mat.clave || "";
      this.hide();
      applyLimitFromMaterial();
      updateActionStates();
      $("#cantidad")?.focus();
    },
  };

  /* =========================================================
     LÍMITES DE CANTIDAD (catálogo + stock)
  ========================================================== */
  function computeAndSetQtyMax(materialName) {
    const inp = $("#cantidad");
    if (!inp) return 0;

    const info = computeEffectiveMax(materialName);
    const max = info.maxFinal;

    inp.dataset.maxAllowed = String(max);
    inp.dataset.stockTotal = String(info.stockTotal);
    inp.dataset.stockRestante = String(info.stockRestante);

    inp.max = max > 0 ? String(max) : "";

    if (info.stockTotal <= 0) {
      inp.value = "";
      toast(`No hay existencias para "${materialName}".`, "warn");
    } else if (info.stockRestante <= 0) {
      inp.value = "";
      toast(
        `Ya no quedan piezas disponibles de "${materialName}" (en esta solicitud ya usaste todas las disponibles).`,
        "warn"
      );
    }

    return max;
  }

  function applyLimitFromMaterial() {
    const name = clean($("#materialSearch")?.value);
    const inp  = $("#cantidad");
    const plus = $("#plusQty");
    if (!inp) return;

    const max = name ? computeAndSetQtyMax(name) : 0;

    const metaOk = metaFieldsComplete();
    if (plus) plus.disabled = !(metaOk && name && max > 0);

    const n = Number(inp.value || "");
    if (max > 0 && Number.isFinite(n) && n > max) {
      inp.value = String(max);
      toast(`Máx. permitido para "${name}" = ${max}.`, "warn");
    }

    updateActionStates();
  }

  function ensureCantidadValidaOrWarn() {
    const inp  = $("#cantidad");
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
      if (!inp.value || Number(inp.value) <= 0) {
        toast("Tiene que poner un número.", "warn");
      } else {
        toast("Cantidad no válida.", "warn");
      }
      inp.focus();
      return false;
    }

    if (max > 0 && n > max) {
      toast(`Máx. permitido para "${name}" es ${max}.`, "warn");
      inp.value = String(max);
      return false;
    }
    return true;
  }

  function updateActionStates() {
    const btnPlus   = $("#plusQty");
    const btnAdd    = $("#agregar");
    const btnSave   = $("#guardar");
    const btnCancel = $("#cancelarPedido");
    const btnView   = $("#btnVerCompras");

    const metaOk     = metaFieldsComplete();
    const hasMaterial= validMaterial();
    const hasCantidad= validCantidad();
    const hasRows    = state.items.length > 0;

    if (btnPlus)  btnPlus.disabled  = !(metaOk && hasMaterial);
    if (btnAdd)   btnAdd.disabled   = !(metaOk && hasMaterial && hasCantidad);
    if (btnSave)  btnSave.disabled  = !(metaOk && hasRows);
    if (btnCancel)btnCancel.disabled= !(metaOk && hasRows);

    // Ver solicitud se seguirá habilitando sólo al guardar,
    // pero además debe haber encabezado lleno.
    if (btnView && btnView.disabled === false && !metaOk) {
      btnView.disabled = true;
    }
  }

  /* =========================================================
     TABLA
  ========================================================== */
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
        (it, idx) => `
      <tr>
        <td style="text-align:left">${esc(it.material)}</td>
        <td>${it.cantidad}</td>
        <td>${it.fechaIngreso || "—"}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn danger" data-del="${idx}" title="Eliminar">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`
      )
      .join("");

    tbody.querySelectorAll("button[data-del]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const i = Number(e.currentTarget.getAttribute("data-del"));
        const removed = state.items.splice(i, 1)[0];
        renderTable();
        if (removed) applyLimitFromMaterial();
        updateActionStates();
      });
    });

    updateActionStates();
  }

  function addCurrentRow() {
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
    const material = clean($("#materialSearch").value);
    const cantidad = Number($("#cantidad").value);
    const fechaIng = `${yyyy}-${mm}-${dd}`;

    const info = computeEffectiveMax(material);
    if (info.stockRestante <= 0) {
      toast(`No hay stock disponible de "${material}".`, "warn");
      return;
    }
    if (info.maxFinal > 0 && cantidad > info.maxFinal) {
      toast(
        `Para "${material}" sólo puedes agregar hasta ${info.maxFinal} (considerando stock y límite por alumno).`,
        "warn"
      );
      $("#cantidad").value = String(info.maxFinal);
      return;
    }

    state.items.push({ material, cantidad, fechaIngreso: fechaIng });
    renderTable();

    const inp = $("#cantidad");
    inp.value = "1";
    applyLimitFromMaterial();
    updateActionStates();
  }

  function incQty() {
    if (!metaFieldsComplete()) {
      toast("Primero llena todos los datos del encabezado.", "warn");
      return;
    }
    const name = clean($("#materialSearch")?.value);
    if (!name) {
      toast("Selecciona un material antes de aumentar la cantidad.", "warn");
      $("#materialSearch")?.focus();
      return;
    }
    const inp = $("#cantidad");
    const info = computeEffectiveMax(name);
    const max = info.maxFinal;
    const n   = Number(inp.value || "0") || 0;
    const next = n + 1;

    if (max > 0 && next > max) {
      inp.value = String(max);
      toast(
        `Máx. permitido para "${name}" = ${max} (stock y regla por alumno).`,
        "warn"
      );
    } else {
      inp.value = String(next);
    }
    updateActionStates();
  }

  /* =========================================================
     GUARDAR / CANCELAR / VER
  ========================================================== */
  function buildSolicitudPayload() {
    const { yyyy, mm, dd, hh, mi, ss } = nowParts();
    return {
      folio:   $("#folio")?.value || "",
      fecha:   `${yyyy}-${mm}-${dd}`,
      hora:    `${hh}:${mi}:${ss}`,
      auxiliar:$("#auxiliar")?.value || "",
      docente: $("#docente")?.value || "",
      carrera: $("#carrera")?.value || "",
      alumno:  $("#alumno")?.value || "",
      materia: $("#materiaAcad")?.value || "",
      mesa:    $("#mesa")?.value || "",
      items:   state.items.slice(),
    };
  }

  function guardarSolicitud() {
    if (!metaFieldsComplete()) {
      toast("Llena todos los datos del encabezado antes de guardar.", "warn");
      return;
    }

    if (!state.items.length) {
      toast("Agrega por lo menos un material.", "warn");
      return;
    }

    const payload = buildSolicitudPayload();

    writeLS("LE_confirmacionJC", payload);

    state.items = [];
    renderTable();

    $("#materialSearch").value = "";
    $("#material") && ($("#material").value = "");
    $("#cantidad").value = "1";
    applyLimitFromMaterial();

    $("#guardar")?.setAttribute("disabled", "disabled");
    $("#cancelarPedido")?.setAttribute("disabled", "disabled");
    $("#btnVerCompras")?.removeAttribute("disabled");

    toast("Solicitud guardada.", "ok");

    setFolio();
    updateActionStates();
  }

  function cancelarSolicitud() {
    state.items = [];
    renderTable();
    updateActionStates();
    toast("Solicitud cancelada.", "info");
  }

  function verSolicitud() {
    if (!metaFieldsComplete()) {
      toast("Llena todos los datos del encabezado antes de continuar.", "warn");
      return;
    }
    if (!readLS("LE_confirmacionJC")) {
      const payload = buildSolicitudPayload();
      writeLS("LE_confirmacionJC", payload);
    }
    window.location.href = CONFIRMACION_URL;
  }

  /* =========================================================
     INIT
  ========================================================== */
  document.addEventListener("DOMContentLoaded", async () => {
    await Catalog.sync();
    Finder.init();

    setFechaHoraHoy();
    setFolio();
    setAlumnoYCarrera();

    await loadAuxiliaresSelect();
    await loadDocentesSelect();
    await loadMateriasSelect();
    loadMesasSelect();

    // Eventos de botones
    $("#plusQty")?.addEventListener("click", incQty);
    $("#agregar")?.addEventListener("click", addCurrentRow);
    $("#guardar")?.addEventListener("click", guardarSolicitud);
    $("#cancelarPedido")?.addEventListener("click", cancelarSolicitud);
    $("#btnVerCompras")?.addEventListener("click", verSolicitud);

    // Cambios en campos que afectan a la validación de encabezado
    [
      "fecha",
      "hora",
      "folio",
      "alumno",
      "carrera",
      "auxiliar",
      "docente",
      "materiaAcad",
      "mesa",
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
      if (inp.value === "" || Number(inp.value) <= 0) {
        updateActionStates();
        return;
      }
      const max = Number(inp.dataset.maxAllowed || "0") || 0;
      const n   = Number(inp.value) || 0;
      if (max > 0 && n > max) {
        inp.value = String(max);
        toast(`Máx. permitido = ${max}.`, "warn");
      }
      updateActionStates();
    });

    $("#cantidad")?.addEventListener("blur", () => {
      const inp = $("#cantidad");
      if (!validCantidad()) {
        inp.value = "";
        toast("Tiene que poner un número.", "warn");
      }
      updateActionStates();
    });

    applyLimitFromMaterial();
    updateActionStates();
  });
})();
