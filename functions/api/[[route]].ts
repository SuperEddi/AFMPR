/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';

type Bindings = {
    DB: D1Database;          // Default (Tierras)
    DB_JUSTICIA: D1Database; // Ministerio de Justicia
    DB_PRESIDENCIA: D1Database; // Presidencia
    ADMIN_PASSWORD: string;   // Contraseña global
    CACHE: KVNamespace;       // KV Cache para CONSOLIDADO
};

const app = new Hono<{ Bindings: Bindings }>().basePath('/api');

// ─── MIDDLEWARES Y CONFIGURACIÓN ─────────────────────────────────────────────

// Helper principal para obtener la DB correcta
const getDB = (c: any): D1Database => {
    // Si viene un target específico (por header), lo priorizamos (para CONSOLIDADO)
    const target = c.req.header('x-target-institution');
    if (target) {
        const t = target.toLowerCase();
        if (t === 'justicia') return c.env.DB_JUSTICIA;
        if (t === 'presidencia') return c.env.DB_PRESIDENCIA;
        return c.env.DB;
    }
    // Si no, usamos la DB asignada al contexto por el middleware de institución
    return (c as any).db || c.env.DB;
};

// 1. Middleware CORS
app.use('*', async (c, next) => {
    if (c.req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, x-institution, x-target-institution, x-admin-password',
            },
        });
    }
    await next();
    c.res.headers.set('Access-Control-Allow-Origin', '*');
});

// 2. Middleware de Selección de DB (por defecto)
app.use('*', async (c, next) => {
    const institution = (c.req.header('x-institution') || 'tierras').toLowerCase();

    if (institution === 'justicia') {
        (c as any).db = c.env.DB_JUSTICIA;
    } else if (institution === 'presidencia') {
        (c as any).db = c.env.DB_PRESIDENCIA;
    } else {
        (c as any).db = c.env.DB;
    }
    await next();
});

// 3. Middleware de Seguridad (Admin Password)
app.use('*', async (c, next) => {
    const method = c.req.method;
    const path = c.req.path;
    const sensitivePaths = ['/migrate'];
    const isSensitive = sensitivePaths.some(p => path.includes(p)) ||
        (method === 'PUT' && !path.includes('/detalles_acta/estado') && !path.includes('/liberar')) ||
        method === 'DELETE';

    if (isSensitive) {
        const providedPassword = c.req.header('x-admin-password');
        if (providedPassword !== c.env.ADMIN_PASSWORD) {
            return c.json({ error: 'Autorización administrativa requerida.' }, 401);
        }
    }
    await next();
});

// 4. Helper para diagnóstico de vinculación
app.use('*', async (c, next) => {
    if (!getDB(c)) {
        return c.json({ error: "Configuración de Base de Datos (DB) no encontrada." }, 500);
    }
    await next();
});

