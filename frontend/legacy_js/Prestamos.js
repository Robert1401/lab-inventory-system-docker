"use strict";

/* =========================================
   Prestamos.js (Auxiliar)

   Flujo general
   -------------
   1) confirmacion.js genera LE_vale_payload con:
        - fecha, hora, noVale, materia, maestro, mesa
        - alumno: { nombreCompleto, noControl }
        - items: [ { material, cantidad, descripcion } ]

   2) Aquí:
      - Leemos LE_vale_payload como "solicitud pendiente".
      - Mientras el estado LE_prestamo_status = "pendiente":
          • La tabla muestra los materiales.
          • Los datos de meta se llenan SOLO cuando el auxiliar
            hace clic en la fila (solicitudActiva = true).
      - Al aprobar:
          • Guardamos LE_prestamo_data con estado "en_curso".
          • Registramos salida en LE_pedidos (historial).
          • Borramos LE_vale_payload (ya está en curso).
      - Al rechazar:
          • Guardamos LE_prestamo_data con estado "rechazado".
          • Borramos la entrada del historial para ese vale.
          • Borramos LE_vale_payload.

      - En fase de devolución (cuando otro módulo marca
        devuelto_solicitado = true en LE_prestamo_data):
          • SOLO mostramos campos de cantidad:
               - piezas en buen estado
               - piezas dañadas
          • La condición ("ok", "leve", "daniado") se calcula
            automáticamente a partir de esas cantidades.
          • Al aprobar/rechazar devolución, cerramos el préstamo
            con estado "devuelto" y actualizamos LE_pedidos.

   Importante para varios alumnos
   ------------------------------
   Cada registro en LE_pedidos incluye:
      - folio / noVale
      - alumno: { nombre, noControl }
      - noControl (a nivel raíz para filtrar fácil)

   Además, ahora LE_pedidos guarda:
      - condiciones: ["ok" | "leve" | "daniado" ...] por cada item
      - cantidades_ok: [número] por item
      - cantidades_daniado: [número] por item

========================================= */

const KEYS = {
  VALE:   "LE_vale_payload",
  FORM:   "LE_form_ctx",
  USER:   "LE_user",
  TMP:    "LE_tmp_solicitud_vale",
  NUM:    "LE_num_vale",
  STATUS: "LE_prestamo_status",
  DATA:   "LE_prestamo_data"
};

/* ====== flag para saber si el auxiliar ya "seleccionó" la solicitud ====== */
let solicitudActiva = false;

/* ============ Helpers ============ */
const $  = (id) => document.getElementById(id);
const qs = (s)  => document.querySelector(s);
const readJSON = (k, fb = null) => {
  try {
    return JSON.parse(localStorage.getItem(k) || "null") ?? fb;
  } catch {
    return fb;
  }
};
const setJSON  = (k,v) => localStorage.setItem(k, JSON.stringify(v));

const nowHMS = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
};
const todayISO = () => new Date().toISOString().slice(0,10);

const titleCase = (s="") =>
  String(s).toLowerCase().split(/\s+/).filter(Boolean)
    .map(w => w[0].toUpperCase()+w.slice(1)).join(" ");

/* Normaliza items para que siempre tengan material / cantidad / descripcion */
const normalizeItemsAny = (items) => Array.isArray(items)
  ? items.map(x => ({
      material   : x.material ?? x.nombre ?? x.name ?? x.etiqueta ?? "",
      cantidad   : Number.isFinite(x.cantidad) ? x.cantidad : parseInt(x.cantidad,10) || 1,
      descripcion: x.descripcion ?? x.desc ?? x.detalle ?? (x.material ?? x.nombre ?? "")
    }))
  : [];

/* ============ Toast mini ============ */
function toast(msg, type="info", ms=1400){
  const id="toast-prestamos";
  let host=document.getElementById(id);
  if(!host){
    host=document.createElement("div");
    host.id=id;
    host.style.cssText="position:fixed;inset:auto 20px 20px auto;z-index:99999;max-width:360px";
    document.body.appendChild(host);
  }
  const card=document.createElement("div");
  card.style.cssText="margin-top:10px;border-radius:12px;padding:10px 12px;color:#fff;box-shadow:0 10px 24px rgba(0,0,0,.25);font:14px/1.3 system-ui,Segoe UI,Roboto,Arial";
  card.style.background = type==="success" ? "#065f46"
                     : type==="error"   ? "#991b1b"
                     : type==="warn"    ? "#92400e"
                     : "#1f2937";
  card.textContent=msg;
  host.appendChild(card);
  setTimeout(()=>card.remove(), ms);
}

