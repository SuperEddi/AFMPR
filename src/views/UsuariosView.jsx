import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Edit2, UserPlus, X, Users, MapPin, Briefcase, Fingerprint, Building, Layers } from 'lucide-react';
import { AppDialog, useDialog } from '../components/AppDialog';
import QuickAddSelect from '../components/QuickAddSelect';
import QuickRegisterModal from '../components/QuickRegisterModal';

const INST_CONFIG = {
    TIERRAS: { pill: 'bg-emerald-600 text-white', border: 'border-l-4 border-l-emerald-400', rowBg: '' },
    JUSTICIA: { pill: 'bg-blue-600 text-white', border: 'border-l-4 border-l-blue-500', rowBg: '' },
    PRESIDENCIA: { pill: 'bg-amber-600 text-white', border: 'border-l-4 border-l-amber-500', rowBg: '' },
    CULTURAS: { pill: 'bg-indigo-600 text-white', border: 'border-l-4 border-l-indigo-500', rowBg: '' },
    VICEPRESIDENCIA: { pill: 'bg-rose-600 text-white', border: 'border-l-4 border-l-rose-500', rowBg: '' },
};
const getInstitutionStyle = (inst) => {
    const cfg = INST_CONFIG[(inst || '').toUpperCase()];
    return cfg ? cfg.pill : 'bg-slate-400 text-white';
};
const getRowBorder = (inst) => {
    const cfg = INST_CONFIG[(inst || '').toUpperCase()];
    return cfg ? cfg.border : '';
};

