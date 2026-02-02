(() => {
  "use strict";

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const POS_KEY = "LE_SHIMEJI_POS";
  const LAST_KEY = "LE_ANN_LAST";

  function getLastMap() {
    try { return JSON.parse(localStorage.getItem(LAST_KEY) || "{}"); }
    catch { return {}; }
  }
  function setLast(key) {
    const map = getLastMap();
    map[key] = Date.now();
    try { localStorage.setItem(LAST_KEY, JSON.stringify(map)); } catch {}
  }
  function canShow(key, cooldownMs) {
    if (!key) return true;
    const map = getLastMap();
    const last = map[key] || 0;
    return (Date.now() - last) > cooldownMs;
  }

  /* =========================
     MODAL (SINGLETON + CLOSE FIX)
     ========================= */
  function ensureModal() {
    let overlay = document.getElementById("announceOverlay");

    // si ya existe y es nuestro, ok
    if (overlay && overlay.dataset.leAnnounce === "1") return overlay;

    // si existe pero no es nuestro, eliminamos para evitar conflicto
    if (overlay && overlay.dataset.leAnnounce !== "1") {
      try { overlay.remove(); } catch {}
    }

    overlay = document.createElement("div");
    overlay.id = "announceOverlay";
    overlay.dataset.leAnnounce = "1";
    overlay.className = "announce-overlay";
    overlay.setAttribute("aria-hidden", "true");

    overlay.innerHTML = `
      <div class="announce-modal" role="dialog" aria-modal="true" aria-label="Mensaje">
        <button class="announce-close" type="button" aria-label="Cerrar">
          ✕
        </button>

        <div class="announce-badge" id="announceBadge">AVISO</div>
        <h3 class="announce-title" id="announceTitle">Título</h3>
        <p class="announce-text" id="announceText">Mensaje</p>

        <div class="announce-actions">
          <button class="announce-btn" type="button" id="announceOk">Entendido</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // click fuera / X / OK
    overlay.addEventListener("click", (e) => {
      const t = e.target;

      if (t === overlay) closeModal(); // click fuera del modal
      if (t.closest && t.closest(".announce-close")) closeModal();
      if (t.id === "announceOk" || (t.closest && t.closest("#announceOk"))) closeModal();
    });

    // Escape
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    return overlay;
  }

  function closeModal() {
    const overlay = document.getElementById("announceOverlay");
    if (!overlay) return;
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
  }

  function openModal({
    type = "AVISO",
    heading = "Aviso",
    message = "...",
    key = "",
    cooldownMs = 8000
  } = {}) {
    if (key && !canShow(key, cooldownMs)) return;
    if (key) setLast(key);

    const overlay = ensureModal();
    const badge = overlay.querySelector("#announceBadge");
    const title = overlay.querySelector("#announceTitle");
    const text  = overlay.querySelector("#announceText");

    if (badge) badge.textContent = type;
    if (title) title.textContent = heading;
    if (text)  text.textContent  = message;

    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");

    const okBtn = overlay.querySelector("#announceOk");
    okBtn && okBtn.focus();
  }

  /* =========================
     SHIMEJI (SINGLETON)
     ========================= */
  function ensureShimeji() {
    let sh = document.getElementById("shimeji");
    if (sh) return sh;

    sh = document.createElement("div");
    sh.id = "shimeji";
    sh.className = "shimeji";
    sh.setAttribute("aria-label", "Burrito guía");

    // OJO: la ruta de la imagen depende del html donde estés.
    // Si en algún html cambia, puedes setearla con: window.LE_setBurritoImg("ruta")
    const defaultImg = "../assets/Burrito.png";

    sh.innerHTML = `
      <div class="shimeji-bubble" id="shimejiBubble">¡Bienvenido! 🫏</div>
      <div class="shimeji-actions" id="shimejiActions">
        <button type="button" class="sh-btn" id="shHelp">Ayuda</button>
        <button type="button" class="sh-btn" id="shTips">Tip</button>
        <button type="button" class="sh-btn primary" id="shNews">Anuncio</button>
      </div>
      <img id="shimejiImg" src="${defaultImg}" alt="Burrito asistente">
    `;

    document.body.appendChild(sh);
    return sh;
  }

  const shimeji = ensureShimeji();
  const bubble = shimeji.querySelector("#shimejiBubble");
  const img = shimeji.querySelector("#shimejiImg");
  const btnHelp = shimeji.querySelector("#shHelp");
  const btnTips = shimeji.querySelector("#shTips");
  const btnNews = shimeji.querySelector("#shNews");

  const say = (msg) => { if (bubble) bubble.textContent = msg || ""; };

  const tips = [
    "Tip: tu contraseña distingue mayúsculas/minúsculas 🔒",
    "Tip: revisa si tienes CAPS LOCK activado 👀",
    "Tip: usa una contraseña corta pero segura ✅",
    "Tip: puedes moverme si estorbo 😄",
  ];

  btnHelp && btnHelp.addEventListener("click", () => {
    say("Ayuda: llena los campos y presiona Registrarse. Si hay problemas, pide apoyo al encargado 🫏");
  });

  btnTips && btnTips.addEventListener("click", () => {
    say(tips[Math.floor(Math.random() * tips.length)]);
  });

  btnNews && btnNews.addEventListener("click", () => {
    openModal({
      type: "SOPORTE",
      heading: "Recuperación de contraseña",
      message: "Solicita recuperación al encargado del laboratorio. Si tienes problemas, verifica tus datos y vuelve a intentar.",
      key: "support_notice",
      cooldownMs: 4000
    });
  });

  img && img.addEventListener("click", () => {
    say(tips[Math.floor(Math.random() * tips.length)]);
  });

  /* =========================
     POSICIÓN + DRAG + CLAMP
     ========================= */
  function keepOnScreen(el) {
    const rect = el.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;

    const x = clamp(rect.left, 0, maxX);
    const y = clamp(rect.top, 0, maxY);

    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
  }

  function applySavedPosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || "null");
      if (!saved) {
        keepOnScreen(shimeji);
        return;
      }
      shimeji.style.left = saved.x + "px";
      shimeji.style.top  = saved.y + "px";
      shimeji.style.right = "auto";
      shimeji.style.bottom = "auto";
      keepOnScreen(shimeji);
    } catch {
      keepOnScreen(shimeji);
    }
  }

  requestAnimationFrame(applySavedPosition);
  window.addEventListener("resize", applySavedPosition);

  let dragging = false, offsetX = 0, offsetY = 0;

  shimeji.addEventListener("mousedown", (e) => {
    dragging = true;
    const rect = shimeji.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    shimeji.style.right = "auto";
    shimeji.style.bottom = "auto";
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;

    const rect = shimeji.getBoundingClientRect();
    try { localStorage.setItem(POS_KEY, JSON.stringify({ x: rect.left, y: rect.top })); } catch {}
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;

    let x = e.clientX - offsetX;
    let y = e.clientY - offsetY;

    const maxX = window.innerWidth - shimeji.offsetWidth;
    const maxY = window.innerHeight - shimeji.offsetHeight;

    shimeji.style.left = clamp(x, 0, maxX) + "px";
    shimeji.style.top  = clamp(y, 0, maxY) + "px";
  });

  /* =========================
     APIs globales
     ========================= */
  window.burritoSay = (msg) => say(msg || "¿En qué te ayudo? 🫏");
  window.burritoOk  = (msg) => say(msg || "¡Listo! ✅");
  window.burritoError = (msg) => say(msg || "Ups… ocurrió un problema 😵");

  window.LE_announce = (payload) => openModal(payload);

  // Por si un html tiene ruta distinta de la imagen:
  window.LE_setBurritoImg = (src) => {
    if (img && src) img.src = src;
  };

  // inicio
  say("¡Bienvenido! 🫏 Usa mis botones si necesitas ayuda.");
})();

