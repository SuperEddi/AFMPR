import React, { useState, useCallback } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

// ─── Tipos de diálogo ────────────────────────────────────────────────────────
const DIALOG_STYLES = {
    error: {
        icon: AlertCircle,
        iconClass: 'text-red-500',
        iconBg: 'bg-red-50 border-red-100',
        confirmBtn: 'bg-red-600 hover:bg-red-700 shadow-red-500/20',
        confirmText: 'Aceptar',
    },
    success: {
        icon: CheckCircle,
        iconClass: 'text-emerald-500',
        iconBg: 'bg-emerald-50 border-emerald-100',
        confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20',
        confirmText: 'Aceptar',
    },
    warning: {
        icon: AlertTriangle,
        iconClass: 'text-amber-500',
        iconBg: 'bg-amber-50 border-amber-100',
        confirmBtn: 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20',
        confirmText: 'Confirmar',
    },
    info: {
        icon: Info,
        iconClass: 'text-blue-500',
        iconBg: 'bg-blue-50 border-blue-100',
        confirmBtn: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20',
        confirmText: 'Aceptar',
    },
    danger: {
        icon: AlertTriangle,
        iconClass: 'text-red-500',
        iconBg: 'bg-red-50 border-red-100',
        confirmBtn: 'bg-red-600 hover:bg-red-700 shadow-red-500/20',
        confirmText: 'Eliminar',
    },
};

// ─── Componente visual del diálogo ───────────────────────────────────────────
export const AppDialog = ({ dialog, onConfirm, onCancel }) => {
    if (!dialog) return null;

    const style = DIALOG_STYLES[dialog.type] || DIALOG_STYLES.info;
    const Icon = style.icon;
    const isConfirm = dialog.mode === 'confirm';

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                onClick={isConfirm ? onCancel : onConfirm}
            />

            {/* Panel */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200">
                {/* Close button */}
                {!isConfirm && (
                    <button
                        onClick={onConfirm}
                        className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-slate-500 rounded-lg transition-colors"
                    >
                        <X size={16} />
                    </button>
                )}

                <div className="p-6 flex flex-col items-center text-center gap-4">
                    {/* Icon */}
                    <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center ${style.iconBg}`}>
                        <Icon size={28} className={style.iconClass} />
                    </div>

                    {/* Title */}
                    {dialog.title && (
                        <h3 className="text-base font-semibold text-slate-900 leading-tight">
                            {dialog.title}
                        </h3>
                    )}

                    {/* Message */}
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        {dialog.message}
                    </p>

                    {/* Buttons */}
                    <div className={`flex gap-3 w-full pt-1 ${isConfirm ? '' : 'justify-center'}`}>
                        {isConfirm && (
                            <button
                                onClick={onCancel}
                                className="flex-1 py-2.5 border border-slate-200 text-slate-500 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-all"
                            >
                                Cancelar
                            </button>
                        )}
                        <button
                            onClick={onConfirm}
                            className={`${isConfirm ? 'flex-1' : 'px-8'} py-2.5 text-white rounded-xl font-semibold text-sm shadow-md transition-all active:scale-95 ${style.confirmBtn}`}
                        >
                            {dialog.confirmText || style.confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Hook useDialog ───────────────────────────────────────────────────────────
export const useDialog = () => {
    const [dialog, setDialog] = useState(null);
    const [resolver, setResolver] = useState(null);

    const showAlert = useCallback((message, { title, type = 'info' } = {}) => {
        return new Promise((resolve) => {
            setDialog({ message, title, type, mode: 'alert' });
            setResolver(() => resolve);
        });
    }, []);

    const showConfirm = useCallback((message, { title, type = 'warning', confirmText } = {}) => {
        return new Promise((resolve) => {
            setDialog({ message, title, type, mode: 'confirm', confirmText });
            setResolver(() => resolve);
        });
    }, []);

    const handleConfirm = useCallback(() => {
        setDialog(null);
        resolver?.(true);
    }, [resolver]);

    const handleCancel = useCallback(() => {
        setDialog(null);
        resolver?.(false);
    }, [resolver]);

    return {
        dialog,
        showAlert,
        showConfirm,
        dialogProps: {
            dialog,
            onConfirm: handleConfirm,
            onCancel: handleCancel,
        },
    };
};
