import React, { useState, useEffect, useRef, useCallback } from 'react';
import Modal from '../components/Modal';
import QuickAddSelect from '../components/QuickAddSelect';
import QuickRegisterModal from '../components/QuickRegisterModal';
import {
    ClipboardList, Package, CheckCircle, UserPlus,
    Search, ChevronRight, Undo2,
    Trash2, AlertCircle, FileText, Camera, Eye, X as XIcon, ZoomIn,
    User, MapPin, PlusCircle, Printer, Hash, Briefcase, Building2, FilePlus, Archive
} from 'lucide-react';
import { AppDialog, useDialog } from '../components/AppDialog';

// ─── Sub-componente: Devolución con Reasignación por activo ─────────────────
const DevolucionConReasignacion = ({ activosList, activosSeleccionados, toggleActivoDevolucion, seleccionarTodos, reasignaciones, setReasignacion, usuarios, authFetch, fetchUsuarios, catalogos, onRegisterRequest }) => {
    const [busquedas, setBusquedas] = useState({});       // { activoId: 'texto' }
    const [creandoPara, setCreandoPara] = useState(null);  // activoId para el que se crea user
    const [nuevoUser, setNuevoUser] = useState({
        nombre_completo: '', ci: '', cargo: '',
        ubicacion_fisica_id: '', cat_unidad_id: '', cat_oficina_id: '', cat_piso_id: '',
        oficinas_ids: []
    });
    const [guardando, setGuardando] = useState(false);
    const { showAlert: subShowAlert, dialogProps: subDialogProps } = useDialog();
    const [filtroActivos, setFiltroActivos] = useState('');

    const filtrarUsers = (text) =>
        text.length > 0
            ? usuarios.filter(u => u.nombre_completo.toLowerCase().includes(text.toLowerCase()) || String(u.ci).includes(text)).slice(0, 5)
            : [];

    const crearYAsignar = async (activoId) => {
        if (!nuevoUser.nombre_completo || !nuevoUser.ci) { await subShowAlert('El nombre completo y el CI son obligatorios.', { title: 'Campos requeridos', type: 'warning' }); return; }
        setGuardando(true);
        try {
            const payload = { ...nuevoUser, registrado_por: currentUser?.nombre };
            const res = await authFetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (data.success) {
                setReasignacion(activoId, data.user);
                fetchUsuarios();
                setCreandoPara(null);
                setNuevoUser({
                    nombre_completo: '', ci: '', cargo: '',
                    ubicacion_fisica_id: '', cat_unidad_id: '', cat_oficina_id: '', cat_piso_id: '',
                    oficinas_ids: []
                });
            } else { await subShowAlert(data.error || 'Error al crear responsable.', { title: 'Error', type: 'error' }); }
        } catch { await subShowAlert('Error de conexión.', { title: 'Error de red', type: 'error' }); } finally { setGuardando(false); }
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-widest bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 flex items-center gap-2">
                    <Package size={14} /> Activos a Devolver
                </p>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-48">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            placeholder="Filtrar activos..."
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-semibold outline-none focus:ring-2 focus:ring-orange-500/20"
                            value={filtroActivos}
                            onChange={e => setFiltroActivos(e.target.value)}
                        />
                    </div>
                    <button onClick={seleccionarTodos} className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-xl whitespace-nowrap active:scale-95 transition-all">
                        Seleccionar Todos
                    </button>
                </div>
            </div>
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                {activosList.filter(a =>
                    a.codigo_activo?.toLowerCase().includes(filtroActivos.toLowerCase()) ||
                    a.descripcion?.toLowerCase().includes(filtroActivos.toLowerCase())
                ).map(a => {
                    const seleccionado = !!activosSeleccionados.find(s => s.id === a.id);
                    const asignado = reasignaciones[a.id];
                    const busq = busquedas[a.id] || '';
                    const sugerencias = filtrarUsers(busq);
                    const noHayResultados = busq.length > 0 && sugerencias.length === 0;

                    return (
                        <div key={a.id} className={`p-3 ${seleccionado ? 'bg-orange-50' : 'bg-white'} transition-colors`}>
                            {/* Fila principal: checkbox + activo */}
                            <div className="flex items-center gap-3 cursor-pointer" onClick={() => { toggleActivoDevolucion(a); if (!seleccionado) setBusquedas(p => ({ ...p, [a.id]: '' })); }}>
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${seleccionado ? 'bg-orange-500 border-orange-500' : 'border-slate-200'}`}>
                                    {seleccionado && <CheckCircle size={13} className="text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-mono font-semibold text-xs text-slate-800">{a.codigo_activo}</div>
                                    <div className="text-[10px] text-slate-400 leading-relaxed font-medium">{a.descripcion}</div>
                                </div>
                            </div>

                            {/* Panel de reasignación — solo si está seleccionado */}
                            {seleccionado && (
                                <div className="mt-3 ml-8 space-y-2" onClick={e => e.stopPropagation()}>
                                    {asignado ? (
                                        // Ya tiene responsable asignado
                                        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                                            <div>
                                                <p className="text-[10px] font-semibold text-emerald-700 uppercase">{asignado.nombre_completo}</p>
                                                <p className="text-[9px] text-emerald-500">CI: {asignado.ci} · {asignado.cargo}</p>
                                            </div>
                                            <button onClick={() => { setReasignacion(a.id, null); setBusquedas(p => ({ ...p, [a.id]: '' })); }} className="text-emerald-400 hover:text-red-500">
                                                <XIcon size={14} />
                                            </button>
                                        </div>
                                    ) : creandoPara === a.id ? (
                                        // Formulario para crear nuevo responsable
                                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                                            <p className="text-[9px] font-semibold text-blue-600 uppercase">Nuevo Responsable</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <input placeholder="Nombre completo *" className="col-span-2 px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white" value={nuevoUser.nombre_completo} onChange={e => setNuevoUser(p => ({ ...p, nombre_completo: e.target.value }))} />
                                                <input placeholder="CI *" className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white" value={nuevoUser.ci} onChange={e => setNuevoUser(p => ({ ...p, ci: e.target.value }))} />
                                                <input placeholder="Cargo" className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white" value={nuevoUser.cargo} onChange={e => setNuevoUser(p => ({ ...p, cargo: e.target.value }))} />
                                                <div className="col-span-2 space-y-3">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <label className="text-[8px] font-bold text-slate-400 uppercase">1. Edificio</label>
                                                            <QuickAddSelect
                                                                options={catalogos.ubicaciones}
                                                                value={nuevoUser.ubicacion_fisica_id}
                                                                onChange={id => setNuevoUser(p => ({ ...p, ubicacion_fisica_id: id, cat_unidad_id: '', cat_oficina_id: '' }))}
                                                                onRegisterRequest={val => onRegisterRequest('ubicacion', val, { target: 'user' })}
                                                                placeholder="Edificio..."
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[8px] font-bold text-slate-400 uppercase">2. Unidad</label>
                                                            <QuickAddSelect
                                                                options={catalogos.unidades.filter(u => !nuevoUser.ubicacion_fisica_id || u.ubicacion_fisica_id === Number(nuevoUser.ubicacion_fisica_id))}
                                                                value={nuevoUser.cat_unidad_id}
                                                                onChange={id => setNuevoUser(p => ({ ...p, cat_unidad_id: id, cat_oficina_id: '' }))}
                                                                onRegisterRequest={val => onRegisterRequest('unidad', val, { target: 'user', ubicacion_fisica_id: nuevoUser.ubicacion_fisica_id })}
                                                                placeholder="Unidad..."
                                                                disabled={!nuevoUser.ubicacion_fisica_id}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <label className="text-[8px] font-bold text-slate-400 uppercase">3. Oficina</label>
                                                            <div className="flex gap-1">
                                                                <div className="flex-1">
                                                                    <QuickAddSelect
                                                                        options={catalogos.oficinas.filter(o => !nuevoUser.cat_unidad_id || o.unidad_id === Number(nuevoUser.cat_unidad_id))}
                                                                        value={nuevoUser.cat_oficina_id}
                                                                        onChange={id => setNuevoUser(p => ({ ...p, cat_oficina_id: id }))}
                                                                        onRegisterRequest={val => onRegisterRequest('oficina', val, { target: 'user', unidad_id: nuevoUser.cat_unidad_id })}
                                                                        placeholder="Oficina..."
                                                                        disabled={!nuevoUser.cat_unidad_id}
                                                                    />
                                                                </div>
                                                                <button
                                                                    disabled={!nuevoUser.cat_oficina_id}
                                                                    onClick={() => {
                                                                        if (nuevoUser.cat_oficina_id && !nuevoUser.oficinas_ids.includes(Number(nuevoUser.cat_oficina_id))) {
                                                                            setNuevoUser(p => ({
                                                                                ...p,
                                                                                oficinas_ids: [...p.oficinas_ids, Number(p.cat_oficina_id)],
                                                                                cat_oficina_id: ''
                                                                            }));
                                                                        }
                                                                    }}
                                                                    className="px-2 bg-blue-600 text-white rounded-lg active:scale-95 transition-all disabled:opacity-30"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[8px] font-bold text-slate-400 uppercase">4. Piso</label>
                                                            <QuickAddSelect
                                                                options={catalogos.pisos}
                                                                value={nuevoUser.cat_piso_id}
                                                                onChange={id => setNuevoUser(p => ({ ...p, cat_piso_id: id }))}
                                                                onRegisterRequest={val => onRegisterRequest('piso', val, { target: 'user' })}
                                                                placeholder="Piso..."
                                                                labelField="numero"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="min-h-[40px] p-2 border border-slate-100 rounded-lg bg-white flex flex-wrap gap-1.5 items-start">
                                                        {nuevoUser.oficinas_ids.length === 0 ? (
                                                            <p className="text-[8px] text-slate-300 italic w-full text-center mt-2">Agregue oficina</p>
                                                        ) : (
                                                            nuevoUser.oficinas_ids.map(oid => {
                                                                const of = catalogos.oficinas.find(x => x.id === oid);
                                                                return (
                                                                    <div key={oid} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                                                                        <span className="text-[9px] font-bold">{of?.nombre || 'Oficina'}</span>
                                                                        <button onClick={() => setNuevoUser(p => ({ ...p, oficinas_ids: p.oficinas_ids.filter(x => x !== oid) }))} className="hover:text-red-500 transition-colors">
                                                                            <XIcon size={8} />
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 justify-end">
                                                <button onClick={() => setCreandoPara(null)} className="text-[10px] font-semibold text-slate-400 px-3 py-1">Cancelar</button>
                                                <button disabled={guardando} onClick={() => crearYAsignar(a.id)} className="text-[10px] font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                                                    {guardando ? 'Guardando...' : 'Crear y Asignar'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        // Buscador de responsable
                                        <div className="space-y-1">
                                            <div className="relative">
                                                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    placeholder="Buscar responsable por nombre o CI..."
                                                    className="w-full pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                                    value={busq}
                                                    onChange={e => setBusquedas(p => ({ ...p, [a.id]: e.target.value }))}
                                                />
                                            </div>
                                            {sugerencias.length > 0 && (
                                                <div className="border border-slate-100 rounded-lg divide-y divide-slate-50 bg-white shadow-sm">
                                                    {sugerencias.map(u => (
                                                        <button key={u.id} onClick={() => { setReasignacion(a.id, u); setBusquedas(p => ({ ...p, [a.id]: '' })); }} className="w-full text-left px-3 py-2 hover:bg-orange-50 transition-colors">
                                                            <div className="font-semibold text-xs text-slate-800">{u.nombre_completo}</div>
                                                            <div className="text-[9px] text-slate-400">CI: {u.ci} · {u.cargo}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {noHayResultados && (
                                                <button onClick={() => { setCreandoPara(a.id); setNuevoUser({ nombre_completo: busq, ci: '', cargo: '', cat_unidad_id: '', oficinas_ids: [] }); }} className="flex items-center gap-2 w-full px-3 py-2 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors">
                                                    <UserPlus size={13} /> No encontrado — Crear nuevo responsable "{busq}"
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
                {activosList.length === 0 && <div className="p-8 text-center text-slate-400 text-xs italic">No hay activos asignados a este funcionario</div>}
            </div>
            <AppDialog {...subDialogProps} />
        </div>
    );
};

const GenerarActaView = ({ tipo: tipoProp = 'Asignación', authFetch = fetch, currentUser, institution }) => {
    const [tipo, setTipo] = useState(tipoProp);
    const [step, setStep] = useState(1);
    const [usuarios, setUsuarios] = useState([]);
    const [catalogos, setCatalogos] = useState({ ubicaciones: [], unidades: [], oficinas: [], pisos: [], auxiliares: [], grupos: [] });
    const [activosList, setActivosList] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [activosSeleccionados, setActivosSeleccionados] = useState([]);
    const [observaciones, setObservaciones] = useState('');
    const [loading, setLoading] = useState(false);
    const { showAlert, dialogProps } = useDialog();
    const [lastActaId, setLastActaId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchRef = useRef(null);
    const [isNewUser, setIsNewUser] = useState(false);
    const [newUserData, setNewUserData] = useState({
        nombre_completo: '', ci: '', cargo: '',
        ubicacion_fisica_id: '', cat_unidad_id: '', cat_oficina_id: '', cat_piso_id: '',
        oficinas_ids: []
    });
    const [reasignaciones, setReasignaciones] = useState({});
    const [printedActas, setPrintedActas] = useState([]);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [barcodeSearch, setBarcodeSearch] = useState('');
    const barcodeRef = useRef(null);
    const [previewHtml, setPreviewHtml] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [showNewAssetModal, setShowNewAssetModal] = useState(false);
    const [newAssetData, setNewAssetData] = useState({
        codigo_activo: '', descripcion: '', estado_actual: 'Disponible',
        ubicacion_fisica_id: '', cat_unidad_id: '', cat_oficina_id: '', cat_piso_id: '',
        cat_auxiliar_id: '', cat_grupo_contable_id: ''
    });
    const [assetSaving, setAssetSaving] = useState(false);
    const [quickReg, setQuickReg] = useState({ isOpen: false, type: '', name: '', context: {} });
    const [printing, setPrinting] = useState(false);
    const [isEditingLocation, setIsEditingLocation] = useState(false);
    const [locationEditData, setLocationEditData] = useState({ ubicacion_fisica_id: '', cat_unidad_id: '', cat_oficina_id: '', cat_piso_id: '' });
    const [locationSaving, setLocationSaving] = useState(false);
    const [searchMode, setSearchMode] = useState('all'); // 'all', 'codigo', 'descripcion'
    const [showAppendModal, setShowAppendModal] = useState(false);
    const [ultimoActa, setUltimoActa] = useState(null);
    const [printMode, setPrintMode] = useState('all'); // 'all', 'latest'
    const [newAssetIds, setNewAssetIds] = useState([]);
    // ─── Devolución: selección por responsable + ubicación ─────────────────
    const [agrupados, setAgrupados] = useState([]);
    const [devUserSearch, setDevUserSearch] = useState('');
    const [selectedUbicDevolucion, setSelectedUbicDevolucion] = useState(null); // { persona, ubicacion }

    const handleRegisterRequest = (tipo, nombre, customContext = null) => {
        let context = {};
        if (customContext) {
            context = customContext;
        } else {
            if (tipo === 'unidad') context = { ubicacion_fisica_id: locationEditData.ubicacion_fisica_id || newAssetData.ubicacion_fisica_id || newUserData.ubicacion_fisica_id };
            if (tipo === 'oficina') context = { unidad_id: locationEditData.cat_unidad_id || newAssetData.cat_unidad_id || newUserData.cat_unidad_id };
            if (isEditingLocation) context.target = 'location_edit';
            if (isNewUser) context.target = 'new_user';
        }
        setQuickReg({ isOpen: true, type: tipo, name: nombre, context });
    };

    const handleQuickSave = async (tipo, data) => {
        try {
            let url = '';
            if (tipo === 'ubicacion') url = '/api/catalogos/ubicaciones';
            if (tipo === 'unidad') url = '/api/catalogos/unidades';
            if (tipo === 'oficina') url = '/api/catalogos/oficinas';
            if (tipo === 'piso') url = '/api/catalogos/pisos';

            const res = await authFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, registrado_por: currentUser?.nombre })
            });

            if (res.ok) {
                const newItem = await res.json();
                await fetchCatalogos();

                const fieldMap = {
                    'ubicacion': 'ubicacion_fisica_id',
                    'unidad': 'cat_unidad_id',
                    'oficina': 'cat_oficina_id',
                    'piso': 'cat_piso_id'
                };

                // Si el registro venía con un target específico
                if (quickReg.context?.target === 'user') {
                    // El hijo (DevolucionConReasignacion) no puede ser actualizado directamente desde aquí fácilmente
                    window.dispatchEvent(new CustomEvent('data-updated'));
                } else if (quickReg.context?.target === 'new_user') {
                    setNewUserData(prev => ({ ...prev, [fieldMap[tipo]]: newItem.id }));
                } else if (quickReg.context?.target === 'location_edit') {
                    setLocationEditData(prev => ({ ...prev, [fieldMap[tipo]]: newItem.id }));
                } else {
                    setNewAssetData(prev => ({ ...prev, [fieldMap[tipo]]: newItem.id }));
                }
            } else {
                const err = await res.json();
                throw new Error(err.error || "Error al registrar");
            }
        } catch (e) {
            throw e;
        }
    };

    const fetchCatalogos = useCallback(async () => {
        try {
            const res = await authFetch('/api/catalogos');
            if (res.ok) setCatalogos(await res.json());
        } catch (err) { }
    }, [authFetch]);

    const fetchUsuarios = useCallback(() => {
        authFetch('/api/usuarios').then(r => r.json()).then(setUsuarios).catch(() => { });
    }, [authFetch]);

    const fetchAgrupados = useCallback(() => {
        authFetch('/api/activos/agrupados').then(r => r.json()).then(d => setAgrupados(Array.isArray(d) ? d : [])).catch(() => { });
    }, [authFetch]);

    const fetchActivosDisponibles = useCallback(() => {
        if (step === 2) {
            setLoading(true);
            // En Devolución: usamos los activos de la ubicación seleccionada
            if (tipo === 'Devolución' && selectedUbicDevolucion) {
                setActivosList(selectedUbicDevolucion.ubicacion.activos || []);
                setLoading(false);
                return;
            }
            // En Devolución CONSOLIDADA (sin ubicación específica): fetch al API
            if (tipo === 'Devolución' && selectedUser) {
                authFetch(`/api/activos/usuario/${selectedUser.id}`, {
                    headers: { 'x-target-institution': selectedUser.institucion }
                })
                    .then(r => r.json())
                    .then(d => { setActivosList(Array.isArray(d) ? d : []); setLoading(false); })
                    .catch(() => { setLoading(false); });
                return;
            }
            const url = '/api/activos/disponibles';
            authFetch(url)
                .then(r => r.json())
                .then(d => { setActivosList(Array.isArray(d) ? d : []); setLoading(false); })
                .catch(() => { setLoading(false); });
        }
    }, [step, tipo, selectedUbicDevolucion, selectedUser, authFetch]);

    useEffect(() => {
        fetchCatalogos();
        fetchUsuarios();
    }, [fetchUsuarios, fetchCatalogos]);
    useEffect(() => { if (tipo === 'Devolución') fetchAgrupados(); }, [tipo, fetchAgrupados]);
    useEffect(() => { fetchActivosDisponibles(); }, [fetchActivosDisponibles]);

    useEffect(() => {
        const close = e => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowSuggestions(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const handleNextStep = async () => {
        if (step === 1 && isNewUser) {
            if (!newUserData.nombre_completo || !newUserData.ci) {
                await showAlert('El nombre completo y el CI son obligatorios.', { title: 'Campos requeridos', type: 'warning' });
                return;
            }
            try {
                const payload = { ...newUserData, registrado_por: currentUser?.nombre };
                const res = await authFetch('/api/usuarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const data = await res.json();
                if (data.success) {
                    setSelectedUser(data.user);
                    setStep(2);
                    fetchUsuarios();
                } else {
                    await showAlert(data.error || 'Error al registrar usuario.', { title: 'Error', type: 'error' });
                }
            } catch { await showAlert('Error de conexión al registrar usuario.', { title: 'Error de red', type: 'error' }); }
        } else {
            if (step === 1 && !selectedUser) {
                await showAlert('Seleccione un funcionario para continuar.', { title: 'Sin funcionario', type: 'warning' });
                return;
            }
            setStep(s => s + 1);
        }
    };

    const handleFinish = async () => {
        if (!activosSeleccionados.length) return;
        if (tipo === 'Devolución') { setShowConfirmModal(true); return; }

        // Buscar acta reciente de asignación para este usuario
        try {
            setLoading(true);
            const res = await authFetch(`/api/actas?usuario_id=${selectedUser.id}&tipo=Asignación`);
            const actasUser = await res.json();
            // Tomar la más reciente (validando que sea un array)
            const candidate = Array.isArray(actasUser) ? actasUser.sort((a, b) => b.id - a.id)[0] : null;
            if (candidate) {
                setUltimoActa(candidate);
                setShowAppendModal(true);
            } else {
                await saveActa([{ tipo_acta: 'Asignación', usuario_id: selectedUser.id, activos: activosSeleccionados }]);
            }
        } catch (e) {

            await saveActa([{ tipo_acta: 'Asignación', usuario_id: selectedUser.id, activos: activosSeleccionados }]);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmAppend = async (useExisting) => {
        setShowAppendModal(false);
        const appendId = useExisting ? ultimoActa.id : null;
        setNewAssetIds(activosSeleccionados.map(a => a.id));
        await saveActa([{ tipo_acta: 'Asignación', usuario_id: selectedUser.id, activos: activosSeleccionados, appendId }]);
    };

    const saveActa = async (batch) => {
        setLoading(true);
        try {
            const actas = [];
            for (const item of batch) {
                const res = await authFetch('/api/actas', {
                    method: 'POST',
                    body: JSON.stringify({
                        tipo_acta: item.tipo_acta,
                        usuario_id: item.usuario_id,
                        activos_seleccionados: item.activos,
                        observaciones,
                        ubicacion_fisica_id: selectedUser?.ubicacion_fisica_id,
                        cat_unidad_id: selectedUser?.cat_unidad_id,
                        cat_oficina_id: selectedUser?.cat_oficina_id,
                        cat_piso_id: selectedUser?.cat_piso_id,
                        appendToActaId: item.appendId,
                        realizado_por: currentUser?.nombre,
                        institucion: institution || 'tierras'
                    }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const result = await res.json();

                if (!res.ok || !result.success) {
                    throw new Error(result.message || result.error || 'Error desconocido al generar el acta');
                }

                actas.push({ id: result.actaId, tipo: item.tipo_acta });
            }

            if (actas.length > 0) {
                setPrintedActas(actas);
                setLastActaId(actas[0]?.id);
                setStep(3);
                window.dispatchEvent(new CustomEvent('data-updated'));
                fetchActivosDisponibles();
            }
        } catch (e) {

            await showAlert(e.message || 'Error al generar las actas.', { title: 'Error', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAsset = async (e) => {
        if (e) e.preventDefault();
        setAssetSaving(true);
        try {
            // Si estamos en modo CONSOLIDADO, redirigir a la institución del usuario seleccionado
            const targetInst = selectedUser?.institucion &&
                selectedUser.institucion !== 'undefined' &&
                selectedUser.institucion !== 'null'
                ? { 'x-target-institution': selectedUser.institucion.toLowerCase() }
                : {};

            const res = await authFetch('/api/activos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...targetInst },
                body: JSON.stringify(newAssetData)
            });
            const data = await res.json();
            if (res.ok) {
                // BUG FIXED: data.activo instead of newAsset
                setActivosSeleccionados(prev => [...prev, { ...data.activo, estado_fisico: 'Regular' }]);
                setShowNewAssetModal(false);
                setNewAssetData({
                    codigo_activo: '', descripcion: '', estado_actual: 'Disponible',
                    cat_auxiliar_id: '', cat_grupo_contable_id: ''
                });
                fetchActivosDisponibles();
                window.dispatchEvent(new CustomEvent('data-updated'));
            } else {
                await showAlert(data.message || data.error || 'Error al registrar el activo.', { title: 'Error', type: 'error' });
            }
        } catch {
            await showAlert('Error de conexión al registrar el activo.', { title: 'Error de red', type: 'error' });
        } finally {
            setAssetSaving(false);

        }
    };

    const handleSnapshotLocation = () => {
        const updatedUser = {
            ...selectedUser,
            ...locationEditData,
            edificio: catalogos.ubicaciones.find(u => String(u.id) === String(locationEditData.ubicacion_fisica_id))?.nombre || selectedUser?.edificio,
            unidad: catalogos.unidades.find(u => String(u.id) === String(locationEditData.cat_unidad_id))?.nombre || selectedUser?.unidad,
            oficina: catalogos.oficinas.find(o => String(o.id) === String(locationEditData.cat_oficina_id))?.nombre || selectedUser?.oficina,
            piso: catalogos.pisos.find(p => String(p.id) === String(locationEditData.cat_piso_id))?.numero || selectedUser?.piso
        };
        setSelectedUser(updatedUser);
        setIsEditingLocation(false);
    };

    const toggleLocationEdit = () => {
        if (!isEditingLocation) {
            setLocationEditData({
                ubicacion_fisica_id: selectedUser?.ubicacion_fisica_id || '',
                cat_unidad_id: selectedUser?.cat_unidad_id || '',
                cat_oficina_id: selectedUser?.cat_oficina_id || '',
                cat_piso_id: selectedUser?.cat_piso_id || ''
            });
        }
        setIsEditingLocation(!isEditingLocation);
    };

    const confirmarDevolucion = async () => {
        setShowConfirmModal(false);
        const batch = [{ tipo_acta: 'Devolución', usuario_id: selectedUser.id, activos: activosSeleccionados }];
        const grupos = {};
        Object.entries(reasignaciones).forEach(([aId, u]) => {
            if (!grupos[u.id]) grupos[u.id] = { usuario_id: u.id, activos: [] };
            const a = activosSeleccionados.find(x => String(x.id) === String(aId));
            if (a) grupos[u.id].activos.push(a);
        });
        Object.values(grupos).forEach(g => batch.push({ tipo_acta: 'Asignación', ...g }));
        await saveActa(batch);
    };

    const handlePrint = async (id, filterIds = null) => {
        const targetId = id || lastActaId;
        if (!targetId) return;
        setPrinting(true);
        try {
            const { default: jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');

            const dataRes = await authFetch(`/api/actas/${targetId}`).then(r => r.json());

            // Filtrar activos si se solicita "solo lo último"
            if (filterIds && Array.isArray(filterIds)) {
                dataRes.activos = dataRes.activos.filter(a => filterIds.includes(a.id));
            }

            const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
            const PW = 215.9, PH = 279.4;
            const ML = 20, MR = 20, MT = 48, MB = 22;
            const contentW = PW - ML - MR;

            // ─── LOGO ────────────────────────────────────────────
            try {
                const logoBlob = await fetch(`${window.location.origin}/logo.png`).then(r => r.blob());
                const logoDataUrl = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = e => resolve(e.target.result);
                    reader.readAsDataURL(logoBlob);
                });
                doc.addImage(logoDataUrl, 'PNG', ML, 5, 55, 32);
            } catch { /* sin logo */ }

            doc.setDrawColor(197, 160, 89); doc.setLineWidth(0.6);
            doc.line(ML, 40, PW - MR, 40);

            // ─── FOOTER ──────────────────────────────────────────
            const drawFooter = (d) => {
                const total = d.internal.getNumberOfPages();
                for (let i = 1; i <= total; i++) {
                    d.setPage(i);
                    d.setFillColor(218, 41, 28); d.rect(ML, PH - 18, 25, 1.5, 'F');
                    d.setFillColor(244, 228, 0); d.rect(ML + 25, PH - 18, 25, 1.5, 'F');
                    d.setFillColor(0, 122, 51); d.rect(ML + 50, PH - 18, 25, 1.5, 'F');
                    d.setFontSize(8); d.setFont('helvetica', 'bold'); d.setTextColor(0, 0, 0);
                    d.text('MINISTERIO DE LA PRESIDENCIA', PW - MR, PH - 20, { align: 'right' });
                    d.setFont('helvetica', 'normal'); d.setFontSize(7); d.setTextColor(60, 60, 60);
                    d.text('Zona Central - Calle Ayacucho Esq. Potosí', PW - MR, PH - 15, { align: 'right' });
                    d.text('Teléfonos: +591 (2) 2184178', PW - MR, PH - 10, { align: 'right' });
                    d.text(`Pág. ${i} / ${total}`, PW / 2, PH - 8, { align: 'center' });

                    // Iniciales del creador (o actual si es nuevo)
                    const userCreator = (typeof dataRes !== 'undefined' ? dataRes.realizado_por : null) || 'SISTEMA';
                    const initials = userCreator.split(' ').map(n => n[0]).join('').toUpperCase();

                    d.setFontSize(5.5); d.setTextColor(100, 100, 100);
                    d.text(`USUARIO: ${initials}`, ML, PH - 20.5);
                }
            };

            // ─── DATOS ───────────────────────────────────────────
            const nombre = dataRes.nombre_completo || dataRes.usuario_nombre || 'N/A';
            const ci = dataRes.ci || dataRes.usuario_ci || '';
            const cargo = dataRes.cargo || dataRes.usuario_cargo || '';
            const unidad = dataRes.unidad || dataRes.usuario_unidad || '';
            const oficina = dataRes.oficina || dataRes.usuario_oficina || '';
            const piso = dataRes.piso || dataRes.usuario_piso || '';
            const tipo = dataRes.tipo_acta || dataRes.tipo || 'Asignación';
            const fechaStr = new Date(dataRes.fecha_emision || dataRes.fecha || Date.now())
                .toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

            let y = MT;

            // ─── TÍTULO ──────────────────────────────────────────
            doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(0, 0, 0);
            doc.text(`ACTA DE ${tipo.toUpperCase()} DE ACTIVOS`, PW / 2, y, { align: 'center' });
            y += 8;

            // ─── METADATOS ───────────────────────────────────────
            autoTable(doc, {
                startY: y, margin: { left: ML, right: MR, bottom: MB }, tableWidth: contentW,
                body: [
                    ['NRO. ACTA:', `#${String(dataRes.id || '000000').padStart(6, '0')}`],
                    ['FECHA:', fechaStr],
                    ['RESPONSABLE:', nombre.toUpperCase()],
                    ['CI / CARGO:', `${ci} – ${cargo}`],
                    ['UBICACIÓN:', `${dataRes.ubicacion_fisica || ''} / ${unidad} / ${oficina} (Piso: ${piso})`],
                ],
                theme: 'plain',
                styles: { font: 'helvetica', fontSize: 11, cellPadding: 1.5, textColor: [0, 0, 0] },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
            });
            y = doc.lastAutoTable.finalY + 6;

            // ─── TABLA DE ACTIVOS ─────────────────────────────────
            autoTable(doc, {
                startY: y, margin: { left: ML, right: MR, bottom: MB }, tableWidth: contentW,
                head: [['CÓDIGO ACTIVO', 'DESCRIPCIÓN', 'ESTADO']],
                body: (dataRes.activos || []).map(a => [
                    a.codigo_activo || '',
                    (a.descripcion || '').replace(/[\u00C0-\u017F]/g, chr => {
                        const map = {
                            '\u00D1': 'N', '\u00F1': 'n',
                            '\u00C1': 'A', '\u00E1': 'a',
                            '\u00C9': 'E', '\u00E9': 'e',
                            '\u00CD': 'I', '\u00ED': 'i',
                            '\u00D3': 'O', '\u00F3': 'o',
                            '\u00DA': 'U', '\u00FA': 'u',
                            '\u00DC': 'U', '\u00FC': 'u'
                        };
                        return map[chr] || chr;
                    }),
                    (a.estado_fisico || 'BUENO').toUpperCase()
                ]),
                theme: 'grid',
                headStyles: { fillColor: [241, 241, 241], textColor: [0, 0, 0], font: 'helvetica', fontStyle: 'normal', fontSize: 10 },
                bodyStyles: { font: 'helvetica', fontSize: 8, textColor: [0, 0, 0] },
                columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' }, 2: { cellWidth: 25, halign: 'center' } },
            });
            y = doc.lastAutoTable.finalY + 2;

            // ─── OBSERVACIONES ────────────────────────────────────
            if (dataRes.observaciones) {
                doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setDrawColor(180, 180, 180);
                const obsLines = doc.splitTextToSize(`OBSERVACIONES: ${dataRes.observaciones}`, contentW - 8);
                doc.rect(ML, y, contentW, obsLines.length * 4.5 + 4);
                doc.text(obsLines, ML + 4, y + 5);
                y += obsLines.length * 4.5 + 8;
            }

            // ─── NOTA LEGAL ───────────────────────────────────────
            doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
            doc.setDrawColor(197, 160, 89); doc.setLineWidth(1);
            doc.line(ML, y, ML, y + 14); doc.setLineWidth(0.2);
            const nota = 'NOTA: En cumplimiento a los Art. 141, 146, 147, 154, 159 y 157 del D.S. 0181 y Ley 1178, se procede con el acto. El custodio no podrá efectuar préstamos o transferencias por cuenta propia.';
            const notaLines = doc.splitTextToSize(nota, contentW - 5);
            doc.text(notaLines, ML + 4, y + 4);
            y += notaLines.length * 4 + 12;

            // ─── FIRMAS ───────────────────────────────────────────
            if (y + 22 > PH - MB) { doc.addPage(); y = MT + 5; } else { y += 6; }
            const firmaY = y + 15;
            const col1X = ML + 5, col2X = ML + contentW - 50;
            doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
            doc.line(col1X, firmaY, col1X + 50, firmaY);
            doc.line(col2X, firmaY, col2X + 50, firmaY);
            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
            doc.text('ENTREGUÉ CONFORME', col1X + 25, firmaY + 5, { align: 'center' });
            doc.text('RECIBÍ CONFORME', col2X + 25, firmaY + 5, { align: 'center' });

            drawFooter(doc);
            const safeNombre = nombre.trim().replace(/\s+/g, '_');
            doc.save(`Acta_${tipo}_${safeNombre}_${targetId}.pdf`);

        } catch (e) {

        } finally { setPrinting(false); }
    };


    const handlePreviewView = async (id) => {
        setPreviewLoading(true); setShowPreview(true);
        try {
            const ar = await authFetch(`/api/actas/${id}`);
            const data = await ar.json();
            setPreviewHtml(buildCartaHtml(data));
        } catch { setPreviewHtml('Error al cargar vista previa'); } finally { setPreviewLoading(false); }
    };

    const addActivo = (activo) => {
        if (!activosSeleccionados.find(a => a.id === activo.id)) {
            setActivosSeleccionados(prev => [...prev, { ...activo, estado_fisico: 'Regular' }]);
        }
        setSearchTerm(''); setShowSuggestions(false);
    };

    const toggleActivoDevolucion = (activo) => {
        const yaSeleccionado = activosSeleccionados.find(a => a.id === activo.id);
        if (yaSeleccionado) setActivosSeleccionados(prev => prev.filter(a => a.id !== activo.id));
        else setActivosSeleccionados(prev => [...prev, { ...activo, estado_fisico: 'Regular' }]);
    };

    const seleccionarTodos = () => {
        if (activosSeleccionados.length === activosList.length) setActivosSeleccionados([]);
        else setActivosSeleccionados(activosList.map(a => ({ ...a, estado_fisico: 'Regular' })));
    };

    const suggestions = searchTerm.length > 0
        ? activosList.filter(a => {
            const isNotSelected = !activosSeleccionados.find(s => s.id === a.id);
            if (!isNotSelected) return false;

            const term = searchTerm.toLowerCase();
            const matchesCode = a.codigo_activo?.toLowerCase().includes(term);
            const matchesDesc = a.descripcion?.toLowerCase().includes(term);

            if (searchMode === 'codigo') return matchesCode;
            if (searchMode === 'descripcion') return matchesDesc;
            return matchesCode || matchesDesc;
        }).slice(0, 8)
        : [];

    const resetForm = () => { setStep(1); setSelectedUser(null); setActivosSeleccionados([]); setObservaciones(''); setIsNewUser(false); setNewUserData({ nombre_completo: '', ci: '', cargo: '', cat_unidad_id: '', oficinas_ids: [] }); setSearchTerm(''); setUserSearch(''); setReasignaciones({}); setPrintedActas([]); setBarcodeSearch(''); setSelectedUbicDevolucion(null); setDevUserSearch(''); };

    const setReasignacion = (activoId, usuario) => {
        setReasignaciones(prev => { const n = { ...prev }; if (usuario) n[activoId] = usuario; else delete n[activoId]; return n; });
    };

    const filteredUsers = usuarios.filter(u => u.nombre_completo.toLowerCase().includes(userSearch.toLowerCase()) || String(u.ci).includes(userSearch));
    const accentClasses = tipo === 'Asignación' ? { bg: 'bg-blue-600', bgLight: 'bg-blue-50', text: 'text-blue-600', shadow: 'shadow-blue-500/20' } : { bg: 'bg-orange-600', bgLight: 'bg-orange-50', text: 'text-orange-600', shadow: 'shadow-orange-500/20' };

    return (
        <>
            <div className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl text-white ${accentClasses.bg}`}>{tipo === 'Asignación' ? <FilePlus size={18} /> : <Undo2 size={18} />}</div>
                        <div><h2 className="text-base font-semibold text-slate-900 leading-tight">Acta de {tipo}</h2><p className="text-slate-400 text-xs">Paso {step}</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                        {[1, 2, 3].map(s => (
                            <div key={s} className="flex items-center gap-2 text-xs font-semibold">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${step === s ? `${accentClasses.bg} text-white` : step > s ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{step > s ? <CheckCircle size={16} /> : s}</div>
                                {s < 3 && <div className={`w-6 h-0.5 rounded ${step > s ? 'bg-emerald-400' : 'bg-slate-100'}`} />}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden min-h-[400px]">
                    {step === 1 && (
                        <div className="p-4 space-y-4">
                            <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-fit">
                                {['Asignación', 'Devolución'].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => { setTipo(t); setSelectedUser(null); setIsNewUser(false); setSelectedUbicDevolucion(null); setDevUserSearch(''); }}
                                        className={`px-4 py-2 rounded-md text-xs font-semibold ${tipo === t ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                                {tipo !== 'Devolución' && (
                                    <button
                                        onClick={() => { setIsNewUser(true); setSelectedUser(null); }}
                                        className={`px-4 py-2 rounded-md text-xs font-semibold ${isNewUser ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                                    >
                                        + Nuevo Funcionario
                                    </button>
                                )}
                            </div>

                            {/* ─── MODO DEVOLUCIÓN: selector de responsable + ubicación ─── */}
                            {tipo === 'Devolución' ? (
                                <div className="space-y-3">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            placeholder="Buscar responsable por nombre o CI..."
                                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                                            value={devUserSearch}
                                            onChange={e => setDevUserSearch(e.target.value)}
                                        />
                                    </div>
                                    {agrupados.length === 0 ? (
                                        <div className="py-10 text-center text-slate-400 text-sm font-medium italic">
                                            No hay activos asignados en el sistema.
                                        </div>
                                    ) : (
                                        <div className="max-h-80 overflow-y-auto space-y-2">
                                            {agrupados
                                                .filter(p =>
                                                    p.nombre_completo.toLowerCase().includes(devUserSearch.toLowerCase()) ||
                                                    String(p.ci).includes(devUserSearch)
                                                )
                                                .map(persona => (
                                                    <div key={persona.ci} className="border border-slate-100 rounded-xl overflow-hidden group/item">
                                                        {/* Cabecera del responsable - CLICKABLE para Consolidado */}
                                                        <div
                                                            onClick={() => {
                                                                setSelectedUser({ id: persona.id, ci: persona.ci, nombre_completo: persona.nombre_completo, cargo: persona.cargo, unidad: '', oficina: '', piso: '' });
                                                                setSelectedUbicDevolucion(null); // Consolidado
                                                                setStep(2);
                                                            }}
                                                            className="flex items-center gap-3 px-3 py-3 bg-slate-50 border-b border-slate-100 hover:bg-orange-50 cursor-pointer transition-colors"
                                                            title="Seleccionar todos los activos de este responsable"
                                                        >
                                                            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center font-semibold text-orange-600 text-sm flex-shrink-0">
                                                                {persona.nombre_completo.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="font-semibold text-slate-900 text-xs truncate uppercase">{persona.nombre_completo}</div>
                                                                    {persona.institucion && (
                                                                        <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded border uppercase shrink-0 ${persona.institucion === 'TIERRAS' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                                            persona.institucion === 'JUSTICIA' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                                                'bg-blue-50 text-blue-600 border-blue-100'
                                                                            }`}>
                                                                            {persona.institucion}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-[10px] text-slate-400 font-semibold">{persona.cargo} · CI: {persona.ci}</div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-semibold text-orange-600 bg-orange-100/50 border border-orange-200 px-2 py-1 rounded-full group-hover/item:bg-orange-600 group-hover/item:text-white transition-all">
                                                                    {persona.total_activos || persona.ubicaciones.reduce((t, u) => t + (u.activos?.length || 0), 0)} activos
                                                                </span>
                                                                <ChevronRight size={14} className="text-slate-300 opacity-0 group-hover/item:opacity-100 transition-all" />
                                                            </div>
                                                        </div>
                                                        {/* Ubicaciones de ese responsable */}
                                                        {persona.ubicaciones.map((ubic, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => {
                                                                    setSelectedUser({ id: persona.id, ci: persona.ci, nombre_completo: persona.nombre_completo, cargo: persona.cargo, unidad: ubic.unidad, oficina: ubic.oficina, piso: ubic.piso });
                                                                    setSelectedUbicDevolucion({ persona, ubicacion: ubic });
                                                                    setActivosList(ubic.activos || []);
                                                                    setStep(2);
                                                                }}
                                                                className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-orange-50 transition-colors border-b border-slate-50 last:border-b-0 text-left"
                                                            >
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <MapPin size={12} className="text-slate-400 flex-shrink-0" />
                                                                    <div className="min-w-0">
                                                                        <span className="text-xs font-semibold text-slate-700 truncate block">
                                                                            {ubic.edificio ? <span className="text-indigo-600 mr-1">{ubic.edificio} —</span> : ''}
                                                                            {ubic.oficina || '—'} {ubic.piso ? `· P${ubic.piso}` : ''}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-400 font-medium truncate block">{ubic.unidad || 'Sin unidad'}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                                                        {ubic.activos?.length || 0} activos
                                                                    </span>
                                                                    <ChevronRight size={14} className="text-slate-300" />
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    )}
                                </div>
                            ) : !isNewUser ? (
                                <div className="space-y-3">
                                    <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input placeholder="Buscar funcionario..." className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={userSearch} onChange={e => setUserSearch(e.target.value)} /></div>
                                    {filteredUsers.length > 0 && <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-2 px-1">Funcionarios Existentes Encontrados</div>}
                                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl bg-white/50">
                                        {filteredUsers.map(u => (
                                            <div key={u.id} onClick={() => {
                                                // Si la institución del usuario no coincide con la seleccionada, alertar y limpiar ubicación
                                                if (u.institucion && institution && u.institucion.toLowerCase() !== institution.toLowerCase() && institution.toLowerCase() !== 'consolidado') {
                                                    showAlert(`El funcionario pertenece a "${u.institucion}". Para asignarle activos en "${institution.toUpperCase()}", deberá definir su ubicación (Oficina/Piso) en esta institución manualmente.`, { title: 'Diferente Institución', type: 'warning' });
                                                    setSelectedUser({ ...u, cat_unidad_id: '', ubicacion_fisica_id: '', edificio: '', unidad: '', oficina: '', piso: '' });
                                                } else {
                                                    setSelectedUser(u);
                                                }
                                                setStep(2);
                                            }} className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 ${selectedUser?.id === u.id ? 'bg-slate-50' : ''}`}>
                                                <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center font-semibold text-slate-500 uppercase">{u.nombre_completo.charAt(0)}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <div className="font-semibold text-slate-800 text-sm truncate uppercase">{u.nombre_completo}</div>
                                                        {u.institucion && (
                                                            <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded border uppercase shrink-0 ${u.institucion === 'TIERRAS' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                                u.institucion === 'JUSTICIA' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                                    'bg-blue-50 text-blue-600 border-blue-100'
                                                                }`}>
                                                                {u.institucion}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 uppercase font-semibold">{u.cargo} | CI: {u.ci}</div>
                                                </div>
                                                <ChevronRight size={14} className="text-slate-300" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block flex items-center gap-1.5"><User size={12} /> Nombre Completo</label>
                                            <input
                                                placeholder="Ej. Juan Pérez Gómez"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                                                value={newUserData.nombre_completo}
                                                onChange={e => setNewUserData(p => ({ ...p, nombre_completo: e.target.value }))}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block flex items-center gap-1.5"><Hash size={12} /> CI</label>
                                                <input
                                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                                                    value={newUserData.ci}
                                                    onChange={e => setNewUserData(p => ({ ...p, ci: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block flex items-center gap-1.5"><Briefcase size={12} /> Cargo</label>
                                                <input
                                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                                                    value={newUserData.cargo}
                                                    onChange={e => setNewUserData(p => ({ ...p, cargo: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-4">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2"><MapPin size={12} /> Ubicación del Funcionario (Filtro para Oficinas)</p>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">1. Edificio / Ubicación Física</label>
                                                <QuickAddSelect
                                                    options={catalogos.ubicaciones}
                                                    value={newUserData.ubicacion_fisica_id}
                                                    onChange={id => setNewUserData(p => ({ ...p, ubicacion_fisica_id: id, cat_unidad_id: '', cat_oficina_id: '' }))}
                                                    onRegisterRequest={val => handleRegisterRequest('ubicacion', val)}
                                                    placeholder="Seleccionar..."
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">2. Unidad</label>
                                                <QuickAddSelect
                                                    options={catalogos.unidades.filter(u => !newUserData.ubicacion_fisica_id || u.ubicacion_fisica_id === Number(newUserData.ubicacion_fisica_id))}
                                                    value={newUserData.cat_unidad_id}
                                                    onChange={id => setNewUserData(p => ({ ...p, cat_unidad_id: id, cat_oficina_id: '' }))}
                                                    onRegisterRequest={val => handleRegisterRequest('unidad', val)}
                                                    placeholder="Seleccionar..."
                                                    disabled={!newUserData.ubicacion_fisica_id}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">3. Oficina</label>
                                                    <div className="flex gap-2">
                                                        <div className="flex-1">
                                                            <QuickAddSelect
                                                                options={catalogos.oficinas.filter(o => !newUserData.cat_unidad_id || o.unidad_id === Number(newUserData.cat_unidad_id))}
                                                                value={newUserData.cat_oficina_id}
                                                                onChange={id => setNewUserData(p => ({ ...p, cat_oficina_id: id }))}
                                                                onRegisterRequest={val => handleRegisterRequest('oficina', val)}
                                                                placeholder="Seleccionar..."
                                                                disabled={!newUserData.cat_unidad_id}
                                                            />
                                                        </div>
                                                        <button
                                                            disabled={!newUserData.cat_oficina_id}
                                                            onClick={() => {
                                                                if (newUserData.cat_oficina_id && !newUserData.oficinas_ids.includes(Number(newUserData.cat_oficina_id))) {
                                                                    setNewUserData(p => ({
                                                                        ...p,
                                                                        oficinas_ids: [...p.oficinas_ids, Number(p.cat_oficina_id)],
                                                                        cat_oficina_id: ''
                                                                    }));
                                                                }
                                                            }}
                                                            className="px-3 bg-blue-600 text-white rounded-xl active:scale-95 transition-all disabled:opacity-30"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">4. Piso (Opcional)</label>
                                                    <QuickAddSelect
                                                        options={catalogos.pisos}
                                                        value={newUserData.cat_piso_id}
                                                        onChange={id => setNewUserData(p => ({ ...p, cat_piso_id: id }))}
                                                        onRegisterRequest={val => handleRegisterRequest('piso', val)}
                                                        placeholder="Cualquiera..."
                                                        labelField="numero"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">Oficinas Agregadas</label>
                                                <div className="min-h-[100px] p-3 border border-slate-200 rounded-xl bg-white flex flex-wrap gap-2 items-start content-start">
                                                    {newUserData.oficinas_ids.length === 0 ? (
                                                        <p className="text-[10px] text-slate-300 italic w-full text-center mt-8">Agregue al menos una oficina</p>
                                                    ) : (
                                                        newUserData.oficinas_ids.map(oid => {
                                                            const of = catalogos.oficinas.find(x => x.id === oid);
                                                            return (
                                                                <div key={oid} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg border border-blue-100 animate-in fade-in zoom-in duration-200">
                                                                    <span className="text-[10px] font-bold">{of?.nombre || 'Oficina'}</span>
                                                                    <button onClick={() => setNewUserData(p => ({ ...p, oficinas_ids: p.oficinas_ids.filter(x => x !== oid) }))} className="hover:text-red-500 transition-colors">
                                                                        <X size={10} />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="p-4 space-y-4">
                            <div className={`p-3 rounded-xl ${accentClasses.bgLight} border ${accentClasses.text} border-current opacity-90`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-semibold uppercase opacity-60">Responsable</p>
                                        <p className="font-semibold text-sm truncate uppercase">{selectedUser?.nombre_completo}</p>
                                        <p className="text-[10px] font-semibold opacity-70 truncate">{selectedUser?.cargo} | CI: {selectedUser?.ci}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {tipo === 'Asignación' && (
                                            <button onClick={toggleLocationEdit} className="text-[10px] font-semibold uppercase border border-current px-3 py-1.5 rounded-lg hover:bg-white transition-colors">
                                                {isEditingLocation ? 'Cancelar' : '＋ Oficina'}
                                            </button>
                                        )}
                                        <button onClick={() => setStep(1)} className="text-[10px] font-semibold uppercase border border-current px-3 py-1.5 rounded-lg hover:bg-white transition-colors">Volver</button>
                                    </div>
                                </div>

                                {tipo === 'Asignación' && isEditingLocation ? (
                                    <div className="pt-3 border-t border-current border-dotted">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                            <div>
                                                <label className="text-[9px] font-semibold uppercase opacity-60 block mb-1">Edificio / Ubicación Física</label>
                                                <QuickAddSelect
                                                    options={catalogos.ubicaciones}
                                                    value={locationEditData.ubicacion_fisica_id}
                                                    onChange={id => setLocationEditData(p => ({ ...p, ubicacion_fisica_id: id, cat_unidad_id: '', cat_oficina_id: '' }))}
                                                    onRegisterRequest={val => handleRegisterRequest('ubicacion', val)}
                                                    placeholder="Buscar o registrar Edificio..."
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-semibold uppercase opacity-60 block mb-1">Unidad</label>
                                                <QuickAddSelect
                                                    options={catalogos.unidades.filter(u => !locationEditData.ubicacion_fisica_id || u.ubicacion_fisica_id === Number(locationEditData.ubicacion_fisica_id))}
                                                    value={locationEditData.cat_unidad_id}
                                                    onChange={id => setLocationEditData(p => ({ ...p, cat_unidad_id: id, cat_oficina_id: '' }))}
                                                    onRegisterRequest={val => handleRegisterRequest('unidad', val)}
                                                    placeholder="Buscar o registrar Unidad..."
                                                    disabled={!locationEditData.ubicacion_fisica_id}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                            <div>
                                                <label className="text-[9px] font-semibold uppercase opacity-60 block mb-1">Oficina</label>
                                                <QuickAddSelect
                                                    options={catalogos.oficinas.filter(o => !locationEditData.cat_unidad_id || o.unidad_id === Number(locationEditData.cat_unidad_id))}
                                                    value={locationEditData.cat_oficina_id}
                                                    onChange={id => setLocationEditData(p => ({ ...p, cat_oficina_id: id }))}
                                                    onRegisterRequest={val => handleRegisterRequest('oficina', val)}
                                                    placeholder="Buscar o registrar Oficina..."
                                                    disabled={!locationEditData.cat_unidad_id}
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <label className="text-[9px] font-semibold uppercase opacity-60 block mb-1">Piso</label>
                                                    <QuickAddSelect
                                                        options={catalogos.pisos}
                                                        value={locationEditData.cat_piso_id}
                                                        onChange={id => setLocationEditData(p => ({ ...p, cat_piso_id: id }))}
                                                        onRegisterRequest={val => handleRegisterRequest('piso', val)}
                                                        placeholder="Buscar o registrar Piso..."
                                                        labelField="numero"
                                                    />
                                                </div>
                                                <button onClick={handleSnapshotLocation} className="mt-5 bg-slate-900 border border-slate-700 text-white px-4 rounded-xl shadow-lg active:scale-95 transition-all">
                                                    <CheckCircle size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t border-current border-dotted opacity-70">
                                        <div><p className="text-[8px] font-semibold uppercase opacity-60">Edificio</p><p className="text-[10px] font-semibold truncate uppercase">{selectedUser?.edificio || '---'}</p></div>
                                        <div><p className="text-[8px] font-semibold uppercase opacity-60">Unidad</p><p className="text-[10px] font-semibold truncate uppercase">{selectedUser?.unidad || '---'}</p></div>
                                        <div><p className="text-[8px] font-semibold uppercase opacity-60">Oficina</p><p className="text-[10px] font-semibold truncate uppercase">{selectedUser?.oficina || '---'}</p></div>
                                        <div><p className="text-[8px] font-semibold uppercase opacity-60">Piso</p><p className="text-[10px] font-semibold truncate uppercase">{selectedUser?.piso || '---'}</p></div>
                                    </div>
                                )}
                            </div>
                            {tipo === 'Asignación' ? (
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-3 relative" ref={searchRef}>
                                        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                                            {[
                                                { id: 'all', label: 'Todo', icon: <Package size={12} /> },
                                                { id: 'codigo', label: 'Código', icon: <ZoomIn size={12} /> },
                                                { id: 'descripcion', label: 'Descripción', icon: <FileText size={12} /> }
                                            ].map(m => (
                                                <button
                                                    key={m.id}
                                                    onClick={() => setSearchMode(m.id)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all ${searchMode === m.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    {m.icon} {m.label}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="flex gap-2">
                                            <div className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input placeholder="Buscar activos..." className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setShowSuggestions(true); }} /></div>
                                            <button onClick={() => setShowNewAssetModal(true)} className="bg-emerald-600 text-white p-2.5 rounded-lg active:scale-95 shadow-lg shadow-emerald-500/20"><FilePlus size={18} /></button>
                                        </div>
                                        {showSuggestions && searchTerm.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 z-50 divide-y divide-slate-50 overflow-hidden max-h-60 overflow-y-auto">
                                                {suggestions.map(a => (
                                                    <button key={a.id} onClick={() => addActivo(a)} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between transition-colors">
                                                        <div>
                                                            <div className="flex items-center gap-2 font-semibold text-xs font-mono lowercase">
                                                                <span className="uppercase">{a.codigo_activo}</span>
                                                                {a.institucion && (
                                                                    <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded border uppercase shrink-0 ${a.institucion === 'TIERRAS' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                                        a.institucion === 'JUSTICIA' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                                            'bg-blue-50 text-blue-600 border-blue-100'
                                                                        }`}>
                                                                        {a.institucion}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 leading-relaxed">{a.descripcion}</div>
                                                        </div>
                                                        <ChevronRight size={14} />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                                        <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-100 px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex justify-between">
                                            <span>Activos Seleccionados</span>
                                            <span>{activosSeleccionados.length} Items</span>
                                        </div>
                                        <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto custom-scrollbar">
                                            {activosSeleccionados.map(a => (
                                                <div key={a.id} className="p-3 flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 font-mono font-semibold text-xs lowercase">
                                                            <span className="uppercase">{a.codigo_activo}</span>
                                                            {a.institucion && (
                                                                <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded border uppercase shrink-0 ${a.institucion === 'TIERRAS' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                                    a.institucion === 'JUSTICIA' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                                        'bg-blue-50 text-blue-600 border-blue-100'
                                                                    }`}>
                                                                    {a.institucion}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 leading-relaxed">{a.descripcion}</div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {['Bueno', 'Regular', 'Malo'].map(e => <button key={e} onClick={() => setActivosSeleccionados(prev => prev.map(x => x.id === a.id ? { ...x, estado_fisico: e } : x))} className={`px-2 py-1 rounded text-[9px] font-semibold ${a.estado_fisico === e ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400'}`}>{e}</button>)}
                                                        <button onClick={() => setActivosSeleccionados(prev => prev.filter(x => x.id !== a.id))} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                                                    </div>
                                                </div>
                                            ))}
                                            {activosSeleccionados.length === 0 && <div className="p-8 text-center text-slate-400 text-xs italic">Agregue activos para el acta</div>}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <DevolucionConReasignacion
                                    activosList={activosList}
                                    activosSeleccionados={activosSeleccionados}
                                    toggleActivoDevolucion={toggleActivoDevolucion}
                                    seleccionarTodos={seleccionarTodos}
                                    reasignaciones={reasignaciones}
                                    setReasignacion={setReasignacion}
                                    usuarios={usuarios}
                                    authFetch={authFetch}
                                    fetchUsuarios={fetchUsuarios}
                                    catalogos={catalogos}
                                    onRegisterRequest={handleRegisterRequest}
                                    currentUser={currentUser}
                                />
                            )}
                            <textarea placeholder="Observaciones..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm min-h-[80px]" value={observaciones} onChange={e => setObservaciones(e.target.value)} />
                        </div>
                    )}

                    {step === 3 && (
                        <div className="p-8 text-center space-y-4">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20"><CheckCircle size={32} /></div>
                            <div><h3 className="text-lg font-semibold text-slate-900">Acta Generada Correctamente</h3><p className="text-slate-400 text-xs mt-1">Descarga el documento para oficializar el proceso</p></div>
                            <div className="space-y-2 max-w-sm mx-auto pt-4">
                                {printedActas.map(a => (
                                    <button
                                        key={a.id}
                                        onClick={() => handlePrint(a.id, printMode === 'latest' ? newAssetIds : null)}
                                        className="w-full flex items-center justify-between p-4 bg-slate-900 border border-slate-700 text-white rounded-2xl font-semibold text-sm shadow-2xl active:scale-95 transition-all hover:bg-slate-800"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-blue-400">
                                                <FileText size={18} />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">{selectedUser?.nombre_completo || 'Funcionario'}</p>
                                                <p className="text-sm font-semibold">Acta de {a.tipo} #{String(a.id).padStart(6, '0')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {printMode === 'latest' && <span className="text-[8px] bg-blue-600 px-2 py-0.5 rounded-full text-white uppercase font-semibold italic shadow-lg shadow-blue-500/20">Solo Adición</span>}
                                            <ChevronRight size={16} className="text-slate-500" />
                                        </div>
                                    </button>
                                ))}
                                <button onClick={resetForm} className="w-full p-4 border border-slate-200 text-slate-400 rounded-xl font-semibold text-sm hover:bg-slate-50">Nueva Operación</button>
                            </div>
                        </div>
                    )}
                </div>

                {step < 3 && (
                    <div className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <button onClick={() => step === 1 ? resetForm() : setStep(s => s - 1)} className="text-slate-400 font-semibold text-sm">Regresar</button>
                        <button disabled={loading || (step === 1 && !selectedUser && !isNewUser) || (step === 2 && activosSeleccionados.length === 0)} onClick={step === 2 ? handleFinish : handleNextStep} className={`px-8 py-3 rounded-xl text-white font-semibold text-sm shadow-lg active:scale-95 disabled: opacity-50 ${accentClasses.bg} ${accentClasses.shadow}`}>{loading ? 'Procesando...' : step === 2 ? 'Finalizar' : 'Continuar'}</button>
                    </div>
                )}

                <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Confirmar Devolución" size="md" footer={<><button onClick={() => setShowConfirmModal(false)} className="px-4 py-2 text-slate-400 font-semibold">Cancelar</button><button onClick={confirmarDevolucion} className="px-6 py-2 bg-orange-600 text-white rounded-xl font-semibold">Confirmar</button></>}>
                    <div className="p-4 bg-orange-50 rounded-xl border border-orange-100"><p className="text-orange-800 text-sm font-semibold">Se liberarán {activosSeleccionados.length} activos del funcionario.</p></div>
                </Modal>

                <Modal isOpen={showAppendModal} onClose={() => setShowAppendModal(false)} title="¿Cómo desea proceder?" size="md">
                    <div className="p-6 space-y-6">
                        <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                            <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20"><FileText size={24} /></div>
                            <div>
                                <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-widest">Acta Reciente Encontrada</p>
                                <p className="text-xl font-semibold text-slate-900">Acta # {String(ultimoActa?.id).padStart(6, '0')}</p>
                                <p className="text-[10px] font-semibold text-slate-500 uppercase italic">Emitida el: {new Date(ultimoActa?.fecha_emision).toLocaleDateString()}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                                {/* OPCION AUMENTAR */}
                                <div className="relative group">
                                    <div className="absolute -top-2.5 right-4 z-10 bg-blue-600 text-white text-[9px] font-semibold px-3 py-1 rounded-full shadow-lg shadow-blue-500/30 tracking-widest animate-pulse">RECOMENDADO</div>
                                    <button
                                        onClick={() => handleConfirmAppend(true)}
                                        className="w-full p-5 bg-white border-2 border-blue-100 rounded-3xl text-left transition-all hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/10 active:scale-[0.98] ring-offset-2 hover:ring-2 ring-blue-500/20"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-500/20 shrink-0">
                                                <PlusCircle size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-lg font-semibold text-slate-900 leading-tight">Aumentar Acta Existente</p>
                                                <p className="text-xs text-slate-400 font-semibold mt-1">Agregue estos {activosSeleccionados.length} activos al documento actual sin generar nuevos números.</p>

                                                <div className="mt-5 pt-4 border-t border-slate-50 flex flex-wrap items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <Printer size={14} className="text-blue-500" />
                                                        <span className="text-[10px] font-semibold uppercase text-slate-500">¿Qué desea imprimir luego?</span>
                                                    </div>
                                                    <div className="flex bg-slate-100 p-1 rounded-xl" onClick={e => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => setPrintMode('all')}
                                                            className={`px-4 py-2 rounded-lg text-[10px] font-semibold uppercase transition-all ${printMode === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >Todo el Acta</button>
                                                        <button
                                                            onClick={() => setPrintMode('latest')}
                                                            className={`px-4 py-2 rounded-lg text-[10px] font-semibold uppercase transition-all ${printMode === 'latest' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >Solo Adición</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                </div>

                                {/* OPCION NUEVA */}
                                <button
                                    onClick={() => handleConfirmAppend(false)}
                                    className="group w-full p-5 bg-slate-50 border-2 border-transparent hover:border-slate-200 rounded-3xl text-left transition-all active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-200 text-slate-500 group-hover:bg-slate-900 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
                                            <FilePlus size={24} />
                                        </div>
                                        <div>
                                            <p className="text-lg font-semibold text-slate-600 group-hover:text-slate-900 leading-tight">Generar Nueva Acta</p>
                                            <p className="text-xs text-slate-400 font-semibold mt-1">Crea un registro independiente con un nuevo folio correlativo.</p>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        <button onClick={() => setShowAppendModal(false)} className="w-full py-2 text-slate-400 text-xs font-semibold uppercase tracking-widest hover:text-slate-600 transition-colors">Cancelar y revisar selección</button>
                    </div>
                </Modal>

                <Modal isOpen={showNewAssetModal} onClose={() => setShowNewAssetModal(false)} title="Registrar Nuevo Activo" size="md">
                    <form onSubmit={handleCreateAsset} className="p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">Código Activo *</label>
                                <input required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={newAssetData.codigo_activo} onChange={e => setNewAssetData(p => ({ ...p, codigo_activo: e.target.value }))} />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">Descripción *</label>
                                <textarea required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={newAssetData.descripcion} onChange={e => setNewAssetData(p => ({ ...p, descripcion: e.target.value }))} />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">Estado</label>
                                <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={newAssetData.estado_actual} onChange={e => setNewAssetData(p => ({ ...p, estado_actual: e.target.value }))}>
                                    <option value="Disponible">Disponible</option>
                                    <option value="Asignado">Asignado</option>
                                    <option value="Mantenimiento">Mantenimiento</option>
                                </select>
                            </div>
                            <div className="col-span-2 space-y-3 pt-2 border-t border-slate-50">
                                <label className="text-[10px] font-semibold text-slate-900 uppercase tracking-widest block bg-slate-50 p-1.5 rounded-lg border border-slate-100 flex items-center gap-2">
                                    <Archive size={14} className="text-indigo-600" /> Clasificación Contable
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">Grupo Contable</label>
                                        <select
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                            value={newAssetData.cat_grupo_contable_id || ''}
                                            onChange={e => setNewAssetData(p => ({ ...p, cat_grupo_contable_id: e.target.value }))}
                                        >
                                            <option value="">— Sin Grupo —</option>
                                            {catalogos.grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 block">Auxiliar</label>
                                        <select
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                            value={newAssetData.cat_auxiliar_id || ''}
                                            onChange={e => setNewAssetData(p => ({ ...p, cat_auxiliar_id: e.target.value }))}
                                        >
                                            <option value="">— Sin Auxiliar —</option>
                                            {catalogos.auxiliares.map(ax => <option key={ax.id} value={ax.id}>{ax.nombre}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={() => setShowNewAssetModal(false)} className="px-4 py-2 text-slate-400 font-semibold">Cancelar</button>
                            <button type="submit" disabled={assetSaving} className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/20 disabled:opacity-50">
                                {assetSaving ? 'Guardando...' : 'Crear Activo'}
                            </button>
                        </div>
                    </form>
                </Modal>
            </div>
            <AppDialog {...dialogProps} />

            <QuickRegisterModal
                isOpen={quickReg.isOpen}
                onClose={() => setQuickReg(p => ({ ...p, isOpen: false }))}
                type={quickReg.type === 'ubicacion_user' ? 'ubicacion' : quickReg.type === 'unidad_user' ? 'unidad' : quickReg.type}
                initialName={quickReg.name}
                contextData={quickReg.context}
                catalogos={catalogos}
                onSave={async (tipo, data) => {
                    await handleQuickSave(tipo, data);
                    // Si el registro venía de DevolucionConReasignacion, necesitamos actualizar ese estado local también
                    // Pero handleQuickSave actualiza newAssetData. 
                    // Para DevolucionConReasignacion, es más complejo porque el estado está EN el componente hijo.
                    // Usaremos el evento global para que refresque catálogos y el usuario lo seleccione manualmente o 
                    // simplemente emitir el evento y que el hijo escuche.
                    // Para simplificar, handleQuickSave actualiza catalogos via fetchCatalogos().
                }}
            />
        </>
    );
};

export default GenerarActaView;