/* ============ Notify centrado ============ */
function notify(message, type = "info", opts = {}) {
  const host = $("notify");
  if (!host) return;

  const title = opts.title || (type === "ok" ? "Éxito" : type === "err" ? "Error" : "Aviso");
  const autoClose = Number.isFinite(opts.autoClose) ? opts.autoClose : 1500;
  const buttons = Array.isArray(opts.buttons) ? opts.buttons : [];
  const btnsHTML = buttons.map((b,i)=>`<button type="button" class="nbtn ${b.kind||"nbtn-ghost"}" data-idx="${i}">${b.text}</button>`).join("");

  host.innerHTML = `
    <style>
      #notify{ display:grid; place-items:center; position:fixed; inset:0; pointer-events:none; z-index:99999 }
      #notify .card{min-width:280px;max-width:520px;border-radius:16px;padding:14px 16px;color:#fff;
        box-shadow:0 18px 48px rgba(0,0,0,.28);font-weight:600;opacity:0;transform:translateY(10px) scale(.98);
        transition:opacity .22s ease,transform .22s ease; pointer-events:auto}
      #notify.show .card{opacity:1;transform:translateY(0) scale(1)}
      .ok{background:#065f46}.err{background:#991b1b}.info{background:#1f2937}
      .title-mini{font-weight:800;margin:0 0 4px;font-size:14px}
      .nrow{display:flex;gap:10px;justify-content:flex-end;margin-top:6px}
      .nbtn{padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.25);
            background:rgba(255,255,255,.12);color:#fff;cursor:pointer;font-weight:700}
      .nbtn:hover{filter:brightness(1.08)}
      .nbtn-primary{background:#fff;color:#065f46;border-color:#fff}
      .nbtn-danger{background:#fff;color:#991b1b;border-color:#fff}
    </style>
    <div class="card ${type}">
      <div class="title-mini">${title}</div>
      <div>${message}</div>
      ${btnsHTML?`<div class="nrow">${btnsHTML}</div>`:""}
    </div>`;
  host.classList.add("show");

  if (buttons.length){
    host.querySelectorAll(".nbtn").forEach(btn=>{
      btn.addEventListener("click",(e)=>{
        const idx=parseInt(e.currentTarget.dataset.idx,10);
        const def=buttons[idx];
        try{ def?.action?.(); }finally{
          host.classList.remove("show");
          host.innerHTML="";
        }
      });
    });
  }

  clearTimeout(notify._t);
  if (autoClose && !buttons.length){
    notify._t = setTimeout(()=>{
      host.classList.remove("show");
      host.innerHTML="";
    }, autoClose);
  }
}

/* ============ Estado & payload ============ */
const getStatus = ()=> localStorage.getItem(KEYS.STATUS) || "pendiente";
const setStatus = (v)=> localStorage.setItem(KEYS.STATUS, v);

/**
 * IMPORTANTE:
 * Ya NO generamos fecha/hora por defecto desde aquí.
 * Solo usamos lo que venga de:
 *   - LE_vale_payload (principal, desde confirmacion.js)
 *   - LE_prestamo_data (cuando ya está en curso / devuelto)
 */
function getPayload(){
  // 1) Primero intentamos leer el VALE que creó confirmacion.js
  let p = readJSON(KEYS.VALE, null);

  // 2) Si no existe, intentamos reconstruir desde LE_prestamo_data
  if (!p) {
    const d = readJSON(KEYS.DATA, null);
    if (d && d.items) {
      const al = d.alumno || {};
      p = {
        fecha:   d.fecha   || "",
        hora:    d.hora    || "",
        noVale:  d.noVale  || d.folio || "",
        materia: d.materia || "",
        maestro: d.maestro || "",
        mesa:    d.mesa    || "",
        alumno:  {
          nombreCompleto: al.nombreCompleto || al.nombre || d.alumnoNombre || "",
          noControl:      al.noControl || d.noControl || ""
        },
        items:   normalizeItemsAny(d.items)
      };
    } else {
      p = {};
    }
  }

  p.items = normalizeItemsAny(p.items || []);

  const alumnoNombre = p.alumno?.nombreCompleto || p.alumno?.nombre || "";
  const alumnoNoCtrl = p.alumno?.noControl || "";

  return {
    fecha:     p.fecha   || "",
    hora:      p.hora    || "",
    noVale:    p.noVale  || "",
    materia:   p.materia || "",
    maestro:   p.maestro || "",
    mesa:      p.mesa    || "",
    alumno:    titleCase(alumnoNombre || "Alumno"),
    noControl: String(alumnoNoCtrl || "").trim(),
    items:     p.items
  };
}

