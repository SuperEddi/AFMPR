-- REFINAMIENTO JUSTICIA
-- ---------------------

-- 1. Eliminar puntos finales en unidades
UPDATE activos SET unidad = SUBSTR(unidad, 1, LENGTH(unidad) - 1) WHERE unidad LIKE '%.';

-- 2. Unificar Transparencia
UPDATE activos SET unidad = 'DIRECCION GENERAL DE TRANSPARENCIA INSTITUCIONAL Y LUCHA CONTRA LA CORRUPCION' 
WHERE unidad LIKE '%DIRECCION GENERAL DE TRANSPARENCIA INSTITUCIONAL%';

-- 3. Unificar Gestora SAJ-RPA (más variaciones)
UPDATE activos SET unidad = 'DIRECCION GENERAL GESTORA SAJ-RPA' 
WHERE unidad LIKE '%GESTORA SAJ%RPA%' OR unidad LIKE '%SAJ-RPA%';

-- 4. Unificar Derechos Fundamentales
UPDATE activos SET unidad = 'UNIDAD DE PROMOCION Y PROTECCION DE DERECHOS FUNDAMENTALES' 
WHERE unidad LIKE '%DERECHOS FUNDAMENTALES%';
