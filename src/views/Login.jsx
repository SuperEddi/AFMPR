import React, { useState } from 'react';
import { Lock, ShieldCheck, AlertCircle, ChevronRight } from 'lucide-react';

const Login = ({ onLogin }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (password.trim()) {
            onLogin(password);
        } else {
            setError(true);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full opacity-10">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500 rounded-full blur-[120px]" />
            </div>

            <div className="w-full max-w-md relative z-10 transition-all duration-500">
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-blue-500/20 animate-bounce-subtle">
                            <ShieldCheck size={32} className="text-white" />
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight">ActivosFix <span className="text-blue-400">Security</span></h1>
                        <p className="text-slate-400 text-sm mt-1 uppercase tracking-widest font-bold">Control de Acceso v2.0</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña de Administrador</label>
                            <div className="relative group">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); setError(false); }}
                                    placeholder="••••••••••••"
                                    className={`w-full bg-slate-800/50 border ${error ? 'border-red-500' : 'border-white/10'} rounded-2xl py-4 pl-12 pr-4 text-white placeholder-slate-600 outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all`}
                                    autoFocus
                                />
                            </div>
                            {error && (
                                <div className="flex items-center gap-2 mt-2 ml-1 text-red-400 animate-shake">
                                    <AlertCircle size={14} />
                                    <span className="text-[10px] font-bold uppercase">Contraseña requerida</span>
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 group"
                        >
                            Acceder al Sistema
                            <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-white/5 text-center">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                            Este sistema está protegido por encriptación avanzada de Cloudflare
                        </p>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes bounce-subtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                .animate-bounce-subtle {
                    animation: bounce-subtle 3s ease-in-out infinite;
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: shake 0.2s ease-in-out 0s 2;
                }
            `}</style>
        </div>
    );
};

export default Login;
