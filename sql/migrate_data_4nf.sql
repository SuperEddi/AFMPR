-- MIGRACIÓN DE DATOS A 4NF
-- ------------------------

-- 1. Poblado de Unidades (Unificando de todas las tablas)
INSERT OR IGNORE INTO cat_unidades (nombre)
SELECT DISTINCT unidad FROM activos WHERE unidad IS NOT NULL AND unidad != ''
UNION
SELECT DISTINCT unidad FROM usuarios WHERE unidad IS NOT NULL AND unidad != ''
UNION
SELECT DISTINCT unidad FROM actas WHERE unidad IS NOT NULL AND unidad != '';

-- 2. Poblado de Pisos
INSERT OR IGNORE INTO cat_pisos (numero)
SELECT DISTINCT piso FROM activos WHERE piso IS NOT NULL AND piso != ''
UNION
SELECT DISTINCT piso FROM usuarios WHERE piso IS NOT NULL AND piso != ''
UNION
SELECT DISTINCT piso FROM actas WHERE piso IS NOT NULL AND piso != '';

-- 3. Poblado de Oficinas (Asociándolas a su unidad correspondiente)
INSERT OR IGNORE INTO cat_oficinas (nombre, unidad_id)
SELECT DISTINCT a.oficina, u.id
FROM activos a
JOIN cat_unidades u ON a.unidad = u.nombre
WHERE a.oficina IS NOT NULL AND a.oficina != '';

-- Capturar oficinas de usuarios que no tengan activos todavía
INSERT OR IGNORE INTO cat_oficinas (nombre, unidad_id)
SELECT DISTINCT us.oficina, u.id
FROM usuarios us
JOIN cat_unidades u ON us.unidad = u.nombre
WHERE us.oficina IS NOT NULL AND us.oficina != '' 
AND NOT EXISTS (SELECT 1 FROM cat_oficinas WHERE nombre = us.oficina);

-- 4. Vincular Activos con IDs
UPDATE activos SET 
    cat_unidad_id = (SELECT id FROM cat_unidades WHERE nombre = activos.unidad),
    cat_oficina_id = (SELECT id FROM cat_oficinas WHERE nombre = activos.oficina),
    cat_piso_id = (SELECT id FROM cat_pisos WHERE numero = activos.piso);

-- 5. Vincular Usuarios con su Unidad principal
UPDATE usuarios SET 
    cat_unidad_id = (SELECT id FROM cat_unidades WHERE nombre = usuarios.unidad);

-- 6. Poblar relación Usuarios-Oficinas (Relación 1:N actual, expandible a M:N)
INSERT OR IGNORE INTO usuarios_oficinas (usuario_id, oficina_id)
SELECT id, (SELECT id FROM cat_oficinas WHERE nombre = usuarios.oficina)
FROM usuarios
WHERE oficina IS NOT NULL AND oficina != '';

-- 7. Vincular Actas con IDs
UPDATE actas SET 
    cat_unidad_id = (SELECT id FROM cat_unidades WHERE nombre = actas.unidad),
    cat_oficina_id = (SELECT id FROM cat_oficinas WHERE nombre = actas.oficina),
    cat_piso_id = (SELECT id FROM cat_pisos WHERE numero = actas.piso);
