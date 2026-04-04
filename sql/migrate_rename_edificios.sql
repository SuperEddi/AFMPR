-- Migración: Renombrar cat_edificios → ubicacion_fisica
-- y las columnas edificio_id / cat_edificio_id → ubicacion_fisica_id

-- 1. Renombrar la tabla
ALTER TABLE cat_edificios RENAME TO ubicacion_fisica;

-- 2. Renombrar columna en cat_unidades
ALTER TABLE cat_unidades RENAME COLUMN edificio_id TO ubicacion_fisica_id;

-- 3. Renombrar columna en usuarios
ALTER TABLE usuarios RENAME COLUMN cat_edificio_id TO ubicacion_fisica_id;

-- 4. Renombrar columna en activos
ALTER TABLE activos RENAME COLUMN cat_edificio_id TO ubicacion_fisica_id;

-- 5. Renombrar columna en actas
ALTER TABLE actas RENAME COLUMN cat_edificio_id TO ubicacion_fisica_id;

-- 6. Recrear índices con nombres actualizados
DROP INDEX IF EXISTS idx_activos_edificio;
DROP INDEX IF EXISTS idx_usuarios_edificio;
CREATE INDEX IF NOT EXISTS idx_activos_ubicacion ON activos(ubicacion_fisica_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_ubicacion ON usuarios(ubicacion_fisica_id);
