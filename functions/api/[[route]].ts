/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';

type Bindings = {
    DB: D1Database;          // Default (Tierras)
    DB_JUSTICIA: D1Database; // Ministerio de Justicia
    DB_PRESIDENCIA: D1Database; // Presidencia
    DB_CULTURAS?: D1Database;    // Culturas
    DB_VICEPRESIDENCIA?: D1Database; // Vicepresidencia
    ADMIN_PASSWORD: string;   // Contraseña global
    CACHE: KVNamespace;       // KV Cache para CONSOLIDADO
};

const app = new Hono<{ Bindings: Bindings }>().basePath('/api');

// ─── MIDDLEWARES Y CONFIGURACIÓN ─────────────────────────────────────────────

// Helper principal para obtener la DB correcta
const getDB = (c: any): any => {
    // Si viene un target específico (por header), lo priorizamos
    const target = c.req.header('x-target-institution');
    // IMPORTANTE: Ignorar valores inválidos como la cadena "undefined" o "null" que el
    // navegador puede enviar cuando selectedUser.institucion es undefined en JavaScript
    if (target && target !== 'undefined' && target !== 'null' && target.trim() !== '') {
        const t = target.toLowerCase().trim();
        if (t === 'justicia') return c.env.DB_JUSTICIA;
        if (t === 'presidencia') return c.env.DB_PRESIDENCIA;
        if (t === 'culturas') return c.env.DB_CULTURAS;
        if (t === 'vicepresidencia') return c.env.DB_VICEPRESIDENCIA;
        if (t === 'tierras') return c.env.DB;
        // target no reconocido: ignorar y usar el contexto por defecto
    }
    // Retorna la DB del contexto, que puede ser:
    //   - una D1Database real (si la institución fue seleccionada)
    //   - la cadena 'CONSOLIDADO' (si se seleccionó modo consolidado)
    //   - undefined (si la institución no tiene binding en Cloudflare)
    return (c as any).db;
};

// Helper para operaciones de escritura: rechaza CONSOLIDADO y bindings faltantes
const requireMutationDB = (c: any): D1Database | null => {
    const db = getDB(c);
    if (!db || db === 'CONSOLIDADO') return null;
    return db as D1Database;
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
    } else if (institution === 'culturas') {
        (c as any).db = c.env.DB_CULTURAS;
    } else if (institution === 'vicepresidencia') {
        (c as any).db = c.env.DB_VICEPRESIDENCIA;
    } else if (institution === 'tierras') {
        (c as any).db = c.env.DB;
    } else if (institution === 'consolidado') {
        // En modo consolidado no asignamos una única DB, pero no es un error
        (c as any).db = 'CONSOLIDADO';
    } else {
        (c as any).db = undefined;
    }
    await next();
});

// 3. Middleware de Seguridad (Admin Password)
app.use('*', async (c, next) => {
    const method = c.req.method;
    const path = c.req.path;
    const sensitivePaths = ['/migrate'];
    const isSensitive = sensitivePaths.some(p => path.includes(p)) ||
        method === 'DELETE';

    if (isSensitive) {
        const providedPassword = c.req.header('x-admin-password');
        const expectedPassword = c.env.ADMIN_PASSWORD;

        if (!expectedPassword) {
            return c.json({
                error: 'Error de configuración del servidor.',
                message: 'La variable ADMIN_PASSWORD no está configurada en el entorno de Cloudflare.'
            }, 500);
        }

        if (providedPassword !== expectedPassword) {
            return c.json({
                error: 'Autorización administrativa requerida.',
                message: 'La clave maestra no coincide o no se ha proporcionado. Cierre sesión e intente ingresar nuevamente.'
            }, 401);
        }
    }
    await next();
});

// 4. Helper para diagnóstico de vinculación
app.use('*', async (c, next) => {
    const isConsolidated = (c as any).db === 'CONSOLIDADO';
    if (!isConsolidated && !getDB(c)) {
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

app.all('/debug', async (c) => {
    const contextDB = (c as any).db;
    const resolvedDB = getDB(c);
    const target = c.req.header('x-target-institution');
    const inst = c.req.header('x-institution');
    return c.json({
        contextDB_type: typeof contextDB,
        resolvedDB_type: typeof resolvedDB,
        target,
        inst,
        hasJusticia: !!c.env.DB_JUSTICIA,
        hasCulturas: !!c.env.DB_CULTURAS,
        hasVicepresidencia: !!c.env.DB_VICEPRESIDENCIA
    });
});

const formatError = (err: any) => {
    const msg = err.message || '';
    // Errores conocidos y seguros
    if (msg.includes('UNIQUE constraint failed: usuarios.ci')) return 'El CI ya está registrado para otro funcionario.';
    if (msg.includes('UNIQUE constraint failed: activos.codigo_activo')) return 'El código de activo ya existe en el sistema.';
    if (msg.includes('FOREIGN KEY constraint failed')) {
        // Si el error ocurre durante un DELETE o UPDATE, es probable que esté en uso.
        // Si ocurre en un POST, es probable que el ID de referencia no exista.
        return 'No se pudo completar la operación: El registro está siendo usado por otros datos o una referencia (Unidad/Oficina) no es válida.';
    }
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
            kv.delete('consolidado:catalogos'),
        ]);
    } catch { }
}

// ─── CATALOGOS (NUEVO 4NF) ───────────────────────────────────────────────────

app.get('/catalogos', async (c) => {
    try {
        let db: any = getDB(c);

        // Si estamos en modo consolidado, usamos la DB de Tierras para los catálogos base
        if (db === 'CONSOLIDADO') db = c.env.DB;

        if (!db) return c.json({ unidades: [], oficinas: [], pisos: [], auxiliares: [], grupos: [] });

        const full = c.req.query('full') === 'true';
        const where = full ? '' : ' WHERE activo = 1 ';

        const [unidades, oficinas, pisos, auxiliares, grupos, ubicaciones] = await Promise.all([
            db.prepare(`SELECT * FROM cat_unidades ${where} ORDER BY nombre`).all(),
            db.prepare(`SELECT * FROM cat_oficinas ${where} ORDER BY nombre`).all(),
            db.prepare(`SELECT * FROM cat_pisos ${where} ORDER BY numero`).all(),
            db.prepare(`SELECT a.*, g.nombre as grupo_nombre FROM cat_auxiliares a LEFT JOIN cat_grupos_contables g ON a.cat_grupo_contable_id = g.id ${full ? '' : ' WHERE a.activo = 1 '} ORDER BY a.nombre`).all(),
            db.prepare(`SELECT * FROM cat_grupos_contables ${where} ORDER BY nombre`).all(),
            db.prepare(`SELECT * FROM ubicacion_fisica ${where} ORDER BY nombre`).all()
        ]);
        return c.json({
            unidades: unidades.results || [],
            oficinas: oficinas.results || [],
            pisos: pisos.results || [],
            auxiliares: auxiliares.results || [],
            grupos: grupos.results || [],
            ubicaciones: ubicaciones.results || []
        });
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 500);
    }
});

// ─── ESTADÍSTICAS (DASHBOARD) ────────────────────────────────────────────────

app.get('/stats', async (c) => {
    const institution = (c.req.header('x-institution') || 'tierras').toLowerCase();

    const fetchStatsFromDB = async (db: D1Database) => {
        try {
            const [activos, sobrantes] = await Promise.all([
                db.prepare(`
                    SELECT
                        COUNT(*) as total,
                        SUM(CASE WHEN estado_actual = 'Asignado' THEN 1 ELSE 0 END) as asignados,
                        SUM(CASE WHEN estado_actual = 'Disponible' THEN 1 ELSE 0 END) as disponibles,
                        SUM(CASE WHEN estado_actual = 'Mantenimiento' THEN 1 ELSE 0 END) as mantenimiento
                    FROM activos
                `).first(),
                db.prepare(`
                    SELECT COUNT(DISTINCT activo_id) as sobrantes
                    FROM auditorias_fisicas
                    WHERE hallazgo = 'Sobrante'
                `).first().catch(() => ({ sobrantes: 0 }))
            ]);
            return {
                total: Number(activos?.total || 0),
                asignados: Number(activos?.asignados || 0),
                disponibles: Number(activos?.disponibles || 0),
                mantenimiento: Number(activos?.mantenimiento || 0),
                sobrantes: Number((sobrantes as any)?.sobrantes || 0),
            };
        } catch {
            return { total: 0, asignados: 0, disponibles: 0, mantenimiento: 0, sobrantes: 0 };
        }
    };

    try {
        if (institution === 'consolidado') {
            const fetchFn = async () => {
                const [s1, s2, s3, s4, s5] = await Promise.all([
                    fetchStatsFromDB(c.env.DB),
                    fetchStatsFromDB(c.env.DB_JUSTICIA),
                    fetchStatsFromDB(c.env.DB_PRESIDENCIA),
                    c.env.DB_CULTURAS ? fetchStatsFromDB(c.env.DB_CULTURAS) : Promise.resolve({ total: 0, asignados: 0, disponibles: 0, mantenimiento: 0, sobrantes: 0 }),
                    c.env.DB_VICEPRESIDENCIA ? fetchStatsFromDB(c.env.DB_VICEPRESIDENCIA) : Promise.resolve({ total: 0, asignados: 0, disponibles: 0, mantenimiento: 0, sobrantes: 0 }),
                ]);
                return {
                    total: s1.total + s2.total + s3.total + s4.total + s5.total,
                    asignados: s1.asignados + s2.asignados + s3.asignados + s4.asignados + s5.asignados,
                    disponibles: s1.disponibles + s2.disponibles + s3.disponibles + s4.disponibles + s5.disponibles,
                    mantenimiento: s1.mantenimiento + s2.mantenimiento + s3.mantenimiento + s4.mantenimiento + s5.mantenimiento,
                    sobrantes: s1.sobrantes + s2.sobrantes + s3.sobrantes + s4.sobrantes + s5.sobrantes,
                };
            };
            const data = await kvCache(c.env.CACHE, 'consolidado:stats', fetchFn, 30);
            return c.json(data);
        }

        const db = getDB(c);
        if (!db) return c.json({ total: 0, asignados: 0, disponibles: 0, mantenimiento: 0, sobrantes: 0 });

        const stats = await fetchStatsFromDB(db);
        return c.json(stats);
    } catch (e: any) {
        return c.json({ total: 0, asignados: 0, disponibles: 0, mantenimiento: 0, sobrantes: 0 });
    }
});

