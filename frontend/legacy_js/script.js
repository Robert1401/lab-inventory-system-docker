"use strict";

/* =========================
   CONFIG
========================= */
const API_URL = "http://localhost:8000/backend/login.php";

/* =========================
   TOAST
========================= */
function showToast(message, type = "info", duration = 3000) {
  const host = document.getElementById("toast");
  host.innerHTML = `<div class="card ${type}" role="status">${message}</div>`;
  host.classList.add("show");
  const hide = () => { host.classList.remove("show"); host.innerHTML = ""; };
  const t = setTimeout(hide, duration);
  host.onclick = () => { clearTimeout(t); hide(); };
}

/* =========================
   INPUTS: restricciones
========================= */
(() => {
  const nc = document.getElementById("numeroControl");
  if (!nc) return;
  nc.setAttribute("inputmode", "numeric");
  nc.setAttribute("pattern", "\\d*");
  nc.setAttribute("maxlength", "8");

  nc.addEventListener("keydown", (e) => {
    const ok = ["Backspace","Delete","Tab","ArrowLeft","ArrowRight","Home","End"];
    if (ok.includes(e.key) || e.ctrlKey || e.metaKey) return;
    if (/^\d$/.test(e.key)) return;
    e.preventDefault();
  });

  nc.addEventListener("paste", (e) => {
    const t = (e.clipboardData || window.clipboardData).getData("text") || "";
    if (/\D/.test(t)) {
      e.preventDefault();
      const digits = t.replace(/\D/g, "");
      if (!digits) return;
      const start = nc.selectionStart ?? nc.value.length;
      const end   = nc.selectionEnd   ?? nc.value.length;
      const max   = nc.maxLength > 0 ? nc.maxLength : Infinity;
      const newVal = (nc.value.slice(0,start) + digits + nc.value.slice(end)).slice(0,max);
      const pos    = Math.min(start + digits.length, newVal.length);
      nc.value = newVal;
      requestAnimationFrame(() => nc.setSelectionRange(pos, pos));
    }
  });

  nc.addEventListener("input", () => {
    const only = nc.value.replace(/\D/g, "");
    if (only !== nc.value) nc.value = only;
  });
})();

(() => {
  const pw = document.getElementById("password");
  if (!pw) return;
  pw.setAttribute("maxlength", "10");

  pw.addEventListener("keydown", (e) => {
    const ok = ["Backspace","Delete","Tab","ArrowLeft","ArrowRight","Home","End"];
    if (ok.includes(e.key) || e.ctrlKey || e.metaKey) return;
    if (pw.value.length >= 10) e.preventDefault();
  });

  pw.addEventListener("paste", (e) => {
    const p = (e.clipboardData || window.clipboardData).getData("text") || "";
    const curr = pw.value;
    const sel  = pw.selectionEnd - pw.selectionStart;
    const total = curr.length - sel + p.length;
    if (total > 10) {
      e.preventDefault();
      pw.value = (curr.slice(0, pw.selectionStart) + p).slice(0, 10);
    }
  });
})();

/* =========================
   LOGIN
========================= */
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const numeroControl = (document.getElementById("numeroControl").value || "").trim();
  const password      = (document.getElementById("password").value || "").trim();
  const btn           = e.submitter || document.querySelector('#loginForm button[type="submit"]');

  if (!numeroControl || !password) {
    showToast("⚠️ Por favor, completa todos los campos.", "info"); return;
  }
  if (!/^\d+$/.test(numeroControl)) {
    showToast("🔎 El número de control debe ser numérico.", "info"); return;
  }
  const len = numeroControl.length;
  if (len < 4) { showToast("🔎 Faltan dígitos.", "info"); return; }
  if (len >= 5 && len <= 7) { showToast("🔎 Debe tener 4 (auxiliar) o 8 (alumno) dígitos.", "info"); return; }
  if (len > 8) { showToast("🔎 Te pasaste de dígitos.", "info"); return; }
  if (password.length > 10) { showToast("🔐 La contraseña no puede superar los 10 caracteres.", "info"); return; }

  try {
    if (btn) btn.disabled = true;

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numeroControl, password }),
    });

    if (!res.ok) {
      showToast(`❌ Error del servidor (${res.status}).`, "error"); return;
    }

    const data = await res.json();

    showToast(data.message || "Operación realizada.", data.success ? "success" : "error", 2600);

    if (data.success) {
      // 🔴🔴 IMPORTANTE: Guardar el usuario para que alumnos-inicial lo lea
      // Estructura que consume alumnos-inicial.js:
      //   LE_user.nombreCompleto  (string)
      //   LE_user.numeroControl   (string)
      //   LE_user.rol             ("alumno"|"auxiliar")
      const user = {
        nombreCompleto: data.nombre || "",
        numeroControl : data.numeroControl || numeroControl,
        rol           : (data.rol || "").toLowerCase()
      };
      try {
        localStorage.setItem("LE_user", JSON.stringify(user));
      } catch {}

      // Limpieza suave del flujo anterior (evita arrastrar estados viejos)
      [
        "LE_form_ctx","LE_tmp_solicitud_vale","LE_vale_payload","LE_num_vale",
        "SV_SEARCH_Q","SV_FLOW_ACTIVE","LE_prestamo_status","LE_prestamo_data"
      ].forEach(k => { try { localStorage.removeItem(k); } catch {} });

      setTimeout(() => {
        if (user.rol === "auxiliar") {
          window.location.href = "/frontend/public/Auxiliar/auxiliar.html";
        } else if (user.rol === "alumno") {
          window.location.href = "/frontend/public/Alumnos/alumnos-inicial.html";
        } else {
          // si por alguna razón el rol no viene, lo mandamos a alumnos
          window.location.href = "/frontend/public/Alumnos/alumnos-inicial.html";
        }
      }, 450);
    }
  } catch (err) {
    console.error(err);
    showToast("❌ No se pudo conectar con el servidor. Verifica tu conexión o que el backend esté activo.", "error", 3500);
  } finally {
    if (btn) btn.disabled = false;
  }
});