// 5. Manejador de errores global SEGURO
app.onError((err, c) => {
    console.error(`[API ERROR] ${err.message}`, err.stack);
    return c.json({
        error: "Error Interno del Servidor",
        message: "Ocurrió un problema inesperado al procesar la solicitud."
    }, 500);
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const formatError = (err: any) => {
    const msg = err.message || '';
    // Errores conocidos y seguros
    if (msg.includes('UNIQUE constraint failed: usuarios.ci')) return 'El CI ya está registrado para otro funcionario.';
    if (msg.includes('UNIQUE constraint failed: activos.codigo_activo')) return 'El código de activo ya existe en el sistema.';
    if (msg.includes('FOREIGN KEY constraint failed')) return 'No se puede eliminar o modificar porque este registro está siendo usado.';
    if (msg.includes('D1_TYPE_ERROR')) return 'Error en el formato de los datos enviados.';

    // Si no es un error conocido, devolvemos un mensaje genérico para seguridad
    return 'Ocurrió un error inesperado al procesar la solicitud.';
};

// KV Cache Helper
async function kvCache<T>(
    kv: KVNamespace | undefined,
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds = 60
): Promise<T> {
    if (!kv) return fetchFn();
    try {
        const cached = await kv.get(key, 'json');
        if (cached !== null) return cached as T;
    } catch { }
    const fresh = await fetchFn();
    try {
        await kv.put(key, JSON.stringify(fresh), { expirationTtl: ttlSeconds });
    } catch { }
    return fresh;
}

// Invalidator de Caché
async function invalidateConsolidadoCache(kv: KVNamespace | undefined) {
    if (!kv) return;
    try {
        await Promise.all([
            kv.delete('consolidado:stats'),
            kv.delete('consolidado:activos'),
            kv.delete('consolidado:activos:Asignado'),
            kv.delete('consolidado:activos:Disponible'),
            kv.delete('consolidado:activos:Sobrante'),
            kv.delete('consolidado:usuarios'),
        ]);
    } catch { }
}

// ─── ENDPOINTS ───────────────────────────────────────────────────────────────

// --- ESTADISTICAS ---
app.get('/stats', async (c) => {
    try {
        const institution = c.req.header('x-institution') || 'tierras';

        const fetchDBStats = async (db: D1Database) => {
            const s = await db.prepare(`
                SELECT 
                    COUNT(*) as total,
                    COALESCE(SUM(CASE WHEN estado_actual = 'Asignado' THEN 1 ELSE 0 END), 0) as asignados,
                    COALESCE(SUM(CASE WHEN estado_actual = 'Disponible' THEN 1 ELSE 0 END), 0) as disponibles,
                    COALESCE(SUM(CASE WHEN estado_actual = 'Sobrante' THEN 1 ELSE 0 END), 0) as sobrantes
                FROM activos
            `).first();
            return s || { total: 0, asignados: 0, disponibles: 0, sobrantes: 0 };
        };

        if (institution === 'consolidado') {
            const merged = await kvCache(c.env.CACHE, 'consolidado:stats', async () => {
                const [s1, s2, s3] = await Promise.all([
                    fetchDBStats(c.env.DB),
                    fetchDBStats(c.env.DB_JUSTICIA),
                    fetchDBStats(c.env.DB_PRESIDENCIA)
                ]);
                return {
                    total: Number(s1.total) + Number(s2.total) + Number(s3.total),
                    asignados: Number(s1.asignados) + Number(s2.asignados) + Number(s3.asignados),
                    disponibles: Number(s1.disponibles) + Number(s2.disponibles) + Number(s3.disponibles),
                    sobrantes: Number(s1.sobrantes) + Number(s2.sobrantes) + Number(s3.sobrantes),
                    institucion: 'CONSOLIDADO'
                };
            }, 30); // TTL 30s para stats
            return c.json(merged);
        }

        const stats = await fetchDBStats(getDB(c));
        return c.json({ ...stats, institucion: institution.toUpperCase() });
    } catch (e: any) {
        console.error("Error en query /stats:", e.message);
        return c.json({ error: formatError(e) }, 500);
    }
});

// --- USUARIOS ---

// --- USUARIOS ---

app.get('/usuarios', async (c) => {
    const institution = c.req.header('x-institution') || 'tierras';

    const fetchDBUsuarios = async (db: D1Database, instName: string) => {
        const { results } = await db.prepare('SELECT * FROM usuarios ORDER BY nombre_completo ASC').all();
        return results.map(r => ({ ...r, institucion: instName }));
    };

    if (institution === 'consolidado') {
        const result = await kvCache(c.env.CACHE, 'consolidado:usuarios', async () => {
            const [r1, r2, r3] = await Promise.all([
                fetchDBUsuarios(c.env.DB, 'TIERRAS'),
                fetchDBUsuarios(c.env.DB_JUSTICIA, 'JUSTICIA'),
                fetchDBUsuarios(c.env.DB_PRESIDENCIA, 'PRESIDENCIA')
            ]);
            return [...r1, ...r2, ...r3];
        }, 60);
        return c.json(result);
    }

    const results = await fetchDBUsuarios(getDB(c), institution.toUpperCase());
    return c.json(results);
});

app.post('/usuarios', async (c) => {
    const body = await c.req.json();
    const { nombre_completo, ci, cargo, unidad, oficina, piso, registrado_por } = body;

    try {
        const result = await getDB(c).prepare(
            'INSERT INTO usuarios (nombre_completo, ci, cargo, unidad, oficina, piso, registrado_por) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(nombre_completo ?? '', ci ?? '', cargo ?? null, unidad ?? null, oficina ?? null, piso ?? null, registrado_por ?? null).run();

        const newUser = { id: result.meta.last_row_id, nombre_completo, ci, cargo, unidad, oficina, piso, registrado_por };
        await invalidateConsolidadoCache(c.env.CACHE);
        return c.json({ success: true, user: newUser }, 201);
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 400);
    }
});

// Editar usuario
app.put('/usuarios/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { nombre_completo, ci, cargo, unidad, oficina, piso } = body;

    try {
        await getDB(c).prepare(
            'UPDATE usuarios SET nombre_completo=?, ci=?, cargo=?, unidad=?, oficina=?, piso=? WHERE id=?'
        ).bind(nombre_completo ?? '', ci ?? '', cargo ?? null, unidad ?? null, oficina ?? null, piso ?? null, id).run();
        await invalidateConsolidadoCache(c.env.CACHE);
        return c.json({ success: true, id });
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 400);
    }
});

// --- ACTIVOS ---
app.get('/activos', async (c) => {
    const institution = c.req.header('x-institution') || 'tierras';
    const estado = c.req.query('estado');

    const fetchDBActivos = async (db: D1Database, instName: string) => {
        let query = `
            SELECT a.*, u.nombre_completo as responsable, 
                   COALESCE(a.oficina, u.oficina) as oficina
            FROM activos a
            LEFT JOIN usuarios u ON a.usuario_actual_id = u.id
        `;
        if (estado) query += ` WHERE a.estado_actual = ? `;
        query += ` ORDER BY a.codigo_activo ASC `;

        const stmt = db.prepare(query);
        const { results } = await (estado ? stmt.bind(estado) : stmt).all();
        return results.map(r => ({ ...r, institucion: instName }));
    };

    if (institution === 'consolidado') {
        const cacheKey = estado ? `consolidado:activos:${estado}` : 'consolidado:activos';
        const result = await kvCache(c.env.CACHE, cacheKey, async () => {
            const [r1, r2, r3] = await Promise.all([
                fetchDBActivos(c.env.DB, 'TIERRAS'),
                fetchDBActivos(c.env.DB_JUSTICIA, 'JUSTICIA'),
                fetchDBActivos(c.env.DB_PRESIDENCIA, 'PRESIDENCIA')
            ]);
            return [...r1, ...r2, ...r3];
        }, 60);
        return c.json(result);
    }

    const results = await fetchDBActivos(getDB(c), institution.toUpperCase());
    return c.json(results);
});

