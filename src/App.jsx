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
import CatalogosView from './views/CatalogosView';
import {
    Bell, Menu, Archive, ChevronDown,
    LayoutDashboard, ClipboardCheck, BoxSelect, AlertTriangle, FilePlus2, ExternalLink,
    ShieldCheck, ShieldAlert, Lock
} from 'lucide-react';

function App() {
    console.log('App loaded - VERSION: 2026-04-14 21:30');
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        const saved = localStorage.getItem('sidebarOpen');
        if (saved !== null) return saved === 'true';
        return window.innerWidth >= 1024;
    });
    const [stats, setStats] = useState({ total: 0, asignados: 0, disponibles: 0, sobrantes: 0 });
    const [reporteTipo, setReporteTipo] = useState(null);
    const [showNotifications, setShowNotifications] = useState(false);
    const [institution, setInstitution] = useState(localStorage.getItem('selectedInstitution') || 'tierras');
    const [adminPassword, setAdminPassword] = useState(localStorage.getItem('adminPassword') || '');
    const [currentUser, setCurrentUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch { return null; }
    });
    const [isInstMenuOpen, setIsInstMenuOpen] = useState(false);
    const [loadingStats, setLoadingStats] = useState(false);

    // --- CONTROL DE ACCESO A BASES DE DATOS ---
    const allowedInstitutions = React.useMemo(() => {
        if (!currentUser) return [];
        // Admin tiene acceso total
        if (currentUser.rol === 'admin') return ['consolidado', 'tierras', 'justicia', 'presidencia', 'culturas', 'vicepresidencia'];

        // Técnicos solo ven lo que tienen asignado
        const insts = (currentUser.instituciones || []).map(i => i.toLowerCase());

        // El modo CONSOLIDADO solo está disponible si tiene todas las bases
        if (insts.length === 5) return ['consolidado', ...insts];
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

        const INACTIVITY_LIMIT = 150000;
        let lastActivity = Date.now();

        const updateActivity = () => {
            lastActivity = Date.now();
        };

        const checkInactivity = () => {
            if (Date.now() - lastActivity > INACTIVITY_LIMIT) {
                handleLogout();
                // Opcional: recargar al cerrar sesión para máxima limpieza
                window.location.reload();
            }
        };

        // Intervalo para revisar la inactividad periódicamente
        const intervalId = setInterval(checkInactivity, 10000);

        // Evento de visibilidad (crucial para móviles/iOS)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkInactivity();
            }
        };

        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        events.forEach(e => document.addEventListener(e, updateActivity, { passive: true }));
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(intervalId);
            events.forEach(e => document.removeEventListener(e, updateActivity));
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [currentUser, handleLogout]);

    const authFetch = useCallback((url, options = {}) => {
        // Para iOS/Safari agresivo con el caché de GETs
        const fetchOptions = {
            cache: 'no-store', // Previene cacheo agresivo en móviles
            ...options,
            headers: {
                'x-institution': institution,
                'x-admin-password': adminPassword,
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                ...options.headers
            }
        };

        return fetch(url, fetchOptions);
    }, [institution, adminPassword]);

    const fetchStats = useCallback(() => {
        setLoadingStats(true);
        authFetch('/api/stats')
            .then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.json();
            })
            .then(data => {
                setStats(data);
                setLoadingStats(false);
            })
            .catch(err => {
                setLoadingStats(false);
            });
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
        // Al cambiar de institución, el Dashboard debe mostrar carga
        if (activeTab === 'dashboard') {
            setStats({ total: 0, asignados: 0, disponibles: 0, sobrantes: 0 });
            fetchStats();
        }
    }, [institution]); // Quitamos activeTab y fetchStats por ahora para evitar loops, pero institution es lo clave aquí

    // Al cambiar de pestaña, cerramos el reporte
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setReporteTipo(null);
        // En móvil auto-cerrar al cambiar de pestaña
        if (window.innerWidth < 1024) {
            setIsSidebarOpen(false);
        }
    };

    const toggleSidebar = () => {
        const newState = !isSidebarOpen;
        setIsSidebarOpen(newState);
        localStorage.setItem('sidebarOpen', newState);
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
            color: 'amber',
            ring: 'ring-amber-400',
            textColor: 'text-amber-600',
            bg: 'bg-amber-50',
            hoverBg: 'hover:bg-amber-50/80',
        },
        {
            key: 'asignados',
            label: 'Asignados',
            value: stats.asignados || 0,
            trend: stats.total > 0 ? Math.round(((stats.asignados || 0) / stats.total) * 100) + '%' : '0%',
            icon: ClipboardCheck,
            color: 'orange',
            ring: 'ring-orange-400',
            textColor: 'text-orange-600',
            bg: 'bg-orange-50',
            hoverBg: 'hover:bg-orange-50/80',
        },
        {
            key: 'disponibles',
            label: 'Disponibles',
            value: stats.disponibles || 0,
            trend: stats.total > 0 ? Math.round(((stats.disponibles || 0) / stats.total) * 100) + '%' : '0%',
            icon: BoxSelect,
            color: 'yellow',
            ring: 'ring-yellow-400',
            textColor: 'text-yellow-600',
            bg: 'bg-yellow-50',
            hoverBg: 'hover:bg-yellow-50/80',
        },
        {
            key: 'sobrantes',
            label: 'Sobrantes (No Registrados)',
            value: stats.sobrantes || 0,
            trend: 'Auditoría',
            icon: AlertTriangle,
            color: 'amber',
            ring: 'ring-amber-500',
            textColor: 'text-amber-700',
            bg: 'bg-amber-100/50',
            hoverBg: 'hover:bg-amber-100/80',
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

                <main className={`flex-1 min-w-0 w-full max-w-[100vw] overflow-x-hidden transition-all duration-300 ${isSidebarOpen && window.innerWidth < 1024 ? 'blur-sm pointer-events-none' : ''} lg:ml-64`}>
                    {/* ── HEADER FIXED ── */}
                    <header className="fixed top-0 left-0 right-0 z-30 flex justify-between items-center bg-white px-3 py-2 sm:p-3 md:p-4 shadow-sm border-b border-slate-200 transition-all duration-300 lg:left-64">
                        {/* Izquierda: hamburger + logo móvil */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={toggleSidebar}
                                className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors active:scale-95 lg:hidden"
                                title={isSidebarOpen ? "Cerrar menú" : "Abrir menú"}
                            >
                                <Menu size={20} className={`transition-transform duration-300 ${isSidebarOpen && window.innerWidth >= 1024 ? 'rotate-90' : ''}`} />
                            </button>
                            <div className={`flex items-center gap-2 transition-all duration-300 lg:hidden ${isSidebarOpen && window.innerWidth >= 1024 ? 'opacity-0 -translate-x-4 pointer-events-none' : 'opacity-100 translate-x-0'}`}>
                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-200 overflow-hidden p-0.5">
                                    <img src="/logoEscudo.png" alt="Logo" className="w-full h-full object-contain" />
                                </div>
                                <span className="font-semibold text-slate-800 text-[10px] sm:text-xs uppercase tracking-tight truncate max-w-[100px] sm:max-w-none">Activos Presidencia</span>
                            </div>
                        </div>

                        {/* Derecha: selector institución + usuario */}
                        <div className="flex items-center gap-2">

                            {/* ── Selector móvil (Lista Dropdown) ── */}
                            <div className="md:hidden relative">
                                <button
                                    onClick={() => setIsInstMenuOpen(!isInstMenuOpen)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-semibold uppercase tracking-tight transition-all active:scale-95 shadow-sm
                                        ${institution === 'consolidado' ? 'bg-slate-800 text-white border-slate-800' :
                                            institution === 'tierras' ? 'bg-emerald-600 text-white border-emerald-600' :
                                                institution === 'justicia' ? 'bg-blue-600 text-white border-blue-600' :
                                                    institution === 'presidencia' ? 'bg-amber-600 text-white border-amber-600' :
                                                        institution === 'culturas' ? 'bg-indigo-600 text-white border-indigo-600' :
                                                            'bg-rose-600 text-white border-rose-600'}`}
                                >
                                    {institution === 'vicepresidencia' ? 'VICE' : institution}
                                    <ChevronDown size={14} className={`transition-transform duration-300 ${isInstMenuOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isInstMenuOpen && (
                                    <>
                                        {/* Overlay para cerrar al tocar fuera */}
                                        <div className="fixed inset-0 z-10" onClick={() => setIsInstMenuOpen(false)}></div>

                                        <div className="absolute right-0 mt-2 w-48 max-w-[85vw] bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-20 animate-in fade-in zoom-in-95 duration-200 origin-top-right overflow-hidden">
                                            <div className="px-3 py-1 mb-1 border-b border-slate-100">
                                                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Seleccionar Base</span>
                                            </div>
                                            {allowedInstitutions.map(inst => {
                                                const isActive = institution === inst;
                                                const styles = {
                                                    consolidado: 'text-slate-700 hover:bg-slate-50',
                                                    tierras: 'text-emerald-700 hover:bg-emerald-50',
                                                    justicia: 'text-blue-700 hover:bg-blue-50',
                                                    presidencia: 'text-amber-700 hover:bg-amber-50',
                                                    culturas: 'text-violet-700 hover:bg-violet-50',
                                                    vicepresidencia: 'text-rose-700 hover:bg-rose-50'
                                                }[inst] || 'text-slate-700 hover:bg-slate-50';

                                                const activeStyles = {
                                                    consolidado: 'bg-slate-800 text-white',
                                                    tierras: 'bg-emerald-600 text-white',
                                                    justicia: 'bg-blue-600 text-white',
                                                    presidencia: 'bg-amber-600 text-white',
                                                    culturas: 'bg-indigo-600 text-white',
                                                    vicepresidencia: 'bg-rose-600 text-white'
                                                }[inst] || 'bg-slate-100 text-slate-900';

                                                return (
                                                    <button
                                                        key={inst}
                                                        onClick={() => {
                                                            setInstitution(inst);
                                                            setStats({ total: 0, asignados: 0, disponibles: 0, sobrantes: 0 });
                                                            localStorage.setItem('selectedInstitution', inst);
                                                            setIsInstMenuOpen(false);
                                                        }}
                                                        className={`w-full flex items-center justify-between px-4 py-2.5 text-[11px] font-bold uppercase tracking-tight transition-all
                                                            ${isActive ? `${activeStyles} shadow-inner` : `${styles} hover:bg-slate-50`}`}
                                                    >
                                                        <span>{inst}</span>
                                                        {isActive && <div className="w-2 h-2 rounded-full bg-white ring-2 ring-white/30 animate-pulse"></div>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* ── Botones escritorio ── */}
                            <div className="hidden md:flex items-center gap-2">
                                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner gap-0.5">
                                    {allowedInstitutions.includes('consolidado') && (
                                        <button onClick={() => { setInstitution('consolidado'); setStats({ total: 0, asignados: 0, disponibles: 0, sobrantes: 0 }); }}
                                            className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${institution === 'consolidado' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-white hover:text-slate-700'}`}>
                                            CONSOLIDADO
                                        </button>
                                    )}
                                    {allowedInstitutions.includes('tierras') && (
                                        <button onClick={() => { setInstitution('tierras'); setStats({ total: 0, asignados: 0, disponibles: 0, sobrantes: 0 }); }}
                                            className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${institution === 'tierras' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20' : 'text-slate-500 hover:bg-white hover:text-emerald-700'}`}>
                                            TIERRAS
                                        </button>
                                    )}
                                    {allowedInstitutions.includes('justicia') && (
                                        <button onClick={() => { setInstitution('justicia'); setStats({ total: 0, asignados: 0, disponibles: 0, sobrantes: 0 }); }}
                                            className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${institution === 'justicia' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-500 hover:bg-white hover:text-blue-700'}`}>
                                            JUSTICIA
                                        </button>
                                    )}
                                    {allowedInstitutions.includes('presidencia') && (
                                        <button onClick={() => { setInstitution('presidencia'); setStats({ total: 0, asignados: 0, disponibles: 0, sobrantes: 0 }); }}
                                            className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${institution === 'presidencia' ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20' : 'text-slate-500 hover:bg-white hover:text-amber-700'}`}>
                                            PRESIDENCIA
                                        </button>
                                    )}
                                    {allowedInstitutions.includes('culturas') && (
                                        <button
                                            onClick={() => { setInstitution('culturas'); setStats({ total: 0, asignados: 0, disponibles: 0, sobrantes: 0 }); }}
                                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${institution === 'culturas' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
                                        >CULTURAS</button>
                                    )}
                                    {allowedInstitutions.includes('vicepresidencia') && (
                                        <button
                                            onClick={() => { setInstitution('vicepresidencia'); setStats({ total: 0, asignados: 0, disponibles: 0, sobrantes: 0 }); }}
                                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${institution === 'vicepresidencia' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
                                        >VICEPRESIDENCIA</button>
                                    )}
                                </div>
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => setShowNotifications(!showNotifications)}
                                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative transition-colors"
                                >
                                    <Bell size={18} />
                                    {stats.sobrantes > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />}
                                </button>
                                {showNotifications && (
                                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                            <h3 className="font-semibold text-slate-800 text-sm">Notificaciones</h3>
                                            {stats.sobrantes > 0 && (
                                                <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">1 Nueva</span>
                                            )}
                                        </div>
                                        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                                            {stats.sobrantes > 0 && (
                                                <div className="p-4 hover:bg-slate-50 transition-colors flex gap-3 cursor-pointer" onClick={() => { setShowNotifications(false); handleTabChange('control-activos'); }}>
                                                    <div className="mt-0.5 p-1.5 bg-red-50 text-red-600 rounded-lg h-fit"><AlertTriangle size={16} /></div>
                                                    <div>
                                                        <h4 className="text-xs font-semibold text-slate-800">Activos Sobrantes</h4>
                                                        <p className="text-[10px] text-slate-500 mt-1">Se detectaron {stats.sobrantes} activos sobrantes. Requiere revisión en Control Físico.</p>
                                                    </div>
                                                </div>
                                            )}
                                            {stats.disponibles > 0 && (
                                                <div className="p-4 hover:bg-slate-50 transition-colors flex gap-3 cursor-pointer" onClick={() => { setShowNotifications(false); handleTabChange('activos'); }}>
                                                    <div className="mt-0.5 p-1.5 bg-emerald-50 text-emerald-600 rounded-lg h-fit"><Archive size={16} /></div>
                                                    <div>
                                                        <h4 className="text-xs font-semibold text-slate-800">Activos Disponibles</h4>
                                                        <p className="text-[10px] text-slate-500 mt-1">Hay {stats.disponibles} activos listos para ser asignados a funcionarios.</p>
                                                    </div>
                                                </div>
                                            )}
                                            {stats.asignados > 0 && (
                                                <div className="p-4 flex gap-3 opacity-60">
                                                    <div className="mt-0.5 p-1.5 bg-blue-50 text-blue-600 rounded-lg h-fit"><CheckCircle size={16} /></div>
                                                    <div>
                                                        <h4 className="text-xs font-semibold text-slate-800">Sistema Operativo</h4>
                                                        <p className="text-[10px] text-slate-500 mt-1">{stats.asignados} activos se encuentran correctamente asignados.</p>
                                                    </div>
                                                </div>
                                            )}
                                            {stats.total === 0 && !loadingStats && (
                                                <div className="p-6 text-center text-slate-400">
                                                    <Bell size={24} className="mx-auto mb-2 opacity-50" />
                                                    <p className="text-xs">No hay notificaciones</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="hidden sm:block h-7 w-px bg-slate-200" />
                            <div className="flex items-center gap-2">
                                <div className="text-right hidden sm:block">
                                    <p className="text-xs font-semibold text-slate-900 leading-none">{currentUser.nombre}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{currentUser.rol === 'admin' ? 'Administrador' : 'Técnico'}</p>
                                </div>
                                <div className={`w-9 h-9 text-white rounded-full flex items-center justify-center font-semibold text-sm shadow-lg ${currentUser.rol === 'admin' ? 'bg-amber-500 shadow-amber-500/20' : 'bg-blue-600 shadow-blue-500/20'}`}>
                                    {currentUser.nombre?.charAt(0).toUpperCase()}
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* ── Contenido dinámico ── */}
                    <div className="p-2 sm:p-4 md:p-6 pt-[4rem] sm:pt-[5rem] md:pt-[6rem] lg:pt-[6rem]">
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">

                            {/* DASHBOARD */}
                            {activeTab === 'dashboard' && !reporteTipo && (
                                <div className="space-y-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <h2 className="text-lg font-semibold text-slate-900">Panel de Resumen</h2>
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
                                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{card.label}</p>
                                                    <div className="flex items-end justify-between mt-1">
                                                        {loadingStats ? (
                                                            <div className="h-9 w-20 bg-slate-100 animate-pulse rounded-lg mt-1" />
                                                        ) : (
                                                            <p className={`text-2xl sm:text-3xl font-semibold ${card.textColor}`}>{card.value}</p>
                                                        )}
                                                        <span className="text-[10px] text-slate-400 font-semibold">{card.trend}</span>
                                                    </div>
                                                    {/* Indicador de clickeable */}
                                                    <div className={`absolute bottom-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-500 rounded-b-2xl ${card.key === 'total' ? 'bg-blue-500' :
                                                        card.key === 'asignados' ? 'bg-emerald-500' :
                                                            card.key === 'disponibles' ? 'bg-orange-500' :
                                                                'bg-red-500'
                                                        }`} />
                                                    <div className={`absolute top-2 right-2 text-[8px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded ${card.bg} ${card.textColor} opacity-0 group-hover:opacity-100 transition-opacity`}>
                                                        Ver reporte
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Acciones rápidas */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
                                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                            <h3 className="font-semibold text-slate-800 text-sm mb-3">Acciones Rápidas</h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                <button onClick={() => handleTabChange('generar')}
                                                    className="p-3.5 bg-blue-50 text-blue-700 rounded-xl font-semibold text-sm hover:bg-blue-100 transition-all flex items-center gap-3 active:scale-95">
                                                    <div className="p-1.5 bg-blue-600 text-white rounded-lg"><FilePlus2 size={16} /></div>
                                                    Asignar Equipo
                                                </button>
                                                <button onClick={() => handleTabChange('activos')}
                                                    className="p-3.5 bg-slate-50 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-100 transition-all flex items-center gap-3 active:scale-95">
                                                    <div className="p-1.5 bg-slate-800 text-white rounded-lg"><Archive size={16} /></div>
                                                    Ver Inventario
                                                </button>
                                            </div>
                                        </div>

                                        {/* Mini-resumen de porcentajes */}
                                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                            <h3 className="font-semibold text-slate-800 text-sm mb-3">Distribución de Activos</h3>
                                            <div className="space-y-2.5">
                                                {[
                                                    { label: 'Asignados', value: stats.asignados || 0, color: 'bg-blue-500' },
                                                    { label: 'Disponibles', value: stats.disponibles || 0, color: 'bg-emerald-500' },
                                                    { label: 'Sobrantes', value: stats.sobrantes || 0, color: 'bg-amber-500' },
                                                ].map(row => (
                                                    <div key={row.label} className="flex items-center gap-3">
                                                        <span className="text-xs text-slate-500 font-medium w-24 flex-shrink-0">{row.label}</span>
                                                        <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${row.color} transition-all duration-700`}
                                                                style={{ width: stats.total > 0 ? `${(row.value / stats.total) * 100}%` : '0%' }}
                                                            />
                                                        </div>
                                                        <span className="text-xs font-semibold text-slate-700 w-8 text-right">{row.value}</span>
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
                                    key={`report-${institution}`}
                                    tipo={reporteTipo}
                                    onBack={() => setReporteTipo(null)}
                                    authFetch={authFetch}
                                    institution={institution}
                                />
                            )}

                            {activeTab === 'usuarios' && <UsuariosView key={institution} authFetch={authFetch} currentUser={currentUser} institution={institution} />}
                            {activeTab === 'activos' && <ActivosView key={institution} authFetch={authFetch} currentUser={currentUser} institution={institution} />}
                            {activeTab === 'migraciones' && <MigracionView key={institution} authFetch={authFetch} institution={institution} />}
                            {activeTab === 'generar' && <GenerarActaView key={institution} authFetch={authFetch} currentUser={currentUser} institution={institution} />}
                            {activeTab === 'historial' && <HistorialActasView key={institution} authFetch={authFetch} currentUser={currentUser} institution={institution} />}
                            {activeTab === 'control-activos' && <ControlActivosView key={institution} authFetch={authFetch} currentUser={currentUser} institution={institution} />}
                            {activeTab === 'bitacora' && <BitacoraView key={institution} authFetch={authFetch} institution={institution} />}
                            {activeTab === 'catalogos' && <CatalogosView key={institution} authFetch={authFetch} currentUser={currentUser} institution={institution} />}
                            {activeTab === 'accesos' && currentUser?.rol === 'admin' && <GestionAccesosView key={institution} authFetch={authFetch} currentUser={currentUser} adminPassword={adminPassword} />}
                        </div>
                    </div>
                </main>
            </div>
    );
}

export default App;