/* ============ Notificación al alumno (simulada con localStorage) ============ */
function pushAlumnoInbox(noControl, mensaje){
  if(!noControl || !mensaje) return;
  const key = `LE_inbox_${noControl}`;
  const inbox = readJSON(key, []);
  inbox.push({ ts: `${todayISO()} ${nowHMS()}`, mensaje });
  setJSON(key, inbox);
}

/* ============ Registrar salidas para STOCK/HISTORIAL (LE_pedidos) ============ */
function registrarSalidaEnPedidos(p){
  const hist = readJSON("LE_pedidos", []) || [];
  const folio = p.noVale;

  const baseReg = {
    folio      : folio,
    noVale     : folio,
    fecha      : p.fecha,
    hora       : p.hora || nowHMS(),
    materia    : p.materia,
    maestro    : p.maestro,
    mesa       : p.mesa,
    alumno     : { nombre: p.alumno, noControl: p.noControl },
    noControl  : p.noControl || "",
    items      : (p.items || []).map(it => ({
      material: it.material || it.descripcion || "",
      cantidad: it.cantidad || 0
    })),
    condiciones: [],
    cantidades_ok: [],
    cantidades_daniado: [],
    estado     : "en_curso"
  };

  const idx = hist.findIndex(r => r.folio === folio || r.noVale === folio);
  if (idx >= 0) {
    hist[idx] = { ...hist[idx], ...baseReg, estado: "en_curso" };
  } else {
    hist.push(baseReg);
  }
  setJSON("LE_pedidos", hist);
}

/* Actualiza un pedido existente (estado, condiciones, items...) */
function actualizarEstadoPedido(folio, nuevoEstado, extra = {}){
  if(!folio) return;
  const hist = readJSON("LE_pedidos", []) || [];
  let cambio = false;

  hist.forEach(p => {
    if (p.folio === folio || p.noVale === folio){
      p.estado = nuevoEstado;
      if (nuevoEstado === "devuelto") {
        p.devuelto_en = `${todayISO()} ${nowHMS()}`;
      }
      if (Array.isArray(extra.condiciones)) {
        p.condiciones = extra.condiciones.slice();
      }
      if (Array.isArray(extra.items)) {
        p.items = (extra.items || []).map((it, idx) => ({
          material : it.material || it.descripcion || it.nombre || (p.items?.[idx]?.material) || "",
          cantidad : it.cantidad || p.items?.[idx]?.cantidad || 0
        }));
      }
      if (Array.isArray(extra.cantidades_ok)) {
        p.cantidades_ok = extra.cantidades_ok.slice();
      }
      if (Array.isArray(extra.cantidades_daniado)) {
        p.cantidades_daniado = extra.cantidades_daniado.slice();
      }
      cambio = true;
    }
  });

  if(cambio) setJSON("LE_pedidos", hist);
}

/* Elimina un pedido (cuando se rechaza antes de que salga el material) */
function eliminarPedido(folio){
  if(!folio) return;
  const hist = readJSON("LE_pedidos", []) || [];
  const nuevo = hist.filter(p => p.folio !== folio && p.noVale !== folio);
  setJSON("LE_pedidos", nuevo);
}

/* (Opcional) util para historial: pedidos de un alumno específico */
function getPedidosPorAlumno(noControl){
  const hist = readJSON("LE_pedidos", []) || [];
  return hist.filter(p => (p.noControl || p.alumno?.noControl) === noControl);
}
window.LE_getPedidosPorAlumno = getPedidosPorAlumno;

/* ====== Registrar daños a partir de la devolución ====== */
/**
 * baseItems: lista de items (data.items o p.items)
 * cantidadesDaniado: arreglo con cantidades dañadas por índice
 * data/p: datos del préstamo / payload (para folio, alumno, etc.)
 */
