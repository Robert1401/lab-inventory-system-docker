/* =========================================================
   CARRERAS – CRUD + Validación ULTRA-ESTRICTA + confirm al salir
   TecNM – Laboratorio de Electrónica Analógica
========================================================= */

const tabla        = document.getElementById("tabla-carreras");
const inputNombre  = document.getElementById("nombre");

const btnGuardar    = document.querySelector(".guardar");
const btnActualizar = document.querySelector(".actualizar");
const btnEliminar   = document.querySelector(".eliminar");
const homeLink      = document.querySelector(".iconos .icono"); // casita

let carreras = [];
let idSeleccionado = null;
let nombreOriginal = "";

const API = "/backend/carreras.php";

/* ========= Toast ========= */
function showToast(message, type = "info", duration = 2200) {
  const host = document.getElementById("toast");
  if (!host) { alert(message); return; }
  const icons = { success: "✓", error: "✕", info: "ℹ︎", warn:"⚠︎" };
  host.innerHTML = `
    <div class="toast-card ${type}" role="status" aria-live="polite" aria-atomic="true">
      <div class="toast-icon">${icons[type] || "ℹ︎"}</div>
      <div class="toast-text">${message}</div>
    </div>`;
  host.classList.add("show");
  const hide = () => { host.classList.remove("show"); host.innerHTML = ""; };
  const t = setTimeout(hide, duration);
  host.onclick = () => { clearTimeout(t); hide(); };
}

/* ========= Confirm ========= */
function showConfirm(texto) {
  const modal     = document.getElementById("confirm");
  const card      = modal?.querySelector(".confirm-card");
  const label     = document.getElementById("confirm-text");
  const btnOk     = document.getElementById("confirm-aceptar");
  const btnCancel = document.getElementById("confirm-cancelar");

  return new Promise((resolve) => {
    if (!modal || !card || !label || !btnOk || !btnCancel) {
      resolve(window.confirm(texto || "¿Seguro que deseas continuar?"));
      return;
    }
    label.textContent = texto || "¿Seguro que deseas continuar?";
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");

    const onOk      = (e) => { e.stopPropagation(); close(true); };
    const onCancel  = (e) => { e?.stopPropagation?.(); close(false); };
    const onBackdrop= (e) => { if (!card.contains(e.target)) close(false); };
    const onKey     = (e) => { if (e.key === "Escape") close(false); if (e.key === "Enter") close(true); };

    function close(v){
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden","true");
      btnOk.removeEventListener("click",onOk);
      btnCancel.removeEventListener("click",onCancel);
      modal.removeEventListener("click",onBackdrop);
      window.removeEventListener("keydown",onKey);
      resolve(v);
    }
    btnOk.addEventListener("click",onOk,{once:true});
    btnCancel.addEventListener("click",onCancel,{once:true});
    modal.addEventListener("click",onBackdrop);
    window.addEventListener("keydown",onKey);
  });
}

/* ========= Fetch helper ========= */
async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  let data; try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw new Error(data.mensaje || data.error || `Error (${res.status}).`);
  if (data.error) throw new Error(data.error);
  return data;
}

/* =========================================================
   NORMALIZACIÓN, TOKENS, EQUIVALENCIAS y CLAVE DE ESPECIALIDAD
========================================================= */

function normalizeBase(s){
  return (s||"")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g," ")
    .trim();
}

const STOP = new Set([
  "de","del","la","el","los","las","en","y","e","para","por","con","a",
  "facultad","universidad","tecnologico","tecnologia","tecnologias",
  "tecnico","tecnica",
  "licenciatura","licenciaturas","departamento","division",
  "ingenieria","ing","ing.","carrera","carreras"
]);

function toSingular(w){
  if (w.length <= 3) return w;
  if (w.endsWith("es") && w.length > 4) return w.slice(0,-2);
  if (w.endsWith("s")  && w.length > 3) return w.slice(0,-1);
  return w;
}

/* Sinónimos / canónicos (tokens sueltos) */
const ALIAS = new Map([
  // SISTEMAS
  ["sistema","sistemas"], ["sistemas","sistemas"], ["sistem","sistemas"],
  ["computacion","sistemas"], ["computacional","sistemas"], ["computacionales","sistemas"],
  ["computador","sistemas"], ["computadores","sistemas"],
  ["informatica","sistemas"], ["informatico","sistemas"], ["informaticos","sistemas"],
  ["software","sistemas"], ["programacion","sistemas"],
  ["ti","sistemas"], ["tic","sistemas"], ["tics","sistemas"],

  // ELECTRÓNICA (≠ ELÉCTRICA)
  ["electronica","electronica"], ["electronicas","electronica"],

  // ELÉCTRICA (separada)
  ["electrica","electrica"], ["electricas","electrica"],

  // TELECOM
  ["telecomunicaciones","telecom"], ["telecom","telecom"],

  // Otros ejemplos
  ["mecanica","mecanica"], ["mecatronica","mecatronica"],
  ["industrial","industrial"], ["quimica","quimica"]
]);

