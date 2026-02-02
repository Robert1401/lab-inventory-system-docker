"use strict";

function irA(pagina) {
  window.location.href = pagina;
}

function logout() {
  localStorage.removeItem("LE_USER");
  window.location.href = "../Login/index.html";
}

document.addEventListener("DOMContentLoaded", () => {
  const userFirst = document.getElementById("userFirst");

 let u = null;
try { u = JSON.parse(localStorage.getItem("LE_USER") || "null"); } catch {}

if (!u || !u.nombre) {
  window.location.href = "../Login/index.html";
  return;
}
document.getElementById("userFirst").textContent = u.nombre; // nombre completo
  // ✅ NOMBRE COMPLETO
  userFirst.textContent = u.nombre;

  window.burritoSay?.(`Hola ${u.nombre} 🫏 ¿Qué quieres abrir?`);
});