function registrarDaniosDesdeDevolucion(baseItems, cantidadesDaniado, data, p) {
  const matsLS = readJSON("LE_materiales", []) || [];

  const normName = (s = "") =>
    String(s)
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();

  // Mapa nombre-normalizado -> id_Material
  const mapNombreId = new Map();
  matsLS.forEach((m) => {
    const nombre =
      m.nombre ||
      m.descripcion ||
      m.material ||
      m.etiqueta ||
      "";
    const id =
      m.id_Material ??
      m.id_material ??
      m.id ??
      m.ID ??
      null;

    if (!nombre || id == null) return;

    const k = normName(nombre);
    if (!mapNombreId.has(k)) {
      mapNombreId.set(k, String(id));
    }
  });

  const danos = readJSON("LE_danios", []) || [];
  const movs  = readJSON("LE_movimientos", []) || [];

  baseItems.forEach((it, idx) => {
    const bad = Number(cantidadesDaniado[idx]) || 0;
    if (bad <= 0) return;

    const nombre = it.material || it.descripcion || "Material";
    const k      = normName(nombre);
    const idMat  = mapNombreId.get(k) || null;

    const regBase = {
      id_Material: idMat,
      material   : nombre,
      cantidad   : bad,
      fecha      : todayISO(),
      hora       : nowHMS(),
      folio      : data.noVale || data.folio || p.noVale || "",
      origen     : "devolucion",
      alumno     : {
        nombre   : p.alumno,
        noControl: p.noControl
      }
    };

    // Registro en LE_danios (tabla específica de daños)
    danos.push(regBase);

    // Registro en LE_movimientos como movimiento de "Daño"
    movs.push({
      ...regBase,
      tipo_movimiento: "Daño"
    });
  });

  setJSON("LE_danios", danos);
  setJSON("LE_movimientos", movs);
}

/* ====== Devolución: validaciones ====== */

/** Valida que buen estado + dañado <= total y actualiza botones */
function validarCantidadesFila(okInput, badInput, total) {
  const ok  = parseInt(okInput.value || "0", 10)  || 0;
  const bad = parseInt(badInput.value || "0", 10) || 0;

  if (ok + bad > total) {
    badInput.value = Math.max(0, total - ok);
    toast("La suma no puede ser mayor a la cantidad prestada.", "warn");
  }
  updateButtonsDevolucion();
}

/** Habilita / deshabilita Aprobar / Rechazar según estén completas las filas */
function updateButtonsDevolucion(){
  const okInputs  = document.querySelectorAll(".cant-ok");
  const badInputs = document.querySelectorAll(".cant-daniado");

  const btnA = $("btnAprobar");
  const btnR = $("btnRechazar");

  if (!okInputs.length || okInputs.length !== badInputs.length) {
    if (btnA) btnA.disabled = true;
    if (btnR) btnR.disabled = true;
    return;
  }

  let allValid = true;

  okInputs.forEach((inpOk, idx) => {
    const inpBad = badInputs[idx];
    if (!inpBad) {
      allValid = false;
      return;
    }
    const total = Number(inpOk.dataset.totalItem || inpBad.dataset.totalItem || 0);
    const ok  = parseInt(inpOk.value  || "0", 10)  || 0;
    const bad = parseInt(inpBad.value || "0", 10)  || 0;

    if (total > 0) {
      // exigimos que todas las piezas queden clasificadas
      if (ok < 0 || bad < 0 || ok + bad !== total) {
        allValid = false;
      }
    }
  });

  if (btnA) btnA.disabled = !allValid;
  if (btnR) btnR.disabled = !allValid;
}

