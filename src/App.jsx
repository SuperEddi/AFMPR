import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import AuthView from './views/AuthView';
import UsuariosView from './views/UsuariosView';
import ActivosView from './views/ActivosView';
import GenerarActaView from './views/GenerarActaView';
import HistorialActasView from './views/HistorialActasView';
import MigracionView from './views/MigracionView';
import ReporteActivosView from './views/ReporteActivosView';
import ControlActivosView from './views/ControlActivosView';
import GestionAccesosView from './views/GestionAccesosView';
import BitacoraView from './views/BitacoraView';
import {
    Bell, Menu, Archive,
    LayoutDashboard, ClipboardCheck, BoxSelect, AlertTriangle, FilePlus2, ExternalLink,
    ShieldCheck, ShieldAlert, Lock
} from 'lucide-react';

function App() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [stats, setStats] = useState({ total: 0, asignados: 0, disponibles: 0, sobrantes: 0 });
    const [reporteTipo, setReporteTipo] = useState(null);
    const [institution, setInstitution] = useState(localStorage.getItem('selectedInstitution') || 'tierras');
    const [adminPassword, setAdminPassword] = useState(localStorage.getItem('adminPassword') || '');
    const [currentUser, setCurrentUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch { return null; }
    });

    // --- CONTROL DE ACCESO A BASES DE DATOS ---
    const allowedInstitutions = React.useMemo(() => {
        if (!currentUser) return [];
        // Admin tiene acceso total
        if (currentUser.rol === 'admin') return ['consolidado', 'tierras', 'justicia', 'presidencia'];

        // Técnicos solo ven lo que tienen asignado
        const insts = (currentUser.instituciones || []).map(i => i.toLowerCase());

        // El modo CONSOLIDADO solo está disponible si tiene las 3 bases
        if (insts.length === 3) return ['consolidado', ...insts];
        return insts;
    }, [currentUser]);

    // Asegurar que la institución seleccionada sea una permitida
    useEffect(() => {
        if (currentUser && allowedInstitutions.length > 0) {
            if (!allowedInstitutions.includes(institution)) {
                const firstAllowed = allowedInstitutions[0];
                setInstitution(firstAllowed);
                localStorage.setItem('selectedInstitution', firstAllowed);
            }
        }
    }, [currentUser, allowedInstitutions, institution]);

    // --- AUTH ---
    const handleLogin = (data) => {
        const { user, admin_password } = data;
        localStorage.setItem('currentUser', JSON.stringify(user));
        if (admin_password) {
            localStorage.setItem('adminPassword', admin_password);
        }
        // Recargamos todo para asegurar que el sistema inicie limpio
        window.location.reload();
    };

    const handleLogout = useCallback(() => {
        setCurrentUser(null);
        localStorage.removeItem('currentUser');
        setActiveTab('dashboard');
    }, []);

    // --- INACTIVIDAD (2.5 minutos = 150000ms) ---
    useEffect(() => {
        if (!currentUser) return;

        let timer;
        const resetTimer = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                handleLogout();
                // Opcional: recargar al cerrar sesión para máxima limpieza
                window.location.reload();
            }, 150000);
        };

        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        events.forEach(e => document.addEventListener(e, resetTimer));

        resetTimer();

        return () => {
            if (timer) clearTimeout(timer);
            events.forEach(e => document.removeEventListener(e, resetTimer));
        };
    }, [currentUser, handleLogout]);

    const authFetch = useCallback((url, options = {}) => {
        return fetch(url, {
            ...options,
            headers: {
                'x-institution': institution,
                'x-admin-password': adminPassword,
                ...options.headers
            }
        });
    }, [institution, adminPassword]);

    const fetchStats = useCallback(() => {
        authFetch('/api/stats')
            .then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.json();
            })
            .then(data => setStats(data))
            .catch(err => { });
    }, [authFetch]);

    useEffect(() => {
        if (activeTab === 'dashboard') {
            fetchStats();
        }
    }, [activeTab, fetchStats]);

    useEffect(() => {
        window.addEventListener('data-updated', fetchStats);
        return () => window.removeEventListener('data-updated', fetchStats);
    }, [fetchStats]);

    useEffect(() => {
        // Notificamos a las vistas cuando cambie la institución para que se refresquen
        window.dispatchEvent(new CustomEvent('data-updated'));
        localStorage.setItem('selectedInstitution', institution);
    }, [institution]);

    // Al cambiar de pestaña, cerramos el reporte
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setReporteTipo(null);
    };

    const handleCardClick = (tipo) => {
        setReporteTipo(tipo);
    };

    const STAT_CARDS = [
        {
            key: 'total',
            label: 'Total Activos',
            value: stats.total || 0,
            trend: 'Global',
            icon: LayoutDashboard,
            color: 'blue',
            ring: 'ring-blue-400',
            textColor: 'text-blue-600',
            bg: 'bg-blue-50',
            hoverBg: 'hover:bg-blue-50/80',
        },
        {
            key: 'asignados',
            label: 'Asignados',
            value: stats.asignados || 0,
            trend: stats.total > 0 ? Math.round(((stats.asignados || 0) / stats.total) * 100) + '%' : '0%',
            icon: ClipboardCheck,
            color: 'green',
            ring: 'ring-emerald-400',
            textColor: 'text-emerald-600',
            bg: 'bg-emerald-50',
            hoverBg: 'hover:bg-emerald-50/80',
        },
        {
            key: 'disponibles',
            label: 'Disponibles',
            value: stats.disponibles || 0,
            trend: stats.total > 0 ? Math.round(((stats.disponibles || 0) / stats.total) * 100) + '%' : '0%',
            icon: BoxSelect,
            color: 'orange',
            ring: 'ring-orange-400',
            textColor: 'text-orange-600',
            bg: 'bg-orange-50',
            hoverBg: 'hover:bg-orange-50/80',
        },
        {
            key: 'sobrantes',
            label: 'Sobrantes (No Registrados)',
            value: stats.sobrantes || 0,
            trend: 'Auditoría',
            icon: AlertTriangle,
            color: 'red',
            ring: 'ring-red-400',
            textColor: 'text-red-600',
            bg: 'bg-red-50',
            hoverBg: 'hover:bg-red-50/80',
        },
    ];


    return (
        !currentUser ? <AuthView onLogin={handleLogin} /> :
            <div className="flex min-h-[100dvh] bg-slate-50 overflow-x-hidden w-full">
                <Sidebar
                    activeTab={activeTab}
                    setActiveTab={handleTabChange}
                    isOpen={isSidebarOpen}
                    setIsOpen={setIsSidebarOpen}
                    currentUser={currentUser}
                    onLogout={handleLogout}
                />

                <main className={`flex-1 min-w-0 w-full max-w-[100vw] overflow-x-hidden transition-all duration-300 ${isSidebarOpen ? 'blur-sm pointer-events-none' : ''} lg:ml-64 p-2 sm:p-3 md:p-6`}>
                    {/* Header */}
                    <header className="flex justify-between items-center mb-4 sm:mb-5 bg-white p-2 sm:p-3 md:p-4 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-1.5 sm:p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                                <Menu size={20} className="sm:w-[22px] sm:h-[22px]" />
                            </button>
                            <div className="lg:hidden font-black text-blue-600 text-base sm:text-lg">
                                AP
                            </div>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3">
                            {/* Selector de Institución — dropdown en móvil, botones en escritorio */}
                            {/* SELECT móvil */}
                            <div className="flex items-center gap-1.5 md:hidden">
                                <select
                                    className="text-[11px] font-black border-2 border-indigo-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-sm"
                                    value={institution}
                                    onChange={e => {
                                        setInstitution(e.target.value);
                                        localStorage.setItem('selectedInstitution', e.target.value);
                                        window.dispatchEvent(new CustomEvent('data-updated'));
                                    }}
                                >
                                    {allowedInstitutions.includes('consolidado') && <option value="consolidado">CONSOLIDADO</option>}
                                    {allowedInstitutions.includes('tierras') && <option value="tierras">TIERRAS</option>}
                                    {allowedInstitutions.includes('justicia') && <option value="justicia">JUSTICIA</option>}
                                    {allowedInstitutions.includes('presidencia') && <option value="presidencia">PRESIDENCIA</option>}
                                </select>
                                {institution === 'presidencia' && (
                                    <a
                                        href="https://siaf-frontend.pages.dev/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition-colors"
                                        title="Ir a SIAF"
                                    >
                                        <ExternalLink size={16} />
                                    </a>
                                )}
                            </div>
                            {/* Botones escritorio */}
                            <div className="hidden md:flex items-center gap-2">
                                <div className="flex bg-slate-100 p-1.5 rounded-xl border-2 border-indigo-200 shadow-inner">
                                    {allowedInstitutions.includes('consolidado') && (
                                        <button
                                            onClick={() => setInstitution('consolidado')}
                                            className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition-all ${institution === 'consolidado' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
                                        >CONSOLIDADO</button>
                                    )}
                                    {allowedInstitutions.includes('tierras') && (
                                        <button
                                            onClick={() => setInstitution('tierras')}
                                            className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition-all ${institution === 'tierras' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
                                        >TIERRAS</button>
                                    )}
                                    {allowedInstitutions.includes('justicia') && (
                                        <button
                                            onClick={() => setInstitution('justicia')}
                                            className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition-all ${institution === 'justicia' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
                                        >JUSTICIA</button>
                                    )}
                                    {allowedInstitutions.includes('presidencia') && (
                                        <button
                                            onClick={() => setInstitution('presidencia')}
                                            className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition-all ${institution === 'presidencia' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
                                        >PRESIDENCIA</button>
                                    )}
                                </div>
                            </div>
                            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative">
                                <Bell size={18} />
                                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                            </button>
                            <div className="hidden sm:block h-7 w-px bg-slate-200" />
                            <div className="flex items-center gap-2">
                                <div className="text-right hidden sm:block">
                                    <p className="text-xs font-bold text-slate-900 leading-none">{currentUser.nombre}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{currentUser.rol === 'admin' ? 'Administrador' : 'Técnico'}</p>
                                </div>
                                <div className={`w-9 h-9 text-white rounded-full flex items-center justify-center font-black text-sm shadow-lg ${currentUser.rol === 'admin' ? 'bg-amber-500 shadow-amber-500/20' : 'bg-blue-600 shadow-blue-500/20'}`}>
                                    {currentUser.nombre?.charAt(0).toUpperCase()}
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* ── Contenido dinámico ── */}
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">

                        {/* DASHBOARD */}
                        {activeTab === 'dashboard' && !reporteTipo && (
                            <div className="space-y-5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <h2 className="text-lg font-black text-slate-900">Panel de Resumen</h2>
                                    <div className="text-xs text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200 w-fit">
                                        Última actualización: Hoy
                                    </div>
                                </div>

                                {/* Tarjetas KPI — CLICKEABLES */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                                    {STAT_CARDS.map(card => {
                                        const CardIcon = card.icon;
                                        return (
                                            <button
                                                key={card.key}
                                                onClick={() => handleCardClick(card.key)}
                                                className={`relative text-left p-3 sm:p-4 bg-white rounded-2xl shadow-sm border border-slate-200 transition-all duration-200 group overflow-hidden cursor-pointer ${card.hoverBg} hover:shadow-md hover:border-slate-300 active:scale-[0.98] focus:outline-none focus:ring-2 ${card.ring}`}>

                                                {/* Icono */}
                                                <div className={`p-2 rounded-xl ${card.bg} ${card.textColor} w-fit mb-3`}>
                                                    <CardIcon size={16} />
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{card.label}</p>
                                                <div className="flex items-end justify-between mt-1">
                                                    <p className={`text-2xl sm:text-3xl font-black ${card.textColor}`}>{card.value}</p>
                                                    <span className="text-[10px] text-slate-400 font-bold">{card.trend}</span>
                                                </div>
                                                {/* Indicador de clickeable */}
                                                <div className={`absolute bottom-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-500 rounded-b-2xl ${card.key === 'total' ? 'bg-blue-500' :
                                                    card.key === 'asignados' ? 'bg-emerald-500' :
                                                        card.key === 'disponibles' ? 'bg-orange-500' :
                                                            'bg-red-500'
                                                    }`} />
                                                <div className={`absolute top-2 right-2 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${card.bg} ${card.textColor} opacity-0 group-hover:opacity-100 transition-opacity`}>
                                                    Ver reporte
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Acciones rápidas */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                        <h3 className="font-black text-slate-800 text-sm mb-3">Acciones Rápidas</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            <button onClick={() => handleTabChange('generar')}
                                                className="p-3.5 bg-blue-50 text-blue-700 rounded-xl font-bold text-sm hover:bg-blue-100 transition-all flex items-center gap-3 active:scale-95">
                                                <div className="p-1.5 bg-blue-600 text-white rounded-lg"><FilePlus2 size={16} /></div>
                                                Asignar Equipo
                                            </button>
                                            <button onClick={() => handleTabChange('activos')}
                                                className="p-3.5 bg-slate-50 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all flex items-center gap-3 active:scale-95">
                                                <div className="p-1.5 bg-slate-800 text-white rounded-lg"><Archive size={16} /></div>
                                                Ver Inventario
                                            </button>
                                        </div>
                                    </div>

                                    {/* Mini-resumen de porcentajes */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                        <h3 className="font-black text-slate-800 text-sm mb-3">Distribución de Activos</h3>
                                        <div className="space-y-2.5">
                                            {[
                                                { label: 'Asignados', value: stats.asignados || 0, color: 'bg-blue-500' },
                                                { label: 'Disponibles', value: stats.disponibles || 0, color: 'bg-emerald-500' },
                                                { label: 'Mantenimiento', value: stats.mantenimiento || 0, color: 'bg-amber-500' },
                                            ].map(row => (
                                                <div key={row.label} className="flex items-center gap-3">
                                                    <span className="text-xs text-slate-500 font-medium w-24 flex-shrink-0">{row.label}</span>
                                                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${row.color} transition-all duration-700`}
                                                            style={{ width: stats.total > 0 ? `${(row.value / stats.total) * 100}%` : '0%' }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-black text-slate-700 w-8 text-right">{row.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* REPORTE desde dashboard */}
                        {activeTab === 'dashboard' && reporteTipo && (
                            <ReporteActivosView
                                tipo={reporteTipo}
                                onBack={() => setReporteTipo(null)}
                                authFetch={authFetch}
                            />
                        )}

                        {activeTab === 'usuarios' && <UsuariosView authFetch={authFetch} currentUser={currentUser} />}
                        {activeTab === 'activos' && <ActivosView authFetch={authFetch} currentUser={currentUser} />}
                        {activeTab === 'migraciones' && <MigracionView authFetch={authFetch} />}
                        {activeTab === 'generar' && <GenerarActaView authFetch={authFetch} currentUser={currentUser} />}
                        {activeTab === 'historial' && <HistorialActasView authFetch={authFetch} />}
                        {activeTab === 'control-activos' && <ControlActivosView authFetch={authFetch} currentUser={currentUser} />}
                        {activeTab === 'bitacora' && <BitacoraView authFetch={authFetch} />}
                        {activeTab === 'accesos' && currentUser?.rol === 'admin' && <GestionAccesosView authFetch={authFetch} currentUser={currentUser} adminPassword={adminPassword} />}
                    </div>
                </main>
            </div>
    );
}

export default App;
