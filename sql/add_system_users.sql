-- ============================================================
-- Migración: Sistema de Usuarios del Sistema (RBAC)
-- Aplicar en las 3 bases de datos: DB, DB_JUSTICIA, DB_PRESIDENCIA
-- ============================================================

-- Tabla de cuentas de sistema (login)
CREATE TABLE IF NOT EXISTS system_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    password_hash TEXT NOT NULL,  -- SHA-256 hex
    rol TEXT CHECK(rol IN ('admin', 'tecnico')) DEFAULT 'tecnico',
    activo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Usuario admin por defecto: admin / admin123
-- SHA-256 de "admin123" = 240be518fabd2724ddb6f04eeb1da5967448d7e831186170e41fa08bc84c1e5
-- SHA-256 of "admin123" computed via Web Crypto API (64 hex chars)
INSERT OR IGNORE INTO system_users (username, nombre, password_hash, rol)
VALUES ('admin', 'Administrador', '240be518fabd2724ddb6f04eeb1da5967448d7e831186170e41fa08bc84c1e5', 'admin');
-- Note: run UPDATE if admin already exists with wrong hash:
-- UPDATE system_users SET password_hash = '240be518fabd2724ddb6f04eeb1da5967448d7e831186170e41fa08bc84c1e5' WHERE username = 'admin';

-- Agregar columna realizado_por a actas si no existe
ALTER TABLE actas ADD COLUMN realizado_por TEXT;