/* ============ Render ============ */
function render(){
  const p  = getPayload();
  const st = getStatus();
  const data = readJSON(KEYS.DATA, {}) || {};
  const devueltoPendiente = st === "en_curso" && data.devuelto_solicitado === true;

  const previewPendiente = (st === "pendiente" && !solicitudActiva);

  const debeOcultarMeta =
    previewPendiente ||
    (st === "en_curso" && !devueltoPendiente) ||
    st === "rechazado" ||
    st === "devuelto";

  if (debeOcultarMeta) {
    $("fldFecha")     && ( $("fldFecha").textContent   = "— — —" );
    $("fldHora")      && ( $("fldHora").textContent    = "— — —" );
    $("fldNoVale")    && ( $("fldNoVale").textContent  = "— — —" );
    $("fldMateria")   && ( $("fldMateria").value       = "" );
    $("fldMaestro")   && ( $("fldMaestro").value       = "" );
    $("fldMesa")      && ( $("fldMesa").value          = "" );
    $("fldNoControl") && ( $("fldNoControl").value     = "" );
  } else {
    $("fldFecha")     && ( $("fldFecha").textContent   = p.fecha || "— — —" );
    $("fldHora")      && ( $("fldHora").textContent    = p.hora  || "— — —" );
    $("fldNoVale")    && ( $("fldNoVale").textContent  = p.noVale|| "— — —" );
    $("fldMateria")   && ( $("fldMateria").value       = p.materia || "" );
    $("fldMaestro")   && ( $("fldMaestro").value       = p.maestro || "" );
    $("fldMesa")      && ( $("fldMesa").value          = p.mesa    || "" );
    $("fldNoControl") && ( $("fldNoControl").value     = p.noControl || "" );
  }

  const tb = $("tbodyMat");
  if (!tb) return;

  tb.innerHTML = "";
  const hasItems = p.items.length > 0;

  // Sin materiales
  if (!hasItems){
    tb.innerHTML = `<tr><td colspan="4" class="empty">Sin materiales</td></tr>`;
  } else if (st === "en_curso" && !devueltoPendiente) {
    // Ya aceptado, en uso
    tb.innerHTML = `
      <tr>
        <td colspan="4" class="empty">
          Ya aceptaste el préstamo del alumno <b>${p.alumno}</b>.<br>
          Material en uso. Esperando devolución.
        </td>
      </tr>`;
  } else if (st === "rechazado") {
    tb.innerHTML = `
      <tr>
        <td colspan="4" class="empty">
          La solicitud de préstamo del alumno <b>${p.alumno}</b> fue rechazada por el auxiliar.
        </td>
      </tr>`;
  } else if (st === "devuelto") {
    tb.innerHTML = `
      <tr>
        <td colspan="4" class="empty">
          Préstamo cerrado. Material devuelto y registrado.
        </td>
      </tr>`;
  } else {
    // pendiente o devolución en revisión → mostramos fila resumen del VALE
    const tr = document.createElement("tr");

    const totalGlobal = p.items.reduce(
      (s,it)=> s + (Number(it.cantidad) || 0),
      0
    );
    tr.dataset.total = String(totalGlobal);

    const tdAlumno = document.createElement("td");
    const tdMat    = document.createElement("td");
    const tdCant   = document.createElement("td");
    const tdEstado = document.createElement("td");

    // ==== Columna Alumno ====
    tdAlumno.innerHTML = `
      <div style="font-weight:600;">${p.alumno || "—"}</div>
      <div style="font-size:12px;color:#4b5563;">No. Control: ${p.noControl || "—"}</div>
    `;

    // ==== Columna Materiales (lista) ====
    if (p.items.length) {
      const list = document.createElement("ol");
      list.style.margin = "0";
      list.style.paddingLeft = "18px";
      list.style.fontSize = "13px";
      p.items.forEach((it) => {
        const li = document.createElement("li");
        const q = Number(it.cantidad) || 0;
        li.textContent = `${it.material || it.descripcion || "—"} — ${q} pza${q===1?"":"s"}`;
        list.appendChild(li);
      });
      tdMat.appendChild(list);
    } else {
      tdMat.textContent = "Sin materiales";
    }

    // ==== Columna Cantidad total ====
    tdCant.textContent = totalGlobal || 0;
    tdCant.style.textAlign = "center";
    tdCant.style.fontWeight = "600";

    // ==== Columna Estado ====
    if (st === "pendiente") {
      tdEstado.style.fontWeight = "600";
      if (previewPendiente) {
        tdEstado.textContent = "Haz clic para revisar";
        tdEstado.style.color = "#7a0000";
        tr.style.cursor = "pointer";
        tr.addEventListener("click", () => {
          solicitudActiva = true;
          render();
        });
      } else {
        tdEstado.textContent = "En espera de aprobación";
        tdEstado.style.color = "#7a0000";
      }
    } else if (devueltoPendiente) {
      tdEstado.style.background = "#7a0000";
      tdEstado.style.padding = "6px 10px";
      tdEstado.style.color = "#fff";
      tdEstado.style.fontSize = "12px";

      const arrOk  = Array.isArray(data.cantidades_ok) ? data.cantidades_ok : [];
      const arrBad = Array.isArray(data.cantidades_daniado) ? data.cantidades_daniado : [];

      const wrap = document.createElement("div");
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.gap = "6px";

      (data.items || p.items || []).forEach((it, idx) => {
        const total = Number(it.cantidad) || 0;

        const block = document.createElement("div");
        block.style.borderRadius = "6px";
        block.style.background = "rgba(0,0,0,.15)";
        block.style.padding = "4px 6px";

        const titulo = document.createElement("div");
        titulo.style.fontWeight = "700";
        titulo.style.marginBottom = "2px";
        titulo.textContent = `${it.material || it.descripcion || "Material"} (${total} pzas)`;

        const grid = document.createElement("div");
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "1fr 1fr";
        grid.style.gap = "4px";

        const bloqueOk = document.createElement("div");
        const bloqueBad = document.createElement("div");

        bloqueOk.innerHTML = `<div style="margin-bottom:2px;">✅ Buen estado</div>`;
        bloqueBad.innerHTML = `<div style="margin-bottom:2px;">⛔ Dañado</div>`;

        const inpOk = document.createElement("input");
        inpOk.type = "number";
        inpOk.min = "0";
        inpOk.max = String(total);
        inpOk.className = "cant-ok";
        inpOk.dataset.index = String(idx);
        inpOk.dataset.totalItem = String(total);
        inpOk.style.width = "100%";
        inpOk.style.padding = "4px 6px";
        inpOk.style.borderRadius = "6px";
        inpOk.style.border = "none";
        inpOk.style.outline = "none";

        const inpBad = document.createElement("input");
        inpBad.type = "number";
        inpBad.min = "0";
        inpBad.max = String(total);
        inpBad.className = "cant-daniado";
        inpBad.dataset.index = String(idx);
        inpBad.dataset.totalItem = String(total);
        inpBad.style.width = "100%";
        inpBad.style.padding = "4px 6px";
        inpBad.style.borderRadius = "6px";
        inpBad.style.border = "none";
        inpBad.style.outline = "none";

        // Valores iniciales
        inpOk.value  = (arrOk[idx]  != null) ? arrOk[idx]  : total;
        inpBad.value = (arrBad[idx] != null) ? arrBad[idx] : 0;

        inpOk.addEventListener("input", () => {
          validarCantidadesFila(inpOk, inpBad, total);
        });
        inpBad.addEventListener("input", () => {
          validarCantidadesFila(inpOk, inpBad, total);
        });

        bloqueOk.appendChild(inpOk);
        bloqueBad.appendChild(inpBad);

        grid.appendChild(bloqueOk);
        grid.appendChild(bloqueBad);

        block.appendChild(titulo);
        block.appendChild(grid);

        wrap.appendChild(block);
      });

      tdEstado.appendChild(wrap);
    } else {
      tdEstado.textContent = "—";
    }

    tr.appendChild(tdAlumno);
    tr.appendChild(tdMat);
    tr.appendChild(tdCant);
    tr.appendChild(tdEstado);
    tb.appendChild(tr);

    if (devueltoPendiente) {
      updateButtonsDevolucion();
    }
  }

  const hasFechaHora = Boolean(p.fecha) && Boolean(p.hora);

  let canApprove = false;
  let canReject  = false;

  if (st === "pendiente") {
    // Solo se puede aprobar/rechazar cuando el auxiliar ya hizo clic en la fila
    canApprove = hasItems && hasFechaHora && solicitudActiva;
    canReject  = hasItems && solicitudActiva;
  } else if (!devueltoPendiente) {
    canApprove = false;
    canReject  = false;
  }

  if (!devueltoPendiente) {
    $("btnAprobar")  && ( $("btnAprobar").disabled  = !canApprove );
    $("btnRechazar") && ( $("btnRechazar").disabled = !canReject  );
  }
}

