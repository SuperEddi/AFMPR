import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ShieldCheck, UserPlus, Edit2, Trash2, X, Eye, EyeOff, Search, CheckCircle, XCircle } from 'lucide-react';
import { AppDialog, useDialog } from '../components/AppDialog';

const RoleBadge = ({ rol }) => rol === 'admin'
    ? <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black uppercase tracking-wide">Admin</span>
    : <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black uppercase tracking-wide">Técnico</span>;

const GestionAccesosView = ({ authFetch, currentUser }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [form, setForm] = useState({ username: '', nombre: '', password: '', rol: 'tecnico' });
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
        setForm({ username: '', nombre: '', password: '', rol: 'tecnico' });
        setShowPass(false);
        setShowModal(true);
    };

    const openEdit = (u) => {
        setEditing(u);
        setForm({ username: u.username, nombre: u.nombre, password: '', rol: u.rol });
        setShowPass(false);
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!editing && !form.password) {
            await showAlert('La contraseña es obligatoria para un nuevo usuario.', { type: 'error' });
            return;
        }
        setSaving(true);
        try {
            const url = editing ? `/api/system-users/${editing.id}` : '/api/system-users';
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
        if (u.id === currentUser.id) {
            await showAlert('No puedes eliminar tu propia cuenta.', { type: 'error' });
            return;
        }
        const ok = await showConfirm(`¿Eliminar la cuenta "${u.username}"?`, { type: 'danger', title: 'Confirmar eliminación' });
        if (!ok) return;
        const res = await authFetch(`/api/system-users/${u.id}`, { method: 'DELETE' });
        if (res.ok) {
            setUsers(prev => prev.filter(x => x.id !== u.id));
        } else {
            const d = await res.json();
            await showAlert(d.error || 'Error al eliminar.', { type: 'error' });
        }
    };

    const handleToggle = async (u) => {
        if (u.id === currentUser.id) return;
        const res = await authFetch(`/api/system-users/${u.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...u, activo: u.activo ? 0 : 1 }),
        });
        if (res.ok) fetchUsers();
    };

    return (
        <>
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500 text-white rounded-xl">
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
                                className="w-full sm:w-48 pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
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

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    {loading ? (
                        <div className="py-12 text-center text-slate-400 text-sm animate-pulse">Cargando...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                                        <th className="px-4 py-3">Usuario</th>
                                        <th className="px-4 py-3">Nombre</th>
                                        <th className="px-4 py-3">Rol</th>
                                        <th className="px-4 py-3">Estado</th>
                                        <th className="px-4 py-3 text-right">Acciones</th>
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
                                                    {u.id === currentUser.id && (
                                                        <span className="text-[8px] bg-green-100 text-green-700 font-black px-1.5 rounded-full">TÚ</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-700">{u.nombre}</td>
                                            <td className="px-4 py-3"><RoleBadge rol={u.rol} /></td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => handleToggle(u)}
                                                    disabled={u.id === currentUser.id}
                                                    className="flex items-center gap-1.5 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                                                    title={u.id === currentUser.id ? 'No puedes desactivar tu propia cuenta' : ''}
                                                >
                                                    {u.activo
                                                        ? <><CheckCircle size={14} className="text-emerald-500" /><span className="text-emerald-600">Activo</span></>
                                                        : <><XCircle size={14} className="text-red-400" /><span className="text-red-500">Inactivo</span></>
                                                    }
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => openEdit(u)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(u)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && (
                                        <tr><td colSpan={5} className="text-center py-12 text-slate-400 text-sm">Sin cuentas registradas</td></tr>
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
                    <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm animate-in slide-in-from-bottom duration-300">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900 text-sm">
                                {editing ? 'Editar Cuenta' : 'Nueva Cuenta'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 space-y-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Nombre completo</label>
                                <input required value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
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
                                {editing && <p className="text-[10px] text-slate-400 mt-1">El nombre de usuario no puede cambiarse.</p>}
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
                                        className="w-full px-3 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
                                        placeholder={editing ? '(sin cambios)' : '••••••••'}
                                    />
                                    <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                        {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Rol</label>
                                <select value={form.rol} onChange={e => setForm(p => ({ ...p, rol: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500">
                                    <option value="tecnico">Técnico</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setShowModal(false)}
                                    className="flex-1 py-2.5 border border-slate-200 text-slate-500 rounded-lg font-bold text-sm hover:bg-slate-50">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={saving}
                                    className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg font-bold text-sm hover:bg-amber-600 shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50">
                                    {saving ? 'Guardando...' : editing ? 'Guardar' : 'Crear Cuenta'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <AppDialog {...dialogProps} />
        </>
    );
};

export default GestionAccesosView;
