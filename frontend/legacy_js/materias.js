// =========================
// Config
// =========================
const API = "/backend/materias.php";
const DEFAULT_CARRERA_ID = 11;

const qs  = (s, el=document) => el.querySelector(s);

// =========================
// Toasts
// =========================
let __toastTimer=null;
function showToast({title="",desc="",type="info",duration=2200}={}){
  const host=document.getElementById("toastOverlay"); if(!host) return;
  host.innerHTML=`
    <div class="toast-card ${type}">
      <div class="toast-icon">${type==="success"?"✅":type==="error"?"❌":type==="warn"?"⚠️":"ℹ️"}</div>
      ${title?`<h4 class="title">${title}</h4>`:""}
      ${desc?`<p class="desc">${desc}</p>`:""}
    </div>`;
  host.hidden=false;
  clearTimeout(__toastTimer);
  const close=()=>{
    const c=host.querySelector(".toast-card"); if(c) c.style.animation="toastOut .16s ease forwards";
    host.style.animation="toastOverlayOut .16s ease forwards";
    setTimeout(()=>{host.hidden=true; host.innerHTML=""; host.style.animation="";},170);
  };
  host.onclick=close; __toastTimer=setTimeout(close,duration);
}
const toastSuccess = msg => showToast({title:"¡Listo!",   desc:msg, type:"success"});
const toastError   = msg => showToast({title:"Ups",       desc:msg, type:"error"});
const toastInfo    = msg => showToast({title:"Aviso",     desc:msg, type:"info"});
const toastWarn    = msg => showToast({title:"Atención",  desc:msg, type:"warn"});

// =========================
// Confirm
// =========================
let __confirmBusy=false;
function showConfirm(text="¿Seguro que deseas continuar?", opts={}){
  const overlay=document.getElementById("confirm");
  const titleEl=document.getElementById("confirm-title");
  const textEl =document.getElementById("confirm-text");
  const btnOK  =document.getElementById("confirm-ok");
  const btnNo  =document.getElementById("confirm-cancel");

  if(!overlay||!titleEl||!textEl||!btnOK||!btnNo){
    return Promise.resolve(window.confirm(text));
  }
  if(__confirmBusy) return Promise.resolve(false);
  __confirmBusy=true;

  titleEl.textContent=opts.title||"Confirmación";
  textEl.textContent =text;
  overlay.hidden=false;
  requestAnimationFrame(()=>{
    overlay.style.animation="overlayIn .18s ease forwards";
    const card=overlay.querySelector(".confirm-card");
    if(card) card.style.animation="cardIn .18s ease forwards";
  });

  return new Promise(resolve=>{
    const cleanup=()=>{
      btnOK.removeEventListener("click",onOK);
      btnNo.removeEventListener("click",onNo);
      window.removeEventListener("keydown",onKey);
      __confirmBusy=false;
    };
    const close=v=>{
      const card=overlay.querySelector(".confirm-card");
      if(card) card.style.animation="cardOut .14s ease forwards";
      overlay.style.animation="overlayOut .14s ease forwards";
      setTimeout(()=>{overlay.hidden=true; cleanup(); resolve(v);},150);
    };
    const onOK=()=>close(true);
    const onNo=()=>close(false);
    const onKey=e=>{ if(e.key==="Escape") close(false); if(e.key==="Enter") close(true); };
    btnOK.addEventListener("click",onOK,{once:true});
    btnNo.addEventListener("click",onNo,{once:true});
    window.addEventListener("keydown",onKey);
  });
}

// =========================
// Fetch helper
// =========================
async function fetchJson(url, options){
  const res = await fetch(url, options);
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok || data.error) throw new Error(data.error || `Error (${res.status})`);
  return data;
}