/* ============ Acciones ============ */

function aprobar(){
  const p   = getPayload();
  const st  = getStatus();
  const nowISO = `${todayISO()} ${nowHMS()}`;
  const data = readJSON(KEYS.DATA, {}) || {};

  if(!p.items.length){
    notify("No hay materiales en la solicitud.", "err", { autoClose: 1500 });
    return;
  }

  if (st === "pendiente") {
    if(!p.fecha || !p.hora){
      notify("Falta fecha u hora (desde confirmación). No se puede aprobar.", "err", { autoClose: 1600 });
      return;
    }

    const nuevo = {
      estado: "en_curso",
      aprobado_por: "Auxiliar",
      aprobado_en: nowISO,
      noVale: p.noVale,
      fecha: p.fecha,
      hora:  p.hora,
      materia: p.materia,
      maestro: p.maestro,
      mesa:    p.mesa,
      alumno: { nombre: p.alumno, noControl: p.noControl },
      items:  p.items,
      devuelto_solicitado: false,
      condiciones: [],
      cantidades_ok: [],
      cantidades_daniado: []
    };

    setJSON(KEYS.DATA, nuevo);
    setStatus("en_curso");

    registrarSalidaEnPedidos(p);

    localStorage.removeItem(KEYS.VALE);
    localStorage.removeItem(KEYS.FORM);
    localStorage.removeItem(KEYS.TMP);
    localStorage.removeItem(KEYS.NUM);

    pushAlumnoInbox(p.noControl, `Tu solicitud ${p.noVale || ""} fue aprobada. Pasa por el material.`);
    notify(`Ya aceptaste el préstamo del alumno ${p.alumno}.`, "ok", { autoClose: 1600 });
    toast("Aprobado ✔", "success");
    render();
    return;
  }

  // Fase 2: revisar devolución
  if (st === "en_curso" && data.devuelto_solicitado) {
    const baseItems = data.items || p.items || [];
    const condiciones = [];
    const cantidadesOk = [];
    const cantidadesDaniado = [];

    document.querySelectorAll(".cant-ok").forEach(inpOk=>{
      const idx = parseInt(inpOk.dataset.index || "0", 10);
      const inpBad = document.querySelectorAll(".cant-daniado")[idx];
      const total = Number(baseItems[idx]?.cantidad) || 0;

      const ok  = parseInt(inpOk.value  || "0", 10)  || 0;
      const bad = parseInt(inpBad?.value || "0", 10) || 0;

      cantidadesOk[idx]      = ok;
      cantidadesDaniado[idx] = bad;

      let cond;
      if (total <= 0) {
        cond = "ok";
      } else if (bad <= 0 && ok >= total) {
        cond = "ok";
      } else if (bad <= 0 && ok < total) {
        cond = "leve";
      } else {
        cond = "daniado";
      }
      condiciones[idx] = cond;
    });

    // Registrar piezas dañadas como bajas de stock
    registrarDaniosDesdeDevolucion(baseItems, cantidadesDaniado, data, p);

    const nuevo = {
      ...data,
      estado: "devuelto",
      devuelto_en: nowISO,
      condiciones,
      cantidades_ok: cantidadesOk,
      cantidades_daniado: cantidadesDaniado
    };

    setJSON(KEYS.DATA, nuevo);
    setStatus("devuelto");
    localStorage.removeItem(KEYS.VALE);

    actualizarEstadoPedido(
      data.noVale || data.folio || p.noVale,
      "devuelto",
      {
        condiciones,
        items: data.items || p.items,
        cantidades_ok: cantidadesOk,
        cantidades_daniado: cantidadesDaniado
      }
    );

    pushAlumnoInbox(p.noControl, `Tu devolución del vale ${p.noVale || ""} fue aceptada. Ya puedes solicitar nuevo material.`);
    notify("Devolución aceptada. El alumno ya puede volver a solicitar.", "ok", { autoClose: 1800 });
    toast("Devolución OK ✔", "success");
    render();
  }
}

