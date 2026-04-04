import React, { useState, useEffect, useCallback } from 'react';
import {
    Building2, MapPin, Layers, Hash, Briefcase, Archive,
    Plus, Edit2, Trash2, CheckCircle2, XCircle, Search,
    ChevronRight, Filter, MoreVertical
} from 'lucide-react';
import { AppDialog, useDialog } from '../components/AppDialog';
import QuickRegisterModal from '../components/QuickRegisterModal';

const CatalogosView = ({ authFetch, currentUser }) => {
    const [activeTab, setActiveTab] = useState('ubicaciones');
    const [catalogos, setCatalogos] = useState({
        ubicaciones: [], unidades: [], oficinas: [], pisos: [], auxiliares: [], grupos: []
    });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { showAlert, showConfirm, dialogProps } = useDialog();

    // Estado para el modal de edición/registro
    const [modalData, setModalData] = useState({ isOpen: false, type: '', data: null });

    const fetchCatalogosFull = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch('/api/catalogos?full=true');
            if (res.ok) {
                setCatalogos(await res.json());
            }
        } catch (err) {
            console.error("Error fetching catalogs:", err);
        } finally {
            setLoading(false);
        }
    }, [authFetch]);

    useEffect(() => {
        fetchCatalogosFull();
    }, [fetchCatalogosFull]);

    const handleToggleStatus = async (tipo, item) => {
        const nuevoEstado = item.activo === 1 ? 0 : 1;
        const confirm = await showConfirm(
            `¿Estás seguro de ${nuevoEstado === 0 ? 'inhabilitar' : 'habilitar'} "${item.nombre || item.numero}"?`,
            {
                title: 'Confirmar cambio de estado',
                confirmText: nuevoEstado === 0 ? 'Inhabilitar' : 'Habilitar',
                type: nuevoEstado === 0 ? 'warning' : 'info'
            }
        );

        if (!confirm) return;

        try {
            // Mapeo de tipos de catálogo a endpoints
            const endpoints = {
                ubicaciones: 'ubicaciones',
                unidades: 'unidades',
                oficinas: 'oficinas',
                pisos: 'pisos',
                auxiliares: 'auxiliares',
                grupos: 'grupos'
            };

            const res = await authFetch(`/api/catalogos/${endpoints[tipo]}/${item.id}`, {
                method: 'PUT',
                body: JSON.stringify({ ...item, activo: nuevoEstado })
            });

            if (res.ok) {
                await fetchCatalogosFull();
                window.dispatchEvent(new CustomEvent('data-updated'));
            } else {
                const err = await res.json();
                showAlert(err.message || err.error || "Error al actualizar estado", {
                    title: err.error || 'Error',
                    type: 'error'
                });
            }
        } catch (err) {
            showAlert("Error de conexión", { type: 'error' });
        }
    };

    const handleEdit = (tipo, item) => {
        setModalData({
            isOpen: true,
            type: tipo.slice(0, -1), // unidades -> unidad
            data: item
        });
    };

    const handleNew = (tipo) => {
        setModalData({
            isOpen: true,
            type: tipo.slice(0, -1),
            data: null
        });
    };

    const TABS = [
        { id: 'ubicaciones', label: 'Edificios', icon: Building2, color: 'text-indigo-500', bg: 'bg-indigo-50' },
        { id: 'unidades', label: 'Unidades', icon: MapPin, color: 'text-emerald-500', bg: 'bg-emerald-50' },
        { id: 'oficinas', label: 'Oficinas', icon: Layers, color: 'text-blue-500', bg: 'bg-blue-50' },
        { id: 'pisos', label: 'Pisos', icon: Hash, color: 'text-slate-500', bg: 'bg-slate-50' },
        { id: 'auxiliares', label: 'Auxiliares', icon: Briefcase, color: 'text-amber-500', bg: 'bg-amber-50' },
        { id: 'grupos', label: 'Grupos Cont.', icon: Archive, color: 'text-violet-500', bg: 'bg-violet-50' },
    ];

    const currentData = catalogos[activeTab] || [];
    const filteredData = currentData.filter(item => {
        const text = (item.nombre || item.numero || '').toLowerCase();
        return text.includes(searchTerm.toLowerCase());
    });

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header y Buscador */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gestión de Catálogos</h1>
                    <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Administración de entidades y ubicaciones</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            placeholder="Buscar en el catálogo..."
                            className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium w-full md:w-64 focus:outline-none focus:ring-4 focus:ring-slate-500/10 transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => handleNew(activeTab)}
                        className="bg-slate-900 text-white p-2.5 rounded-2xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 active:scale-95"
                    >
                        <Plus size={20} />
                    </button>
                </div>
            </div>

            {/* Selector de Pestañas (Tabs) */}
            <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setSearchTerm(''); }}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${isActive ? `${tab.bg} ${tab.color} shadow-sm` : 'text-slate-400 hover:bg-slate-50'
                                }`}
                        >
                            <Icon size={16} />
                            {tab.label}
                            <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[10px] ${isActive ? tab.bg.replace('50', '100') : 'bg-slate-100'}`}>
                                {catalogos[tab.id]?.length || 0}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Tabla de Resultados */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre / Detalle</th>
                                {activeTab === 'ubicaciones' && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dirección</th>}
                                {activeTab === 'unidades' && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Edificio</th>}
                                {activeTab === 'oficinas' && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidad</th>}
                                {activeTab === 'grupos' && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vida Útil</th>}
                                {activeTab === 'auxiliares' && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Grupo Contable</th>}
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400 italic">Cargando datos...</td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400 italic">No se encontraron registros</td>
                                </tr>
                            ) : (
                                filteredData.map(item => (
                                    <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${item.activo === 0 ? 'opacity-60 grayscale' : ''}`}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-md">#{item.id}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-900 text-sm">{item.nombre || item.numero}</div>
                                            {item.observaciones && <div className="text-[10px] text-slate-400 truncate max-w-xs">{item.observaciones}</div>}
                                        </td>

                                        {activeTab === 'ubicaciones' && (
                                            <td className="px-6 py-4 text-xs text-slate-500 font-medium">{item.direccion || '—'}</td>
                                        )}

                                        {activeTab === 'unidades' && (
                                            <td className="px-6 py-4 text-xs text-slate-500 font-bold">
                                                {catalogos.ubicaciones.find(u => u.id === item.ubicacion_fisica_id)?.nombre || '—'}
                                            </td>
                                        )}

                                        {activeTab === 'oficinas' && (
                                            <td className="px-6 py-4 text-xs text-slate-500 font-bold">
                                                {catalogos.unidades.find(u => u.id === item.unidad_id)?.nombre || '—'}
                                            </td>
                                        )}

                                        {activeTab === 'grupos' && (
                                            <td className="px-6 py-4 text-xs text-slate-600 font-black">{item.vida_util} años</td>
                                        )}
                                        {activeTab === 'auxiliares' && (
                                            <td className="px-6 py-4 text-xs text-slate-500 font-bold">
                                                {item.grupo_nombre || '—'}
                                            </td>
                                        )}

                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${item.activo === 1 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                                                }`}>
                                                {item.activo === 1 ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                                                {item.activo === 1 ? 'Habilitado' : 'Inhabilitado'}
                                            </span>
                                        </td>

                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(activeTab, item)}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                    title="Editar"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(activeTab, item)}
                                                    className={`p-1.5 rounded-lg transition-all ${item.activo === 1 ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                                        }`}
                                                    title={item.activo === 1 ? 'Inhabilitar' : 'Habilitar'}
                                                >
                                                    {item.activo === 1 ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <AppDialog {...dialogProps} />

            {/* Modal de Registro/Edición — Reutilizamos el QuickRegisterModal o creamos uno integrado */}
            {modalData.isOpen && (
                <QuickRegisterModal
                    isOpen={modalData.isOpen}
                    onClose={() => setModalData({ isOpen: false, type: '', data: null })}
                    type={modalData.type}
                    initialName={modalData.data?.nombre || modalData.data?.numero || ""}
                    initialData={modalData.data} // Necesitamos pasar la data completa para editar
                    catalogos={catalogos}
                    onSave={async (tipo, data) => {
                        const method = modalData.data ? 'PUT' : 'POST';
                        const url = `/api/catalogos/${TABS.find(t => t.id === activeTab).id}${modalData.data ? '/' + modalData.data.id : ''}`;

                        const res = await authFetch(url, {
                            method,
                            body: JSON.stringify({ ...data, registrado_por: currentUser?.nombre })
                        });

                        if (res.ok) {
                            await fetchCatalogosFull();
                            window.dispatchEvent(new CustomEvent('data-updated'));
                        } else {
                            const err = await res.json();
                            throw new Error(err.message || err.error || "Error al guardar");
                        }
                    }}
                />
            )}
        </div>
    );
};

export default CatalogosView;
