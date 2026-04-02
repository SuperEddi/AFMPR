import React, { useState, useEffect } from 'react';
import {
    ArrowLeft, FileSpreadsheet, RefreshCw, BoxSelect,
    Search, ClipboardCheck, Clock, Wrench, LayoutDashboard, AlertTriangle, Package
} from 'lucide-react';
import { exportToExcel } from '../utils/excelExport';

const TIPOS = {
    total: { label: 'Total de Activos', icon: LayoutDashboard, color: 'blue', endpoint: '/api/activos', estado: null },
    asignados: { label: 'Activos Asignados', icon: ClipboardCheck, color: 'green', endpoint: '/api/activos?estado=Asignado', estado: 'Asignado' },
    disponibles: { label: 'Activos Disponibles', icon: BoxSelect, color: 'orange', endpoint: '/api/activos?estado=Disponible', estado: 'Disponible' },
    mantenimiento: { label: 'En Mantenimiento', icon: Wrench, color: 'red', endpoint: '/api/activos?estado=Mantenimiento', estado: 'Mantenimiento' },
    sobrantes: { label: 'Activos Sobrantes / Ajenos', icon: AlertTriangle, color: 'red', endpoint: '/api/activos?estado=Sobrante', estado: 'Sobrante' },
};

const getInstitutionStyle = (inst) => {
    const i = (inst || '').toUpperCase();
    if (i === 'TIERRAS') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (i === 'JUSTICIA') return 'bg-amber-50 text-amber-600 border-amber-100';
    return 'bg-blue-50 text-blue-600 border-blue-100';
};