// =========================
// Normalización / utilidades
// =========================
const removeAccents = s => (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const norm = s => removeAccents(s).toLowerCase().replace(/[^\p{L}\s\-\.()\/&#]/gu," ").replace(/\s+/g," ").trim();

const STOP = new Set(["de","del","la","el","los","las","en","y","e","para","por","con","a","ii","iii","iv","v","vi","vii","viii","ix","x","i"]);
const singular = w => (w.endsWith("es") && w.length>4) ? w.slice(0,-2) : (w.endsWith("s") && w.length>3 ? w.slice(0,-1) : w);

// Romanos 1..10
const ROMAP = new Map([[1,"I"],[2,"II"],[3,"III"],[4,"IV"],[5,"V"],[6,"VI"],[7,"VII"],[8,"VIII"],[9,"IX"],[10,"X"]]);
const TRAIL_ROM_RE = /\s+(X|IX|VIII|VII|VI|V|IV|III|II|I)$/i;
const ANY_DIGIT_RE = /\d/;

// Palabras 1..10
const WORD2NUM = new Map([
  ["uno",1],["dos",2],["tres",3],["cuatro",4],["cinco",5],
  ["seis",6],["siete",7],["ocho",8],["nueve",9],["diez",10]
]);
const TRAIL_WORD_RE = new RegExp(`\\s+(${[...WORD2NUM.keys()].join("|")})\\s*$`,"i");
const ANY_WORD_NUM_RE = new RegExp(`\\b(${[...WORD2NUM.keys()].join("|")})\\b`,"i");

// ... 2 → ... II
function replaceTrailingArabicWithRoman(str){
  const m = str.match(/\s+([1-9]|10)\s*$/);
  if(!m) return null;
  const n = parseInt(m[1],10);
  return str.replace(/\s+[0-9]+\s*$/," "+ROMAP.get(n));
}
// ... uno|dos → ... I|II
function replaceTrailingWordWithRoman(str){
  const m = str.match(TRAIL_WORD_RE);
  if(!m) return null;
  const n = WORD2NUM.get(m[1].toLowerCase());
  return str.replace(TRAIL_WORD_RE, " "+ROMAP.get(n));
}

// parse nombre → {base, nivel}
function parseMateriaNombre(raw){
  const original = (raw||"").trim();
  let s = original.replace(/\s+/g," ");

  const convNum = replaceTrailingArabicWithRoman(s);
  if (convNum) s = convNum;
  const convWord = replaceTrailingWordWithRoman(s);
  if (convWord) s = convWord;

  if (ANY_DIGIT_RE.test(s)) {
    return { error: "No se permiten números arábigos en el nombre. Usa romanos (I, II, III…)." };
  }
  if (ANY_WORD_NUM_RE.test(s)) {
    return { error: "No se permiten números escritos con palabras. Usa romanos (I, II, III…)." };
  }

  let nivel = "";
  const rm = s.match(TRAIL_ROM_RE);
  if (rm) {
    nivel = rm[1].toUpperCase();
    s = s.slice(0, rm.index).trim();
  }

  const baseCanon = norm(s)
    .split(" ")
    .filter(t => t && t.length>=2 && !STOP.has(t))
    .map(singular)
    .join(" ");

  return { original: s, base: baseCanon, nivel };
}

// similitud
function jaccardTokens(a, b){
  const A = new Set(a.split(" ").filter(Boolean));
  const B = new Set(b.split(" ").filter(Boolean));
  let inter=0; A.forEach(t=>{ if(B.has(t)) inter++; });
  const union = A.size + B.size - inter;
  return union===0?0:inter/union;
}
function editDistance(a,b){
  const n=a.length, m=b.length;
  if(!n) return m; if(!m) return n;
  const dp=Array.from({length:n+1},()=>Array(m+1).fill(0));
  for(let i=0;i<=n;i++) dp[i][0]=i;
  for(let j=0;j<=m;j++) dp[0][j]=j;
  for(let i=1;i<=n;i++){
    for(let j=1;j<=m;j++){
      const cost = a[i-1]===b[j-1]?0:1;
      dp[i][j]=Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
    }
  }
  return dp[n][m];
}

function existeDuplicadaMateria(nombreNuevo, materias, idIgnorar=null){
  const pN = parseMateriaNombre(nombreNuevo);
  if (pN.error) return { existe:true, con:null, motivo:pN.error, tipo:"formato" };

  const baseN = pN.base;
  const nivN  = pN.nivel;

  let mejor=null, bestScore=0;

  for(const m of materias){
    if (idIgnorar!=null && String(m.id_Materia)===String(idIgnorar)) continue;
    const pE = parseMateriaNombre(m.materia);
    if (pE.error) continue;

    const baseE = pE.base;
    const nivE  = pE.nivel;

    if (baseE===baseN && nivE===nivN){
      return { existe:true, con:m.materia, motivo:"duplicada" };
    }
    if (baseE===baseN && (nivE==="" || nivN==="")){
      return { existe:true, con:m.materia, motivo:"con_sin_nivel" };
    }

    const jac = jaccardTokens(baseE, baseN);
    const ed  = editDistance(baseE, baseN);
    if ((jac>=0.75 || ed<=2)){
      if (nivE===nivN || nivE==="" || nivN===""){
        return { existe:true, con:m.materia, motivo:"muy_parecida" };
      }
      if (jac>bestScore){ bestScore=jac; mejor=m.materia; }
    }
  }
  return { existe:false, con:mejor };
}

// =========================
(function(){
  const input        = qs('#nombreMateria');
  const btnGuardar   = qs('#Guardar');
  const btnModificar = qs('#Modificar');
  const btnEliminar  = qs('#Eliminar');
  const btnCancelar  = qs('#Cancelar'); // NUEVO
  const tbody        = qs('#tbody');
  const tablaVacia   = qs('#tablaVacia');
  const homeLink     = qs('.iconos .icono');

  if(!input || !btnGuardar || !tbody) return;

  let materias = [];
  let filaSel  = null;
  let nombreOriginal = "";
  let purgadaInactivas = false;

  function isDirty(){
    if(!filaSel) return false;
    return norm(input.value) !== norm(nombreOriginal);
  }

  function hasUnsaved(){
    if(!filaSel) return (input.value||"").trim().length>0;
    return isDirty();
  }

  function updateButtonStates(){
    const hayTexto = (input.value||"").trim().length > 0;

    if(!filaSel){
      btnGuardar.disabled   = !hayTexto;
      btnModificar.disabled = true;
      btnEliminar.disabled  = true;
    } else {
      const changed = isDirty();
      btnGuardar.disabled   = true;
      btnModificar.disabled = !hayTexto || !changed;
      btnEliminar.disabled  = changed;
      btnEliminar.title     = changed ? "Tienes cambios sin guardar. Actualiza primero." : "";
    }

    // NUEVO: botón Cancelar sólo activo cuando hay algo que limpiar
    if (btnCancelar) {
      btnCancelar.disabled = !hasUnsaved();
    }
  }

  function marcarSeleccion(tr){
    [...tbody.querySelectorAll("tr")].forEach(r=>r.classList.remove("seleccion"));
    filaSel = tr || null;
    if(filaSel) filaSel.classList.add("seleccion");
    updateButtonStates();
  }

  function limpiarSeleccion(){
    filaSel = null;
    nombreOriginal = "";
    input.value = "";
    marcarSeleccion(null);
  }

  function render(selectId=null){
    tbody.innerHTML = '';
    if(!materias.length){
      if(tablaVacia) tablaVacia.hidden = false;
      updateButtonStates();
      return;
    }
    if(tablaVacia) tablaVacia.hidden = true;

    materias.forEach(m=>{
      const tr = document.createElement('tr');
      tr.dataset.id        = m.id_Materia;
      tr.dataset.idCarrera = m.id_Carrera;
      tr.dataset.estado    = m.id_Estado;
      tr.innerHTML = `<td>${m.materia}</td>`;
      tr.addEventListener('click', ()=>{
        marcarSeleccion(tr);
        input.value = m.materia;
        nombreOriginal = m.materia;
        updateButtonStates();
      });
      tbody.appendChild(tr);
    });

    if(selectId){
      const tr = [...tbody.querySelectorAll("tr")].find(r=> String(r.dataset.id)===String(selectId));
      if(tr){ tr.click(); } else { updateButtonStates(); }
    }else{
      updateButtonStates();
    }
  }

  async function cargarMaterias(selectId=null){
    try{
      materias = await fetchJson(API);
      materias.sort((a,b)=> a.materia.localeCompare(b.materia, 'es', {sensitivity:'base'}));
      render(selectId);

      if (!purgadaInactivas && materias.some(m => String(m.id_Estado) !== "1")) {
        purgadaInactivas = true;
        try{
          const r = await fetchJson(`${API}?inactive=1`, { method:"DELETE" });
          if (r.eliminadas > 0) toastSuccess(`Eliminadas ${r.eliminadas} inactivas`);
          materias = await fetchJson(API);
          materias.sort((a,b)=> a.materia.localeCompare(b.materia, 'es', {sensitivity:'base'}));
          render(selectId);
        }catch(err){
          console.error(err);
          toastError(err.message || "No se pudieron eliminar las inactivas");
        }
      }
    }catch(err){
      toastError(err.message||"No se pudieron cargar materias");
    }
  }

  // ======= Bloqueo de números y conversión =======
  let lastDigitWarn = 0;
  function warnOnce(txt, type="warn"){
    const now = Date.now();
    if (now - lastDigitWarn > 900){
      showToast({type, title:type==="warn"?"Sin números":"Formato", desc:txt});
      lastDigitWarn = now;
    }
  }

  input.addEventListener('keydown', (e)=>{
    const controlKeys = new Set([
      "Backspace","Delete","Tab","Escape","Enter",
      "ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"
    ]);
    if (controlKeys.has(e.key) || (e.ctrlKey||e.metaKey)) return;

    const isDigitKey = /\d/.test(e.key) || (e.code||"").startsWith("Digit") || (e.code||"").startsWith("Numpad");
    if (isDigitKey){
      e.preventDefault();
      warnOnce("No se permiten números arábigos. Usa romanos (I, II, III…)");
      return;
    }
  });

  input.addEventListener('input', (e)=>{
    let val = e.target.value;

    const convNum = replaceTrailingArabicWithRoman(val);
    if (convNum) { val = convNum; warnOnce("Convertí el número final a romano (I, II, III…)", "info"); }

    const convWord = replaceTrailingWordWithRoman(val);
    if (convWord) { val = convWord; warnOnce("Convertí la palabra final a número romano", "info"); }

    if (/\d/.test(val)) {
      val = val.replace(/\d+/g, " ");
      warnOnce("No se permiten números arábigos. Usa romanos (I, II, III…)");
    }
    if (ANY_WORD_NUM_RE.test(val)) {
      val = val.replace(new RegExp(`\\b(${[...WORD2NUM.keys()].join("|")})\\b`,"gi"), " ");
      warnOnce("No se permiten números escritos con palabras. Usa romanos (I, II, III…)");
    }

    const limpio = val.replace(/[^\p{L}\s\-\.()\/&#]/gu, '');
    if(limpio !== e.target.value) e.target.value = limpio;

    updateButtonStates();
  });

  input.addEventListener('paste', (e)=>{
    const data = (e.clipboardData || window.clipboardData).getData('text');
    if (!data) return;

    let txt = data;

    const c1 = replaceTrailingArabicWithRoman(txt); if (c1) txt = c1;
    const c2 = replaceTrailingWordWithRoman(txt);  if (c2) txt = c2;

    txt = txt.replace(/\d+/g," ");
    txt = txt.replace(new RegExp(`\\b(${[...WORD2NUM.keys()].join("|")})\\b`,"gi"), " ");

    if (txt !== data){
      e.preventDefault();
      const start = input.selectionStart, end = input.selectionEnd;
      const before = input.value.slice(0,start);
      const after  = input.value.slice(end);
      input.value = before + txt + after;
      const pos = before.length + txt.length;
      input.setSelectionRange(pos,pos);
      warnOnce("Se ajustó el texto pegado para cumplir el formato (romanos).");
      updateButtonStates();
    }
  });

  input.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      e.preventDefault();
      if(!filaSel) btnGuardar.click();
      else if(isDirty()) btnModificar.click();
    }
  });

  // ======= Guardar =======
  btnGuardar.addEventListener("click", async ()=>{
    if(!input.checkValidity()){ input.reportValidity(); return; }
    const nombre = (input.value||"").trim();
    if(!nombre){ toastInfo("Escribe el nombre de la materia"); return; }

    const dup = existeDuplicadaMateria(nombre, materias, null);
    if (dup.existe){
      const msg = dup.motivo==="formato" ? dup.motivo :
        `Ya existe una materia equivalente o no compatible con niveles: “${dup.con}”.`;
      showToast({type:"warn", title:"Atención", desc: msg});
      return;
    }

    try{
      const body = JSON.stringify({ nombre, id_Carrera: DEFAULT_CARRERA_ID });
      const data = await fetchJson(API,{
        method:"POST", headers:{ "Content-Type":"application/json" }, body
      });

      toastSuccess("Guardado. Ahora puedes actualizar o eliminar.");
      const nuevoId = data.id_Materia;
      await cargarMaterias(nuevoId);
    }catch(err){
      const msg = err?.message || "";
      if (/ya existe/i.test(msg)) showToast({type:"warn", title:"Atención", desc:"Esa materia ya existe en la carrera."});
      else toastError(msg || "No se pudo guardar");
    }
  });

  // ======= Modificar =======
  btnModificar.addEventListener("click", async ()=>{
    if(!filaSel){ toastInfo("Selecciona una materia"); return; }
    const nombre = (input.value||"").trim();
    if(!nombre){ toastInfo("El nombre no puede estar vacío"); return; }

    const idSel = parseInt(filaSel.dataset.id,10);
    const dup = existeDuplicadaMateria(nombre, materias, idSel);
    if (dup.existe){
      const msg = dup.motivo==="formato" ? dup.motivo :
        `Ya existe una materia equivalente o no compatible con niveles: “${dup.con}”.`;
      showToast({type:"warn", title:"Atención", desc: msg});
      return;
    }

    const id_Materia = idSel;
    const id_Carrera = parseInt(filaSel.dataset.idCarrera||DEFAULT_CARRERA_ID, 10);

    try{
      const body = JSON.stringify({ id_Materia, nombre, id_Carrera });
      const data = await fetchJson(API,{
        method:"PUT", headers:{ "Content-Type":"application/json" }, body
      });

      toastSuccess(data.mensaje || "Materia actualizada");
      await cargarMaterias();
      limpiarSeleccion();
    }catch(err){
      const msg = err?.message || "";
      if (/ya existe/i.test(msg)) showToast({type:"warn", title:"Atención", desc:"Ese nombre ya existe en esa carrera."});
      else toastError(msg || "No se pudo actualizar");
    }
  });

  // ======= Eliminar =======
  btnEliminar.addEventListener("click", async ()=>{
    if(!filaSel){ toastInfo("Selecciona una materia"); return; }
    if(isDirty()){
      showToast({type:"warn", title:"Atención", desc:"No puedes eliminar: estás editando esta materia. Presiona ACTUALIZAR primero."});
      return;
    }

    const id     = parseInt(filaSel.dataset.id,10);
    const nombre = (filaSel.firstElementChild?.textContent||"").trim();

    const ok = await showConfirm(
      `Se borrará la materia: "${nombre}".\n¿Estás seguro?`,
      { title:"Eliminar materia" }
    );
    if(!ok) return;

    try{
      const url = `${API}?id_Materia=${encodeURIComponent(id)}`;
      const data = await fetchJson(url, { method:"DELETE" });
      showToast({type:"success", title:"Hecho", desc: data.mensaje || `Materia "${nombre}" eliminada`});

      await cargarMaterias();
      limpiarSeleccion();
    }catch(err){
      toastError(err.message||"No se pudo eliminar");
    }
  });

  // ======= NUEVO: Botón Cancelar =======
  if (btnCancelar) {
    btnCancelar.addEventListener("click", ()=>{
      if (!hasUnsaved()) return;
      limpiarSeleccion();
      showToast({type:"info", title:"Cancelado", desc:"Se limpiaron los cambios del formulario."});
    });
  }

  // Confirmación al salir
  homeLink?.addEventListener("click", async (e)=>{
    if(!hasUnsaved()) return;
    e.preventDefault();
    const msg = !filaSel ? "Tienes datos sin guardar en el formulario."
                          : "Tienes cambios sin guardar en la materia seleccionada.";
    const ok = await showConfirm(`${msg}\nSi sales ahora, perderás los datos.\n\n¿Deseas salir igualmente?`, {title:"Salir"});
    if(ok) window.location.href = homeLink.href;
  });

  // Carga inicial
  cargarMaterias().then(updateButtonStates);
})();
