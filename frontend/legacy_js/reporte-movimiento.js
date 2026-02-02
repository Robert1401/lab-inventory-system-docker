/* =========================================================
   Movimiento del material por carrera — Vinculado a Pedido
   - Movimientos:   LE_movimientos  (fuente principal)
   - Carreras:      1) backend carrera.php
                    2) LE_carreras
                    3) si no hay, de los movimientos
   - Materiales:    1) LE_materiales 2) si no hay, de los movimientos
   - Pedidos:       LE_pedidos  (se usan para reconstruir movimientos)
========================================================= */
(function () {
  /* -------------------- Constantes / helpers -------------------- */
  const $ = (s) => document.querySelector(s);

  const LS_MOVS    = "LE_movimientos";
  const LS_CARR    = "LE_carreras";
  const LS_MATS    = "LE_materiales";
  const LS_PEDIDOS = "LE_pedidos";

  // Endpoint backend de carreras
  const API_CARRERAS = "/backend/carreras.php";

  let MOVS = [];     // todos los movimientos normalizados
  let CARRERAS = []; // catálogo final de carreras
  let MATS = [];     // catálogo final de materiales
  let toCanonC = (x) => x; // función para igualar nombres de carrera

  // notify seguro
  const notify = window.notify || {};
  const okInfo = (m) =>
    window.notify?.show ? notify.show(m, "info") : console.log(m);
  const okOk = (m) =>
    window.notify?.show
      ? notify.show(m, "success", { title: "¡Listo!" })
      : console.log(m);

  const firstStr = (...c) => {
    for (const x of c) {
      if (x == null) continue;
      const s = String(x).trim();
      if (s) return s;
    }
    return "";
  };

  const norm = (s) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c])
    );

  function readLS(key, fallback = []) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "null");
      if (Array.isArray(v)) return v;
      if (v && Array.isArray(v.data)) return v.data;
      if (v && Array.isArray(v.rows)) return v.rows;
      return fallback;
    } catch {
      return fallback;
    }
  }

  /* -------------------- Movimientos: cargar y normalizar -------------------- */
  function getMovs() {
    const raw = readLS(LS_MOVS, []);
    const rows = [];

    for (const r of raw) {
      if (!r) continue;

      const material = firstStr(
        r.material,
        r.Material,
        r.nombre_material,
        r.nombreMaterial,
        r.descripcion,
        r.Descripcion
      );

      const carrera = firstStr(
        r.carrera,
        r.Carrera,
        r.carrera_nombre,
        r.nombreCarrera
      );

      const tipo = firstStr(
        r.tipo,
        r.tipo_movimiento,
        r.movimiento,
        r.mov,
        r.tipoMov
      );

      const fecha = firstStr(
        r.fecha,
        r.fecha_movimiento,
        r.f_mov,
        r.fechaMovimiento
      );

      const usuario = firstStr(
        r.usuario,
        r.no_control,
        r.noControl,
        r.usuario_id,
        r.usuarioId
      );

      let cantidad = 0;
      if (r.cantidad != null) cantidad = Number(r.cantidad);
      else if (r.cant != null) cantidad = Number(r.cant);
      else if (r.qty != null) cantidad = Number(r.qty);

      rows.push({
        material: material || "",
        carrera: carrera || "",
        tipo: tipo || "",
        fecha: fecha || "",
        usuario: usuario || "",
        cantidad: Number.isFinite(cantidad) ? cantidad : 0,
      });
    }

    return rows;
  }

  /* -------------------- Canon carrera (limpia “Ing.”, etc.) -------------------- */
  function mkCanonCarrera(cat) {
    const canon = new Map();
    for (const n of cat) canon.set(norm(n), n);

    return (v) => {
      const raw = String(v || "").trim();
      if (!raw) return raw;
      const nrm = norm(raw);
      if (canon.has(nrm)) return canon.get(nrm);

      // limpiar prefijos comunes
      const strip = nrm
        .replace(/^(ing\.?\s*)/i, "")
        .replace(/^ingenieria(\s+en)?\s*/i, "")
        .trim();

      for (const name of cat) {
        const core = norm(name)
          .replace(/^(ing\.?\s*)/i, "")
          .replace(/^ingenieria(\s+en)?\s*/i, "")
          .trim();
        if (core && strip.includes(core)) return name;
      }

      return raw;
    };
  }

  /* -------------------- Carreras desde BACKEND -------------------- */
  async function fetchCarrerasBackend() {
    try {
      const resp = await fetch(API_CARRERAS, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!resp.ok) return [];

      const data = await resp.json();
      const arr = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : [];

      const set = new Map();
      for (const row of arr) {
        const nombre = firstStr(
          typeof row === "string" ? row : null,
          row?.nombre,
          row?.Nombre,
          row?.carrera,
          row?.Carrera,
          row?.name,
          row?.descripcion,
          row?.nombreCarrera,
          row?.NombreCarrera,
          row?.descripcionCorta
        );
        const t = String(nombre || "").trim();
        if (!t) continue;
        const k = norm(t);
        if (!set.has(k)) set.set(k, t);
      }
      return [...set.values()];
    } catch (e) {
      console.warn("Error al consultar carreras.php:", e);
      return [];
    }
  }

  /* -------------------- Cargar CARRERAS (backend + fallback) -------------------- */
  async function getCarrerasFromSources() {
    const set = new Map();

    // 1) Backend — aquí deberían salir TODAS las carreras
    const backendList = await fetchCarrerasBackend();
    for (const t of backendList) {
      const k = norm(t);
      if (!set.has(k)) set.set(k, t);
    }

    // 2) Catálogo guardado en LS (por si hay algo extra)
    const raw = readLS(LS_CARR, []);
    for (const row of raw) {
      const s =
        typeof row === "string"
          ? row
          : firstStr(
              row.nombre,
              row.Nombre,
              row.carrera,
              row.Carrera,
              row.name,
              row.nombreCarrera
            );
      const t = String(s || "").trim();
      if (!t) continue;
      const k = norm(t);
      if (!set.has(k)) set.set(k, t);
    }

    // 3) Si aún faltara algo, sacarlo desde los movimientos
    if (set.size === 0 && Array.isArray(MOVS)) {
      for (const m of MOVS) {
        const t = String(m.carrera || "").trim();
        if (!t) continue;
        const k = norm(t);
        if (!set.has(k)) set.set(k, t);
      }
    }

    return [...set.values()].sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" })
    );
  }

  /* -------------------- Cargar MATERIALES -------------------- */
  function getMaterialesFromCatalogOrMovs() {
    const set = new Map();

    // 1) Catálogo guardado
    const raw = readLS(LS_MATS, []);
    for (const row of raw) {
      const s =
        typeof row === "string"
          ? row
          : firstStr(
              row.nombre,
              row.Nombre,
              row.material,
              row.Material,
              row.descripcion,
              row.Descripcion
            );
      const t = String(s || "").trim();
      if (!t) continue;
      const k = norm(t);
      if (!set.has(k)) set.set(k, t);
    }

    // 2) Si no hay nada en catálogo, sacarlos de los movimientos
    if (set.size === 0 && Array.isArray(MOVS)) {
      for (const m of MOVS) {
        const t = String(m.material || "").trim();
        if (!t) continue;
        const k = norm(t);
        if (!set.has(k)) set.set(k, t);
      }
    }

    return [...set.values()].sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" })
    );
  }

  /* -------------------- Nombre de alumno desde LS (para forzar usuario) -------------------- */
  function getAlumnoNombre(noControl) {
    const nc = String(noControl || "").trim();
    if (!nc) return "";

    const posiblesKeys = [
      "LE_ALUMNOS",
      "LE_alumnos",
      "LE_ALUMNOS_INICIAL",
      "LE_alumnos_inicial",
      "LE_ALUMNOS_LOCAL",
    ];

    for (const key of posiblesKeys) {
      const lista = readLS(key, []);
      if (!Array.isArray(lista) || !lista.length) continue;

      for (const a of lista) {
        const ncRow = firstStr(
          a.noControl,
          a.no_control,
          a.matricula,
          a.Matricula,
          a.idAlumno,
          a.id_Alumno
        );
        if (!ncRow) continue;
        if (String(ncRow).trim() !== nc) continue;

        const nombreAlumno = firstStr(
          a.nombreCompleto,
          a.nombre,
          a.Nombre,
          a.fullName,
          a.apellidoPaterno && a.apellidoMaterno
            ? `${a.nombre} ${a.apellidoPaterno} ${a.apellidoMaterno}`
            : null
        );
        if (nombreAlumno) return nombreAlumno;
      }
    }
    return "";
  }

  /* -------------------- Carrera desde alumnos (para vincular pedidos) -------------------- */
  function getCarreraPorAlumno(noControl, fallbackCarrera) {
    const nc = String(noControl || "").trim();
    if (!nc && fallbackCarrera) return fallbackCarrera || "";

    const posiblesKeys = [
      "LE_ALUMNOS",
      "LE_alumnos",
      "LE_ALUMNOS_INICIAL",
      "LE_alumnos_inicial",
      "LE_ALUMNOS_LOCAL",
    ];

    for (const key of posiblesKeys) {
      const lista = readLS(key, []);
      if (!Array.isArray(lista) || !lista.length) continue;

      for (const a of lista) {
        const ncRow = firstStr(
          a.noControl,
          a.no_control,
          a.matricula,
          a.Matricula,
          a.idAlumno,
          a.id_Alumno
        );
        if (!ncRow) continue;
        if (String(ncRow).trim() !== nc) continue;

        const nombreCarrera = firstStr(
          a.carrera,
          a.Carrera,
          a.programa,
          a.Programa,
          a.carrera_nombre,
          a.nombreCarrera
        );
        if (nombreCarrera) return nombreCarrera;
      }
    }

    return fallbackCarrera || "";
  }

  /* -------------------- Reconstruir LE_movimientos desde LE_pedidos -------------------- */
  function buildMovsFromPedidos() {
    const pedidos = readLS(LS_PEDIDOS, []);
    if (!Array.isArray(pedidos) || !pedidos.length) return null;

    const nuevos = [];

    for (const p of pedidos) {
      const alumno = p.alumno || {};
      const noCtrl = firstStr(p.noControl, alumno.noControl, alumno.no_control);

      const carreraPedido = firstStr(
        p.carrera,
        p.carrera_nombre,
        alumno.carrera,
        alumno.Carrera
      );

      // 1) intentamos obtener la carrera desde alumnos (LS)
      let carrera = getCarreraPorAlumno(noCtrl, carreraPedido);

      const fechaPrestamo = firstStr(p.aprobado_en, p.fecha).slice(0, 10);
      const fechaDevolucion = firstStr(
        p.devuelto_en,
        p.devuelto_en_fecha
      ).slice(0, 10);
      const estado = String(p.estado || "").toLowerCase();
      const items = Array.isArray(p.items) ? p.items : [];

      // nombre del usuario (alumno) — forzado con LS si falta
      const alumnoNombreLS = getAlumnoNombre(noCtrl);
      const usuarioNombre = firstStr(
        p.usuario,
        p.usuarioNombre,
        alumno.nombreCompleto,
        alumno.nombre,
        alumno.Nombre,
        alumno.fullName,
        alumnoNombreLS
      );

      const usuarioId = noCtrl || firstStr(alumno.noControl, alumno.no_control);

      let usuario = usuarioNombre || "";
      if (usuarioId && usuarioNombre) {
        usuario = `${usuarioId} - ${usuarioNombre}`;
      } else if (usuarioId) {
        usuario = usuarioId;
      }

      // 👉 De momento NO ponemos "Sin usuario"/"Sin carrera", los dejamos vacíos.
      if (!usuario) usuario = "";
      if (!carrera) carrera = "";

      for (const it of items) {
        const mat = firstStr(it.material, it.nombre, it.descripcion);
        const cant = Number(it.cantidad || 0);
        if (!mat || !cant) continue;

        // Movimiento de salida: Préstamo
        nuevos.push({
          material: mat,
          carrera: carrera,
          tipo: "Préstamo",
          fecha: fechaPrestamo || "",
          usuario: usuario,
          cantidad: cant,
        });

        // Movimiento de entrada: Devolución (si el vale ya se devolvió)
        if (estado === "devuelto") {
          nuevos.push({
            material: mat,
            carrera: carrera,
            tipo: "Devolución",
            fecha: fechaDevolucion || fechaPrestamo || "",
            usuario: usuario,
            cantidad: cant,
          });
        }
      }
    }

    /* ====== SEGUNDA PASADA: RELLENAR HUECOS DE USUARIO / CARRERA ====== */

    // mapas auxiliares
    const mapCarreraToUsuario = new Map(); // Ingeniería en S.C. -> "22050756 - Mariana..."
    const mapUsuarioToCarrera = new Map(); // "22050756 - Mariana..." -> Ingeniería en S.C.

    // 1) Construimos los mapas con los registros que SÍ traen todo
    for (const m of nuevos) {
      const carrera = String(m.carrera || "").trim();
      const usuario = String(m.usuario || "").trim();

      if (carrera && usuario) {
        if (!mapCarreraToUsuario.has(carrera)) {
          mapCarreraToUsuario.set(carrera, usuario);
        }
        if (!mapUsuarioToCarrera.has(usuario)) {
          mapUsuarioToCarrera.set(usuario, carrera);
        }
      }
    }

    // Para casos donde prácticamente todo es del mismo alumno/carrera
    let usuarioGlobal = "";
    let carreraGlobal = "";
    for (const m of nuevos) {
      if (m.usuario) usuarioGlobal = m.usuario;
      if (m.carrera) carreraGlobal = m.carrera;
    }

    // 2) Rellenar faltantes
    for (const m of nuevos) {
      // Completar USUARIO si viene vacío
      if (!m.usuario) {
        if (m.carrera && mapCarreraToUsuario.has(m.carrera)) {
          m.usuario = mapCarreraToUsuario.get(m.carrera);
        } else if (usuarioGlobal) {
          // último usuario conocido
          m.usuario = usuarioGlobal;
        }
      }

      // Completar CARRERA si viene vacía
      if (!m.carrera) {
        if (m.usuario && mapUsuarioToCarrera.has(m.usuario)) {
          m.carrera = mapUsuarioToCarrera.get(m.usuario);
        } else if (carreraGlobal) {
          // última carrera conocida
          m.carrera = carreraGlobal;
        }
      }
    }

    // 3) Último fallback: si de plano no hay nada, ponemos un texto genérico
    for (const m of nuevos) {
      if (!m.usuario) m.usuario = "Usuario no registrado";
      if (!m.carrera) m.carrera = "Carrera no registrada";
    }

    localStorage.setItem(LS_MOVS, JSON.stringify(nuevos));
    return nuevos;
  }

  /* -------------------- Render tabla -------------------- */
  function renderRows(html) {
    const tb = $("#tablaMovimiento");
    tb.innerHTML =
      html ||
      `<tr><td colspan="6" style="padding:14px;text-align:center;opacity:.7;">Sin registros</td></tr>`;
  }

  function renderTabla(selCarr, selMat, fechaInicial, fechaFinal) {
    // normalizar nombre de carrera según catálogo
    const movs = MOVS.map((r) => ({
      ...r,
      carrera: toCanonC(r.carrera),
    }));

    // Filtro por fecha (YYYY-MM-DD en texto)
    const filteredByDate = movs.filter((r) => {
      if (!r.fecha) return true;
      const fechaMov = r.fecha.slice(0, 10);
      if (fechaInicial && fechaMov < fechaInicial) return false;
      if (fechaFinal && fechaMov > fechaFinal) return false;
      return true;
    });

    let filtered = [];

    // Caso A: sin carrera -> filtra solo por material y fechas
    if (!selCarr) {
      filtered = filteredByDate.filter(
        (r) => !selMat || String(r.material || "") === selMat
      );
    } else {
      // Caso B: con carrera -> solo movimientos que EXISTEN de esa carrera
      filtered = filteredByDate.filter(
        (r) =>
          r.carrera === selCarr &&
          (!selMat || String(r.material || "") === selMat)
      );
    }

    if (!filtered.length) {
      renderRows(""); // muestra "Sin registros"
      return;
    }

    const html = filtered
      .map(
        (r) => `
        <tr>
          <td>${esc(r.material || "")}</td>
          <td>${esc(r.carrera || "")}</td>
          <td style="text-align:center">${Number(r.cantidad || 0)}</td>
          <td>${esc(r.tipo || "")}</td>
          <td style="white-space:nowrap">${esc(r.fecha || "")}</td>
          <td>${esc(r.usuario || "")}</td>
        </tr>
      `
      )
      .join("");

    renderRows(html);
  }

  /* ===== Scroll vertical en el contenido de la tabla ===== */
  function setupVerticalScrollbar() {
    const tb = $("#tablaMovimiento");
    if (!tb) return;

    const table = tb.closest("table");
    if (!table) return;

    if (table.parentElement && table.parentElement.classList.contains("scroll-vertical")) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "scroll-vertical";
    wrapper.style.maxHeight = "380px";
    wrapper.style.overflowY = "auto";
    wrapper.style.marginTop = "8px";
    wrapper.style.borderRadius = "12px";
    wrapper.style.background = "#ffffff";
    wrapper.style.boxShadow = "0 4px 16px rgba(0,0,0,.12)";

    const parent = table.parentNode;
    parent.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  }

  /* -------------------- Cargar filtros (selects) -------------------- */
  async function loadFilters() {
    CARRERAS = await getCarrerasFromSources();
    MATS = getMaterialesFromCatalogOrMovs();
    toCanonC = mkCanonCarrera(CARRERAS);

    const selC = $("#filtroCarrera");
    selC.innerHTML =
      `<option value="">Todas</option>` +
      CARRERAS.map(
        (c) => `<option value="${esc(c)}">${esc(c)}</option>`
      ).join("");

    const selM = $("#filtroMaterial");
    selM.innerHTML =
      `<option value="">Todos</option>` +
      MATS.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("");
  }

  /* -------------------- Acciones UI -------------------- */
  function aplicar() {
    const selCarr = $("#filtroCarrera").value;
    const selMat  = $("#filtroMaterial").value;
    const fIni    = $("#filtroFechaInicial")?.value || "";
    const fFin    = $("#filtroFechaFinal")?.value || "";

    renderTabla(selCarr, selMat, fIni, fFin);
    okInfo("Filtros aplicados.");
  }

  function limpiar() {
    $("#filtroCarrera").value = "";
    $("#filtroMaterial").value = "";
    if ($("#filtroFechaInicial")) $("#filtroFechaInicial").value = "";
    if ($("#filtroFechaFinal")) $("#filtroFechaFinal").value = "";
    renderTabla("", "", "", "");
    okInfo("Filtros limpiados.");
  }

  /* -------------------- Exportar lo renderizado -------------------- */
  function rowsRendered() {
    return Array.from($("#tablaMovimiento").querySelectorAll("tr")).map(
      (tr) =>
        Array.from(tr.querySelectorAll("td")).map((td) =>
          td.textContent.trim()
        )
    );
  }

  function descargarExcel() {
    const head = ["Material", "Carrera", "Cantidad", "Tipo", "Fecha", "Usuario"];
    const data = rowsRendered();
    const csv = [head]
      .concat(data)
      .map((r) =>
        r
          .map((c) => {
            const s = String(c ?? "");
            return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reporte-movimiento.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    okOk("Descargando (CSV).");
  }

  function descargarPDF() {
    const thead = `
      <tr><th>Material</th><th>Carrera</th><th>Cantidad</th><th>Tipo</th><th>Fecha</th><th>Usuario</th></tr>
    `;
    const tbody = rowsRendered()
      .map(
        (r) =>
          `<tr>${r
            .map(
              (c) =>
                `<td style="border:1px solid #000;padding:8px;">${esc(c)}</td>`
            )
            .join("")}</tr>`
      )
      .join("");

    const w = window.open("", "_blank");
    w.document.write(`
      <!doctype html><html><head><meta charset="utf-8">
      <title>Movimiento por carrera</title>
      <style>
        body{font-family:Segoe UI,Arial;margin:20px;}
        h1{text-align:center;margin:0 0 12px;}
        .line{height:3px;background:#000;margin-bottom:12px;}
        table{width:100%;border-collapse:collapse}
        th{background:#000;color:#fff;padding:10px;border:1px solid #000}
        td{border:1px solid #000;padding:8px}
      </style></head><body>
      <h1>Movimiento del material por carrera</h1><div class="line"></div>
      <table><thead>${thead}</thead><tbody>${
      tbody ||
      `<tr><td colspan="6" style="text-align:center">Sin registros</td></tr>`
    }</tbody></table>
      <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),150));<\/script>
      </body></html>
    `);
    w.document.close();
    okOk("Abriendo vista de impresión.");
  }

  /* -------------------- Boot -------------------- */
  document.addEventListener("DOMContentLoaded", async () => {
    // 1) Reconstruir movimientos a partir de todos los vales guardados
    const fromPedidos = buildMovsFromPedidos();
    MOVS = fromPedidos || getMovs();

    // 2) Construir catálogos (carreras / materiales) y llenar filtros
    await loadFilters();

    // 3) Scroll vertical
    setupVerticalScrollbar();

    // 4) Vista inicial: sin filtros -> todos los movimientos
    renderTabla("", "", "", "");

    // 5) Eventos de UI
    $("#btnAplicar")?.addEventListener("click", aplicar);
    $("#btnLimpiar")?.addEventListener("click", limpiar);
    $("#btnExcel")?.addEventListener("click", descargarExcel);
    $("#btnPDF")?.addEventListener("click", descargarPDF);

    $("#btnBack")?.addEventListener("click", (e) => {
      e.preventDefault();
      if (history.length > 1) history.back();
      else location.href = "Reporte-especialidad.html";
    });

    // 6) Auto-refresh si otro módulo actualiza LS
    window.addEventListener("storage", (e) => {
      if ([LS_PEDIDOS, LS_MOVS, LS_CARR, LS_MATS].includes(e.key)) {
        const fromPedidos2 = buildMovsFromPedidos();
        MOVS = fromPedidos2 || getMovs();
        loadFilters();
        renderTabla(
          $("#filtroCarrera").value,
          $("#filtroMaterial").value,
          $("#filtroFechaInicial")?.value || "",
          $("#filtroFechaFinal")?.value || ""
        );
      }
    });
  });
})();
