(() => {
  "use strict";

  // ======================
  // CONFIG
  // ======================
  const POS_KEY = "LE_SHIMEJI_POS_AUX";
  const NOTI_KEY = "LE_NOTIFICATIONS";        // lista
  const NOTI_SEQ = "LE_NOTIFICATIONS_SEQ";   // id incremental

  // ✅ Ajusta si tu ruta cambia:
  const SHIMEJI_IMG = "../assets/shimeji.png";

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  // ======================
  // NOTIFICATIONS STORAGE
  // ======================
  function loadNotis() {
    try {
      const arr = JSON.parse(localStorage.getItem(NOTI_KEY) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveNotis(arr) {
    try { localStorage.setItem(NOTI_KEY, JSON.stringify(arr)); } catch {}
  }

  function nextNotiId() {
    let n = 0;
    try { n = parseInt(localStorage.getItem(NOTI_SEQ) || "0", 10) || 0; } catch {}
    n += 1;
    try { localStorage.setItem(NOTI_SEQ, String(n)); } catch {}
    return n;
  }

  function unreadCount(arr) {
    return (arr || []).filter(n => !n.read).length;
  }

  // API para agregar notificación desde cualquier página
  // window.LE_notify({ title, message, type })
  function addNoti({ title = "Aviso", message = "", type = "info" } = {}) {
    const list = loadNotis();
    list.unshift({
      id: nextNotiId(),
      title: String(title),
      message: String(message),
      type: String(type), // info | ok | warn | err
      read: false,
      ts: Date.now()
    });

    // limita a 30 para que no crezca infinito
    const trimmed = list.slice(0, 30);
    saveNotis(trimmed);
    refreshNotiUI(trimmed);

    // muestra preview
    say(`🔔 ${title}: ${message}`.slice(0, 120));
  }

  function markAllRead() {
    const list = loadNotis().map(n => ({ ...n, read: true }));
    saveNotis(list);
    refreshNotiUI(list);
    say("✅ Notificaciones marcadas como leídas");
  }

  function clearNotis() {
    saveNotis([]);
    refreshNotiUI([]);
    say("🧹 Notificaciones limpiadas");
  }

  // ======================
  // UI SHIMEJI
  // ======================
  function ensureShimeji() {
    let sh = document.getElementById("shimejiAux");
    if (sh) return sh;

    sh = document.createElement("div");
    sh.id = "shimejiAux";
    sh.className = "shimeji-aux";
    sh.setAttribute("aria-label", "Asistente");

    sh.innerHTML = `
      <div class="shimeji-aux-bubble" id="shBubble">Cargando…</div>

      <div class="shimeji-aux-actions">
        <button type="button" class="sh-btn" data-msg="¿Qué módulo quieres abrir? 👇">Saludo</button>
        <button type="button" class="sh-btn" data-msg="Tip: si algo no carga, recarga con Ctrl+F5 ✅">Tip</button>

        <!-- 🔔 Notificaciones -->
        <button type="button" class="sh-btn sh-noti" id="shNotiBtn" title="Notificaciones">
          <span>Notif</span>
          <span class="sh-badge" id="shBadge" aria-label="No leídas">0</span>
        </button>

        <button type="button" class="sh-btn primary" id="shHelpBtn">Ayuda</button>
      </div>

      <!-- Panel de notificaciones -->
      <div class="shimeji-aux-notibox" id="shNotiBox" aria-hidden="true">
        <div class="sh-noti-head">
          <strong>Notificaciones</strong>
          <div class="sh-noti-head-actions">
            <button type="button" class="sh-mini" id="shMarkRead">Leídas</button>
            <button type="button" class="sh-mini" id="shClear">Limpiar</button>
            <button type="button" class="sh-mini" id="shCloseNoti">✕</button>
          </div>
        </div>
        <div class="sh-noti-list" id="shNotiList"></div>
      </div>

      <img id="shImg" src="${SHIMEJI_IMG}" alt="Shimeji">
    `;

    document.body.appendChild(sh);
    return sh;
  }

  const sh = ensureShimeji();
  const bubble = sh.querySelector("#shBubble");
  const img = sh.querySelector("#shImg");
  const helpBtn = sh.querySelector("#shHelpBtn");

  const notiBtn = sh.querySelector("#shNotiBtn");
  const badge = sh.querySelector("#shBadge");
  const notiBox = sh.querySelector("#shNotiBox");
  const notiList = sh.querySelector("#shNotiList");
  const btnMarkRead = sh.querySelector("#shMarkRead");
  const btnClear = sh.querySelector("#shClear");
  const btnCloseNoti = sh.querySelector("#shCloseNoti");

  const say = (msg) => { if (bubble) bubble.textContent = msg || ""; };

  // debug img
  img?.addEventListener("error", () => {
    console.error("No se encontró la imagen:", SHIMEJI_IMG);
    say("No encuentro shimeji.png 😵 Revisa la ruta en shimeji-auxiliar.js");
  });

  // ======================
  // Noti UI rendering
  // ======================
  function formatTime(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleString("es-MX", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
    } catch {
      return "";
    }
  }

  function notiIcon(type) {
    if (type === "ok") return "✅";
    if (type === "warn") return "⚠️";
    if (type === "err") return "⛔";
    return "🔔";
  }

  function refreshNotiUI(list) {
    const arr = list || loadNotis();
    const u = unreadCount(arr);

    if (badge) {
      badge.textContent = String(u);
      badge.style.display = u > 0 ? "inline-flex" : "none";
    }

    if (!notiList) return;
    if (arr.length === 0) {
      notiList.innerHTML = `<div class="sh-noti-empty">No hay notificaciones 👍</div>`;
      return;
    }

    notiList.innerHTML = arr.map(n => `
      <div class="sh-noti-item ${n.read ? "read" : "unread"}" data-id="${n.id}">
        <div class="sh-noti-row">
          <span class="sh-noti-ic">${notiIcon(n.type)}</span>
          <div class="sh-noti-main">
            <div class="sh-noti-title">${escapeHtml(n.title)}</div>
            <div class="sh-noti-msg">${escapeHtml(n.message)}</div>
            <div class="sh-noti-time">${formatTime(n.ts)}</div>
          </div>
          <button type="button" class="sh-mini sh-one-read" title="Marcar leída">✓</button>
        </div>
      </div>
    `).join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toggleNotiBox(forceOpen) {
    if (!notiBox) return;
    const open = forceOpen ?? notiBox.classList.contains("show");
    if (open) {
      notiBox.classList.remove("show");
      notiBox.setAttribute("aria-hidden", "true");
    } else {
      refreshNotiUI(loadNotis());
      notiBox.classList.add("show");
      notiBox.setAttribute("aria-hidden", "false");
    }
  }

  // click notif button
  notiBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleNotiBox();
  });

  btnCloseNoti?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleNotiBox(true); // close
  });

  btnMarkRead?.addEventListener("click", (e) => {
    e.stopPropagation();
    markAllRead();
  });

  btnClear?.addEventListener("click", (e) => {
    e.stopPropagation();
    clearNotis();
  });

  // marcar leída individual
  notiList?.addEventListener("click", (e) => {
    const one = e.target.closest(".sh-one-read");
    const item = e.target.closest(".sh-noti-item");
    if (!item) return;

    const id = parseInt(item.dataset.id || "0", 10);
    if (!id) return;

    const list = loadNotis();
    const idx = list.findIndex(n => n.id === id);
    if (idx >= 0) {
      list[idx].read = true;
      saveNotis(list);
      refreshNotiUI(list);
    }

    if (!one) {
      // si clickeas el item (no el botón), muestra el contenido en bubble
      const n = loadNotis().find(x => x.id === id);
      if (n) say(`${notiIcon(n.type)} ${n.title}: ${n.message}`.slice(0, 140));
    }
  });

  // cerrar notibox clic fuera
  document.addEventListener("click", (e) => {
    if (!notiBox?.classList.contains("show")) return;
    if (e.target.closest("#shNotiBox") || e.target.closest("#shNotiBtn")) return;
    toggleNotiBox(true);
  });

  // ======================
  // HELP + TIP buttons
  // ======================
  helpBtn?.addEventListener("click", () => {
    say("Ayuda: usa los botones del menú. Si te manda al login, revisa que exista LE_USER en localStorage 🧠");
  });

  sh.addEventListener("click", (e) => {
    const btn = e.target.closest(".sh-btn");
    if (!btn) return;
    const msg = btn.getAttribute("data-msg");
    if (msg) say(msg);
  });

  img?.addEventListener("click", () => {
    say("Tip: puedes arrastrarme para moverme 😄");
  });

  // ======================
  // POSITION + DRAG
  // ======================
  function keepOnScreen() {
    const rect = sh.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;

    sh.style.left = clamp(rect.left, 0, maxX) + "px";
    sh.style.top  = clamp(rect.top, 0, maxY) + "px";
    sh.style.right = "auto";
    sh.style.bottom = "auto";
  }

  function applySavedPosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || "null");
      if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
        sh.style.left = saved.x + "px";
        sh.style.top  = saved.y + "px";
        sh.style.right = "auto";
        sh.style.bottom = "auto";
      } else {
        sh.style.left = "18px";
        sh.style.top = "auto";
        sh.style.bottom = "18px";
      }
    } catch {}

    requestAnimationFrame(keepOnScreen);
  }

  applySavedPosition();
  window.addEventListener("resize", applySavedPosition);

  let dragging = false, offsetX = 0, offsetY = 0;

  sh.addEventListener("mousedown", (e) => {
    if (e.target.closest("button")) return; // no drag en botones
    if (e.target.closest("#shNotiBox")) return; // no drag dentro notibox

    dragging = true;
    const rect = sh.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    sh.style.right = "auto";
    sh.style.bottom = "auto";
    sh.classList.add("dragging");
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    sh.classList.remove("dragging");

    const rect = sh.getBoundingClientRect();
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({ x: rect.left, y: rect.top }));
    } catch {}
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;

    const maxX = window.innerWidth - sh.offsetWidth;
    const maxY = window.innerHeight - sh.offsetHeight;

    const x = clamp(e.clientX - offsetX, 0, maxX);
    const y = clamp(e.clientY - offsetY, 0, maxY);

    sh.style.left = x + "px";
    sh.style.top  = y + "px";
  });

  // ======================
  // GLOBAL APIs
  // ======================
  window.burritoSay = (msg) => say(msg || "¿En qué te ayudo? 🫏");
  window.LE_notify = addNoti;
  window.LE_notify_ok = (title, message) => addNoti({ title, message, type: "ok" });
  window.LE_notify_warn = (title, message) => addNoti({ title, message, type: "warn" });
  window.LE_notify_err = (title, message) => addNoti({ title, message, type: "err" });

  // ======================
  // STARTUP
  // ======================
  refreshNotiUI(loadNotis());

  document.addEventListener("DOMContentLoaded", () => {
    let u = null;
    try { u = JSON.parse(localStorage.getItem("LE_USER") || "null"); } catch {}
    const first = u?.nombre ? String(u.nombre).trim().split(/\s+/)[0] : "Usuario";
    say(`Hola ${first} 🫏 ¿Qué quieres abrir?`);

    // DEMO: si quieres probar rápido, descomenta:
    // window.LE_notify_ok("Pedido enviado", "Tu solicitud fue registrada correctamente.");
    // window.LE_notify("Aviso", "Hay inventario nuevo disponible.", "info");
  });

})();
