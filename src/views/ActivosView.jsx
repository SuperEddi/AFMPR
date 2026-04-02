import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Plus, Download, Upload, Edit2, X, Archive, UserCheck, Monitor, Laptop, Tablet, Printer, Server, HardDrive, Keyboard, Mouse, Package } from 'lucide-react';
import { AppDialog, useDialog } from '../components/AppDialog';
import { exportToExcel } from '../utils/excelExport';

const getStatusStyle = (estado) => ({
    'Disponible': 'bg-emerald-50 text-emerald-700 border-emerald-100',
    'Asignado': 'bg-blue-50 text-blue-700 border-blue-100',
    'Mantenimiento': 'bg-amber-50 text-amber-700 border-amber-100',
    'Sobrante': 'bg-violet-50 text-violet-700 border-violet-100',
}[estado] || 'bg-slate-100 text-slate-600 border-slate-200');

const getInstitutionStyle = (inst) => {
    const i = (inst || '').toUpperCase();
    if (i === 'TIERRAS') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (i === 'JUSTICIA') return 'bg-amber-50 text-amber-600 border-amber-100';
    return 'bg-blue-50 text-blue-600 border-blue-100';
};
const getRowStyle = (inst) => {
    const i = (inst || '').toUpperCase();
    if (i === 'TIERRAS') return 'border-l-4 border-l-emerald-400 hover:bg-emerald-50/50';
    if (i === 'JUSTICIA') return 'border-l-4 border-l-amber-400 hover:bg-amber-50/40';
    return 'border-l-4 border-l-blue-400 hover:bg-blue-50/30';
};

const getIcon = (desc) => {
    const d = (desc || '').toLowerCase();
    if (d.includes('laptop') || d.includes('portátil') || d.includes('portatil') || d.includes('lapto') || d.includes('notebook')) return <Laptop size={14} />;
    if (d.includes('monitor') || d.includes('pantalla') || d.includes('display')) return <Monitor size={14} />;
    if (d.includes('impres') || d.includes('printer')) return <Printer size={14} />;
    if (d.includes('servidor') || d.includes('server') || d.includes('rack')) return <Server size={14} />;
    if (d.includes('disco') || d.includes('hard drive') || d.includes('hdd') || d.includes('ssd') || d.includes('almacen')) return <HardDrive size={14} />;
    if (d.includes('teclado') || d.includes('keyboard')) return <Keyboard size={14} />;
    if (d.includes('mouse') || d.includes('ratón') || d.includes('raton')) return <Mouse size={14} />;
    if (d.includes('tablet') || d.includes('ipad')) return <Tablet size={14} />;
    return <Package size={14} />;
};

