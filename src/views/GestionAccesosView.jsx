import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ShieldCheck, UserPlus, Edit2, Trash2, X, Eye, EyeOff, Search, CheckCircle, XCircle } from 'lucide-react';
import { AppDialog, useDialog } from '../components/AppDialog';

const getInstitutionStyle = (inst) => {
    const i = (inst || '').toUpperCase();
    if (i === 'TIERRAS') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (i === 'JUSTICIA') return 'bg-amber-50 text-amber-600 border-amber-100';
    return 'bg-blue-50 text-blue-600 border-blue-100';
};

const RoleBadge = ({ rol }) => {
    if (rol === 'admin') {
        return (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-black uppercase tracking-wider w-fit">
                <ShieldCheck size={12} /> Administrador
            </span>
        );
    }
    return (
        <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-black uppercase tracking-wider w-fit">
            <UserPlus size={12} /> Técnico
        </span>
    );
};

const GestionAccesosView = ({ authFetch, currentUser, adminPassword }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [form, setForm] = useState({ username: '', nombre: '', password: '', rol: 'tecnico', instituciones: [] });
    const { showAlert, showConfirm, dialogProps } = useDialog();

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch('/api/system-users');
            if (res.ok) setUsers(await res.json());
        } catch { }
        setLoading(false);
    }, [authFetch]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const filtered = useMemo(() => {
        const t = filter.toLowerCase().trim();
        if (!t) return users;
        return users.filter(u =>
            (u.username || '').toLowerCase().includes(t) ||
            (u.nombre || '').toLowerCase().includes(t) ||
            (u.rol || '').toLowerCase().includes(t)
        );
    }, [users, filter]);

    const openNew = () => {
        setEditing(null);
        setForm({ username: '', nombre: '', password: '', rol: 'tecnico', instituciones: ['TIERRAS'] });
        setShowPass(false);
        setShowModal(true);
    };

    const openEdit = (u) => {
        setEditing(u);
        setForm({ username: u.username, nombre: u.nombre, password: '', rol: u.rol, instituciones: u.instituciones || [] });
        setShowPass(false);
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!editing && !form.password) {
            await showAlert('La contraseña es obligatoria para un nuevo usuario.', { type: 'error' });
            return;
        }
        if (form.instituciones.length === 0) {
            await showAlert('Debes seleccionar al menos una base de datos.', { type: 'error' });
            return;
        }

        setSaving(true);
        try {
            const url = editing ? `/api/system-users/${editing.username}` : '/api/system-users';
            const method = editing ? 'PUT' : 'POST';
            const body = { ...form };
            if (editing && !body.password) delete body.password;

            const res = await authFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                setShowModal(false);
                fetchUsers();
            } else {
                const d = await res.json();
                await showAlert(d.error || 'Error al guardar.', { type: 'error' });
            }
        } catch { await showAlert('Error de conexión.', { type: 'error' }); }
        setSaving(false);
    };

    const handleDelete = async (u) => {
        if (u.username === currentUser.username) {
            await showAlert('No puedes desactivar tu propia cuenta.', { type: 'error' });
            return;
        }
        const ok = await showConfirm(`¿Desactivar la cuenta "${u.username}" de TODAS sus bases de datos asociadas? El usuario ya no podrá iniciar sesión.`, { type: 'danger', title: 'Confirmar desactivación global' });
        if (!ok) return;
        const res = await authFetch(`/api/system-users/${u.username}`, { method: 'DELETE' });
        if (res.ok) {
            setUsers(prev => prev.map(x => x.username === u.username ? { ...x, activo: 0 } : x));
            await showAlert('Cuenta desactivada correctamente.', { type: 'success' });
        } else {
            const d = await res.json();
            await showAlert(d.error || 'Error al desactivar.', { type: 'error' });
        }
    };

    const handleToggle = async (u) => {
        if (u.username === currentUser.username) return;
        const res = await authFetch(`/api/system-users/${u.username}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...u, activo: u.activo ? 0 : 1, instituciones: u.instituciones }),
        });
        if (res.ok) fetchUsers();
    };

    const toggleInst = (name) => {
        setForm(p => {
            const current = p.instituciones || [];
            if (current.includes(name)) {
                return { ...p, instituciones: current.filter(i => i !== name) };
            } else {
                return { ...p, instituciones: [...current, name] };
            }
        });
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
            <div className="space-y-4">

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-500/20">
                            <ShieldCheck size={18} />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-slate-900">Gestión de Accesos</h2>
                            <p className="text-slate-400 text-xs font-medium">
                                {filter ? `${filtered.length} de ${users.length}` : users.length} cuentas del sistema
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="relative flex-1 sm:flex-none">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar usuario..."
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                                className="w-full sm:w-48 pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium"
                            />
                        </div>
                        <button
                            onClick={openNew}
                            className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg flex items-center gap-1.5 font-bold text-sm transition-all active:scale-95 shadow-md shadow-amber-500/20 whitespace-nowrap"
                        >
                            <UserPlus size={16} /> <span className="hidden sm:inline">Nueva Cuenta</span>
                        </button>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    {loading ? (
                        <div className="py-12 text-center text-slate-400 text-sm animate-pulse flex flex-col items-center gap-2">
                            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                            Cargando usuarios...
                        </div>
                    ) : (
                        <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 z-20">
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                                        <th className="px-4 py-3 bg-slate-50">Usuario</th>
                                        <th className="px-4 py-3 bg-slate-50">Nombre</th>
                                        <th className="px-4 py-3 bg-slate-50">Rol</th>
                                        <th className="px-4 py-3 bg-slate-50">Bases de Datos</th>
                                        <th className="px-4 py-3 bg-slate-50">Estado</th>
                                        <th className="px-4 py-3 bg-slate-50 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filtered.map(u => (
                                        <tr key={u.id} className="hover:bg-slate-50 transition-colors text-sm">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0 ${u.rol === 'admin' ? 'bg-amber-500' : 'bg-blue-600'}`}>
                                                        {u.username?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-mono font-bold text-slate-700 text-xs">{u.username}</span>
                                                    {u.username === currentUser.username && (
                                                        <span className="text-[8px] bg-green-100 text-green-700 font-black px-1.5 rounded-full">TÚ</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-700">{u.nombre}</td>
                                            <td className="px-4 py-3"><RoleBadge rol={u.rol} /></td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {(u.instituciones || []).map(inst => (
                                                        <span key={inst} className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter ${getInstitutionStyle(inst)}`}>
                                                            {inst}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => handleToggle(u)}
                                                    disabled={u.username === currentUser.username}
                                                    className="flex items-center gap-1.5 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                                                    title={u.username === currentUser.username ? 'No puedes desactivar tu propia cuenta' : ''}
                                                >
                                                    {u.activo
                                                        ? <><CheckCircle size={14} className="text-emerald-500" /><span className="text-emerald-600">Activo</span></>
                                                        : <><XCircle size={14} className="text-red-400" /><span className="text-red-500">Inactivo</span></>
                                                    }
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => openEdit(u)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Editar">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(u)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Desactivar globalmente">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && (
                                        <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm italic">Sin cuentas registradas</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm animate-in slide-in-from-bottom duration-300 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-slate-900 text-sm">
                                {editing ? 'Editar Cuenta' : 'Nueva Cuenta'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 space-y-3 max-h-[80vh] overflow-y-auto">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Nombre completo</label>
                                <input required value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                                    placeholder="Ej. Juan Pérez"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Usuario (login)</label>
                                <input required value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value.toLowerCase().trim() }))}
                                    disabled={!!editing}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                                    placeholder="usuario123"
                                />
                                {editing && <p className="text-[10px] text-slate-400 mt-1 italic">El nombre de usuario no puede cambiarse.</p>}
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                    {editing ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
                                </label>
                                <div className="relative">
                                    <input type={showPass ? 'text' : 'password'}
                                        value={form.password}
                                        onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                        required={!editing}
                                        className="w-full px-3 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono"
                                        placeholder={editing ? '(sin cambios)' : '••••••••'}
                                    />
                                    <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                        {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Rol</label>
                                    <select value={form.rol} onChange={e => setForm(p => ({ ...p, rol: e.target.value }))}
                                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium">
                                        <option value="tecnico">Técnico</option>
                                        <option value="admin">Administrador</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Registrar en bases de datos:</label>
                                <div className="space-y-1.5">
                                    {['TIERRAS', 'JUSTICIA', 'PRESIDENCIA'].map(inst => (
                                        <label key={inst} className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all ${form.instituciones.includes(inst) ? 'border-amber-500 bg-amber-50/50' : 'border-slate-100 hover:bg-slate-50'}`}>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${inst === 'TIERRAS' ? 'bg-emerald-500' : inst === 'JUSTICIA' ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
                                                <span className="text-xs font-bold text-slate-700">{inst}</span>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={form.instituciones.includes(inst)}
                                                onChange={() => toggleInst(inst)}
                                                className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                                            />
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2 pt-4">
                                <button type="button" onClick={() => setShowModal(false)}
                                    className="flex-1 py-2.5 border border-slate-200 text-slate-500 rounded-lg font-bold text-xs hover:bg-slate-50 transition-all">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={saving}
                                    className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg font-bold text-xs hover:bg-amber-600 shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50 transition-all">
                                    {saving ? 'Guardando...' : editing ? 'Guardar Cambios' : 'Crear Cuenta'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <AppDialog {...dialogProps} />
        </div>
    );
};

export default GestionAccesosView;
