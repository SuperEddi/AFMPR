-- SCRIPT DE LIMPIEZA DE DUPLICADOS Y APLICACIÓN DE UNICIDAD
-- Este script fusiona activos con el mismo código, manteniendo la historia de asignación y auditoría.

-- 1. Crear tabla temporal con el ID "Ganador" por cada código duplicado
DROP TABLE IF EXISTS tmp_ganadores;
CREATE TABLE tmp_ganadores AS
SELECT codigo_activo, MIN(id) as master_id
FROM activos
GROUP BY codigo_activo;

-- Priorizar el que esté "Asignado" como el maestro
UPDATE tmp_ganadores
SET master_id = (
    SELECT id FROM activos a 
    WHERE a.codigo_activo = tmp_ganadores.codigo_activo 
    AND a.estado_actual = 'Asignado' 
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 FROM activos a 
    WHERE a.codigo_activo = tmp_ganadores.codigo_activo 
    AND a.estado_actual = 'Asignado'
);

-- 2. Redirigir el Historial (detalles_acta) al ID maestro
UPDATE detalles_acta
SET activo_id = (
    SELECT master_id 
    FROM tmp_ganadores tg 
    JOIN activos a ON tg.codigo_activo = a.codigo_activo 
    WHERE a.id = detalles_acta.activo_id
)
WHERE activo_id IN (
    SELECT a.id 
    FROM activos a 
    JOIN tmp_ganadores tg ON a.codigo_activo = tg.codigo_activo 
    WHERE a.id != tg.master_id
);

-- 3. Redirigir las Auditorías al ID maestro
UPDATE auditorias_fisicas
SET activo_id = (
    SELECT master_id 
    FROM tmp_ganadores tg 
    JOIN activos a ON tg.codigo_activo = a.codigo_activo 
    WHERE a.id = auditorias_fisicas.activo_id
)
WHERE activo_id IN (
    SELECT a.id 
    FROM activos a 
    JOIN tmp_ganadores tg ON a.codigo_activo = tg.codigo_activo 
    WHERE a.id != tg.master_id
);

-- 4. Eliminar los activos duplicados (que no son maestros)
DELETE FROM activos
WHERE id NOT IN (SELECT master_id FROM tmp_ganadores);

-- 5. Eliminar tabla temporal
DROP TABLE tmp_ganadores;

-- 6. Forzar Unicidad: Crear índice único en codigo_activo
-- Esto previene que se vuelvan a crear duplicados en el futuro.
CREATE UNIQUE INDEX IF NOT EXISTS idx_activos_codigo_unique ON activos(codigo_activo);

-- Mensaje de éxito (Opcional para logs)
-- SELECT 'Limpieza completada exitosamente' as resultado;