// Activos asignados a un usuario específico (para Devolución)
app.get('/activos/usuario/:id', async (c) => {
    const userId = c.req.param('id');
    try {
        const rows = await getDB(c).prepare(
            `SELECT a.id, a.codigo_activo, a.descripcion, a.serie, a.estado_actual,
                    a.unidad, a.oficina, a.piso,
                    ac.id as last_acta_id, ac.numero_acta,
                    da.estado_fisico
             FROM activos a
             LEFT JOIN detalles_acta da ON da.activo_id = a.id
             LEFT JOIN actas ac ON ac.id = da.acta_id AND ac.tipo_acta = 'Asignación'
             WHERE a.usuario_actual_id = ?
               AND a.estado_actual = 'Asignado'
               AND da.id = (
                   SELECT da2.id FROM detalles_acta da2
                   JOIN actas ac2 ON ac2.id = da2.acta_id
                   WHERE da2.activo_id = a.id AND ac2.tipo_acta = 'Asignación'
                   ORDER BY da2.id DESC LIMIT 1
               )
             ORDER BY a.oficina, a.codigo_activo`
        ).bind(userId).all();
        return c.json(rows.results || []);
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 400);
    }
});

// Crear activo individual

app.post('/activos', async (c) => {
    const body = await c.req.json();
    const { codigo_activo, descripcion, serie, estado_actual, registrado_por } = body;
    try {
        const result = await getDB(c).prepare(
            'INSERT INTO activos (codigo_activo, descripcion, serie, estado_actual, registrado_por) VALUES (?, ?, ?, ?, ?)'
        ).bind(codigo_activo ?? '', descripcion ?? '', serie ?? null, estado_actual || 'Disponible', registrado_por ?? null).run();
        const id = result.meta.last_row_id;
        // Invalidar caché consolidado al crear activos
        await invalidateConsolidadoCache(c.env.CACHE);
        return c.json({ success: true, id, activo: { id, codigo_activo, descripcion, serie: serie || null, estado_actual: estado_actual || 'Disponible', registrado_por } }, 201);
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 400);
    }
});

// Liberar activo (retornar a Disponible, sin responsable)
app.put('/activos/:id/liberar', async (c) => {
    const id = c.req.param('id');
    try {
        await getDB(c).prepare(
            'UPDATE activos SET estado_actual = ?, usuario_actual_id = NULL, unidad = NULL, oficina = NULL, piso = NULL WHERE id = ?'
        ).bind('Disponible', id).run();
        await invalidateConsolidadoCache(c.env.CACHE);
        return c.json({ success: true, id });
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 400);
    }
});

// Editar activo individual
app.put('/activos/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { codigo_activo, descripcion, serie, estado_actual } = body;
    try {
        await getDB(c).prepare(
            'UPDATE activos SET codigo_activo=?, descripcion=?, serie=?, estado_actual=? WHERE id=?'
        ).bind(codigo_activo ?? '', descripcion ?? '', serie ?? null, estado_actual || 'Disponible', id).run();
        await invalidateConsolidadoCache(c.env.CACHE);
        return c.json({ success: true, id });
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 400);
    }
});


// Activos disponibles
app.get('/activos/disponibles', async (c) => {
    const { results } = await getDB(c).prepare(
        'SELECT * FROM activos WHERE estado_actual = "Disponible" ORDER BY codigo_activo ASC'
    ).all();
    return c.json(results);
});

// --- ACTIVOS AGRUPADOS (Historial Consolidado) ---
app.get('/activos/agrupados', async (c) => {
    try {
        const institution = c.req.header('x-institution') || 'tierras';

        const fetchDBAgrupados = async (db: D1Database, instName: string) => {
            const { results } = await db.prepare(`
                SELECT a.id, a.codigo_activo, a.descripcion, a.estado_actual,
                       a.unidad as a_unidad, a.oficina as a_oficina, a.piso as a_piso,
                       (SELECT ac.id FROM detalles_acta da JOIN actas ac ON da.acta_id = ac.id WHERE da.activo_id = a.id AND ac.tipo_acta='Asignación' ORDER BY ac.fecha_emision DESC LIMIT 1) as last_acta_id,
                       (SELECT da.estado_fisico FROM detalles_acta da JOIN actas ac ON da.acta_id = ac.id WHERE da.activo_id = a.id AND ac.tipo_acta='Asignación' ORDER BY ac.fecha_emision DESC LIMIT 1) as estado_fisico,
                       (SELECT ac2.observaciones FROM actas ac2 WHERE ac2.usuario_id = u.id AND ac2.tipo_acta='Asignación' ORDER BY ac2.fecha_emision DESC LIMIT 1) as observaciones,
                       u.id as usuario_id, u.nombre_completo, u.ci, u.cargo, u.unidad as u_unidad, u.oficina as u_oficina, u.piso as u_piso
                FROM activos a
                JOIN usuarios u ON a.usuario_actual_id = u.id
                WHERE a.estado_actual = 'Asignado'
                ORDER BY u.nombre_completo ASC, a_oficina ASC, a.codigo_activo ASC
            `).all();
            return results.map(r => ({ ...r, institucion: instName }));
        };

        let allResults = [];
        if (institution === 'consolidado') {
            const [r1, r2, r3] = await Promise.all([
                fetchDBAgrupados(c.env.DB, 'TIERRAS'),
                fetchDBAgrupados(c.env.DB_JUSTICIA, 'JUSTICIA'),
                fetchDBAgrupados(c.env.DB_PRESIDENCIA, 'PRESIDENCIA')
            ]);
            allResults = [...r1, ...r2, ...r3];
        } else {
            allResults = await fetchDBAgrupados(getDB(c), institution.toUpperCase());
        }

        // Agrupación en memoria (Responsable -> Oficina -> Activos)
        const mapPersonas = new Map();

        for (const row of allResults as any[]) {
            const ci = row.ci;
            if (!mapPersonas.has(ci)) {
                mapPersonas.set(ci, {
                    id: row.usuario_id,
                    ci: row.ci,
                    nombre_completo: row.nombre_completo,
                    cargo: row.cargo,
                    institucion: row.institucion,
                    ubicaciones: new Map()
                });
            }

            const persona = mapPersonas.get(ci) as any;

            const unidad = row.a_unidad || row.u_unidad;
            const oficina = row.a_oficina || row.u_oficina;
            const piso = row.a_piso || row.u_piso;

            const keyOficina = `${unidad || ''}|${oficina || ''}|${piso || ''}|${row.last_acta_id || ''}`;

            if (!persona.ubicaciones.has(keyOficina)) {
                persona.ubicaciones.set(keyOficina, {
                    usuario_id: row.usuario_id,
                    unidad: unidad,
                    oficina: oficina,
                    piso: piso,
                    acta_id: row.last_acta_id || null,
                    acta_numero: row.last_acta_id ? String(row.last_acta_id).padStart(5, '0') : null,
                    observaciones: row.observaciones || null,
                    activos: []
                });
            }

            persona.ubicaciones.get(keyOficina).activos.push({
                id: row.id,
                codigo_activo: row.codigo_activo,
                descripcion: row.descripcion,
                estado_actual: row.estado_actual,
                estado_fisico: row.estado_fisico || 'Bueno',
                last_acta_id: row.last_acta_id,
                institucion: row.institucion
            });
        }

        const resultadoFinal = Array.from(mapPersonas.values()).map(p => ({
            ...p,
            ubicaciones: Array.from(p.ubicaciones.values())
        }));

        return c.json(resultadoFinal);
    } catch (e: any) {
        console.error("Error en /activos/agrupados:", e.message);
        return c.json({ error: formatError(e) }, 500);
    }
});

