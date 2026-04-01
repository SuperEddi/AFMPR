-- Script to ensure all databases have the latest schema

-- Add missing columns to 'actas'
ALTER TABLE actas ADD COLUMN unidad TEXT;
ALTER TABLE actas ADD COLUMN oficina TEXT;
ALTER TABLE actas ADD COLUMN piso TEXT;

-- Add missing columns to 'activos' (in case they are missing in some DBs)
-- Note: SQLite doesn't have 'IF NOT EXISTS' for columns, 
-- but running these won't hurt if we catch errors, 
-- or we can assume they might be missing since update_tierras exists.

-- Actually, for D1, it's better to just provide the ones we KNOW are missing.
-- From my analysis, the 'actas' columns are the primary cause of the 500 error.

-- Optional: Ensure 'activos' also has the location columns in all DBs
-- ALTER TABLE activos ADD COLUMN unidad TEXT;
-- ALTER TABLE activos ADD COLUMN oficina TEXT;
-- ALTER TABLE activos ADD COLUMN piso TEXT;
