import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck } from 'lucide-react';

const AuthView = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-institution': 'tierras' },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Credenciales incorrectas.');
            } else {
                onLogin(data.user);
            }
        } catch {
            setError('Error de conexión. Intente nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-sm">
                {/* Logo / Brand */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-2xl shadow-blue-600/40 mb-4">
                        <ShieldCheck size={32} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-black text-white">Activos Presidencia</h1>
                    <p className="text-blue-300 text-sm font-medium mt-1">Sistema de Control de Activos</p>
                </div>

                {/* Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
                    <h2 className="text-lg font-black text-white mb-6">Iniciar Sesión</h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Username */}
                        <div>
                            <label className="block text-xs font-bold text-blue-200 uppercase tracking-widest mb-1.5">
                                Usuario
                            </label>
                            <div className="relative">
                                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder="usuario"
                                    className="w-full bg-white/10 border border-white/20 text-white placeholder:text-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-xs font-bold text-blue-200 uppercase tracking-widest mb-1.5">
                                Contraseña
                            </label>
                            <div className="relative">
                                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-white/10 border border-white/20 text-white placeholder:text-slate-500 rounded-xl pl-10 pr-10 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(v => !v)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                                >
                                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold rounded-xl px-4 py-2.5">
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-sm transition-all shadow-lg shadow-blue-600/30 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                        >
                            {loading ? 'Verificando...' : 'Ingresar al Sistema'}
                        </button>
                    </form>

                    <p className="text-center text-slate-500 text-[11px] mt-6">
                        Contacte al administrador si no tiene acceso.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthView;
