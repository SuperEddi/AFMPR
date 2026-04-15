import React, { useState, useEffect } from 'react';
import { X, Save, Building2, MapPin, Hash, PlusCircle } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

const QuickRegisterModal = ({
    isOpen,
    onClose,
    type,
    initialName = "",
    onSave,
    catalogos = {},
    contextData = {}, // e.g. { ubicacion_fisica_id: 123 }
    initialData = null // for editing
}) => {
    const [formData, setFormData] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData(initialData);
                return;
            }
            let initial = {};
            if (type === 'ubicacion') initial = { nombre: initialName, direccion: '', observaciones: '' };
            if (type === 'unidad') initial = { nombre: initialName, ubicacion_fisica_id: contextData.ubicacion_fisica_id || '' };
            if (type === 'oficina') initial = { nombre: initialName, unidad_id: contextData.unidad_id || '' };
            if (type === 'piso') initial = { numero: initialName };
            if (type === 'auxiliar') initial = { nombre: initialName, cat_grupo_contable_id: '' };
            if (type === 'grupo') initial = { nombre: initialName, vida_util: '', observaciones: '' };
            setFormData(initial);
        }
    }, [isOpen, type, initialName, contextData?.ubicacion_fisica_id, contextData?.unidad_id, initialData]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onSave(type, formData);
            onClose();
        } catch (err) {
            alert(err.message || "Error al guardar");
        } finally {
            setSaving(false);
        }
    };

    const getTitle = () => {
        const prefix = initialData ? 'Editar' : 'Registrar Nuevo';
        const titles = {
            'ubicacion': `${prefix} Edificio / Ubicación`,
            'unidad': `${prefix} Nueva Unidad`,
            'oficina': `${prefix} Nueva Oficina`,
            'piso': `${prefix} Nuevo Piso`,
            'auxiliar': `${prefix} Auxiliar`,
            'grupo': `${prefix} Grupo Contable`
        };
        return titles[type] || `${prefix} Registro`;
    };

    const getIcon = () => {
        if (type === 'ubicacion') return <Building2 size={18} className="text-indigo-600" />;
        if (type === 'unidad') return <MapPin size={18} className="text-emerald-600" />;
        if (type === 'oficina') return <PlusCircle size={18} className="text-blue-600" />;
        return <Hash size={18} className="text-slate-600" />;
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        {getIcon()}
                        <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wider">{getTitle()}</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-100">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Campos Comunes y Específicos */}
                    {type === 'ubicacion' && (
                        <>
                            <div>
                                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5 block tracking-widest">Nombre del Edificio / Ubicación *</label>
                                <input
                                    required
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                    value={formData.nombre || ''}
                                    onChange={e => setFormData(p => ({ ...p, nombre: e.target.value }))}
                                    placeholder="Ej: Casa Grande del Pueblo"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5 block tracking-widest">Dirección</label>
                                <input
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
                                    value={formData.direccion || ''}
                                    onChange={e => setFormData(p => ({ ...p, direccion: e.target.value }))}
                                    placeholder="Calle, zona, nro..."
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5 block tracking-widest">Observaciones</label>
                                <textarea
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all min-h-[80px]"
                                    value={formData.observaciones || ''}
                                    onChange={e => setFormData(p => ({ ...p, observaciones: e.target.value }))}
                                    placeholder="..."
                                />
                            </div>
                        </>
                    )}

                    {type === 'unidad' && (
                        <>
                            <div>
                                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5 block tracking-widest">Edificio Relacionado *</label>
                                <SearchableSelect
                                    options={catalogos.ubicaciones?.filter(u => u.activo !== 0) || []}
                                    value={formData.ubicacion_fisica_id || ''}
                                    onChange={id => setFormData(p => ({ ...p, ubicacion_fisica_id: id }))}
                                    emptyLabel="Seleccione un edificio..."
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5 block tracking-widest">Nombre de la Unidad *</label>
                                <input
                                    required
                                    autoFocus
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                                    value={formData.nombre || ''}
                                    onChange={e => setFormData(p => ({ ...p, nombre: e.target.value }))}
                                    placeholder="Ej: Unidad de Sistemas"
                                />
                            </div>
                        </>
                    )}

                    {type === 'oficina' && (
                        <>
                            <div>
                                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5 block tracking-widest">Unidad Relacionada *</label>
                                <SearchableSelect
                                    options={catalogos.unidades?.filter(u => u.activo !== 0) || []}
                                    value={formData.unidad_id || ''}
                                    onChange={id => setFormData(p => ({ ...p, unidad_id: id }))}
                                    emptyLabel="Seleccione una unidad..."
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5 block tracking-widest">Nombre de la Oficina *</label>
                                <input
                                    required
                                    autoFocus
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                                    value={formData.nombre || ''}
                                    onChange={e => setFormData(p => ({ ...p, nombre: e.target.value }))}
                                    placeholder="Ej: Oficina 102"
                                />
                            </div>
                        </>
                    )}

                    {type === 'piso' && (
                        <div>
                            <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5 block tracking-widest">Número de Piso *</label>
                            <input
                                required
                                autoFocus
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all"
                                value={formData.numero || ''}
                                onChange={e => setFormData(p => ({ ...p, numero: e.target.value }))}
                                placeholder="Ej: 1, PB, Sótano..."
                            />
                        </div>
                    )}

                    {type === 'auxiliar' && (
                        <>
                            <div>
                                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5 block tracking-widest">Grupo Contable Relacionado *</label>
                                <SearchableSelect
                                    options={catalogos.grupos?.filter(g => g.activo !== 0) || []}
                                    value={formData.cat_grupo_contable_id || ''}
                                    onChange={id => setFormData(p => ({ ...p, cat_grupo_contable_id: id }))}
                                    emptyLabel="Seleccione un grupo..."
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5 block tracking-widest">Nombre del Auxiliar *</label>
                                <input
                                    required
                                    autoFocus
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all"
                                    value={formData.nombre || ''}
                                    onChange={e => setFormData(p => ({ ...p, nombre: e.target.value }))}
                                    placeholder="Ej: Escritorios"
                                />
                            </div>
                        </>
                    )}

                    {type === 'grupo' && (
                        <>
                            <div>
                                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5 block tracking-widest">Nombre del Grupo Contable *</label>
                                <input
                                    required
                                    autoFocus
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all"
                                    value={formData.nombre || ''}
                                    onChange={e => setFormData(p => ({ ...p, nombre: e.target.value }))}
                                    placeholder="Ej: Muebles y Enseres"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5 block tracking-widest">Vida Útil (Años)</label>
                                <input
                                    type="number"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-violet-500 transition-all"
                                    value={formData.vida_util || ''}
                                    onChange={e => setFormData(p => ({ ...p, vida_util: e.target.value }))}
                                    placeholder="Ej: 10"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5 block tracking-widest">Observaciones</label>
                                <textarea
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-violet-500 transition-all min-h-[80px]"
                                    value={formData.observaciones || ''}
                                    onChange={e => setFormData(p => ({ ...p, observaciones: e.target.value }))}
                                    placeholder="..."
                                />
                            </div>
                        </>
                    )}

                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 text-xs border border-slate-200 text-slate-500 font-semibold uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className={`flex-[2] flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-white rounded-xl shadow-lg transition-all active:scale-95 ${type === 'ubicacion' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20' :
                                type === 'unidad' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' :
                                    type === 'oficina' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' :
                                        'bg-slate-800 hover:bg-slate-900 shadow-slate-500/20'
                                } disabled:opacity-50`}
                        >
                            {saving ? (
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Save size={14} />
                            )}
                            {saving ? 'Guardando...' : 'Guardar Registro'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default QuickRegisterModal;
