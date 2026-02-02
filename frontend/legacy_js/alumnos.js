// ====== alumnos-inicial.js (menú principal de alumnos) ======
(function () {
  // ------------------------------
  // Rutas (ajústalas a tu estructura)
  // ------------------------------
  const ROUTES = {
    solicitud:  "../Solicitud de Material/solicitud-materiales.html",
    devolucion: "devolucion.html",
    asesorias:  "asesorias.html",
    home:       "../index.html"
  };

  // ------------------------------
  // Claves de estado global (localStorage)
  // ------------------------------
  const ACTIVE_LOAN_KEY  = "LE_prestamo_activo";  // "1" o "0"
  const ACTIVE_LOAN_DATA = "LE_prestamo_data";    // JSON con items, etc.

  // ------------------------------
  // Helpers
  // ------------------------------
  const $  = (s) => document.querySelector(s);

  const hasActiveLoan = () => localStorage.getItem(ACTIVE_LOAN_KEY) === "1";

  function getLoanData() {
    try { return JSON.parse(localStorage.getItem(ACTIVE_LOAN_DATA) || "{}"); }
    catch { return {}; }
  }

  function setCardDisabled(card, disabled, reason = "") {
    if (!card) return;
    if (disabled) {
      card.classList.add("disabled");
      card.setAttribute("aria-disabled", "true");
      card.dataset.disabled = "1";
      if (reason) card.title = reason;
    } else {
      card.classList.remove("disabled");
      card.removeAttribute("aria-disabled");
      delete card.dataset.disabled;
      card.removeAttribute("title");
    }
  }

  // Coloca un “badge” con la cantidad total prestada en la tarjeta de devoluciones
  function renderBadges() {
    const loan = getLoanData();
    const total = Array.isArray(loan?.items)
      ? loan.items.reduce((acc, it) => acc + (parseInt(it.cantidad || 0, 10) || 0), 0)
      : 0;

    const header = document.querySelector('.card[data-action="devolucion"] .card-header');
    if (!header) return;

    // Limpia badge anterior
    header.querySelector(".card-badge")?.remove();

    if (total > 0) {
      const badge = document.createElement("span");
      badge.className = "card-badge";
      badge.textContent = `${total} en uso`;
      header.appendChild(badge);
    }
  }

  // Aplica el estado inicial según si hay préstamo activo
  function applyState() {
    const cardSolicitud  = document.querySelector('.card[data-action="solicitud"]');
    const cardDevolucion = document.querySelector('.card[data-action="devolucion"]');

    if (hasActiveLoan()) {
      setCardDisabled(cardSolicitud, true, "Tienes un préstamo activo. Devuélvelo para solicitar de nuevo.");
      setCardDisabled(cardDevolucion, false);
      renderBadges();
    } else {
      setCardDisabled(cardSolicitud, false);
      setCardDisabled(cardDevolucion, true, "No tienes materiales por devolver.");
      // Limpia badges
      document.querySelectorAll(".card-badge").forEach(b => b.remove());
    }
  }

  // ------------------------------
  // Navegación por tarjetas
  // ------------------------------
  document.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;

    // No navegar si está deshabilitada
    if (card.dataset.disabled === "1") {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const action = card.dataset.action;
    const destino = ROUTES[action];
    if (!destino) return;

    // Animación breve y navegación
    card.style.transition = "transform .15s ease";
    card.style.transform = "scale(0.97)";
    setTimeout(() => {
      card.style.transform = "scale(1)";
      window.location.href = destino;
    }, 140);
  });

  // ------------------------------
  // Botón "Regresar"
  // ------------------------------
  $("#btnBack")?.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else window.location.href = ROUTES.home;
  });

  // ------------------------------
  // Inicialización y reactividad al storage
  // ------------------------------
  document.addEventListener("DOMContentLoaded", applyState);

  // Si otra pestaña/página cambia el estado, reflejarlo aquí
  window.addEventListener("storage", (e) => {
    if (e.key === ACTIVE_LOAN_KEY || e.key === ACTIVE_LOAN_DATA) applyState();
  });
})();