function canonicalRewrites(s){
  return s
    .replace(/\bsistemas?\s+computacionales?\b/g, "sistemas")
    .replace(/\btecnologias?\s+de\s+la?\s* informacion\b/g, "sistemas")
    .replace(/\btecnologia\s+de\s+la?\s* informacion\b/g, "sistemas")
    .replace(/\by\b/g, " ");
}

function stripGenericPrefixes(s){
  return s
    .replace(/\b(ing\.?|ingenieria|licenciatura|tecnico|tecnica)\b/g, " ")
    .replace(/\b(en|de|del|la|el|los|las|para|por|con|a)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* Prefijos (raíces incompletas) */
function canonByPrefix(base){
  // SISTEMAS
  if (base.startsWith("sist")) return "sistemas";
  if (base.startsWith("compu")) return "sistemas";
  if (base.startsWith("infor")) return "sistemas";
  if (base.startsWith("progr")) return "sistemas";
  if (base === "ti" || base === "tic" || base === "tics") return "sistemas";

  // ELECTRÓNICA vs ELÉCTRICA
  if (base.startsWith("electro"))   return "electronica";
  if (base.startsWith("electron"))  return "electronica";
  if (base.startsWith("electric"))  return "electrica";

  // TELECOM
  if (base.startsWith("telecom")) return "telecom";
  if (base.startsWith("telecomunic")) return "telecom";

  return null;
}

function canonToken(t){
  const base = toSingular(t);
  if (ALIAS.has(base)) return ALIAS.get(base);
  const pref = canonByPrefix(base);
  if (pref) return pref;
  return base;
}

function keyTokens(s){
  let base = normalizeBase(s);
  base = canonicalRewrites(base);
  base = stripGenericPrefixes(base);
  return base.split(" ")
    .filter(t => t && t.length >= 3 && !STOP.has(t))
    .map(toSingular)
    .map(canonToken);
}

function specialtyKey(nombre){
  const tokens = keyTokens(nombre);
  const uniq = Array.from(new Set(tokens)).sort();
  return uniq.join("-");
}

/* Pares que deben ser distintos SIEMPRE */
const DISTINCT_PAIRS = new Set([
  "electronica|electrica","electrica|electronica",
  "electronica|telecom","telecom|electronica",
  "electrica|telecom","telecom|electrica"
]);

function areDistinctSpecialties(a, b){
  const ca = canonToken(a), cb = canonToken(b);
  return DISTINCT_PAIRS.has(`${ca}|${cb}`);
}

/* ===== similitud extra ===== */
function isSubsetTokens(tokensA, tokensB){
  return tokensA.every(t => tokensB.includes(t));
}

function jaccard(aTokens, bTokens){
  const A = new Set(aTokens);
  const B = new Set(aTokens.constructor === Set ? [...aTokens] : bTokens);
  let inter = 0;
  A.forEach(t => { if (B.has(t)) inter++; });
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function editDistance(a, b){
  const n = a.length, m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  const dp = Array.from({length: n+1}, () => new Array(m+1).fill(0));
  for (let i=0;i<=n;i++) dp[i][0]=i;
  for (let j=0;j<=m;j++) dp[0][j]=j;
  for (let i=1;i<=n;i++){
    for (let j=1;j<=m;j++){
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i-1][j] + 1,
        dp[i][j-1] + 1,
        dp[i-1][j-1] + cost
      );
    }
  }
  return dp[n][m];
}

function commonPrefixLen(a, b){
  const L = Math.min(a.length, b.length);
  let k = 0;
  while (k < L && a[k] === b[k]) k++;
  return k;
}

function tokensEquivalent(a, b){
  const ca = canonToken(a);
  const cb = canonToken(b);
  if (ca === cb) return true;
  return editDistance(ca, cb) <= 1;
}

function tokensPrefixSimilar(a, b){
  const ca = canonToken(a);
  const cb = canonToken(b);
  if (areDistinctSpecialties(ca, cb)) return false;
  const minLen = Math.min(ca.length, cb.length);
  if (minLen < 5) return false;
  return ca.startsWith(cb) || cb.startsWith(ca) || commonPrefixLen(ca, cb) >= 5;
}

function anySimilarToken(tokensA, tokensB){
  for (const ta of tokensA){
    for (const tb of tokensB){
      if (areDistinctSpecialties(ta, tb)) continue;
      if (tokensEquivalent(ta, tb) || tokensPrefixSimilar(ta, tb)) return true;
    }
  }
  return false;
}

/* =========================================================
   Duplicados / Equivalencias
========================================================= */
function existeParecida(nombreNuevo, idIgnorar = null){
  const baseNuevo   = normalizeBase(nombreNuevo);
  const keyNuevo    = specialtyKey(nombreNuevo);
  const tokensNuevo = keyTokens(nombreNuevo);

  let mejorMatch = null;
  let mejorScore = 0;

  for (const c of carreras){
    if (idIgnorar != null && c.id_Carrera === idIgnorar) continue;

    const baseExist   = normalizeBase(c.nombre);
    const keyExist    = specialtyKey(c.nombre);
    const tokensExist = keyTokens(c.nombre);

    if (baseExist === baseNuevo){
      return { existe:true, con: c.nombre, motivo:"igual" };
    }
    if (keyExist && keyExist === keyNuevo){
      return { existe:true, con: c.nombre, motivo:"misma_especialidad" };
    }
    if (anySimilarToken(tokensNuevo, tokensExist)){
      return { existe:true, con: c.nombre, motivo:"muy_parecida" };
    }
    if (tokensNuevo.length && tokensExist.length &&
        (isSubsetTokens(tokensNuevo, tokensExist) || isSubsetTokens(tokensExist, tokensNuevo))){
      return { existe:true, con: c.nombre, motivo:"muy_parecida" };
    }

    const score = jaccard(tokensNuevo, tokensExist);
    if (score > mejorScore){
      mejorScore = score;
      mejorMatch = c.nombre;
    }
  }

  if (mejorScore >= 0.70){
    return { existe:true, con: mejorMatch, motivo:"muy_parecida" };
  }
  return { existe:false };
}

/* =========================================================
   Estados / UX
========================================================= */
function isDirty(){
  if (idSeleccionado == null) return false;
  return normalizeBase(inputNombre.value) !== normalizeBase(nombreOriginal);
}

/* ¿Hay datos sin guardar o incompletos? (para casita) */
function hasUnsavedOrIncomplete(){
  const texto = (inputNombre.value || "").trim();
  if (idSeleccionado == null){
    return texto.length > 0; // escribió algo y no guardó
  }
  return isDirty(); // está editando y no actualizó
}

function updateButtonStates(){
  const hayTexto = (inputNombre.value || "").trim().length > 0;

  if (idSeleccionado == null) {
    // Modo NUEVA
    btnGuardar.disabled    = !hayTexto; // solo se habilita si hay texto
    btnActualizar.disabled = true;
    btnEliminar.disabled   = true;
    btnEliminar.title = "";
    return;
  }

  // Modo EDICIÓN
  const changed = isDirty();
  btnGuardar.disabled    = true;                 // no guardar en edición
  btnActualizar.disabled = !hayTexto || !changed; // se activa si hay cambios
  btnEliminar.disabled   = changed;               // activo solo si NO hay cambios
  btnEliminar.title = changed ? "Tienes cambios sin guardar. Actualiza primero." : "";
}

/* Helpers selección / limpieza */
function limpiarSeleccion(){
  [...tabla.querySelectorAll("tr")].forEach(tr => tr.classList.remove("seleccionada"));
  idSeleccionado = null;
  nombreOriginal = "";
  inputNombre.value = "";                         // ← limpia el cuadro
  updateButtonStates();                           // ← desactiva botones según modo NUEVA
}

function seleccionarFilaVisual(fila){
  [...tabla.querySelectorAll("tr")].forEach(tr => tr.classList.remove("seleccionada"));
  fila?.classList.add("seleccionada");
}

/* =========================================================
   Carga inicial + casita con confirmación
========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  await cargarCarreras();
  updateButtonStates();

  inputNombre.addEventListener("input", () => {
    updateButtonStates();
  });

  // Confirmación al salir por la casita si hay datos sin guardar/incompletos
  homeLink?.addEventListener("click", async (e) => {
    if (!hasUnsavedOrIncomplete()) return; // sin cambios -> salir normal
    e.preventDefault();

    const motivo = (idSeleccionado == null)
      ? "Tienes datos sin guardar en el formulario."
      : "Tienes cambios sin guardar en la carrera seleccionada.";

    const ok = await showConfirm(`${motivo}\nSi sales ahora, perderás los datos.\n\n¿Deseas salir igualmente?`);
    if (ok){
      window.location.href = homeLink.href;
    } else {
      showToast("Edición conservada. Continúa donde te quedaste.", "info", 2000);
    }
  });
});

async function cargarCarreras() {
  try {
    const data = await fetchJson(API, { method: "GET" });
    carreras = Array.isArray(data) ? data : [];
    mostrarTabla();
  } catch (err) {
    showToast(err.message || "No se pudieron cargar las carreras.", "error", 3000);
  }
}

/* Render tabla */
function mostrarTabla() {
  tabla.innerHTML = "";
  carreras.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${c.nombre}</td>`;
    tr.onclick = () => {
      seleccionarFilaVisual(tr);
      idSeleccionado = c.id_Carrera;
      nombreOriginal = c.nombre;
      inputNombre.value = c.nombre;  // ← autocompleta
      updateButtonStates();          // ← habilita Eliminar, desactiva Actualizar hasta cambio
    };
    tabla.appendChild(tr);
  });
}

/* =========================================================
   Guardar (modo NUEVA)
========================================================= */
btnGuardar.addEventListener("click", async () => {
  const nombre = (inputNombre.value || "").trim();
  if (!nombre) { showToast("Ingresa un nombre de carrera.", "info"); return; }

  const dup = existeParecida(nombre, null);
  if (dup.existe){
    showToast(`❗ Ya existe una carrera equivalente o muy parecida: “${dup.con}”.`, "warn", 4200);
    return;
  }

  try {
    const data = await fetchJson(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre })
    });

    // Actualiza memoria/UI
    const nuevo = { id_Carrera: data.id_Carrera, nombre: data.nombre || nombre };
    carreras.push(nuevo);
    mostrarTabla();

    // UX pedido: limpiar cuadro y dejar todo desactivado (modo NUEVA limpio)
    limpiarSeleccion();

    showToast("✅ Guardado.", "success");

  } catch (err) {
    showToast(err.message, "error", 3200);
  }
});

/* =========================================================
   Actualizar (modo EDICIÓN)
========================================================= */
btnActualizar.addEventListener("click", async () => {
  if (idSeleccionado == null) { showToast("Selecciona una carrera primero.", "info"); return; }
  const nombre = (inputNombre.value || "").trim();
  if (!nombre) { showToast("Ingresa el nuevo nombre.", "info"); return; }

  const dup = existeParecida(nombre, idSeleccionado);
  if (dup.existe){
    showToast(`❗ Ya existe una carrera equivalente o muy parecida: “${dup.con}”.`, "warn", 4200);
    return;
  }

  try {
    await fetchJson(API, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_Carrera: idSeleccionado, nombre })
    });

    const idx = carreras.findIndex(x => x.id_Carrera === idSeleccionado);
    if (idx !== -1) carreras[idx].nombre = nombre;
    mostrarTabla();

    // Después de actualizar, volvemos a modo NUEVA (limpio y botones desactivados)
    limpiarSeleccion();
    showToast("✏️ Actualizada.", "success");

  } catch (err) {
    showToast(err.message, "error", 3200);
  }
});

/* =========================================================
   Eliminar
========================================================= */
btnEliminar.addEventListener("click", async () => {
  if (idSeleccionado == null) { showToast("Selecciona una carrera primero.", "info"); return; }
  if (isDirty()) {
    showToast("No puedes eliminar: estás editando esta carrera. Presiona ACTUALIZAR primero.", "warn", 3200);
    return;
  }

  const filaSel = [...tabla.querySelectorAll("tr")].find(tr => tr.classList.contains("seleccionada"));
  const nombreSel = filaSel ? filaSel.textContent.trim() : "esta carrera";

  const ok = await showConfirm(`Se borrará la carrera: "${nombreSel}".\n¿Estás seguro?`);
  if (!ok) return;

  try {
    const params = new URLSearchParams({ id_Carrera: String(idSeleccionado) });
    const data = await fetchJson(`${API}?${params.toString()}`, { method: "DELETE" });

    carreras = carreras.filter(c => c.id_Carrera !== idSeleccionado);
    mostrarTabla();

    // Tras eliminar, también volvemos a modo NUEVA (input limpio y botones desactivados)
    limpiarSeleccion();
    showToast(data.mensaje || "🗑️ Carrera eliminada", "success");

  } catch (err) {
    showToast(err.message || "No se pudo eliminar.", "error");
  }
});
