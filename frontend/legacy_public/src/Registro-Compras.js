"use strict";

/* ===================== Config API (rutas backend) ===================== */
const API_BASE = `${window.location.origin}/backend/api_lab_elec.php`;

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { ok: false, error: "BAD_JSON", raw: text }; }
  if (!res.ok || data.ok === false) throw new Error((data && (data.message || data.error)) || `HTTP ${res.status}`);
  return data;
}
async function apiGetMateriales() { return fetchJson(`${API_BASE}?view=materiales`); }
async function apiGetCompras()    { return fetchJson(`${API_BASE}?view=compras`); }
async function apiPostCompra(payload) {
  return fetchJson(`${API_BASE}`, { method: "POST", body: JSON.stringify(payload) });
}

/* ===================== Claves de almacenamiento ===================== */
const LS = {
  materiales: "LE_materiales",
  compras:    "LE_compras",
  idCompra:   "LE_idcompra_seq",
  pendientes: "LE_carrito_pend",
  auxiliar:   "auxiliarNombre",
};
const UI_SAVED_THIS_SESSION = "LE_ui_saved_this_session";
const DEFAULT_AUX = "Juan Vázquez Rodríguez";

/* ===================== Utils ===================== */
const $    = (s) => document.querySelector(s);
const $val = (s) => ($(s)?.value || "").trim();

