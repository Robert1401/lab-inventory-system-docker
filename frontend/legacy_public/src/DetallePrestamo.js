"use strict";

const $d = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  const raw = localStorage.getItem("LE_hist_detalle_tmp");
  let p = null;
  try {
    p = raw ? JSON.parse(raw) : null;
  } catch {
    p = null;
  }

  const metaDiv = $d("detalleMeta");
  const tbody   = $d("detalleTbody");

  if (!p) {
    if (metaDiv) metaDiv.innerHTML = "<p>No se encontró información del préstamo seleccionado.</p>";
    if (tbody)   tbody.innerHTML   = `<tr><td colspan="2" class="empty">Sin datos.</td></tr>`;
    return;
  }

  const fecha   = p.fecha   || "— — —";
  const hora    = p.hora    || "";
  const folio   = p.folio   || p.noVale || "—";
  const materia = p.materia || "—";
  const maestro = p.maestro || "—";
  const mesa    = p.mesa    || "—";

  // datos de alumno compatibles con varias formas
  let alumnoNombre = "Alumno";
  let noCtrl = "—";

  if (p.alumno) {
    if (typeof p.alumno === "string") {
      alumnoNombre = p.alumno;
    } else {
      alumnoNombre =
        p.alumno.nombre ||
        p.alumno.nombreCompleto ||
        p.alumnoNombre ||
        "Alumno";
      noCtrl =
        p.alumno.noControl ||
        p.noControl ||
        "—";
    }
  } else {
    alumnoNombre = p.alumnoNombre || "Alumno";
    noCtrl = p.noControl || "—";
  }

  if (metaDiv) {
    metaDiv.innerHTML = `
      <p><b>No. vale:</b> ${folio}</p>
      <p><b>Fecha:</b> ${fecha}${hora ? " &nbsp; " + hora : ""}</p>
      <p><b>Materia:</b> ${materia}</p>
      <p><b>Maestro:</b> ${maestro}</p>
      <p><b>Mesa:</b> ${mesa}</p>
      <p><b>Alumno:</b> ${alumnoNombre}
         &nbsp;&nbsp; <b>No. control:</b> ${noCtrl}</p>
    `;
  }

  const items = Array.isArray(p.items) ? p.items : [];
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="2" class="empty">Sin materiales registrados.</td></tr>`;
  } else {
    tbody.innerHTML = "";
    items.forEach((it) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${it.material || it.descripcion || "—"}</td>
        <td>${it.cantidad ?? "—"}</td>
      `;
      tbody.appendChild(tr);
    });
  }
});