app.get('/usuarios', async (c) => {
    const institution = c.req.header('x-institution') || 'tierras';

    const fetchDBUsuarios = async (db: D1Database, instName: string) => {
        // Intentamos primero la query completa (con ubicacion_fisica_id y cat_piso_id en usuarios)
        try {
            const { results } = await db.prepare(`
                SELECT u.id, u.nombre_completo, u.ci, u.cargo, u.fecha_registro,
                       u.cat_unidad_id, u.ubicacion_fisica_id, u.cat_piso_id,
                       un.nombre as unidad, uf.nombre as edificio, uf.direccion as edificio_direccion,
                       ps.numero as piso,
                       (SELECT uo.oficina_id FROM usuarios_oficinas uo WHERE uo.usuario_id = u.id LIMIT 1) as cat_oficina_id,
                       (SELECT off.nombre FROM cat_oficinas off WHERE off.id = (SELECT uo2.oficina_id FROM usuarios_oficinas uo2 WHERE uo2.usuario_id = u.id LIMIT 1)) as oficina,
                       (SELECT GROUP_CONCAT(off.nombre || ' (' || uf2.nombre || ' - ' || COALESCE(uf2.direccion, 'S/D') || ')', ' | ')
                        FROM usuarios_oficinas uo
                        JOIN cat_oficinas off ON uo.oficina_id = off.id
                        JOIN cat_unidades un2 ON off.unidad_id = un2.id
                        JOIN ubicacion_fisica uf2 ON un2.ubicacion_fisica_id = uf2.id
                        WHERE uo.usuario_id = u.id) as oficinas_detalle
                FROM usuarios u
                LEFT JOIN cat_unidades un ON u.cat_unidad_id = un.id
                LEFT JOIN ubicacion_fisica uf ON u.ubicacion_fisica_id = uf.id
                LEFT JOIN cat_pisos ps ON u.cat_piso_id = ps.id
                ORDER BY u.nombre_completo ASC
            `).all();
            return results.map(r => ({ ...r, institucion: instName }));
        } catch (_fullQueryErr) {
            // Fallback: la DB puede no tener las columnas cat_piso_id / ubicacion_fisica_id en usuarios
            // (necesita ejecutar sql/add_piso_to_usuarios.sql). Usamos query reducida para no perder datos.
            const { results } = await db.prepare(`
                SELECT u.id, u.nombre_completo, u.ci, u.cargo, u.fecha_registro,
                       u.cat_unidad_id,
                       NULL as ubicacion_fisica_id, NULL as cat_piso_id,
                       un.nombre as unidad,
                       NULL as edificio, NULL as edificio_direccion, NULL as piso,
                       (SELECT uo.oficina_id FROM usuarios_oficinas uo WHERE uo.usuario_id = u.id LIMIT 1) as cat_oficina_id,
                       (SELECT off.nombre FROM cat_oficinas off WHERE off.id = (SELECT uo2.oficina_id FROM usuarios_oficinas uo2 WHERE uo2.usuario_id = u.id LIMIT 1)) as oficina,
                       NULL as oficinas_detalle
                FROM usuarios u
                LEFT JOIN cat_unidades un ON u.cat_unidad_id = un.id
                ORDER BY u.nombre_completo ASC
            `).all();
            return results.map(r => ({ ...r, institucion: instName }));
        }
    };

    if (institution === 'consolidado') {
        const result = await kvCache(c.env.CACHE, 'consolidado:usuarios', async () => {
            const [r1, r2, r3, r4, r5] = await Promise.all([
                fetchDBUsuarios(c.env.DB, 'TIERRAS'),
                fetchDBUsuarios(c.env.DB_JUSTICIA, 'JUSTICIA'),
                fetchDBUsuarios(c.env.DB_PRESIDENCIA, 'PRESIDENCIA'),
                c.env.DB_CULTURAS ? fetchDBUsuarios(c.env.DB_CULTURAS, 'CULTURAS') : Promise.resolve([]),
                c.env.DB_VICEPRESIDENCIA ? fetchDBUsuarios(c.env.DB_VICEPRESIDENCIA, 'VICEPRESIDENCIA') : Promise.resolve([]),
            ]);
            return [...r1, ...r2, ...r3, ...r4, ...r5];
        }, 60);
        return c.json(result);
    }

    const db = getDB(c);
    if (!db) return c.json([]);

    const results = await fetchDBUsuarios(db, institution.toUpperCase());
    return c.json(results);
});

app.post('/usuarios', async (c) => {
    const body = await c.req.json();
    const { nombre_completo, ci, cargo, cat_unidad_id, ubicacion_fisica_id, cat_piso_id, oficinas_ids, registrado_por } = body;

    try {
        let db: any = getDB(c);
        if (db === 'CONSOLIDADO') return c.json({ error: 'Operación no permitida en modo consolidado. Seleccione una institución específica para registrar funcionarios.' }, 400);
        if (!db) throw new Error('No se pudo identificar la base de datos destino.');
        const cleanId = (val: any) => (val === '' || val === undefined || val === 'undefined') ? null : val;

        const result = await db.prepare(
            'INSERT INTO usuarios (nombre_completo, ci, cargo, cat_unidad_id, ubicacion_fisica_id, cat_piso_id, registrado_por) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
            nombre_completo ?? '',
            ci ?? '',
            cargo ?? null,
            cleanId(cat_unidad_id),
            cleanId(ubicacion_fisica_id),
            cleanId(cat_piso_id),
            registrado_por ?? null
        ).run();

        const userId = result.meta.last_row_id;

        // Insertar múltiples oficinas en la tabla intermedia
        const finalOffices = [...(oficinas_ids || [])];
        if (finalOffices.length === 0 && body.cat_oficina_id) {
            finalOffices.push(body.cat_oficina_id);
        }

        if (finalOffices.length > 0) {
            const officeStatements = finalOffices.map(oid =>
                db.prepare('INSERT OR IGNORE INTO usuarios_oficinas (usuario_id, oficina_id) VALUES (?, ?)').bind(userId, oid)
            );
            await db.batch(officeStatements);
        }

        await invalidateConsolidadoCache(c.env.CACHE);
        return c.json({ success: true, user: { id: userId, ...body } }, 201);
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 400);
    }
});

// Editar usuario
app.put('/usuarios/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { nombre_completo, ci, cargo, cat_unidad_id, ubicacion_fisica_id, cat_piso_id, oficinas_ids } = body;

    try {
        let db: any = getDB(c);
        if (db === 'CONSOLIDADO') return c.json({ error: 'Operación no permitida en modo consolidado. Seleccione una institución específica para editar funcionarios.' }, 400);
        if (!db) throw new Error('No se pudo identificar la base de datos destino.');
        const cleanId = (val: any) => (val === '' || val === undefined || val === 'undefined') ? null : val;

        await db.prepare(
            'UPDATE usuarios SET nombre_completo=?, ci=?, cargo=?, cat_unidad_id=?, ubicacion_fisica_id=?, cat_piso_id=? WHERE id=?'
        ).bind(
            nombre_completo ?? '',
            ci ?? '',
            cargo ?? null,
            cleanId(cat_unidad_id),
            cleanId(ubicacion_fisica_id),
            cleanId(cat_piso_id),
            id
        ).run();

        // Actualizar oficinas en la tabla intermedia
        if (oficinas_ids && Array.isArray(oficinas_ids)) {
            await db.prepare('DELETE FROM usuarios_oficinas WHERE usuario_id = ?').bind(id).run();
            const officeStatements = oficinas_ids.map(oid =>
                db.prepare('INSERT OR IGNORE INTO usuarios_oficinas (usuario_id, oficina_id) VALUES (?, ?)').bind(id, oid)
            );
            if (officeStatements.length > 0) await db.batch(officeStatements);
        }

        await invalidateConsolidadoCache(c.env.CACHE);
        return c.json({ success: true, id });
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 400);
    }
});

// --- CATALOGOS MANAGEMENT ---

// Auxiliares
app.get('/catalogos/auxiliares', async (c) => {
    try {
        const res = await getDB(c)!.prepare('SELECT a.*, g.nombre as grupo_nombre FROM cat_auxiliares a LEFT JOIN cat_grupos_contables g ON a.cat_grupo_contable_id = g.id WHERE a.activo = 1 ORDER BY a.nombre').all();
        return c.json(res.results || []);
    } catch (e: any) { return c.json({ error: formatError(e) }, 500); }
});

app.post('/catalogos/auxiliares', async (c) => {
    try {
        const { nombre, cat_grupo_contable_id, registrado_por } = await c.req.json();
        const res = await getDB(c)!.prepare('INSERT INTO cat_auxiliares (nombre, cat_grupo_contable_id, registrado_por) VALUES (?, ?, ?) RETURNING *')
            .bind(nombre, cat_grupo_contable_id || null, registrado_por || null).first();
        return c.json(res, 201);
    } catch (e: any) { return c.json({ error: formatError(e) }, 400); }
});

