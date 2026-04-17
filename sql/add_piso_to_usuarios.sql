-- Migración: Agregar columnas faltantes a tabla 'usuarios'
-- Ejecutar en TODAS las bases de datos (Tierras, Justicia, Presidencia, Culturas, Vicepresidencia)
-- SQLite ignora silenciosamente las columnas ya existentes con ADD COLUMN IF NOT EXISTS
-- Para D1 de Cloudflare: ejecutar y si lanza error "duplicate column" es seguro ignorarlo.

-- Columnas de ubicación del funcionario
ALTER TABLE usuarios ADD COLUMN ubicacion_fisica_id INTEGER REFERENCES ubicacion_fisica(id);
ALTER TABLE usuarios ADD COLUMN cat_piso_id INTEGER REFERENCES cat_pisos(id);
