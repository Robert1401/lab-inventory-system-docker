document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#loginForm");
  if (!form) return;

  const inputNC = document.getElementById("nc");
  const inputPW = document.getElementById("pwd");
  const btnLogin = document.getElementById("btnLogin");
  const togglePwd = document.getElementById("togglePwd");
  const forgotLink = document.getElementById("forgotLink");

  function say(msg){ window.burritoSay?.(msg); }

  // ✅ Endpoint (deja el tuyo real)
  const API_URL = "http://localhost:3000/api/login";

  // NC solo dígitos y max 8
  if (inputNC) {
    inputNC.setAttribute("maxlength", "8");
    inputNC.addEventListener("input", () => {
      inputNC.value = inputNC.value.replace(/[^\d]/g, "");
    });
  }

  // PW max 10
  if (inputPW) inputPW.setAttribute("maxlength", "10");

  // Toggle password
  togglePwd?.addEventListener("click", () => {
    if (!inputPW) return;
    const isPass = inputPW.type === "password";
    inputPW.type = isPass ? "text" : "password";
    const icon = togglePwd.querySelector("i");
    if (icon) icon.className = isPass ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
  });

  forgotLink?.addEventListener("click", (e) => {
    e.preventDefault();
    say("Si olvidaste tu contraseña, solicita recuperación al encargado del laboratorio 🫏");

    window.LE_announce?.({
      type: "SOPORTE",
      heading: "Recuperación de contraseña",
      message: "Solicita recuperación al encargado del laboratorio. Si tienes problemas para entrar, verifica tus datos y vuelve a intentar.",
      key: "forgot_password",
      cooldownMs: 30000
    });
  });

  function validateNC(nc) {
    if (!/^\d+$/.test(nc)) return "El número de control debe ser numérico.";
    if (!(nc.length === 4 || nc.length === 8)) return "Usa 4 (auxiliar) u 8 (alumno) dígitos.";
    return "";
  }

  async function login(numeroControl, password) {
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numeroControl, password }),
    });

    const raw = await resp.text();
    let data = null;
    try { data = JSON.parse(raw); } catch {}
    return { ok: resp.ok, status: resp.status, raw, data };
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const numeroControl = (inputNC?.value || "").trim();
    const password = (inputPW?.value || "").trim();

    if (!numeroControl || !password) {
      say("Completa número de control y contraseña 🫏");
      window.LE_announce?.({
        type: "AVISO",
        heading: "Faltan datos",
        message: "Por favor, completa número de control y contraseña.",
        key: "missing_fields",
        cooldownMs: 15000
      });
      return;
    }

    const ncErr = validateNC(numeroControl);
    if (ncErr) {
      say("Revisa tu número de control 🫏");
      window.LE_announce?.({
        type: "AVISO",
        heading: "Número de control",
        message: ncErr,
        key: "bad_nc",
        cooldownMs: 12000
      });
      return;
    }

    if (password.length > 10) {
      say("Tu contraseña es muy larga 🫏");
      window.LE_announce?.({
        type: "AVISO",
        heading: "Contraseña",
        message: "La contraseña no puede superar los 10 caracteres.",
        key: "pwd_long",
        cooldownMs: 12000
      });
      return;
    }

    if (btnLogin) {
      btnLogin.disabled = true;
      btnLogin.dataset.originalText = btnLogin.textContent;
      btnLogin.textContent = "Cargando...";
    }

    say("Validando acceso… 🔒");

    try {
      const r = await login(numeroControl, password);

      if (!r.ok) {
        const backendMsg = r.data?.message || r.data?.error || `Error del servidor (${r.status}).`;
        say("Hubo un error del servidor 🫏");
        window.LE_announce?.({
          type: "ERROR",
          heading: "Error del servidor",
          message: backendMsg,
          key: "server_error",
          cooldownMs: 8000
        });
        return;
      }

      const data = r.data;

      if (data?.success) {
        const nombre = data.nombre || "";
        const rol = (data.rol || "").toLowerCase();

        say(`¡Acceso correcto! 🫏 ${nombre ? "Bienvenido " + nombre : ""}`);

        // ✅✅✅ GUARDA SESIÓN CORRECTO (NOMBRE COMPLETO + KEY CORRECTA)
        try {
          localStorage.setItem("LE_USER", JSON.stringify({
            numeroControl: data.numeroControl || numeroControl,
            nombre: nombre,         // ✅ nombre completo
            rol: rol || "auxiliar"
          }));
        } catch {}

        window.LE_announce?.({
          type: "BIENVENIDA",
          heading: "Acceso correcto",
          message: nombre ? `Bienvenido ${nombre}.` : "Bienvenido al sistema.",
          key: "login_ok",
          cooldownMs: 8000
        });

        setTimeout(() => {
          // ✅ usa rutas RELATIVAS para que no se rompa en docker/nginx
          if (rol === "auxiliar") {
            window.location.href = "../Auxiliar/auxiliar.html";
          } else {
            window.location.href = "../Alumnos/alumnos-inicial.html";
          }
        }, 450);

      } else {
        const msg = data?.message || "Credenciales incorrectas.";
        say("Datos incorrectos ❌");
        window.LE_announce?.({
          type: "AVISO",
          heading: "No se pudo iniciar sesión",
          message: msg,
          key: "login_fail",
          cooldownMs: 8000
        });
      }
    } catch (err) {
      console.error(err);
      say("No pude conectar con el servidor 🫏");
      window.LE_announce?.({
        type: "ERROR",
        heading: "Sin conexión",
        message: "No se pudo conectar con el servidor. Verifica que esté activo.",
        key: "net_error",
        cooldownMs: 8000
      });
    } finally {
      if (btnLogin) {
        btnLogin.disabled = false;
        btnLogin.textContent = btnLogin.dataset.originalText || "Iniciar sesión";
      }
    }
  });
});
