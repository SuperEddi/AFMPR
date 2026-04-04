-- MIGRACIÓN PARA AGREGAR AUXILIARES Y GRUPOS CONTABLES
-- --------------------------------------------------

-- 1. Tablas de Catálogo
CREATE TABLE IF NOT EXISTS cat_auxiliares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    registrado_por TEXT,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cat_grupos_contables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    vida_util INTEGER,
    observaciones TEXT,
    registrado_por TEXT,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Agregar columnas si la tabla ya existía sin ellas
-- (Ignorar errores si ya existen)
-- SQLite no soporta ADD COLUMN IF NOT EXISTS directamente en un script simple de esta forma sin transacciones/bloques.
-- Pero lo manejaremos en la API.
ALTER TABLE cat_grupos_contables ADD COLUMN vida_util INTEGER;
ALTER TABLE cat_grupos_contables ADD COLUMN observaciones TEXT;

-- 2. Columnas en Activos
ALTER TABLE activos ADD COLUMN cat_auxiliar_id INTEGER;
ALTER TABLE activos ADD COLUMN cat_grupo_contable_id INTEGER;

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_activos_auxiliar ON activos(cat_auxiliar_id);
CREATE INDEX IF NOT EXISTS idx_activos_grupo_contable ON activos(cat_grupo_contable_id);
