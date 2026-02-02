/* =====================================
   Reporte de Asesorías (backend)
   - Lee /backend/asesorias.php
   - Lee /backend/personas_api.php?action=list
   - Reconstruye nombre completo del docente
   - Rellena filtros (Docente/Título/Fechas)
   - Render tabla con filtros
   - Exporta CSV (Excel) y PDF (print)
===================================== */

;(() => {
  const $ = (s) => document.querySelector(s)

  const API_ASESORIAS = "/backend/asesorias.php"
  const API_PERSONAS  = "/backend/personas_api.php?action=list"

  let ASESORIAS = []       // lista normalizada
  let DOCENTES  = []       // {id, nombreCompleto}
  let DATA_MOSTRADA = []   // lo que está actualmente en tabla

  // notify de tu proyecto (si no existe, no revienta)
  const notify = window.notify || {}
  const hasNotify = typeof notify?.show === "function"
  const safeOk   = (m) =>
    hasNotify ? notify.show(m, "success", { title: "¡Listo!" }) : console.log(m)
  const safeInfo = (m) =>
    hasNotify ? notify.show(m, "info") : console.log(m)

  /* ---------- Helpers generales ---------- */

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c]),
    )
  }

  function firstStr(...vals) {
    for (const v of vals) {
      if (v == null) continue
      const s = String(v).trim()
      if (s) return s
    }
    return ""
  }

  async function fetchJson(url) {
    const resp = await fetch(url, { headers: { Accept: "application/json" } })
    if (!resp.ok) throw new Error(`HTTP ${resp.status} en ${url}`)
    return resp.json()
  }

  /* ---------- PERSONAS (docentes) ---------- */

  function normalizarPersona(p) {
    const id =
      firstStr(
        p.id_persona,
        p.idPersona,
        p.id,
        p.persona_id,
        p.personaId,
      ) || ""

    const nombre    = firstStr(p.nombre, p.nombres, p.Nombre)
    const apPaterno = firstStr(p.apellido_paterno, p.apellidoPaterno, p.apellido1)
    const apMaterno = firstStr(p.apellido_materno, p.apellidoMaterno, p.apellido2)
    const nombreCompleto =
      firstStr(p.nombreCompleto, p.nombre_completo) ||
      [nombre, apPaterno, apMaterno].filter(Boolean).join(" ")

    return {
      id: id || "",
      nombreCompleto: nombreCompleto || nombre || "",
      rol: firstStr(p.rol, p.tipo, p.perfil),
    }
  }

  async function cargarDocentes() {
    try {
      const data = await fetchJson(API_PERSONAS)
      const arr = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : []
      const personas = arr.map(normalizarPersona)

      // No filtramos por rol para no perder a nadie
      DOCENTES = personas.filter((p) => p.id && p.nombreCompleto)

      return DOCENTES
    } catch (e) {
      console.warn("No se pudieron cargar personas_api.php:", e)
      DOCENTES = []
      return DOCENTES
    }
  }

  function buscarDocentePorId(id) {
    if (!id) return ""
    const idStr = String(id).trim()
    const found = DOCENTES.find((d) => String(d.id).trim() === idStr)
    return found ? found.nombreCompleto : ""
  }

  /* ---------- ASESORÍAS ---------- */

  function construirHora(a) {
    const hI = firstStr(a.horaInicio, a.hora_inicio, a.horaInicioStr, a.hora)
    const hF = firstStr(a.horaFin, a.hora_fin, a.horaFinStr, a.hora_fin)
    if (hI && hF) return `${hI} - ${hF}`
    return hI || hF || ""
  }

  function construirCupo(a) {
    // Intentar todos los nombres posibles
    const cupoTotal =
      Number(
        firstStr(
          a.cupoTotal,
          a.cupo_total,
          a.cupoMax,
          a.cupo_maximo,
          a.capacidad,
          a.capacidadMax,
          a.cupo, // en muchos casos este es el total
        ),
      ) || 0

    const cupoActual =
      Number(
        firstStr(
          a.cupoActual,
          a.cupo_actual,
          a.inscritos,
          a.inscritosCount,
          a.ocupados,
        ),
      ) || 0

    return `${cupoActual}/${cupoTotal}`
  }

  function normalizarAsesoria(raw) {
    const titulo = firstStr(raw.titulo, raw.nombre, raw.tituloAsesoria)
    const fecha  = firstStr(raw.fecha, raw.fechaAsesoria)
    const hora   = construirHora(raw)
    const desc   = firstStr(raw.descripcion, raw.descripcionAsesoria, raw.detalle)

    // -------- DOCENTE --------
    function maybeNombre(v) {
      const s = firstStr(v)
      if (!s) return ""
      // si es sólo números (id), lo ignoramos
      if (/^\d+$/.test(s)) return ""
      return s
    }

    let docente = maybeNombre(
      firstStr(
        raw.docenteNombre,
        raw.nombre_docente,
        raw.docente_nombre,
        raw.nombreDocente,
        raw.nombreAuxiliar,
        raw.auxiliar,
        raw.docente, // sólo se usará si no es puro número
      ),
    )

    // Id del docente (aquí sí tomamos numérico)
    let docenteId = firstStr(
      raw.docenteId,
      raw.id_docente,
      raw.docente_id,
      raw.idPersonaDocente,
      raw.id_persona_docente,
      raw.id_auxiliar,
      raw.auxiliar_id,
      raw.docente, // muchos backends usan "docente" como id
    )

    // Si viene un objeto anidado tipo raw.docente = { ... }
    if (!docente && raw.docente && typeof raw.docente === "object") {
      const dObj = raw.docente
      docente = maybeNombre(
        firstStr(
          dObj.nombreCompleto,
          dObj.nombre_completo,
          [dObj.nombre, dObj.apellido_paterno, dObj.apellido_materno]
            .filter(Boolean)
            .join(" "),
        ),
      )
      if (!docenteId) {
        docenteId = firstStr(dObj.id_persona, dObj.id, dObj.persona_id)
      }
    }

    // Si aún no hay nombre pero sí ID, lo buscamos en DOCENTES
    if (!docente && docenteId) {
      docente = buscarDocentePorId(docenteId)
    }

    // Parche a fuerza para materias específicas
    if (!docente && titulo && titulo.trim() === "Principios Eléctricos y Aplicaciones Digitales.") {
      docente = "Octavio Hernandez Mendez"
    }

    if (!docente && titulo && titulo.trim() === "Electrónica Analógica") {
      docente = "Octavio Hernandez Mendez"
    }

    if (!docente) docente = "Sin docente"

    return {
      id: firstStr(raw.id, raw.idAsesoria),
      titulo,
      docente,
      fecha,
      hora,
      descripcion: desc,
      cupo: construirCupo(raw),
    }
  }

  async function cargarAsesorias() {
    const data = await fetchJson(API_ASESORIAS)
    const arr = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
      ? data.data
      : []
    ASESORIAS = arr.map(normalizarAsesoria)
    DATA_MOSTRADA = [...ASESORIAS]
  }

  /* ---------- Filtros ---------- */

  function llenarFiltros() {
    const selDoc         = $("#filtroDocente")
    const selTit         = $("#filtroTitulo")
    const selFechaInicio = $("#filtroFechaInicio")
    const selFechaFin    = $("#filtroFechaFin")

    if (!selDoc || !selTit || !selFechaInicio || !selFechaFin) return

    const docentesUnicos = [
      ...new Set(
        ASESORIAS.map((a) => a.docente).filter((d) => d && d !== "Sin docente"),
      ),
    ].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))

    const titulosUnicos = [
      ...new Set(ASESORIAS.map((a) => a.titulo).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }))

    selDoc.innerHTML =
      `<option value="">Todos los docentes</option>` +
      docentesUnicos
        .map(
          (d) =>
            `<option value="${escapeHTML(d)}">${escapeHTML(d)}</option>`,
        )
        .join("")

    selTit.innerHTML =
      `<option value="">Todos los títulos</option>` +
      titulosUnicos
        .map(
          (t) =>
            `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`,
        )
        .join("")

    // Fechas se quedan vacías por defecto (usuario las pone)
    selFechaInicio.value = ""
    selFechaFin.value = ""
  }

  /* ---------- Tabla ---------- */

  function renderTabla(lista) {
    const tbody = $("#tablaAsesorias")
    if (!tbody) return

    if (!lista.length) {
      tbody.innerHTML =
        `<tr><td colspan="6" style="padding:14px;text-align:center;opacity:.7;">Sin registros</td></tr>`
      DATA_MOSTRADA = []
      return
    }

    tbody.innerHTML = lista
      .map(
        (a) => `
      <tr>
        <td>${escapeHTML(a.titulo || "")}</td>
        <td>${escapeHTML(a.docente || "")}</td>
        <td>${escapeHTML(a.fecha || "")}</td>
        <td>${escapeHTML(a.hora || "")}</td>
        <td style="text-align:left">${escapeHTML(a.descripcion || "")}</td>
        <td>${escapeHTML(a.cupo || "")}</td>
      </tr>
    `,
      )
      .join("")

    DATA_MOSTRADA = [...lista]
  }

  /* ---------- Acciones filtros ---------- */

  function aplicarFiltros() {
    const docenteSel   = $("#filtroDocente")?.value || ""
    const tituloSel    = $("#filtroTitulo")?.value || ""
    const fechaInicio  = $("#filtroFechaInicio")?.value || ""
    const fechaFin     = $("#filtroFechaFin")?.value || ""

    const lista = ASESORIAS.filter((a) => {
      const byDoc = !docenteSel || a.docente === docenteSel
      const byTit = !tituloSel || a.titulo === tituloSel

      let byFecha = true
      if (fechaInicio || fechaFin) {
        const fechaAsesoria = a.fecha || ""

        if (fechaInicio && fechaAsesoria < fechaInicio) {
          byFecha = false
        }
        if (fechaFin && fechaAsesoria > fechaFin) {
          byFecha = false
        }
      }

      return byDoc && byTit && byFecha
    })

    renderTabla(lista)
    safeInfo("Filtros aplicados.")
  }

  function limpiarFiltros() {
    if ($("#filtroDocente")) $("#filtroDocente").value = ""
    if ($("#filtroTitulo")) $("#filtroTitulo").value = ""
    if ($("#filtroFechaInicio")) $("#filtroFechaInicio").value = ""
    if ($("#filtroFechaFin")) $("#filtroFechaFin").value = ""
    renderTabla(ASESORIAS)
    safeInfo("Filtros limpiados.")
  }

  /* ---------- Exportar ---------- */

  function descargarExcel() {
    const rows = [["Título", "Docente", "Fecha", "Hora", "Descripción", "Cupo"]]

    ;(DATA_MOSTRADA.length ? DATA_MOSTRADA : ASESORIAS).forEach((a) => {
      rows.push([
        a.titulo || "",
        a.docente || "",
        a.fecha || "",
        a.hora || "",
        (a.descripcion || "").replace(/\s+/g, " ").trim(),
        a.cupo || "",
      ])
    })

    const csv = rows
      .map((r) =>
        r
          .map((v) => {
            const s = String(v ?? "")
            return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
          })
          .join(","),
      )
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "reporte-asesorias.csv"
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)

    safeOk("Descargando asesorías (CSV).")
  }

  function descargarPDF() {
    const lista = DATA_MOSTRADA.length ? DATA_MOSTRADA : ASESORIAS

    const rows = lista
      .map(
        (a) => `
      <tr>
        <td style="border:1px solid #000;padding:8px;">${escapeHTML(
          a.titulo || "",
        )}</td>
        <td style="border:1px solid #000;padding:8px;">${escapeHTML(
          a.docente || "",
        )}</td>
        <td style="border:1px solid #000;padding:8px;text-align:center;">${escapeHTML(
          a.fecha || "",
        )}</td>
        <td style="border:1px solid #000;padding:8px;text-align:center;">${escapeHTML(
          a.hora || "",
        )}</td>
        <td style="border:1px solid #000;padding:8px;text-align:left;">${escapeHTML(
          a.descripcion || "",
        )}</td>
        <td style="border:1px solid #000;padding:8px;text-align:center;">${escapeHTML(
          a.cupo || "",
        )}</td>
      </tr>
    `,
      )
      .join("")

    const win = window.open("", "_blank")
    win.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Reporte de Asesorías</title>
      <style>
        body{ font-family:Segoe UI,Arial; padding:20px; }
        h1{ text-align:center; margin:0 0 14px; }
        .line{ height:3px; background:#000; margin-bottom:12px; }
        table{ width:100%; border-collapse:collapse; }
        th{ background:#000; color:#fff; padding:10px; border:1px solid #000; }
        td{ border:1px solid #000; padding:8px; }
      </style>
      </head><body>
        <h1>Reporte de Asesorías</h1>
        <div class="line"></div>
        <table>
          <thead>
            <tr>
              <th>Título</th><th>Docente</th><th>Fecha</th><th>Hora</th><th>Descripción</th><th>Cupo</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="6" style="text-align:center">Sin registros</td></tr>`}</tbody>
        </table>
        <script>window.addEventListener('load', ()=> setTimeout(()=>window.print(), 150));<\/script>
      </body></html>
    `)
    win.document.close()

    safeOk("Abriendo vista de impresión (guárdalo como PDF).")
  }

  /* ---------- Nav ---------- */

  function initNav() {
    const btn = $("#btnBack")
    if (!btn) return

    btn.addEventListener("click", (e) => {
      e.preventDefault()
      if (history.length > 1) {
        history.back()
      } else {
        // Fallback a la página que tú usabas
        location.href = "Reporte-especialidad.html"
      }
    })
  }

  /* ---------- Boot ---------- */

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      await cargarDocentes()   // 1) personas_api
      await cargarAsesorias()  // 2) asesorias.php

      llenarFiltros()
      renderTabla(ASESORIAS)

      $("#btnAplicar")?.addEventListener("click", aplicarFiltros)
      $("#btnLimpiar")?.addEventListener("click", limpiarFiltros)
      $("#btnExcel")?.addEventListener("click", descargarExcel)
      $("#btnPDF")?.addEventListener("click", descargarPDF)

      initNav()
    } catch (e) {
      console.error(e)
      safeInfo("No se pudieron cargar las asesorías.")
    }
  })
})()
