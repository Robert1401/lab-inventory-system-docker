require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const pool = require("./db");

const app = express();

console.log("SERVER FILE:", __filename);
console.log("NODE ENV:", process.env.NODE_ENV);

/* =======================
   CORS (IMPORTANTE)
======================= */
const allowedOrigins = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:4200",
  "http://127.0.0.1:4200",
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS bloqueado para: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: false,
}));

// ✅ Responder preflight SIEMPRE (evita 405 por OPTIONS en PUT/DELETE)
app.options("*", cors());

app.use(express.json());

// Log de requests
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

/* =======================
   HEALTH / DEBUG
======================= */
app.get("/api/whoami", (req, res) => res.json({ ok: true, file: __filename }));
app.get("/health", (req, res) => res.json({ ok: true }));

/* =======================
   CARRERAS CRUD
======================= */

// GET /api/carreras -> lista
app.get("/api/carreras", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id_Carrera, nombre FROM carreras ORDER BY nombre ASC"
    );
    return res.json(rows);
  } catch (err) {
    console.error("GET /api/carreras:", err);
    return res.status(500).json({ error: "Error al cargar carreras" });
  }
});

// POST /api/carreras -> crear
app.post("/api/carreras", async (req, res) => {
  try {
    const nombre = (req.body.nombre ?? "").toString().trim();
    if (!nombre) return res.status(400).json({ error: "Nombre requerido" });

    const [exists] = await pool.query(
      "SELECT 1 FROM carreras WHERE nombre = ? LIMIT 1",
      [nombre]
    );
    if (exists.length) return res.status(409).json({ error: "Esa carrera ya existe" });

    const [r] = await pool.query(
      "INSERT INTO carreras (nombre) VALUES (?)",
      [nombre]
    );

    return res.status(201).json({ id_Carrera: r.insertId, nombre });
  } catch (err) {
    console.error("POST /api/carreras:", err);
    return res.status(500).json({ error: "Error al guardar carrera" });
  }
});

// PUT /api/carreras -> actualizar
app.put("/api/carreras", async (req, res) => {
  try {
    const id = Number(req.body.id_Carrera);
    const nombre = (req.body.nombre ?? "").toString().trim();

    if (!id || id <= 0) return res.status(400).json({ error: "id_Carrera inválido" });
    if (!nombre) return res.status(400).json({ error: "Nombre requerido" });

    const [r] = await pool.query(
      "UPDATE carreras SET nombre = ? WHERE id_Carrera = ?",
      [nombre, id]
    );

    if (r.affectedRows === 0) {
      return res.status(404).json({ error: "Carrera no encontrada" });
    }

    return res.json({ success: true, id_Carrera: id, nombre });
  } catch (err) {
    console.error("PUT /api/carreras:", err);
    return res.status(500).json({ error: "Error al actualizar carrera" });
  }
});

// DELETE /api/carreras?id=123 -> eliminar
app.delete("/api/carreras", async (req, res) => {
  try {
    const id = Number(req.query.id);
    if (!id || id <= 0) return res.status(400).json({ error: "id inválido" });

    const [r] = await pool.query(
      "DELETE FROM carreras WHERE id_Carrera = ?",
      [id]
    );

    if (r.affectedRows === 0) {
      return res.status(404).json({ error: "Carrera no encontrada" });
    }

    return res.json({ success: true, message: "Carrera eliminada" });
  } catch (err) {
    console.error("DELETE /api/carreras:", err);
    return res.status(500).json({ error: "Error al eliminar carrera" });
  }
});

/* =======================
   CHECK NC
======================= */
app.get("/api/check-nc", async (req, res) => {
  try {
    const numeroControl = (req.query.numeroControl ?? "").toString().trim();
    if (!/^\d{8}$/.test(numeroControl)) {
      return res.status(400).json({ success: false, exists: null, message: "Número de control inválido" });
    }
    const [rows] = await pool.query("SELECT 1 FROM usuarios WHERE numeroControl = ? LIMIT 1", [Number(numeroControl)]);
    return res.json({ success: true, exists: rows.length > 0 });
  } catch (err) {
    console.error("check-nc:", err);
    return res.status(500).json({ success: false, exists: null, message: "Error interno" });
  }
});

