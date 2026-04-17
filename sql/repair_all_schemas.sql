-- REPARACIÓN ACUMULATIVA DE ESQUEMAS (TODAS LAS INSTITUCIONES)
-- Agregamos las columnas necesarias para que el módulo Historial no falle (HTTP 500)

-- 1. Columnas en tabla 'activos'
-- Intentamos agregar cada una. Si ya existen, D1 simplemente dará un aviso o se puede ignorar.
ALTER TABLE activos ADD COLUMN cat_auxiliar_id INTEGER;
ALTER TABLE activos ADD COLUMN cat_grupo_contable_id INTEGER;
ALTER TABLE activos ADD COLUMN cat_piso_id INTEGER;

-- 2. Asegurar que las tablas de catálogos existan (si se hicieron normalizaciones parciales antes)
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
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
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

-- 3. Columnas en tabla 'actas' (Para compatibilidad con reportes)
ALTER TABLE actas ADD COLUMN cat_piso_id INTEGER;
ALTER TABLE actas ADD COLUMN cat_unidad_id INTEGER;
ALTER TABLE actas ADD COLUMN cat_oficina_id INTEGER;
ALTER TABLE actas ADD COLUMN ubicacion_fisica_id INTEGER;