const ActivosView = ({ authFetch = fetch, currentUser }) => {
    const [activos, setActivos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingActivo, setEditingActivo] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({ codigo_activo: '', descripcion: '', serie: '', estado_actual: 'Disponible' });
    const fileInputRef = useRef(null);
    const { showAlert, dialogProps } = useDialog();

    const fetchActivos = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await authFetch('/api/activos');
            if (res.ok) setActivos(await res.json());
        } catch (err) { }
        setLoading(false);
    }, [authFetch]);

    useEffect(() => { fetchActivos(); }, [fetchActivos]);

    useEffect(() => {
        const handler = () => fetchActivos(true);
        window.addEventListener('data-updated', handler);
        return () => window.removeEventListener('data-updated', handler);
    }, [fetchActivos]);

    const handleInputChange = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

    const openModal = (activo = null) => {
        setEditingActivo(activo);
        setFormData(activo || { codigo_activo: '', descripcion: '', serie: '', estado_actual: 'Disponible' });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const password = prompt("Ingrese la contraseña de administrador para confirmar:");
        if (!password) return;

        setSaving(true);
        try {
            const url = editingActivo ? `/api/activos/${editingActivo.id}` : '/api/activos';
            const method = editingActivo ? 'PUT' : 'POST';
            const res = await authFetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-password': password,
                    'x-target-institution': editingActivo?.institucion
                },
                body: JSON.stringify({ ...formData, registrado_por: editingActivo ? editingActivo.registrado_por : currentUser?.nombre })
            });
            if (res.ok) {
                setShowModal(false);
                setFormData({ codigo_activo: '', descripcion: '', serie: '', estado_actual: 'Disponible' });
                fetchActivos();
            } else {
                const data = await res.json();
                await showAlert(data.error || 'No se pudo guardar el activo.', { title: 'Error al guardar', type: 'error' });
            }
        } catch (e) {
            await showAlert('Error de conexión al guardar el activo.', { title: 'Error de red', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const exportToExcelFile = async () => {
        if (!activos.length) return;
        const fechaHoy = new Date().toLocaleDateString('es-ES');
        await exportToExcel({
            filename: `Inventario_Activos_${new Date().toISOString().split('T')[0]}`,
            sheetName: 'Inventario',
            title: 'INVENTARIO GENERAL DE ACTIVOS FIJOS — MINISTERIO DE LA PRESIDENCIA',
            subtitle: `Fecha: ${fechaHoy}  ·  Total: ${activos.length} equipos`,
            columns: ['N°', 'Código Activo', 'Descripción', 'Serie / Modelo', 'Estado', 'Responsable', 'Oficina', 'Institución', 'Registrado por'],
            rows: activos.map((a, i) => [
                i + 1,
                a.codigo_activo || '',
                a.descripcion || '',
                a.serie || 'SIN SERIE',
                a.estado_actual || '',
                a.responsable || 'SIN ASIGNAR',
                a.oficina || '',
                a.institucion || '',
                a.registrado_por || '',
            ]),
            headerColor: 'FF2D3748',
            accentColor: 'FFF7FAFC',
        });
    };

    const importFromCSV = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            const lines = text.split('\n');
            const headers = lines[0].split('|').map(h => h.trim().toLowerCase());
            const assets = lines.slice(1).map(line => {
                const values = line.split('|').map(v => v.trim());
                if (values.length < 2) return null;
                const asset = {};
                headers.forEach((h, i) => {
                    if (h.includes('código') || h.includes('codigo')) asset.codigo_activo = values[i];
                    else if (h.includes('descripción') || h.includes('descripcion')) asset.descripcion = values[i];
                    else if (h.includes('serie')) asset.serie = values[i];
                    else if (h.includes('estado')) asset.estado_actual = values[i];
                });
                return asset;
            }).filter(a => a && a.codigo_activo);
            if (!assets.length) { await showAlert('No se encontraron activos válidos en el archivo.', { title: 'Archivo inválido', type: 'warning' }); return; }
            setLoading(true);
            try {
                const res = await authFetch('/api/activos/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(assets)
                });
                const result = await res.json();
                if (result.success) { await showAlert(`Se importaron ${result.count} activos correctamente.`, { title: 'Importación exitosa', type: 'success' }); fetchActivos(); }
                else await showAlert(result.error || 'Error desconocido.', { title: 'Error al importar', type: 'error' });
            } catch { await showAlert('Error de red durante la importación.', { title: 'Error de red', type: 'error' }); } finally { setLoading(false); }
        };
        reader.readAsText(file);
    };

    const filtered = useMemo(() => {
        const searchLower = filter.toLowerCase().trim();
        if (!searchLower) return activos;

        return activos.filter(a => (
            (a.codigo_activo || '').toLowerCase().includes(searchLower) ||
            (a.descripcion || '').toLowerCase().includes(searchLower) ||
            (a.serie || '').toLowerCase().includes(searchLower) ||
            (a.responsable || '').toLowerCase().includes(searchLower) ||
            (a.oficina || '').toLowerCase().includes(searchLower) ||
            (a.institucion || '').toLowerCase().includes(searchLower)
        ));
    }, [activos, filter]);

    return (
        <>
            <div className="space-y-4">
                {/* Header compacto */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 text-white rounded-xl">
                            <Archive size={18} />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-slate-900 leading-tight">Inventario de Activos</h2>
                            <p className="text-slate-400 text-xs font-medium">
                                {loading ? '...' : `${activos.length.toLocaleString()} equipos`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-none">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar código, descripción, responsable u oficina..."
                                className="w-full sm:w-72 pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                            />
                        </div>
                        <button onClick={exportToExcelFile}
                            className="p-2 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg transition-all active:scale-95"
                            title="Exportar Excel (.xlsx)">
                            <Download size={16} />
                        </button>
                        <button onClick={() => fileInputRef.current?.click()}
                            className="p-2 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg transition-all active:scale-95"
                            title="Importar CSV">
                            <Upload size={16} />
                        </button>
                        <input type="file" ref={fileInputRef} onChange={importFromCSV} accept=".csv" className="hidden" />
                        <button onClick={() => openModal()}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg flex items-center gap-1.5 font-bold text-sm transition-all active:scale-95 shadow-md shadow-indigo-500/20">
                            <Plus size={16} /> <span className="hidden sm:inline">Nuevo</span>
                        </button>
                    </div>
                </div>

                {/* Tabla principal */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    {loading ? (
                        <div className="py-12 text-center text-slate-400 text-sm animate-pulse font-medium">Cargando inventario...</div>
                    ) : (
                        <>
                            {/* Desktop table */}
                            <div className="hidden md:block overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse min-w-[800px]">
                                    <thead className="sticky top-0 z-20">
                                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                                            <th className="px-4 py-3 bg-slate-50 rounded-tl-xl">Código / Descripción</th>
                                            <th className="px-4 py-3 bg-slate-50">Serie</th>
                                            <th className="px-4 py-3 bg-slate-50">Estado</th>
                                            <th className="px-4 py-3 bg-slate-50">Responsable</th>
                                            <th className="px-4 py-3 bg-slate-50">Origen</th>
                                            <th className="px-4 py-3 bg-slate-50 text-right rounded-tr-xl">–</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filtered.slice(0, 200).map(a => (
                                            <tr key={`${a.institucion || 'x'}-${a.id}`} className={`transition-colors text-sm ${getRowStyle(a.institucion)}`}>
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1 bg-slate-100 text-slate-400 rounded-lg flex-shrink-0">
                                                            {getIcon(a.descripcion)}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="font-bold text-slate-800 text-xs font-mono uppercase tracking-tight">{a.codigo_activo}</div>
                                                                {a.institucion && (
                                                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider ${getInstitutionStyle(a.institucion)}`}>
                                                                        {a.institucion}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 font-medium leading-relaxed max-w-sm break-words">{a.descripcion}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <span className="font-mono text-[10px] bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-slate-500 uppercase">{a.serie || '—'}</span>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusStyle(a.estado_actual)}`}>
                                                        {a.estado_actual}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2">
                                                    {a.responsable ? (
                                                        <span className="text-[10px] text-indigo-600 font-bold flex items-center gap-1">
                                                            <UserCheck size={10} /> {a.responsable}
                                                        </span>
                                                    ) : <span className="text-slate-300 text-xs">—</span>}
                                                </td>
                                                <td className="px-4 py-2">
                                                    {a.registrado_por ? (
                                                        <span className="text-[9px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded border border-violet-100 uppercase">
                                                            {a.registrado_por}
                                                        </span>
                                                    ) : <span className="text-slate-300 text-[10px]">—</span>}
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    <button onClick={() => openModal(a)} className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                                        <Edit2 size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {filtered.length > 200 && (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-3 text-center text-xs text-slate-400 font-medium bg-slate-50">
                                                    Mostrando 200 de {filtered.length} resultados. Usa el buscador para filtrar.
                                                </td>
                                            </tr>
                                        )}
                                        {filtered.length === 0 && (
                                            <tr><td colSpan={5} className="text-center py-12 text-slate-400 text-sm">Sin resultados</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile cards */}
                            <div className="md:hidden divide-y divide-slate-100">
                                {filtered.length === 0 ? (
                                    <div className="py-12 text-center text-slate-400 text-sm italic">Sin resultados</div>
                                ) : filtered.slice(0, 100).map(a => (
                                    <div key={a.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                                        <div className="p-2.5 bg-slate-100 text-slate-400 rounded-xl flex-shrink-0 mt-0.5">
                                            {getIcon(a.descripcion)}
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-slate-900 text-xs font-mono uppercase tracking-tight">{a.codigo_activo}</span>
                                                    {a.institucion && (
                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider ${getInstitutionStyle(a.institucion)}`}>
                                                            {a.institucion}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex gap-2 items-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase ${getStatusStyle(a.estado_actual)}`}>
                                                        {a.estado_actual}
                                                    </span>
                                                    <button onClick={() => openModal(a)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                                        <Edit2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="text-[11px] text-slate-500 font-medium leading-relaxed">{a.descripcion}</div>
                                            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                                                {a.responsable ? (
                                                    <div className="text-[10px] text-indigo-600 font-bold flex items-center gap-1">
                                                        <UserCheck size={10} /> {a.responsable}
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] text-slate-300 font-bold italic">Sin asignar</div>
                                                )}
                                                {a.oficina && (
                                                    <div className="text-[10px] text-slate-400 font-bold bg-slate-50 px-1.5 rounded border border-slate-100">
                                                        📍 {a.oficina}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {filtered.length > 100 && (
                                    <div className="py-4 text-center text-[10px] text-slate-400 bg-slate-50 font-bold uppercase tracking-widest">
                                        +{filtered.length - 100} activos ocultos
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Modal compacto */}
                {showModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                        <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md animate-in slide-in-from-bottom duration-300">
                            <div className="sm:hidden w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1" />
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="font-bold text-slate-900 text-sm">{editingActivo ? 'Editar Activo' : 'Registrar Nuevo Activo'}</h3>
                                <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X size={20} /></button>
                            </div>
                            <form onSubmit={handleSubmit} className="p-4 space-y-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Código Interno</label>
                                    <input name="codigo_activo" required placeholder="Ej. MDRYTVT-2140"
                                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono font-bold"
                                        value={formData.codigo_activo} onChange={handleInputChange} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Descripción</label>
                                    <textarea name="descripcion" required placeholder="Ej. Monitor Samsung 24 Pulgadas"
                                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium min-h-[72px] resize-none"
                                        value={formData.descripcion} onChange={handleInputChange} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Serie (Opcional)</label>
                                        <input name="serie" placeholder="S/N"
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                                            value={formData.serie} onChange={handleInputChange} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Estado</label>
                                        <select name="estado_actual"
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                                            value={formData.estado_actual} onChange={handleInputChange}>
                                            <option>Disponible</option>
                                            <option>Asignado</option>
                                            <option>Mantenimiento</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <button type="button" onClick={() => setShowModal(false)}
                                        className="flex-1 py-2.5 border border-slate-200 text-slate-400 rounded-lg font-bold text-sm hover:bg-slate-50">
                                        Cancelar
                                    </button>
                                    <button type="submit" disabled={saving}
                                        className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-md shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50">
                                        {saving ? 'Guardando...' : 'Guardar'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
            <AppDialog {...dialogProps} />
        </>
    );
};

export default ActivosView;