app.put('/catalogos/auxiliares/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const { nombre, cat_grupo_contable_id, activo } = await c.req.json();
        await getDB(c)!.prepare('UPDATE cat_auxiliares SET nombre = ?, cat_grupo_contable_id = ?, activo = ? WHERE id = ?')
            .bind(nombre, cat_grupo_contable_id || null, activo !== undefined ? activo : 1, id).run();
        return c.json({ success: true });
    } catch (e: any) { return c.json({ error: formatError(e) }, 400); }
});

app.delete('/catalogos/auxiliares/:id', async (c) => {
    try {
        await getDB(c)!.prepare('DELETE FROM cat_auxiliares WHERE id = ?').bind(c.req.param('id')).run();
        return c.json({ success: true });
    } catch (e: any) { return c.json({ error: formatError(e) }, 400); }
});

// Grupos Contables
app.get('/catalogos/grupos', async (c) => {
    try {
        const res = await getDB(c)!.prepare('SELECT * FROM cat_grupos_contables WHERE activo = 1 ORDER BY nombre').all();
        return c.json(res.results || []);
    } catch (e: any) { return c.json({ error: formatError(e) }, 500); }
});

app.post('/catalogos/grupos', async (c) => {
    try {
        const { nombre, vida_util, observaciones, registrado_por } = await c.req.json();
        const res = await getDB(c)!.prepare('INSERT INTO cat_grupos_contables (nombre, vida_util, observaciones, registrado_por) VALUES (?, ?, ?, ?) RETURNING *')
            .bind(nombre, vida_util || null, observaciones || null, registrado_por || null).first();
        return c.json(res, 201);
    } catch (e: any) { return c.json({ error: formatError(e) }, 400); }
});

app.put('/catalogos/grupos/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const { nombre, vida_util, observaciones, activo } = await c.req.json();
        await getDB(c)!.prepare('UPDATE cat_grupos_contables SET nombre = ?, vida_util = ?, observaciones = ?, activo = ? WHERE id = ?')
            .bind(nombre, vida_util || null, observaciones || null, activo !== undefined ? activo : 1, id).run();
        return c.json({ success: true });
    } catch (e: any) { return c.json({ error: formatError(e) }, 400); }
});

app.delete('/catalogos/grupos/:id', async (c) => {
    try {
        await getDB(c)!.prepare('DELETE FROM cat_grupos_contables WHERE id = ?').bind(c.req.param('id')).run();
        return c.json({ success: true });
    } catch (e: any) { return c.json({ error: formatError(e) }, 400); }
});

// Ubicaciones Físicas
app.get('/catalogos/ubicaciones', async (c) => {
    try {
        const res = await getDB(c)!.prepare('SELECT * FROM ubicacion_fisica WHERE activo = 1 ORDER BY nombre').all();
        return c.json(res.results || []);
    } catch (e: any) { return c.json({ error: formatError(e) }, 500); }
});

app.post('/catalogos/ubicaciones', async (c) => {
    try {
        const { nombre, direccion, observaciones, registrado_por } = await c.req.json();
        const res = await getDB(c)!.prepare('INSERT INTO ubicacion_fisica (nombre, direccion, observaciones, registrado_por) VALUES (?, ?, ?, ?) RETURNING *')
            .bind(nombre, direccion || null, observaciones || null, registrado_por || null).first();
        return c.json(res, 201);
    } catch (e: any) { return c.json({ error: formatError(e) }, 400); }
});

app.put('/catalogos/ubicaciones/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const { nombre, direccion, observaciones, activo } = await c.req.json();
        await getDB(c)!.prepare('UPDATE ubicacion_fisica SET nombre = ?, direccion = ?, observaciones = ?, activo = ? WHERE id = ?')
            .bind(nombre, direccion || null, observaciones || null, activo !== undefined ? activo : 1, id).run();
        return c.json({ success: true });
    } catch (e: any) {
        console.error("PUT /ubicaciones ERROR:", e);
        return c.json({ error: formatError(e) }, 400);
    }
});

app.delete('/catalogos/ubicaciones/:id', async (c) => {
    try {
        await getDB(c)!.prepare('DELETE FROM ubicacion_fisica WHERE id = ?').bind(c.req.param('id')).run();
        return c.json({ success: true });
    } catch (e: any) { return c.json({ error: formatError(e) }, 400); }
});

// Unidades
app.get('/catalogos/unidades', async (c) => {
    try {
        const res = await getDB(c)!.prepare('SELECT * FROM cat_unidades WHERE activo = 1 ORDER BY nombre').all();
        return c.json(res.results || []);
    } catch (e: any) { return c.json({ error: formatError(e) }, 500); }
});

app.post('/catalogos/unidades', async (c) => {
    try {
        const { nombre, ubicacion_fisica_id } = await c.req.json();
        const res = await getDB(c)!.prepare('INSERT INTO cat_unidades (nombre, ubicacion_fisica_id) VALUES (?, ?) RETURNING *')
            .bind(nombre, ubicacion_fisica_id || null).first();
        return c.json(res, 201);
    } catch (e: any) { return c.json({ error: formatError(e) }, 400); }
});

app.put('/catalogos/unidades/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const { nombre, ubicacion_fisica_id, activo } = await c.req.json();
        await getDB(c)!.prepare('UPDATE cat_unidades SET nombre = ?, ubicacion_fisica_id = ?, activo = ? WHERE id = ?')
            .bind(nombre, ubicacion_fisica_id || null, activo !== undefined ? activo : 1, id).run();
        return c.json({ success: true });
    } catch (e: any) { return c.json({ error: formatError(e) }, 400); }
});

app.delete('/catalogos/unidades/:id', async (c) => {
    try {
        await getDB(c)!.prepare('DELETE FROM cat_unidades WHERE id = ?').bind(c.req.param('id')).run();
        return c.json({ success: true });
    } catch (e: any) { return c.json({ error: formatError(e) }, 400); }
});

// Oficinas
app.get('/catalogos/oficinas', async (c) => {
    try {
        const res = await getDB(c)!.prepare('SELECT * FROM cat_oficinas WHERE activo = 1 ORDER BY nombre').all();
        return c.json(res.results || []);
    } catch (e: any) { return c.json({ error: formatError(e) }, 500); }
});

app.post('/catalogos/oficinas', async (c) => {
    try {
        const { nombre, unidad_id } = await c.req.json();
        const res = await getDB(c)!.prepare('INSERT INTO cat_oficinas (nombre, unidad_id) VALUES (?, ?) RETURNING *')
            .bind(nombre, unidad_id || null).first();
        return c.json(res, 201);
    } catch (e: any) { return c.json({ error: formatError(e) }, 400); }
});

app.put('/catalogos/oficinas/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const { nombre, unidad_id, activo } = await c.req.json();
        await getDB(c)!.prepare('UPDATE cat_oficinas SET nombre = ?, unidad_id = ?, activo = ? WHERE id = ?')
            .bind(nombre, unidad_id || null, activo !== undefined ? activo : 1, id).run();
        return c.json({ success: true });
    } catch (e: any) { return c.json({ error: formatError(e) }, 400); }
});

app.delete('/catalogos/oficinas/:id', async (c) => {
    try {
        await getDB(c)!.prepare('DELETE FROM cat_oficinas WHERE id = ?').bind(c.req.param('id')).run();
        return c.json({ success: true });
    } catch (e: any) { return c.json({ error: formatError(e) }, 400); }
});

// Pisos
app.get('/catalogos/pisos', async (c) => {
    try {
        const res = await getDB(c)!.prepare('SELECT * FROM cat_pisos WHERE activo = 1 ORDER BY numero').all();
        return c.json(res.results || []);
    } catch (e: any) { return c.json({ error: formatError(e) }, 500); }
});

app.post('/catalogos/pisos', async (c) => {
    try {
        const { numero } = await c.req.json();
        const res = await getDB(c)!.prepare('INSERT INTO cat_pisos (numero) VALUES (?) RETURNING *')
            .bind(numero).first();
        return c.json(res, 201);
    } catch (e: any) { return c.json({ error: formatError(e) }, 400); }
});

app.put('/catalogos/pisos/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const { numero, activo } = await c.req.json();
        await getDB(c)!.prepare('UPDATE cat_pisos SET numero = ?, activo = ? WHERE id = ?')
            .bind(numero, activo !== undefined ? activo : 1, id).run();
        return c.json({ success: true });
    } catch (e: any) { return c.json({ error: formatError(e) }, 400); }
});

app.delete('/catalogos/pisos/:id', async (c) => {
    try {
        await getDB(c)!.prepare('DELETE FROM cat_pisos WHERE id = ?').bind(c.req.param('id')).run();
        return c.json({ success: true });
    } catch (e: any) { return c.json({ error: formatError(e) }, 400); }
});

