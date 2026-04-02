import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    Users,
    Package,
    FilePlus,
    History,
    LogOut,
    X,
    Database,
    ClipboardCheck,
    ShieldCheck,
    BookOpen,
    ChevronDown,
    Layers,
    FileText,
    ShieldAlert,
    UserCircle
} from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen, currentUser, onLogout }) => {
    // Definición de categorías y sus ítems
    const categories = [
        {
            id: 'monitoreo',
            label: 'Monitoreo',
            icon: LayoutDashboard,
            items: [
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-indigo-400', activeBg: 'bg-indigo-500/10', activeText: 'text-indigo-400' },
            ]
        },
        {
            id: 'gestion',
            label: 'Gestión de Activos',
            icon: Package,
            items: [
                { id: 'activos', label: 'Inventario', icon: Package, color: 'text-amber-400', activeBg: 'bg-amber-500/10', activeText: 'text-amber-400' },
                { id: 'migraciones', label: 'Migraciones', icon: Database, color: 'text-violet-400', activeBg: 'bg-violet-500/10', activeText: 'text-violet-400' },
            ]
        },
        {
            id: 'documentacion',
            label: 'Documentación',
            icon: FileText,
            items: [
                { id: 'generar', label: 'Generar Acta', icon: FilePlus, color: 'text-rose-400', activeBg: 'bg-rose-500/10', activeText: 'text-rose-400' },
                { id: 'historial', label: 'Historial Actas', icon: History, color: 'text-cyan-400', activeBg: 'bg-cyan-500/10', activeText: 'text-cyan-400' },
            ]
        },
        {
            id: 'auditoria',
            label: 'Control y Auditoría',
            icon: ShieldAlert,
            items: [
                { id: 'control-activos', label: 'Control Funcionario', icon: ClipboardCheck, color: 'text-blue-400', activeBg: 'bg-blue-500/10', activeText: 'text-blue-400' },
                { id: 'bitacora', label: 'Bitácora', icon: BookOpen, color: 'text-violet-300', activeBg: 'bg-violet-500/10', activeText: 'text-violet-300' },
            ]
        },
        {
            id: 'admin',
            label: 'Administración',
            icon: UserCircle,
            items: [
                { id: 'usuarios', label: 'Gestión Usuarios', icon: Users, color: 'text-emerald-400', activeBg: 'bg-emerald-500/10', activeText: 'text-emerald-400' },
                { id: 'accesos', label: 'Gestión de Accesos', icon: ShieldCheck, color: 'text-amber-300', activeBg: 'bg-amber-500/10', activeText: 'text-amber-300', adminOnly: true },
            ]
        }
    ];

    // Estado para categoría abierta (acordeón: solo una a la vez)
    const [openCategories, setOpenCategories] = useState(['monitoreo']);

    // Efecto para abrir automáticamente la categoría que contiene el tab activo
    useEffect(() => {
        categories.forEach(cat => {
            if (cat.items.some(item => item.id === activeTab)) {
                if (!openCategories.includes(cat.id)) {
                    setOpenCategories([cat.id]);
                }
            }
        });
    }, [activeTab]);

    const toggleCategory = (id) => {
        setOpenCategories(prev =>
            prev.includes(id) ? [] : [id]
        );
    };

    const handleNavClick = (id) => {
        setActiveTab(id);
        if (window.innerWidth < 1024) {
            setIsOpen(false);
        }
    };

    // Filtrar categorías e ítems por permisos de usuario
    const visibleCategories = categories.map(cat => ({
        ...cat,
        items: cat.items.filter(item => !item.adminOnly || currentUser?.rol === 'admin')
    })).filter(cat => cat.items.length > 0);

    return (
        <>
            {/* Overlay para móvil */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Contenedor Sidebar */}
            <div className={`
        fixed left-0 top-0 h-screen w-64 bg-slate-950 text-white z-50 border-r border-slate-800/40 shadow-2xl transition-transform duration-300 ease-in-out flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `} style={{ paddingLeft: 'env(safe-area-inset-left, 0px)' }}>

                <div className="px-6 pt-8 pb-6 flex justify-between items-center flex-shrink-0" style={{ paddingTop: 'max(2rem, env(safe-area-inset-top, 2rem))' }}>
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-white/10 overflow-hidden p-1">
                                <img src="/logoEscudo.png" alt="Logo" className="w-full h-full object-contain" />
                            </div>
                            <div>
                                <h1 className="text-[15px] font-black tracking-tight leading-none text-white uppercase">
                                    Activos<br /><span className="text-primary-400">Presidencia</span>
                                </h1>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="lg:hidden p-2 hover:bg-slate-800 rounded-lg text-slate-400"
                    >
                        <X size={24} />
                    </button>
                </div>

                <nav className="flex-1 px-4 py-2 space-y-2 overflow-y-auto custom-scrollbar">
                    {visibleCategories.map((cat) => {
                        const isExpanded = openCategories.includes(cat.id);

                        return (
                            <div key={cat.id} className="space-y-1">
                                {/* Título de Categoría / Botón de Toggle */}
                                <button
                                    onClick={() => toggleCategory(cat.id)}
                                    className="w-full flex items-center justify-between px-3 py-2 text-slate-500 hover:text-slate-300 transition-colors group"
                                >
                                    <div className="flex items-center gap-2">
                                        <cat.icon size={14} className="opacity-50 group-hover:opacity-100" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{cat.label}</span>
                                    </div>
                                    <ChevronDown size={14} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Lista de ítems (Submenú) */}
                                <div className={`
                                    space-y-1 overflow-hidden transition-all duration-300 ease-in-out
                                    ${isExpanded ? 'max-h-[500px] opacity-100 mt-1' : 'max-h-0 opacity-0'}
                                `}>
                                    {cat.items.map((item) => {
                                        const isActive = activeTab === item.id;
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => handleNavClick(item.id)}
                                                className={`
                                                    w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden
                                                    ${isActive
                                                        ? `${item.activeBg} ${item.activeText} shadow-sm`
                                                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                                    }
                                                `}
                                            >
                                                {/* Indicador lateral dinámico */}
                                                {isActive && (
                                                    <div className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${item.color.replace('text-', 'bg-')}`} />
                                                )}

                                                <div className={`
                                                    p-1.5 rounded-lg transition-all duration-300
                                                    ${isActive ? `${item.color.replace('text-', 'bg-').replace('-400', '-500')} text-white shadow-lg` : `bg-slate-800/30 ${item.color} group-hover:scale-110`}
                                                `}>
                                                    <item.icon size={16} />
                                                </div>
                                                <span className={`text-[11px] font-bold tracking-wide uppercase transition-colors ${isActive ? item.activeText : 'text-slate-400 group-hover:text-white'}`}>
                                                    {item.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                <div className="px-4 pb-6 border-t border-slate-800/30 flex-shrink-0 pt-4" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))' }}>
                    {/* User info */}
                    {currentUser && (
                        <div className="flex items-center gap-3 px-4 py-3 mb-2">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0 ${currentUser.rol === 'admin' ? 'bg-amber-500' : 'bg-blue-600'}`}>
                                {currentUser.nombre?.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate">{currentUser.nombre}</p>
                                <p className="text-[10px] text-slate-400 font-medium capitalize">{currentUser.rol === 'admin' ? 'Administrador' : 'Técnico'}</p>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-400 hover:bg-red-400/5 rounded-2xl transition-all duration-300 group">
                        <div className="p-2 bg-slate-800/50 rounded-xl group-hover:bg-red-400/10 transition-colors">
                            <LogOut size={18} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-wider">Cerrar Sesión</span>
                    </button>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
