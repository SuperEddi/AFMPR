-- LIMPIEZA TOTAL DE DATOS TRANSACCIONALES Y CATÁLOGOS DE UBICACIÓN (TIERRAS)

-- 1. Eliminar Historial de Actas
DELETE FROM detalles_acta;
DELETE FROM actas;

-- 2. Eliminar Auditorías
DELETE FROM auditorias_fisicas;

-- 3. Eliminar Usuarios y sus Oficinas
DELETE FROM usuarios_oficinas;
DELETE FROM usuarios;

-- 4. Eliminar Catálogos de Ubicación (en orden de dependencia)
DELETE FROM cat_oficinas;
DELETE FROM cat_unidades;
DELETE FROM cat_pisos;
DELETE FROM ubicacion_fisica;

-- 5. Resetear Activos a un estado Inicial (Disponible y sin ubicación)
UPDATE activos 
SET 
    estado_actual = 'Disponible',
    usuario_actual_id = NULL,
    ubicacion_fisica_id = NULL,
    cat_unidad_id = NULL,
    cat_oficina_id = NULL,
    cat_piso_id = NULL;

-- 6. Reiniciar Autoincrementos (Opcional, para limpieza total)
DELETE FROM sqlite_sequence WHERE name IN ('actas', 'detalles_acta', 'usuarios', 'ubicacion_fisica', 'cat_unidades', 'cat_oficinas', 'cat_pisos', 'auditorias_fisicas');
