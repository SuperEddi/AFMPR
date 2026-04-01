import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ClipboardCheck, User, Package, CheckCircle, AlertCircle, X, MapPin, ListFilter, AlertTriangle, CheckSquare, Download, FileText, Printer } from 'lucide-react';
import { AppDialog, useDialog } from '../components/AppDialog';

const ControlActivosView = ({ authFetch = fetch }) => {
    const [usuarios, setUsuarios] = useState([]);
    const [allActivos, setAllActivos] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userSearch, setUserSearch] = useState('');
    const [expectedActivos, setExpectedActivos] = useState([]);
    const [controlledActivos, setControlledActivos] = useState([]);
    const [surplusActivos, setSurplusActivos] = useState([]); // Sobrantes
    const [loading, setLoading] = useState(false);
    const [scanValue, setScanValue] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [activeListTab, setActiveListTab] = useState('pending'); // 'pending', 'found', 'surplus'
    const [printing, setPrinting] = useState(false);
    const { showAlert, dialogProps } = useDialog();

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [uRes, aRes] = await Promise.all([
                authFetch('/api/usuarios'),
                authFetch('/api/activos')
            ]);
            const [uData, aData] = await Promise.all([uRes.json(), aRes.json()]);
            setUsuarios(Array.isArray(uData) ? uData : []);
            setAllActivos(Array.isArray(aData) ? aData : []);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    }, [authFetch]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSelectUser = async (user) => {
        setSelectedUser(user);
        setLoading(true);
        try {
            // 1. Cargar auditorías previas
            const audRes = await authFetch(`/api/auditorias/usuario/${user.id}`);
            const audData = await audRes.json();

            // 2. Filtrar activos del usuario
            const userAssets = allActivos.filter(a =>
                a.usuario_actual_id === user.id ||
                (a.responsable && a.responsable.toLowerCase() === user.nombre_completo.toLowerCase())
            );

            setExpectedActivos(userAssets);

            // 3. Mapear hallazgos previos
            const prevFound = [];
            const prevSurplus = [];

            if (Array.isArray(audData)) {
                audData.forEach(aud => {
                    const asset = allActivos.find(a => a.id === aud.activo_id);
                    if (asset) {
                        if (aud.hallazgo === 'Correcto') prevFound.push(asset);
                        else {
                            // Si es ajeno, necesitamos saber de quién era durante el escaneo
                            // (En esta versión simplificada usamos los datos actuales del activo)
                            if (aud.hallazgo === 'Ajeno') {
                                const resp = asset.responsable || 'Otro';
                                prevSurplus.push({ ...asset, warning: true, otherResp: resp });
                            } else {
                                prevSurplus.push(asset);
                            }
                        }
                    }
                });
            }

            setControlledActivos(prevFound);
            setSurplusActivos(prevSurplus);

        } catch (err) {
            console.error(err);
        }
        setLoading(false);
        setUserSearch('');
        setActiveListTab('pending');
    };

    const handleScanChange = (val) => {
        setScanValue(val);
        if (val.trim().length > 1) {
            const matches = allActivos.filter(a =>
                a.codigo_activo.toUpperCase().includes(val.trim().toUpperCase()) ||
                a.descripcion.toUpperCase().includes(val.trim().toUpperCase())
            ).slice(0, 5); // Limitar a 5 sugerencias para no saturar
            setSuggestions(matches);
        } else {
            setSuggestions([]);
        }
    };

    const handleScan = async (overrideCode) => {
        const code = (overrideCode || scanValue).trim().toUpperCase();
        if (!code) return;
        setScanValue('');
        setSuggestions([]);

        // 1. Ya controlado
        if (controlledActivos.find(a => a.codigo_activo === code) || surplusActivos.find(a => a.codigo_activo === code)) {
            await showAlert(`El activo ${code} ya ha sido validado.`, { title: 'Ya controlado', type: 'info' });
            return;
        }

        // 2. ¿Está en la lista esperada?
        const inExpected = expectedActivos.find(a => a.codigo_activo === code);
        if (inExpected) {
            try {
                await authFetch('/api/auditorias', {
                    method: 'POST',
                    body: JSON.stringify({
                        usuario_auditado_id: selectedUser.id,
                        activo_id: inExpected.id,
                        hallazgo: 'Correcto'
                    })
                });
                setControlledActivos(prev => [inExpected, ...prev]);
            } catch (err) {
                await showAlert('Error al guardar la validación en el servidor.', { title: 'Error de Persistencia', type: 'error' });
            }
            return;
        }

        // 3. Si no está en su lista, buscar en el sistema completo
        const foundElsewhere = allActivos.find(a => a.codigo_activo === code);

        if (foundElsewhere) {
            const isAssignedToOther = foundElsewhere.estado_actual === 'Asignado' &&
                foundElsewhere.responsable &&
                foundElsewhere.responsable.toLowerCase() !== selectedUser.nombre_completo.toLowerCase();

            const hallazgo = isAssignedToOther ? 'Ajeno' : 'Sobrante';

            try {
                const confirmed = await showConfirm(
                    isAssignedToOther
                        ? `El activo "${foundElsewhere.descripcion || 'Sin descripción'}" (${code}) está en la ubicación "${foundElsewhere.oficina || 'N/A'}" con el responsable "${foundElsewhere.responsable || 'Otro'}". ¿Deseas registrarlo como AJENO?`
                        : `Activo "${foundElsewhere.descripcion}" detectado como SOBRANTE (no asignado a este funcionario). ¿Deseas registrarlo?`,
                    {
                        title: isAssignedToOther ? '¡Activo de otro responsable!' : 'Activo Sobrante',
                        type: isAssignedToOther ? 'warning' : 'info',
                        confirmText: 'Aceptar'
                    }
                );

                if (!confirmed) return;

                await authFetch('/api/auditorias', {
                    method: 'POST',
                    body: JSON.stringify({
                        usuario_auditado_id: selectedUser.id,
                        activo_id: foundElsewhere.id,
                        hallazgo: hallazgo
                    })
                });

                if (isAssignedToOther) {
                    setSurplusActivos(prev => [{ ...foundElsewhere, warning: true, otherResp: foundElsewhere.responsable || 'Otro' }, ...prev]);
                } else {
                    setSurplusActivos(prev => [foundElsewhere, ...prev]);
                }
            } catch (err) {
                await showAlert('Error al guardar la validación.', { title: 'Error de Persistencia', type: 'error' });
            }
        } else {
            await showAlert(`El código "${code}" no existe en el inventario global.`, { title: 'Código no encontrado', type: 'error' });
        }
    };

    const handleResetAudit = async () => {
        if (!selectedUser) return;
        const confirm = await showConfirm(`¿Estás seguro de reiniciar la auditoría de ${selectedUser.nombre_completo}? Se borrarán todos los escaneos guardados para este funcionario.`, { title: 'Reinicio Completo', type: 'danger', confirmText: 'Reiniciar Todo' });
        if (!confirm) return;

        try {
            await authFetch(`/api/auditorias/usuario/${selectedUser.id}`, { method: 'DELETE' });
            setControlledActivos([]);
            setSurplusActivos([]);
            await showAlert('La auditoría ha sido reiniciada.', { title: 'Reinicio Completo', type: 'info' });
        } catch (err) {
            await showAlert('Error al reiniciar la auditoría.', { title: 'Error', type: 'error' });
        }
    };

    const handleDeleteAuditItem = async (activoId, from) => {
        if (!selectedUser) return;
        try {
            await authFetch(`/api/auditorias/usuario/${selectedUser.id}/activo/${activoId}`, { method: 'DELETE' });
            if (from === 'found') {
                setControlledActivos(prev => prev.filter(a => a.id !== activoId));
            } else {
                setSurplusActivos(prev => prev.filter(a => a.id !== activoId));
            }
        } catch (err) {
            await showAlert('Error al eliminar el ítem de la auditoría.', { title: 'Error', type: 'error' });
        }
    };

    const exportToExcel = () => {
        if (!selectedUser) return;

        const headers = ['ESTADO AUDITORIA', 'CODIGO ACTIVO', 'DESCRIPCION', 'SERIE', 'ESTADO SISTEMA', 'RESPONSABLE ACTUAL SI ES AJENO'];
        const rows = [];

        // Encontrados
        controlledActivos.forEach(a => {
            rows.push(['ENCONTRADO (OK)', a.codigo_activo, a.descripcion, a.serie || '', a.estado_actual, '']);
        });

        // Faltantes
        const pending = expectedActivos.filter(a => !controlledActivos.some(c => c.id === a.id));
        pending.forEach(a => {
            rows.push(['FALTANTE', a.codigo_activo, a.descripcion, a.serie || '', a.estado_actual, '']);
        });

        // Sobrantes
        surplusActivos.forEach(a => {
            rows.push([a.warning ? 'SOBRANTE (AJENO)' : 'SOBRANTE', a.codigo_activo, a.descripcion, a.serie || '', a.estado_actual, a.otherResp || '']);
        });

        const csvContent = [headers.join('|'), ...rows.map(r => r.join('|'))].join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Auditoria_${selectedUser.nombre_completo.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handlePrintPDF = async () => {
        if (!selectedUser) return;
        setPrinting(true);
        try {
            const { default: jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');

            // Habilitar compresión en jsPDF
            const doc = new jsPDF({
                unit: 'mm',
                format: 'letter',
                orientation: 'portrait',
                compress: true
            });
            const PW = 215.9, PH = 279.4;
            const ML = 20, MR = 20, MT = 48, MB = 22;
            const contentW = PW - ML - MR;

            // ─── MEMBRETADO / LOGO OPTIMIZADO ──────────────────────────────────
            try {
                const img = new Image();
                img.src = `${window.location.origin}/logo.png`;
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });

                // Redimensionar logo para que no pese tanto en el PDF
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const targetW = 400; // Suficiente para impresión nítida pero ligero
                const targetH = (img.height * targetW) / img.width;
                canvas.width = targetW;
                canvas.height = targetH;
                ctx.drawImage(img, 0, 0, targetW, targetH);

                const logoDataUrl = canvas.toDataURL('image/jpeg', 0.8); // JPEG con compresión 0.8
                doc.addImage(logoDataUrl, 'JPEG', ML, 8, 45, (45 * targetH) / targetW);
            } catch { /* sin logo */ }

            doc.setDrawColor(197, 160, 89); doc.setLineWidth(0.6);
            doc.line(ML, 40, PW - MR, 40);

            // ─── FOOTER ──────────────────────────────────────────
            const totalPages = () => doc.internal.getNumberOfPages();
            const drawFooter = (d) => {
                const total = totalPages();
                for (let i = 1; i <= total; i++) {
                    d.setPage(i);
                    d.setFillColor(218, 41, 28); d.rect(ML, PH - 18, 25, 1.5, 'F');
                    d.setFillColor(244, 228, 0); d.rect(ML + 25, PH - 18, 25, 1.5, 'F');
                    d.setFillColor(0, 122, 51); d.rect(ML + 50, PH - 18, 25, 1.5, 'F');
                    d.setFontSize(8); d.setFont('helvetica', 'bold'); d.setTextColor(0, 0, 0);
                    d.text('MINISTERIO DE LA PRESIDENCIA', PW - MR, PH - 20, { align: 'right' });
                    d.text(`Pág. ${i} / ${total}`, PW / 2, PH - 8, { align: 'center' });
                }
            };

            let y = MT;

            // ─── TÍTULO ──────────────────────────────────────────
            doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(0, 0, 0);
            doc.text(`INFORME DE AUDITORÍA FÍSICA DE ACTIVOS`, PW / 2, y, { align: 'center' });
            y += 8;

            // ─── DATOS FUNCIONARIO ────────────────────────────────
            autoTable(doc, {
                startY: y, margin: { left: ML, right: MR }, tableWidth: contentW,
                body: [
                    ['FECHA:', new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })],
                    ['RESPONSABLE:', selectedUser.nombre_completo.toUpperCase()],
                    ['CI / CARGO:', `${selectedUser.ci} – ${selectedUser.cargo || 'N/A'}`],
                    ['UBICACIÓN:', `${selectedUser.unidad || 'N/A'} / ${selectedUser.oficina || 'N/A'}`],
                ],
                theme: 'plain',
                styles: { font: 'helvetica', fontSize: 10, cellPadding: 1.2, textColor: [0, 0, 0] },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } },
            });
            y = doc.lastAutoTable.finalY + 6;

            // ─── RESUMEN ESTADÍSTICO ──────────────────────────────
            const pending = expectedActivos.filter(a => !controlledActivos.some(c => c.id === a.id));
            doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
            doc.text('RESUMEN DE AUDITORÍA:', ML, y);
            y += 5;
            doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
            doc.text(`- Activos Correctos: ${controlledActivos.length}`, ML + 5, y); y += 4;
            doc.text(`- Activos Faltantes: ${pending.length}`, ML + 5, y); y += 4;
            doc.text(`- Activos Sobrantes/Ajenos: ${surplusActivos.length}`, ML + 5, y); y += 6;

            // ─── TABLA 1: ENCONTRADOS ────────────────────────────────
            if (controlledActivos.length > 0) {
                doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(0, 100, 0);
                doc.text('ACTIVOS ENCONTRADOS (CORRECTOS):', ML, y);
                autoTable(doc, {
                    startY: y + 2, margin: { left: ML, right: MR }, tableWidth: contentW,
                    head: [['CÓDIGO', 'DESCRIPCIÓN', 'ESTADO SISTEMA']],
                    body: controlledActivos.map(a => [a.codigo_activo, a.descripcion, a.estado_actual]),
                    theme: 'grid',
                    headStyles: { fillColor: [240, 250, 240], textColor: [0, 80, 0], fontSize: 8 },
                    bodyStyles: { fontSize: 7, textColor: [0, 0, 0] },
                });
                y = doc.lastAutoTable.finalY + 6;
            }

            // ─── TABLA 2: FALTANTES ─────────────────────────────────
            if (pending.length > 0) {
                if (y > PH - 40) { doc.addPage(); y = MT; }
                doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(180, 0, 0);
                doc.text('ACTIVOS FALTANTES (NO DETECTADOS):', ML, y);
                autoTable(doc, {
                    startY: y + 2, margin: { left: ML, right: MR }, tableWidth: contentW,
                    head: [['CÓDIGO', 'DESCRIPCIÓN', 'OBSERVACIÓN']],
                    body: pending.map(a => [a.codigo_activo, a.descripcion, 'NO LOCALIZADO']),
                    theme: 'grid',
                    headStyles: { fillColor: [255, 240, 240], textColor: [150, 0, 0], fontSize: 8 },
                    bodyStyles: { fontSize: 7, textColor: [0, 0, 0] },
                });
                y = doc.lastAutoTable.finalY + 6;
            }

            // ─── TABLA 3: SOBRANTES ─────────────────────────────────
            if (surplusActivos.length > 0) {
                if (y > PH - 40) { doc.addPage(); y = MT; }
                doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(0, 0, 150);
                doc.text('ACTIVOS SOBRANTES O AJENOS DETECTADOS:', ML, y);
                autoTable(doc, {
                    startY: y + 2, margin: { left: ML, right: MR }, tableWidth: contentW,
                    head: [['CÓDIGO', 'DESCRIPCIÓN', 'RESPONSABLE ACTUAL / ESTADO']],
                    body: surplusActivos.map(a => [
                        a.codigo_activo,
                        a.descripcion,
                        a.warning ? `AJENO: ${a.otherResp || 'Otro'}` : (a.estado_actual || 'Disponible')
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [240, 240, 255], textColor: [0, 0, 120], fontSize: 8 },
                    bodyStyles: { fontSize: 7, textColor: [0, 0, 0] },
                });
                y = doc.lastAutoTable.finalY + 6;
            }

            // ─── FIRMAS ───────────────────────────────────────────
            if (y + 30 > PH - MB) { doc.addPage(); y = MT + 5; } else { y += 10; }
            const firmaY = y + 20;
            const col1X = ML + 5, col2X = ML + contentW - 55;
            doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
            doc.line(col1X, firmaY, col1X + 50, firmaY);
            doc.line(col2X, firmaY, col2X + 50, firmaY);
            doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
            doc.text('REALIZADO POR', col1X + 25, firmaY + 5, { align: 'center' });
            doc.text('V° B° RESPONSABLE', col2X + 25, firmaY + 5, { align: 'center' });

            drawFooter(doc);
            doc.save(`Auditoria_${selectedUser.nombre_completo.trim().replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);

        } catch (e) {
            console.error(e);
            await showAlert('Error al generar el PDF del reporte.', { title: 'Error', type: 'error' });
        } finally {
            setPrinting(false);
        }
    };

    const filteredUsers = usuarios.filter(u =>
        u.nombre_completo.toLowerCase().includes(userSearch.toLowerCase()) ||
        String(u.ci).includes(userSearch)
    );

    const pendingActivos = expectedActivos
        .filter(a => !controlledActivos.some(c => c.id === a.id))
        .filter(a => !scanValue || a.codigo_activo.toUpperCase().includes(scanValue.trim().toUpperCase()));

    const filteredFound = controlledActivos.filter(a =>
        !scanValue || a.codigo_activo.toUpperCase().includes(scanValue.trim().toUpperCase())
    );

    const filteredSurplus = surplusActivos.filter(a =>
        !scanValue || a.codigo_activo.toUpperCase().includes(scanValue.trim().toUpperCase())
    );

    return (
        <div className="space-y-4">
            <header className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                        <ClipboardCheck size={20} />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-slate-900 leading-tight">Control de Activos por Funcionario</h2>
                        <p className="text-slate-400 text-xs font-medium">Auditoría, Sobrantes y Faltantes</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {selectedUser && (
                        <>
                            <button onClick={exportToExcel} className="p-2.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-tight">
                                <Download size={16} /> Excel
                            </button>
                            <button disabled={printing} onClick={handlePrintPDF} className="p-2.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl hover:bg-rose-100 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-tight disabled:opacity-50">
                                <FileText size={16} /> {printing ? 'Generando...' : 'Reporte PDF'}
                            </button>
                            <div className="w-px h-8 bg-slate-100 mx-1" />
                            <button onClick={handleResetAudit} className="p-2.5 bg-slate-50 text-slate-400 border border-slate-200 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-tight">
                                <X size={16} /> Reiniciar
                            </button>
                            <button
                                onClick={() => { setSelectedUser(null); setExpectedActivos([]); setControlledActivos([]); setSurplusActivos([]); }}
                                className="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 transition-all active:scale-95"
                            >
                                <X size={14} /> Cambiar
                            </button>
                        </>
                    )}
                </div>
            </header>

            {!selectedUser ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-2xl mx-auto">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-indigo-100">
                            <User size={32} />
                        </div>
                        <h3 className="text-lg font-black text-slate-800">Seleccionar Funcionario</h3>
                        <p className="text-slate-500 text-sm">Busca al responsable que deseas auditar</p>
                    </div>

                    <div className="relative mb-4">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o CI..."
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                            value={userSearch}
                            onChange={e => setUserSearch(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                        {loading && <div className="py-10 text-center text-slate-400 animate-pulse">Cargando base de datos...</div>}
                        {userSearch.length > 0 && filteredUsers.map(u => (
                            <button
                                key={u.id}
                                onClick={() => handleSelectUser(u)}
                                className="w-full p-3.5 flex items-center gap-4 hover:bg-indigo-50 rounded-2xl transition-all border border-transparent hover:border-indigo-100 group text-left"
                            >
                                <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center font-black group-hover:bg-white transition-colors uppercase">
                                    {u.nombre_completo.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-slate-800 text-sm truncate uppercase tracking-tight">{u.nombre_completo}</div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{u.cargo} · CI: {u.ci}</div>
                                </div>
                                <div className="p-2 bg-slate-50 rounded-lg text-slate-300 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-all shadow-sm">
                                    <CheckCircle size={16} />
                                </div>
                            </button>
                        ))}
                        {userSearch.length > 0 && filteredUsers.length === 0 && (
                            <div className="py-8 text-center text-slate-400 text-sm font-medium italic">No se encontraron resultados</div>
                        )}
                        {!loading && userSearch.length === 0 && (
                            <div className="py-8 text-center text-slate-300 text-[10px] font-black uppercase tracking-[0.2em]">Escribe para buscar funcionarios</div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Panel Izquierdo: Datos y Escaneo */}
                    <div className="lg:col-span-4 space-y-5">
                        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-lg shadow-lg shadow-indigo-500/20">
                                    {selectedUser.nombre_completo.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-black text-slate-900 text-xs leading-tight truncate uppercase tracking-tight">{selectedUser.nombre_completo}</h3>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">CI: {selectedUser.ci} · {selectedUser.cargo}</p>
                                </div>
                            </div>

                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3 mb-5">
                                <MapPin size={16} className="text-indigo-400" />
                                <div className="min-w-0">
                                    <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">Ubicación Actual</p>
                                    <p className="text-[10px] font-black text-slate-700 truncate uppercase">
                                        {selectedUser.unidad || 'Sin unidad'} · {selectedUser.oficina || 'Sin oficina'}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">
                                    <span>Escaneo / Validación</span>
                                    <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse delay-75"></div>
                                    </div>
                                </label>

                                <div className="relative">
                                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-950/80 rounded-xl border border-slate-800 focus-within:border-blue-500/50 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all group">
                                        <Package className="text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                                        <input
                                            autoFocus
                                            type="text"
                                            value={scanValue}
                                            onChange={(e) => handleScanChange(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                                            placeholder="Escanea o digita el código..."
                                            className="bg-transparent border-none outline-none text-white placeholder:text-slate-600 w-full font-medium"
                                        />
                                    </div>

                                    {/* Sugerencias de la Base General */}
                                    {suggestions.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                                            <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-700/50 flex justify-between items-center">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sugerencias Base General</span>
                                                <span className="text-[9px] text-slate-500 uppercase">{suggestions.length} resultados</span>
                                            </div>
                                            <div className="max-h-60 overflow-y-auto">
                                                {suggestions.map(s => (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => handleScan(s.codigo_activo)}
                                                        className="w-full p-3 text-left hover:bg-blue-500/10 border-b border-slate-800/50 last:border-none transition-colors group flex items-center gap-3"
                                                    >
                                                        <div className="p-2 bg-slate-800 rounded-lg group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
                                                            <Search size={14} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs font-bold text-slate-200 group-hover:text-blue-300 transition-colors uppercase">{s.codigo_activo}</div>
                                                            <div className="text-[10px] text-slate-500 truncate lowercase">{s.descripcion}</div>
                                                            <div className="text-[9px] text-slate-600 italic">Resp: {s.responsable || 'Sin asignar'}</div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => handleScan()}
                                    className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    Validar Activo
                                </button>
                            </div>
                        </section>

                        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Resumen Auditoría</h4>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl text-center cursor-pointer hover:bg-emerald-100/50 transition-colors" onClick={() => setActiveListTab('found')}>
                                    <p className="text-[9px] font-black text-emerald-600 uppercase mb-1">Correctos</p>
                                    <p className="text-2xl font-black text-emerald-700">{controlledActivos.length}</p>
                                </div>
                                <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl text-center cursor-pointer hover:bg-rose-100/50 transition-colors" onClick={() => setActiveListTab('pending')}>
                                    <p className="text-[9px] font-black text-rose-600 uppercase mb-1">Faltantes</p>
                                    <p className="text-2xl font-black text-rose-700">{pendingActivos.length}</p>
                                </div>
                            </div>
                            <div className={`p-3.5 rounded-2xl text-center border transition-colors cursor-pointer ${surplusActivos.length > 0 ? 'bg-amber-50 border-amber-200 hover:bg-amber-100/50' : 'bg-slate-50 border-slate-100'}`} onClick={() => setActiveListTab('surplus')}>
                                <p className={`text-[9px] font-black uppercase mb-1 ${surplusActivos.length > 0 ? 'text-amber-600' : 'text-slate-400'}`}>Sobrantes / Otros</p>
                                <p className={`text-2xl font-black ${surplusActivos.length > 0 ? 'text-amber-700' : 'text-slate-300'}`}>{surplusActivos.length}</p>
                            </div>
                        </section>
                    </div>

                    {/* Panel Derecho: Listas Categorizadas */}
                    <div className="lg:col-span-8 flex flex-col h-[calc(100vh-14rem)] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">

                        {/* Tabs Navegación */}
                        <div className="flex border-b border-slate-100 bg-slate-50/50 p-2 gap-1 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => setActiveListTab('pending')}
                                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all ${activeListTab === 'pending' ? 'bg-white shadow text-rose-600 border border-rose-100' : 'text-slate-400 hover:bg-white hover:text-slate-600'}`}
                            >
                                <ListFilter size={14} /> Faltantes ({pendingActivos.length})
                            </button>
                            <button
                                onClick={() => setActiveListTab('found')}
                                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all ${activeListTab === 'found' ? 'bg-white shadow text-emerald-600 border border-emerald-100' : 'text-slate-400 hover:bg-white hover:text-slate-600'}`}
                            >
                                <CheckSquare size={14} /> Encontrados ({controlledActivos.length})
                            </button>
                            <button
                                onClick={() => setActiveListTab('surplus')}
                                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all ${activeListTab === 'surplus' ? 'bg-white shadow text-amber-600 border border-amber-100' : 'text-slate-400 hover:bg-white hover:text-slate-600'}`}
                            >
                                <AlertTriangle size={14} /> Sobrantes ({surplusActivos.length})
                            </button>
                        </div>

                        {/* Contenido de la lista */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {activeListTab === 'pending' && (
                                <div className="divide-y divide-slate-50">
                                    {pendingActivos.length === 0 ? (
                                        <div className="py-20 text-center">
                                            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <CheckCircle size={32} />
                                            </div>
                                            <p className="text-slate-400 text-sm font-bold uppercase tracking-tight">¡Auditoría completa!</p>
                                            <p className="text-slate-300 text-xs">No hay activos faltantes en el sistema.</p>
                                        </div>
                                    ) : pendingActivos.map(a => (
                                        <div key={a.id} className="p-4 flex items-center gap-4 hover:bg-slate-50">
                                            <div className="p-2.5 bg-slate-100 text-slate-400 rounded-xl">
                                                <Package size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-mono font-black text-xs text-rose-600 uppercase">{a.codigo_activo}</div>
                                                <div className="text-[10px] text-slate-500 font-medium truncate max-w-lg">{a.descripcion}</div>
                                                {a.oficina && <div className="text-[9px] text-slate-400 font-bold mt-0.5">📍 {a.oficina}</div>}
                                            </div>
                                            <div className="px-2 py-1 bg-rose-50 border border-rose-100 rounded text-[9px] font-black text-rose-500 uppercase tracking-tighter">Faltante</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeListTab === 'found' && (
                                <div className="divide-y divide-slate-50">
                                    {filteredFound.length === 0 ? (
                                        <div className="py-10 text-center text-slate-300 text-[10px] font-black uppercase italic tracking-widest py-20">No hay coincidencias en validados</div>
                                    ) : filteredFound.map(a => (
                                        <div key={a.id} className="p-4 flex items-center gap-4 bg-emerald-50/30">
                                            <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl">
                                                <CheckSquare size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-mono font-black text-xs text-emerald-700 uppercase">{a.codigo_activo}</div>
                                                <div className="text-[10px] text-emerald-600/70 font-medium truncate max-w-lg">{a.descripcion}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="px-2 py-1 bg-emerald-100 border border-emerald-200 rounded text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Correcto</div>
                                                <button onClick={() => handleDeleteAuditItem(a.id, 'found')} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeListTab === 'surplus' && (
                                <div className="divide-y divide-slate-50">
                                    {filteredSurplus.length === 0 ? (
                                        <div className="py-10 text-center text-slate-300 text-[10px] font-black uppercase italic tracking-widest py-20">No hay coincidencias en sobrantes</div>
                                    ) : filteredSurplus.map(a => (
                                        <div key={a.id} className={`p-4 flex items-center gap-4 ${a.warning ? 'bg-amber-50' : 'bg-blue-50/50'}`}>
                                            <div className={`p-2.5 rounded-xl ${a.warning ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                                {a.warning ? <AlertTriangle size={18} /> : <Package size={18} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-mono font-black text-xs uppercase ${a.warning ? 'text-amber-700' : 'text-blue-700'}`}>{a.codigo_activo}</div>
                                                <div className={`text-[10px] font-medium truncate max-w-lg ${a.warning ? 'text-amber-600' : 'text-blue-600'}`}>{a.descripcion}</div>
                                                {a.warning && (
                                                    <div className="text-[9px] font-black text-rose-500 mt-1 uppercase flex items-center gap-1">
                                                        <AlertCircle size={10} /> Asignado a: {a.otherResp}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className={`px-2 py-1 border rounded text-[9px] font-black uppercase tracking-tighter ${a.warning ? 'bg-rose-100 border-rose-200 text-rose-600' : 'bg-blue-100 border-blue-200 text-blue-600'}`}>
                                                    {a.warning ? '¡Ajeno!' : 'Sobrante'}
                                                </div>
                                                <button onClick={() => handleDeleteAuditItem(a.id, 'surplus')} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <AppDialog {...dialogProps} />
        </div>
    );
};

export default ControlActivosView;
