/* =========================================================
   notify.js — Toasters abajo-derecha + confirm centrado
   Uso:
     notify.toast("Guardado", "success");
     notify.toast("Algo salió mal", "error", {timeout:2500});
     notify.confirm("¿Eliminar?", { okText:"Sí", cancelText:"No" }).then(ok=>{ ... });
========================================================= */
(function(){
  const POS_HOST_ID = "nv-toasts";
  const CONF_ID     = "nv-confirm";

  const THEME = {
    success: {bg:"#065f46", fg:"#fff"},
    error:   {bg:"#991b1b", fg:"#fff"},
    info:    {bg:"#1f2937", fg:"#fff"},
    warn:    {bg:"#92400e", fg:"#fff"}
  };

  function ensureToastsHost(){
    if (document.getElementById(POS_HOST_ID)) return;
    const style = document.createElement("style");
    style.textContent = `
#${POS_HOST_ID}{position:fixed;right:20px;bottom:18px;z-index:99999;display:flex;flex-direction:column;gap:10px}
.nv-toast{
  min-width:220px; max-width:380px; padding:12px 14px; border-radius:14px; color:#fff; box-shadow:0 18px 44px rgba(0,0,0,.28);
  font:600 14px/1.35 system-ui,Segoe UI,Roboto,Arial; transform:translateY(10px) scale(.98); opacity:0;
  transition:transform .18s ease, opacity .18s ease, filter .2s ease;
}
.nv-toast.show{opacity:1; transform:translateY(0) scale(1)}
    `;
    document.head.appendChild(style);
    const host = document.createElement("div");
    host.id = POS_HOST_ID;
    document.body.appendChild(host);
  }

  function toast(text, type="info", {timeout=1800}={}){
    ensureToastsHost();
    const host = document.getElementById(POS_HOST_ID);
    const t = document.createElement("div");
    const theme = THEME[type] || THEME.info;
    t.className = "nv-toast";
    t.style.background = theme.bg;
    t.style.color      = theme.fg;
    t.textContent = text;
    host.appendChild(t);
    requestAnimationFrame(()=> t.classList.add("show"));
    setTimeout(()=>{ t.classList.remove("show"); setTimeout(()=>t.remove(), 180); }, timeout);
  }

  function confirm(message, { title="Confirmación", okText="Aceptar", cancelText="Cancelar" } = {}){
    // Modal centrado SOLO para confirmaciones/decisiones
    return new Promise((resolve)=>{
      if (document.getElementById(CONF_ID)) return;
      const style = document.createElement("style");
      style.textContent = `
#${CONF_ID}{position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);z-index:100000}
.nv-card{background:#fff;max-width:520px;width:min(92%,520px);border-radius:16px;box-shadow:0 22px 60px rgba(0,0,0,.35);
  padding:18px 16px 14px; transform:translateY(16px) scale(.98); opacity:0; transition:.22s ease}
.nv-card.show{transform:translateY(0) scale(1); opacity:1}
.nv-title{font:800 18px/1.2 system-ui,Segoe UI,Roboto,Arial; color:#1f2937; margin-bottom:6px}
.nv-msg{color:#374151; margin:6px 2px 12px; line-height:1.45}
.nv-actions{display:flex; gap:10px; justify-content:flex-end}
.nv-btn{border:0;border-radius:12px;padding:10px 16px;font-weight:700;cursor:pointer}
.nv-cancel{background:#e5e7eb;color:#111827}
.nv-ok{background:#065f46;color:#fff}
      `;
      document.head.appendChild(style);

      const layer = document.createElement("div");
      layer.id = CONF_ID;
      layer.innerHTML = `
        <div class="nv-card">
          <div class="nv-title">${title}</div>
          <div class="nv-msg">${message}</div>
          <div class="nv-actions">
            <button class="nv-btn nv-cancel">${cancelText}</button>
            <button class="nv-btn nv-ok">${okText}</button>
          </div>
        </div>`;
      document.body.appendChild(layer);
      const card = layer.querySelector(".nv-card");
      requestAnimationFrame(()=> card.classList.add("show"));

      layer.addEventListener("click", (e)=>{ if(e.target===layer){ cleanup(false);} });
      layer.querySelector(".nv-cancel").onclick = ()=> cleanup(false);
      layer.querySelector(".nv-ok").onclick     = ()=> cleanup(true);

      function cleanup(v){
        card.classList.remove("show");
        setTimeout(()=> layer.remove(), 180);
        resolve(v);
      }
    });
  }

  window.notify = { toast, confirm };
})();
