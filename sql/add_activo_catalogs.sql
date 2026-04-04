-- Migración para añadir columna 'activo' a tablas de catálogos
ALTER TABLE ubicacion_fisica ADD COLUMN activo INTEGER DEFAULT 1;
ALTER TABLE cat_unidades ADD COLUMN activo INTEGER DEFAULT 1;
ALTER TABLE cat_oficinas ADD COLUMN activo INTEGER DEFAULT 1;
ALTER TABLE cat_pisos ADD COLUMN activo INTEGER DEFAULT 1;
ALTER TABLE cat_auxiliares ADD COLUMN activo INTEGER DEFAULT 1;
ALTER TABLE cat_grupos_contables ADD COLUMN activo INTEGER DEFAULT 1;
