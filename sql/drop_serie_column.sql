-- SCRIPT PARA ELIMINAR LA COLUMNA 'serie' DE LA TABLA 'activos'
-- Ejecutar en todas las instituciones.

ALTER TABLE activos DROP COLUMN serie;
