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
  "http://localhost:5500",
  "http://127.0.0.1:5500",
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

app.options("*", cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

/* =======================
   HEALTH / DEBUG
======================= */
app.get("/api/whoami", (req, res) => {
  res.json({ ok: true, file: __filename });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

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

    if (!nombre) {
      return res.status(400).json({ error: "Nombre requerido" });
    }

    const [exists] = await pool.query(
      "SELECT 1 FROM carreras WHERE nombre = ? LIMIT 1",
      [nombre]
    );

    if (exists.length) {
      return res.status(409).json({ error: "Esa carrera ya existe" });
    }

    const [r] = await pool.query(
      "INSERT INTO carreras (id_Estado, nombre) VALUES (1, ?)",
      [nombre]
    );

    return res.status(201).json({
      id_Carrera: r.insertId,
      nombre
    });
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

    if (!id || id <= 0) {
      return res.status(400).json({ error: "id_Carrera inválido" });
    }

    if (!nombre) {
      return res.status(400).json({ error: "Nombre requerido" });
    }

    const [r] = await pool.query(
      "UPDATE carreras SET nombre = ? WHERE id_Carrera = ?",
      [nombre, id]
    );

    if (r.affectedRows === 0) {
      return res.status(404).json({ error: "Carrera no encontrada" });
    }

    return res.json({
      success: true,
      id_Carrera: id,
      nombre
    });
  } catch (err) {
    console.error("PUT /api/carreras:", err);
    return res.status(500).json({ error: "Error al actualizar carrera" });
  }
});

// DELETE /api/carreras?id=123 -> eliminar
app.delete("/api/carreras", async (req, res) => {
  try {
    const id = Number(req.query.id);

    if (!id || id <= 0) {
      return res.status(400).json({ error: "id inválido" });
    }

    const [r] = await pool.query(
      "DELETE FROM carreras WHERE id_Carrera = ?",
      [id]
    );

    if (r.affectedRows === 0) {
      return res.status(404).json({ error: "Carrera no encontrada" });
    }

    return res.json({
      success: true,
      message: "Carrera eliminada"
    });
  } catch (err) {
    console.error("DELETE /api/carreras:", err);
    return res.status(500).json({ error: "Error al eliminar carrera" });
  }
});

/* =======================
   USUARIOS
   Para solicitud-materiales
======================= */
app.get("/api/usuarios", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        p.numeroControl AS id,
        p.numeroControl,
        p.nombre,
        p.apellidoPaterno AS apP,
        p.apellidoMaterno AS apM,
        r.nombre AS rol
      FROM personas p
      INNER JOIN roles r
        ON r.id_Rol = p.id_Rol
      WHERE p.id_Estado = 1
      ORDER BY p.nombre, p.apellidoPaterno, p.apellidoMaterno
    `);

    return res.json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error("GET /api/usuarios:", err);
    return res.status(500).json({
      success: false,
      error: "Error al cargar usuarios"
    });
  }
});

/* =======================
   MATERIAS CRUD
======================= */

// GET /api/materias -> lista
app.get("/api/materias", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        m.id_Materia,
        m.id_Estado,
        m.id_Carrera,
        m.nombre
      FROM materias m
      ORDER BY m.nombre ASC
    `);

    return res.json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error("GET /api/materias:", err);
    return res.status(500).json({
      success: false,
      error: "Error al cargar materias"
    });
  }
});

// POST /api/materias -> crear
app.post("/api/materias", async (req, res) => {
  try {
    const nombre = (req.body.nombre ?? "").toString().trim();
    const id_Carrera = Number(req.body.id_Carrera);

    if (!nombre) {
      return res.status(400).json({ error: "Nombre requerido" });
    }

    if (!id_Carrera || id_Carrera <= 0) {
      return res.status(400).json({ error: "id_Carrera inválido" });
    }

    const [exists] = await pool.query(
      `SELECT 1
       FROM materias
       WHERE nombre = ? AND id_Carrera = ?
       LIMIT 1`,
      [nombre, id_Carrera]
    );

    if (exists.length) {
      return res.status(409).json({ error: "Esa materia ya existe en la carrera." });
    }

    const [r] = await pool.query(
      `INSERT INTO materias (id_Estado, id_Carrera, nombre)
       VALUES (1, ?, ?)`,
      [id_Carrera, nombre]
    );

    return res.status(201).json({
      success: true,
      mensaje: "Materia guardada",
      id_Materia: r.insertId
    });
  } catch (err) {
    console.error("POST /api/materias:", err);
    return res.status(500).json({ error: "Error al guardar materia" });
  }
});

// PUT /api/materias -> actualizar
app.put("/api/materias", async (req, res) => {
  try {
    const id_Materia = Number(req.body.id_Materia);
    const id_Carrera = Number(req.body.id_Carrera);
    const nombre = (req.body.nombre ?? "").toString().trim();

    if (!id_Materia || id_Materia <= 0) {
      return res.status(400).json({ error: "id_Materia inválido" });
    }

    if (!id_Carrera || id_Carrera <= 0) {
      return res.status(400).json({ error: "id_Carrera inválido" });
    }

    if (!nombre) {
      return res.status(400).json({ error: "Nombre requerido" });
    }

    const [exists] = await pool.query(
      `SELECT 1
       FROM materias
       WHERE nombre = ? AND id_Carrera = ? AND id_Materia <> ?
       LIMIT 1`,
      [nombre, id_Carrera, id_Materia]
    );

    if (exists.length) {
      return res.status(409).json({ error: "Ese nombre ya existe en esa carrera." });
    }

    const [r] = await pool.query(
      `UPDATE materias
       SET nombre = ?, id_Carrera = ?
       WHERE id_Materia = ?`,
      [nombre, id_Carrera, id_Materia]
    );

    if (r.affectedRows === 0) {
      return res.status(404).json({ error: "Materia no encontrada" });
    }

    return res.json({
      success: true,
      mensaje: "Materia actualizada"
    });
  } catch (err) {
    console.error("PUT /api/materias:", err);
    return res.status(500).json({ error: "Error al actualizar materia" });
  }
});

// DELETE /api/materias?id_Materia=123 -> eliminar
app.delete("/api/materias", async (req, res) => {
  try {
    const id_Materia = Number(req.query.id_Materia);

    if (!id_Materia || id_Materia <= 0) {
      return res.status(400).json({ error: "id_Materia inválido" });
    }

    const [r] = await pool.query(
      "DELETE FROM materias WHERE id_Materia = ?",
      [id_Materia]
    );

    if (r.affectedRows === 0) {
      return res.status(404).json({ error: "Materia no encontrada" });
    }

    return res.json({
      success: true,
      mensaje: "Materia eliminada"
    });
  } catch (err) {
    console.error("DELETE /api/materias:", err);
    return res.status(500).json({ error: "Error al eliminar materia" });
  }
});

/* =======================
   MATERIALES CRUD
======================= */