/* =======================
   REGISTER
======================= */
app.post("/api/register", async (req, res) => {
  let txStarted = false;
  try {
    const numeroControl = (req.body.numeroControl ?? "").toString().trim();
    const nombre = (req.body.nombre ?? "").toString().trim();
    const apellidoPaterno = (req.body.apellidoPaterno ?? "").toString().trim();
    const apellidoMaterno = (req.body.apellidoMaterno ?? "").toString().trim();
    const carrera = (req.body.carrera ?? "").toString().trim();
    const clave = (req.body.clave ?? "").toString();

    if (!/^\d{8}$/.test(numeroControl)) return res.status(400).json({ success: false, message: "Número de control inválido" });
    if (!nombre || !apellidoPaterno || !apellidoMaterno || !carrera || !clave) return res.status(400).json({ success: false, message: "Faltan campos" });
    if (clave.length > 10) return res.status(400).json({ success: false, message: "La contraseña es máximo 10 caracteres" });

    const [existsRows] = await pool.query("SELECT 1 FROM usuarios WHERE numeroControl = ? LIMIT 1", [Number(numeroControl)]);
    if (existsRows.length > 0) return res.status(409).json({ success: false, message: "Ese número de control ya está registrado" });

    const hash = await bcrypt.hash(clave, 10);

    await pool.query("START TRANSACTION");
    txStarted = true;

    await pool.query("INSERT INTO usuarios (numeroControl, Clave, id_Estado) VALUES (?, ?, 1)", [Number(numeroControl), hash]);

    const ID_ROL_ALUMNO = 2;
    await pool.query(
      `INSERT INTO personas (numeroControl, nombre, apellidoPaterno, apellidoMaterno, id_Rol, id_Estado)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [Number(numeroControl), nombre, apellidoPaterno, apellidoMaterno, ID_ROL_ALUMNO]
    );

    await pool.query("COMMIT");
    txStarted = false;

    return res.json({ success: true, message: "Registro exitoso" });
  } catch (err) {
    try { if (txStarted) await pool.query("ROLLBACK"); } catch {}
    console.error("register:", err);
    return res.status(500).json({ success: false, message: "Error interno" });
  }
});

/* =======================
   LOGIN
======================= */
app.post("/api/login", async (req, res) => {
  try {
    const numeroControlRaw = (req.body.numeroControl ?? "").toString().trim();
    const passwordInput = (req.body.password ?? "").toString();

    if (!numeroControlRaw || !passwordInput) return res.status(400).json({ success: false, message: "⚠️ Campos vacíos" });
    if (!/^\d+$/.test(numeroControlRaw)) return res.status(400).json({ success: false, message: "🔎 El número de control debe ser numérico." });

    const len = numeroControlRaw.length;
    if (len < 4) return res.status(400).json({ success: false, message: "🔎 Faltan dígitos." });
    if (len >= 5 && len <= 7) return res.status(400).json({ success: false, message: "🔎 Debe tener 4 (auxiliar) o 8 (alumno) dígitos." });
    if (len > 8) return res.status(400).json({ success: false, message: "🔎 Te pasaste de dígitos." });

    const numeroControl = Number(numeroControlRaw);

    const sql = `
      SELECT 
        U.numeroControl,
        U.Clave AS hash,
        U.id_Estado AS estadoUsuario,
        P.nombre AS nombrePersona,
        P.apellidoPaterno,
        P.apellidoMaterno,
        P.id_Estado AS estadoPersona,
        R.nombre AS nombreRol
      FROM usuarios U
      INNER JOIN personas P ON P.numeroControl = U.numeroControl
      INNER JOIN roles R    ON R.id_Rol = P.id_Rol
      WHERE U.numeroControl = ?
      LIMIT 1
    `;

    const [rows] = await pool.query(sql, [numeroControl]);
    if (!rows.length) return res.status(401).json({ success: false, message: "❌ Número de control no encontrado" });

    const row = rows[0];
    const rolBruto = (row.nombreRol ?? "").toString().trim();
    const rol = rolBruto.toLowerCase();

    if (rol === "auxiliar" && len !== 4) return res.status(400).json({ success: false, message: len < 4 ? "🔎 Faltan dígitos." : "🔎 Te pasaste de dígitos." });
    if (rol === "alumno" && len !== 8) return res.status(400).json({ success: false, message: len < 8 ? "🔎 Faltan dígitos." : "🔎 Te pasaste de dígitos." });

    const ok = await bcrypt.compare(passwordInput, String(row.hash ?? ""));
    if (!ok) return res.status(401).json({ success: false, message: "❌ Credenciales incorrectas" });

    if (Number(row.estadoUsuario) !== 1 || Number(row.estadoPersona) !== 1) {
      return res.status(403).json({ success: false, message: "⛔ Usuario inactivo." });
    }

    const nombreCompleto = `${row.nombrePersona} ${row.apellidoPaterno} ${row.apellidoMaterno}`.replace(/\s+/g, " ").trim();

    return res.json({
      success: true,
      message: `✅ Bienvenido ${nombreCompleto}`,
      rol,
      rolNombreFull: rolBruto,
      nombre: nombreCompleto,
      numeroControl: String(row.numeroControl),
    });
  } catch (err) {
    console.error("login:", err);
    return res.status(500).json({ success: false, message: "❌ Error interno del servidor" });
  }
});

/* =======================
   PUERTO
======================= */
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Backend escuchando en puerto ${port}`));