// --- ACTAS ---
app.get('/actas', async (c) => {
    try {
        const institution = (c.req.header('x-institution') || 'tierras').toLowerCase();
        const usuario_id = c.req.query('usuario_id');
        const tipo = c.req.query('tipo');

        const fetchActasFromDB = async (db: D1Database, instName: string) => {
            let query = `
                SELECT a.*, u.nombre_completo as usuario, ? as institucion
                FROM actas a
                JOIN usuarios u ON a.usuario_id = u.id
            `;
            const params: any[] = [instName];

            const conditions = [];
            if (usuario_id) { conditions.push('a.usuario_id = ?'); params.push(usuario_id); }
            if (tipo) { conditions.push('a.tipo_acta = ?'); params.push(tipo); }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY a.fecha_emision DESC';
            const { results } = await db.prepare(query).bind(...params).all();
            return results || [];
        };

        if (institution === 'consolidado') {
            const [r1, r2, r3] = await Promise.all([
                fetchActasFromDB(c.env.DB, 'TIERRAS'),
                fetchActasFromDB(c.env.DB_JUSTICIA, 'JUSTICIA'),
                fetchActasFromDB(c.env.DB_PRESIDENCIA, 'PRESIDENCIA')
            ]);
            return c.json([...r1, ...r2, ...r3].sort((a: any, b: any) =>
                new Date(b.fecha_emision).getTime() - new Date(a.fecha_emision).getTime()
            ));
        }

        const results = await fetchActasFromDB(getDB(c), institution.toUpperCase());
        return c.json(results);
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 500);
    }
});

app.post('/actas', async (c) => {
    const body = await c.req.json();
    const { tipo_acta, usuario_id, activos_seleccionados, observaciones, unidad, oficina, piso, appendToActaId, realizado_por } = body;

    if (!usuario_id) {
        return c.json({ error: "Faltan datos obligatorios", message: "El ID del usuario es requerido para generar el acta." }, 400);
    }

    if (!activos_seleccionados || !Array.isArray(activos_seleccionados)) {
        return c.json({ error: "Faltan datos obligatorios", message: "La lista de activos seleccionados es requerida." }, 400);
    }

    let actaId = appendToActaId;

    try {
        if (!actaId) {
            // 1. Crear el acta con snapshot de ubicación si no hay ID de acta para aumentar
            const batchResult = await getDB(c).batch([
                getDB(c).prepare('INSERT INTO actas (tipo_acta, usuario_id, observaciones, unidad, oficina, piso, realizado_por) VALUES (?, ?, ?, ?, ?, ?, ?)')
                    .bind(tipo_acta, usuario_id, observaciones ?? null, unidad ?? null, oficina ?? null, piso ?? null, realizado_por ?? null)
            ]);
            actaId = batchResult[0].meta.last_row_id;
        }

        const detailStatements = [];
        const statusUpdateStatements = [];

        // Lógica de estados y responsables
        const nuevoEstado = tipo_acta === 'Asignación' ? 'Asignado' : 'Disponible';
        const nuevoResponsable = tipo_acta === 'Asignación' ? usuario_id : null;

        // Ubicación de destino
        const dest_unidad = tipo_acta === 'Asignación' ? (unidad || null) : null;
        const dest_oficina = tipo_acta === 'Asignación' ? (oficina || null) : null;
        const dest_piso = tipo_acta === 'Asignación' ? (piso || null) : null;

        for (const item of activos_seleccionados) {
            detailStatements.push(
                getDB(c).prepare('INSERT INTO detalles_acta (acta_id, activo_id, estado_fisico) VALUES (?, ?, ?)')
                    .bind(actaId, item.id, item.estado_fisico)
            );
            statusUpdateStatements.push(
                getDB(c).prepare('UPDATE activos SET estado_actual = ?, usuario_actual_id = ?, unidad = ?, oficina = ?, piso = ? WHERE id = ?')
                    .bind(nuevoEstado, nuevoResponsable ?? null, dest_unidad ?? null, dest_oficina ?? null, dest_piso ?? null, item.id)
            );
        }

        await getDB(c).batch([...detailStatements, ...statusUpdateStatements]);

        await invalidateConsolidadoCache(c.env.CACHE);
        return c.json({ success: true, actaId });
    } catch (e: any) {
        console.error("Error al procesar acta o detalles:", e.message);
        return c.json({
            error: "Error al procesar el acta en la base de datos",
            message: formatError(e),
            hint: "Asegúrate de que las tablas 'actas', 'detalles_acta' y 'activos' tengan todas las columnas necesarias."
        }, 500);
    }
});