// GET /api/materiales -> lista
app.get("/api/materiales", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        m.id_Material,
        m.id_Estado,
        m.nombre,
        m.cantidad AS disponible,
        m.max_por_alumno,
        mc.clave
      FROM materiales m
      LEFT JOIN materialclaves mc
        ON mc.id_Material = m.id_Material
      ORDER BY m.nombre ASC
    `);

    return res.json({
      ok: true,
      data: rows
    });
  } catch (err) {
    console.error("GET /api/materiales:", err);
    return res.status(500).json({
      ok: false,
      message: "Error al cargar materiales"
    });
  }
});

// POST /api/materiales -> crear
app.post("/api/materiales", async (req, res) => {
  let txStarted = false;

  try {
    const clave = (req.body.clave ?? "").toString().trim();
    const nombre = (req.body.nombre ?? "").toString().trim();
    const maxPorAlumno = Number(req.body.max_por_alumno || 0);

    if (!clave) {
      return res.status(400).json({
        ok: false,
        message: "Clave requerida"
      });
    }

    if (!nombre) {
      return res.status(400).json({
        ok: false,
        message: "Nombre requerido"
      });
    }

    if (!Number.isFinite(maxPorAlumno) || maxPorAlumno < 1) {
      return res.status(400).json({
        ok: false,
        message: "Máx. por alumno inválido"
      });
    }

    const [dupClave] = await pool.query(`
      SELECT 1
      FROM materialclaves
      WHERE clave = ?
      LIMIT 1
    `, [clave]);

    if (dupClave.length) {
      return res.status(409).json({
        ok: false,
        message: "La clave ya existe"
      });
    }

    const [dupNombre] = await pool.query(`
      SELECT 1
      FROM materiales
      WHERE nombre = ?
      LIMIT 1
    `, [nombre]);

    if (dupNombre.length) {
      return res.status(409).json({
        ok: false,
        message: "El nombre ya existe"
      });
    }

    await pool.query("START TRANSACTION");
    txStarted = true;

    const [rMat] = await pool.query(`
      INSERT INTO materiales (id_Estado, nombre, cantidad, max_por_alumno)
      VALUES (1, ?, 0, ?)
    `, [nombre, maxPorAlumno]);

    const idMaterial = rMat.insertId;

    await pool.query(`
      INSERT INTO materialclaves (id_Material, clave)
      VALUES (?, ?)
    `, [idMaterial, clave]);

    await pool.query("COMMIT");
    txStarted = false;

    return res.status(201).json({
      ok: true,
      data: {
        id_Material: idMaterial
      },
      message: "Material guardado correctamente"
    });
  } catch (err) {
    try {
      if (txStarted) await pool.query("ROLLBACK");
    } catch {}

    console.error("POST /api/materiales:", err);
    return res.status(500).json({
      ok: false,
      message: "Error al guardar material"
    });
  }
});

// PUT /api/materiales -> actualizar
app.put("/api/materiales", async (req, res) => {
  let txStarted = false;

  try {
    const idMaterial = Number(req.body.id_Material);
    const clave = (req.body.clave ?? "").toString().trim();
    const nombre = (req.body.nombre ?? "").toString().trim();
    const maxPorAlumno = Number(req.body.max_por_alumno || 0);

    if (!idMaterial || idMaterial <= 0) {
      return res.status(400).json({
        ok: false,
        message: "id_Material inválido"
      });
    }

    if (!clave) {
      return res.status(400).json({
        ok: false,
        message: "Clave requerida"
      });
    }

    if (!nombre) {
      return res.status(400).json({
        ok: false,
        message: "Nombre requerido"
      });
    }

    if (!Number.isFinite(maxPorAlumno) || maxPorAlumno < 1) {
      return res.status(400).json({
        ok: false,
        message: "Máx. por alumno inválido"
      });
    }

    const [existsMat] = await pool.query(`
      SELECT 1
      FROM materiales
      WHERE id_Material = ?
      LIMIT 1
    `, [idMaterial]);

    if (!existsMat.length) {
      return res.status(404).json({
        ok: false,
        message: "Material no encontrado"
      });
    }

    const [dupClave] = await pool.query(`
      SELECT 1
      FROM materialclaves
      WHERE clave = ? AND id_Material <> ?
      LIMIT 1
    `, [clave, idMaterial]);

    if (dupClave.length) {
      return res.status(409).json({
        ok: false,
        message: "La clave ya existe"
      });
    }

    const [dupNombre] = await pool.query(`
      SELECT 1
      FROM materiales
      WHERE nombre = ? AND id_Material <> ?
      LIMIT 1
    `, [nombre, idMaterial]);

    if (dupNombre.length) {
      return res.status(409).json({
        ok: false,
        message: "El nombre ya existe"
      });
    }

    await pool.query("START TRANSACTION");
    txStarted = true;

    await pool.query(`
      UPDATE materiales
      SET nombre = ?, max_por_alumno = ?
      WHERE id_Material = ?
    `, [nombre, maxPorAlumno, idMaterial]);

    const [hasClave] = await pool.query(`
      SELECT 1
      FROM materialclaves
      WHERE id_Material = ?
      LIMIT 1
    `, [idMaterial]);

    if (hasClave.length) {
      await pool.query(`
        UPDATE materialclaves
        SET clave = ?
        WHERE id_Material = ?
      `, [clave, idMaterial]);
    } else {
      await pool.query(`
        INSERT INTO materialclaves (id_Material, clave)
        VALUES (?, ?)
      `, [idMaterial, clave]);
    }

    await pool.query("COMMIT");
    txStarted = false;

    return res.json({
      ok: true,
      message: "Material actualizado correctamente"
    });
  } catch (err) {
    try {
      if (txStarted) await pool.query("ROLLBACK");
    } catch {}

    console.error("PUT /api/materiales:", err);
    return res.status(500).json({
      ok: false,
      message: "Error al actualizar material"
    });
  }
});

// DELETE /api/materiales?id_Material=123 -> eliminar uno
// DELETE /api/materiales?inactive=1 -> eliminar inactivos
app.delete("/api/materiales", async (req, res) => {
  let txStarted = false;

  try {
    const inactive = String(req.query.inactive || "").trim();

    if (inactive === "1") {
      await pool.query("START TRANSACTION");
      txStarted = true;

      const [idsRows] = await pool.query(`
        SELECT id_Material
        FROM materiales
        WHERE id_Estado <> 1
      `);

      const ids = idsRows.map(r => Number(r.id_Material)).filter(Boolean);

      if (ids.length) {
        await pool.query(`
          DELETE FROM materialclaves
          WHERE id_Material IN (${ids.map(() => "?").join(",")})
        `, ids);

        await pool.query(`
          DELETE FROM materiales
          WHERE id_Material IN (${ids.map(() => "?").join(",")})
        `, ids);
      }

      await pool.query("COMMIT");
      txStarted = false;

      return res.json({
        ok: true,
        eliminadas: ids.length,
        message: "Materiales inactivos eliminados"
      });
    }

    const idMaterial = Number(req.query.id_Material);

    if (!idMaterial || idMaterial <= 0) {
      return res.status(400).json({
        ok: false,
        message: "id_Material inválido"
      });
    }

    const [existsMat] = await pool.query(`
      SELECT 1
      FROM materiales
      WHERE id_Material = ?
      LIMIT 1
    `, [idMaterial]);

    if (!existsMat.length) {
      return res.status(404).json({
        ok: false,
        message: "Material no encontrado"
      });
    }

    await pool.query("START TRANSACTION");
    txStarted = true;

    await pool.query(`
      DELETE FROM materialclaves
      WHERE id_Material = ?
    `, [idMaterial]);

    await pool.query(`
      DELETE FROM materiales
      WHERE id_Material = ?
    `, [idMaterial]);

    await pool.query("COMMIT");
    txStarted = false;

    return res.json({
      ok: true,
      message: "Material eliminado correctamente"
    });
  } catch (err) {
    try {
      if (txStarted) await pool.query("ROLLBACK");
    } catch {}

    console.error("DELETE /api/materiales:", err);
    return res.status(500).json({
      ok: false,
      message: "Error al eliminar material"
    });
  }
});

/* =======================
   COMPRAS
======================= */

// GET /api/compras -> lista de compras
app.get("/api/compras", async (req, res) => {
  try {
    const [comprasRows] = await pool.query(`
      SELECT
        c.id_Compra,
        c.fecha,
        c.numeroControl,
        c.auxiliar
      FROM compras c
      ORDER BY c.fecha DESC, c.id_Compra DESC
    `);

    const [detalleRows] = await pool.query(`
      SELECT
        mc.id_Compra,
        mc.id_Material,
        mc.cantidad,
        mc.gastoTotal,
        m.nombre
      FROM materialescomprados mc
      INNER JOIN materiales m
        ON m.id_Material = mc.id_Material
      ORDER BY mc.id_Compra DESC, m.nombre ASC
    `);

    const compras = comprasRows.map(c => ({
      id_Compra: c.id_Compra,
      fecha: c.fecha,
      numeroControl: c.numeroControl,
      auxiliar: c.auxiliar,
      items: detalleRows
        .filter(d => Number(d.id_Compra) === Number(c.id_Compra))
        .map(d => ({
          id_Material: d.id_Material,
          nombre: d.nombre,
          cantidad: d.cantidad,
          gastoTotal: d.gastoTotal
        }))
    }));

    return res.json({
      ok: true,
      compras
    });
  } catch (err) {
    console.error("GET /api/compras:", err);
    return res.status(500).json({
      ok: false,
      message: "Error al cargar compras"
    });
  }
});

// POST /api/compras -> guardar compra
app.post("/api/compras", async (req, res) => {
  let txStarted = false;

  try {
    const fechaISO = (req.body.fechaISO ?? "").toString().trim();
    const numeroControl = Number(req.body.numeroControl || 0);
    const auxiliar = (req.body.auxiliar ?? "").toString().trim();
    const items = Array.isArray(req.body.items) ? req.body.items : [];

    if (!fechaISO) {
      return res.status(400).json({
        ok: false,
        message: "Fecha requerida"
      });
    }

    if (!auxiliar) {
      return res.status(400).json({
        ok: false,
        message: "Auxiliar requerido"
      });
    }

    if (!items.length) {
      return res.status(400).json({
        ok: false,
        message: "La compra no tiene materiales"
      });
    }

    for (const it of items) {
      const idMat = Number(it.id_Material);
      const cantidad = Number(it.cantidad);

      if (!idMat || idMat <= 0) {
        return res.status(400).json({
          ok: false,
          message: "Material inválido en la compra"
        });
      }

      if (!cantidad || cantidad <= 0) {
        return res.status(400).json({
          ok: false,
          message: "Cantidad inválida en la compra"
        });
      }
    }

    await pool.query("START TRANSACTION");
    txStarted = true;

    const fechaDB = `${fechaISO} 00:00:00`;

    const [rCompra] = await pool.query(
      `INSERT INTO compras (fecha, numeroControl, auxiliar)
       VALUES (?, ?, ?)`,
      [fechaDB, numeroControl, auxiliar]
    );

    const idCompra = rCompra.insertId;

    for (const it of items) {
      const idMat = Number(it.id_Material);
      const cantidad = Number(it.cantidad);
      const gastoTotal = Number(it.gastoTotal || 0);

      await pool.query(
        `INSERT INTO materialescomprados (id_Compra, id_Material, cantidad, gastoTotal)
         VALUES (?, ?, ?, ?)`,
        [idCompra, idMat, cantidad, gastoTotal]
      );

      await pool.query(
        `UPDATE materiales
         SET cantidad = COALESCE(cantidad, 0) + ?
         WHERE id_Material = ?`,
        [cantidad, idMat]
      );
    }

    await pool.query("COMMIT");
    txStarted = false;

    return res.status(201).json({
      ok: true,
      message: "Compra guardada correctamente",
      id_Compra: idCompra
    });
  } catch (err) {
    try {
      if (txStarted) await pool.query("ROLLBACK");
    } catch {}

    console.error("POST /api/compras:", err);
    return res.status(500).json({
      ok: false,
      message: "Error al guardar compra"
    });
  }
});

/* =======================
   PERSONAS / USUARIOS CRUD
======================= */

// GET /api/personas -> lista
app.get("/api/personas", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        p.numeroControl,
        p.nombre,
        p.apellidoPaterno,
        p.apellidoMaterno,
        r.nombre AS tipo,
        ca.id_Carrera AS id_carrera
      FROM personas p
      INNER JOIN roles r
        ON r.id_Rol = p.id_Rol
      LEFT JOIN carrerasalumnos ca
        ON ca.numeroControl = p.numeroControl
      WHERE p.id_Estado = 1
      ORDER BY p.numeroControl ASC
    `);

    return res.json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error("GET /api/personas:", err);
    return res.status(500).json({
      success: false,
      message: "Error al cargar personas"
    });
  }
});

