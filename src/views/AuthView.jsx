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
                onLogin(data);
            }
        } catch {
            setError('Error de conexión. Intente nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-amber-500/30">
            {/* ── Background: Animated Mesh Gradient ── */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Orbital Glow 1 (Amber/Gold - Top Right) */}
                <div className="absolute -top-[10%] -right-[10%] w-[60%] h-[60%] bg-amber-500/20 rounded-full blur-[120px] animate-pulse duration-[8000ms]" />

                {/* Orbital Glow 2 (Deep Blue - Center) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-blue-600/10 rounded-full blur-[150px]" />

                {/* Orbital Glow 3 (Indigo/Presidencia - Bottom Left) */}
                <div className="absolute -bottom-[10%] -left-[10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[100px] animate-pulse duration-[6000ms]" />

                {/* Subtrate Textures */}
                <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
            </div>

            <div className="relative w-full max-w-[380px] flex flex-col py-[4vh] max-h-screen overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
                {/* ── Logo & Brand Area ── */}
                <div className="flex flex-col items-center mb-[4vh] group flex-shrink-0">
                    <div className="relative">
                        {/* Glow effect under logo */}
                        <div className="absolute inset-0 bg-amber-500/40 blur-2xl rounded-full scale-75 group-hover:scale-110 transition-transform duration-700" />

                        <div className="relative inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-white/90 backdrop-blur-sm rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] mb-4 sm:mb-6 p-3 overflow-hidden border border-white transition-all duration-500 group-hover:rotate-3 group-hover:scale-105 active:scale-95">
                            <img src="/logoEscudo.png" alt="Bolivia Shield" className="w-full h-full object-contain" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 tracking-tight leading-none text-center">
                            ACTIVOS<br />
                            <span className="text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.4)]">PRESIDENCIA</span>
                        </h1>
                        <div className="flex items-center justify-center gap-2 mt-2 sm:mt-3">
                            <span className="h-[1px] w-6 sm:w-8 bg-gradient-to-r from-transparent to-amber-500/50" />
                            <p className="text-amber-500/80 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em]">Sistema de Control</p>
                            <span className="h-[1px] w-6 sm:w-8 bg-gradient-to-l from-transparent to-amber-500/50" />
                        </div>
                    </div>
                </div>

                {/* ── Login Card (Glassmorphism) ── */}
                <div className="relative flex-shrink-0">
                    {/* Border Inner Glow */}
                    <div className="absolute -inset-[1px] bg-gradient-to-b from-white/20 to-transparent rounded-[2rem] sm:rounded-[2.5rem] pointer-events-none" />

                    <div className="bg-slate-900/40 backdrop-blur-[24px] rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border border-white/5 relative overflow-hidden group/card">

                        {/* Top Accent Line */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50" />

                        <div className="mb-6 sm:mb-8 text-center sm:text-left">
                            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center justify-center sm:justify-start gap-2">
                                Iniciar Sesión
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                            </h2>
                            <p className="text-slate-400 text-[11px] sm:text-xs mt-1 font-medium">Ingrese sus Credenciales</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                            {/* Input: Username */}
                            <div className="space-y-1.5 group/input">
                                <label className="block text-[9px] sm:text-[10px] font-bold text-amber-500/90 uppercase tracking-[0.15em] ml-1">
                                    Usuario de Acceso
                                </label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-amber-400 transition-colors">
                                        <User size={16} strokeWidth={2.5} />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        autoFocus
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                        placeholder="Ingrese su usuario"
                                        className="w-full bg-white/5 border border-white/10 text-white placeholder:text-slate-600 rounded-xl sm:rounded-2xl pl-11 pr-4 py-3.5 sm:py-4 text-sm font-semibold outline-none focus:bg-white/10 focus:border-amber-500/40 focus:ring-[6px] focus:ring-amber-500/10 transition-all duration-300"
                                    />
                                </div>
                            </div>

                            {/* Input: Password */}
                            <div className="space-y-1.5 group/input">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="block text-[9px] sm:text-[10px] font-bold text-amber-500/90 uppercase tracking-[0.15em]">
                                        Contraseña
                                    </label>
                                </div>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-amber-400 transition-colors">
                                        <Lock size={16} strokeWidth={2.5} />
                                    </div>
                                    <input
                                        type={showPass ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="••••••••••••"
                                        className="w-full bg-white/5 border border-white/10 text-white placeholder:text-slate-700 rounded-xl sm:rounded-2xl pl-11 pr-11 py-3.5 sm:py-4 text-sm font-mono outline-none focus:bg-white/10 focus:border-amber-500/40 focus:ring-[6px] focus:ring-amber-500/10 transition-all duration-300"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPass(v => !v)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-400 transition-colors p-1"
                                    >
                                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Error Alert */}
                            {error && (
                                <div className="animate-in zoom-in-95 duration-300 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-xl px-4 py-3 flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                    {error}
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="relative w-full group/btn active:scale-95 transition-all duration-200"
                            >
                                <div className="absolute -inset-1 bg-amber-500/30 blur-xl opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
                                <div className="relative bg-gradient-to-r from-amber-600 to-amber-400 hover:from-amber-500 hover:to-amber-300 text-slate-900 font-extrabold py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-[12px] sm:text-[13px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-[0_10px_20px_rgba(245,158,11,0.3)] transition-all">
                                    {loading ? (
                                        <div className="w-5 h-5 border-3 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            Acceder al Sistema
                                            <ShieldCheck size={18} strokeWidth={2.5} />
                                        </>
                                    )}
                                </div>
                            </button>
                        </form>
                    </div>
                </div>

                {/* Footer Copyright */}
            </div>
        </div>
    );
};

export default AuthView;
