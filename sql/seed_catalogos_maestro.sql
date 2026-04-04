-- ============================================================
-- CATÁLOGOS MAESTROS - GESTIÓN DE ACTIVOS FIJOS
-- Aplicar en TODAS las bases de datos institucionales
-- Versión: 2026-04-03
-- ============================================================

-- PASO 1: Limpiar tablas existentes (borramos en orden para no violar FK)
DELETE FROM cat_auxiliares;
DELETE FROM cat_grupos_contables;

-- PASO 2: Poblar Grupos Contables (catálogo estándar boliviano de activos fijos)
INSERT INTO cat_grupos_contables (id, nombre, vida_util, observaciones) VALUES
(1,  'MUEBLES Y ENSERES DE OFICINA',          10, 'Escritorios, sillas, estantes, archivadores'),
(2,  'EQUIPOS DE COMPUTACION',                 5, 'Computadoras, laptops, impresoras, monitores'),
(3,  'EQUIPOS DE COMUNICACION',               10, 'Teléfonos, radios, centrales telefónicas'),
(4,  'EQUIPOS DE OFICINA',                    10, 'Fotocopiadoras, fax, calculadoras, scanners'),
(5,  'VEHICULOS Y EQUIPO DE TRANSPORTE',      10, 'Vehículos, motocicletas'),
(6,  'EQUIPOS DE AUDIOVISUALES',              10, 'Proyectores, televisores, cámaras'),
(7,  'MAQUINARIA Y EQUIPO',                   10, 'Maquinaria en general'),
(8,  'BIENES INMUEBLES',                      50, 'Edificios, terrenos'),
(9,  'EQUIPOS DE LABORATORIO',                10, 'Instrumentos científicos'),
(10, 'OTROS ACTIVOS FIJOS',                   5,  'Activos que no clasifican en otros grupos');

-- PASO 3: Poblar Auxiliares (cuenta contable específica) con su grupo correspondiente
INSERT INTO cat_auxiliares (id, nombre, cat_grupo_contable_id) VALUES
-- Muebles y Enseres (grupo 1)
(1,  'ESCRITORIO',                       1),
(2,  'SILLA',                            1),
(3,  'SILLON EJECUTIVO',                 1),
(4,  'SILLA GIRATORIA',                  1),
(5,  'ESTANTE',                          1),
(6,  'CREDENZA',                         1),
(7,  'GAVETERO',                         1),
(8,  'ARCHIVADOR',                       1),
(9,  'MESA DE REUNION',                  1),
(10, 'MESA DE COMPUTADORA',              1),
(11, 'SOFA',                             1),
(12, 'SILLON DE LIVING',                 1),
(13, 'PIZARRA',                          1),
(14, 'PERCHERO',                         1),
(15, 'ESTACION DE TRABAJO',              1),
(16, 'MUEBLE',                           1),
(17, 'MESA',                             1),

-- Equipos de Computación (grupo 2)
(18, 'COMPUTADORA DE ESCRITORIO (CPU)',   2),
(19, 'MONITOR',                          2),
(20, 'TECLADO',                          2),
(21, 'MOUSE',                            2),
(22, 'IMPRESORA',                        2),
(23, 'LAPTOP / PORTATIL',                2),
(24, 'SCANNER',                          2),
(25, 'DISCO DURO EXTERNO',               2),
(26, 'PARLANTES',                        2),
(27, 'SWITCH / HUB',                     2),
(28, 'UPS',                              2),

-- Equipos de Comunicación (grupo 3)
(29, 'TELEFONO',                         3),
(30, 'CENTRAL TELEFONICA',               3),
(31, 'RADIO COMUNICADOR',                3),
(32, 'APARATO FAX',                      3),

-- Equipos de Oficina (grupo 4)
(33, 'FOTOCOPIADORA',                    4),
(34, 'CALCULADORA',                      4),
(35, 'ANILLADORA',                       4),
(36, 'GUILLOTINA',                       4),
(37, 'RELOJ CONTROL',                    4),
(38, 'MAQUINA DE ESCRIBIR',              4),

-- Vehículos (grupo 5)
(39, 'AUTOMOVIL',                        5),
(40, 'CAMIONETA / VAGONETA',             5),
(41, 'MOTOCICLETA',                      5),
(42, 'BUS / MINIBUS',                    5),

-- Audiovisuales (grupo 6)
(43, 'PROYECTOR / CAÑON',                6),
(44, 'TELEVISION',                       6),
(45, 'CAMARA FOTOGRAFICA',               6),
(46, 'CAMARA FILMADORA',                 6),
(47, 'TRIPODE',                          6),

-- Maquinaria (grupo 7)
(48, 'ASPIRADORA',                       7),
(49, 'ESTUFA / CALEFACTOR',              7),
(50, 'AIRE ACONDICIONADO',               7),

-- Inmuebles (grupo 8)
(51, 'EDIFICIO / INMUEBLE',              8),
(52, 'TERRENO',                          8),

-- Otros (grupo 10)
(53, 'ESTANDARTE',                       10),
(54, 'PERSIANA',                         10),
(55, 'OTROS',                            10);