// POST /api/personas -> crear
app.post("/api/personas", async (req, res) => {
  let txStarted = false;

  try {
    const tipo = (req.body.tipo ?? "").toString().trim();
    const control = (req.body.control ?? "").toString().trim();
    const nombre = (req.body.nombre ?? "").toString().trim();
    const paterno = (req.body.paterno ?? "").toString().trim();
    const materno = (req.body.materno ?? "").toString().trim();
    const carrera = Number(req.body.carrera || 0);
    const password = (req.body.password ?? "").toString();

    if (!tipo || !control || !nombre || !paterno || !materno) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos obligatorios"
      });
    }

    const digits = tipo === "Alumno" ? 8 : 4;
    if (!new RegExp(`^\\d{${digits}}$`).test(control)) {
      return res.status(400).json({
        success: false,
        message: `El número de control debe tener ${digits} dígitos para ${tipo}`
      });
    }

    if (tipo === "Alumno" && (!carrera || carrera <= 0)) {
      return res.status(400).json({
        success: false,
        message: "El Alumno debe tener carrera"
      });
    }

    if (tipo !== "Docente" && !password) {
      return res.status(400).json({
        success: false,
        message: "La contraseña es obligatoria para Alumno y Auxiliar"
      });
    }

    const [existsPersona] = await pool.query(
      "SELECT 1 FROM personas WHERE numeroControl = ? LIMIT 1",
      [Number(control)]
    );

    if (existsPersona.length) {
      return res.status(409).json({
        success: false,
        message: "Ese número de control ya está registrado"
      });
    }

    const [roleRows] = await pool.query(
      "SELECT id_Rol FROM roles WHERE nombre = ? LIMIT 1",
      [tipo]
    );

    if (!roleRows.length) {
      return res.status(400).json({
        success: false,
        message: "Tipo de registro inválido"
      });
    }

    const idRol = Number(roleRows[0].id_Rol);

    await pool.query("START TRANSACTION");
    txStarted = true;

    await pool.query(
      `INSERT INTO personas
       (numeroControl, id_Rol, id_Estado, nombre, apellidoPaterno, apellidoMaterno)
       VALUES (?, ?, 1, ?, ?, ?)`,
      [Number(control), idRol, nombre, paterno, materno]
    );

    if (tipo === "Alumno") {
      await pool.query(
        `INSERT INTO carrerasalumnos (numeroControl, id_Carrera)
         VALUES (?, ?)`,
        [Number(control), carrera]
      );
    }

    if (tipo !== "Docente") {
      const hash = await bcrypt.hash(password, 10);

      await pool.query(
        `INSERT INTO usuarios (id_Estado, numeroControl, Clave)
         VALUES (1, ?, ?)`,
        [Number(control), hash]
      );
    }

    await pool.query("COMMIT");
    txStarted = false;

    return res.status(201).json({
      success: true,
      message: "Registro guardado correctamente"
    });
  } catch (err) {
    try {
      if (txStarted) await pool.query("ROLLBACK");
    } catch {}

    console.error("POST /api/personas:", err);
    return res.status(500).json({
      success: false,
      message: "Error al guardar persona"
    });
  }
});

