/* =========================================================
   Reporte de Inventario (LOCAL, sin PHP)
   - Claves:    se leen de:
                  1) window.Materiales.lista (si existe)
                  2) localStorage: LE_MATERIALES_LOCAL / LE_materiales
   - Cantidad:  suma de compras (LE_compras + LE_compra_detalle, SIN duplicar)
   - Filtros:   estado + rango de fechas (YYYY-MM-DD)
   - Vista general: inventario por material (con CLAVES)
   - Oculta nombres tipo "Material #123"
   - Auto-Refresh: cuando cambian LE_compras / LE_compra_detalle / LE_materiales / LE_pedidos
   - Integra LE_pedidos.cantidades_daniado (desde Prestamos.js).
   - Para dañados se usa la FECHA en que se registró el daño/devolución.
   - Estado = "Materiales dañados" → sólo dañados (por rango de fechas).
   - Estado = "Todos" → disponibles + sección de dañados,
     con filas rosita y nombre "Nombre (dañado)".
   - Exportar PDF/Excel: usa SIEMPRE lo que está en pantalla (datosVisibles),
     pero se imprime/exporta TODO el contenido (aunque haya scroll).
========================================================= */
(function () {
  "use strict";

  /* =============== Mini helpers =============== */
  const $ = (id) => document.getElementById(id);
  const AUX_DEFAULT = "—"; // sólo para uso interno, ya no se muestra

  const toISO = (d) => {
    const x = new Date(d);
    return isNaN(x) ? "" : x.toISOString().slice(0, 10);
  };
  const todayISO = () => toISO(new Date());

  const toInt = (v, fb = 0) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fb;
  };

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

  const normName = (s = "") => norm(String(s).replace(/\s+/g, " ").trim());

  const descargarBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Mapea texto del select a valores internos
  const sanitizeEstadoValue = (v) => {
    const s = (v || "").toString().toLowerCase();
    if (!s) return "";
    if (s.includes("todo")) return "todos";
    if (s.includes("dispon")) return "disponible";
    if (s.includes("dañ") || s.includes("dan")) return "dañado";
    return s;
  };

  // Acepta DD/MM/YYYY o YYYY-MM-DD y regresa ISO YYYY-MM-DD (o "" si no matchea)
  function toISOFromAnyFormat(val) {
    const raw = (val || "").trim();
    if (!raw) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw; // YYYY-MM-DD
    const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); // DD/MM/YYYY
    if (m) {
      const [, dd, mm, yyyy] = m;
      return `${yyyy}-${mm}-${dd}`;
    }
    return toISO(raw);
  }

  const getFechaInicialISO = () =>
    toISOFromAnyFormat($("filtroFechaInicial")?.value || "");
  const getFechaFinalISO = () =>
    toISOFromAnyFormat($("filtroFechaFinal")?.value || "");

  const isPlaceholderName = (name = "") =>
    /^\s*material\s*#\d+\s*$/i.test(String(name).trim());

  /* =============== Estado =============== */
  let datosBase = [];   // [{id_Material, nombre, clave, cantidad, estado, fecha}]
  let datosVisibles = [];

  const metaByKey = new Map();     // matKey -> { lastAux, lastDate, auxSet:Set, dateSet:Set }
  const availableDates = new Set(); // YYYY-MM-DD
  const dailyIndex = new Map();     // fecha -> [{ id_Material, nombre, clave, cantidad, auxSet:Set, auxSetNorm:Set }]

  const MAT_INDEX = new Map();      // id -> nombre catálogo
  let localCatalogCache = null;     // cache combinada de catálogos LS

  // Cantidades totales compradas por material
  let qtyByMatKey = new Map();

  // matKey -> { id_Material, nombre, detalles: [{ fecha, qty }] }
  let damageAgg = new Map();

  /* ===== Alias opcionales de nombre (si no hay en catálogo) ===== */
  const NAME_ALIAS = {
    1:    "Resistor 220Ω",
    2:    "Capacitor Electrolítico 10µF",
    3:    "Protoboard 830 puntos",
    1004: "Cable Dupont M-M (paquete 40)",
  };

  const FORCE_DROP_UNKNOWN = true;

  const looksGenericName = (name = "") => {
    const s = String(name).trim().toLowerCase();
    if (!s) return true;
    if (s === "(sin nombre)") return true;
    if (/^material\s*#\d+$/i.test(name)) return true;
    if (/^id\s*\d+$/i.test(name)) return true;
    return false;
  };

  /* =============== Carga directa de catálogos en LS =============== */
  function getLocalCatalog() {
    if (localCatalogCache !== null) return localCatalogCache;

    const merged = [];

    // LE_materiales (versión vieja)
    try {
      const ls = JSON.parse(localStorage.getItem("LE_materiales") || "[]");
      if (Array.isArray(ls)) merged.push(...ls);
    } catch {}

    // LE_MATERIALES_LOCAL (el que usa tu CRUD actual)
    try {
      const lsLocal = JSON.parse(
        localStorage.getItem("LE_MATERIALES_LOCAL") || "[]"
      );
      if (Array.isArray(lsLocal)) {
        for (const x of lsLocal) {
          merged.push({
            id_Material: x.id ?? x.id_Material,
            nombre: x.nombre,
            clave: x.clave,
          });
        }
      }
    } catch {}

    localCatalogCache = merged;
    return merged;
  }

  /* =============== Resolver nombre desde id/raw =============== */
  function resolveName(id, raw) {
    const idStr = String(id ?? "").trim();
    if (idStr && MAT_INDEX.has(idStr)) {
      const n = MAT_INDEX.get(idStr);
      if (n && !looksGenericName(n)) return n;
    }
    const idNum = Number(idStr);
    if (Number.isFinite(idNum) && NAME_ALIAS[idNum]) return NAME_ALIAS[idNum];
    if (raw && !looksGenericName(raw)) return raw;
    if (FORCE_DROP_UNKNOWN) return null;
    return raw || (idStr ? `Material #${idStr}` : "(Sin nombre)");
  }

  function buildMatKey(id_Material, nombre) {
    const id = String(id_Material || "").trim();
    return id ? `ID:${id}` : `NM:${norm(nombre)}`;
  }

  /* ======= Resolver CLAVE (id o nombre) ======= */
  function getClave(id, nombre) {
    const idStr = String(id || "").trim();
    const nombreNorm = norm(nombre || "");

    const sources = [];

    // 1) Catálogo publicado por material.js (si esta página también lo carga)
    if (Array.isArray(window.Materiales?.lista)) {
      sources.push(window.Materiales.lista);
    }

    // 2) Catálogos de LS (LE_MATERIALES_LOCAL + LE_materiales)
    const catLS = getLocalCatalog();
    if (catLS.length) sources.push(catLS);

    for (const src of sources) {
      for (const m of src) {
        const mid = firstStr(m.id_Material, m.id, m.ID, m.id_material);
        const mNombre = firstStr(
          m.nombre,
          m.Nombre,
          m.descripcion,
          m.Descripcion,
          m.material,
          m.Material
        );
        const mClave = firstStr(
          m.clave,
          m.Clave,
          m.claveMaterial,
          m.ClaveMaterial,
          m.codigo,
          m.Codigo
        );
        if (!mClave) continue;

        if (idStr && mid && String(mid) === idStr) return mClave;
        if (!idStr && mNombre && nombreNorm === norm(mNombre)) return mClave;
      }
    }

    return "";
  }

  /* =============== Catálogo (para índice id->nombre) =============== */
  async function tryCall(fn) {
    try {
      const r = fn();
      return Array.isArray(r) ? r : (Array.isArray(await r) ? await r : null);
    } catch {
      return null;
    }
  }

  async function getCatalogFromMaterialJS() {
    const cands = [];

    // 1) Catálogo de LS combinado (LE_materiales + LE_MATERIALES_LOCAL)
    const localCat = getLocalCatalog();
    if (localCat.length) cands.push(localCat);

    // 2) Posibles arrays globales de material.js (si esta página lo carga)
    if (Array.isArray(window.Materiales?.lista))
      cands.push(window.Materiales.lista);
    if (Array.isArray(window.MaterialStore?.lista))
      cands.push(window.MaterialStore.lista);
    if (Array.isArray(window.MaterialAPI?.data))
      cands.push(window.MaterialAPI.data);
    if (Array.isArray(window.MATERIAL_CATALOG))
      cands.push(window.MATERIAL_CATALOG);
    if (Array.isArray(window.MAT_LIST)) cands.push(window.MAT_LIST);
    if (Array.isArray(window.materialesData)) cands.push(window.materialesData);

    if (typeof window.MaterialAPI?.getAll === "function") {
      const a = await tryCall(window.MaterialAPI.getAll);
      if (Array.isArray(a)) cands.push(a);
    }
    if (typeof window.Materiales?.getAll === "function") {
      const a = await tryCall(window.Materiales.getAll);
      if (Array.isArray(a)) cands.push(a);
    }
    if (typeof window.Materiales?.listar === "function") {
      const a = await tryCall(window.Materiales.listar);
      if (Array.isArray(a)) cands.push(a);
    }

    const plano = [];
    for (const arr of cands)
      if (Array.isArray(arr) && arr.length) plano.push(...arr);
    return plano;
  }

  function buildCatalogIndexes(catalogo) {
    MAT_INDEX.clear();

    if (!Array.isArray(catalogo)) return;

    for (const m of catalogo) {
      const id = firstStr(m.id_Material, m.id, m.ID, m.id_material);
      const nombre = firstStr(
        m.nombre,
        m.Nombre,
        m.descripcion,
        m.Descripcion,
        m.material,
        m.Material
      );
      if (id) MAT_INDEX.set(String(id), nombre || "");
    }

    // Fallback por si acaso
    if (!MAT_INDEX.size) {
      const cat = getLocalCatalog();
      for (const m of cat) {
        const id = firstStr(m.id_Material, m.id, m.ID, m.id_material);
        const nombre = firstStr(
          m.nombre,
          m.Nombre,
          m.descripcion,
          m.Descripcion,
          m.material,
          m.Material
        );
        if (id) MAT_INDEX.set(String(id), nombre || "");
      }
    }
  }

  /* =============== Compras (SOLO LOCALSTORAGE) =============== */
  const addTo = (map, key, n) =>
    map.set(key, (map.get(key) || 0) + toInt(n, 0));

  function readComprasFromLocalStorage() {
    const out = [];
    try {
      const compras = JSON.parse(localStorage.getItem("LE_compras") || "[]");
      if (Array.isArray(compras)) {
        for (const c of compras) {
          const aux = firstStr(c.auxiliar, c.usuario);
          const fechaISO = (c.fecha || "").slice(0, 10);
          for (const it of c.items || []) {
            const id = firstStr(it.id_Material, it.id, it.material_id);
            const nombre = resolveName(
              id,
              firstStr(it.nombre, it.descripcion, it.material)
            );
            if (nombre == null || isPlaceholderName(nombre)) continue;
            out.push({
              id_Material: id,
              cantidad: toInt(it.cantidad, 0),
              nombre,
              auxiliar: aux,
              fecha: fechaISO,
            });
          }
        }
      }
    } catch {}
    return out;
  }

  function readDetalleAllFromLS() {
    const out = [];
    try {
      const detalle = JSON.parse(
        localStorage.getItem("LE_compra_detalle") || "[]"
      );
      if (Array.isArray(detalle)) {
        for (const r of detalle) {
          const fechaISO = (
            firstStr(r.fecha, r.created_at, r.createdAt, r.Fecha) || ""
          ).slice(0, 10);
          const id = firstStr(
            r.id_Material,
            r.id_material,
            r.material_id,
            r.id
          );
          const nombre = resolveName(
            id,
            firstStr(
              r.nombre,
              r.descripcion,
              r.material,
              r.Nombre,
              r.Descripcion,
              r.Material
            )
          );
          if (nombre == null || isPlaceholderName(nombre)) continue;
          out.push({
            id_Material: id,
            nombre,
            cantidad: toInt(
              firstStr(
                r.cantidad,
                r.qty,
                r.unidades,
                r.piezas,
                r.Cantidad,
                r.Qty
              ),
              0
            ),
            auxiliar: firstStr(r.auxiliar, r.usuario, r.User, r.Auxiliar),
            fecha: fechaISO,
          });
        }
      }
    } catch {}
    return out;
  }

  // === MERGE sin duplicar compras entre LE_compras y LE_compra_detalle
  function mergeDetalle(detCompras, detDetalle) {
    const map = new Map();

    const add = (r) => {
      if (!r) return;
      const nameN = norm(r.nombre || "");
      const cant  = toInt(r.cantidad, 0);
      const fecha = r.fecha || "";
      const auxN  = normName(r.auxiliar || AUX_DEFAULT);

      // key sin id_Material para no duplicar mismas compras guardadas en ambos lados
      const key = [nameN, cant, fecha, auxN].join("|");

      if (!map.has(key)) {
        map.set(key, { ...r });
      }
    };

    (detCompras || []).forEach(add);
    (detDetalle || []).forEach(add);

    return [...map.values()];
  }

  /* =============== Índices por día y cantidades globales =============== */
  function buildQtyAndDailyIndexes(detalle) {
    qtyByMatKey = new Map();
    metaByKey.clear();
    availableDates.clear();
    dailyIndex.clear();

    for (const r of detalle || []) {
      const id = String(
        firstStr(r.id_Material, r.id_material, r.material_id, r.id) || ""
      ).trim();
      const nombreResuelto = resolveName(
        id,
        firstStr(r.nombre, r.descripcion, r.material, r.Nombre, r.Descripcion, r.Material)
      );
      if (nombreResuelto == null || isPlaceholderName(nombreResuelto)) continue;

      const cantidad = toInt(r.cantidad, 0);
      const auxClean = firstStr(r.auxiliar, r.usuario, r.User, r.Auxiliar);
      const auxFinal = auxClean || AUX_DEFAULT;
      const fecha = toISO(
        firstStr(r.fecha, r.created_at, r.CreatedAt, r.Fecha) || r.fecha
      );

      const matKey = buildMatKey(id, nombreResuelto);
      if (matKey) addTo(qtyByMatKey, matKey, cantidad);

      if (matKey) {
        let meta = metaByKey.get(matKey);
        if (!meta)
          meta = { lastAux: "", lastDate: "", auxSet: new Set(), dateSet: new Set() };
        if (auxFinal) {
          meta.lastAux = auxFinal;
          meta.auxSet.add(auxFinal);
        }
        if (fecha) {
          meta.lastDate = fecha;
          meta.dateSet.add(fecha);
          availableDates.add(fecha);
        }
        metaByKey.set(matKey, meta);
      }

      if (fecha) {
        let arr = dailyIndex.get(fecha);
        if (!arr) {
          arr = [];
          dailyIndex.set(fecha, arr);
        }
        const claveFinal = getClave(id, nombreResuelto);
        arr.push({
          id_Material: id || "",
          nombre: nombreResuelto,
          clave: claveFinal,
          cantidad,
          auxSet: new Set([auxFinal]),
          auxSetNorm: new Set([normName(auxFinal)]),
        });
      }
    }
  }

  /* === Agrupador por día (por si se quiere usar reconstrucción interna) === */
  function groupDayItems(arr, { estadoSel, fechaSel }) {
    const map = new Map();

    for (const info of arr || []) {
      const name =
        resolveName(info.id_Material, info.nombre) ||
        info.nombre;

      if (isPlaceholderName(name)) continue;

      const key = info.id_Material
        ? `ID:${info.id_Material}`
        : `NM:${norm(name)}`;
      const estado = info.cantidad > 0 ? "disponible" : "dañado";
      if (estadoSel && estado !== estadoSel) continue;

      const prev = map.get(key);
      const claveItem = info.clave || getClave(info.id_Material, name) || "";
      if (prev) {
        prev.cantidad += toInt(info.cantidad, 0);
      } else {
        map.set(key, {
          id_Material: info.id_Material,
          nombre: name,
          clave: claveItem,
          cantidad: toInt(info.cantidad, 0),
          estado,
          fecha: fechaSel,
        });
      }
    }
    return [...map.values()];
  }

  /* (Se deja soporte de fechas forzadas interno, por si lo necesitas después) */
  const FORCE_DATES = new Set([
    "2025-11-04",
    "2025-11-03",
    "2025-11-02",
    "2025-10-29",
    "2025-10-28",
    "2025-10-23",
    "2025-10-22",
    "2025-10-21",
    "2025-10-20",
    "2025-10-19",
  ]);

  function _readRawComprasForDate(fechaISO) {
    const comprasFecha = [];

    try {
      const compras = JSON.parse(localStorage.getItem("LE_compras") || "[]");
      for (const c of compras || []) {
        const f = (c.fecha || "").slice(0, 10);
        if (f !== fechaISO) continue;
        const aux = firstStr(c.auxiliar, c.usuario);
        for (const it of c.items || []) {
          const id = firstStr(it.id_Material, it.id, it.material_id);
          const nombreCrudo = firstStr(
            it.nombre,
            it.descripcion,
            it.material
          );
          const resolved = resolveName(id, nombreCrudo);
          if (resolved == null || isPlaceholderName(resolved)) continue;
          comprasFecha.push({
            id_Material: id,
            nombre: resolved,
            cantidad: toInt(it.cantidad, 0),
            auxiliar: aux,
            fecha: fechaISO,
          });
        }
      }
    } catch {}

    const out = [];
    try {
      const detalle = JSON.parse(
        localStorage.getItem("LE_compra_detalle") || "[]"
      );
      if (Array.isArray(detalle)) {
        for (const r of detalle) {
          const f = (
            firstStr(r.fecha, r.created_at, r.createdAt, r.Fecha) || ""
          ).slice(0, 10);
          if (f !== fechaISO) continue;
          const id = firstStr(
            r.id_Material,
            r.id_material,
            r.material_id,
            r.id
          );
          const nombre = resolveName(
            id,
            firstStr(
              r.nombre,
              r.descripcion,
              r.material,
              r.Nombre,
              r.Descripcion,
              r.Material
            )
          );
          if (nombre == null || isPlaceholderName(nombre)) continue;
          out.push({
            id_Material: id,
            nombre,
            cantidad: toInt(
              firstStr(
                r.cantidad,
                r.qty,
                r.unidades,
                r.piezas,
                r.Cantidad,
                r.Qty
              ),
              0
            ),
            auxiliar: firstStr(r.auxiliar, r.usuario, r.User, r.Auxiliar),
            fecha: fechaISO,
          });
        }
      }
    } catch {}

    return mergeDetalle(comprasFecha, out);
  }

  function _dayTotalFromCompras(fechaISO) {
    const crudos = _readRawComprasForDate(fechaISO);
    return crudos.reduce((s, r) => s + toInt(r.cantidad, 0), 0);
  }

  function _reconstructGroupedDay(fechaISO) {
    const crudos = _readRawComprasForDate(fechaISO);
    if (crudos.length) {
      const tmp = [];
      for (const r of crudos) {
        const resolved = resolveName(r.id_Material, firstStr(r.nombre));
        if (!resolved || isPlaceholderName(resolved)) continue;
        tmp.push({
          id_Material: r.id_Material || "",
          nombre: resolved,
          clave: getClave(r.id_Material, firstStr(r.nombre)),
          cantidad: toInt(r.cantidad, 0),
          auxSet: new Set(),
          auxSetNorm: new Set(),
        });
      }
      if (tmp.length) {
        return groupDayItems(tmp, {
          estadoSel: "",
          fechaSel: fechaISO,
        });
      }
    }

    const total = _dayTotalFromCompras(fechaISO);
    if (total > 0) {
      return [
        {
          id_Material: "",
          nombre: "Registro del día (reconstruido)",
          clave: "",
          cantidad: total,
          estado: "disponible",
          fecha: fechaISO,
        },
      ];
    }
    return [];
  }

  function ensureForcedDates() {
    for (const fechaISO of FORCE_DATES) {
      const arr = dailyIndex.get(fechaISO) || [];
      const hasItems = Array.isArray(arr) && arr.length > 0;
      if (!hasItems) {
        const rebuilt = _reconstructGroupedDay(fechaISO);
        if (rebuilt.length) {
          const expanded = rebuilt.map((r) => ({
            id_Material: r.id_Material || "",
            nombre: r.nombre,
            clave: r.clave || getClave(r.id_Material, r.nombre),
            cantidad: toInt(r.cantidad, 0),
            auxSet: new Set(),
            auxSetNorm: new Set(),
          }));
          dailyIndex.set(fechaISO, expanded);
          availableDates.add(fechaISO);
        } else {
          availableDates.add(fechaISO);
          if (!dailyIndex.has(fechaISO)) dailyIndex.set(fechaISO, []);
        }
      } else {
        availableDates.add(fechaISO);
      }
    }
  }

  /* =============== Agregados de DAÑADOS desde LE_pedidos (con fecha) =============== */
  function buildDamageFromPedidos() {
    damageAgg = new Map();
    try {
      const pedidos = JSON.parse(localStorage.getItem("LE_pedidos") || "[]");
      if (!Array.isArray(pedidos)) return;

      for (const p of pedidos) {
        const items = Array.isArray(p.items) ? p.items : [];
        const danArr = Array.isArray(p.cantidades_daniado)
          ? p.cantidades_daniado
          : [];

        // Fecha en que ese pedido quedó con daños / devolución
        const fechaDanRaw = firstStr(
          p.fecha_danio,
          p.fechaDanio,
          p.fecha_dañado,
          p.fechaDaniado,
          p.fecha_devolucion,
          p.fechaDevolucion,
          p.fecha_dev,
          p.fecha,
          p.created_at,
          p.createdAt,
          p.Fecha
        );
        const fechaISO = toISOFromAnyFormat(fechaDanRaw);

        items.forEach((it, idx) => {
          const dan = toInt(danArr[idx], 0);
          if (dan <= 0) return; // sólo acumulamos lo realmente dañado

          const nombre = firstStr(it.material, it.nombre, it.descripcion);
          if (!nombre || isPlaceholderName(nombre)) return;

          const id = firstStr(it.id_Material, it.id, it.id_material);
          const matKey = buildMatKey(id, nombre);

          let rec = damageAgg.get(matKey);
          if (!rec) {
            rec = { id_Material: id || "", nombre, detalles: [] };
          }

          rec.detalles.push({
            fecha: fechaISO, // puede ser "" si no hay fecha
            qty: dan,
          });

          damageAgg.set(matKey, rec);
        });
      }
    } catch {
      // si algo truena, simplemente no hay dañados
    }
  }

  // Construye filas de dañados, respetando (opcional) rango de fechas de daño
  function buildDamagedRows(fi = "", ff = "") {
    const out = [];

    damageAgg.forEach((info) => {
      const detalles = Array.isArray(info.detalles) ? info.detalles : [];
      let totalQty = 0;
      let fechaRef = "";

      for (const d of detalles) {
        const f = toISOFromAnyFormat(d.fecha || "");
        const q = toInt(d.qty, 0);
        if (q <= 0) continue;

        // Si hay rango, sólo contamos dentro del rango
        if (fi || ff) {
          if (!f) continue;
          if (fi && f < fi) continue;
          if (ff && f > ff) continue;
        }

        totalQty += q;

        // Nos quedamos con la última fecha dentro del rango
        if (f && (!fechaRef || f > fechaRef)) {
          fechaRef = f;
        }
      }

      if (totalQty <= 0) return;

      const nombre = info.nombre;
      if (!nombre || isPlaceholderName(nombre)) return;

      const id = info.id_Material;
      const clave = getClave(id, nombre);

      out.push({
        id_Material: id,
        nombre,
        clave,
        cantidad: totalQty,
        estado: "dañado",
        fecha: fechaRef,
      });
    });

    out.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return out;
  }

  /* =============== Agregados generales (catálogo) =============== */
  function cantidadCompradaDeMaterial({ id_Material, nombre }) {
    const matKey = buildMatKey(id_Material, nombre);
    return qtyByMatKey.get(matKey) || 0;
  }

  function dedupeMaterialRows(rows) {
    const map = new Map();
    for (const r of rows) {
      const k = buildMatKey(r.id_Material, r.nombre);
      const prev = map.get(k);
      if (prev) {
        prev.cantidad = cantidadCompradaDeMaterial({
          id_Material: r.id_Material,
          nombre: r.nombre,
        });
        if (!prev.clave && r.clave) prev.clave = r.clave;
        if ((r.nombre || "").length > (prev.nombre || "").length)
          prev.nombre = r.nombre;
      } else {
        map.set(k, { ...r });
      }
    }
    return [...map.values()].map((x) => {
      x.estado = x.cantidad > 0 ? "disponible" : "dañado";
      return x;
    });
  }

  function normalizarDesdeCatalogo(m) {
    const id_Material = String(
      firstStr(m.id_Material, m.id, m.ID, m.id_material)
    ).trim();
    const nombre = resolveName(
      id_Material,
      firstStr(
        m.nombre,
        m.Nombre,
        m.descripcion,
        m.Descripcion,
        m.material,
        m.Material
      )
    );
    if (!nombre || isPlaceholderName(nombre)) return null;

    const clave = getClave(id_Material, nombre);

    const cantidad = cantidadCompradaDeMaterial({ id_Material, nombre });
    const k = buildMatKey(id_Material, nombre);
    const meta = metaByKey.get(k);
    const fecha = meta?.lastDate || "";
    return {
      id_Material,
      nombre,
      clave,
      cantidad,
      estado: cantidad > 0 ? "disponible" : "dañado",
      fecha,
    };
  }

  /* =============== Carga principal de datos =============== */
  async function cargarDatos() {
    localCatalogCache = null; // refrescar catálogos LS
    const catalogo = await getCatalogFromMaterialJS();
    buildCatalogIndexes(catalogo);

    const detCompras    = readComprasFromLocalStorage();
    const detDetalleAll = readDetalleAllFromLS();
    const detalle       = mergeDetalle(detCompras, detDetalleAll);

    buildQtyAndDailyIndexes(detalle);
    ensureForcedDates();

    // NUEVO: leer lo dañado desde LE_pedidos (con fecha)
    buildDamageFromPedidos();

    let base = [];

    if (Array.isArray(catalogo) && catalogo.length) {
      base = catalogo.map(normalizarDesdeCatalogo).filter(Boolean);
    } else {
      let matsLS = [];
      try {
        matsLS = JSON.parse(localStorage.getItem("LE_materiales") || "[]") || [];
      } catch {}

      if (Array.isArray(matsLS) && matsLS.length) {
        base = matsLS.map(normalizarDesdeCatalogo).filter(Boolean);
      } else {
        const byKey = new Map();
        for (const r of detalle || []) {
          const name = resolveName(r.id_Material, r.nombre);
          if (!name || isPlaceholderName(name)) continue;

          const k = buildMatKey(r.id_Material, name);
          const cantidad = toInt(r.cantidad, 0);
          const meta = metaByKey.get(k);
          const fecha = meta?.lastDate || r.fecha || "";
          const clave = getClave(r.id_Material, name);

          const prev = byKey.get(k);
          if (prev) {
            prev.cantidad += cantidad;
            if (!prev.fecha && fecha) prev.fecha = fecha;
            if (!prev.clave && clave) prev.clave = clave;
          } else {
            byKey.set(k, {
              id_Material: r.id_Material,
              nombre: name,
              clave,
              cantidad,
              estado: cantidad > 0 ? "disponible" : "dañado",
              fecha,
            });
          }
        }
        base = [...byKey.values()];
      }
    }

    datosBase = dedupeMaterialRows(base);
    datosVisibles = datosBase.slice();
  }

  /* ======== Total general ======== */
  function actualizarTotalGeneral() {
    const span = $("totalGeneral");
    if (!span) return;
    const total = datosVisibles.reduce(
      (s, r) => s + toInt(r.cantidad, 0),
      0
    );
    span.textContent = total;
  }

  /* =============== Scrollbar bonito extra (por si no carga el CSS) =============== */
  function injectScrollbarCSS() {
    const style = document.createElement("style");
    style.textContent = `
      #inventarioScrollWrap {
        max-height: 420px;
        overflow-y: auto;
        border-radius: 10px;
        border: 1px solid #e5e7eb;
        box-shadow: 0 2px 6px rgba(15,23,42,.08);
        background: #ffffff;
      }
      #inventarioScrollWrap::-webkit-scrollbar {
        width: 8px;
      }
      #inventarioScrollWrap::-webkit-scrollbar-track {
        background: #f9fafb;
        border-radius: 999px;
      }
      #inventarioScrollWrap::-webkit-scrollbar-thumb {
        background: #d1d5db;
        border-radius: 999px;
      }
      #inventarioScrollWrap::-webkit-scrollbar-thumb:hover {
        background: #9ca3af;
      }
      #inventarioScrollWrap {
        scrollbar-width: thin;
        scrollbar-color: #d1d5db #f9fafb;
      }

      /* En modo impresión, quitar límite de altura y scroll para que se vea TODO
         lo que está filtrado en ese momento */
      @media print {
        body {
          background: #fff !important;
        }
        #inventarioScrollWrap {
          max-height: none !important;
          overflow: visible !important;
          box-shadow: none !important;
          border: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /* =============== Render =============== */
  function renderTabla(arr) {
    const tbody = $("tablaInventario");
    if (!tbody) return;

    // Envolver la tabla en un contenedor con scroll (una sola vez)
    let table = tbody.closest("table");
    if (table && !table.dataset.hasScrollWrap) {
      const wrap = document.createElement("div");
      wrap.id = "inventarioScrollWrap";

      const parent = table.parentElement;
      if (parent) {
        parent.insertBefore(wrap, table);
        wrap.appendChild(table);
      } else {
        document.body.appendChild(wrap);
        wrap.appendChild(table);
      }

      table.dataset.hasScrollWrap = "1";
    }

    // --- Resumen (chips de disponibles / dañados) ---
    let resumen = document.getElementById("resumenInventario");
    if (!resumen) {
      table = tbody.closest("table");
      const container = document.getElementById("inventarioScrollWrap") || table?.parentElement;
      if (container && container.parentElement) {
        resumen = document.createElement("div");
        resumen.id = "resumenInventario";
        resumen.style.display = "flex";
        resumen.style.flexWrap = "wrap";
        resumen.style.gap = "8px";
        resumen.style.margin = "8px 0 10px";
        container.parentElement.insertBefore(resumen, container);
      }
    }
    if (resumen) {
      const totalDisp = arr
        .filter((x) => x.estado === "disponible")
        .reduce((s, r) => s + toInt(r.cantidad, 0), 0);
      const totalDan = arr
        .filter((x) => x.estado === "dañado")
        .reduce((s, r) => s + toInt(r.cantidad, 0), 0);

      resumen.innerHTML = `
        <span style="
          padding:4px 10px;
          border-radius:999px;
          background:#ecfdf3;
          color:#166534;
          font-weight:600;
          font-size:13px;
        ">
          Disponibles: ${totalDisp}
        </span>
        <span style="
          padding:4px 10px;
          border-radius:999px;
          background:#fef2f2;
          color:#b91c1c;
          font-weight:600;
          font-size:13px;
        ">
          Dañados: ${totalDan}
        </span>
      `;
    }

    tbody.innerHTML = "";
    if (!arr.length) {
      tbody.innerHTML =
        '<tr><td colspan="3" style="text-align:center;padding:20px;">No se encontraron resultados</td></tr>';
      actualizarTotalGeneral();
      return;
    }

    const frag = document.createDocumentFragment();
    const hasDisp = arr.some((x) => x.estado === "disponible");
    const hasDan  = arr.some((x) => x.estado === "dañado");
    let separatorInserted = false;

    for (const it of arr) {
      // Fila separadora antes del primer dañado si estamos en "Todos"
      if (
        it.estado === "dañado" &&
        hasDisp &&
        hasDan &&
        !separatorInserted
      ) {
        separatorInserted = true;
        const sep = document.createElement("tr");
        sep.innerHTML = `
          <td colspan="3" style="
            background:#7f1d1d;
            color:#fff;
            font-weight:700;
            text-align:center;
            padding:6px 10px;
            font-size:13px;
            letter-spacing:.03em;
          ">
            Materiales dañados
          </td>`;
        frag.appendChild(sep);
      }

      const tr = document.createElement("tr");

      const color = it.estado === "dañado" ? "#b91c1c" : "#166534";

      if (it.estado === "dañado") {
        tr.style.backgroundColor = "#fee2e2";
      }

      tr.innerHTML = `
        <td style="color:${color}; font-weight:600;">
          ${it.nombre}
        </td>
        <td>${it.clave || ""}</td>
        <td>${it.cantidad}</td>`;
      frag.appendChild(tr);
    }
    tbody.appendChild(frag);
    actualizarTotalGeneral();
  }

  /* =============== Filtros =============== */

  function filtersActive() {
    const estado = sanitizeEstadoValue($("filtroEstado")?.value || "");
    const fi = getFechaInicialISO();
    const ff = getFechaFinalISO();
    return !!(estado || fi || ff);
  }

  function aplicarFiltros() {
    const estadoSel = sanitizeEstadoValue($("filtroEstado")?.value || "");
    const fi = getFechaInicialISO();
    const ff = getFechaFinalISO();

    const withinRange = (fecha) => {
      if (!fi && !ff) return true;
      const f = toISOFromAnyFormat(fecha || "");
      if (!f) return false;
      if (fi && f < fi) return false;
      if (ff && f > ff) return false;
      return true;
    };

    let out = [];

    if (estadoSel === "dañado") {
      // Sólo dañados, con rango de fechas de daño
      out = buildDamagedRows(fi, ff);
    } else if (estadoSel === "disponible") {
      // Sólo disponibles
      out = datosBase
        .filter((x) => x.estado === "disponible")
        .filter((x) => withinRange(x.fecha));
    } else {
      // Todos: disponibles + dañados
      const combined = buildAllWithDamaged().filter((x) => withinRange(x.fecha));
      out = combined;
    }

    datosVisibles = out;
    renderTabla(datosVisibles);
    updateButtonsState();
  }

  function limpiarFiltros() {
    const selEstado = $("filtroEstado");
    const dIni = $("filtroFechaInicial");
    const dFin = $("filtroFechaFinal");

    if (selEstado) selEstado.value = "";
    if (dIni) dIni.value = "";
    if (dFin) dFin.value = "";

    toggleDateFields();

    // Volver a la vista por defecto: TODOS (disponibles + dañados)
    datosVisibles = buildAllWithDamaged();
    renderTabla(datosVisibles);
    updateButtonsState();
  }

  /* =============== Export =============== */
  // CSV con LO QUE ESTÁ EN PANTALLA (datosVisibles), con filtros aplicados
  function exportarCSV() {
    const fuente = datosVisibles.length ? datosVisibles : datosBase;

    const rows = [
      ["Nombre material", "Clave", "Cantidad", "Estado", "Fecha"],
      ...fuente.map((x) => [
        x.nombre,
        x.clave || "",
        x.cantidad,
        x.estado,
        x.fecha,
      ]),
    ];
    const csv = rows
      .map((r) =>
        r
          .map((c) => {
            const s = String(c ?? "");
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",")
      )
      .join("\n");
    descargarBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `reporte-inventario-${toISO(Date.now())}.csv`
    );
  }

  // PDF con LO QUE ESTÁ EN PANTALLA (datosVisibles)
  // El @media print se encarga de quitar el scroll y mostrar todo
  function exportarPDF() {
    // truco pequeño: agregar una clase para estilos extra si quieres
    document.body.classList.add("print-inventario");
    window.print();
    document.body.classList.remove("print-inventario");
  }

  /* =============== Botones/Inputs =============== */
  function updateButtonsState() {
    const btnAplicar = $("btnAplicar");
    const btnLimpiar = $("btnLimpiar");
    const btnExcel = $("btnExcel");
    const btnPDF = $("btnPDF");

    if (btnAplicar) btnAplicar.disabled = false;
    if (btnLimpiar) btnLimpiar.disabled = !filtersActive();

    const hasRows = datosVisibles.length > 0;
    if (btnExcel) btnExcel.disabled = !hasRows;
    if (btnPDF) btnPDF.disabled = !hasRows;
  }

  function toggleDateFields() {
    const estadoSel = sanitizeEstadoValue($("filtroEstado")?.value || "");
    const showRange = estadoSel === "dañado";

    const fieldIni = $("fieldFechaInicial");
    const fieldFin = $("fieldFechaFinal");
    const inIni = $("filtroFechaInicial");
    const inFin = $("filtroFechaFinal");

    if (fieldIni) fieldIni.style.display = showRange ? "flex" : "none";
    if (fieldFin) fieldFin.style.display = showRange ? "flex" : "none";

    // Si se quita la opción de dañados, reseteamos fechas
    if (!showRange) {
      if (inIni) inIni.value = "";
      if (inFin) inFin.value = "";
    }
  }

  function wireFilterInputs() {
    const inFechaIni = $("filtroFechaInicial");
    const inFechaFin = $("filtroFechaFinal");
    const today = todayISO();
    if (inFechaIni) inFechaIni.setAttribute("max", today);
    if (inFechaFin) inFechaFin.setAttribute("max", today);

    ["filtroEstado", "filtroFechaInicial", "filtroFechaFinal"].forEach((id) => {
      $(id)?.addEventListener("input", updateButtonsState);
      $(id)?.addEventListener("change", updateButtonsState);
    });

    $("filtroEstado")?.addEventListener("change", () => {
      toggleDateFields();
      updateButtonsState();
    });

    toggleDateFields();
    updateButtonsState();
  }

  /* =============== Helper: vista TODOS (disponibles + dañados) =============== */
  function buildAllWithDamaged() {
    const base = datosBase.slice();       // disponibles / catálogo
    const danados = buildDamagedRows();   // dañados globales (todas las fechas)

    const combined = base.map((x) => ({ ...x }));

    danados.forEach((d) => {
      combined.push({
        ...d,
        nombre: `${d.nombre} (dañado)`,
      });
    });

    // Ordenar: primero disponibles, luego dañados, alfabético
    combined.sort((a, b) => {
      if (a.estado === b.estado) {
        return a.nombre.localeCompare(b.nombre, "es");
      }
      return a.estado === "disponible" ? -1 : 1;
    });

    return combined;
  }

  /* =============== Auto-Refresh / Init =============== */
  async function refreshFromSources() {
    await cargarDatos();

    if (filtersActive()) {
      // Si hay filtros activos, respetarlos
      aplicarFiltros();
    } else {
      // Si NO hay filtros, mostrar TODOS (disponibles + dañados)
      datosVisibles = buildAllWithDamaged();
      renderTabla(datosVisibles);
    }

    updateButtonsState();
  }

  window.addEventListener("storage", (e) => {
    if (
      e.key === "LE_compras" ||
      e.key === "LE_compra_detalle" ||
      e.key === "LE_materiales" ||
      e.key === "LE_MATERIALES_LOCAL" ||
      e.key === "LE_pedidos"
    ) {
      refreshFromSources();
    }
  });
  document.addEventListener("compras:updated", refreshFromSources);
  window.InventoryReportRefresh = refreshFromSources;

  document.addEventListener("DOMContentLoaded", async () => {
    $("btnBack")?.addEventListener("click", () => history.back());

    injectScrollbarCSS();

    await refreshFromSources();
    wireFilterInputs();

    $("btnAplicar")?.addEventListener("click", aplicarFiltros);
    $("btnLimpiar")?.addEventListener("click", limpiarFiltros);
    $("btnExcel")?.addEventListener("click", exportarCSV);
    $("btnPDF")?.addEventListener("click", exportarPDF);
  });
})();
