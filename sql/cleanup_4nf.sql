-- LIMPIEZA DE COLUMNAS DE TEXTO OBSOLETAS
-- --------------------------------------

-- Activos
ALTER TABLE activos DROP COLUMN unidad;
ALTER TABLE activos DROP COLUMN oficina;
ALTER TABLE activos DROP COLUMN piso;

-- Usuarios
ALTER TABLE usuarios DROP COLUMN unidad;
ALTER TABLE usuarios DROP COLUMN oficina;
ALTER TABLE usuarios DROP COLUMN piso;

-- Actas
ALTER TABLE actas DROP COLUMN unidad;
ALTER TABLE actas DROP COLUMN oficina;
ALTER TABLE actas DROP COLUMN piso;