// PUT /api/personas -> actualizar
app.put("/api/personas", async (req, res) => {
  let txStarted = false;

  try {
    const tipo = (req.body.tipo ?? "").toString().trim();
    const control = (req.body.control ?? "").toString().trim();
    const nombre = (req.body.nombre ?? "").toString().trim();
    const paterno = (req.body.paterno ?? "").toString().trim();
    const materno = (req.body.materno ?? "").toString().trim();
    const carrera = Number(req.body.carrera || 0);
    const password = (req.body.password ?? "").toString();

    if (!tipo || !control || !nombre || !paterno || !materno) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos obligatorios"
      });
    }

    const digits = tipo === "Alumno" ? 8 : 4;
    if (!new RegExp(`^\\d{${digits}}$`).test(control)) {
      return res.status(400).json({
        success: false,
        message: `El número de control debe tener ${digits} dígitos para ${tipo}`
      });
    }

    const [roleRows] = await pool.query(
      "SELECT id_Rol FROM roles WHERE nombre = ? LIMIT 1",
      [tipo]
    );

    if (!roleRows.length) {
      return res.status(400).json({
        success: false,
        message: "Tipo de registro inválido"
      });
    }

    const idRol = Number(roleRows[0].id_Rol);

    const [existsPersona] = await pool.query(
      "SELECT 1 FROM personas WHERE numeroControl = ? LIMIT 1",
      [Number(control)]
    );

    if (!existsPersona.length) {
      return res.status(404).json({
        success: false,
        message: "Registro no encontrado"
      });
    }

    await pool.query("START TRANSACTION");
    txStarted = true;

    await pool.query(
      `UPDATE personas
       SET id_Rol = ?, nombre = ?, apellidoPaterno = ?, apellidoMaterno = ?
       WHERE numeroControl = ?`,
      [idRol, nombre, paterno, materno, Number(control)]
    );

    if (tipo === "Alumno") {
      if (!carrera || carrera <= 0) {
        throw new Error("El Alumno debe tener carrera");
      }

      const [caRows] = await pool.query(
        "SELECT 1 FROM carrerasalumnos WHERE numeroControl = ? LIMIT 1",
        [Number(control)]
      );

      if (caRows.length) {
        await pool.query(
          `UPDATE carrerasalumnos
           SET id_Carrera = ?
           WHERE numeroControl = ?`,
          [carrera, Number(control)]
        );
      } else {
        await pool.query(
          `INSERT INTO carrerasalumnos (numeroControl, id_Carrera)
           VALUES (?, ?)`,
          [Number(control), carrera]
        );
      }
    } else {
      await pool.query(
        "DELETE FROM carrerasalumnos WHERE numeroControl = ?",
        [Number(control)]
      );
    }

    if (tipo === "Docente") {
      await pool.query(
        "DELETE FROM usuarios WHERE numeroControl = ?",
        [Number(control)]
      );
    } else {
      const [userRows] = await pool.query(
        "SELECT 1 FROM usuarios WHERE numeroControl = ? LIMIT 1",
        [Number(control)]
      );

      if (password) {
        const hash = await bcrypt.hash(password, 10);

        if (userRows.length) {
          await pool.query(
            `UPDATE usuarios
             SET Clave = ?, id_Estado = 1
             WHERE numeroControl = ?`,
            [hash, Number(control)]
          );
        } else {
          await pool.query(
            `INSERT INTO usuarios (id_Estado, numeroControl, Clave)
             VALUES (1, ?, ?)`,
            [Number(control), hash]
          );
        }
      }
    }

    await pool.query("COMMIT");
    txStarted = false;

    return res.json({
      success: true,
      message: "Registro actualizado correctamente"
    });
  } catch (err) {
    try {
      if (txStarted) await pool.query("ROLLBACK");
    } catch {}

    console.error("PUT /api/personas:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Error al actualizar persona"
    });
  }
});

// DELETE /api/personas/:control -> eliminar
app.delete("/api/personas/:control", async (req, res) => {
  let txStarted = false;

  try {
    const control = Number(req.params.control);

    if (!control || control <= 0) {
      return res.status(400).json({
        success: false,
        message: "Número de control inválido"
      });
    }

    const [existsPersona] = await pool.query(
      "SELECT 1 FROM personas WHERE numeroControl = ? LIMIT 1",
      [control]
    );

    if (!existsPersona.length) {
      return res.status(404).json({
        success: false,
        message: "Registro no encontrado"
      });
    }

    await pool.query("START TRANSACTION");
    txStarted = true;

    await pool.query("DELETE FROM usuarios WHERE numeroControl = ?", [control]);
    await pool.query("DELETE FROM carrerasalumnos WHERE numeroControl = ?", [control]);
    await pool.query("DELETE FROM personas WHERE numeroControl = ?", [control]);

    await pool.query("COMMIT");
    txStarted = false;

    return res.json({
      success: true,
      message: "Registro eliminado correctamente"
    });
  } catch (err) {
    try {
      if (txStarted) await pool.query("ROLLBACK");
    } catch {}

    console.error("DELETE /api/personas/:control:", err);
    return res.status(500).json({
      success: false,
      message: "Error al eliminar persona"
    });
  }
});

/* =======================
   PRESTAMOS
======================= */

// GET /api/prestamos -> lista de préstamos con detalle
app.get("/api/prestamos", async (req, res) => {
  try {
    const [prestamosRows] = await pool.query(`
      SELECT
        p.id_Prestamo,
        p.numeroControl,
        DATE_FORMAT(p.fecha_Hora_Prestamo, '%Y-%m-%d') AS fecha,
        DATE_FORMAT(p.fecha_Hora_Prestamo, '%H:%i:%s') AS hora,
        DATE_FORMAT(p.fecha_Hora_Devolucion, '%Y-%m-%d %H:%i:%s') AS fecha_Hora_Devolucion,
        p.noVale,
        p.mesa,
        p.estado,
        p.aprobado_en,
        p.rechazado_en,
        p.devuelto_en,
        p.observacion_devolucion,

        pe.nombre AS alumnoNombre,
        pe.apellidoPaterno AS alumnoApellidoPaterno,
        pe.apellidoMaterno AS alumnoApellidoMaterno,

        m.nombre AS materiaNombre,

        pr.nombre AS profesorNombre,
        pr.apellidoPaterno AS profesorApellidoPaterno,
        pr.apellidoMaterno AS profesorApellidoMaterno

      FROM prestamos p
      LEFT JOIN personas pe
        ON pe.numeroControl = p.numeroControl
      LEFT JOIN materias m
        ON m.id_Materia = p.id_Materia
      LEFT JOIN profesores pr
        ON pr.id_Profesor = p.id_Profesor
      ORDER BY p.fecha_Hora_Prestamo DESC, p.id_Prestamo DESC
    `);

    const [detalleRows] = await pool.query(`
      SELECT
        pd.id_det,
        pd.id_prestamo,
        pd.material,
        pd.cantidad,
        pd.ok_cantidad,
        pd.daniado_cantidad,
        pd.condicion
      FROM prestamos_detalle pd
      ORDER BY pd.id_prestamo DESC, pd.id_det ASC
    `);

    const data = prestamosRows.map((p) => ({
      id_Prestamo: p.id_Prestamo,
      numeroControl: String(p.numeroControl),
      fecha: p.fecha || "",
      hora: p.hora || "",
      fecha_Hora_Devolucion: p.fecha_Hora_Devolucion || "",
      noVale: p.noVale || "",
      materia: p.materiaNombre || "",
      maestro: [
        p.profesorNombre,
        p.profesorApellidoPaterno,
        p.profesorApellidoMaterno
      ]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
      mesa: p.mesa ? `M${p.mesa}` : "",
      estado: p.estado,
      aprobado_en: p.aprobado_en || null,
      rechazado_en: p.rechazado_en || null,
      devuelto_en: p.devuelto_en || null,
      observacion_devolucion: p.observacion_devolucion || "",
      alumno: {
        nombre: [
          p.alumnoNombre,
          p.alumnoApellidoPaterno,
          p.alumnoApellidoMaterno
        ]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
        noControl: String(p.numeroControl)
      },
      items: detalleRows
        .filter((d) => Number(d.id_prestamo) === Number(p.id_Prestamo))
        .map((d) => ({
          id_det: d.id_det,
          material: d.material,
          cantidad: Number(d.cantidad || 0),
          ok_cantidad: d.ok_cantidad == null ? null : Number(d.ok_cantidad),
          daniado_cantidad: d.daniado_cantidad == null ? null : Number(d.daniado_cantidad),
          condicion: d.condicion || null
        }))
    }));

    return res.json({
      ok: true,
      data
    });
  } catch (err) {
    console.error("GET /api/prestamos:", err);
    return res.status(500).json({
      ok: false,
      message: "Error al cargar préstamos"
    });
  }
});