// --- BULK IMPORT ---
app.post('/activos/bulk', async (c) => {
    const assets = await c.req.json();
    if (!Array.isArray(assets)) return c.json({ error: 'Formato inválido' }, 400);

    const formatEstado = (est: string) => {
        if (!est) return 'Disponible';
        const e = est.trim().toLowerCase();
        if (e.includes('asign')) return 'Asignado';
        if (e.includes('manten')) return 'Mantenimiento';
        return 'Disponible'; // Por defecto
    };

    const statements = assets.map(a =>
        getDB(c).prepare('INSERT OR IGNORE INTO activos (codigo_activo, descripcion, serie, estado_actual) VALUES (?, ?, ?, ?)')
            .bind(a.codigo_activo ?? '', a.descripcion ?? '', a.serie ?? null, formatEstado(a.estado_actual))
    );

    try {
        await getDB(c).batch(statements);
        await invalidateConsolidadoCache(c.env.CACHE);
        return c.json({ success: true, count: assets.length });
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 500);
    }
});

// REFACTORIZADO: Endpoint de Migración Masiva (Optimizado Velocidad de la Luz para Cloudflare D1)
app.post('/migrate', async (c) => {
    try {
        const { data, type = 'full' } = await c.req.json();
        if (!Array.isArray(data) || data.length === 0) return c.json({ error: 'Formato inválido o vacío' }, 400);

        const results = { created_users: 0, created_assets: 0, failed: 0 };
        const db = getDB(c);

        console.log(`Iniciando migración de ${data.length} registros. Tipo: ${type}`);

        // 1. CARGA EN MEMORIA DE USUARIOS EXISTENTES (Evita el problema de miles de consultas N+1)
        const usuariosMap = new Map<string, number>(); // CI -> ID
        if (type === 'full' || type === 'users' || type === 'assets') {
            const { results: usuariosExtraidos } = await db.prepare('SELECT id, ci FROM usuarios').all();
            if (usuariosExtraidos) {
                usuariosExtraidos.forEach((u: any) => {
                    if (u.ci) usuariosMap.set(String(u.ci).trim(), u.id);
                });
            }
        }

        // 2. FUNCIÓN DE FORMATO
        const formatEstado = (est: string, hasUser: boolean) => {
            if (!est) return hasUser ? 'Asignado' : 'Disponible';
            const e = est.trim().toLowerCase();
            if (e.includes('asign')) return 'Asignado';
            if (e.includes('manten')) return 'Mantenimiento';
            return 'Disponible';
        };

        // 3. PROCESAMIENTO E INSERCIONES EN LOTES (Batch MAX 80 para no superar el límite de 100 de D1)
        const BATCH_SIZE = 80;

        for (let i = 0; i < data.length; i += BATCH_SIZE) {
            const batch = data.slice(i, i + BATCH_SIZE);
            const userStatements: any[] = [];
            const assetStatements: any[] = [];

            // a) Primera pasada: Identificar y preparar creación de NUEVOS usuarios de este lote
            // Usamos un Set temporal para no intentar crear el mismo usuario dos veces en el mismo lote
            const newUsersInBatch = new Set<string>();

            for (const item of batch) {
                if (!item.responsable_ci) continue;
                const ciStr = String(item.responsable_ci).trim();

                if (!usuariosMap.has(ciStr) && !newUsersInBatch.has(ciStr) && (type === 'full' || type === 'users')) {
                    userStatements.push(
                        db.prepare(
                            'INSERT INTO usuarios (nombre_completo, ci, cargo, unidad, oficina, piso) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, ci'
                        ).bind(
                            item.responsable_nombre || 'S/N',
                            ciStr,
                            item.responsable_cargo || null,
                            item.unidad || null,
                            item.oficina || null,
                            item.piso || null
                        )
                    );
                    newUsersInBatch.add(ciStr);
                }
            }

            // Si hay usuarios nuevos en este lote, los insertamos en un batch primero y actualizamos el Map
            if (userStatements.length > 0) {
                try {
                    const userBatchResults = await db.batch(userStatements);
                    userBatchResults.forEach(res => {
                        if (res.results && res.results.length > 0) {
                            const inserted = res.results[0] as any;
                            usuariosMap.set(String(inserted.ci).trim(), inserted.id);
                            results.created_users++;
                        }
                    });
                } catch (e: any) {
                    console.error("Error insertando batch de usuarios:", e.message);
                    // Si falla el batch completo, marcamos como error pero intentamos seguir con los activos que tengan ID
                }
            }

            // b) Segunda pasada: Preparar creación de ACTIVOS de este lote
            if (type === 'full' || type === 'assets') {
                for (const item of batch) {
                    try {
                        const ciStr = item.responsable_ci ? String(item.responsable_ci).trim() : null;
                        const userId = ciStr ? usuariosMap.get(ciStr) || null : null;

                        assetStatements.push(
                            db.prepare(
                                'INSERT OR REPLACE INTO activos (codigo_activo, descripcion, serie, estado_actual, usuario_actual_id, unidad, oficina, piso) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
                            ).bind(
                                item.codigo_activo,
                                item.descripcion,
                                item.serie || null,
                                formatEstado(item.estado_actual, !!userId),
                                userId,
                                item.unidad || null,
                                item.oficina || null,
                                item.piso || null
                            )
                        );
                    } catch (err) {
                        results.failed++;
                    }
                }

                // Insertar lote de activos
                if (assetStatements.length > 0) {
                    try {
                        await db.batch(assetStatements);
                        results.created_assets += assetStatements.length;
                    } catch (e: any) {
                        console.error("Error insertando batch de activos:", e.message);
                        results.failed += assetStatements.length;
                    }
                }
            }
        }

        console.log("Migración finalizada con resultados:", results);
        await invalidateConsolidadoCache(c.env.CACHE);
        return c.json({ success: true, ...results });
    } catch (e: any) {
        console.error("Error fatal en migración masiva:", e.message);
        return c.json({ error: formatError(e) }, 500);
    }
});