const COLOR_MAP = {
    blue: { bg: 'bg-blue-600', light: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', btn: 'bg-blue-600 hover:bg-blue-700' },
    green: { bg: 'bg-emerald-600', light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', btn: 'bg-emerald-600 hover:bg-emerald-700' },
    orange: { bg: 'bg-orange-600', light: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', btn: 'bg-orange-600 hover:bg-orange-700' },
    red: { bg: 'bg-red-600', light: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', btn: 'bg-red-600 hover:bg-red-700' },
};

const ReporteActivosView = ({ tipo = 'total', onBack, authFetch = fetch }) => {
    const [activos, setActivos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    const cfg = TIPOS[tipo] || TIPOS.total;
    const colors = COLOR_MAP[cfg.color];
    const Icon = cfg.icon;

    const fetchData = async () => {
        setLoading(true);
        try {
            // Usar el endpoint específico si existe (para filtros de estado), sino el general
            const url = cfg.endpoint || '/api/activos';
            const res = await authFetch(url);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();

            // Siempre filtramos en el cliente por seguridad si cfg.estado está definido,
            // ya que el backend /api/activos actualmente devuelve todo.
            if (cfg.estado) {
                setActivos(data.filter(a => a.estado_actual === cfg.estado));
            } else {
                setActivos(data);
            }
        } catch (err) {

            setActivos([]);
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [tipo, authFetch]);

    const filtered = activos.filter(a =>
        (a.codigo_activo || '').toLowerCase().includes(filter.toLowerCase()) ||
        (a.descripcion || '').toLowerCase().includes(filter.toLowerCase()) ||
        (a.serie || '').toLowerCase().includes(filter.toLowerCase()) ||
        (a.responsable || '').toLowerCase().includes(filter.toLowerCase())
    );

    /* ── Exportar a Excel (.xlsx formateado) ── */
    const exportExcel = async () => {
        const fechaHoy = new Date().toLocaleDateString('es-ES');
        const COLOR_HEADER = {
            blue: 'FF1E3A5F',
            green: 'FF1A5C3A',
            orange: 'FF7C3B00',
            red: 'FF7C1C1C',
        };
        const COLOR_ACCENT = {
            blue: 'FFE8F0FE',
            green: 'FFE8F5EE',
            orange: 'FFFFF3E5',
            red: 'FFFEF2F2',
        };
        await exportToExcel({
            filename: `Reporte_${tipo}_${fechaHoy.replace(/\//g, '-')}`,
            sheetName: cfg.label,
            title: `REPORTE DE ${cfg.label.toUpperCase()} — MINISTERIO DE LA PRESIDENCIA`,
            subtitle: `Fecha: ${fechaHoy}  ·  Total registros: ${filtered.length}`,
            columns: ['N°', 'Código Activo', 'Descripción', 'Serie / Modelo', 'Estado', 'Responsable / Custodio', 'Institución'],
            rows: filtered.map((a, i) => [
                i + 1,
                a.codigo_activo || '',
                a.descripcion || '',
                a.serie || 'SIN SERIE',
                a.estado_actual || '',
                a.responsable || 'SIN ASIGNAR',
                a.institucion || '',
            ]),
            headerColor: COLOR_HEADER[cfg.color] || COLOR_HEADER.blue,
            accentColor: COLOR_ACCENT[cfg.color] || COLOR_ACCENT.blue,
        });
    };

    return (
        <div className="space-y-4">
            {/* ── Barra superior ── */}
            <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border ${colors.light} ${colors.border}`}>
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">
                    <ArrowLeft size={16} /> Volver al Dashboard
                </button>
                <div className="flex-1 flex items-center gap-3 sm:justify-center">
                    <div className={`p-2 rounded-xl text-white ${colors.bg}`}>
                        <Icon size={18} />
                    </div>
                    <div>
                        <h2 className={`font-black text-sm ${colors.text}`}>{cfg.label}</h2>
                        <p className="text-slate-500 text-xs">{loading ? 'Cargando...' : `${filtered.length} registros${filter ? ' (filtrados)' : ''}`}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchData}
                        className="p-2 border border-slate-200 bg-white rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
                        title="Actualizar">
                        <RefreshCw size={15} />
                    </button>
                    <button
                        onClick={exportExcel}
                        disabled={!filtered.length}
                        className={`flex items-center gap-2 px-4 py-2 text-white text-xs font-bold rounded-lg transition-all active:scale-95 shadow-sm disabled:opacity-40 ${colors.btn}`}>
                        <FileSpreadsheet size={14} /> Exportar Excel
                    </button>
                </div>
            </div>

            {/* ── Buscador ── */}
            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Filtrar por código, descripción, serie o responsable..."
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-400"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                />
            </div>

            {/* ── Tabla ── */}
            {loading ? (
                <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
                    <RefreshCw size={24} className="mx-auto text-slate-300 animate-spin mb-3" />
                    <p className="text-slate-400 text-xs font-medium">Cargando datos...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-slate-200 py-16 text-center">
                    <Package size={36} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Sin resultados</p>
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    {/* Desktop */}
                    <div className="hidden sm:block overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead className="sticky top-0 z-20">
                                <tr className={`text-[10px] uppercase tracking-wider font-bold border-b ${colors.light} ${colors.border}`}>
                                    <th className={`px-3 py-2.5 ${colors.light} ${colors.text}`}>#</th>
                                    <th className={`px-3 py-2.5 ${colors.light} ${colors.text}`}>Código</th>
                                    <th className={`px-3 py-2.5 ${colors.light} ${colors.text}`}>Descripción</th>
                                    <th className={`px-3 py-2.5 ${colors.light} ${colors.text}`}>Serie / Modelo</th>
                                    <th className={`px-3 py-2.5 ${colors.light} ${colors.text}`}>Estado</th>
                                    <th className={`px-3 py-2.5 ${colors.light} ${colors.text}`}>Responsable</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filtered.map((a, i) => (
                                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-3 py-2 text-[10px] text-slate-400 font-mono">{i + 1}</td>
                                        <td className="px-3 py-2">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-mono font-black text-xs text-slate-800 uppercase leading-none">{a.codigo_activo}</span>
                                                {a.institucion && (
                                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter w-fit ${getInstitutionStyle(a.institucion)}`}>
                                                        {a.institucion}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-xs text-slate-700 max-w-sm">
                                            <div className="leading-relaxed break-words" title={a.descripcion}>{a.descripcion}</div>
                                        </td>
                                        <td className="px-3 py-2 text-xs text-slate-500 font-mono">
                                            {a.serie || <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${a.estado_actual === 'Asignado' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                a.estado_actual === 'Disponible' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                    a.estado_actual === 'Mantenimiento' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                        'bg-slate-100 text-slate-600'
                                                }`}>
                                                {a.estado_actual || '—'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">
                                            {a.responsable
                                                ? <span className="text-xs font-semibold text-slate-700">{a.responsable}</span>
                                                : <span className="text-[10px] text-slate-300 italic">Sin asignar</span>
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {/* Footer */}
                        <div className={`px-4 py-2 border-t ${colors.border} ${colors.light} flex justify-between items-center`}>
                            <span className={`text-[10px] font-bold ${colors.text}`}>
                                {filtered.length} registros · {cfg.label}
                            </span>
                            <button onClick={exportExcel}
                                className={`flex items-center gap-1.5 px-3 py-1 text-white text-[10px] font-bold rounded-lg transition-all active:scale-95 ${colors.btn}`}>
                                <FileSpreadsheet size={12} /> Descargar Excel
                            </button>
                        </div>
                    </div>

                    {/* Mobile: cards */}
                    <div className="sm:hidden divide-y divide-slate-100">
                        {filtered.map((a, i) => (
                            <div key={a.id} className="p-3 space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-black text-xs text-slate-800 uppercase leading-none">{a.codigo_activo}</span>
                                        {a.institucion && (
                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter ${getInstitutionStyle(a.institucion)}`}>
                                                {a.institucion}
                                            </span>
                                        )}
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${a.estado_actual === 'Asignado' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                        a.estado_actual === 'Disponible' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                            a.estado_actual === 'Mantenimiento' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                'bg-slate-100 text-slate-500'
                                        }`}>{a.estado_actual}</span>
                                </div>
                                <div className="text-[11px] text-slate-600 leading-tight">{a.descripcion}</div>
                                <div className="flex gap-3 text-[10px] text-slate-400">
                                    <span className="font-mono">{a.serie || 'Sin serie'}</span>
                                    {a.responsable && <span className="font-semibold text-slate-500">{a.responsable}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReporteActivosView;
