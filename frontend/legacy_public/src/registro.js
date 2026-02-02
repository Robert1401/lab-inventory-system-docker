"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registroForm");
  const ncInput = document.getElementById("numeroControl");
  const btnRegistro = document.getElementById("btnRegistro");
  const ncHelp = document.getElementById("nc-help");

  // ✅ Node backend
  const API_BASE = "http://localhost:3000";
  const CHECK_URL = `${API_BASE}/api/check-nc`;

  // ⚠️ Si tu registro aún es PHP, déjalo así (como lo tienes)
  // Si luego lo pasas a Node, solo cambia esta URL a tu endpoint de Node.
  const REGISTER_URL = "http://localhost:8000/backend/registro.php";

  // Campos que se bloquean si NC inválido o repetido
  const fields = [
    "nombre",
    "apellidoPaterno",
    "apellidoMaterno",
    "carrera",
    "clave",
    "confirmarClave",
  ]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const isEight = (v) => /^\d{8}$/.test(v);

  function setHint(msg, type = "") {
    if (!ncHelp) return;
    ncHelp.textContent = msg || "";
    ncHelp.classList.remove("ok", "err");
    if (type) ncHelp.classList.add(type);
  }

  function lock(lockIt) {
    fields.forEach((el) => (el.disabled = !!lockIt));
    if (btnRegistro) btnRegistro.disabled = !!lockIt;
  }

  function onlyLettersSpaces(v) {
    // letras (incluye acentos/ñ) + espacios
    return (v || "")
      .replace(/[^\p{L}\s]/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // ======== Estado ========
  let exists = false;
  let checking = false;
  let debounce = null;
  let lastChecked = "";
  const DEBOUNCE_MS = 350;

  // ======== Restricciones ========
  // Número de control: SOLO dígitos (sin puntos, comas, espacios)
  ncInput?.addEventListener("input", () => {
    ncInput.value = (ncInput.value || "").replace(/\D/g, "").slice(0, 8);
  });

  // Nombre/apellidos: sin signos raros
  ["nombre", "apellidoPaterno", "apellidoMaterno"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      el.value = onlyLettersSpaces(el.value);
    });
  });

  // ======== Verificación en vivo ========
  ncInput?.addEventListener("input", () => {
    const v = (ncInput.value || "").trim();
    clearTimeout(debounce);

    exists = false;

    if (!v) {
      lock(true);
      setHint("Ingresa tu número de control (8 dígitos).", "err");
      window.burritoSay?.("Escribe tu número de control (8 dígitos) 🫏");
      return;
    }

    if (!isEight(v)) {
      lock(true);
      setHint("Debe tener exactamente 8 dígitos.", "err");
      return;
    }

    // con 8 dígitos: verificamos
    lock(true);
    setHint("Verificando número de control…", "");
    debounce = setTimeout(() => verifyNC(v), DEBOUNCE_MS);
  });

  async function verifyNC(nc) {
    if (checking && lastChecked === nc) return;
    lastChecked = nc;
    checking = true;

    try {
      const url = `${CHECK_URL}?numeroControl=${encodeURIComponent(nc)}&t=${Date.now()}`;

      const resp = await fetch(url, { method: "GET", cache: "no-store" });
      const raw = await resp.text();

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        setHint("No se pudo verificar (respuesta no es JSON).", "err");
        lock(true);
        window.burritoSay?.("El backend no devolvió JSON válido 😵");
        console.warn("CHECK NOT JSON RAW:", raw);
        return;
      }

      if (!resp.ok) {
        // Node puede devolver 400/500
        const msg = data?.message || `No se pudo verificar (HTTP ${resp.status}).`;
        setHint(msg, "err");
        lock(true);
        window.burritoSay?.("No pude verificar ahora 😵 Revisa el backend.");
        console.warn("CHECK HTTP ERROR:", resp.status, data);
        return;
      }

      // Esperado: { success:true, exists:true/false }
      if (data.exists === true) {
        exists = true;
        setHint("❌ Este número de control ya está registrado.", "err");
        lock(true);

        // Mensaje fuerte (modal) + bubble
        window.burritoSay?.("Ese número ya existe ❌ Usa otro.");
        window.LE_announce?.({
          type: "AVISO",
          heading: "Número de control repetido",
          message: "Este número de control ya está registrado. Cambia el número para continuar.",
          key: "nc_repeat",
          cooldownMs: 2000,
        });
        return;
      }

      if (data.exists === false) {
        exists = false;
        setHint("✅ Número de control disponible.", "ok");
        lock(false);
        window.burritoSay?.("¡Listo! Número disponible ✅");
        return;
      }

      // Si viene raro
      exists = false;
      setHint("No se pudo verificar ahora. Intenta de nuevo.", "err");
      lock(true);
      window.burritoSay?.("No pude entender la respuesta del backend 😵");
      console.warn("CHECK UNKNOWN JSON:", data);
    } catch (err) {
      console.error("verifyNC error:", err);
      exists = false;
      setHint("No se pudo verificar ahora. Intenta de nuevo.", "err");
      lock(true);
      window.burritoSay?.("No pude verificar 😵 ¿backend arriba?");
    } finally {
      checking = false;
    }
  }

  // Estado inicial: bloquear todo hasta verificar NC
  lock(true);
  setHint("Ingresa tu número de control (8 dígitos).", "err");

  // ======== Submit (registro) ========
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const numeroControl = (ncInput?.value || "").trim();
    const nombre = (document.getElementById("nombre")?.value || "").trim();
    const apellidoPaterno = (document.getElementById("apellidoPaterno")?.value || "").trim();
    const apellidoMaterno = (document.getElementById("apellidoMaterno")?.value || "").trim();
    const carrera = (document.getElementById("carrera")?.value || "").trim();
    const clave = (document.getElementById("clave")?.value || "").trim();
    const confirmarClave = (document.getElementById("confirmarClave")?.value || "").trim();

    if (!isEight(numeroControl)) {
      setHint("Debe tener exactamente 8 dígitos.", "err");
      window.burritoSay?.("Primero completa los 8 dígitos 🫏");
      return;
    }

    // Re-verifica rápido por seguridad antes de registrar
    await verifyNC(numeroControl);
    if (exists) return;

    if (!nombre || !apellidoPaterno || !apellidoMaterno || !carrera || !clave || !confirmarClave) {
      window.burritoSay?.("Faltan campos por llenar 😅");
      return;
    }

    if (clave.length > 10 || confirmarClave.length > 10) {
      window.burritoSay?.("La contraseña es máximo 10 caracteres 🔒");
      return;
    }

    if (clave !== confirmarClave) {
      window.burritoSay?.("Las contraseñas no coinciden ❌");
      return;
    }

    try {
      if (btnRegistro) btnRegistro.disabled = true;

      const resp = await fetch(REGISTER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numeroControl,
          nombre,
          apellidoPaterno,
          apellidoMaterno,
          carrera,
          clave,
        }),
      });

      const raw = await resp.text();
      let data = null;
      try {
        data = JSON.parse(raw);
      } catch {}

      if (!resp.ok) {
        window.burritoSay?.(`Error del servidor (${resp.status}).`);
        console.warn("REGISTER HTTP ERROR:", resp.status, raw);
        return;
      }

      if (data && data.success) {
        window.burritoSay?.("¡Registro exitoso! ✅");
        setTimeout(() => {
          window.location.href = "../Login/index.html";
        }, 1200);
      } else {
        const msg = data?.message || "No se pudo registrar.";
        window.burritoSay?.(msg);
      }
    } catch (err) {
      console.error(err);
      window.burritoSay?.("No pude conectar con el backend 😵");
    } finally {
      if (btnRegistro) btnRegistro.disabled = false;
    }
  });
});
