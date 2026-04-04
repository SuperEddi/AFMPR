-- Migración: Agregar tabla cat_edificios y relaciones FK
-- Ejecutar con: wrangler d1 execute <db_name> --remote --file=sql/migrate_edificios.sql

-- 1. Crear la tabla catálogo de edificios físicos
CREATE TABLE IF NOT EXISTS cat_edificios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    direccion TEXT,
    observaciones TEXT,
    registrado_por TEXT,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Agregar FK edificio_id a cat_unidades (la unidad pertenece a un edificio)
ALTER TABLE cat_unidades ADD COLUMN edificio_id INTEGER REFERENCES cat_edificios(id);

-- 3. Agregar FK cat_edificio_id a usuarios
ALTER TABLE usuarios ADD COLUMN cat_edificio_id INTEGER REFERENCES cat_edificios(id);

-- 4. Agregar FK cat_edificio_id a activos
ALTER TABLE activos ADD COLUMN cat_edificio_id INTEGER REFERENCES cat_edificios(id);

-- 5. Agregar FK cat_edificio_id a actas
ALTER TABLE actas ADD COLUMN cat_edificio_id INTEGER REFERENCES cat_edificios(id);

-- 6. Índices para búsquedas rápidas por edificio
CREATE INDEX IF NOT EXISTS idx_activos_edificio ON activos(cat_edificio_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_edificio ON usuarios(cat_edificio_id);
