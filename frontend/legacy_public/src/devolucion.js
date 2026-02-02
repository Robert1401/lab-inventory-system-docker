"use strict";

/* =========================================
   devolucion.js (Alumno)
   - Usa el mismo préstamo que Prestamos.js:
       LE_prestamo_status
       LE_prestamo_data
   - Solo marca que el alumno ya devolvió el material:
       devuelto_solicitado = true
========================================= */

const D_KEYS = {
  STATUS: "LE_prestamo_status",
  DATA:   "LE_prestamo_data"
};

/* ========== NOTICE ========== */
function showNotice({title="Listo", message="", type="info", duration=2000}={}){
  const host = document.getElementById('noticeHost');
  if (!host) return;
  const iconMap = { success:'✔️', info:'ℹ️', warn:'⚠️', error:'⛔' };
  const icon = iconMap[type] || iconMap.info;
  host.innerHTML = `
    <div class="notice-card">
      <div class="notice-head">
        <div class="notice-icon ${type}">${icon}</div>
        <div><h3 class="notice-title">${title}</h3><p class="notice-msg">${message}</p></div>
      </div>
    </div>`;
  host.classList.add('show');
  const t = setTimeout(()=>{host.classList.remove('show');host.innerHTML='';}, duration);
  host.onclick=()=>{clearTimeout(t);host.classList.remove('show');host.innerHTML='';};
}

/* ========== HELPERS ========== */
const dReadJSON = (k, fb=null)=>{ try{ return JSON.parse(localStorage.getItem(k)||"null") ?? fb; }catch{ return fb; } };
const dSetJSON  = (k,v)=> localStorage.setItem(k, JSON.stringify(v));

function getLoan(){
  return dReadJSON(D_KEYS.DATA, {}) || {};
}

/* Pinta la lista de materiales prestados */
function renderPrestamo(){
  const lista = document.getElementById('listaPrestamos');
  if (!lista) return;

  const status = localStorage.getItem(D_KEYS.STATUS) || "";
  const loan   = getLoan();
  const items  = Array.isArray(loan?.items) ? loan.items : [];

  lista.innerHTML = "";
  if (status !== "en_curso" || !items.length){
    lista.innerHTML = `<div class="item" style="justify-content:center;color:#777">No hay materiales pendientes por devolver.</div>`;
    document.getElementById('btnConfirmar')?.setAttribute('disabled', 'true');
    return;
  }

  items.forEach(it=>{
    const row = document.createElement('div');
    row.className = 'item';
    row.innerHTML = `
      <i class="fa-solid fa-clipboard-list icono"></i>
      <input type="text" value="${(it.descripcion || it.material || 'Material')}  —  x${it.cantidad}" readonly>
    `;
    lista.appendChild(row);
  });
}

/* Autocompletar Materia, Maestro y Mesa desde el préstamo */
function fillMetaFromLoan(){
  const loan = getLoan();

  const materia = document.getElementById('materia');
  const maestro = document.getElementById('maestro');
  const mesa    = document.getElementById('mesa');

  if (materia){ materia.value = loan?.materia || ""; materia.readOnly = true; materia.placeholder=""; }
  if (maestro){ maestro.value = loan?.maestro || ""; maestro.readOnly = true; maestro.placeholder=""; }
  if (mesa){    mesa.value    = loan?.mesa    || ""; mesa.readOnly    = true; mesa.placeholder=""; }

  const status = localStorage.getItem(D_KEYS.STATUS) || "";
  if (status !== "en_curso" || !Array.isArray(loan?.items) || !loan.items.length){
    document.getElementById('btnConfirmar')?.setAttribute('disabled','true');
    showNotice({title:"Sin préstamo activo", message:"No hay materiales para devolver.", type:"warn", duration:2200});
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  // Fecha por defecto = hoy (YYYY-MM-DD)
  const f = document.getElementById('fecha');
  if (f){
    const d = new Date();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    f.value = `${d.getFullYear()}-${mm}-${dd}`;
  }

  // Pinta materiales y completa meta desde el préstamo guardado
  renderPrestamo();
  fillMetaFromLoan();

  // Confirmar devolución
  document.getElementById('btnConfirmar')?.addEventListener('click', ()=>{
    const status = localStorage.getItem(D_KEYS.STATUS) || "";
    const loan   = getLoan();

    if (status !== "en_curso" || !loan || !Array.isArray(loan.items) || !loan.items.length){
      showNotice({title:'Nada que devolver', message:'No hay préstamo activo.', type:'warn'});
      return;
    }

    const fechaDev = document.getElementById('fecha')?.value || new Date().toISOString().slice(0,10);

    const actualizado = {
      ...loan,
      devuelto_solicitado: true,
      devuelto_en: new Date().toISOString(),
      devolucion_meta: {
        fecha: fechaDev
      }
    };

    dSetJSON(D_KEYS.DATA, actualizado);

    showNotice({title:'Devolución registrada', message:'Espera a que el auxiliar revise el material.', type:'success'});
    setTimeout(()=> window.location.href = '../alumnos-inicial.html', 1200);
  });

  // Cancelar → menú
  document.getElementById('btnCancelar')?.addEventListener('click', ()=>{
    showNotice({title:'Cancelado', message:'Regresando al menú…', type:'info', duration:1200});
    setTimeout(()=> window.location.href = '../alumnos-inicial.html', 900);
  });
});