function todayISO(){
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function clampInt(v, min = 1) {
  const n = parseInt(String(v).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n >= min ? n : min;
}
function norm(s){ return (s||"").toString().normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().trim(); }
function firstLetterNormalized(label){
  if(!label) return "#";
  const ch = label.trim()[0]?.toUpperCase() || "#";
  const map = { "Á":"A","É":"E","Í":"I","Ó":"O","Ú":"U","Ü":"U","Ñ":"Ñ" };
  return map[ch] || ch;
}

/* ===================== Toast + Modal centrados ===================== */
let toastTimer = null;
function notify(msg, kind = "info"){
  const box = document.getElementById("toastCenter");
  if(!box) return;
  box.className = "";
  box.textContent = msg || "";
  const map = { info: "toast-info", ok: "toast-ok", warn: "toast-warn", danger: "toast-danger" };
  box.classList.add(map[kind] || map.info, "show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> box.classList.remove("show"), 1600);
}
const toast = (m)=>notify(m,"info");

function askConfirm({ title="¿Estás seguro?", message="Confirma la acción.", icon="!" } = {}){
  const root = document.getElementById("modalRoot");
  if(!root) return Promise.resolve(false);

  const t  = document.getElementById("modalTitle");
  const m  = document.getElementById("modalMsg");
  const i  = document.getElementById("modalIcon");
  const ok = document.getElementById("modalAccept");
  const no = document.getElementById("modalCancel");

  t.textContent = title;
  m.textContent = message;
  i.textContent = icon;

  root.classList.remove("hidden");
  root.setAttribute("aria-hidden","false");

  return new Promise((resolve)=>{
    const cleanup = ()=>{
      root.classList.add("hidden");
      root.setAttribute("aria-hidden","true");
      ok.removeEventListener("click", onOk);
      no.removeEventListener("click", onNo);
      window.removeEventListener("keydown", onKey);
    };
    const onOk = ()=>{ cleanup(); resolve(true); };
    const onNo = ()=>{ cleanup(); resolve(false); };
    const onKey = (e)=>{ if(e.key==="Escape"){ onNo(); } if(e.key==="Enter"){ onOk(); } };

    ok.addEventListener("click", onOk);
    no.addEventListener("click", onNo);
    window.addEventListener("keydown", onKey);
  });
}

/* ===================== Seed demo (solo primera vez) ===================== */
(function seed(){
  if (!localStorage.getItem(LS.materiales)) {
    localStorage.setItem(LS.materiales, JSON.stringify([
      { id_Material: 1, nombre: "Cable Dupont M-M (paquete 40)", cantidad: 15 },
      { id_Material: 2, nombre: "Capacitor Electrolítico 10µF", cantidad: 300 },
      { id_Material: 3, nombre: "Protoboard 830 puntos", cantidad: 46 },
      { id_Material: 4, nombre: "Resistor 220Ω", cantidad: 400 }
    ]));
  }
  if (!localStorage.getItem(LS.compras)) {
    localStorage.setItem(LS.compras, JSON.stringify([]));
    localStorage.setItem(LS.idCompra, "1");
  }
  if (!localStorage.getItem(LS.pendientes)) localStorage.setItem(LS.pendientes, "[]");
  if (!localStorage.getItem(LS.auxiliar))   localStorage.setItem(LS.auxiliar, DEFAULT_AUX);
})();

/* ===================== DAO ===================== */
const DB = {
  getMats()     { return JSON.parse(localStorage.getItem(LS.materiales) || "[]"); },
  setMats(v)    { localStorage.setItem(LS.materiales, JSON.stringify(v || [])); },
  getCompras()  { return JSON.parse(localStorage.getItem(LS.compras) || "[]"); },
  setCompras(v) { localStorage.setItem(LS.compras, JSON.stringify(v || [])); },
  getPend()     { return JSON.parse(localStorage.getItem(LS.pendientes) || "[]"); },
  setPend(v)    { localStorage.setItem(LS.pendientes, JSON.stringify(v || [])); },
  nextCompraId(){ const n = parseInt(localStorage.getItem(LS.idCompra) || "1", 10); localStorage.setItem(LS.idCompra, String(n + 1)); return n; },
  getAux()      { return localStorage.getItem(LS.auxiliar) || DEFAULT_AUX; },
  setAux(n)     { localStorage.setItem(LS.auxiliar, n || DEFAULT_AUX); }
};

/* ===================== Estado ===================== */
const state = { materiales: [], pendientes: [] };

/* ===================== Finder (sin stock) ===================== */
const Finder = { data: [], viewItems: [], open:false, index:-1, els:{}, query:"" };

function buildFinderData(){
  const mats = state.materiales.slice()
    .sort((a,b)=>a.nombre.localeCompare(b.nombre,"es",{sensitivity:"base"}));
  // Ya no guardamos ni usamos "stock" aquí
  Finder.data = mats.map(m=>({ id:m.id_Material, label:m.nombre }));
  Finder.viewItems = Finder.data.slice();
}

function groupByInitial(list){
  const groups = {};
  for(const it of list){
    const L = firstLetterNormalized(it.label);
    (groups[L] ||= []).push(it);
  }
  const letras = Object.keys(groups).sort((a,b)=>a.localeCompare(b,"es"));
  for(const L of letras){
    groups[L].sort((a,b)=>a.label.localeCompare(b.label,"es",{sensitivity:"base"}));
  }
  return { letras, groups };
}
function highlightMatch(label, q){
  if(!q) return label;
  const src = norm(label);
  const nq  = norm(q);
  const idx = src.indexOf(nq);
  if(idx < 0) return label;
  const start = label.slice(0, idx);
  const mid   = label.slice(idx, idx + q.length);
  const end   = label.slice(idx + q.length);
  return `${start}<mark class="fi-hl">${mid}</mark>${end}`;
}
function renderFinderList(items){
  const list = Finder.els.list;
  if(!list) return;

  if(!items.length){
    list.innerHTML = `<div class="fi-empty">Sin coincidencias</div>`;
    return;
  }

  const { letras, groups } = groupByInitial(items);
  const rows = [];
  let runningIndex = 0;

  for(const L of letras){
    rows.push(`<div class="fi-sep" aria-hidden="true">${L}</div>`);
    for(const it of groups[L]){
      const active = (runningIndex === Finder.index) ? " active" : "";
      // 🔻 SIN “stock”, solo nombre
      rows.push(`<div class="fi-item${active}" data-id="${it.id}">
        <span class="name">${highlightMatch(it.label, Finder.query)}</span>
      </div>`);
      runningIndex++;
    }
  }
  list.innerHTML = rows.join("");
}
function openFinder(items, query=""){
  Finder.open = true;
  Finder.index = -1;
  Finder.viewItems = items.slice();
  Finder.query = query;
  Finder.els.list.classList.remove("hidden");
  Finder.els.input.setAttribute("aria-expanded","true");
  renderFinderList(Finder.viewItems);
}
function closeFinder(){
  Finder.open = false;
  Finder.index = -1;
  Finder.query = "";
  Finder.els.list.classList.add("hidden");
  Finder.els.input.setAttribute("aria-expanded","false");
}
function selectFinderId(id){
  const it = Finder.data.find(x=>x.id===id);
  if(!it) return;
  Finder.els.hidden.value = String(it.id);
  Finder.els.input.value  = it.label;
  closeFinder();
  updateActionStates();
}
function filterFinder(q){
  const nq = norm(q);
  if(!nq) return Finder.data;

  if(nq.length === 1){
    const letter = nq[0];
    return Finder.data.filter(it => norm(it.label).charAt(0) === letter);
  }
  const starts = [], contains = [];
  for(const it of Finder.data){
    const lbl = norm(it.label);
    if(lbl.startsWith(nq)) starts.push(it);
    else if(lbl.includes(nq)) contains.push(it);
  }
  starts.sort((a,b)=>a.label.localeCompare(b.label,"es",{sensitivity:"base"}));
  contains.sort((a,b)=>a.label.localeCompare(b.label,"es",{sensitivity:"base"}));
  return [...starts, ...contains];
}
function bindFinder(){
  Finder.els = {
    root:   document.getElementById("finder"),
    input:  document.getElementById("materialSearch"),
    list:   document.getElementById("finderList"),
    hidden: document.getElementById("material"),
  };
  Finder.els.input.addEventListener("focus", ()=>{ if(!Finder.els.input.value.trim()){ openFinder(Finder.data, ""); }});
  Finder.els.input.addEventListener("input", ()=>{
    Finder.els.hidden.value = "";
    const q = Finder.els.input.value;
    openFinder(filterFinder(q), q);
    updateActionStates();
  });
  Finder.els.input.addEventListener("keydown",(e)=>{
    if(!Finder.open && (e.key==="ArrowDown" || e.key==="ArrowUp")){
      const q = Finder.els.input.value;
      openFinder(filterFinder(q), q);
      return;
    }
    if(!Finder.open) return;
    const itemCount = Finder.viewItems.length;
    if(e.key==="ArrowDown"){ e.preventDefault(); Finder.index = Math.min(itemCount-1, Finder.index+1); renderFinderList(Finder.viewItems); scrollActiveIntoView(); }
    if(e.key==="ArrowUp"){   e.preventDefault(); Finder.index = Math.max(0, Finder.index-1); renderFinderList(Finder.viewItems); scrollActiveIntoView(); }
    if(e.key==="Enter"){     e.preventDefault(); const chosen = Finder.viewItems[Finder.index] || Finder.viewItems[0]; if(chosen) selectFinderId(chosen.id); }
    if(e.key==="Escape"){    e.preventDefault(); closeFinder(); }
  });
  Finder.els.list.addEventListener("click",(e)=>{
    const it = e.target.closest(".fi-item");
    if(!it) return;
    selectFinderId(parseInt(it.dataset.id,10));
  });
  document.addEventListener("mousedown",(e)=>{ if(Finder.open && !Finder.els.root.contains(e.target)) closeFinder(); });
}
function scrollActiveIntoView(){
  const active = Finder.els.list.querySelector(".fi-item.active");
  if(!active) return;
  const parent = Finder.els.list;
  const aTop = active.offsetTop;
  const aBot = aTop + active.offsetHeight;
  const vTop = parent.scrollTop;
  const vBot = vTop + parent.clientHeight;
  if(aTop < vTop) parent.scrollTop = aTop - 8;
  else if(aBot > vBot) parent.scrollTop = aBot - parent.clientHeight + 8;
}

/* ===================== Estados de botones ===================== */
function updateActionStates(){
  const sel=$("#material");
  const plus=$("#plusQty");
  const add =$("#agregar");
  const save=$("#guardar");
  const ver  =$("#btnVerCompras");
  const cancelar=$("#cancelarPedido");
  const cantidad = $("#cantidad");

  const hayMaterial = !!(sel && sel.value);
  const cant = parseInt(cantidad?.value || "0", 10);
  const cantidadValida = Number.isFinite(cant) && cant > 0;
  const hayPend     = state.pendientes.length>0;
  const savedThis   = sessionStorage.getItem(UI_SAVED_THIS_SESSION)==="1";

  cantidad?.classList.toggle("is-invalid", !cantidadValida);

  if(plus) plus.disabled = !hayMaterial;
  if(add)  add.disabled  = !(hayMaterial && cantidadValida);
  if(save) save.disabled = !hayPend;
  if(ver)  ver.disabled  = !savedThis;
  if(cancelar) cancelar.disabled = !hayPend;
}

/* ===================== Materiales & Pendientes ===================== */
function cargarMateriales(){
  state.materiales = DB.getMats();
  buildFinderData();
  $("#material").value=""; $("#materialSearch").value="";
  updateActionStates();
}
function cargarPendientes(){ state.pendientes = DB.getPend(); }

function renderTabla(){
  const tbody = $("#tablaMateriales tbody"); if(!tbody) return;
  tbody.innerHTML = "";

  const rows = state.pendientes.slice().sort((a,b)=> b.fechaISO.localeCompare(a.fechaISO) || a.nombre.localeCompare(b.nombre));
  if(!rows.length){
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;opacity:.7;">Sin registros</td></tr>`;
    updateActionStates(); return;
  }

  for(const r of rows){
    const tr = document.createElement("tr");
    tr.dataset.idMaterial = r.id_Material;
    tr.innerHTML = `
      <td>${r.nombre}</td>
      <td class="qty-cell">${r.cantidad}</td>
      <td>${r.fechaISO}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="icon-btn edit-row" title="Editar cantidad"><i class="fa-solid fa-pen"></i></button>
          <button type="button" class="icon-btn danger del-row" title="Eliminar esta fila"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>`;
    tr.querySelector(".edit-row").addEventListener("click", ()=>editarFilaCantidad(tr, r.id_Material));
    tr.querySelector(".del-row").addEventListener("click",  ()=>eliminarFila(tr, r.id_Material));
    tbody.appendChild(tr);
  }
  updateActionStates();
}

/* ===================== Edición y eliminación de filas ===================== */
function editarFilaCantidad(tr, idMat){
  const celda = tr.querySelector(".qty-cell"); if(!celda || celda.classList.contains("editing")) return;
  const pend = state.pendientes.find(p=>p.id_Material===idMat); if(!pend) return;

  celda.classList.add("editing");
  const orig = pend.cantidad;

  celda.innerHTML = `
    <input type="number" class="inline-input" min="1" value="${orig}" style="width:90px; padding:6px; border:2px solid #a00000; border-radius:10px;">
    <button class="icon-btn" title="Guardar"><i class="fa-solid fa-check"></i></button>
    <button class="icon-btn danger" title="Cancelar"><i class="fa-solid fa-xmark"></i></button>`;

  const inp  = celda.querySelector("input");
  const okBtn = celda.querySelector(".icon-btn:not(.danger)");
  const noBtn = celda.querySelector(".icon-btn.danger");

  okBtn.addEventListener("click", ()=>{
    const nv = clampInt(inp.value,1);
    pend.cantidad = nv; DB.setPend(state.pendientes); renderTabla(); notify("Cantidad actualizada.", "ok");
  });
  noBtn.addEventListener("click", ()=>{ celda.classList.remove("editing"); celda.textContent = orig; });
  inp.focus();
}
function eliminarFila(tr, idMat){
  const i = state.pendientes.findIndex(p=>p.id_Material===idMat); if(i<0) return;
  state.pendientes.splice(i,1); DB.setPend(state.pendientes); tr.remove();
  if(!state.pendientes.length) renderTabla();
  notify("Material eliminado.", "warn"); updateActionStates();
}

/* ===================== Acciones (agregar, guardar, cancelar) ===================== */
function onPlusQty(e){ e?.preventDefault?.(); const inp=$("#cantidad"); if(!inp) return; inp.value = String(clampInt(inp.value,1)+1); updateActionStates(); }
function onCantidadInput(){ const cant = parseInt($val("#cantidad") || "0", 10); updateActionStates(); if(!(cant > 0)){ notify("Poner cantidad de material", "warn"); } }

function onAgregar(e){
  e?.preventDefault?.();
  const idMat = parseInt($val("#material"),10);
  const cant  = parseInt($val("#cantidad")||"0",10);

  if(!idMat){ notify("Selecciona un material.", "warn"); $("#materialSearch")?.focus(); return; }
  if(!(cant > 0)){ notify("Poner cantidad de material", "warn"); $("#cantidad")?.focus(); updateActionStates(); return; }

  const hoy = todayISO();
  const mat = state.materiales.find(m=>m.id_Material===idMat); if(!mat){ notify("Material no encontrado.", "danger"); return; }

  const i = state.pendientes.findIndex(p=>p.id_Material===idMat);
  if(i>=0){ state.pendientes[i].cantidad += cant; state.pendientes[i].fechaISO = hoy; }
  else    { state.pendientes.push({ id_Material:idMat, nombre:mat.nombre, cantidad:cant, fechaISO:hoy }); }
  DB.setPend(state.pendientes);

  $("#material").value = ""; $("#materialSearch").value = ""; $("#cantidad").value = "1";
  renderTabla(); notify("Agregado.", "ok"); updateActionStates();
}

async function onGuardar(e){
  e?.preventDefault?.();
  if(!state.pendientes.length){ notify("No hay pendientes.", "warn"); return; }

  const hoy = todayISO();
  const payload = {
    fechaISO: hoy,
    numeroControl: "0",
    auxiliar: DB.getAux(),
    items: state.pendientes.map(p=>({ id_Material:p.id_Material, cantidad:p.cantidad, gastoTotal:0 }))
  };

  try {
    // Guardar en la BD
    await apiPostCompra(payload);

    // Refrescar catálogo desde backend (para que tus cantidades queden al día)
    let matsResp = null;
    try { matsResp = await apiGetMateriales(); } catch {}
    if (matsResp?.ok && Array.isArray(matsResp.materiales)) {
      // Guardamos tal cual; NO mostramos stock en el UI
      DB.setMats(matsResp.materiales);
      state.materiales = matsResp.materiales.slice();
      buildFinderData();

      if ($("#materialSearch")?.value) {
        const q = $("#materialSearch").value;
        openFinder(filterFinder(q), q);
      }
    }

    state.pendientes = []; DB.setPend([]); renderTabla();
    sessionStorage.setItem(UI_SAVED_THIS_SESSION,"1");
    updateActionStates(); notify("Compra guardada en BD.", "ok");
  } catch {
    // Fallback localStorage si la BD falla
    const compras = DB.getCompras();
    const mats = DB.getMats();
    const id = DB.nextCompraId();
    const items = state.pendientes.map(p=>({ id_Material:p.id_Material, cantidad:p.cantidad, gastoTotal:0 }));
    compras.push({ id_compra:id, fecha:`${hoy} 00:00:00`, numeroControl:0, auxiliar: DB.getAux(), items });

    // Sumar cantidades localmente
    for(const it of items){
      const m = mats.find(mm=>mm.id_Material===it.id_Material);
      if(m) m.cantidad = (m.cantidad||0) + it.cantidad;
    }
    DB.setCompras(compras); DB.setMats(mats);

    state.materiales = mats.slice();
    buildFinderData();

    state.pendientes = []; DB.setPend([]); renderTabla();
    sessionStorage.setItem(UI_SAVED_THIS_SESSION,"1");
    updateActionStates(); notify("Compra guardada local (sin BD).", "warn");
  }
}

async function onCancelar(e){
  e?.preventDefault?.();
  if(!state.pendientes.length){ notify("No hay nada que cancelar.", "warn"); return; }

  const ok = await askConfirm({
    title: "Cancelar pedido",
    message: "Se borrarán los materiales en espera.\nEsta acción no guarda nada.",
    icon: "↺"
  });
  if(!ok) return;

  clearDraftsAndPendientes();
  renderTabla();
  sessionStorage.setItem(UI_SAVED_THIS_SESSION,"0");
  updateActionStates();
  notify("Pedido cancelado.", "ok");
}

/* ===================== Salir con modal (sin pop-up nativo) ===================== */
function formHasDraft(){
  const hasText = !!$val("#materialSearch");
  const hasSel  = !!$val("#material");
  const qty     = parseInt($val("#cantidad") || "1", 10);
  return hasText || hasSel || qty !== 1;
}
function shouldWarnLeave(){
  return state.pendientes.length > 0 || formHasDraft();
}
function clearDraftsAndPendientes(){
  state.pendientes = [];
  DB.setPend([]);
  $("#material").value = "";
  $("#materialSearch").value = "";
  $("#cantidad").value = "1";
}

function bindLeaveGuards(){
  const home = document.querySelector(".home-fab");
  if(home){
    home.addEventListener("click", async (e)=>{
      if(!shouldWarnLeave()) return;
      e.preventDefault();

      const motivo = state.pendientes.length
        ? "Tienes materiales sin guardar."
        : "Tienes datos sin terminar en el formulario.";
      const ok = await askConfirm({
        title: "Salir sin guardar",
        message: `${motivo}\n¿Deseas salir de esta pantalla?`,
        icon: "⟲"
      });
      if(ok){
        clearDraftsAndPendientes();
        renderTabla();
        sessionStorage.setItem(UI_SAVED_THIS_SESSION,"0");
        updateActionStates();
        window.location.href = home.href;
      }
    });
  }
}

/* ===================== Fecha bloqueada ===================== */
function lockDateToToday(){
  const f=$("#fecha"); if(!f) return;
  const hoy=todayISO(); f.value=hoy; f.min=hoy; f.max=hoy;
  f.setAttribute("aria-label","Fecha (hoy)");
  f.addEventListener("change", ()=>{ if(f.value!==hoy) f.value=hoy; });
  f.addEventListener("input",  ()=>{ if(f.value!==hoy) f.value=hoy; });
  f.addEventListener("keydown",(e)=>e.preventDefault());
  f.addEventListener("paste", (e)=>e.preventDefault());
}

/* ===================== Sincronización inicial con BD ===================== */
async function trySyncMaterialesFromAPI() {
  try {
    const matsResp = await apiGetMateriales();
    if (matsResp && matsResp.ok && Array.isArray(matsResp.materiales)) {
      DB.setMats(matsResp.materiales);
      state.materiales = matsResp.materiales.slice();
      buildFinderData();
      return true;
    }
  } catch {}
  return false;
}

/* ===================== Init ===================== */
async function init(){
  lockDateToToday();
  sessionStorage.setItem(UI_SAVED_THIS_SESSION,"0");

  const aux=$("#auxiliar"); if(aux){ aux.value=DB.getAux(); aux.readOnly=true; }

  bindFinder();

  $("#plusQty")?.addEventListener("click", onPlusQty);
  $("#agregar")?.addEventListener("click", onAgregar);
  $("#guardar")?.addEventListener("click", onGuardar);
  $("#cancelarPedido")?.addEventListener("click", onCancelar);

  const cantidadInp = $("#cantidad");
  if(cantidadInp){
    cantidadInp.classList.toggle("is-invalid", parseInt(cantidadInp.value||"0",10) <= 0);
    cantidadInp.addEventListener("input", onCantidadInput);
    cantidadInp.addEventListener("blur", onCantidadInput);
  }

  window.addEventListener("keydown",(e)=>{
    if(e.altKey && (e.key||"").toLowerCase()==="c"){
      const btn=$("#cancelarPedido");
      if(btn && !btn.disabled) onCancelar(e);
    }
  });

  $("#btnVerCompras")?.addEventListener("click",(e)=>{
    e.preventDefault(); if(!e.currentTarget.disabled) location.href="./compras.html";
  });

  cargarMateriales();
  await trySyncMaterialesFromAPI();
  cargarPendientes();
  renderTabla();
  updateActionStates();
  bindLeaveGuards();
}
document.addEventListener("DOMContentLoaded", init);
