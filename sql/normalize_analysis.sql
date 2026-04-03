-- ANÁLISIS DE VARIACIONES (Ejecutar para ver qué normalizar)
-- ---------------------------------------------------------

-- 1. Variaciones de Pisos
SELECT piso, COUNT(*) as cantidad 
FROM activos 
GROUP BY piso 
ORDER BY cantidad DESC;

-- 2. Variaciones de Unidades
SELECT unidad, COUNT(*) as cantidad 
FROM activos 
GROUP BY unidad 
ORDER BY cantidad DESC;

-- 3. Variaciones de Oficinas
SELECT oficina, COUNT(*) as cantidad 
FROM activos 
GROUP BY oficina 
ORDER BY cantidad DESC;

-- ESTRATEGIA DE "BACKUP" MANUAL (Exportar datos actuales)
-- ---------------------------------------------------------
-- Nota: Para un backup real y completo, se recomienda ejecutar:
-- npx wrangler d1 export <NOMBRE_DB> --remote > backup.sql

-- Estas consultas generan la data que puedes copiar si necesitas revertir:
-- SELECT * FROM usuarios;
-- SELECT * FROM activos;
-- SELECT * FROM actas;
