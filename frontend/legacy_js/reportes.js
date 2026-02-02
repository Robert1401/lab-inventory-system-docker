// Reportes: avisos centrados con blur + navegación
(() => {
  const $ = (s) => document.querySelector(s);

  // Rutas de destino
  const RUTAS = {
    inv: "reporte-inventario.html",
    mov: "reporte-movimiento.html",
    ase: "reporte-asesorias.html",
  };

  // Overlay centrado
  const overlay = $("#center-overlay");
  const coIcon  = $("#coIcon");
  const coTitle = $("#coTitle");
  const coText  = $("#coText");
  const coProg  = $("#coProgress");

  function openCenter({ icon="⏳", title="Abriendo…", text="Preparando el reporte" }){
    coIcon.textContent  = icon;
    coTitle.textContent = title;
    coText.textContent  = text;

    // reinicia la barra
    coProg.style.animation = "none";
    void coProg.offsetWidth; // force reflow
    coProg.style.animation = "";

    overlay.hidden = false;
    // bloqueo básico de scroll
    document.documentElement.style.overflow = "hidden";
  }
  function closeCenter(){
    overlay.hidden = true;
    document.documentElement.style.overflow = "";
  }

  // Abre overlay y navega
  function abrirYIr(msg, ruta){
    openCenter(msg);
    // Pequeño delay para que se vea el aviso (y la animación)
    setTimeout(() => {
      // cierra por si es navegación interna sin recargar (SPA); en este caso cambia de página
      closeCenter();
      location.href = ruta;
    }, 700); // sutil, se siente fluido
  }

  // Botones
  $("#btnInv")?.addEventListener("click", () => {
    abrirYIr(
      { icon:"📦", title:"Abriendo reporte de inventario…", text:"Cargando existencias y ubicaciones" },
      RUTAS.inv
    );
  });

  $("#btnMov")?.addEventListener("click", () => {
    abrirYIr(
      { icon:"🧰", title:"Abriendo reporte de material…", text:"Compilando movimientos y salidas" },
      RUTAS.mov
    );
  });

  $("#btnAse")?.addEventListener("click", () => {
    abrirYIr(
      { icon:"📚", title:"Abriendo reporte de asesorías…", text:"Listando sesiones y asistentes" },
      RUTAS.ase
    );
  });

  // Cerrar al presionar ESC (por si el usuario se arrepiente antes de navegar)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) {
      closeCenter();
    }
  });
})();