app.get('/actas/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const targetInst = c.req.header('x-target-institution') || c.req.header('x-institution') || 'tierras';

        let db: D1Database;
        const inst = targetInst.toLowerCase();
        if (inst === 'justicia') db = c.env.DB_JUSTICIA;
        else if (inst === 'presidencia') db = c.env.DB_PRESIDENCIA;
        else db = c.env.DB;

        const acta = await db.prepare(`
            SELECT a.*, u.nombre_completo, u.ci, u.cargo,
                   COALESCE(a.unidad, u.unidad) as unidad,
                   COALESCE(a.oficina, u.oficina) as oficina,
                   COALESCE(a.piso, u.piso) as piso
            FROM actas a
            JOIN usuarios u ON a.usuario_id = u.id
            WHERE a.id = ?
        `).bind(id).first();

        if (!acta) return c.json({ error: 'Acta no encontrada' }, 404);

        const { results: activos } = await db.prepare(`
            SELECT ac.id, da.estado_fisico, ac.codigo_activo, ac.descripcion
            FROM detalles_acta da
            JOIN activos ac ON da.activo_id = ac.id
            WHERE da.acta_id = ?
        `).bind(id).all();

        return c.json({ ...acta, activos });
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 500);
    }
});

// Redundant /actas route removed to avoid conflicts and support consolidation above.


// Actualizar estado físico de un activo en un acta
app.put('/detalles_acta/estado', async (c) => {
    const body = await c.req.json();
    const { acta_id, activo_id, estado_fisico } = body;
    try {
        await getDB(c).prepare(
            'UPDATE detalles_acta SET estado_fisico = ? WHERE acta_id = ? AND activo_id = ?'
        ).bind(estado_fisico ?? 'Bueno', acta_id, activo_id).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 400);
    }
});

// --- AUDITORIAS FÍSICAS (PERSISTENCIA DE CONTROL) ---
app.get('/auditorias/usuario/:id', async (c) => {
    const userId = c.req.param('id');
    const targetInst = c.req.header('x-target-institution') || c.req.header('x-institution') || 'tierras';

    try {
        let db: D1Database;
        const inst = targetInst.toLowerCase();
        if (inst === 'justicia') db = c.env.DB_JUSTICIA;
        else if (inst === 'presidencia') db = c.env.DB_PRESIDENCIA;
        else db = c.env.DB;

        const { results } = await db.prepare(
            'SELECT activo_id, hallazgo, fecha_auditoria, observacion FROM auditorias_fisicas WHERE usuario_auditado_id = ?'
        ).bind(userId).all();
        return c.json(results || []);
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 500);
    }
});

app.post('/auditorias', async (c) => {
    const body = await c.req.json();
    const { usuario_auditado_id, activo_id, hallazgo, realizado_por, institucion, observacion } = body;
    const targetInst = institucion || c.req.header('x-target-institution') || c.req.header('x-institution') || 'tierras';

    try {
        let db: D1Database;
        const inst = targetInst.toLowerCase();
        if (inst === 'justicia') db = c.env.DB_JUSTICIA;
        else if (inst === 'presidencia') db = c.env.DB_PRESIDENCIA;
        else db = c.env.DB;

        await db.prepare(
            'INSERT INTO auditorias_fisicas (usuario_auditado_id, activo_id, hallazgo, realizado_por, observacion) VALUES (?, ?, ?, ?, ?)'
        ).bind(usuario_auditado_id, activo_id, hallazgo, realizado_por ?? null, observacion ?? null).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 400);
    }
});

// Limpiar auditoría de un usuario (para reiniciar el proceso)
app.delete('/auditorias/usuario/:id', async (c) => {
    const userId = c.req.param('id');
    const targetInst = c.req.header('x-target-institution') || c.req.header('x-institution') || 'tierras';

    try {
        let db: D1Database;
        const inst = targetInst.toLowerCase();
        if (inst === 'justicia') db = c.env.DB_JUSTICIA;
        else if (inst === 'presidencia') db = c.env.DB_PRESIDENCIA;
        else db = c.env.DB;

        await db.prepare('DELETE FROM auditorias_fisicas WHERE usuario_auditado_id = ?').bind(userId).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 500);
    }
});

// Borrar un ítem específico de la auditoría
app.delete('/api/auditorias/usuario/:userId/activo/:activoId', async (c) => {
    const userId = c.req.param('userId');
    const activoId = c.req.param('activoId');
    try {
        await getDB(c).prepare(
            'DELETE FROM auditorias_fisicas WHERE usuario_auditado_id = ? AND activo_id = ?'
        ).bind(userId, activoId).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 500);
    }
});


