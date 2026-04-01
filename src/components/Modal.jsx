import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Modal reutilizable con borde superior dorado #C5A059 y título en mayúsculas.
 * Props:
 *   - isOpen: bool
 *   - onClose: fn
 *   - title: string
 *   - children: ReactNode
 *   - footer: ReactNode (opcional)
 *   - size: 'sm' | 'md' | 'lg' (default 'md')
 */
const Modal = ({ isOpen, onClose, title, children, footer, size = 'md' }) => {
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        if (isOpen) document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const maxWidths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
            aria-modal="true"
            role="dialog"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Panel */}
            <div className={`relative w-full ${maxWidths[size]} bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
                {/* Borde superior dorado */}
                <div className="h-1.5 w-full flex-shrink-0" style={{ background: '#C5A059' }} />

                {/* Header */}
                <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-3 border-b border-slate-100">
                    <h2
                        className="font-black text-slate-900 text-sm sm:text-base tracking-wide"
                        style={{ fontFamily: 'Consolas, monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    >
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-4 sm:px-5 py-4 overflow-y-auto max-h-[65vh] custom-scrollbar">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 flex-wrap">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Modal;
