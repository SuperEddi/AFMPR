-- Migración para añadir campos de ubicación a la tabla de activos existente
ALTER TABLE activos ADD COLUMN unidad TEXT;
ALTER TABLE activos ADD COLUMN oficina TEXT;
ALTER TABLE activos ADD COLUMN piso TEXT;