// POST /api/prestamos -> guardar nuevo préstamo
app.post("/api/prestamos", async (req, res) => {
  let txStarted = false;

  try {
    console.log("BODY PRESTAMO:", JSON.stringify(req.body, null, 2));

    const numeroControlRaw =
      req.body.numeroControl ??
      req.body.alumno?.noControl ??
      req.body.noControl ??
      "";

    const numeroControl = Number(String(numeroControlRaw).trim() || 0);

    const fecha = String(req.body.fecha || "").trim();
    const hora = String(req.body.hora || "").trim();
    const noVale = String(req.body.noVale || "").trim();
    const mesaRaw = String(req.body.mesa || "").trim();
    const mesa = Number(String(mesaRaw).replace(/\D/g, ""));
    const materia = String(req.body.materia || "").trim();
    const maestro = String(req.body.maestro || "").trim();
    const items = Array.isArray(req.body.items) ? req.body.items : [];

    if (!numeroControl || numeroControl <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Número de control inválido"
      });
    }

    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({
        ok: false,
        message: "Fecha inválida"
      });
    }

    if (!hora || !/^\d{2}:\d{2}(:\d{2})?$/.test(hora)) {
      return res.status(400).json({
        ok: false,
        message: "Hora inválida"
      });
    }

    if (!noVale) {
      return res.status(400).json({
        ok: false,
        message: "Número de vale obligatorio"
      });
    }

    if (!mesa || mesa <= 0) {
      return res.status(400).json({
        ok: false,
        message: "Mesa obligatoria"
      });
    }

    if (!materia) {
      return res.status(400).json({
        ok: false,
        message: "Materia obligatoria"
      });
    }

    if (!maestro) {
      return res.status(400).json({
        ok: false,
        message: "Maestro obligatorio"
      });
    }

    if (!items.length) {
      return res.status(400).json({
        ok: false,
        message: "Debes agregar al menos un material"
      });
    }

    const [alumnoRows] = await pool.query(`
      SELECT 1
      FROM personas
      WHERE numeroControl = ?
      LIMIT 1
    `, [numeroControl]);

    if (!alumnoRows.length) {
      return res.status(404).json({
        ok: false,
        message: "El alumno no existe"
      });
    }

    const [materiaRows] = await pool.query(`
      SELECT id_Materia
      FROM materias
      WHERE nombre = ?
      LIMIT 1
    `, [materia]);

    if (!materiaRows.length) {
      return res.status(404).json({
        ok: false,
        message: "La materia no existe"
      });
    }

    const idMateria = Number(materiaRows[0].id_Materia);

    const maestroNormalizado = maestro.replace(/\s+/g, " ").trim();

    const [profesorRows] = await pool.query(`
      SELECT id_Profesor
      FROM profesores
      WHERE TRIM(CONCAT(nombre, ' ', apellidoPaterno, ' ', apellidoMaterno)) = ?
      LIMIT 1
    `, [maestroNormalizado]);

    if (!profesorRows.length) {
      return res.status(404).json({
        ok: false,
        message: "El docente no está registrado en profesores"
      });
    }

    const idProfesor = Number(profesorRows[0].id_Profesor);

    const fechaHoraPrestamo = `${fecha} ${hora.length === 5 ? `${hora}:00` : hora}`;
    const fechaHoraDevolucionInicial = fechaHoraPrestamo;

    const [valeDuplicado] = await pool.query(`
      SELECT 1
      FROM prestamos
      WHERE noVale = ?
      LIMIT 1
    `, [noVale]);

    if (valeDuplicado.length) {
      return res.status(409).json({
        ok: false,
        message: "Ese número de vale ya existe"
      });
    }

    await pool.query("START TRANSACTION");
    txStarted = true;

    const ID_ESTADO_ACTIVO = 1;

    const [prestamoResult] = await pool.query(`
      INSERT INTO prestamos (
        numeroControl,
        id_Estado,
        fecha_Hora_Prestamo,
        fecha_Hora_Devolucion,
        noVale,
        id_Materia,
        id_Profesor,
        mesa,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')
    `, [
      numeroControl,
      ID_ESTADO_ACTIVO,
      fechaHoraPrestamo,
      fechaHoraDevolucionInicial,
      noVale,
      idMateria,
      idProfesor,
      mesa
    ]);

    const idPrestamo = prestamoResult.insertId;

    for (const item of items) {
      const cantidad = Number(item.cantidad || 0);
      const idMaterial = Number(item.id_Material || 0);
      let material = String(item.material || "").trim();

      if (!cantidad || cantidad <= 0) {
        throw new Error("Cantidad inválida en uno de los materiales");
      }

      if (!material && idMaterial > 0) {
        const [matRows] = await pool.query(`
          SELECT nombre
          FROM materiales
          WHERE id_Material = ?
          LIMIT 1
        `, [idMaterial]);

        if (!matRows.length) {
          throw new Error(`No existe el material con id ${idMaterial}`);
        }

        material = String(matRows[0].nombre || "").trim();
      }

      if (!material) {
        throw new Error("Hay un material sin nombre");
      }

      await pool.query(`
        INSERT INTO prestamos_detalle (
          id_prestamo,
          material,
          cantidad,
          ok_cantidad,
          daniado_cantidad,
          condicion
        ) VALUES (?, ?, ?, NULL, NULL, NULL)
      `, [idPrestamo, material, cantidad]);
    }

    await pool.query("COMMIT");
    txStarted = false;

    return res.status(201).json({
      ok: true,
      message: "Préstamo guardado correctamente",
      data: {
        id_Prestamo: idPrestamo,
        numeroControl,
        noVale,
        mesa: `M${mesa}`,
        estado: "pendiente"
      }
    });
  } catch (err) {
    try {
      if (txStarted) {
        await pool.query("ROLLBACK");
      }
    } catch {}

    console.error("POST /api/prestamos:", err);
    return res.status(500).json({
      ok: false,
      message: err.message || "Error al guardar préstamo"
    });
  }
});