// --- ACTIVOS ---
app.get('/activos', async (c) => {
    const institution = c.req.header('x-institution') || 'tierras';
    const estado = c.req.query('estado');

    const fetchDBActivos = async (db: D1Database, instName: string) => {
        let query = `
            SELECT a.*, 
                   u.nombre_completo as usuario_nombre, u.ci as usuario_ci, u.cargo as usuario_cargo,
                   uf.nombre as edificio, un.nombre as unidad, of.nombre as oficina, ps.numero as piso,
                   aux.nombre as auxiliar, grp.nombre as grupo_contable,
                   grp.vida_util as grupo_vida_util, grp.observaciones as grupo_observaciones
            FROM activos a
            LEFT JOIN usuarios u ON a.usuario_actual_id = u.id
            LEFT JOIN ubicacion_fisica uf ON a.ubicacion_fisica_id = uf.id
            LEFT JOIN cat_unidades un ON a.cat_unidad_id = un.id
            LEFT JOIN cat_oficinas of ON a.cat_oficina_id = of.id
            LEFT JOIN cat_pisos ps ON a.cat_piso_id = ps.id
            LEFT JOIN cat_auxiliares aux ON a.cat_auxiliar_id = aux.id
            LEFT JOIN cat_grupos_contables grp ON a.cat_grupo_contable_id = grp.id
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
            const [r1, r2, r3, r4, r5] = await Promise.all([
                fetchDBActivos(c.env.DB, 'TIERRAS'),
                fetchDBActivos(c.env.DB_JUSTICIA, 'JUSTICIA'),
                fetchDBActivos(c.env.DB_PRESIDENCIA, 'PRESIDENCIA'),
                c.env.DB_CULTURAS ? fetchDBActivos(c.env.DB_CULTURAS, 'CULTURAS') : Promise.resolve([]),
                c.env.DB_VICEPRESIDENCIA ? fetchDBActivos(c.env.DB_VICEPRESIDENCIA, 'VICEPRESIDENCIA') : Promise.resolve([])
            ]);
            return [...r1, ...r2, ...r3, ...r4, ...r5];
        }, 60);
        return c.json(result);
    }

    const db = getDB(c);
    if (!db) return c.json([]);

    const results = await fetchDBActivos(db, institution.toUpperCase());
    return c.json(results);
});

// Activos asignados a un usuario específico (para Devolución)
app.get('/activos/usuario/:id', async (c) => {
    const userId = c.req.param('id');
    try {
        const db = getDB(c);
        if (!db) return c.json([]);

        const rows = await db.prepare(
            `SELECT a.id, a.codigo_activo, a.descripcion, a.estado_actual,
                    uf.nombre as edificio, cat_u.nombre as unidad, cat_o.nombre as oficina, cat_p.numero as piso,
                    ac.id as last_acta_id, ac.numero_acta,
                    da.estado_fisico
             FROM activos a
             LEFT JOIN detalles_acta da ON da.activo_id = a.id
             LEFT JOIN actas ac ON ac.id = da.acta_id AND ac.tipo_acta = 'Asignación'
             LEFT JOIN ubicacion_fisica uf ON a.ubicacion_fisica_id = uf.id
             LEFT JOIN cat_unidades cat_u ON a.cat_unidad_id = cat_u.id
             LEFT JOIN cat_oficinas cat_o ON a.cat_oficina_id = cat_o.id
             LEFT JOIN cat_pisos cat_p ON a.cat_piso_id = cat_p.id
             WHERE a.usuario_actual_id = ?
               AND a.estado_actual = 'Asignado'
               AND da.id = (
                   SELECT da2.id FROM detalles_acta da2
                   JOIN actas ac2 ON ac2.id = da2.acta_id
                   WHERE da2.activo_id = a.id AND ac2.tipo_acta = 'Asignación'
                   ORDER BY da2.id DESC LIMIT 1
               )
             ORDER BY cat_o.nombre, a.codigo_activo`
        ).bind(userId).all();
        return c.json(rows.results || []);
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 400);
    }
});

// Crear activo individual

app.post('/activos', async (c) => {
    try {
        const db = requireMutationDB(c);
        if (!db) return c.json({ error: 'Selección requerida', message: 'No se puede registrar activos en modo CONSOLIDADO. Seleccione una institución específica (Tierras, Justicia, Presidencia, etc.)' }, 400);
        const data = await c.req.json();
        const {
            codigo_activo, descripcion, serie, estado_actual,
            ubicacion_fisica_id, cat_unidad_id, cat_oficina_id, cat_piso_id,
            cat_auxiliar_id, cat_grupo_contable_id, registrado_por } = data;

        const cleanId = (val: any) => (val === '' || val === undefined || val === 'undefined') ? null : val;

        const result = await db.prepare(`
            INSERT INTO activos (
                codigo_activo, descripcion, estado_actual, 
                ubicacion_fisica_id, cat_unidad_id, cat_oficina_id, cat_piso_id,
                cat_auxiliar_id, cat_grupo_contable_id, registrado_por
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            codigo_activo,
            descripcion,
            estado_actual || 'Disponible',
            cleanId(ubicacion_fisica_id),
            cleanId(cat_unidad_id),
            cleanId(cat_oficina_id),
            cleanId(cat_piso_id),
            cleanId(cat_auxiliar_id),
            cleanId(cat_grupo_contable_id),
            registrado_por || null
        ).run();
        const id = result.meta.last_row_id;
        await invalidateConsolidadoCache(c.env.CACHE);
        return c.json({ success: true, id, activo: { id, ...data } }, 201);
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 400);
    }
});


// Liberar activo (retornar a Disponible, sin responsable)
app.put('/activos/:id/liberar', async (c) => {
    const id = c.req.param('id');
    try {
        await getDB(c)!.prepare(
            'UPDATE activos SET estado_actual = ?, usuario_actual_id = NULL, ubicacion_fisica_id = NULL, cat_unidad_id = NULL, cat_oficina_id = NULL, cat_piso_id = NULL WHERE id = ?'
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
    try {
        const db = getDB(c)!;
        const data = await c.req.json();
        const { codigo_activo, descripcion, serie, estado_actual,
            ubicacion_fisica_id, cat_unidad_id, cat_oficina_id, cat_piso_id,
            cat_auxiliar_id, cat_grupo_contable_id } = data;

        await db.prepare(`
            UPDATE activos SET 
                codigo_activo = ?, descripcion = ?, estado_actual = ?,
                ubicacion_fisica_id = ?, cat_unidad_id = ?, cat_oficina_id = ?, cat_piso_id = ?,
                cat_auxiliar_id = ?, cat_grupo_contable_id = ?
            WHERE id = ?
        `).bind(
            codigo_activo, descripcion, estado_actual,
            ubicacion_fisica_id || null, cat_unidad_id || null, cat_oficina_id || null, cat_piso_id || null,
            cat_auxiliar_id || null, cat_grupo_contable_id || null,
            id
        ).run();
        await invalidateConsolidadoCache(c.env.CACHE);
        return c.json({ success: true, id });
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 400);
    }
});

// Borrado físico de activo (Solo para sobrantes o corrección)
app.delete('/activos/:id', async (c) => {
    const id = c.req.param('id');
    try {
        const db = getDB(c);
        if (!db) return c.json({ error: 'DB no disponible' }, 500);

        // Borrar referencias primero
        await db.batch([
            db.prepare('DELETE FROM auditorias_fisicas WHERE activo_id = ?').bind(id),
            db.prepare('DELETE FROM detalles_acta WHERE activo_id = ?').bind(id),
            db.prepare('DELETE FROM activos WHERE id = ?').bind(id)
        ]);

        await invalidateConsolidadoCache(c.env.CACHE);
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 500);
    }
});

// Asignación rápida desde auditoría
app.put('/activos/:id/auditoria-asignar', async (c) => {
    const id = c.req.param('id');
    const {
        descripcion, cat_auxiliar_id, cat_grupo_contable_id,
        origen, usuario_auditado_id, realizado_por,
        // Ubicación personalizada (opcional — si no se envía, se hereda del usuario)
        ubicacion_fisica_id: ubicPersonalizada,
        cat_unidad_id: unidadPersonalizada,
        cat_oficina_id: oficinaPersonalizada,
        cat_piso_id: pisoPersonalizado,
    } = await c.req.json();

    try {
        const db = getDB(c);
        if (!db) return c.json({ error: 'DB no disponible' }, 500);

        // 1. Obtener datos del usuario para heredar ubicación si no se especifica
        const user = await db.prepare('SELECT cat_unidad_id, ubicacion_fisica_id, cat_piso_id FROM usuarios WHERE id = ?').bind(usuario_auditado_id).first();
        if (!user) throw new Error('Usuario no encontrado');

        // 2. Obtener oficina del usuario como fallback
        const office = await db.prepare('SELECT oficina_id FROM usuarios_oficinas WHERE usuario_id = ? LIMIT 1').bind(usuario_auditado_id).first();

        // 3. Resolver ubicación: priorizar la personalizada, luego la del usuario
        const finalUbicacion = ubicPersonalizada || (user as any).ubicacion_fisica_id;
        const finalUnidad = unidadPersonalizada || (user as any).cat_unidad_id;
        const finalOficina = oficinaPersonalizada !== undefined ? (oficinaPersonalizada || null) : ((office as any)?.oficina_id || null);
        const finalPiso = pisoPersonalizado || (user as any).cat_piso_id || null;

        // 4. Actualizar activo
        await db.prepare(`
            UPDATE activos SET 
                descripcion = ?, 
                cat_auxiliar_id = ?, 
                cat_grupo_contable_id = ?, 
                origen = ?, 
                estado_actual = 'Asignado',
                usuario_actual_id = ?,
                cat_unidad_id = ?,
                ubicacion_fisica_id = ?,
                cat_oficina_id = ?,
                cat_piso_id = ?
            WHERE id = ?
        `).bind(
            descripcion,
            cat_auxiliar_id || null,
            cat_grupo_contable_id || null,
            origen || 'Sobrante',
            usuario_auditado_id,
            finalUnidad,
            finalUbicacion,
            finalOficina,
            finalPiso,
            id
        ).run();

        // 5. Actualizar registro de auditoría a 'Correcto'
        await db.prepare(`
            UPDATE auditorias_fisicas 
            SET hallazgo = 'Correcto', realizado_por = ? 
            WHERE usuario_auditado_id = ? AND activo_id = ?
        `).bind(realizado_por || null, usuario_auditado_id, id).run();

        await invalidateConsolidadoCache(c.env.CACHE);
        return c.json({ success: true });
    } catch (e: any) {
        console.error("Error auditoria-asignar:", e.message);
        return c.json({ error: formatError(e) }, 400);
    }
});