const UsuariosView = ({ authFetch = fetch, currentUser, institution }) => {
    const [usuarios, setUsuarios] = useState([]);
    const [catalogos, setCatalogos] = useState({ ubicaciones: [], unidades: [], oficinas: [], pisos: [] });
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        nombre_completo: '', ci: '', cargo: '', ubicacion_fisica_id: '', cat_unidad_id: '', cat_piso_id: '', oficinas_ids: []
    });
    const [quickRegister, setQuickRegister] = useState({ isOpen: false, type: '', initialName: '', contextData: {} });
    const { showAlert, dialogProps } = useDialog();

    const fetchCatalogos = useCallback(async () => {
        try {
            const res = await authFetch('/api/catalogos');
            if (res.ok) {
                const data = await res.json();
                setCatalogos(data);
            }
        } catch (err) {
            console.error("Error fetching catalogos:", err);
        }
    }, [authFetch]);

    const fetchUsuarios = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await authFetch('/api/usuarios');
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();
            setUsuarios(Array.isArray(data) ? data : []);
        } catch (err) {
            setUsuarios([]);
        }
        setLoading(false);
    }, [authFetch]);

    // Carga inicial y cuando cambia la institución o los callbacks de fetch
    useEffect(() => {
        setUsuarios([]);
        setFilter('');
        fetchCatalogos();
        fetchUsuarios(false);
    }, [fetchUsuarios, fetchCatalogos, institution]);

    useEffect(() => {
        const handler = () => {
            fetchCatalogos();
            fetchUsuarios(true);
        };
        window.addEventListener('data-updated', handler);
        return () => window.removeEventListener('data-updated', handler);
    }, [fetchUsuarios, fetchCatalogos]);

    const handleInputChange = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

    // Al cambiar edificio, resetear unidad y oficinas para mantener coherencia
    const handleEdificioChange = e => {
        const val = e.target.value;
        setFormData(p => ({ ...p, ubicacion_fisica_id: val, cat_unidad_id: '', oficinas_ids: [] }));
    };

    const handleOfficeChange = (officeId) => {
        setFormData(p => {
            const current = p.oficinas_ids || [];
            if (current.includes(officeId)) {
                return { ...p, oficinas_ids: current.filter(id => id !== officeId) };
            } else {
                return { ...p, oficinas_ids: [...current, officeId] };
            }
        });
    };

    const handleQuickSave = async (type, data) => {
        await fetchCatalogos(); // Refrescar catálogos para ver el nuevo item
        if (type === 'ubicacion' && data.id) {
            setFormData(prev => ({ ...prev, ubicacion_fisica_id: data.id, cat_unidad_id: '', oficinas_ids: [] }));
        } else if (type === 'piso' && data.id) {
            setFormData(prev => ({ ...prev, cat_piso_id: data.id }));
        } else if (type === 'unidad' && data.id) {
            setFormData(prev => ({ ...prev, cat_unidad_id: data.id, oficinas_ids: [] }));
        } else if (type === 'oficina' && data.id) {
            setFormData(prev => {
                const arr = prev.oficinas_ids || [];
                if (!arr.includes(data.id)) return { ...prev, oficinas_ids: [...arr, data.id] };
                return prev;
            });
        }
    };

    const openModal = (user = null) => {
        setEditingUser(user);
        if (user) {
            setFormData({
                nombre_completo: user.nombre_completo,
                ci: user.ci,
                cargo: user.cargo,
                ubicacion_fisica_id: user.ubicacion_fisica_id || '',
                cat_unidad_id: user.cat_unidad_id || '',
                cat_piso_id: user.cat_piso_id || '',
                oficinas_ids: user.oficinas_ids || []
            });
        } else {
            setFormData({ nombre_completo: '', ci: '', cargo: '', ubicacion_fisica_id: '', cat_unidad_id: '', cat_piso_id: '', oficinas_ids: [] });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Si ya tenemos la adminPassword en el contexto (inyectada por App.jsx vía authFetch),
        // no necesitamos pedirla de nuevo por prompt.
        // Pero UsuariosView no recibe 'adminPassword' como prop explícita, la usa authFetch.
        // Verificaremos si authFetch funciona o si falló con 401.


        setSaving(true);
        try {
            const url = editingUser ? `/api/usuarios/${editingUser.id}` : '/api/usuarios';
            const method = editingUser ? 'PUT' : 'POST';
            const res = await authFetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-target-institution': editingUser?.institucion
                },
                body: JSON.stringify({ ...formData, registrado_por: editingUser ? editingUser.registrado_por : currentUser?.nombre })
            });
            if (res.ok) {
                setShowModal(false);
                fetchUsuarios();
            } else {
                const data = await res.json();
                await showAlert(data.message || data.error || 'No se pudo guardar el usuario.', {
                    title: data.error || 'Error al guardar',
                    type: 'error'
                });
            }
        } catch (e) {
            await showAlert('Error al guardar el usuario.', { title: 'Error de red', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const filtered = useMemo(() => {
        const term = (filter || '').toLowerCase().trim();
        if (!term) return usuarios;

        return usuarios.filter(u => {
            const name = (u.nombre_completo || '').toLowerCase();
            const ci = String(u.ci || '').toLowerCase();
            const cargo = (u.cargo || '').toLowerCase();
            const unidad = (u.unidad || '').toLowerCase();
            const oficinas = (u.oficinas || '').toLowerCase();
            const inst = (u.institucion || '').toLowerCase();

            return name.includes(term) ||
                ci.includes(term) ||
                cargo.includes(term) ||
                unidad.includes(term) ||
                inst.includes(term) ||
                oficinas.includes(term);
        });
    }, [usuarios, filter]);

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <div className="text-slate-400 font-semibold text-sm animate-pulse">Cargando usuarios...</div>
        </div>
    );

    return (
        <>
            <div className="space-y-4">
                {/* Header compacto */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 text-white rounded-xl">
                            <Users size={18} />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-slate-900 leading-tight">Gestión de Usuarios</h2>
                            <p className="text-slate-400 text-xs font-medium">
                                {filter ? `${filtered.length} de ${usuarios.length}` : `${usuarios.length}`} personas registradas
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="relative flex-1 sm:flex-none">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Búsqueda rápida..."
                                className="w-full sm:w-52 pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => openModal()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center gap-1.5 font-semibold text-sm transition-all active:scale-95 whitespace-nowrap shadow-md shadow-blue-500/20"
                        >
                            <UserPlus size={16} /> <span className="hidden sm:inline">Registrar</span>
                        </button>
                    </div>
                </div>

                {/* Tabla desktop */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="hidden md:block overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-20">
                                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                                    <th className="px-4 py-3 bg-slate-50">Nombre</th>
                                    <th className="px-4 py-3 bg-slate-50 text-center">CI</th>
                                    <th className="px-4 py-3 bg-slate-50">Cargo/Unidad</th>
                                    <th className="px-4 py-3 bg-slate-50">Oficinas Asignadas</th>
                                    <th className="px-4 py-3 bg-slate-50">Registrado por</th>
                                    <th className="px-4 py-3 bg-slate-50 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filtered.map(u => (
                                    <tr key={`${u.institucion || 'x'}-${u.id}`} className={`hover:bg-slate-50 transition-colors text-sm ${getRowBorder(u.institucion)}`}>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center text-[10px] font-semibold text-blue-700 flex-shrink-0">
                                                    {u.nombre_completo?.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-slate-800 leading-tight">{u.nombre_completo}</span>
                                                        {u.institucion && (
                                                            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${getInstitutionStyle(u.institucion)}`}>
                                                                {u.institucion}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">{u.ci}</span>
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-600 text-xs font-medium">
                                            <div className="font-semibold">{u.cargo || '—'}</div>
                                            <div className="text-[10px] text-slate-400">
                                                {u.edificio ? <span className="font-semibold text-indigo-500 uppercase">{u.edificio}</span> : ''}
                                                {u.edificio && u.unidad ? ' · ' : ''}
                                                {u.unidad || '—'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-slate-500 italic max-w-[200px] truncate">
                                            {u.oficinas || '—'}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {u.registrado_por ? (
                                                <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-100 uppercase">
                                                    {u.registrado_por}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <button
                                                onClick={() => openModal(u)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm font-medium">Sin resultados</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden divide-y divide-slate-100">
                        {filtered.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 text-sm font-medium">Sin resultados</div>
                        ) : filtered.map(u => (
                            <div key={`${u.institucion || 'x'}-${u.id}`} className="p-3 flex items-center gap-3">
                                <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center text-sm font-semibold text-blue-700 flex-shrink-0">
                                    {u.nombre_completo?.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className="font-semibold text-slate-800 text-sm truncate">{u.nombre_completo}</div>
                                        {u.institucion && (
                                            <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-tighter ${getInstitutionStyle(u.institucion)}`}>
                                                {u.institucion}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-medium">
                                        CI: {u.ci} {u.cargo && `• ${u.cargo}`}
                                    </div>
                                    {u.unidad && <div className="text-[10px] text-slate-400 truncate">{u.unidad}</div>}
                                </div>
                                <button
                                    onClick={() => openModal(u)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
                                >
                                    <Edit2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                        <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">
                            {/* Handle bar móvil */}
                            <div className="sm:hidden w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1" />
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                                <h3 className="font-semibold text-slate-900 text-sm">
                                    {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                                </h3>
                                <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleSubmit} className="p-4 space-y-4">
                                <div>
                                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                        <UserPlus size={11} /> Nombre Completo
                                    </label>
                                    <input name="nombre_completo" required
                                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium transition-all"
                                        value={formData.nombre_completo || ''} onChange={handleInputChange}
                                        placeholder="Ej. Juan Pérez Gómez"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                            <Fingerprint size={11} /> CI
                                        </label>
                                        <input name="ci" required type="number"
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                                            value={formData.ci || ''} onChange={handleInputChange}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                            <Briefcase size={11} /> Cargo
                                        </label>
                                        <input name="cargo"
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                                            value={formData.cargo || ''} onChange={handleInputChange}
                                        />
                                    </div>
                                </div>

                                {/* Edificio / Ubicación Física */}
                                <div>
                                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                        <MapPin size={11} /> Edificio / Ubicación Física
                                    </label>
                                    <QuickAddSelect
                                        options={catalogos.ubicaciones || []}
                                        value={formData.ubicacion_fisica_id}
                                        onChange={id => handleEdificioChange({ target: { name: 'ubicacion_fisica_id', value: id } })}
                                        onRegisterRequest={val => setQuickRegister({ isOpen: true, type: 'ubicacion', initialName: val, contextData: {} })}
                                        placeholder="Seleccionar Edificio..."
                                        labelField="nombre"
                                    />
                                </div>

                                {/* Piso */}
                                <div>
                                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                        <Layers size={11} /> Piso
                                    </label>
                                    <QuickAddSelect
                                        options={catalogos.pisos || []}
                                        value={formData.cat_piso_id}
                                        onChange={id => setFormData(p => ({ ...p, cat_piso_id: id }))}
                                        onRegisterRequest={val => setQuickRegister({ isOpen: true, type: 'piso', initialName: val, contextData: {} })}
                                        placeholder="Seleccione Piso..."
                                        labelField="numero"
                                    />
                                </div>

                                {/* Unidad */}
                                <div>
                                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                        <Building size={11} /> Unidad (Catálogo)
                                    </label>
                                    <QuickAddSelect
                                        options={(catalogos.unidades || []).filter(u => !formData.ubicacion_fisica_id || u.ubicacion_fisica_id === Number(formData.ubicacion_fisica_id))}
                                        value={formData.cat_unidad_id}
                                        onChange={id => setFormData(p => ({ ...p, cat_unidad_id: id }))}
                                        onRegisterRequest={val => setQuickRegister({ isOpen: true, type: 'unidad', initialName: val, contextData: { ubicacion_fisica_id: formData.ubicacion_fisica_id } })}
                                        placeholder="Seleccione Unidad..."
                                        disabled={!formData.ubicacion_fisica_id}
                                        labelField="nombre"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                        <MapPin size={11} /> Oficinas Asignadas (Multiselección)
                                    </label>
                                    <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-lg p-2 bg-slate-50 space-y-1 custom-scrollbar text-left">
                                        {catalogos.oficinas
                                            .filter(o => !formData.cat_unidad_id || o.unidad_id === Number(formData.cat_unidad_id))
                                            .map(o => (
                                                <label key={o.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={(formData.oficinas_ids || []).includes(o.id)}
                                                        onChange={() => handleOfficeChange(o.id)}
                                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span className="text-xs font-semibold text-slate-700">{o.nombre}</span>
                                                </label>
                                            ))
                                        }
                                        {catalogos.oficinas.length === 0 && <div className="text-center text-[10px] py-4 text-slate-400">No hay oficinas disponibles</div>}
                                    </div>
                                    <div className="flex items-center justify-between mt-1.5">
                                        <p className="text-[9px] text-slate-400 italic leading-tight">* Solo se muestran oficinas de la unidad seleccionada.</p>
                                        {formData.cat_unidad_id && (
                                            <button
                                                type="button"
                                                onClick={() => setQuickRegister({ isOpen: true, type: 'oficina', initialName: '', contextData: { unidad_id: formData.cat_unidad_id } })}
                                                className="text-[9px] font-semibold text-indigo-600 hover:text-indigo-700 uppercase tracking-tight flex items-center gap-1"
                                            >
                                                <Users size={10} /> + Registrar Nueva Oficina
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button type="button" onClick={() => setShowModal(false)}
                                        className="flex-1 py-2.5 border border-slate-200 text-slate-400 rounded-lg font-semibold text-sm hover:bg-slate-50 transition-all">
                                        Cancelar
                                    </button>
                                    <button type="submit" disabled={saving}
                                        className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50">
                                        {saving ? 'Guardando...' : editingUser ? 'Guardar' : 'Registrar'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
            <AppDialog {...dialogProps} />

            <QuickRegisterModal
                isOpen={quickRegister.isOpen}
                onClose={() => setQuickRegister({ isOpen: false, type: '', initialName: '', contextData: {} })}
                type={quickRegister.type}
                initialName={quickRegister.initialName}
                contextData={quickRegister.contextData}
                catalogos={catalogos}
                onSave={handleQuickSave}
            />
        </>
    );
};

export default UsuariosView;
