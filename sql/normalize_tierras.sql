-- NORMALIZACIÓN TIERRAS
-- ---------------------

-- 1. Limpieza básica
UPDATE activos SET 
    unidad = UPPER(TRIM(unidad)),
    oficina = UPPER(TRIM(oficina)),
    piso = UPPER(TRIM(piso));

-- 2. Unificación de unidades (Basado en análisis)
UPDATE activos SET unidad = 'DESPACHO DE VICEMINISTRO' 
WHERE unidad LIKE 'DESPACHO%VICEMINISTRO%';

-- 3. Unificación de oficinas
UPDATE activos SET oficina = 'DESPACHO DE VICEMINISTRO' 
WHERE oficina LIKE 'DESPACHO%VICEMINISTRO%';

-- 4. Otros ajustes técnicos
UPDATE activos SET 
    unidad = REPLACE(unidad, '  ', ' '),
    oficina = REPLACE(oficina, '  ', ' ');