// PUT /api/prestamos/:id/aprobar
app.put("/api/prestamos/:id/aprobar", async (req, res) => {
  let txStarted = false;

  try {
    const idPrestamo = Number(req.params.id);

    if (!idPrestamo || idPrestamo <= 0) {
      return res.status(400).json({
        ok: false,
        message: "ID de préstamo inválido"
      });
    }

    const [prestamoRows] = await pool.query(`
      SELECT
        p.id_Prestamo,
        p.estado
      FROM prestamos p
      WHERE p.id_Prestamo = ?
      LIMIT 1
    `, [idPrestamo]);

    if (!prestamoRows.length) {
      return res.status(404).json({
        ok: false,
        message: "Préstamo no encontrado"
      });
    }

    const prestamo = prestamoRows[0];

    if (prestamo.estado !== "pendiente") {
      return res.status(409).json({
        ok: false,
        message: "Solo se puede aprobar un préstamo pendiente"
      });
    }

    const [detalleRows] = await pool.query(`
      SELECT
        pd.id_det,
        pd.material,
        pd.cantidad
      FROM prestamos_detalle pd
      WHERE pd.id_prestamo = ?
      ORDER BY pd.id_det ASC
    `, [idPrestamo]);

    if (!detalleRows.length) {
      return res.status(400).json({
        ok: false,
        message: "El préstamo no tiene materiales"
      });
    }

    await pool.query("START TRANSACTION");
    txStarted = true;

    for (const item of detalleRows) {
      const materialNombre = String(item.material || "").trim();
      const cantidadSolicitada = Number(item.cantidad || 0);

      const [matRows] = await pool.query(`
        SELECT
          id_Material,
          cantidad
        FROM materiales
        WHERE nombre = ?
        LIMIT 1
      `, [materialNombre]);

      if (!matRows.length) {
        throw new Error(`No existe el material "${materialNombre}" en inventario`);
      }

      const material = matRows[0];
      const stockActual = Number(material.cantidad || 0);

      if (stockActual < cantidadSolicitada) {
        throw new Error(`No hay suficiente stock para "${materialNombre}"`);
      }

      await pool.query(`
        UPDATE materiales
        SET cantidad = cantidad - ?
        WHERE id_Material = ?
      `, [cantidadSolicitada, material.id_Material]);
    }

    await pool.query(`
      UPDATE prestamos
      SET
        estado = 'aprobado',
        aprobado_en = NOW()
      WHERE id_Prestamo = ?
    `, [idPrestamo]);

    await pool.query("COMMIT");
    txStarted = false;

    return res.json({
      ok: true,
      message: "Préstamo aprobado correctamente"
    });
  } catch (err) {
    try {
      if (txStarted) await pool.query("ROLLBACK");
    } catch {}

    console.error("PUT /api/prestamos/:id/aprobar:", err);
    return res.status(500).json({
      ok: false,
      message: err.message || "Error al aprobar préstamo"
    });
  }
});

// PUT /api/prestamos/:id/rechazar
app.put("/api/prestamos/:id/rechazar", async (req, res) => {
  try {
    const idPrestamo = Number(req.params.id);

    if (!idPrestamo || idPrestamo <= 0) {
      return res.status(400).json({
        ok: false,
        message: "ID de préstamo inválido"
      });
    }

    const [prestamoRows] = await pool.query(`
      SELECT
        id_Prestamo,
        estado
      FROM prestamos
      WHERE id_Prestamo = ?
      LIMIT 1
    `, [idPrestamo]);

    if (!prestamoRows.length) {
      return res.status(404).json({
        ok: false,
        message: "Préstamo no encontrado"
      });
    }

    if (prestamoRows[0].estado !== "pendiente") {
      return res.status(409).json({
        ok: false,
        message: "Solo se puede rechazar un préstamo pendiente"
      });
    }

    await pool.query(`
      UPDATE prestamos
      SET
        estado = 'rechazado',
        rechazado_en = NOW()
      WHERE id_Prestamo = ?
    `, [idPrestamo]);

    return res.json({
      ok: true,
      message: "Préstamo rechazado correctamente"
    });
  } catch (err) {
    console.error("PUT /api/prestamos/:id/rechazar:", err);
    return res.status(500).json({
      ok: false,
      message: err.message || "Error al rechazar préstamo"
    });
  }
});

// PUT /api/prestamos/:id/devolucion
app.put("/api/prestamos/:id/devolucion", async (req, res) => {
  let txStarted = false;

  try {
    const idPrestamo = Number(req.params.id);
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const observacion = String(req.body.observacion || "").trim();

    if (!idPrestamo || idPrestamo <= 0) {
      return res.status(400).json({
        ok: false,
        message: "ID de préstamo inválido"
      });
    }

    if (!items.length) {
      return res.status(400).json({
        ok: false,
        message: "Debes enviar los materiales de la devolución"
      });
    }

    const [prestamoRows] = await pool.query(`
      SELECT
        id_Prestamo,
        estado
      FROM prestamos
      WHERE id_Prestamo = ?
      LIMIT 1
    `, [idPrestamo]);

    if (!prestamoRows.length) {
      return res.status(404).json({
        ok: false,
        message: "Préstamo no encontrado"
      });
    }

    if (prestamoRows[0].estado !== "aprobado") {
      return res.status(409).json({
        ok: false,
        message: "Solo se puede registrar devolución de un préstamo aprobado"
      });
    }

    const [detalleRows] = await pool.query(`
      SELECT
        id_det,
        id_prestamo,
        material,
        cantidad
      FROM prestamos_detalle
      WHERE id_prestamo = ?
      ORDER BY id_det ASC
    `, [idPrestamo]);

    if (!detalleRows.length) {
      return res.status(400).json({
        ok: false,
        message: "El préstamo no tiene detalle"
      });
    }

    if (items.length !== detalleRows.length) {
      return res.status(400).json({
        ok: false,
        message: "La devolución no coincide con el número de materiales del préstamo"
      });
    }

    await pool.query("START TRANSACTION");
    txStarted = true;

    let huboDanio = false;

    for (let i = 0; i < detalleRows.length; i++) {
      const det = detalleRows[i];
      const devol = items[i];

      const totalPrestado = Number(det.cantidad || 0);
      const cantidadOk = Number(devol.cantidad_ok || 0);
      const cantidadDaniado = Number(devol.cantidad_daniado || 0);
      const estadoMaterial = String(devol.estado_material || "ok").trim();

      if (cantidadOk < 0 || cantidadDaniado < 0) {
        throw new Error(`Cantidades inválidas en "${det.material}"`);
      }

      if (cantidadOk + cantidadDaniado !== totalPrestado) {
        throw new Error(`La suma de devolución no coincide en "${det.material}"`);
      }

      if (cantidadDaniado > 0 || estadoMaterial === "daniado" || estadoMaterial === "leve") {
        huboDanio = true;
      }

      await pool.query(`
        UPDATE prestamos_detalle
        SET
          ok_cantidad = ?,
          daniado_cantidad = ?,
          condicion = ?
        WHERE id_det = ?
      `, [
        cantidadOk,
        cantidadDaniado,
        estadoMaterial,
        det.id_det
      ]);

      if (cantidadOk > 0) {
        const [matRows] = await pool.query(`
          SELECT
            id_Material
          FROM materiales
          WHERE nombre = ?
          LIMIT 1
        `, [det.material]);

        if (!matRows.length) {
          throw new Error(`No existe el material "${det.material}" en inventario`);
        }

        await pool.query(`
          UPDATE materiales
          SET cantidad = cantidad + ?
          WHERE id_Material = ?
        `, [cantidadOk, matRows[0].id_Material]);
      }
    }

    await pool.query(`
      UPDATE prestamos
      SET
        estado = 'devuelto',
        devuelto_en = NOW(),
        fecha_Hora_Devolucion = NOW(),
        observacion_devolucion = ?
      WHERE id_Prestamo = ?
    `, [
      observacion || (huboDanio ? "Devolución con observaciones." : "Devolución correcta."),
      idPrestamo
    ]);

    await pool.query("COMMIT");
    txStarted = false;

    return res.json({
      ok: true,
      message: huboDanio
        ? "Devolución registrada con observaciones"
        : "Devolución registrada correctamente"
    });
  } catch (err) {
    try {
      if (txStarted) await pool.query("ROLLBACK");
    } catch {}

    console.error("PUT /api/prestamos/:id/devolucion:", err);
    return res.status(500).json({
      ok: false,
      message: err.message || "Error al registrar devolución"
    });
  }
});

/* =======================
   ASESORIAS
======================= */

