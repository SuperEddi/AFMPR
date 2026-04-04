-- REFINAMIENTO TIERRAS
-- --------------------

-- 1. Unificar Despacho con/sin tilde
UPDATE activos SET unidad = 'DESPACHO DE VICEMINISTRO' 
WHERE unidad LIKE 'DESPACH%VICEMINISTRO%';

-- 2. Unificar Oficina
UPDATE activos SET oficina = 'DESPACHO DE VICEMINISTRO' 
WHERE oficina LIKE 'DESPACH%VICEMINISTRO%';