function rechazar(){
  const p   = getPayload();
  const st  = getStatus();
  const nowISO = `${todayISO()} ${nowHMS()}`;
  const data = readJSON(KEYS.DATA, {}) || {};

  if(!p.items.length){
    return;
  }

  if (st === "pendiente") {
    const nuevo = {
      ...data,
      estado: "rechazado",
      rechazado_en: nowISO,
      items: p.items
    };
    setJSON(KEYS.DATA, nuevo);
    setStatus("rechazado");

    eliminarPedido(p.noVale);

    localStorage.removeItem(KEYS.VALE);
    localStorage.removeItem(KEYS.FORM);
    localStorage.removeItem(KEYS.TMP);
    localStorage.removeItem(KEYS.NUM);

    pushAlumnoInbox(p.noControl, `Tu solicitud ${p.noVale || ""} fue rechazada.`);
    notify(`Ya rechazaste el préstamo del alumno ${p.alumno}.`, "info", { autoClose: 1400 });
    toast("Rechazado", "warn");
    render();
    return;
  }

  // Rechazar devolución (registrarla como devuelto con observaciones)
  if (st === "en_curso" && data.devuelto_solicitado) {
    const baseItems = data.items || p.items || [];
    const condiciones = [];
    const cantidadesOk = [];
    const cantidadesDaniado = [];

    document.querySelectorAll(".cant-ok").forEach(inpOk=>{
      const idx = parseInt(inpOk.dataset.index || "0", 10);
      const inpBad = document.querySelectorAll(".cant-daniado")[idx];
      const total = Number(baseItems[idx]?.cantidad) || 0;

      const ok  = parseInt(inpOk.value  || "0", 10)  || 0;
      const bad = parseInt(inpBad?.value || "0", 10) || 0;

      cantidadesOk[idx]      = ok;
      cantidadesDaniado[idx] = bad;

      let cond;
      if (total <= 0) {
        cond = "ok";
      } else if (bad <= 0 && ok >= total) {
        cond = "ok";
      } else if (bad <= 0 && ok < total) {
        cond = "leve";
      } else {
        cond = "daniado";
      }
      condiciones[idx] = cond || "daniado";
    });

    // También aquí: las piezas dañadas se convierten en baja de stock
    registrarDaniosDesdeDevolucion(baseItems, cantidadesDaniado, data, p);

    const nuevo = {
      ...data,
      estado: "devuelto",
      devuelto_en: nowISO,
      condiciones,
      cantidades_ok: cantidadesOk,
      cantidades_daniado: cantidadesDaniado,
      observacion_devolucion: "Devolución con material dañado o incompleto."
    };
    setJSON(KEYS.DATA, nuevo);
    setStatus("devuelto");
    localStorage.removeItem(KEYS.VALE);

    actualizarEstadoPedido(
      data.noVale || data.folio || p.noVale,
      "devuelto",
      {
        condiciones,
        items: data.items || p.items,
        cantidades_ok: cantidadesOk,
        cantidades_daniado: cantidadesDaniado
      }
    );

    pushAlumnoInbox(p.noControl, `Tu devolución del vale ${p.noVale || ""} fue registrada con observaciones. Acude al laboratorio para revisar el material.`);
    notify("Devolución registrada con observaciones.", "info", { autoClose: 1800 });
    toast("Devolución con detalles", "warn");
    render();
  }
}