// ============================================================
// BITÁCORA DE MOVIMIENTOS
// ============================================================
app.get('/bitacora', async (c) => {
    try {
        const institution = (c.req.header('x-institution') || 'tierras').toLowerCase();
        const limit = parseInt(c.req.query('limit') || '200');

        const fetchBitacoraFromDB = async (db: D1Database, instName: string) => {
            const query = `
                SELECT *, ? as institucion FROM (
                    SELECT
                        a.codigo_activo,
                        a.descripcion,
                        u.nombre_completo  AS responsable,
                        ac.tipo_acta,
                        ac.fecha_emision,
                        ac.realizado_por,
                        ac.observaciones,
                        a.oficina,
                        a.piso,
                        ac.id              AS acta_id
                    FROM detalles_acta da
                    JOIN actas ac       ON da.acta_id  = ac.id
                    JOIN activos a      ON da.activo_id = a.id
                    LEFT JOIN usuarios u ON ac.usuario_id = u.id
                    
                    UNION ALL
                    
                    SELECT
                        a.codigo_activo,
                        a.descripcion,
                        u.nombre_completo  AS responsable,
                        'Auditoría (' || af.hallazgo || ')' as tipo_acta,
                        af.fecha_auditoria as fecha_emision,
                        af.realizado_por,
                        'Hallazgo físico en auditoría' as observaciones,
                        a.oficina,
                        a.piso,
                        af.id              AS acta_id
                    FROM auditorias_fisicas af
                    JOIN activos a      ON af.activo_id = a.id
                    JOIN usuarios u ON af.usuario_auditado_id = u.id
                )
                ORDER BY fecha_emision DESC
                LIMIT ?
            `;
            const { results } = await db.prepare(query).bind(instName, limit).all();
            return results || [];
        };

        if (institution === 'consolidado') {
            const [r1, r2, r3] = await Promise.all([
                fetchBitacoraFromDB(c.env.DB, 'TIERRAS'),
                fetchBitacoraFromDB(c.env.DB_JUSTICIA, 'JUSTICIA'),
                fetchBitacoraFromDB(c.env.DB_PRESIDENCIA, 'PRESIDENCIA')
            ]);
            return c.json([...r1, ...r2, ...r3].sort((a: any, b: any) =>
                new Date(b.fecha_emision).getTime() - new Date(a.fecha_emision).getTime()
            ).slice(0, limit));
        }

        const results = await fetchBitacoraFromDB(getDB(c), institution.toUpperCase());
        return c.json(results);
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 500);
    }
});

// ============================================================
// AUTENTICACIÓN Y GESTIÓN DE CUENTAS DE SISTEMA
// ============================================================

// Helper: SHA-256 usando Web Crypto API (disponible en Cloudflare Workers)
async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Login — verifica credenciales y devuelve info del usuario
app.post('/auth/login', async (c) => {
    try {
        const { username, password } = await c.req.json();
        if (!username || !password) return c.json({ error: 'Usuario y contraseña requeridos.' }, 400);

        // Buscar en la DB de Tierras (DB maestra del sistema — login es global)
        const hash = await hashPassword(password);
        const user = await c.env.DB.prepare(
            'SELECT id, username, nombre, rol, activo FROM system_users WHERE username = ? AND password_hash = ?'
        ).bind(username.toLowerCase().trim(), hash).first();

        if (!user) return c.json({ error: 'Usuario o contraseña incorrectos.' }, 401);
        if (!user.activo) return c.json({ error: 'Esta cuenta está desactivada. Contacte al administrador.' }, 403);

        if (user.rol === 'admin') {
            return c.json({ user, admin_password: c.env.ADMIN_PASSWORD });
        }
        return c.json({ user });
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 500);
    }
});

// Crear tabla system_users si no existe (migración automática)
app.post('/auth/migrate', async (c) => {
    try {
        await getDB(c).prepare(`
            CREATE TABLE IF NOT EXISTS system_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                nombre TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                rol TEXT CHECK(rol IN ('admin', 'tecnico')) DEFAULT 'tecnico',
                activo INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now'))
            )
        `).run();

        // Columna realizado_por en actas
        try { await getDB(c).prepare('ALTER TABLE actas ADD COLUMN realizado_por TEXT').run(); } catch { }
        // Columna observacion en auditorias_fisicas
        try { await getDB(c).prepare('ALTER TABLE auditorias_fisicas ADD COLUMN observacion TEXT').run(); } catch { }

        // Seed admin por defecto
        const hash = await hashPassword('admin123');
        await getDB(c).prepare(
            'INSERT OR IGNORE INTO system_users (username, nombre, password_hash, rol) VALUES (?, ?, ?, ?)'
        ).bind('admin', 'Administrador', hash, 'admin').run();

        return c.json({ success: true, message: 'Migración completada.' });
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 500);
    }
});

// Listar cuentas del sistema (admin only — validación en frontend)
app.get('/system-users', async (c) => {
    try {
        const institution = c.req.header('x-institution') || 'tierras';

        const fetchDBSystemUsers = async (db: D1Database, instName: string) => {
            const { results } = await db.prepare(
                'SELECT id, username, nombre, rol, activo, created_at FROM system_users ORDER BY rol DESC, nombre ASC'
            ).all();
            return results.map((r: any) => ({ ...r, institucion: instName }));
        };

        const [r1, r2, r3] = await Promise.all([
            fetchDBSystemUsers(c.env.DB, 'TIERRAS'),
            fetchDBSystemUsers(c.env.DB_JUSTICIA, 'JUSTICIA'),
            fetchDBSystemUsers(c.env.DB_PRESIDENCIA, 'PRESIDENCIA')
        ]);

        // Agrupar por username para saber en qué DBs está cada uno
        const userMap = new Map();
        [...r1, ...r2, ...r3].forEach(u => {
            if (!userMap.has(u.username)) {
                userMap.set(u.username, { ...u, instituciones: [u.institucion] });
            } else {
                const existing = userMap.get(u.username);
                // Evitar duplicados en la lista de instituciones (por si acaso)
                if (!existing.instituciones.includes(u.institucion)) {
                    existing.instituciones.push(u.institucion);
                }
            }
        });

        // Si no estamos en consolidado, al menos ya tenemos la info completa de cada usuario
        const allUsers = Array.from(userMap.values());

        if (institution === 'consolidado') {
            return c.json(allUsers);
        }

        // Si estamos en una inst específica, podrías filtrar, 
        // pero para la "Gestión de Accesos" es mejor ver TODO el panorama del usuario.
        // Por consistencia con la UI actual que espera ver a todos, devolvemos todos.
        return c.json(allUsers);
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 500);
    }
});

