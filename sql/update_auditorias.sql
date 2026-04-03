-- Script para actualizar la tabla de auditorías con nuevos campos
-- Ejecutar en todas las bases de datos (Tierras, Justicia, Presidencia)

ALTER TABLE auditorias_fisicas ADD COLUMN realizado_por TEXT;
ALTER TABLE auditorias_fisicas ADD COLUMN observacion TEXT;
