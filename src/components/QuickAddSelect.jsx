import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, Check, ChevronDown } from 'lucide-react';

const QuickAddSelect = ({
    options = [],
    value,
    onChange,
    onRegisterRequest,
    placeholder = "Seleccionar...",
    disabled = false,
    className = "",
    labelField = "nombre",
    valueField = "id"
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const dropdownRef = useRef(null);

    const filteredOptions = options.filter(opt =>
        String(opt[labelField]).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedOption = options.find(opt => String(opt[valueField]) === String(value));

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (opt) => {
        onChange(opt[valueField]);
        setIsOpen(false);
        setSearchTerm("");
    };

    const handleRegisterRequest = () => {
        if (onRegisterRequest && searchTerm.trim()) {
            onRegisterRequest(searchTerm.trim());
            setSearchTerm("");
            setIsOpen(false);
        }
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`flex items-center justify-between w-full px-3 py-2 bg-slate-50 border ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-200'} rounded-lg cursor-pointer transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <span className={`text-sm truncate ${selectedOption ? 'text-slate-900 font-semibold' : 'text-slate-400 font-medium'}`}>
                    {selectedOption ? selectedOption[labelField] : placeholder}
                </span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute z-[999] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                autoFocus
                                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-medium"
                                placeholder="Buscar o escribir para agregar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && searchTerm.trim()) {
                                        if (filteredOptions.length === 1) {
                                            handleSelect(filteredOptions[0]);
                                        } else if (filteredOptions.length === 0) {
                                            handleRegisterRequest();
                                        }
                                        e.preventDefault();
                                    }
                                }}
                            />
                        </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => (
                                <div
                                    key={opt[valueField]}
                                    onClick={() => handleSelect(opt)}
                                    className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 cursor-pointer transition-colors"
                                >
                                    <span>{opt[labelField]}</span>
                                    {String(opt[valueField]) === String(value) && <Check size={12} className="text-indigo-600" />}
                                </div>
                            ))
                        ) : searchTerm.trim() ? (
                            <div className="px-3 py-4 text-center">
                                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-2">No se encontraron resultados</p>
                            </div>
                        ) : (
                            <div className="px-3 py-4 text-center">
                                <p className="text-[10px] text-slate-300 font-semibold uppercase tracking-widest">Escriba para buscar</p>
                            </div>
                        )}
                    </div>

                    {searchTerm.trim() && (
                        <div
                            onClick={handleRegisterRequest}
                            className="p-2 border-t border-slate-100 bg-indigo-50/50 hover:bg-indigo-50 transition-colors cursor-pointer group"
                        >
                            <div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold text-indigo-600 uppercase tracking-tight">
                                <div className="w-5 h-5 bg-white border border-indigo-200 rounded flex items-center justify-center shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                    <Plus size={12} />
                                </div>
                                Registrar "{searchTerm}"
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default QuickAddSelect;
