import React, { useState, useRef, useEffect } from 'react';

/**
 * SearchableSelect - Selector con búsqueda en tiempo real.
 *
 * Props:
 *   options       - Array de objetos [{id, nombre, ...}]
 *   value         - ID seleccionado actualmente
 *   onChange      - fn(id) llamada al seleccionar
 *   labelField    - Campo del objeto a usar como label (default: 'nombre')
 *   placeholder   - Placeholder del input de búsqueda
 *   disabled      - Deshabilitar el selector
 *   className     - Clases adicionales para el contenedor
 */
const SearchableSelect = ({
    options = [],
    value,
    onChange,
    labelField = 'nombre',
    placeholder = 'Buscar...',
    disabled = false,
    className = '',
    emptyLabel = '— Seleccionar —',
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    // Label del ítem seleccionado
    const selected = options.find(o => String(o.id) === String(value));
    const selectedLabel = selected ? selected[labelField] : '';

    // Filtrado
    const filtered = options.filter(o =>
        String(o[labelField] || '').toLowerCase().includes(query.toLowerCase())
    );

    // Cerrar al hacer click fuera
    useEffect(() => {
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Enfocar input al abrir
    useEffect(() => {
        if (open && inputRef.current) inputRef.current.focus();
    }, [open]);

    const handleSelect = (id) => {
        onChange(id);
        setOpen(false);
        setQuery('');
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Trigger */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setOpen(o => !o)}
                className={`w-full flex items-center justify-between px-3 py-2 bg-slate-50 border rounded-lg text-xs font-semibold text-left transition-all
                    ${open ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-indigo-300'}`}
            >
                <span className={selectedLabel ? 'text-slate-800' : 'text-slate-400'}>
                    {selectedLabel || emptyLabel}
                </span>
                <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden min-w-[200px]">
                    {/* Search input */}
                    <div className="p-2 border-b border-slate-100 bg-slate-50">
                        <div className="relative">
                            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Buscar..."
                                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                            />
                        </div>
                    </div>

                    {/* Options list */}
                    <ul className="max-h-48 overflow-y-auto">
                        {/* Clear option */}
                        <li
                            onClick={() => handleSelect('')}
                            className={`px-3 py-2 text-xs cursor-pointer text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors
                                ${!value ? 'bg-indigo-50 text-indigo-600 font-bold' : ''}`}
                        >
                            {emptyLabel}
                        </li>
                        {filtered.length === 0 ? (
                            <li className="px-3 py-2 text-xs text-slate-400 italic">Sin resultados</li>
                        ) : (
                            filtered.map(opt => (
                                <li
                                    key={opt.id}
                                    onClick={() => handleSelect(opt.id)}
                                    className={`px-3 py-2 text-xs cursor-pointer transition-colors
                                        ${String(opt.id) === String(value)
                                            ? 'bg-indigo-600 text-white font-bold'
                                            : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'}`}
                                >
                                    {opt[labelField]}
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
