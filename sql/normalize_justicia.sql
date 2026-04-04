-- NORMALIZACIÓN JUSTICIA
-- -----------------------

-- 1. Limpieza básica
UPDATE activos SET 
    unidad = UPPER(TRIM(unidad)),
    oficina = UPPER(TRIM(oficina)),
    piso = UPPER(TRIM(piso));

-- 2. Limpieza de Pisos
UPDATE activos SET piso = '0' WHERE piso IN ('PB', 'PLANTA BAJA');
UPDATE activos SET piso = REPLACE(piso, 'PISO ', '') WHERE piso LIKE 'PISO %';
UPDATE activos SET piso = '11' WHERE piso LIKE '%CASA GRANDE%PISO 11%';
UPDATE activos SET piso = '19' WHERE piso LIKE '%CASA GRANDE%PISO 19%';
UPDATE activos SET piso = NULL WHERE piso LIKE 'MINISTERIO DE DESARROLLO PRODUCTIVO%';

-- 3. Corrección de Unidades (Typos y variaciones)
UPDATE activos SET unidad = 'DIRECCION GENERAL GESTORA SAJ-RPA' 
WHERE unidad LIKE '%GESTORA SAJ%RPA%' OR unidad LIKE 'DIRECION%GESTORA%';

-- 4. Dobles espacios
UPDATE activos SET 
    unidad = REPLACE(unidad, '  ', ' '),
    oficina = REPLACE(oficina, '  ', ' ');
