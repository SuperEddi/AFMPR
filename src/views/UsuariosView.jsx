import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Edit2, UserPlus, X, Users, MapPin, Briefcase, Fingerprint, Building } from 'lucide-react';
import { AppDialog, useDialog } from '../components/AppDialog';

const INST_CONFIG = {
    TIERRAS: { pill: 'bg-emerald-600 text-white', border: 'border-l-4 border-l-emerald-400', rowBg: '' },
    JUSTICIA: { pill: 'bg-blue-600 text-white', border: 'border-l-4 border-l-blue-500', rowBg: '' },
    PRESIDENCIA: { pill: 'bg-slate-800 text-white', border: 'border-l-4 border-l-slate-500', rowBg: '' },
};
const getInstitutionStyle = (inst) => {
    const cfg = INST_CONFIG[(inst || '').toUpperCase()];
    return cfg ? cfg.pill : 'bg-slate-400 text-white';
};
const getRowBorder = (inst) => {
    const cfg = INST_CONFIG[(inst || '').toUpperCase()];
    return cfg ? cfg.border : '';
};

const UsuariosView = ({ authFetch = fetch, currentUser }) => {
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        nombre_completo: '', ci: '', cargo: '', unidad: '', oficina: '', piso: ''
    });
    const { showAlert, dialogProps } = useDialog();

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

    // Carga inicial y cuando cambia la institución (authFetch cambia)
    useEffect(() => {
        setUsuarios([]);   // Limpia lista inmediatamente al cambiar de institución
        setFilter('');     // Resetea la búsqueda
        fetchUsuarios(false);
    }, [fetchUsuarios]);

    useEffect(() => {
        const handler = () => {
            setUsuarios([]);
            setFilter('');
            fetchUsuarios(false);
        };
        window.addEventListener('data-updated', handler);
        return () => window.removeEventListener('data-updated', handler);
    }, [fetchUsuarios]);

    const handleInputChange = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

    const openModal = (user = null) => {
        setEditingUser(user);
        setFormData(user || { nombre_completo: '', ci: '', cargo: '', unidad: '', oficina: '', piso: '' });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const password = prompt("Ingrese la contraseña de administrador para confirmar:");
        if (!password) return;

        setSaving(true);
        try {
            const url = editingUser ? `/api/usuarios/${editingUser.id}` : '/api/usuarios';
            const method = editingUser ? 'PUT' : 'POST';
            const res = await authFetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-password': password,
                    'x-target-institution': editingUser?.institucion
                },
                body: JSON.stringify({ ...formData, registrado_por: editingUser ? editingUser.registrado_por : currentUser?.nombre })
            });
            if (res.ok) {
                setShowModal(false);
                fetchUsuarios();
            } else {
                const data = await res.json();
                await showAlert(data.error || 'No se pudo guardar el usuario.', { title: 'Error al guardar', type: 'error' });
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
            const inst = (u.institucion || '').toLowerCase();
            const oficina = (u.oficina || '').toLowerCase();
            const piso = String(u.piso || '').toLowerCase();
            const pisoLabel = `p${piso}`; // Para que coincida con "P12", "P3", etc.
            const ubic = `${oficina} ${pisoLabel}`.toLowerCase();

            return name.includes(term) ||
                ci.includes(term) ||
                cargo.includes(term) ||
                unidad.includes(term) ||
                inst.includes(term) ||
                oficina.includes(term) ||
                piso.includes(term) ||
                pisoLabel.includes(term) ||
                ubic.includes(term);
        });
    }, [usuarios, filter]);

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <div className="text-slate-400 font-bold text-sm animate-pulse">Cargando usuarios...</div>
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
                            <h2 className="text-base font-black text-slate-900 leading-tight">Gestión de Usuarios</h2>
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
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center gap-1.5 font-bold text-sm transition-all active:scale-95 whitespace-nowrap shadow-md shadow-blue-500/20"
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
                                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                                    <th className="px-4 py-3 bg-slate-50">Nombre</th>
                                    <th className="px-4 py-3 bg-slate-50 text-center">CI</th>
                                    <th className="px-4 py-3 bg-slate-50">Cargo/Unidad</th>
                                    <th className="px-4 py-3 bg-slate-50">Ubic.</th>
                                    <th className="px-4 py-3 bg-slate-50">Registrado por</th>
                                    <th className="px-4 py-3 bg-slate-50 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filtered.map(u => (
                                    <tr key={`${u.institucion || 'x'}-${u.id}`} className={`hover:bg-slate-50 transition-colors text-sm ${getRowBorder(u.institucion)}`}>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center text-[10px] font-black text-blue-700 flex-shrink-0">
                                                    {u.nombre_completo?.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-slate-800 leading-tight">{u.nombre_completo}</span>
                                                        {u.institucion && (
                                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide ${getInstitutionStyle(u.institucion)}`}>
                                                                {u.institucion}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">{u.ci}</span>
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-600 text-xs font-medium">
                                            <div className="font-bold">{u.cargo || '—'}</div>
                                            <div className="text-[10px] text-slate-400">{u.unidad || '—'}</div>
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-slate-400">
                                            {u.oficina ? `${u.oficina} P${u.piso}` : '—'}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {u.registrado_por ? (
                                                <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-100 uppercase">
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
                                <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center text-sm font-black text-blue-700 flex-shrink-0">
                                    {u.nombre_completo?.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className="font-bold text-slate-800 text-sm truncate">{u.nombre_completo}</div>
                                        {u.institucion && (
                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${getInstitutionStyle(u.institucion)}`}>
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
                                <h3 className="font-bold text-slate-900 text-sm">
                                    {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                                </h3>
                                <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleSubmit} className="p-4 space-y-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
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
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                            <Fingerprint size={11} /> CI
                                        </label>
                                        <input name="ci" required type="number"
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                                            value={formData.ci || ''} onChange={handleInputChange}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                            <Briefcase size={11} /> Cargo
                                        </label>
                                        <input name="cargo"
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                                            value={formData.cargo || ''} onChange={handleInputChange}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                        <Building size={11} /> Unidad / Departamento
                                    </label>
                                    <input name="unidad"
                                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                                        value={formData.unidad || ''} onChange={handleInputChange}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                            <MapPin size={11} /> Oficina
                                        </label>
                                        <input name="oficina"
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                                            value={formData.oficina || ''} onChange={handleInputChange}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Piso</label>
                                        <input name="piso"
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                                            value={formData.piso || ''} onChange={handleInputChange}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button type="button" onClick={() => setShowModal(false)}
                                        className="flex-1 py-2.5 border border-slate-200 text-slate-400 rounded-lg font-bold text-sm hover:bg-slate-50 transition-all">
                                        Cancelar
                                    </button>
                                    <button type="submit" disabled={saving}
                                        className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50">
                                        {saving ? 'Guardando...' : editingUser ? 'Guardar' : 'Registrar'}
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

export default UsuariosView;
