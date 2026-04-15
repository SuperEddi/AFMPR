import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, BookOpen, ArrowRightLeft, RotateCcw, Download } from 'lucide-react';
import { exportToExcel } from '../utils/excelExport';

const TIPO_CONFIG = {
    'Asignación': { label: 'Asignación', class: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500', border: 'border-l-4 border-l-blue-400' },
    'Devolución': { label: 'Devolución', class: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500', border: 'border-l-4 border-l-amber-400' },
};

const fmtDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getInstitutionStyle = (inst) => {
    const i = (inst || '').toUpperCase();
    if (i === 'TIERRAS') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (i === 'JUSTICIA') return 'bg-blue-50 text-blue-600 border-blue-100';
    if (i === 'PRESIDENCIA') return 'bg-amber-50 text-amber-600 border-amber-100';
    if (i === 'CULTURAS') return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    if (i === 'VICEPRESIDENCIA') return 'bg-rose-50 text-rose-600 border-rose-100';
    return 'bg-slate-50 text-slate-600 border-slate-100';
};

const BitacoraView = ({ authFetch, institution }) => {
    const [registros, setRegistros] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [tipoFiltro, setTipoFiltro] = useState('todos');

    const fetchBitacora = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch('/api/bitacora?limit=500');
            if (res.ok) setRegistros(await res.json());
        } catch { }
        setLoading(false);
    }, [authFetch]);

    useEffect(() => { fetchBitacora(); }, [fetchBitacora, institution]);
    useEffect(() => {
        const handler = () => fetchBitacora();
        window.addEventListener('data-updated', handler);
        return () => window.removeEventListener('data-updated', handler);
    }, [fetchBitacora]);

    const filtered = useMemo(() => {
        let list = registros;
        if (tipoFiltro !== 'todos') {
            if (tipoFiltro === 'Auditoría') {
                list = list.filter(r => (r.tipo_acta || '').startsWith('Auditoría'));
            } else {
                list = list.filter(r => r.tipo_acta === tipoFiltro);
            }
        }
        const t = filter.toLowerCase().trim();
        if (!t) return list;
        return list.filter(r =>
            (r.codigo_activo || '').toLowerCase().includes(t) ||
            (r.descripcion || '').toLowerCase().includes(t) ||
            (r.responsable || '').toLowerCase().includes(t) ||
            (r.realizado_por || '').toLowerCase().includes(t)
        );
    }, [registros, filter, tipoFiltro]);

    const exportCSV = async () => {
        const fechaHoy = new Date().toLocaleDateString('es-ES');
        await exportToExcel({
            filename: `Bitacora_Movimientos_${new Date().toISOString().slice(0, 10)}`,
            sheetName: 'Bitácora',
            title: 'BITÁCORA DE MOVIMIENTOS DE ACTIVOS — MINISTERIO DE LA PRESIDENCIA',
            subtitle: `Fecha: ${fechaHoy}  ·  Registros: ${filtered.length}`,
            columns: ['Código Activo', 'Descripción', 'Responsable', 'Tipo de Movimiento', 'Fecha', 'Técnico', 'Observaciones'],
            rows: filtered.map(r => [
                r.codigo_activo || '',
                r.descripcion || '',
                r.responsable || '',
                r.tipo_acta || '',
                fmtDate(r.fecha_emision),
                r.realizado_por || '',
                r.observaciones || '',
            ]),
            headerColor: 'FF4A1A7C',
            accentColor: 'FFF3E8FE',
        });
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-600 text-white rounded-xl">
                        <BookOpen size={18} />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold text-slate-900">Bitácora de Movimientos</h2>
                        <p className="text-slate-400 text-xs font-medium">
                            {filter || tipoFiltro !== 'todos'
                                ? `${filtered.length} de ${registros.length} registros`
                                : `${registros.length} movimientos`}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {/* Filtro tipo */}
                    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-[11px] font-semibold">
                        {['todos', 'Asignación', 'Devolución', 'Auditoría'].map(t => (
                            <button key={t} onClick={() => setTipoFiltro(t)}
                                className={`px-2.5 py-1 rounded-md transition-all uppercase ${tipoFiltro === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                {t === 'todos' ? 'Todos' : t}
                            </button>
                        ))}
                    </div>
                    {/* Búsqueda */}
                    <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" placeholder="Buscar..." value={filter}
                            onChange={e => setFilter(e.target.value)}
                            className="w-44 pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500" />
                    </div>
                    <button onClick={exportCSV} title="Exportar CSV"
                        className="p-2 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg transition-all">
                        <Download size={16} />
                    </button>
                </div>
            </div>

            {/* Tabla */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="py-12 text-center text-slate-400 text-sm animate-pulse">Cargando bitácora...</div>
                ) : (
                    <>
                        {/* Desktop */}
                        <div className="hidden md:block overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left text-sm">
                                <thead className="sticky top-0 z-20">
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                                        <th className="px-4 py-3 bg-slate-50">Código</th>
                                        <th className="px-4 py-3 bg-slate-50">Descripción</th>
                                        <th className="px-4 py-3 bg-slate-50">Responsable</th>
                                        <th className="px-4 py-3 bg-slate-50">Tipo</th>
                                        <th className="px-4 py-3 bg-slate-50">Fecha</th>
                                        <th className="px-4 py-3 bg-slate-50">Técnico</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filtered.map((r, i) => {
                                        const typeKey = (r.tipo_acta || '');
                                        const isAudit = typeKey.startsWith('Auditoría');
                                        const cfg = TIPO_CONFIG[r.tipo_acta] || (isAudit ? {
                                            label: typeKey,
                                            class: 'bg-violet-100 text-violet-700 border-violet-200',
                                            dot: 'bg-violet-500',
                                            border: 'border-l-4 border-l-violet-400'
                                        } : TIPO_CONFIG['Asignación']);

                                        return (
                                            <tr key={`${r.acta_id}-${i}`} className={`transition-colors hover:bg-slate-50 ${cfg.border}`}>
                                                <td className="px-4 py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-semibold text-xs text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 uppercase">{r.codigo_activo}</span>
                                                        {r.institucion && (
                                                            <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded border uppercase shrink-0 ${getInstitutionStyle(r.institucion)}`}>
                                                                {r.institucion}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5 text-xs text-slate-600 max-w-[260px]">
                                                    <span className="line-clamp-2">{r.descripcion}</span>
                                                </td>
                                                <td className="px-4 py-2.5 text-xs font-medium text-slate-700">{r.responsable || '—'}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.class}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                        {r.tipo_acta}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{fmtDate(r.fecha_emision)}</td>
                                                <td className="px-4 py-2.5">
                                                    {r.realizado_por
                                                        ? <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{r.realizado_por}</span>
                                                        : <span className="text-xs text-slate-300">—</span>
                                                    }
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filtered.length === 0 && (
                                        <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">Sin registros</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {filtered.length === 0
                                ? <div className="py-10 text-center text-slate-400 text-sm">Sin registros</div>
                                : filtered.map((r, i) => {
                                    const cfg = TIPO_CONFIG[r.tipo_acta] || TIPO_CONFIG['Asignación'];
                                    return (
                                        <div key={`mob-${r.acta_id}-${i}`} className={`p-3 ${cfg.border}`}>
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-semibold text-xs bg-slate-50 px-2 py-0.5 rounded border border-slate-100 uppercase">{r.codigo_activo}</span>
                                                    {r.institucion && (
                                                        <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded border uppercase shrink-0 ${getInstitutionStyle(r.institucion)}`}>
                                                            {r.institucion}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.class}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{r.tipo_acta}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-600 mt-1 line-clamp-2">{r.descripcion}</p>
                                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-slate-500">
                                                <span>👤 {r.responsable || '—'}</span>
                                                <span>🕐 {fmtDate(r.fecha_emision)}</span>
                                                {r.realizado_por && <span className="text-violet-600 font-semibold">🔧 {r.realizado_por}</span>}
                                            </div>
                                        </div>
                                    );
                                })
                            }
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default BitacoraView;