// GET /api/asesorias -> lista
app.get("/api/asesorias", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        a.id_Asesoria,
        a.auxiliar,
        a.id_Estado,
        a.descripcion,
        DATE_FORMAT(a.fecha_Hora, '%Y-%m-%d') AS fecha,
        DATE_FORMAT(a.fecha_Hora, '%H:%i') AS hora_inicio,
        a.nombre
      FROM asesorias a
      WHERE a.id_Estado = 1
      ORDER BY a.fecha_Hora ASC, a.id_Asesoria ASC
    `);

    return res.json({
      ok: true,
      data: rows.map((a) => ({
        id: Number(a.id_Asesoria),
        id_Asesoria: Number(a.id_Asesoria),
        auxiliar: Number(a.auxiliar),
        id_Estado: Number(a.id_Estado),
        descripcion: a.descripcion || "",
        fecha: a.fecha || "",
        hora: a.hora_inicio ? `${a.hora_inicio} - ${a.hora_inicio}` : "",
        nombre: a.nombre || "",
        materia: a.nombre || "",
        docente: "",
        cupo: 0,
        inscritos: 0
      }))
    });
  } catch (err) {
    console.error("GET /api/asesorias:", err);
    return res.status(500).json({
      ok: false,
      message: "Error al cargar asesorías"
    });
  }
});

// POST /api/asesorias -> crear
app.post("/api/asesorias", async (req, res) => {
  let txStarted = false;

  try {
    const materia = (req.body.materia ?? req.body.nombre ?? "").toString().trim();
    const docente = (req.body.docente ?? "").toString().trim();
    const descripcion = (req.body.descripcion ?? "").toString().trim();
    const fecha = (req.body.fecha ?? "").toString().trim();
    const hora = (req.body.hora ?? "").toString().trim();
    const cupo = Number(req.body.cupo || 0);
    const auxiliar = Number(req.body.auxiliar || 0);

    if (!materia) {
      return res.status(400).json({ ok: false, message: "La materia es obligatoria" });
    }

    if (!docente) {
      return res.status(400).json({ ok: false, message: "El docente es obligatorio" });
    }

    if (!descripcion) {
      return res.status(400).json({ ok: false, message: "La descripción es obligatoria" });
    }

    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ ok: false, message: "La fecha es inválida" });
    }

    if (!hora) {
      return res.status(400).json({ ok: false, message: "La hora es obligatoria" });
    }

    if (!Number.isFinite(cupo) || cupo < 1) {
      return res.status(400).json({ ok: false, message: "El cupo es inválido" });
    }

    if (!auxiliar || auxiliar <= 0) {
      return res.status(400).json({ ok: false, message: "El auxiliar es inválido" });
    }

    const horaInicio = hora.includes(" - ")
      ? hora.split(" - ")[0].trim()
      : hora.trim();

    if (!/^\d{2}:\d{2}$/.test(horaInicio)) {
      return res.status(400).json({ ok: false, message: "La hora de inicio es inválida" });
    }

    const fechaHora = `${fecha} ${horaInicio}:00`;

    const [auxRows] = await pool.query(`
      SELECT 1
      FROM personas
      WHERE numeroControl = ?
      LIMIT 1
    `, [auxiliar]);

    if (!auxRows.length) {
      return res.status(400).json({
        ok: false,
        message: "El auxiliar enviado no existe en personas"
      });
    }

    const [dupFechaHora] = await pool.query(`
      SELECT 1
      FROM asesorias
      WHERE fecha_Hora = ?
      LIMIT 1
    `, [fechaHora]);

    if (dupFechaHora.length) {
      return res.status(409).json({
        ok: false,
        message: "Ya existe una asesoría en esa fecha y hora"
      });
    }

    const idAsesoria = Date.now();

    await pool.query("START TRANSACTION");
    txStarted = true;

    await pool.query(`
      INSERT INTO asesorias (
        id_Asesoria,
        auxiliar,
        id_Estado,
        descripcion,
        fecha_Hora,
        nombre
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      idAsesoria,
      auxiliar,
      1,
      descripcion,
      fechaHora,
      materia
    ]);

    await pool.query("COMMIT");
    txStarted = false;

    return res.status(201).json({
      ok: true,
      message: "Asesoría creada correctamente",
      data: {
        id: idAsesoria,
        id_Asesoria: idAsesoria,
        nombre: materia,
        materia,
        descripcion,
        fecha,
        hora,
        docente,
        cupo,
        auxiliar
      }
    });
  } catch (err) {
    try {
      if (txStarted) await pool.query("ROLLBACK");
    } catch {}

    console.error("POST /api/asesorias:", err);
    return res.status(500).json({
      ok: false,
      message: "Error al guardar asesoría"
    });
  }
});

// PUT /api/asesorias/:id -> actualizar
app.put("/api/asesorias/:id", async (req, res) => {
  let txStarted = false;

  try {
    const idAsesoria = Number(req.params.id);
    const materia = (req.body.materia ?? req.body.nombre ?? "").toString().trim();
    const docente = (req.body.docente ?? "").toString().trim();
    const descripcion = (req.body.descripcion ?? "").toString().trim();
    const fecha = (req.body.fecha ?? "").toString().trim();
    const hora = (req.body.hora ?? "").toString().trim();
    const cupo = Number(req.body.cupo || 0);
    const auxiliar = Number(req.body.auxiliar || 0);

    if (!idAsesoria || idAsesoria <= 0) {
      return res.status(400).json({ ok: false, message: "ID de asesoría inválido" });
    }

    if (!materia) {
      return res.status(400).json({ ok: false, message: "La materia es obligatoria" });
    }

    if (!docente) {
      return res.status(400).json({ ok: false, message: "El docente es obligatorio" });
    }

    if (!descripcion) {
      return res.status(400).json({ ok: false, message: "La descripción es obligatoria" });
    }

    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ ok: false, message: "La fecha es inválida" });
    }

    if (!hora) {
      return res.status(400).json({ ok: false, message: "La hora es obligatoria" });
    }

    if (!Number.isFinite(cupo) || cupo < 1) {
      return res.status(400).json({ ok: false, message: "El cupo es inválido" });
    }

    if (!auxiliar || auxiliar <= 0) {
      return res.status(400).json({ ok: false, message: "El auxiliar es inválido" });
    }

    const horaInicio = hora.includes(" - ")
      ? hora.split(" - ")[0].trim()
      : hora.trim();

    if (!/^\d{2}:\d{2}$/.test(horaInicio)) {
      return res.status(400).json({ ok: false, message: "La hora de inicio es inválida" });
    }

    const fechaHora = `${fecha} ${horaInicio}:00`;

    const [existsRows] = await pool.query(`
      SELECT 1
      FROM asesorias
      WHERE id_Asesoria = ?
      LIMIT 1
    `, [idAsesoria]);

    if (!existsRows.length) {
      return res.status(404).json({ ok: false, message: "Asesoría no encontrada" });
    }

    const [auxRows] = await pool.query(`
      SELECT 1
      FROM personas
      WHERE numeroControl = ?
      LIMIT 1
    `, [auxiliar]);

    if (!auxRows.length) {
      return res.status(400).json({
        ok: false,
        message: "El auxiliar enviado no existe en personas"
      });
    }

    const [dupFechaHora] = await pool.query(`
      SELECT 1
      FROM asesorias
      WHERE fecha_Hora = ?
        AND id_Asesoria <> ?
      LIMIT 1
    `, [fechaHora, idAsesoria]);

    if (dupFechaHora.length) {
      return res.status(409).json({
        ok: false,
        message: "Ya existe otra asesoría en esa fecha y hora"
      });
    }

    await pool.query("START TRANSACTION");
    txStarted = true;

    await pool.query(`
      UPDATE asesorias
      SET
        auxiliar = ?,
        descripcion = ?,
        fecha_Hora = ?,
        nombre = ?
      WHERE id_Asesoria = ?
    `, [
      auxiliar,
      descripcion,
      fechaHora,
      materia,
      idAsesoria
    ]);

    await pool.query("COMMIT");
    txStarted = false;

    return res.json({
      ok: true,
      message: "Asesoría actualizada correctamente",
      data: {
        id: idAsesoria,
        id_Asesoria: idAsesoria,
        nombre: materia,
        materia,
        descripcion,
        fecha,
        hora,
        docente,
        cupo,
        auxiliar
      }
    });
  } catch (err) {
    try {
      if (txStarted) await pool.query("ROLLBACK");
    } catch {}

    console.error("PUT /api/asesorias/:id:", err);
    return res.status(500).json({
      ok: false,
      message: "Error al actualizar asesoría"
    });
  }
});

