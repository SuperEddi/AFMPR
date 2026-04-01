-- Esquema para Sistema de Control de Actas de Asignación y Devolución

-- Tabla de Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_completo TEXT NOT NULL,
    ci TEXT NOT NULL UNIQUE, -- Cédula de Identidad
    cargo TEXT,
    unidad TEXT,
    oficina TEXT,
    piso TEXT,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Activos
CREATE TABLE IF NOT EXISTS activos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_activo TEXT NOT NULL UNIQUE,
    descripcion TEXT NOT NULL,
    serie TEXT,
    estado_actual TEXT CHECK(estado_actual IN ('Disponible', 'Asignado', 'Mantenimiento')) DEFAULT 'Disponible',
    usuario_actual_id INTEGER, -- ID del usuario que tiene el activo actualmente
    unidad TEXT,               -- Ubicación actual del activo (Unidad)
    oficina TEXT,              -- Ubicación actual del activo (Oficina)
    piso TEXT,                 -- Ubicación actual del activo (Piso)
    FOREIGN KEY (usuario_actual_id) REFERENCES usuarios(id)
);

-- Tabla de Actas (Resumen)
CREATE TABLE IF NOT EXISTS actas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_acta TEXT CHECK(tipo_acta IN ('Asignación', 'Devolución')) NOT NULL,
    usuario_id INTEGER NOT NULL,
    fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT,
    unidad TEXT,
    oficina TEXT,
    piso TEXT,
    archivo_pdf_url TEXT,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Tabla de Detalles de Acta (Relación n:m entre Actas y Activos)
CREATE TABLE IF NOT EXISTS detalles_acta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    acta_id INTEGER NOT NULL,
    activo_id INTEGER NOT NULL,
    estado_fisico TEXT CHECK(estado_fisico IN ('Bueno', 'Regular', 'Malo')) DEFAULT 'Bueno',
    FOREIGN KEY (acta_id) REFERENCES actas(id),
    FOREIGN KEY (activo_id) REFERENCES activos(id)
);

-- Tabla de Auditorías Físicas (Control de Activos)
CREATE TABLE IF NOT EXISTS auditorias_fisicas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_auditado_id INTEGER NOT NULL,
    activo_id INTEGER NOT NULL,
    hallazgo TEXT CHECK(hallazgo IN ('Correcto', 'Sobrante', 'Ajeno')) NOT NULL,
    fecha_auditoria DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_auditado_id) REFERENCES usuarios(id),
    FOREIGN KEY (activo_id) REFERENCES activos(id)
);

-- Índices para mejorar busquedas por CI y Código de Activo
CREATE INDEX IF NOT EXISTS idx_usuarios_ci ON usuarios(ci);
CREATE INDEX IF NOT EXISTS idx_activos_codigo ON activos(codigo_activo);
