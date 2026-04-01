import React from 'react';
import {
    LayoutDashboard,
    Users,
    Package,
    FilePlus,
    History,
    LogOut,
    X,
    Database,
    ClipboardCheck
} from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen }) => {
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-indigo-400', activeBg: 'bg-indigo-500/10', activeText: 'text-indigo-400' },
        { id: 'usuarios', label: 'Gestión Usuarios', icon: Users, color: 'text-emerald-400', activeBg: 'bg-emerald-500/10', activeText: 'text-emerald-400' },
        { id: 'activos', label: 'Inventario', icon: Package, color: 'text-amber-400', activeBg: 'bg-amber-500/10', activeText: 'text-amber-400' },
        { id: 'control-activos', label: 'Control Funcionario', icon: ClipboardCheck, color: 'text-blue-400', activeBg: 'bg-blue-500/10', activeText: 'text-blue-400' },
        { id: 'migraciones', label: 'Migraciones', icon: Database, color: 'text-violet-400', activeBg: 'bg-violet-500/10', activeText: 'text-violet-400' },
        { id: 'generar', label: 'Generar Acta', icon: FilePlus, color: 'text-rose-400', activeBg: 'bg-rose-500/10', activeText: 'text-rose-400' },
        { id: 'historial', label: 'Historial Actas', icon: History, color: 'text-cyan-400', activeBg: 'bg-cyan-500/10', activeText: 'text-cyan-400' },
    ];

    const handleNavClick = (id) => {
        setActiveTab(id);
        if (window.innerWidth < 1024) {
            setIsOpen(false);
        }
    };

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
                            <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20">
                                <Package size={22} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-black tracking-tight leading-none text-white">
                                    Activos<span className="text-primary-400">Fix</span>
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

                <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto custom-scrollbar">
                    {menuItems.map((item) => {
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => handleNavClick(item.id)}
                                className={`
                                    w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden
                                    ${isActive
                                        ? `${item.activeBg} ${item.activeText} shadow-sm`
                                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                    }
                                `}
                            >
                                {/* Indicador lateral dinámico */}
                                {isActive && (
                                    <div className={`absolute left-0 top-3 bottom-0 w-1 rounded-r-full ${item.color.replace('text-', 'bg-')}`} />
                                )}

                                <div className={`
                                    p-2 rounded-xl transition-all duration-300
                                    ${isActive ? `${item.color.replace('text-', 'bg-').replace('-400', '-500')} text-white shadow-lg` : `bg-slate-800/50 ${item.color} group-hover:scale-110`}
                                `}>
                                    <item.icon size={18} />
                                </div>
                                <span className={`text-xs font-black tracking-wide uppercase transition-colors ${isActive ? item.activeText : 'text-slate-400 group-hover:text-white'}`}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </nav>

                <div className="px-4 pb-6 border-t border-slate-800/30 flex-shrink-0 pt-4" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))' }}>
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-400 hover:bg-red-400/5 rounded-2xl transition-all duration-300 group">
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