// DELETE /api/asesorias/:id -> eliminar lógica
app.delete("/api/asesorias/:id", async (req, res) => {
  try {
    const idAsesoria = Number(req.params.id);

    if (!idAsesoria || idAsesoria <= 0) {
      return res.status(400).json({
        ok: false,
        message: "ID de asesoría inválido"
      });
    }

    const [existsRows] = await pool.query(`
      SELECT 1
      FROM asesorias
      WHERE id_Asesoria = ?
      LIMIT 1
    `, [idAsesoria]);

    if (!existsRows.length) {
      return res.status(404).json({
        ok: false,
        message: "Asesoría no encontrada"
      });
    }

    await pool.query(`
      UPDATE asesorias
      SET id_Estado = 0
      WHERE id_Asesoria = ?
    `, [idAsesoria]);

    return res.json({
      ok: true,
      message: "Asesoría eliminada correctamente"
    });
  } catch (err) {
    console.error("DELETE /api/asesorias/:id:", err);
    return res.status(500).json({
      ok: false,
      message: "Error al eliminar asesoría"
    });
  }
});

/* =======================
   CHECK NC
======================= */
app.get("/api/check-nc", async (req, res) => {
  try {
    const numeroControl = (req.query.numeroControl ?? "").toString().trim();

    if (!/^\d{8}$/.test(numeroControl)) {
      return res.status(400).json({
        success: false,
        exists: null,
        message: "Número de control inválido"
      });
    }

    const [rows] = await pool.query(
      "SELECT 1 FROM usuarios WHERE numeroControl = ? LIMIT 1",
      [Number(numeroControl)]
    );

    return res.json({
      success: true,
      exists: rows.length > 0
    });
  } catch (err) {
    console.error("check-nc:", err);
    return res.status(500).json({
      success: false,
      exists: null,
      message: "Error interno"
    });
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

    if (!/^\d{8}$/.test(numeroControl)) {
      return res.status(400).json({
        success: false,
        message: "Número de control inválido"
      });
    }

    if (!nombre || !apellidoPaterno || !apellidoMaterno || !carrera || !clave) {
      return res.status(400).json({
        success: false,
        message: "Faltan campos"
      });
    }

    if (clave.length > 10) {
      return res.status(400).json({
        success: false,
        message: "La contraseña es máximo 10 caracteres"
      });
    }

    const [existsRows] = await pool.query(
      "SELECT 1 FROM usuarios WHERE numeroControl = ? LIMIT 1",
      [Number(numeroControl)]
    );

    if (existsRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Ese número de control ya está registrado"
      });
    }

    const [carreraRows] = await pool.query(
      "SELECT id_Carrera FROM carreras WHERE nombre = ? LIMIT 1",
      [carrera]
    );

    if (!carreraRows.length) {
      return res.status(400).json({
        success: false,
        message: "La carrera no existe en el catálogo"
      });
    }

    const idCarrera = Number(carreraRows[0].id_Carrera);
    const hash = await bcrypt.hash(clave, 10);

    await pool.query("START TRANSACTION");
    txStarted = true;

    const ID_ROL_ALUMNO = 1;

    await pool.query(
      `INSERT INTO personas
       (numeroControl, id_Rol, id_Estado, nombre, apellidoPaterno, apellidoMaterno)
       VALUES (?, ?, 1, ?, ?, ?)`,
      [
        Number(numeroControl),
        ID_ROL_ALUMNO,
        nombre,
        apellidoPaterno,
        apellidoMaterno
      ]
    );

    await pool.query(
      `INSERT INTO carrerasalumnos (numeroControl, id_Carrera)
       VALUES (?, ?)`,
      [Number(numeroControl), idCarrera]
    );

    await pool.query(
      `INSERT INTO usuarios (id_Estado, numeroControl, Clave)
       VALUES (1, ?, ?)`,
      [Number(numeroControl), hash]
    );

    await pool.query("COMMIT");
    txStarted = false;

    return res.json({
      success: true,
      message: "Registro exitoso"
    });
  } catch (err) {
    try {
      if (txStarted) await pool.query("ROLLBACK");
    } catch {}

    console.error("register:", err);
    return res.status(500).json({
      success: false,
      message: "Error interno"
    });
  }
});

/* =======================
   LOGIN
======================= */
app.post("/api/login", async (req, res) => {
  try {
    const numeroControlRaw = (req.body.numeroControl ?? "").toString().trim();
    const passwordInput = (req.body.password ?? "").toString();

    if (!numeroControlRaw || !passwordInput) {
      return res.status(400).json({
        success: false,
        message: "⚠️ Campos vacíos"
      });
    }

    if (!/^\d+$/.test(numeroControlRaw)) {
      return res.status(400).json({
        success: false,
        message: "🔎 El número de control debe ser numérico."
      });
    }

    const len = numeroControlRaw.length;

    if (len < 4) {
      return res.status(400).json({
        success: false,
        message: "🔎 Faltan dígitos."
      });
    }

    if (len >= 5 && len <= 7) {
      return res.status(400).json({
        success: false,
        message: "🔎 Debe tener 4 (auxiliar) o 8 (alumno) dígitos."
      });
    }

    if (len > 8) {
      return res.status(400).json({
        success: false,
        message: "🔎 Te pasaste de dígitos."
      });
    }

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
      INNER JOIN roles R ON R.id_Rol = P.id_Rol
      WHERE U.numeroControl = ?
      LIMIT 1
    `;

    const [rows] = await pool.query(sql, [numeroControl]);

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: "❌ Número de control no encontrado"
      });
    }

    const row = rows[0];
    const rolBruto = (row.nombreRol ?? "").toString().trim();
    const rol = rolBruto.toLowerCase();

    if (rol === "auxiliar" && len !== 4) {
      return res.status(400).json({
        success: false,
        message: len < 4 ? "🔎 Faltan dígitos." : "🔎 Te pasaste de dígitos."
      });
    }

    if (rol === "alumno" && len !== 8) {
      return res.status(400).json({
        success: false,
        message: len < 8 ? "🔎 Faltan dígitos." : "🔎 Te pasaste de dígitos."
      });
    }

    const ok = await bcrypt.compare(passwordInput, String(row.hash ?? ""));

    if (!ok) {
      return res.status(401).json({
        success: false,
        message: "❌ Credenciales incorrectas"
      });
    }

    if (Number(row.estadoUsuario) !== 1 || Number(row.estadoPersona) !== 1) {
      return res.status(403).json({
        success: false,
        message: "⛔ Usuario inactivo."
      });
    }

    const nombreCompleto = `${row.nombrePersona} ${row.apellidoPaterno} ${row.apellidoMaterno}`
      .replace(/\s+/g, " ")
      .trim();

    const [carreraRows] = await pool.query(`
      SELECT c.nombre AS carrera
      FROM carrerasalumnos ca
      INNER JOIN carreras c
        ON c.id_Carrera = ca.id_Carrera
      WHERE ca.numeroControl = ?
      LIMIT 1
    `, [numeroControl]);

    const carrera = carreraRows.length
      ? String(carreraRows[0].carrera || "").trim()
      : "";

    return res.json({
      success: true,
      message: `✅ Bienvenido ${nombreCompleto}`,
      rol,
      rolNombreFull: rolBruto,
      nombre: nombreCompleto,
      nombreCompleto,
      numeroControl: String(row.numeroControl),
      carrera
    });
  } catch (err) {
    console.error("login:", err);
    return res.status(500).json({
      success: false,
      message: "❌ Error interno del servidor"
    });
  }
});

/* =======================
   PUERTO
======================= */
const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Backend escuchando en puerto ${port}`);
});