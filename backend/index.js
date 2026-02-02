// backend/index.js
const express = require('express');
const cors = require('cors');
const db = require('./db');          // Pool MySQL (mysql2/promise)
const bcrypt = require('bcryptjs');  // Para verificar hashes

const app = express();
app.use(cors());
app.use(express.json());

// ==========================
//  GET /api/test
// ==========================
app.get('/api/test', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS result');
    res.json({ ok: true, db: rows[0].result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error en la BD' });
  }
});

// ==========================
//  POST /api/login
// ==========================
app.post('/api/login', async (req, res) => {
  try {
    const numeroControl = (req.body.numeroControl || '').trim();
    const passwordInput = String(req.body.password || '').trim();

    // ===== Validaciones rápidas =====
    if (!numeroControl || !passwordInput) {
      return res.json({ success: false, message: '⚠️ Campos vacíos' });
    }

    if (!/^\d+$/.test(numeroControl)) {
      return res.json({ success: false, message: '🔎 El número de control debe ser numérico.' });
    }

    const len = numeroControl.length;
    if (len < 4) {
      return res.json({ success: false, message: '🔎 Faltan dígitos.' });
    }
    if (len >= 5 && len <= 7) {
      return res.json({
        success: false,
        message: '🔎 Debe tener 4 (auxiliar) o 8 (alumno) dígitos.'
      });
    }
    if (len > 8) {
      return res.json({ success: false, message: '🔎 Te pasaste de dígitos.' });
    }

    // ===== Consulta a la BD =====
    const sql = `
      SELECT 
        U.numeroControl,
        U.Clave       AS hash,
        U.id_Estado   AS estadoUsuario,
        P.nombre      AS nombrePersona,
        P.id_Estado   AS estadoPersona,
        R.nombre      AS nombreRol
      FROM usuarios U
      INNER JOIN personas P ON P.numeroControl = U.numeroControl
      INNER JOIN roles R    ON R.id_Rol       = P.id_Rol
      WHERE U.numeroControl = ?
      LIMIT 1
    `;

    const [rows] = await db.query(sql, [numeroControl]);

    if (rows.length === 0) {
      return res.json({ success: false, message: '❌ Número de control no encontrado' });
    }

    const row = rows[0];
    const rolBruto = (row.nombreRol || '').trim();
    const rolLower = rolBruto.toLowerCase();

    // Validar longitud vs rol
    if (rolLower === 'auxiliar' && len !== 4) {
      return res.json({
        success: false,
        message: len < 4 ? '🔎 Faltan dígitos.' : '🔎 Te pasaste de dígitos.'
      });
    }
    if (rolLower === 'alumno' && len !== 8) {
      return res.json({
        success: false,
        message: len < 8 ? '🔎 Faltan dígitos.' : '🔎 Te pasaste de dígitos.'
      });
    }

    // ===== Verificar contraseña (bcrypt) =====
    const hash = String(row.hash || '');
    const okPassword = hash && await bcrypt.compare(passwordInput, hash);

    if (!okPassword) {
      return res.json({ success: false, message: '❌ Credenciales incorrectas' });
    }

    // Bloqueo por estado (1 = activo)
    if (Number(row.estadoUsuario) !== 1 || Number(row.estadoPersona) !== 1) {
      return res.json({ success: false, message: '⛔ Usuario inactivo.' });
    }

    // ===== Respuesta OK =====
    return res.json({
      success: true,
      message: '✅ Bienvenido ' + row.nombrePersona,
      rol: rolLower,                 // "alumno" | "auxiliar"
      rolNombreFull: rolBruto,
      nombre: row.nombrePersona,
      numeroControl: String(row.numeroControl)
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: '❌ Error interno en el servidor'
    });
  }
});

// ==========================
//  Levantar servidor
// ==========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Backend escuchando en puerto ' + PORT);
});