// Activos disponibles
app.get('/activos/disponibles', async (c) => {
    let db: any = getDB(c);
    if (db === 'CONSOLIDADO') db = c.env.DB;
    if (!db) return c.json([]);

    const { results } = await db.prepare(
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
                       a.ubicacion_fisica_id, a.cat_unidad_id, a.cat_oficina_id, a.cat_piso_id,
                       uf.nombre as a_edificio, cat_au.nombre as a_unidad, cat_ao.nombre as a_oficina, cat_ap.numero as a_piso,
                       (SELECT ac.id FROM detalles_acta da JOIN actas ac ON da.acta_id = ac.id WHERE da.activo_id = a.id AND ac.tipo_acta='Asignación' ORDER BY ac.fecha_emision DESC LIMIT 1) as last_acta_id,
                       (SELECT ac.realizado_por FROM detalles_acta da JOIN actas ac ON da.acta_id = ac.id WHERE da.activo_id = a.id AND ac.tipo_acta='Asignación' ORDER BY ac.fecha_emision DESC LIMIT 1) as realizado_por,
                       (SELECT da.estado_fisico FROM detalles_acta da JOIN actas ac ON da.acta_id = ac.id WHERE da.activo_id = a.id AND ac.tipo_acta='Asignación' ORDER BY ac.fecha_emision DESC LIMIT 1) as estado_fisico,
                       (SELECT ac2.observaciones FROM actas ac2 WHERE ac2.usuario_id = u.id AND ac2.tipo_acta='Asignación' ORDER BY ac2.fecha_emision DESC LIMIT 1) as observaciones,
                       u.id as usuario_id, u.nombre_completo, u.ci, u.cargo,
                       NULL as u_edificio, NULL as u_unidad,
                       (SELECT GROUP_CONCAT(off.nombre, ', ') FROM usuarios_oficinas uo JOIN cat_oficinas off ON uo.oficina_id = off.id WHERE uo.usuario_id = u.id) as u_oficinas
                FROM activos a
                JOIN usuarios u ON a.usuario_actual_id = u.id
                LEFT JOIN ubicacion_fisica uf ON a.ubicacion_fisica_id = uf.id
                LEFT JOIN cat_unidades cat_au ON a.cat_unidad_id = cat_au.id
                LEFT JOIN cat_oficinas cat_ao ON a.cat_oficina_id = cat_ao.id
                LEFT JOIN cat_pisos cat_ap ON a.cat_piso_id = cat_ap.id
                WHERE a.estado_actual = 'Asignado'
                ORDER BY u.nombre_completo ASC, a_oficina ASC, a.codigo_activo ASC
            `).all();
            return results.map(r => ({ ...r, institucion: instName }));
        };

        let allResults = [];
        if (institution === 'consolidado') {
            const promises = [
                fetchDBAgrupados(c.env.DB, 'TIERRAS'),
                fetchDBAgrupados(c.env.DB_JUSTICIA, 'JUSTICIA'),
                fetchDBAgrupados(c.env.DB_PRESIDENCIA, 'PRESIDENCIA')
            ];
            if (c.env.DB_CULTURAS) promises.push(fetchDBAgrupados(c.env.DB_CULTURAS, 'CULTURAS'));
            if (c.env.DB_VICEPRESIDENCIA) promises.push(fetchDBAgrupados(c.env.DB_VICEPRESIDENCIA, 'VICEPRESIDENCIA'));

            const resultsArrays = await Promise.all(promises);
            allResults = resultsArrays.flat();
        } else {
            const db = getDB(c);
            if (!db) return c.json([]);
            allResults = await fetchDBAgrupados(db, institution.toUpperCase());
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

            const edificio = row.a_edificio || row.u_edificio;
            const unidad = row.a_unidad || row.u_unidad;
            const oficinas = row.a_oficina || row.u_oficinas || '';
            const piso = row.a_piso || '';

            const keyOficina = `${edificio || ''}|${unidad || ''}|${oficinas || ''}|${piso || ''}`;

            if (!persona.ubicaciones.has(keyOficina)) {
                persona.ubicaciones.set(keyOficina, {
                    usuario_id: row.usuario_id,
                    edificio: edificio,
                    unidad: unidad,
                    oficina: oficinas,
                    piso: piso,
                    institucion: row.institucion,
                    acta_id: row.last_acta_id || null,
                    acta_numero: row.last_acta_id ? String(row.last_acta_id).padStart(5, '0') : null,
                    observaciones: row.observaciones || null,
                    activos: []
                });
            } else if (row.last_acta_id && (!persona.ubicaciones.get(keyOficina).acta_id || row.last_acta_id > persona.ubicaciones.get(keyOficina).acta_id)) {
                // Actualizar a la última acta si encontramos una más reciente para esta misma ubicación
                const ub = persona.ubicaciones.get(keyOficina);
                ub.acta_id = row.last_acta_id;
                ub.acta_numero = String(row.last_acta_id).padStart(5, '0');
            }

            persona.ubicaciones.get(keyOficina).activos.push({
                id: row.id,
                codigo_activo: row.codigo_activo,
                descripcion: row.descripcion,
                estado_actual: row.estado_actual,
                estado_fisico: row.estado_fisico || 'Bueno',
                last_acta_id: row.last_acta_id,
                realizado_por: row.realizado_por,
                institucion: row.institucion,
                ubicacion_fisica_id: row.ubicacion_fisica_id,
                cat_unidad_id: row.cat_unidad_id,
                cat_oficina_id: row.cat_oficina_id,
                cat_piso_id: row.cat_piso_id
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

// Activo por ID
app.get('/activos/:id', async (c) => {
    let db: any = getDB(c);
    if (db === 'CONSOLIDADO') db = c.env.DB; // En Tierras por defecto o manejar según necesite
    if (!db) return c.json({ error: 'DB no disponible' }, 500);

    const id = c.req.param('id');
    try {
        const { results } = await db.prepare('SELECT * FROM activos WHERE id = ?').bind(id).all();
        if (results.length === 0) return c.json({ error: 'Activo no encontrado' }, 404);
        return c.json(results[0]);
    } catch (e: any) {
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
                SELECT a.*, u.nombre_completo as usuario, ? as institucion,
                       COALESCE(uf.nombre, u_uf.nombre) as ubicacion_fisica,
                       COALESCE(un.nombre, u_un.nombre) as unidad,
                       COALESCE(ofc.nombre, (SELECT off.nombre FROM cat_oficinas off WHERE off.id = (SELECT uo.oficina_id FROM usuarios_oficinas uo WHERE uo.usuario_id = u.id LIMIT 1))) as oficina
                FROM actas a
                JOIN usuarios u ON a.usuario_id = u.id
                LEFT JOIN ubicacion_fisica uf ON a.ubicacion_fisica_id = uf.id
                LEFT JOIN cat_unidades un ON a.cat_unidad_id = un.id
                LEFT JOIN cat_oficinas ofc ON a.cat_oficina_id = ofc.id
                LEFT JOIN ubicacion_fisica u_uf ON u.ubicacion_fisica_id = u_uf.id
                LEFT JOIN cat_unidades u_un ON u.cat_unidad_id = u_un.id
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
            const promises = [
                fetchActasFromDB(c.env.DB, 'TIERRAS'),
                fetchActasFromDB(c.env.DB_JUSTICIA, 'JUSTICIA'),
                fetchActasFromDB(c.env.DB_PRESIDENCIA, 'PRESIDENCIA')
            ];
            if (c.env.DB_CULTURAS) promises.push(fetchActasFromDB(c.env.DB_CULTURAS, 'CULTURAS'));
            if (c.env.DB_VICEPRESIDENCIA) promises.push(fetchActasFromDB(c.env.DB_VICEPRESIDENCIA, 'VICEPRESIDENCIA'));

            const resultsArrays = await Promise.all(promises);
            return c.json(resultsArrays.flat().sort((a: any, b: any) =>
                new Date(b.fecha_emision).getTime() - new Date(a.fecha_emision).getTime()
            ));
        }

        const db = getDB(c);
        if (!db) return c.json([]);

        const results = await fetchActasFromDB(db, institution.toUpperCase());
        return c.json(results);
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 500);
    }
});

app.post('/actas', async (c) => {
    const body = await c.req.json();
    const { tipo_acta, usuario_id, activos_seleccionados, observaciones, ubicacion_fisica_id, cat_unidad_id, cat_oficina_id, cat_piso_id, appendToActaId, realizado_por } = body;

    if (!usuario_id) {
        return c.json({ error: "Faltan datos obligatorios", message: "El ID del usuario es requerido para generar el acta." }, 400);
    }

    if (!activos_seleccionados || !Array.isArray(activos_seleccionados)) {
        return c.json({ error: "Faltan datos obligatorios", message: "La lista de activos seleccionados es requerida." }, 400);
    }

    let actaId = appendToActaId ? Number(appendToActaId) : null;

    try {
        const institution = (c.req.header('x-institution') || '').toLowerCase();
        const db = getDB(c);
        if (!db) {
            return c.json({
                error: 'Operación no permitida',
                message: institution === 'consolidado'
                    ? 'No se puede generar un acta en modo CONSOLIDADO. Por favor seleccione una institución específica (Tierras, Justicia, Presidencia, etc.)'
                    : 'No se pudo identificar la base de datos para esta institución. Verifique que la institución esté correctamente configurada.'
            }, 400);
        }
        if (!actaId) {
            // 1. Crear el acta con snapshot de ubicación si no hay ID de acta para aumentar
            const batchResult = await db.batch([
                db.prepare('INSERT INTO actas (tipo_acta, usuario_id, observaciones, ubicacion_fisica_id, cat_unidad_id, cat_oficina_id, cat_piso_id, realizado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                    .bind(tipo_acta, usuario_id, observaciones ?? null, ubicacion_fisica_id ?? null, cat_unidad_id ?? null, cat_oficina_id ?? null, cat_piso_id ?? null, realizado_por ?? null)
            ]);
            actaId = batchResult[0].meta.last_row_id;
        }

        const detailStatements = [];
        const statusUpdateStatements = [];

        // Lógica de estados y responsables
        const nuevoEstado = tipo_acta === 'Asignación' ? 'Asignado' : 'Disponible';
        const nuevoResponsable = tipo_acta === 'Asignación' ? usuario_id : null;

        // Ubicación de destino
        const dest_ubicacion_fisica = tipo_acta === 'Asignación' ? (ubicacion_fisica_id || null) : null;
        const dest_cat_unidad = tipo_acta === 'Asignación' ? (cat_unidad_id || null) : null;
        const dest_cat_oficina = tipo_acta === 'Asignación' ? (cat_oficina_id || null) : null;
        const dest_cat_piso = tipo_acta === 'Asignación' ? (cat_piso_id || null) : null;

        for (const item of activos_seleccionados) {
            detailStatements.push(
                db.prepare('INSERT INTO detalles_acta (acta_id, activo_id, estado_fisico) VALUES (?, ?, ?)')
                    .bind(actaId, item.id, item.estado_fisico)
            );
            statusUpdateStatements.push(
                db.prepare('UPDATE activos SET estado_actual = ?, usuario_actual_id = ?, ubicacion_fisica_id = ?, cat_unidad_id = ?, cat_oficina_id = ?, cat_piso_id = ? WHERE id = ?')
                    .bind(nuevoEstado, nuevoResponsable ?? null, dest_ubicacion_fisica ?? null, dest_cat_unidad ?? null, dest_cat_oficina ?? null, dest_cat_piso ?? null, item.id)
            );
        }

        await db.batch([...detailStatements, ...statusUpdateStatements]);

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

// --- BULK IMPORT (Soportando IDs de Catálogo) ---
app.post('/activos/bulk', async (c) => {
    const assets = await c.req.json();
    if (!Array.isArray(assets)) return c.json({ error: 'Formato inválido' }, 400);

    const formatEstado = (est: string) => {
        if (!est) return 'Disponible';
        const e = est.trim().toLowerCase();
        if (e.includes('asign')) return 'Asignado';
        if (e.includes('manten')) return 'Mantenimiento';
        return 'Disponible';
    };

    const db = getDB(c);
    if (!db) return c.json({ error: 'DB no disponible' }, 500);

    const statements = assets.map(a =>
        db.prepare(`
            INSERT OR IGNORE INTO activos (
                codigo_activo, descripcion, estado_actual,
                ubicacion_fisica_id, cat_unidad_id, cat_oficina_id, cat_piso_id, 
                cat_auxiliar_id, cat_grupo_contable_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            a.codigo_activo ?? '',
            a.descripcion ?? '',
            formatEstado(a.estado_actual),
            a.ubicacion_fisica_id || null,
            a.cat_unidad_id || null,
            a.cat_oficina_id || null,
            a.cat_piso_id || null,
            a.cat_auxiliar_id || null,
            a.cat_grupo_contable_id || null
        )
    );

    try {
        await db.batch(statements);
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

        const results = { created_users: 0, created_assets: 0, created_catalogs: 0, failed: 0 };
        const db = getDB(c);
        if (!db) return c.json({ error: 'DB no disponible' }, 500);

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

        // 2. CARGA DE CATÁLOGOS PARA RESOLUCIÓN DE NOMBRES (Cache en memoria por request)
        const ubisMap = new Map<string, number>();
        const unitsMap = new Map<string, number>();
        const officesMap = new Map<string, number>();
        const floorsMap = new Map<string, number>();
        const auxsMap = new Map<string, number>();
        const groupsMap = new Map<string, number>();

        if (type === 'full' || type === 'assets' || type === 'users' || type === 'auxiliares') {
            const [u, un, of, fl, aux, grp] = await Promise.all([
                db.prepare('SELECT id, nombre FROM ubicacion_fisica').all(),
                db.prepare('SELECT id, nombre FROM cat_unidades').all(),
                db.prepare('SELECT id, nombre FROM cat_oficinas').all(),
                db.prepare('SELECT id, numero FROM cat_pisos').all(),
                db.prepare('SELECT id, nombre FROM cat_auxiliares').all(),
                db.prepare('SELECT id, nombre FROM cat_grupos_contables').all()
            ]);
            u.results?.forEach((r: any) => ubisMap.set(String(r.nombre).trim().toLowerCase(), r.id));
            un.results?.forEach((r: any) => unitsMap.set(String(r.nombre).trim().toLowerCase(), r.id));
            of.results?.forEach((r: any) => officesMap.set(String(r.nombre).trim().toLowerCase(), r.id));
            fl.results?.forEach((r: any) => floorsMap.set(String(r.numero).trim().toLowerCase(), r.id));
            aux.results?.forEach((r: any) => auxsMap.set(String(r.nombre).trim().toLowerCase(), r.id));
            grp.results?.forEach((r: any) => groupsMap.set(String(r.nombre).trim().toLowerCase(), r.id));
        }

        // Helper para resolver o crear catálogo simple (Pisos, Auxiliares, etc.)
        const resolveCatalog = async (table: string, col: string, val: string, cache: Map<string, number>): Promise<number | null> => {
            if (!val) return null;
            const v = String(val).trim();
            const vk = v.toLowerCase();
            if (cache.has(vk)) return cache.get(vk)!;
            try {
                const res = await db.prepare(`INSERT OR IGNORE INTO ${table} (${col}) VALUES (?) RETURNING id`).bind(v).first();
                let id = res?.id;
                if (!id) {
                    const existing = await db.prepare(`SELECT id FROM ${table} WHERE ${col} = ?`).bind(v).first();
                    id = existing?.id;
                }
                if (id) cache.set(vk, id);
                return id || null;
            } catch { return null; }
        };

        // 3. FUNCIÓN DE FORMATO
        const formatEstado = (est: string, hasUser: boolean) => {
            if (!est) return hasUser ? 'Asignado' : 'Disponible';
            const e = est.trim().toLowerCase();
            if (e.includes('asign')) return 'Asignado';
            if (e.includes('manten')) return 'Mantenimiento';
            return 'Disponible';
        };

        // 4. PROCESAMIENTO E INSERCIONES EN LOTES
        const BATCH_SIZE = 80;

        for (let i = 0; i < data.length; i += BATCH_SIZE) {
            const batch = data.slice(i, i + BATCH_SIZE);
            const userStatements: any[] = [];
            const assetStatements: any[] = [];
            const catalogStatements: any[] = [];

            // a) Usuarios con resolución de Ubicación y Unidad
            const newUsersInBatch = new Set<string>();
            for (const item of batch) {
                if (!item.responsable_ci && !item.ci) continue;
                const ciStr = String(item.responsable_ci || item.ci).trim();
                const nombre = item.responsable_nombre || item.nombre_completo || 'S/N';

                if (!usuariosMap.has(ciStr) && !newUsersInBatch.has(ciStr) && (type === 'full' || type === 'users')) {
                    // Resolución de ubicación y unidad para el usuario
                    const uId = await resolveCatalog('ubicacion_fisica', 'nombre', item.edificio, ubisMap);
                    const unId = await resolveCatalog('cat_unidades', 'nombre', item.unidad, unitsMap);
                    const flId = await resolveCatalog('cat_pisos', 'numero', item.piso, floorsMap);

                    userStatements.push(
                        db.prepare('INSERT INTO usuarios (nombre_completo, ci, cargo, ubicacion_fisica_id, cat_unidad_id, cat_piso_id) VALUES (?, ?, ?, ?, ?, ?)')
                            .bind(nombre, ciStr, item.responsable_cargo || item.cargo || null, uId, unId, flId)
                    );
                    newUsersInBatch.add(ciStr);
                }
            }

            if (userStatements.length > 0) {
                try {
                    await db.batch(userStatements);
                    // IMPORTANTE: Después de insertar usuarios, necesitamos sus IDs reales para el mapeo de activos
                    const { results: usuariosExtraidos } = await db.prepare('SELECT id, ci FROM usuarios').all();
                    usuariosExtraidos?.forEach((u: any) => {
                        if (u.ci) usuariosMap.set(String(u.ci).trim(), u.id);
                    });
                    results.created_users += userStatements.length;
                } catch (e: any) { console.error("Error usuarios:", e.message); }
            }

            // b) Activos con resolución de catálogos completa (Estructura 4NF)
            if (type === 'full' || type === 'assets') {
                for (const item of batch) {
                    try {
                        const ciStr = item.responsable_ci ? String(item.responsable_ci).trim() : null;
                        const userId = ciStr ? usuariosMap.get(ciStr) || null : null;

                        // Resolución Inteligente de IDs por nombre
                        const uId = await resolveCatalog('ubicacion_fisica', 'nombre', item.edificio || item.ubicacion, ubisMap);
                        const unId = await resolveCatalog('cat_unidades', 'nombre', item.unidad, unitsMap);
                        const ofId = await resolveCatalog('cat_oficinas', 'nombre', item.oficina, officesMap);
                        const flId = await resolveCatalog('cat_pisos', 'numero', item.piso, floorsMap);
                        const grpId = await resolveCatalog('cat_grupos_contables', 'nombre', item.grupo_contable, groupsMap);

                        // Para auxiliares, incluimos el grupo si es nuevo
                        let auxId = null;
                        if (item.auxiliar) {
                            const vk = String(item.auxiliar).trim().toLowerCase();
                            if (auxsMap.has(vk)) {
                                auxId = auxsMap.get(vk);
                            } else {
                                // Crear con el grupo resuelto
                                try {
                                    const res = await db.prepare('INSERT OR IGNORE INTO cat_auxiliares (nombre, cat_grupo_contable_id) VALUES (?, ?) RETURNING id')
                                        .bind(String(item.auxiliar).trim(), grpId).first();
                                    auxId = res?.id;
                                    if (!auxId) auxId = (await db.prepare('SELECT id FROM cat_auxiliares WHERE nombre = ?').bind(String(item.auxiliar).trim()).first())?.id;
                                    if (auxId) auxsMap.set(vk, auxId);
                                } catch { /* ignore */ }
                            }
                        }

                        assetStatements.push(
                            db.prepare(`
                                INSERT OR REPLACE INTO activos (
                                    codigo_activo, descripcion, estado_actual, usuario_actual_id,
                                    ubicacion_fisica_id, cat_unidad_id, cat_oficina_id, cat_piso_id,
                                    cat_auxiliar_id, cat_grupo_contable_id
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `).bind(
                                item.codigo_activo,
                                item.descripcion,
                                formatEstado(item.estado_actual, !!userId),
                                userId,
                                uId || item.ubicacion_fisica_id || null,
                                unId || item.cat_unidad_id || null,
                                ofId || item.cat_oficina_id || null,
                                flId || item.cat_piso_id || null,
                                auxId || item.cat_auxiliar_id || null,
                                grpId || item.cat_grupo_contable_id || null
                            )
                        );
                    } catch (err) { results.failed++; }
                }

                if (assetStatements.length > 0) {
                    try {
                        await db.batch(assetStatements);
                        results.created_assets += assetStatements.length;
                    } catch (e: any) {
                        console.error("Error activos:", e.message);
                        results.failed += assetStatements.length;
                    }
                }
            }

            // c) Catálogos Normales (Pisos, Ubicaciones, Auxiliares, Grupos)
            if (['pisos', 'ubicaciones', 'auxiliares', 'grupos'].includes(type)) {
                for (const item of batch) {
                    try {
                        if (type === 'pisos') {
                            catalogStatements.push(db.prepare('INSERT OR IGNORE INTO cat_pisos (numero) VALUES (?)').bind(item.numero));
                        } else if (type === 'ubicaciones') {
                            catalogStatements.push(db.prepare('INSERT OR IGNORE INTO ubicacion_fisica (nombre, direccion, observaciones) VALUES (?, ?, ?)')
                                .bind(item.nombre, item.direccion || null, item.observaciones || null));
                        } else if (type === 'auxiliares') {
                            const grpId = await resolveCatalog('cat_grupos_contables', 'nombre', item.grupo_contable, groupsMap);
                            catalogStatements.push(db.prepare('INSERT OR IGNORE INTO cat_auxiliares (nombre, cat_grupo_contable_id) VALUES (?, ?)')
                                .bind(String(item.nombre).trim(), grpId));
                        } else if (type === 'grupos') {
                            catalogStatements.push(db.prepare('INSERT OR IGNORE INTO cat_grupos_contables (nombre, vida_util, observaciones) VALUES (?, ?, ?)')
                                .bind(item.nombre, item.vida_util || null, item.observaciones || null));
                        }
                    } catch { results.failed++; }
                }
            }

            // d) Recuperación de Pisos (NUEVO)
            if (type === 'recovery_floors') {
                // Primero aseguramos que todos los pisos de este lote existan
                const uniqueFloorsInBatch = Array.from(new Set(batch.map(item => String(item.piso || '').trim()).filter(Boolean)));
                for (const f of uniqueFloorsInBatch) {
                    await db.prepare('INSERT OR IGNORE INTO cat_pisos (numero) VALUES (?)').bind(f).run();
                }

                // Cargamos el mapa de pisos actualizado
                const { results: allFloors } = await db.prepare('SELECT id, numero FROM cat_pisos').all();
                const floorMap = new Map<string, number>();
                allFloors?.forEach((f: any) => floorMap.set(String(f.numero).trim(), f.id));

                for (const item of batch) {
                    try {
                        const pisoNombre = String(item.piso || '').trim();
                        const floorId = floorMap.get(pisoNombre);
                        if (floorId && item.codigo_activo) {
                            catalogStatements.push(
                                db.prepare('UPDATE activos SET cat_piso_id = ? WHERE codigo_activo = ?')
                                    .bind(floorId, item.codigo_activo)
                            );
                        }
                    } catch { results.failed++; }
                }
            }

            if (catalogStatements.length > 0) {
                try {
                    await db.batch(catalogStatements);
                    results.created_catalogs += catalogStatements.length;
                } catch (e: any) {
                    console.error("Error en batch de catálogos/recuperación:", e.message);
                    results.failed += catalogStatements.length;
                }
            }
        }

        console.log("Migración finalizada con resultados:", results);
        if (c.env.CACHE) {
            const keys = ['unidades', 'oficinas', 'pisos', 'auxiliares', 'grupos', 'consolidado:activos', 'consolidado:usuarios'];
            for (const k of keys) await c.env.CACHE.delete(k);
        }
        return c.json({ success: true, ...results });
    } catch (e: any) {
        console.error("Error fatal en migración masiva:", e.message);
        return c.json({ error: formatError(e) }, 500);
    }
});

