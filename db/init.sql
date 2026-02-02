-- =========================================================
--  ESQUEMA LABORATORIO_ELECTRONICA - VERSION DOCKER FRIENDLY
-- =========================================================

-- Crear base de datos (si no existe)
CREATE DATABASE IF NOT EXISTS `Laboratorio_Electronica`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `Laboratorio_Electronica`;

-- Opcional: asegurar modo y checks (útil en Docker)
SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;
SET UNIQUE_CHECKS = 0;

-- =========================================================
--  TABLAS BASE
-- =========================================================

-- Estados (Activo / Inactivo)
DROP TABLE IF EXISTS `estados`;
CREATE TABLE `estados` (
  `id_Estado` INT UNSIGNED NOT NULL,
  `nombre` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id_Estado`),
  UNIQUE KEY `UNIQUE_ESTADOS` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `estados` (`id_Estado`, `nombre`) VALUES
  (1, 'Activo'),
  (2, 'Inactivo');

-- Roles (Alumno / Auxiliar / Docente)
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id_Rol` INT UNSIGNED NOT NULL,
  `id_Estado` INT UNSIGNED NOT NULL,
  `nombre` VARCHAR(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id_Rol`),
  UNIQUE KEY `UNIQUE_ROLES` (`nombre`),
  KEY `Roles_FKIndex1` (`id_Estado`),
  CONSTRAINT `roles_ibfk_1` FOREIGN KEY (`id_Estado`)
    REFERENCES `estados` (`id_Estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `roles` (`id_Rol`, `id_Estado`, `nombre`) VALUES
  (1, 1, 'Alumno'),
  (2, 1, 'Auxiliar'),
  (3, 1, 'Docente');

-- =========================================================
--  PERSONAS, PROFESORES, CARRERAS, ALUMNOS
-- =========================================================

-- Personas
DROP TABLE IF EXISTS `personas`;
CREATE TABLE `personas` (
  `numeroControl` INT UNSIGNED NOT NULL,
  `id_Rol` INT UNSIGNED NOT NULL,
  `id_Estado` INT UNSIGNED NOT NULL,
  `nombre` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `apellidoPaterno` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `apellidoMaterno` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`numeroControl`),
  UNIQUE KEY `uq_personas_numeroControl` (`numeroControl`),
  KEY `Usuarios_FKIndex1` (`id_Estado`),
  KEY `Usuarios_FKIndex2` (`id_Rol`),
  CONSTRAINT `personas_ibfk_1` FOREIGN KEY (`id_Estado`)
    REFERENCES `estados` (`id_Estado`),
  CONSTRAINT `personas_ibfk_2` FOREIGN KEY (`id_Rol`)
    REFERENCES `roles` (`id_Rol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `personas` (`numeroControl`, `id_Rol`, `id_Estado`, `nombre`, `apellidoPaterno`, `apellidoMaterno`) VALUES
  (2040,     2, 1, 'Jesus',   'Vazquez',   'Rodriguez'),
  (3001,     3, 1, 'Marta',   'Ruiz',      'Salas'),
  (3212,     3, 1, 'Octavio', 'Hernandez', 'Mendez'),
  (22050677, 1, 1, 'Laura',   'Estela',    'Rodríguez'),
  (22050756, 1, 1, 'Mariana', 'mota',      'piña'),
  (22057678, 1, 1, 'Laura',   'Rodriguez', 'Estela');

-- Profesores
DROP TABLE IF EXISTS `profesores`;
CREATE TABLE `profesores` (
  `id_Profesor` INT UNSIGNED NOT NULL,
  `id_Estado` INT UNSIGNED NOT NULL,
  `nombre` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `apellidoPaterno` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `apellidoMaterno` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id_Profesor`),
  KEY `Profesores_FKIndex1` (`id_Estado`),
  CONSTRAINT `profesores_ibfk_1` FOREIGN KEY (`id_Estado`)
    REFERENCES `estados` (`id_Estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `profesores` (`id_Profesor`, `id_Estado`, `nombre`, `apellidoPaterno`, `apellidoMaterno`) VALUES
  (3001, 1, 'Marta', 'Ruiz', 'Salas');

-- Carreras
DROP TABLE IF EXISTS `carreras`;
CREATE TABLE `carreras` (
  `id_Carrera` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_Estado` INT UNSIGNED NOT NULL,
  `nombre` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id_Carrera`),
  UNIQUE KEY `UNIQUE_CARRERAS` (`nombre`),
  KEY `Carreras_FKIndex1` (`id_Estado`),
  CONSTRAINT `carreras_ibfk_1` FOREIGN KEY (`id_Estado`)
    REFERENCES `estados` (`id_Estado`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `carreras` (`id_Carrera`, `id_Estado`, `nombre`) VALUES
  (11, 1, 'Ingenieria Electronica'),
  (12, 1, 'Ingeniería en Sistemas Computacionales');

-- CarrerasAlumnos
DROP TABLE IF EXISTS `carrerasalumnos`;
CREATE TABLE `carrerasalumnos` (
  `numeroControl` INT UNSIGNED NOT NULL,
  `id_Carrera` INT UNSIGNED NOT NULL,
  UNIQUE KEY `UNIQUE_CARRERAS_ALUMNOS` (`numeroControl`),
  KEY `Table_14_FKIndex1` (`id_Carrera`),
  KEY `CarrerasAlumnos_FKIndex2` (`numeroControl`),
  CONSTRAINT `carrerasalumnos_ibfk_1` FOREIGN KEY (`id_Carrera`)
    REFERENCES `carreras` (`id_Carrera`),
  CONSTRAINT `carrerasalumnos_ibfk_2` FOREIGN KEY (`numeroControl`)
    REFERENCES `personas` (`numeroControl`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `carrerasalumnos` (`numeroControl`, `id_Carrera`) VALUES
  (22050677, 12),
  (22050756, 12),
  (22057678, 12);


-- =========================================================
--  MATERIAS
-- =========================================================

DROP TABLE IF EXISTS `materias`;
CREATE TABLE `materias` (
  `id_Materia` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_Estado` INT UNSIGNED NOT NULL,
  `id_Carrera` INT UNSIGNED NOT NULL,
  `nombre` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre_norm` VARCHAR(60)
     CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci
     GENERATED ALWAYS AS (
       regexp_replace(trim(lower(`nombre`)), '\\s+', ' ')
     ) STORED,
  PRIMARY KEY (`id_Materia`),
  UNIQUE KEY `ux_materias_norm_carrera` (`nombre_norm`, `id_Carrera`),
  KEY `Materias_FKIndex1` (`id_Estado`),
  KEY `idx_m_id_carrera` (`id_Carrera`),
  CONSTRAINT `materias_ibfk_1` FOREIGN KEY (`id_Estado`)
    REFERENCES `estados` (`id_Estado`),
  CONSTRAINT `materias_carrera_fk` FOREIGN KEY (`id_Carrera`)
    REFERENCES `carreras` (`id_Carrera`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `materias` (`id_Materia`, `id_Estado`, `id_Carrera`, `nombre`) VALUES
  (1,  1, 11, 'Circuitos I'),
  (2,  1, 11, 'Electrónica Analógica'),
  (3,  1, 12, 'Principios Eléctricos y Aplicaciones Digitales.'),
  (15, 1, 11, 'Funciones I');


-- =========================================================
--  ASESORÍAS (TABLAS WEB + RELACIONES)
-- =========================================================

-- Asesorías versión sistema “clásico”
DROP TABLE IF EXISTS `asesorias`;
CREATE TABLE `asesorias` (
  `id_Asesoria` BIGINT NOT NULL,
  `auxiliar` INT UNSIGNED NOT NULL,
  `id_Estado` INT UNSIGNED NOT NULL,
  `descripcion` VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha_Hora` DATETIME NOT NULL,
  `nombre` VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id_Asesoria`),
  UNIQUE KEY `UNIQUE_HORA` (`fecha_Hora`),
  KEY `Asesorias_FKIndex1` (`id_Estado`),
  KEY `Asesorias_FKIndex3` (`auxiliar`),
  CONSTRAINT `asesorias_ibfk_1` FOREIGN KEY (`id_Estado`)
    REFERENCES `estados` (`id_Estado`),
  CONSTRAINT `asesorias_ibfk_2` FOREIGN KEY (`auxiliar`)
    REFERENCES `personas` (`numeroControl`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de relación asesorías–alumnos (sistema clásico)
DROP TABLE IF EXISTS `asesoriasalumnos`;
CREATE TABLE `asesoriasalumnos` (
  `alumno` INT UNSIGNED NOT NULL,
  `id_Asesoria` BIGINT NOT NULL,
  PRIMARY KEY (`alumno`, `id_Asesoria`),
  KEY `AsesoriasAlumnos_FKIndex1` (`id_Asesoria`),
  KEY `AsesoriasAlumnos_FKIndex2` (`alumno`),
  CONSTRAINT `asesoriasalumnos_ibfk_1` FOREIGN KEY (`id_Asesoria`)
    REFERENCES `asesorias` (`id_Asesoria`),
  CONSTRAINT `asesoriasalumnos_ibfk_2` FOREIGN KEY (`alumno`)
    REFERENCES `personas` (`numeroControl`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Asesorías web (catálogo)
DROP TABLE IF EXISTS `asesoriasweb`;
CREATE TABLE `asesoriasweb` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `titulo` VARCHAR(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_profesor` INT UNSIGNED DEFAULT NULL,
  `docente_text` VARCHAR(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `auxiliar` VARCHAR(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `descripcion` VARCHAR(600) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha` DATE NOT NULL,
  `hora` VARCHAR(25) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cupo_total` INT UNSIGNED NOT NULL DEFAULT 1,
  `cupo_actual` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `asesoriasweb` (`id`, `titulo`, `id_profesor`, `docente_text`, `auxiliar`, `descripcion`, `fecha`, `hora`, `cupo_total`, `cupo_actual`, `created_at`, `updated_at`) VALUES
  (3, 'Principios Eléctricos y Aplicaciones Digitales.', 3212, NULL, '', 'Unidad 1', '2025-11-20', '08:30 - 09:30', 8, 1, '2025-11-18 17:48:48', '2025-11-19 19:35:30'),
  (4, 'Principios Eléctricos y Aplicaciones Digitales.', 3212, NULL, '', 'Unidad 2', '2025-11-24', '08:30 - 09:30', 12, 2, '2025-11-18 19:46:47', '2025-11-21 19:20:13'),
  (6, 'Funciones I', 3001, 'Marta Ruiz Salas', 'Marta Ruiz Salas', 'Unidad de repaso para examen', '2025-11-30', '09:30 - 10:30', 6, 0, '2025-11-23 08:36:17', '2025-11-23 08:36:17'),
  (9, 'Electrónica Analógica', 3212, NULL, '', 'Repaso de examen', '2025-12-02', '08:30 - 09:30', 6, 0, '2025-11-23 09:58:19', '2025-11-23 09:58:19');

-- Inscritos a asesorías web
DROP TABLE IF EXISTS `asesoriasinscritos`;
CREATE TABLE `asesoriasinscritos` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_asesoria` BIGINT UNSIGNED NOT NULL,
  `no_control` VARCHAR(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre` VARCHAR(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `correo` VARCHAR(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_asesoria_alumno` (`id_asesoria`, `no_control`),
  CONSTRAINT `fk_ai_asesoria` FOREIGN KEY (`id_asesoria`)
    REFERENCES `asesoriasweb` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `asesoriasinscritos` (`id`, `id_asesoria`, `no_control`, `nombre`, `correo`, `created_at`) VALUES
  (1, 3, '22050756', 'Mariana', '', '2025-11-19 19:35:30'),
  (2, 4, '22050756', 'Mariana', '', '2025-11-19 20:06:23'),
  (3, 4, '22057678', 'Laura',   '', '2025-11-21 19:20:13');


-- =========================================================
--  INVENTARIO / COMPRAS / PRÉSTAMOS
-- =========================================================

-- Compras
DROP TABLE IF EXISTS `compras`;
CREATE TABLE `compras` (
  `id_compra` BIGINT NOT NULL,
  `numeroControl` INT UNSIGNED NOT NULL,
  `id_Estado` INT UNSIGNED NOT NULL,
  `fechaIngreso` DATETIME NOT NULL,
  PRIMARY KEY (`id_compra`),
  KEY `Compras_FKIndex1` (`id_Estado`),
  KEY `Compras_FKIndex2` (`numeroControl`),
  CONSTRAINT `compras_ibfk_1` FOREIGN KEY (`id_Estado`)
    REFERENCES `estados` (`id_Estado`),
  CONSTRAINT `compras_ibfk_2` FOREIGN KEY (`numeroControl`)
    REFERENCES `personas` (`numeroControl`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Materiales
DROP TABLE IF EXISTS `materiales`;
CREATE TABLE `materiales` (
  `id_Material` BIGINT NOT NULL,
  `id_Estado` INT UNSIGNED NOT NULL,
  `nombre` VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cantidad` INT NOT NULL,
  `max_por_alumno` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id_Material`),
  UNIQUE KEY `UNIQUE_MATERIALES` (`nombre`),
  KEY `Materiales_FKIndex1` (`id_Estado`),
  KEY `idx_materiales_nombre` (`nombre`),
  CONSTRAINT `materiales_ibfk_1` FOREIGN KEY (`id_Estado`)
    REFERENCES `estados` (`id_Estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `materiales` (`id_Material`, `id_Estado`, `nombre`, `cantidad`, `max_por_alumno`) VALUES
  (1003, 1, 'Protoboard 830 puntos',            40, 3),
  (1005, 1, 'Ejemplo',                           0, 9),
  (1006, 1, 'Ejemplos',                          0, 6),
  (1007, 1, 'Cable Dupont M-M (paquete 40)',     0, 50),
  (1008, 1, 'Capacitor Electrolítico 10µF',      0, 10),
  (1009, 1, 'Resistor 220Ω',                     0, 15),
  (1010, 1, 'Materias',                          0, 7);

-- Claves de materiales
DROP TABLE IF EXISTS `materialclaves`;
CREATE TABLE `materialclaves` (
  `id_Material` BIGINT NOT NULL,
  `clave` VARCHAR(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id_Material`),
  UNIQUE KEY `UNIQUE_CLAVE` (`clave`),
  CONSTRAINT `fk_matclave_material` FOREIGN KEY (`id_Material`)
    REFERENCES `materiales` (`id_Material`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `materialclaves` (`id_Material`, `clave`) VALUES
  (1008, 'CE-023'),
  (1007, 'CLAD-02'),
  (1005, 'EJ-001'),
  (1006, 'EJ-012'),
  (1010, 'ME-012'),
  (1003, 'PRO-003'),
  (1009, 'RE-08');

-- Materiales comprados
DROP TABLE IF EXISTS `materialescomprados`;
CREATE TABLE `materialescomprados` (
  `id_MaterialComprado` BIGINT NOT NULL,
  `id_Estado` INT UNSIGNED NOT NULL,
  `id_Material` BIGINT NOT NULL,
  `id_compra` BIGINT NOT NULL,
  `cantidad` INT UNSIGNED NOT NULL,
  `gastoTotal` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`id_MaterialComprado`),
  UNIQUE KEY `UNIQUE_MATERIALES_COMPRADOS` (`id_Material`, `id_compra`),
  KEY `MaterialesComprados_FKIndex1` (`id_Material`),
  KEY `MaterialesComprados_FKIndex2` (`id_compra`),
  KEY `MaterialesComprados_FKIndex3` (`id_Estado`),
  CONSTRAINT `fk_mc_compra` FOREIGN KEY (`id_compra`)
    REFERENCES `compras` (`id_compra`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_mc_material` FOREIGN KEY (`id_Material`)
    REFERENCES `materiales` (`id_Material`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `materialescomprados_ibfk_3` FOREIGN KEY (`id_Estado`)
    REFERENCES `estados` (`id_Estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Préstamos
DROP TABLE IF EXISTS `prestamos`;
CREATE TABLE `prestamos` (
  `id_Prestamo` BIGINT NOT NULL,
  `numeroControl` INT UNSIGNED NOT NULL,
  `id_Estado` INT UNSIGNED NOT NULL,
  `id_Materia` INT UNSIGNED NOT NULL,
  `id_Profesor` INT UNSIGNED NOT NULL,
  `fecha_Hora_Prestamo` DATETIME NOT NULL,
  `mesa` INT UNSIGNED NOT NULL,
  `fecha_Hora_Devolucion` DATETIME NOT NULL,
  PRIMARY KEY (`id_Prestamo`),
  UNIQUE KEY `UNIQUE_PRESTAMOS` (`fecha_Hora_Prestamo`),
  KEY `Prestamos_FKIndex1` (`id_Estado`),
  KEY `Prestamos_FKIndex2` (`id_Profesor`),
  KEY `Prestamos_FKIndex3` (`id_Materia`),
  KEY `Prestamos_FKIndex4` (`numeroControl`),
  CONSTRAINT `prestamos_ibfk_1` FOREIGN KEY (`id_Profesor`)
    REFERENCES `profesores` (`id_Profesor`),
  CONSTRAINT `prestamos_ibfk_2` FOREIGN KEY (`id_Materia`)
    REFERENCES `materias` (`id_Materia`),
  CONSTRAINT `prestamos_ibfk_3` FOREIGN KEY (`id_Estado`)
    REFERENCES `estados` (`id_Estado`),
  CONSTRAINT `prestamos_ibfk_4` FOREIGN KEY (`numeroControl`)
    REFERENCES `personas` (`numeroControl`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Materiales prestados
DROP TABLE IF EXISTS `materialesprestados`;
CREATE TABLE `materialesprestados` (
  `id_Material_Prestado` BIGINT NOT NULL,
  `id_Estado` INT UNSIGNED NOT NULL,
  `id_Prestamo` BIGINT NOT NULL,
  `id_Material` BIGINT NOT NULL,
  `cantidad` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id_Material_Prestado`),
  UNIQUE KEY `UNIQUE_MATERIALES_PRESTADOS` (`id_Material`, `id_Prestamo`),
  KEY `materialesPrestados_FKIndex1` (`id_Estado`),
  KEY `materialesPrestados_FKIndex2` (`id_Prestamo`),
  KEY `materialesPrestados_FKIndex3` (`id_Material`),
  CONSTRAINT `materialesprestados_ibfk_1` FOREIGN KEY (`id_Material`)
    REFERENCES `materiales` (`id_Material`),
  CONSTRAINT `materialesprestados_ibfk_2` FOREIGN KEY (`id_Prestamo`)
    REFERENCES `prestamos` (`id_Prestamo`),
  CONSTRAINT `materialesprestados_ibfk_3` FOREIGN KEY (`id_Estado`)
    REFERENCES `estados` (`id_Estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =========================================================
--  USUARIOS (LOGIN)
-- =========================================================

DROP TABLE IF EXISTS `usuarios`;
CREATE TABLE `usuarios` (
  `id_Estado` INT UNSIGNED NOT NULL,
  `numeroControl` INT UNSIGNED NOT NULL,
  `Clave` VARCHAR(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  UNIQUE KEY `UNIQUE_USUARIOS` (`numeroControl`),
  KEY `Usuarios_FKIndex1` (`numeroControl`),
  KEY `Usuarios_FKIndex2` (`id_Estado`),
  CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`numeroControl`)
    REFERENCES `personas` (`numeroControl`),
  CONSTRAINT `usuarios_ibfk_2` FOREIGN KEY (`id_Estado`)
    REFERENCES `estados` (`id_Estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `usuarios` (`id_Estado`, `numeroControl`, `Clave`) VALUES
  (1, 2040,     '$2y$10$rg2CuwBEoKJMGifTBkKeIulJe6.DbUOD6tk6V6wIffD3RMj1dClX6'),
  (1, 3212,     '$2y$10$oZsnO8jT3vDsZ5KzBDhPduapKR6Ibgsdbh1s6z8GOunmXSMzm1P.e'),
  (1, 22050677, '$2y$10$iqcwqMfCxg2SfVI7NhkoYOvm2c1i5KYXzQ4jl/F9RHyZrXONEMf2q'),
  (1, 22050756, '$2y$10$cEeoQcvY1qHEjIPL5IfCMO4WiWN9XwqU3teO7DTEE36Fd0a8KA6Zu'),
  (1, 22057678, '$2y$10$g/pLhZ9RgEKR6.QNZbPRPecUhr.43q6OUAxCT91in59sKdMd30TEu');


-- =========================================================
--  VISTAS
-- =========================================================

-- Vista de alumnos
DROP VIEW IF EXISTS `alumnos`;
CREATE VIEW `alumnos` AS
SELECT
  CAST(p.`numeroControl` AS CHAR CHARACTER SET utf8mb4) AS `numeroControl`,
  p.`nombre`          AS `nombre`,
  p.`apellidoPaterno` AS `apellidoPaterno`,
  p.`apellidoMaterno` AS `apellidoMaterno`,
  ca.`id_Carrera`     AS `id_Carrera`
FROM `personas` p
JOIN `roles` r
  ON r.`id_Rol` = p.`id_Rol`
 AND r.`nombre` = 'Alumno'
LEFT JOIN `carrerasalumnos` ca
  ON ca.`numeroControl` = p.`numeroControl`;

-- Vista de auxiliares
DROP VIEW IF EXISTS `auxiliares`;
CREATE VIEW `auxiliares` AS
SELECT
  CAST(p.`numeroControl` AS CHAR CHARACTER SET utf8mb4) AS `numeroTrabajador`,
  p.`nombre`          AS `nombre`,
  p.`apellidoPaterno` AS `apellidoPaterno`,
  p.`apellidoMaterno` AS `apellidoMaterno`
FROM `personas` p
JOIN `roles` r
  ON r.`id_Rol` = p.`id_Rol`
 AND r.`nombre` = 'Auxiliar';

-- Vista de docentes
DROP VIEW IF EXISTS `docentes`;
CREATE VIEW `docentes` AS
SELECT
  CAST(p.`numeroControl` AS CHAR CHARACTER SET utf8mb4) AS `numeroTrabajador`,
  p.`nombre`          AS `nombre`,
  p.`apellidoPaterno` AS `apellidoPaterno`,
  p.`apellidoMaterno` AS `apellidoMaterno`
FROM `personas` p
JOIN `roles` r
  ON r.`id_Rol` = p.`id_Rol`
 AND r.`nombre` = 'Docente';

-- Vista de materiales (inventario con clave)
DROP VIEW IF EXISTS `v_materiales`;
CREATE VIEW `v_materiales` AS
SELECT
  m.`id_Material` AS `id_Material`,
  m.`id_Estado`   AS `id_Estado`,
  m.`nombre`      AS `nombre`,
  m.`cantidad`    AS `cantidad`,
  c.`clave`       AS `clave`
FROM `materiales` m
LEFT JOIN `materialclaves` c
  ON m.`id_Material` = c.`id_Material`;

-- Restaurar checks
SET FOREIGN_KEY_CHECKS = 1;
SET UNIQUE_CHECKS = 1;
