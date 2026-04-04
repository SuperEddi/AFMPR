import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Plus, Download, Upload, Edit2, X, Archive, UserCheck, Monitor, Laptop, Tablet, Printer, Server, HardDrive, Keyboard, Mouse, Package, Settings2, Trash2, Edit } from 'lucide-react';
import { AppDialog, useDialog } from '../components/AppDialog';
import { exportToExcel } from '../utils/excelExport';
import QuickAddSelect from '../components/QuickAddSelect';
import QuickRegisterModal from '../components/QuickRegisterModal';
import SearchableSelect from '../components/SearchableSelect';

const getStatusStyle = (estado) => ({
    'Disponible': 'bg-emerald-50 text-emerald-700 border-emerald-100',
    'Asignado': 'bg-blue-50 text-blue-700 border-blue-100',
    'Mantenimiento': 'bg-amber-50 text-amber-700 border-amber-100',
    'Sobrante': 'bg-violet-50 text-violet-700 border-violet-100',
}[estado] || 'bg-slate-100 text-slate-600 border-slate-200');

const getInstitutionStyle = (inst) => {
    const i = (inst || '').toUpperCase();
    if (i === 'TIERRAS') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (i === 'JUSTICIA') return 'bg-blue-50 text-blue-600 border-blue-100';
    if (i === 'PRESIDENCIA') return 'bg-amber-50 text-amber-600 border-amber-100';
    if (i === 'CULTURAS') return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    if (i === 'VICEPRESIDENCIA') return 'bg-rose-50 text-rose-600 border-rose-100';
    return 'bg-slate-50 text-slate-600 border-slate-100';
};
const getRowStyle = (inst) => {
    const i = (inst || '').toUpperCase();
    if (i === 'TIERRAS') return 'border-l-4 border-l-emerald-400 hover:bg-emerald-50/50';
    if (i === 'JUSTICIA') return 'border-l-4 border-l-blue-400 hover:bg-blue-50/40';
    if (i === 'PRESIDENCIA') return 'border-l-4 border-l-amber-400 hover:bg-amber-50/30';
    if (i === 'CULTURAS') return 'border-l-4 border-l-indigo-400 hover:bg-indigo-50/30';
    if (i === 'VICEPRESIDENCIA') return 'border-l-4 border-l-rose-400 hover:bg-rose-50/30';
    return 'border-l-4 border-l-slate-400 hover:bg-slate-50';
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

// Componente Modal Reutilizable
const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
    if (!isOpen) return null;
    const maxWidths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidths[size]} animate-in zoom-in-95 duration-200 overflow-hidden`}>
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">{title}</h3>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <div className="max-h-[85vh] overflow-y-auto custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );
};

const ActivosView = ({ authFetch = fetch, currentUser }) => {
    const [activos, setActivos] = useState([]);
    const [showCatalogModal, setShowCatalogModal] = useState(false);
    const [catalogTab, setCatalogTab] = useState('auxiliares');
    const [catForm, setCatForm] = useState({ nombre: '', vida_util: '', observaciones: '' });
    const [editingCatalog, setEditingCatalog] = useState(null);
    const [catSaving, setCatSaving] = useState(false);
    const [catalogos, setCatalogos] = useState({ ubicaciones: [], unidades: [], oficinas: [], pisos: [], auxiliares: [], grupos: [] });
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingActivo, setEditingActivo] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        codigo_activo: '', descripcion: '', estado_actual: 'Disponible',
        ubicacion_fisica_id: '', cat_unidad_id: '', cat_oficina_id: '', cat_piso_id: '',
        cat_auxiliar_id: '', cat_grupo_contable_id: ''
    });
    const [quickReg, setQuickReg] = useState({ isOpen: false, type: '', name: '', context: {} });
    const fileInputRef = useRef(null);
    const { showAlert, dialogProps } = useDialog();

    const fetchCatalogos = useCallback(async () => {
        try {
            const res = await authFetch('/api/catalogos');
            if (res.ok) {
                const data = await res.json();
                setCatalogos(data);
            }
        } catch (err) { }
    }, [authFetch]);

    const fetchActivos = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await authFetch('/api/activos');
            if (res.ok) setActivos(await res.json());
        } catch (err) { }
        setLoading(false);
    }, [authFetch]);

    useEffect(() => {
        fetchCatalogos();
        fetchActivos();
    }, [fetchActivos, fetchCatalogos]);

    useEffect(() => {
        const handler = () => {
            fetchCatalogos();
            fetchActivos(true);
        }
        window.addEventListener('data-updated', handler);
        return () => window.removeEventListener('data-updated', handler);
    }, [fetchActivos, fetchCatalogos]);

    const handleRegisterRequest = (tipo, nombre) => {
        let context = {};
        if (tipo === 'unidad') context = { ubicacion_fisica_id: formData.ubicacion_fisica_id };
        if (tipo === 'oficina') context = { unidad_id: formData.cat_unidad_id };
        setQuickReg({ isOpen: true, type: tipo, name: nombre, context });
    };

    const handleQuickSave = async (tipo, data) => {
        try {
            let url = '';
            if (tipo === 'ubicacion') url = '/api/catalogos/ubicaciones';
            if (tipo === 'unidad') url = '/api/catalogos/unidades';
            if (tipo === 'oficina') url = '/api/catalogos/oficinas';
            if (tipo === 'piso') url = '/api/catalogos/pisos';

            const res = await authFetch(url, {
                method: 'POST',
                body: JSON.stringify({ ...data, registrado_por: currentUser?.nombre })
            });

            if (res.ok) {
                const newItem = await res.json();
                await fetchCatalogos();

                const fieldMap = {
                    'ubicacion': 'ubicacion_fisica_id',
                    'unidad': 'cat_unidad_id',
                    'oficina': 'cat_oficina_id',
                    'piso': 'cat_piso_id'
                };
                setFormData(prev => ({ ...prev, [fieldMap[tipo]]: newItem.id }));
            } else {
                const err = await res.json();
                throw new Error(err.error || "Error al registrar");
            }
        } catch (e) {
            throw e;
        }
    };

    const handleInputChange = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

    const openModal = (activo = null) => {
        setEditingActivo(activo);
        if (activo) {
            setFormData({
                codigo_activo: activo.codigo_activo || '',
                descripcion: activo.descripcion || '',
                descripcion: activo.descripcion || '',
                estado_actual: activo.estado_actual || 'Disponible',
                ubicacion_fisica_id: activo.ubicacion_fisica_id || '',
                cat_unidad_id: activo.cat_unidad_id || '',
                cat_oficina_id: activo.cat_oficina_id || '',
                cat_piso_id: activo.cat_piso_id || '',
                cat_auxiliar_id: activo.cat_auxiliar_id || '',
                cat_grupo_contable_id: activo.cat_grupo_contable_id || ''
            });
        } else {
            setFormData({
                codigo_activo: '', descripcion: '', estado_actual: 'Disponible',
                ubicacion_fisica_id: '', cat_unidad_id: '', cat_oficina_id: '', cat_piso_id: '',
                cat_auxiliar_id: '', cat_grupo_contable_id: ''
            });
        }
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
        if (!filtered.length) return;
        const data = filtered.map(a => ({
            'ID DB': a.id || '',
            'Código Activo': a.codigo_activo || '',
            'Descripción': a.descripcion || '',
            'Descripción': a.descripcion || '-',
            'Estado': a.estado_actual || 'Disponible',
            'Responsable': a.usuario_nombre || 'No asignado',
            'Edificio': a.edificio || '-',
            'Unidad': a.unidad || '-',
            'Oficina': a.oficina || '-',
            'Piso': a.piso || '-',
            'Auxiliar': a.auxiliar || '-',
            'Grupo Contable': a.grupo_contable || '-',
            'Vida Útil (Años)': a.grupo_vida_util || '-',
            'Obs. Grupo': a.grupo_observaciones || '-',
            'Institución': a.institucion || '-',
            'Registrado Por': a.registrado_por || '-'
        }));
        exportToExcel(data, `Inventario_Activos_${new Date().toISOString().split('T')[0]}`);
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
                    const header = h.toLowerCase().trim();
                    if (header.includes('código') || header.includes('codigo')) asset.codigo_activo = values[i];
                    else if (header.includes('descripción') || header.includes('descripcion')) asset.descripcion = values[i];
                    else if (header.includes('estado')) asset.estado_actual = values[i];
                    else if (header.includes('estado')) asset.estado_actual = values[i];
                    else if (header.includes('cat_unidad_id')) asset.cat_unidad_id = values[i];
                    else if (header.includes('cat_oficina_id')) asset.cat_oficina_id = values[i];
                    else if (header.includes('cat_piso_id')) asset.cat_piso_id = values[i];
                    else if (header.includes('cat_auxiliar_id')) asset.cat_auxiliar_id = values[i];
                    else if (header.includes('cat_grupo_contable_id')) asset.cat_grupo_contable_id = values[i];
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
            (a.usuario_nombre || '').toLowerCase().includes(searchLower) ||
            (a.unidad || '').toLowerCase().includes(searchLower) ||
            (a.oficina || '').toLowerCase().includes(searchLower) ||
            (a.auxiliar || '').toLowerCase().includes(searchLower) ||
            (a.grupo_contable || '').toLowerCase().includes(searchLower) ||
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
                                placeholder="Buscar código, descripción u oficina..."
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
                        <button onClick={() => setShowCatalogModal(true)}
                            className="p-2 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg transition-all active:scale-95"
                            title="Gestionar Catálogos">
                            <Settings2 size={16} />
                        </button>
                        <button onClick={() => openModal()}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg flex items-center gap-1.5 font-bold text-sm transition-all active:scale-95 shadow-md shadow-indigo-500/20">
                            <Plus size={16} /> <span className="hidden sm:inline">Nuevo</span>
                        </button>
                    </div>
                </div>

                {/* MODAL GESTIÓN DE CATÁLOGOS (Auxiliares y Grupos) */}
                <Modal
                    isOpen={showCatalogModal}
                    onClose={() => { setShowCatalogModal(false); setEditingCatalog(null); setCatForm({ nombre: '', vida_util: '', observaciones: '' }); }}
                    title="Configuración de Clasificadores"
                    size="md"
                >
                    <div className="flex flex-col h-[600px]">
                        <div className="flex border-b border-slate-100 px-4 mt-1">
                            <button
                                onClick={() => { setCatalogTab('ubicaciones'); setEditingCatalog(null); setCatForm({ nombre: '', direccion: '', observaciones: '' }); }}
                                className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${catalogTab === 'ubicaciones' ? 'border-primary-600 border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                            >Ubicaciones</button>
                            <button
                                onClick={() => { setCatalogTab('auxiliares'); setEditingCatalog(null); }}
                                className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${catalogTab === 'auxiliares' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                            >Auxiliares</button>
                            <button
                                onClick={() => { setCatalogTab('grupos'); setEditingCatalog(null); }}
                                className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${catalogTab === 'grupos' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                            >Grupos Contables</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                                    {editingCatalog ? `Editar ${catalogTab === 'ubicaciones' ? 'Ubicación' : (catalogTab === 'auxiliares' ? 'Auxiliar' : 'Grupo')}` : `Nuevo ${catalogTab === 'ubicaciones' ? 'Ubicación' : (catalogTab === 'auxiliares' ? 'Auxiliar' : 'Grupo')}`}
                                </h4>

                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nombre</label>
                                        <input
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                            value={catForm.nombre}
                                            onChange={e => setCatForm(p => ({ ...p, nombre: e.target.value }))}
                                            placeholder="Ej: Muebles y Enseres"
                                        />
                                    </div>

                                    {catalogTab === 'ubicaciones' && (
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Dirección</label>
                                            <input
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                                value={catForm.direccion || ''}
                                                onChange={e => setCatForm(p => ({ ...p, direccion: e.target.value }))}
                                                placeholder="Ej: Plaza Murillo #123"
                                            />
                                        </div>
                                    )}

                                    {(catalogTab === 'grupos' || catalogTab === 'ubicaciones') && (
                                        <div className={catalogTab === 'grupos' ? "grid grid-cols-3 gap-3" : "grid grid-cols-1"}>
                                            {catalogTab === 'grupos' && (
                                                <div className="col-span-1">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Vida Útil (Años)</label>
                                                    <input
                                                        type="number"
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                        value={catForm.vida_util}
                                                        onChange={e => setCatForm(p => ({ ...p, vida_util: e.target.value }))}
                                                    />
                                                </div>
                                            )}
                                            <div className={catalogTab === 'grupos' ? "col-span-2" : "col-span-1"}>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Observaciones</label>
                                                <input
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                    value={catForm.observaciones}
                                                    onChange={e => setCatForm(p => ({ ...p, observaciones: e.target.value }))}
                                                    placeholder="Notas adicionales..."
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-2">
                                    {editingCatalog && (
                                        <button
                                            onClick={() => { setEditingCatalog(null); setCatForm({ nombre: '', vida_util: '', observaciones: '' }); }}
                                            className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600"
                                        >Cancelar</button>
                                    )}
                                    <button
                                        disabled={!catForm.nombre || catSaving}
                                        onClick={async () => {
                                            setCatSaving(true);
                                            try {
                                                const url = catalogTab === 'ubicaciones' ? '/api/catalogos/ubicaciones' : (catalogTab === 'auxiliares' ? '/api/catalogos/auxiliares' : '/api/catalogos/grupos');
                                                const method = editingCatalog ? 'PUT' : 'POST';
                                                const finalUrl = editingCatalog ? `${url}/${editingCatalog.id}` : url;

                                                await authFetch(finalUrl, {
                                                    method,
                                                    body: JSON.stringify({ ...catForm, registrado_por: currentUser?.nombre })
                                                });

                                                setCatForm({ nombre: '', vida_util: '', observaciones: '' });
                                                setEditingCatalog(null);
                                                fetchCatalogos();
                                            } catch (e) {
                                                alert("Error al guardar catálogo");
                                            } finally {
                                                setCatSaving(false);
                                            }
                                        }}
                                        className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-200 disabled:opacity-50 active:scale-95 transition-all"
                                    >
                                        {catSaving ? 'Guardando...' : (editingCatalog ? 'Actualizar' : 'Registrar')}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Registros Actuales</h4>
                                <div className="space-y-1.5">
                                    {(catalogTab === 'ubicaciones' ? (catalogos.ubicaciones || []) : (catalogTab === 'auxiliares' ? catalogos.auxiliares : catalogos.grupos)).map(item => (
                                        <div key={item.id} className="group flex items-center justify-between p-3 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 hover:shadow-sm transition-all">
                                            <div>
                                                <p className="text-xs font-bold text-slate-700">{item.nombre}</p>
                                                {catalogTab === 'ubicaciones' && item.direccion && (
                                                    <p className="text-[9px] text-slate-400 font-bold opacity-70">
                                                        📍 {item.direccion} {item.observaciones ? `· ${item.observaciones}` : ''}
                                                    </p>
                                                )}
                                                {catalogTab === 'grupos' && item.vida_util && (
                                                    <p className="text-[9px] text-slate-400 font-bold opacity-70">
                                                        ⏱️ {item.vida_util} años de vida útil {item.observaciones ? `· ${item.observaciones}` : ''}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => {
                                                        setEditingCatalog(item);
                                                        setCatForm({
                                                            nombre: item.nombre,
                                                            direccion: item.direccion || '',
                                                            vida_util: item.vida_util || '',
                                                            observaciones: item.observaciones || ''
                                                        });
                                                    }}
                                                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm("¿Eliminar este registro permanente?")) return;
                                                        const url = catalogTab === 'ubicaciones' ? '/api/catalogos/ubicaciones' : (catalogTab === 'auxiliares' ? '/api/catalogos/auxiliares' : '/api/catalogos/grupos');
                                                        await authFetch(`${url}/${item.id}`, { method: 'DELETE' });
                                                        fetchCatalogos();
                                                    }}
                                                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {(catalogTab === 'ubicaciones' ? (catalogos.ubicaciones || []) : (catalogTab === 'auxiliares' ? catalogos.auxiliares : catalogos.grupos)).length === 0 && (
                                        <div className="py-8 text-center text-slate-300 text-[10px] font-bold uppercase tracking-widest">No hay registros</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal>

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
                                            <th className="w-12 px-2 py-3 bg-slate-50 rounded-tl-xl text-center">ID</th>
                                            <th className="px-4 py-3 bg-slate-50 italic">Código / Descripción</th>
                                            <th className="px-4 py-3 bg-slate-50">Descripción</th>
                                            <th className="px-4 py-3 bg-slate-50">Estado</th>
                                            <th className="px-4 py-3 bg-slate-50">Ubicación Actual</th>
                                            <th className="px-4 py-3 bg-slate-50">Responsable / Origen</th>
                                            <th className="px-4 py-3 bg-slate-50 text-right rounded-tr-xl">–</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filtered.slice(0, 200).map(a => (
                                            <tr key={`${a.institucion || 'x'}-${a.id}`} className={`transition-colors text-sm ${getRowStyle(a.institucion)}`}>
                                                <td className="px-2 py-2 text-center text-[10px] font-mono text-slate-300 border-r border-slate-50/50">{a.id}</td>
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
                                                </td>
                                                <td className="px-4 py-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusStyle(a.estado_actual)}`}>
                                                        {a.estado_actual}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-[10px] text-slate-500 font-semibold italic">
                                                    {a.edificio ? <span className="text-slate-700 font-bold block mb-0.5 uppercase tracking-tighter not-italic">{a.edificio}</span> : ''}
                                                    {a.oficina ? `${a.oficina} (P${a.piso})` : '—'}
                                                    <div className="text-[9px] text-slate-400 mt-0.5 not-italic flex flex-col gap-0.5">
                                                        {a.auxiliar && <span className="text-indigo-500 font-bold bg-indigo-50 px-1 py-0.5 rounded-md self-start border border-indigo-100/50">Aux: {a.auxiliar}</span>}
                                                        {a.grupo_contable && (
                                                            <span title={a.grupo_observaciones} className="text-emerald-600 font-bold bg-emerald-50 px-1 py-0.5 rounded-md self-start border border-emerald-100/50">
                                                                Grp: {a.grupo_contable} {a.grupo_vida_util ? `(${a.grupo_vida_util}a)` : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                    {a.usuario_nombre ? (
                                                        <div className="text-[10px] text-indigo-600 font-bold flex items-center gap-1">
                                                            <UserCheck size={10} /> {a.usuario_nombre}
                                                        </div>
                                                    ) : <span className="text-slate-300 text-xs">—</span>}
                                                    {a.registrado_por && (
                                                        <div className="text-[8px] font-bold text-violet-400 uppercase mt-0.5">
                                                            Reg: {a.registrado_por}
                                                        </div>
                                                    )}
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
                                                <td colSpan={6} className="px-4 py-3 text-center text-xs text-slate-400 font-medium bg-slate-50">
                                                    Mostrando 200 de {filtered.length} resultados.
                                                </td>
                                            </tr>
                                        )}
                                        {filtered.length === 0 && (
                                            <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">Sin resultados</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

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
                                                {a.usuario_nombre ? (
                                                    <div className="text-[10px] text-indigo-600 font-bold flex items-center gap-1">
                                                        <UserCheck size={10} /> {a.usuario_nombre}
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] text-slate-300 font-bold italic">Sin asignar</div>
                                                )}
                                                {a.oficina && (
                                                    <div className="text-[10px] text-slate-400 font-bold bg-slate-50 px-1.5 rounded border border-slate-100">
                                                        📍 {a.oficina} (P{a.piso})
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {showModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                        <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">
                            <div className="sm:hidden w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1" />
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                                <h3 className="font-bold text-slate-900 text-sm">{editingActivo ? 'Editar Activo' : 'Registrar Nuevo Activo'}</h3>
                                <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X size={20} /></button>
                            </div>
                            <form onSubmit={handleSubmit} className="p-4 space-y-4">
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
                                <div className="grid grid-cols-1 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Estado</label>
                                        <select name="estado_actual"
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                                            value={formData.estado_actual} onChange={handleInputChange}>
                                            <option>Disponible</option>
                                            <option>Asignado</option>
                                            <option>Mantenimiento</option>
                                            <option>Sobrante</option>
                                            <option>Baja</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-2 border-t border-slate-100">
                                    <div className="grid grid-cols-1 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block tracking-wider uppercase">Ubicación Física (Edificio)</label>
                                            <QuickAddSelect
                                                options={catalogos.ubicaciones}
                                                value={formData.ubicacion_fisica_id}
                                                onChange={id => setFormData(p => ({ ...p, ubicacion_fisica_id: id, cat_unidad_id: '', cat_oficina_id: '' }))}
                                                onRegisterRequest={val => handleRegisterRequest('ubicacion', val)}
                                                placeholder="Buscar o registrar Edificio..."
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Unidad</label>
                                            <QuickAddSelect
                                                options={catalogos.unidades.filter(u => !formData.ubicacion_fisica_id || u.ubicacion_fisica_id === Number(formData.ubicacion_fisica_id))}
                                                value={formData.cat_unidad_id}
                                                onChange={id => setFormData(p => ({ ...p, cat_unidad_id: id, cat_oficina_id: '' }))}
                                                onRegisterRequest={val => handleRegisterRequest('unidad', val)}
                                                placeholder="Buscar o registrar Unidad..."
                                                disabled={!formData.ubicacion_fisica_id}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Oficina</label>
                                            <QuickAddSelect
                                                options={catalogos.oficinas.filter(o => !formData.cat_unidad_id || o.unidad_id === Number(formData.cat_unidad_id))}
                                                value={formData.cat_oficina_id}
                                                onChange={id => setFormData(p => ({ ...p, cat_oficina_id: id }))}
                                                onRegisterRequest={val => handleRegisterRequest('oficina', val)}
                                                placeholder="Buscar o registrar Oficina..."
                                                disabled={!formData.cat_unidad_id}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Piso</label>
                                            <QuickAddSelect
                                                options={catalogos.pisos}
                                                value={formData.cat_piso_id}
                                                onChange={id => setFormData(p => ({ ...p, cat_piso_id: id }))}
                                                onRegisterRequest={val => handleRegisterRequest('piso', val)}
                                                labelField="numero"
                                                placeholder="Buscar o registrar Piso..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2 border-t border-slate-100">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest block bg-slate-50 p-1 rounded">Clasificación Contable</label>
                                    <div className="grid grid-cols-1 gap-3">
                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Grupo Contable</label>
                                            <SearchableSelect
                                                options={catalogos.grupos}
                                                value={formData.cat_grupo_contable_id || ''}
                                                onChange={id => setFormData(p => ({ ...p, cat_grupo_contable_id: id, cat_auxiliar_id: '' }))}
                                                placeholder="Buscar grupo..."
                                                emptyLabel="— Seleccionar Grupo —"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">
                                                Auxiliar {formData.cat_grupo_contable_id ? <span className="text-indigo-400">({catalogos.auxiliares.filter(a => String(a.cat_grupo_contable_id) === String(formData.cat_grupo_contable_id)).length} opciones)</span> : ''}
                                            </label>
                                            <SearchableSelect
                                                options={formData.cat_grupo_contable_id
                                                    ? catalogos.auxiliares.filter(a => String(a.cat_grupo_contable_id) === String(formData.cat_grupo_contable_id))
                                                    : catalogos.auxiliares
                                                }
                                                value={formData.cat_auxiliar_id || ''}
                                                onChange={id => setFormData(p => ({ ...p, cat_auxiliar_id: id }))}
                                                placeholder="Buscar auxiliar..."
                                                emptyLabel="— Seleccionar Auxiliar —"
                                                disabled={false}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button type="button" onClick={() => setShowModal(false)}
                                        className="flex-1 py-2.5 border border-slate-200 text-slate-400 rounded-lg font-bold text-sm hover:bg-slate-50 transition-all">
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

            <QuickRegisterModal
                isOpen={quickReg.isOpen}
                onClose={() => setQuickReg(p => ({ ...p, isOpen: false }))}
                type={quickReg.type}
                initialName={quickReg.name}
                contextData={quickReg.context}
                catalogos={catalogos}
                onSave={handleQuickSave}
            />
        </>
    );
};

export default ActivosView;
