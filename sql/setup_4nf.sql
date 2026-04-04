-- ESTRUCTURA 4NF PARA UBICACIONES
-- ------------------------------

-- 1. Tablas de Catálogo
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

-- 2. Tabla Intermedia Usuarios-Oficinas (Relación M:N)
CREATE TABLE IF NOT EXISTS usuarios_oficinas (
    usuario_id INTEGER NOT NULL,
    oficina_id INTEGER NOT NULL,
    PRIMARY KEY (usuario_id, oficina_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (oficina_id) REFERENCES cat_oficinas(id)
);

-- 3. Columnas de Referencia Temporales (Para migración)
-- Activos
ALTER TABLE activos ADD COLUMN cat_unidad_id INTEGER;
ALTER TABLE activos ADD COLUMN cat_oficina_id INTEGER;
ALTER TABLE activos ADD COLUMN cat_piso_id INTEGER;

-- Usuarios (Para unidad principal)
ALTER TABLE usuarios ADD COLUMN cat_unidad_id INTEGER;

-- Actas
ALTER TABLE actas ADD COLUMN cat_unidad_id INTEGER;
ALTER TABLE actas ADD COLUMN cat_oficina_id INTEGER;
ALTER TABLE actas ADD COLUMN cat_piso_id INTEGER;
