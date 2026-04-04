-- NORMALIZACIÓN PRESIDENCIA
-- --------------------------

-- 1. Limpieza básica
UPDATE activos SET 
    unidad = UPPER(TRIM(unidad)),
    oficina = UPPER(TRIM(oficina)),
    piso = UPPER(TRIM(piso));

-- 2. Dobles espacios
UPDATE activos SET 
    unidad = REPLACE(unidad, '  ', ' '),
    oficina = REPLACE(oficina, '  ', ' ');