// Crear cuenta del sistema
app.post('/system-users', async (c) => {
    try {
        const body = await c.req.json();
        const { username, nombre, password, rol, instituciones } = body;
        if (!username || !nombre || !password) return c.json({ error: 'Faltan campos requeridos.' }, 400);
        const hash = await hashPassword(password);

        // Si no se especifican instituciones, usar la actual del header
        const targetInsts = (instituciones && Array.isArray(instituciones) && instituciones.length > 0)
            ? instituciones
            : [c.req.header('x-institution') || 'tierras'];

        const statements: any[] = [];
        targetInsts.forEach((inst: string) => {
            let db: D1Database;
            const i = inst.toLowerCase();
            if (i === 'justicia') db = c.env.DB_JUSTICIA;
            else if (i === 'presidencia') db = c.env.DB_PRESIDENCIA;
            else db = c.env.DB;

            statements.push({
                db,
                stmt: db.prepare('INSERT OR REPLACE INTO system_users (username, nombre, password_hash, rol, activo) VALUES (?, ?, ?, ?, ?)').bind(username.toLowerCase().trim(), nombre, hash, rol || 'tecnico', 1)
            });
        });

        // Ejecutar en paralelo (D1 batch solo funciona sobre la misma DB, así que hacemos Promise.all de runs)
        await Promise.all(statements.map(s => s.stmt.run()));

        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 400);
    }
});

// Actualizar cuenta del sistema
app.put('/system-users/:id', async (c) => {
    try {
        const idOrUsername = c.req.param('id');
        const body = await c.req.json();
        const { nombre, password, rol, activo, instituciones } = body;

        // Si instituciones está presente, actualizamos por username en todas las indicadas
        const targetInsts = (instituciones && Array.isArray(instituciones) && instituciones.length > 0)
            ? instituciones
            : [c.req.header('x-institution') || 'tierras'];

        const hash = password ? await hashPassword(password) : null;
        const allPossibleInsts = ['tierras', 'justicia', 'presidencia'];

        const syncPromises = allPossibleInsts.map(async (inst: string) => {
            let db: D1Database;
            const i = inst.toLowerCase();
            if (i === 'justicia') db = c.env.DB_JUSTICIA;
            else if (i === 'presidencia') db = c.env.DB_PRESIDENCIA;
            else db = c.env.DB;

            const isSelected = targetInsts.some(ti => ti.toLowerCase() === i);
            const usernameToUse = idOrUsername.toLowerCase().trim(); // En este sistema usamos username como ID principal de facto

            if (isSelected) {
                // UPSERT: INSERT OR REPLACE
                if (hash) {
                    return db.prepare(
                        'INSERT OR REPLACE INTO system_users (username, nombre, password_hash, rol, activo) VALUES (?, ?, ?, ?, ?)'
                    ).bind(usernameToUse, nombre, hash, rol, activo !== undefined ? activo : 1).run();
                } else {
                    // Si no hay nueva password, primero intentamos UPDATE. 
                    // Si no existe, INSERT con una flag o simplemente intentar SELECT y luego INSERT.
                    // Pero INSERT OR REPLACE requiere todos los campos. 
                    // Como no tenemos el hash actual aquí (y no queremos resetearlo), 
                    // haremos un truco: UPDATE y si rowsAffected es 0, omitimos o buscamos el hash previo.
                    const upd = await db.prepare(
                        'UPDATE system_users SET nombre = ?, rol = ?, activo = ? WHERE username = ?'
                    ).bind(nombre, rol, activo !== undefined ? activo : 1, usernameToUse).run();

                    if (upd.success && upd.meta.changes === 0) {
                        // El usuario no existe en esta DB. Necesitamos el hash para el INSERT.
                        // Lo buscamos en la DB principal (o en cualquiera donde sí esté).
                        const existing = await c.env.DB.prepare('SELECT password_hash FROM system_users WHERE username = ?').bind(usernameToUse).first();
                        if (existing) {
                            return db.prepare(
                                'INSERT INTO system_users (username, nombre, password_hash, rol, activo) VALUES (?, ?, ?, ?, ?)'
                            ).bind(usernameToUse, nombre, existing.password_hash, rol, activo !== undefined ? activo : 1).run();
                        }
                    }
                    return upd;
                }
            } else {
                // Eliminar de esta base de datos si no está seleccionada
                return db.prepare('DELETE FROM system_users WHERE username = ?').bind(usernameToUse).run();
            }
        });

        await Promise.all(syncPromises);
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 400);
    }
});

// Eliminar cuenta del sistema
app.delete('/system-users/:id', async (c) => {
    try {
        const idOrUsername = c.req.param('id');
        const isNumericId = /^\d+$/.test(idOrUsername);
        const usernameToUse = idOrUsername.toLowerCase().trim();

        const dbs = [c.env.DB, c.env.DB_JUSTICIA, c.env.DB_PRESIDENCIA];

        await Promise.all(dbs.map(db =>
            db.prepare(`UPDATE system_users SET activo = 0 WHERE ${isNumericId ? 'id' : 'username'} = ?`)
                .bind(isNumericId ? parseInt(idOrUsername) : usernameToUse).run()
        ));

        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 500);
    }
});

export const onRequest = handle(app);
