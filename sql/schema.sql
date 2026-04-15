-- Esquema FINAL del Sistema de Control de Activos (Estructura 4NF)
-- Este archivo refleja la estructura TARGET después de ejecutar:
-- 1. setup_4nf.sql  → Crea tablas cat_ y columnas temporales
-- 2. migrate_data_4nf.sql → Puebla catálogos y actualiza FKs
-- 3. cleanup_4nf.sql → Elimina columnas de texto obsoletas

-- ─── CATÁLOGOS DE UBICACIÓN ─────────────────────────────────

-- Nivel 0: Ubicación física ("Casa Grande del Pueblo", "Ed. Ex Ministerio de Justicia")
CREATE TABLE IF NOT EXISTS ubicacion_fisica (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    direccion TEXT,
    observaciones TEXT,
    registrado_por TEXT,
    activo INTEGER DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Nivel 1: Unidad/Departamento (pertenece a una ubicación física)
CREATE TABLE IF NOT EXISTS cat_unidades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    ubicacion_fisica_id INTEGER,
    activo INTEGER DEFAULT 1,
    FOREIGN KEY (ubicacion_fisica_id) REFERENCES ubicacion_fisica(id)
);

CREATE TABLE IF NOT EXISTS cat_oficinas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    unidad_id INTEGER,
    activo INTEGER DEFAULT 1,
    FOREIGN KEY (unidad_id) REFERENCES cat_unidades(id)
);

CREATE TABLE IF NOT EXISTS cat_pisos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT NOT NULL UNIQUE,
    activo INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS cat_auxiliares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    cat_grupo_contable_id INTEGER,
    registrado_por TEXT,
    activo INTEGER DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cat_grupo_contable_id) REFERENCES cat_grupos_contables(id)
);

CREATE TABLE IF NOT EXISTS cat_grupos_contables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    vida_util INTEGER,
    observaciones TEXT,
    registrado_por TEXT,
    activo INTEGER DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─── TABLAS PRINCIPALES ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_completo TEXT NOT NULL,
    ci TEXT NOT NULL UNIQUE,
    cargo TEXT,
    cat_unidad_id INTEGER,
    ubicacion_fisica_id INTEGER,
    registrado_por TEXT,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cat_unidad_id) REFERENCES cat_unidades(id),
    FOREIGN KEY (ubicacion_fisica_id) REFERENCES ubicacion_fisica(id)
);

-- Relación M:N entre usuarios y oficinas
CREATE TABLE IF NOT EXISTS usuarios_oficinas (
    usuario_id INTEGER NOT NULL,
    oficina_id INTEGER NOT NULL,
    PRIMARY KEY (usuario_id, oficina_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (oficina_id) REFERENCES cat_oficinas(id)
);

CREATE TABLE IF NOT EXISTS activos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_activo TEXT NOT NULL UNIQUE,
    descripcion TEXT NOT NULL,
    serie TEXT,
    estado_actual TEXT CHECK(estado_actual IN ('Disponible', 'Asignado', 'Mantenimiento')) DEFAULT 'Disponible',
    usuario_actual_id INTEGER,
    ubicacion_fisica_id INTEGER,
    cat_unidad_id INTEGER,
    cat_oficina_id INTEGER,
    cat_piso_id INTEGER,
    cat_auxiliar_id INTEGER,
    cat_grupo_contable_id INTEGER,
    registrado_por TEXT,
    FOREIGN KEY (usuario_actual_id) REFERENCES usuarios(id),
    FOREIGN KEY (ubicacion_fisica_id) REFERENCES ubicacion_fisica(id),
    FOREIGN KEY (cat_unidad_id) REFERENCES cat_unidades(id),
    FOREIGN KEY (cat_oficina_id) REFERENCES cat_oficinas(id),
    FOREIGN KEY (cat_piso_id) REFERENCES cat_pisos(id),
    FOREIGN KEY (cat_auxiliar_id) REFERENCES cat_auxiliares(id),
    FOREIGN KEY (cat_grupo_contable_id) REFERENCES cat_grupos_contables(id)
);

CREATE TABLE IF NOT EXISTS actas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_acta TEXT CHECK(tipo_acta IN ('Asignación', 'Devolución')) NOT NULL,
    usuario_id INTEGER NOT NULL,
    fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT,
    ubicacion_fisica_id INTEGER,
    cat_unidad_id INTEGER,
    cat_oficina_id INTEGER,
    cat_piso_id INTEGER,
    realizado_por TEXT,
    archivo_pdf_url TEXT,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (ubicacion_fisica_id) REFERENCES ubicacion_fisica(id),
    FOREIGN KEY (cat_unidad_id) REFERENCES cat_unidades(id),
    FOREIGN KEY (cat_oficina_id) REFERENCES cat_oficinas(id),
    FOREIGN KEY (cat_piso_id) REFERENCES cat_pisos(id)
);

CREATE TABLE IF NOT EXISTS detalles_acta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    acta_id INTEGER NOT NULL,
    activo_id INTEGER NOT NULL,
    estado_fisico TEXT CHECK(estado_fisico IN ('Bueno', 'Regular', 'Malo')) DEFAULT 'Bueno',
    FOREIGN KEY (acta_id) REFERENCES actas(id),
    FOREIGN KEY (activo_id) REFERENCES activos(id)
);

CREATE TABLE IF NOT EXISTS auditorias_fisicas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_auditado_id INTEGER NOT NULL,
    activo_id INTEGER NOT NULL,
    hallazgo TEXT CHECK(hallazgo IN ('Correcto', 'Sobrante', 'Ajeno')) NOT NULL,
    realizado_por TEXT,
    observacion TEXT,
    fecha_auditoria DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_auditado_id) REFERENCES usuarios(id),
    FOREIGN KEY (activo_id) REFERENCES activos(id)
);

CREATE TABLE IF NOT EXISTS system_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    rol TEXT CHECK(rol IN ('admin', 'tecnico')) DEFAULT 'tecnico',
    activo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ─── ÍNDICES ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_usuarios_ci ON usuarios(ci);
CREATE INDEX IF NOT EXISTS idx_activos_codigo ON activos(codigo_activo);
CREATE INDEX IF NOT EXISTS idx_activos_estado ON activos(estado_actual);
CREATE INDEX IF NOT EXISTS idx_activos_oficina ON activos(cat_oficina_id);
CREATE INDEX IF NOT EXISTS idx_activos_ubicacion ON activos(ubicacion_fisica_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_ubicacion ON usuarios(ubicacion_fisica_id);
