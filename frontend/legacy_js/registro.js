"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const form    = document.getElementById("registroForm");
  const ncInput = document.getElementById("numeroControl");
  const msgBox  = document.getElementById("mensaje");

  // Crea el hint si no existe
  let ncHelp = document.getElementById("nc-help");
  if (!ncHelp) {
    ncHelp = document.createElement("small");
    ncHelp.id = "nc-help";
    ncHelp.className = "hint";
    const container = ncInput.closest(".input-container") || ncInput.parentElement;
    container.insertAdjacentElement("afterend", ncHelp);
  }

  let ncBusy = false;           // true si ya existe en BD
  let typingTimer = null;
  const DEBOUNCE_MS = 350;
  const isEightDigits = v => /^\d{8}$/.test(v);

  const showFormMsg = (texto, tipo) => {
    msgBox.textContent = texto || "";
    msgBox.className = "mensaje " + (tipo || "");
  };

  const showNcHint = (texto, ok = false) => {
    ncHelp.textContent = texto || "";
    ncHelp.className = "hint " + (ok ? "ok" : (texto ? "err" : ""));
  };

  // Input: solo dígitos, máx 8, validación + verificación en vivo
  ncInput.addEventListener("input", () => {
    ncInput.value = ncInput.value.replace(/\D+/g, "").slice(0, 8);

    clearTimeout(typingTimer);
    const v = ncInput.value;

    if (!v) { showNcHint(""); ncBusy = false; return; }
    if (!isEightDigits(v)) { showNcHint("Debe tener exactamente 8 dígitos.", false); ncBusy = true; return; }

    typingTimer = setTimeout(checkAvailability, DEBOUNCE_MS);
  });

  async function checkAvailability() {
    const v = ncInput.value.trim();
    if (!isEightDigits(v)) return;

    try {
      const r = await fetch(`http://localhost:8000/backend/check_numero_control.php?numeroControl=${encodeURIComponent(v)}`);
      const data = await r.json();

      if (data && data.exists === true) {
        ncBusy = true;
        showNcHint("❌ Este número de control ya está en uso.", false);
      } else if (data && data.exists === false) {
        ncBusy = false;
        showNcHint("✅ Número de control disponible.", true);
      } else {
        ncBusy = false;
        showNcHint("No se pudo verificar ahora.", false);
      }
    } catch {
      // Si falla la verificación en vivo, no bloquees el submit
      ncBusy = false;
      showNcHint("No se pudo verificar ahora.", false);
    }
  }

  // Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const numeroControl   = ncInput.value.trim();
    const nombre          = document.getElementById("nombre").value.trim();
    const apellidoPaterno = document.getElementById("apellidoPaterno").value.trim();
    const apellidoMaterno = document.getElementById("apellidoMaterno").value.trim();
    const carrera         = document.getElementById("carrera").value;
    const clave           = document.getElementById("clave").value.trim();
    const confirmarClave  = document.getElementById("confirmarClave").value.trim();

    // Campos
    if (!numeroControl || !nombre || !apellidoPaterno || !apellidoMaterno || !carrera || !clave || !confirmarClave) {
      showFormMsg("⚠️ Por favor llena todos los campos.", "error"); return;
    }
    if (!isEightDigits(numeroControl)) {
      showFormMsg("⚠️ El número de control debe tener exactamente 8 dígitos.", "error");
      ncInput.focus(); return;
    }
    if (clave !== confirmarClave) {
      showFormMsg("❌ Las contraseñas no coinciden.", "error"); return;
    }
    if (ncBusy) {
      showFormMsg("❌ El número de control ya está en uso.", "error"); return;
    }

    // Envío definitivo
    try {
      const resp = await fetch("http://localhost:8000/backend/registro.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numeroControl, nombre, apellidoPaterno, apellidoMaterno, carrera, clave })
      });
      const data = await resp.json();

      const msg = (data && typeof data.message === "string") ? data.message : "Ocurrió un problema.";
      showFormMsg(msg, data && data.success ? "exito" : "error");

      if (data && data.success) {
        setTimeout(() => { window.location.href = "../Login/index.html"; }, 1500);
      }
    } catch {
      showFormMsg("❌ Error al conectar con el servidor.", "error");
    }
  });
});
