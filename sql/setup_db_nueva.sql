-- SCRIPT PARA BASE DE DATOS NUEVA (ya creada con schema.sql 4NF)
-- ----------------------------------------------------------------
-- Ejecutar este script si la DB fue creada directamente con el
-- nuevo schema.sql y NO tiene las columnas de texto antiguas.
-- 
-- Crea las tablas de catálogo y relaciones M:N si no existen.
-- Es SEGURO ejecutar múltiples veces (IF NOT EXISTS).

-- Tablas del catálogo de ubicaciones
CREATE TABLE IF NOT EXISTS cat_unidades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS cat_oficinas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    unidad_id INTEGER,
    FOREIGN KEY (unidad_id) REFERENCES cat_unidades(id)
);

CREATE TABLE IF NOT EXISTS cat_pisos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT NOT NULL UNIQUE
);

-- Relación M:N usuarios-oficinas
CREATE TABLE IF NOT EXISTS usuarios_oficinas (
    usuario_id INTEGER NOT NULL,
    oficina_id INTEGER NOT NULL,
    PRIMARY KEY (usuario_id, oficina_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (oficina_id) REFERENCES cat_oficinas(id)
);

-- Columnas FK en activos (ADD COLUMN es idempotente en D1 si ya existe → ignorar error)
ALTER TABLE activos ADD COLUMN cat_unidad_id INTEGER;
ALTER TABLE activos ADD COLUMN cat_oficina_id INTEGER;
ALTER TABLE activos ADD COLUMN cat_piso_id INTEGER;

-- Columna FK en usuarios
ALTER TABLE usuarios ADD COLUMN cat_unidad_id INTEGER;

-- Columnas FK en actas
ALTER TABLE actas ADD COLUMN cat_unidad_id INTEGER;
ALTER TABLE actas ADD COLUMN cat_oficina_id INTEGER;
ALTER TABLE actas ADD COLUMN cat_piso_id INTEGER;

-- registrado_por en activos y usuarios (si no existe)
ALTER TABLE activos ADD COLUMN registrado_por TEXT;
ALTER TABLE usuarios ADD COLUMN registrado_por TEXT;

-- system_users (si no existe)
CREATE TABLE IF NOT EXISTS system_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    rol TEXT CHECK(rol IN ('admin', 'tecnico')) DEFAULT 'tecnico',
    activo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_usuarios_ci ON usuarios(ci);
CREATE INDEX IF NOT EXISTS idx_activos_codigo ON activos(codigo_activo);
CREATE INDEX IF NOT EXISTS idx_activos_estado ON activos(estado_actual);
CREATE INDEX IF NOT EXISTS idx_activos_oficina ON activos(cat_oficina_id);