/* ============ Confirmar salida (casita) ============ */
function shouldWarnExit(){
  return false;
}
function confirmExit(url){
  notify("Tienes una solicitud/devolución en proceso. ¿Seguro que quieres salir?", "info", {
    buttons:[
      { text:"No",  kind:"nbtn-ghost",   action:()=>{} },
      { text:"Sí",  kind:"nbtn-primary", action:()=>{ window.location.href = url; } }
    ],
    autoClose: 0
  });
}

/* ============ Init ============ */
document.addEventListener("DOMContentLoaded", () => {
  render();

  $("btnAprobar")   ?.addEventListener("click", aprobar);
  $("btnRechazar")  ?.addEventListener("click", rechazar);

  $("btnVerHistorial")?.addEventListener("click", () => {
    window.location.href = "./HistorialPrestamos.html";
  });

  const home = qs(".fab-home");
  if(home){
    home.addEventListener("click",(e)=>{
      if(shouldWarnExit()){
        e.preventDefault();
        confirmExit(home.href);
      }
    });
  }

  // Si algún otro componente cambia el storage, refrescamos vista
  window.addEventListener("storage",(e)=>{
    if([KEYS.VALE, KEYS.STATUS, KEYS.DATA, KEYS.FORM, KEYS.TMP, KEYS.NUM].includes(e.key)){
      render();
    }
  });

  console.group('%cPréstamos — estado actual','color:#2563eb;font-weight:700');
  console.log('LE_vale_payload:', readJSON(KEYS.VALE, null));
  console.log('LE_prestamo_status:', getStatus());
  console.log('LE_prestamo_data:', readJSON(KEYS.DATA, null));
  console.groupEnd();
});