app.get('/actas/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const db = getDB(c);

        if (!db) return c.json({ error: 'DB no encontrada' }, 500);

        const acta = await db.prepare(`
            SELECT a.*, u.nombre_completo, u.ci, u.cargo,
                   uf.nombre as edificio,
                   cat_au.nombre as unidad,
                   COALESCE(cat_ao.nombre, (SELECT GROUP_CONCAT(off.nombre, ', ') FROM usuarios_oficinas uo JOIN cat_oficinas off ON uo.oficina_id = off.id WHERE uo.usuario_id = u.id)) as oficina,
                   cat_ap.numero as piso
            FROM actas a
            JOIN usuarios u ON a.usuario_id = u.id
            LEFT JOIN ubicacion_fisica uf ON a.ubicacion_fisica_id = uf.id
            LEFT JOIN cat_unidades cat_au ON a.cat_unidad_id = cat_au.id
            LEFT JOIN cat_oficinas cat_ao ON a.cat_oficina_id = cat_ao.id
            LEFT JOIN cat_pisos cat_ap ON a.cat_piso_id = cat_ap.id
            WHERE a.id = ?
        `).bind(id).first();

        if (!acta) return c.json({ error: 'Acta no encontrada' }, 404);

        const { results: activos } = await db.prepare(`
            SELECT da.activo_id as id, da.estado_fisico, ac.codigo_activo, ac.descripcion
            FROM detalles_acta da
            JOIN activos ac ON da.activo_id = ac.id
            JOIN actas a ON da.acta_id = a.id
            WHERE da.acta_id = ? 
              AND (
                  a.tipo_acta != 'Asignación' 
                  OR (
                      ac.usuario_actual_id = a.usuario_id 
                      AND da.acta_id = (
                          SELECT ac2.id
                          FROM detalles_acta da2 
                          JOIN actas ac2 ON da2.acta_id = ac2.id 
                          WHERE da2.activo_id = ac.id AND ac2.tipo_acta = 'Asignación' 
                          ORDER BY ac2.id DESC LIMIT 1
                      )
                  )
              )
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
        const db = getDB(c);
        if (!db) return c.json({ error: 'DB no disponible' }, 500);

        await db.prepare(
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
        let db: D1Database | undefined;
        const inst = targetInst.toLowerCase();
        if (inst === 'justicia') db = c.env.DB_JUSTICIA;
        else if (inst === 'presidencia') db = c.env.DB_PRESIDENCIA;
        else db = c.env.DB;

        if (!db) return c.json([]);

        // Intentamos con todos los campos (incluyendo el nuevo 'observacion')
        try {
            const { results } = await db.prepare(
                'SELECT activo_id, hallazgo, fecha_auditoria, observacion FROM auditorias_fisicas WHERE usuario_auditado_id = ?'
            ).bind(userId).all();
            return c.json(results || []);
        } catch (innerErr: any) {
            // Si falla por columna faltante, devolvemos la versión básica
            const { results } = await db.prepare(
                'SELECT activo_id, hallazgo, fecha_auditoria FROM auditorias_fisicas WHERE usuario_auditado_id = ?'
            ).bind(userId).all();
            return c.json(results || []);
        }
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 500);
    }
});

app.post('/auditorias', async (c) => {
    const body = await c.req.json();
    const { usuario_auditado_id, activo_id, hallazgo, realizado_por, institucion, observacion } = body;

    try {
        const db = getDB(c);
        if (!db) return c.json({ error: 'DB no disponible' }, 500);

        try {
            // Intento completo
            await db.prepare(
                'INSERT INTO auditorias_fisicas (usuario_auditado_id, activo_id, hallazgo, realizado_por, observacion) VALUES (?, ?, ?, ?, ?)'
            ).bind(usuario_auditado_id, activo_id, hallazgo, realizado_por ?? null, observacion ?? null).run();
        } catch (innerErr) {
            // Fallback (sin columnas nuevas)
            await db.prepare(
                'INSERT INTO auditorias_fisicas (usuario_auditado_id, activo_id, hallazgo) VALUES (?, ?, ?)'
            ).bind(usuario_auditado_id, activo_id, hallazgo).run();
        }
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 400);
    }
});

// Limpiar auditoría de un usuario (para reiniciar el proceso)
app.delete('/auditorias/usuario/:id', async (c) => {
    const userId = c.req.param('id');
    try {
        const db = getDB(c);
        if (!db) return c.json({ error: 'DB no disponible' }, 500);

        await db.prepare('DELETE FROM auditorias_fisicas WHERE usuario_auditado_id = ?').bind(userId).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 500);
    }
});

// Borrar un ítem específico de la auditoría
app.delete('/auditorias/usuario/:userId/activo/:activoId', async (c) => {
    const userId = c.req.param('userId');
    const activoId = c.req.param('activoId');
    try {
        const db = getDB(c);
        if (!db) return c.json({ error: 'DB no disponible' }, 500);

        await db.prepare(
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
                        cat_ao.nombre      AS oficina,
                        cat_ap.numero      AS piso,
                        ac.id              AS acta_id
                    FROM detalles_acta da
                    JOIN actas ac       ON da.acta_id  = ac.id
                    JOIN activos a      ON da.activo_id = a.id
                    LEFT JOIN usuarios u ON ac.usuario_id = u.id
                    LEFT JOIN cat_oficinas cat_ao ON a.cat_oficina_id = cat_ao.id
                    LEFT JOIN cat_pisos cat_ap ON a.cat_piso_id = cat_ap.id
                    
                    UNION ALL
                    
                    SELECT
                        a.codigo_activo,
                        a.descripcion,
                        u.nombre_completo  AS responsable,
                        'Auditoría (' || af.hallazgo || ')' as tipo_acta,
                        af.fecha_auditoria as fecha_emision,
                        af.realizado_por,
                        'Hallazgo físico en auditoría' as observaciones,
                        cat_ao.nombre      AS oficina,
                        cat_ap.numero      AS piso,
                        af.id              AS acta_id
                    FROM auditorias_fisicas af
                    JOIN activos a      ON af.activo_id = a.id
                    JOIN usuarios u ON af.usuario_auditado_id = u.id
                    LEFT JOIN cat_oficinas cat_ao ON a.cat_oficina_id = cat_ao.id
                    LEFT JOIN cat_pisos cat_ap ON a.cat_piso_id = cat_ap.id
                )
                ORDER BY fecha_emision DESC
                LIMIT ?
            `;
            const { results } = await db.prepare(query).bind(instName, limit).all();
            return results || [];
        };

        if (institution === 'consolidado') {
            const [r1, r2, r3, r4, r5] = await Promise.all([
                fetchBitacoraFromDB(c.env.DB, 'TIERRAS'),
                fetchBitacoraFromDB(c.env.DB_JUSTICIA, 'JUSTICIA'),
                fetchBitacoraFromDB(c.env.DB_PRESIDENCIA, 'PRESIDENCIA'),
                c.env.DB_CULTURAS ? fetchBitacoraFromDB(c.env.DB_CULTURAS, 'CULTURAS') : Promise.resolve([]),
                c.env.DB_VICEPRESIDENCIA ? fetchBitacoraFromDB(c.env.DB_VICEPRESIDENCIA, 'VICEPRESIDENCIA') : Promise.resolve([])
            ]);
            return c.json([...r1, ...r2, ...r3, ...r4, ...r5].sort((a: any, b: any) =>
                new Date(b.fecha_emision).getTime() - new Date(a.fecha_emision).getTime()
            ).slice(0, limit));
        }

        const db = getDB(c);
        if (!db) return c.json([]);

        const result = await fetchBitacoraFromDB(db, institution.toUpperCase());
        return c.json(result.slice(0, limit));
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
        const dbs = [
            { name: 'TIERRAS', db: c.env.DB },
            { name: 'JUSTICIA', db: c.env.DB_JUSTICIA },
            { name: 'PRESIDENCIA', db: c.env.DB_PRESIDENCIA },
            { name: 'CULTURAS', db: c.env.DB_CULTURAS },
            { name: 'VICEPRESIDENCIA', db: c.env.DB_VICEPRESIDENCIA }
        ].filter(d => !!d.db);

        for (const { name, db } of dbs) {
            if (!db) continue;

            // Tabla system_users
            await db.prepare(`
                CREATE TABLE IF NOT EXISTS system_users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    nombre TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    rol TEXT CHECK(rol IN ('admin', 'tecnico')) DEFAULT 'tecnico',
                    activo INTEGER DEFAULT 1,
                    created_at TEXT DEFAULT (datetime('now'))
                )
            `).run();

            // Tablas de Catálogo nuevas
            await db.prepare(`
                CREATE TABLE IF NOT EXISTS cat_auxiliares (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nombre TEXT NOT NULL UNIQUE,
                    registrado_por TEXT,
                    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `).run();

            await db.prepare(`
                CREATE TABLE IF NOT EXISTS cat_grupos_contables (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nombre TEXT NOT NULL UNIQUE,
                    vida_util INTEGER,
                    observaciones TEXT,
                    registrado_por TEXT,
                    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `).run();

            // Columnas cat_piso_id en usuarios
            try { await db.prepare('ALTER TABLE usuarios ADD COLUMN cat_piso_id INTEGER').run(); } catch { }

            // Columnas auxiliares y grupos contables en activos
            try { await db.prepare('ALTER TABLE activos ADD COLUMN cat_auxiliar_id INTEGER').run(); } catch { }
            try { await db.prepare('ALTER TABLE activos ADD COLUMN cat_grupo_contable_id INTEGER').run(); } catch { }

            // Nuevas columnas en cat_grupos_contables
            try { await db.prepare('ALTER TABLE cat_grupos_contables ADD COLUMN vida_util INTEGER').run(); } catch { }
            try { await db.prepare('ALTER TABLE cat_grupos_contables ADD COLUMN observaciones TEXT').run(); } catch { }

            // Columna realizado_por en actas
            try { await db.prepare('ALTER TABLE actas ADD COLUMN realizado_por TEXT').run(); } catch { }
            // Columna observacion en auditorias_fisicas
            try { await db.prepare('ALTER TABLE auditorias_fisicas ADD COLUMN observacion TEXT').run(); } catch { }

            // Seed admin por defecto (en todas las DBs para permitir login e integridad)
            const hash = await hashPassword('admin123');
            await db.prepare(
                'INSERT OR IGNORE INTO system_users (username, nombre, password_hash, rol) VALUES (?, ?, ?, ?)'
            ).bind('admin', 'Administrador', hash, 'admin').run();
        }

        // Limpiar caché de catálogos para forzar recarga en todas las inst
        if (c.env.CACHE) {
            const keys = ['unidades', 'oficinas', 'pisos', 'auxiliares', 'grupos', 'consolidado:activos'];
            for (const k of keys) await c.env.CACHE.delete(k);
        }

        return c.json({ success: true, message: 'Migración global completada en todas las bases de datos.' });
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

        const [r1, r2, r3, r4, r5] = await Promise.all([
            fetchDBSystemUsers(c.env.DB, 'TIERRAS'),
            fetchDBSystemUsers(c.env.DB_JUSTICIA, 'JUSTICIA'),
            fetchDBSystemUsers(c.env.DB_PRESIDENCIA, 'PRESIDENCIA'),
            c.env.DB_CULTURAS ? fetchDBSystemUsers(c.env.DB_CULTURAS, 'CULTURAS') : Promise.resolve([]),
            c.env.DB_VICEPRESIDENCIA ? fetchDBSystemUsers(c.env.DB_VICEPRESIDENCIA, 'VICEPRESIDENCIA') : Promise.resolve([])
        ]);

        // Agrupar por username para saber en qué DBs está cada uno
        const userMap = new Map();
        [...r1, ...r2, ...r3, ...r4, ...r5].forEach(u => {
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
            let db: D1Database | undefined;
            const i = inst.toLowerCase();
            if (i === 'justicia') db = c.env.DB_JUSTICIA;
            else if (i === 'presidencia') db = c.env.DB_PRESIDENCIA;
            else if (i === 'culturas') db = c.env.DB_CULTURAS;
            else if (i === 'vicepresidencia') db = c.env.DB_VICEPRESIDENCIA;
            else db = c.env.DB;

            if (db) {
                statements.push({
                    db,
                    stmt: db.prepare('INSERT OR REPLACE INTO system_users (username, nombre, password_hash, rol, activo) VALUES (?, ?, ?, ?, ?)').bind(username.toLowerCase().trim(), nombre, hash, rol || 'tecnico', 1)
                });
            }
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
        const allPossibleInsts = ['tierras', 'justicia', 'presidencia', 'culturas', 'vicepresidencia'];

        const syncPromises = allPossibleInsts.map(async (inst: string) => {
            let db: D1Database;
            const i = inst.toLowerCase();
            if (i === 'justicia') db = c.env.DB_JUSTICIA!;
            else if (i === 'presidencia') db = c.env.DB_PRESIDENCIA!;
            else if (i === 'culturas') db = c.env.DB_CULTURAS!;
            else if (i === 'vicepresidencia') db = c.env.DB_VICEPRESIDENCIA!;
            else db = c.env.DB!;

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

        const dbs = [c.env.DB, c.env.DB_JUSTICIA, c.env.DB_PRESIDENCIA, c.env.DB_CULTURAS, c.env.DB_VICEPRESIDENCIA];

        await Promise.all(dbs.map(db =>
            db ? db.prepare(`UPDATE system_users SET activo = 0 WHERE ${isNumericId ? 'id' : 'username'} = ?`)
                .bind(isNumericId ? parseInt(idOrUsername) : usernameToUse).run() : Promise.resolve()
        ));

        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: formatError(e) }, 500);
    }
});

export const onRequest = handle(app);
