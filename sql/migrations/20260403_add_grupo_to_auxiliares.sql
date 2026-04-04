-- Migración: Relación Auxiliares -> Grupos Contables
-- Fecha: 2026-04-03

-- 1. Añadir la columna de relación a cat_auxiliares
ALTER TABLE cat_auxiliares ADD COLUMN cat_grupo_contable_id INTEGER REFERENCES cat_grupos_contables(id);

-- 2. (Opcional - Inteligencia de Datos) 
-- Si ya tenemos activos con auxiliar X y grupo Y, podríamos auto-poblar la relación en cat_auxiliares
-- Pero mejor dejarlo para que el usuario lo asigne manualmente o vía script posterior.
