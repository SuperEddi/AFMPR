import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { History, User, Calendar, FileText, Printer, Search, RefreshCw, ChevronDown, ChevronUp, MapPin, Package, AlertCircle, ClipboardPlus, Undo2, PenLine, Trash2, Pencil, CheckCircle, Hash, Briefcase, Building2 } from 'lucide-react';
import { AppDialog, useDialog } from '../components/AppDialog';

const getInstitutionStyle = (inst) => {
    const i = (inst || '').toUpperCase();
    if (i === 'TIERRAS') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (i === 'JUSTICIA') return 'bg-amber-50 text-amber-600 border-amber-100';
    return 'bg-blue-50 text-blue-600 border-blue-100';
};

const HistorialActasView = ({ authFetch = fetch }) => {
    const [agrupados, setAgrupados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [printing, setPrinting] = useState(null);
    const [filter, setFilter] = useState('');
    const [expandedCI, setExpandedCI] = useState(null);
    const [expandedKey, setExpandedKey] = useState(null);
    const [actas, setActas] = useState([]);
    const [loadingActas, setLoadingActas] = useState(false);
    const [expandedHistoryCI, setExpandedHistoryCI] = useState(null);
    const [updatingState, setUpdatingState] = useState(null); // { actaId, activoId }
    const [selectedCI, setSelectedCI] = useState(null); // CI de la persona seleccionada
    const [selectedUbicKey, setSelectedUbicKey] = useState(null); // Key de la ubicación (unidad|oficina|piso)
    const [editingAssetId, setEditingAssetId] = useState(null); // id del activo en edición
    const [selectedAssets, setSelectedAssets] = useState([]); // IDs de activos seleccionados para reimprimir
    const [assetFilter, setAssetFilter] = useState(''); // Filtro de búsqueda interno
    const [liberandoActivo, setLiberandoActivo] = useState(null); // id del activo siendo liberado
    const [editingAsset, setEditingAsset] = useState(null); // objeto completo del activo en edición
    const [savingAsset, setSavingAsset] = useState(false);
    const { dialog, showAlert, showConfirm, dialogProps } = useDialog();

    // Derivamos la ubicación seleccionada de los datos actuales (Sincronización Automática)
    const activeViewData = useMemo(() => {
        if (!selectedCI || !selectedUbicKey) return null;
        const persona = agrupados.find(p => p.ci === selectedCI);
        if (!persona) return null;
        const ubicacion = persona.ubicaciones.find(u => `${u.unidad || ''}|${u.oficina || ''}|${u.piso || ''}|${u.acta_id || ''}` === selectedUbicKey);
        return { persona, ubicacion };
    }, [agrupados, selectedCI, selectedUbicKey]);

    const handleUpdateEstado = async (actaId, activoId, nuevoEstado) => {
        setUpdatingState(`${actaId}-${activoId}`);
        try {
            const res = await authFetch('/api/detalles_acta/estado', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ acta_id: actaId, activo_id: activoId, estado_fisico: nuevoEstado })
            });
            if (res.ok) {
                await fetchHistorial(true);
                await fetchActas();
            } else {
                const errorData = await res.json().catch(() => ({}));
                await showAlert(`No se pudo actualizar el estado. ${errorData.error || ''}`.trim(), { title: 'Error', type: 'error' });
            }
        } catch { } finally { setUpdatingState(null); }
    };

    const handleSaveEditAsset = async (e) => {
        e.preventDefault();
        setSavingAsset(true);
        try {
            const assetId = editingAsset.id;
            const actaId = editingAsset.last_acta_id;

            // 1. Update Asset Details (Description)
            const resAsset = await authFetch(`/api/activos/${assetId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    descripcion: editingAsset.descripcion,
                    estado_actual: editingAsset.estado_actual || 'Asignado'
                })
            });

            // 2. Update Physical Status in the Acta
            const resStatus = await authFetch('/api/detalles_acta/estado', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    acta_id: actaId,
                    activo_id: assetId,
                    estado_fisico: editingAsset.estado_fisico
                })
            });

            if (resAsset.ok && resStatus.ok) {
                await fetchHistorial(true);
                await fetchActas();
                setEditingAsset(null);
                await showAlert('Los cambios se guardaron correctamente.', { title: 'Éxito', type: 'success' });
            } else {
                await showAlert('Error al guardar algunos cambios.', { title: 'Error', type: 'error' });
            }
        } catch (err) {
            await showAlert('Error de red al guardar los cambios.', { title: 'Error de red', type: 'error' });
        } finally {
            setSavingAsset(false);
        }
    };

    const handleLiberarActivo = async (activo) => {
        const confirmed = await showConfirm(
            `El activo "${activo.codigo_activo}" será desvinculado del responsable y retornará como DISPONIBLE.`,
            { title: '¿Liberar activo?', type: 'danger', confirmText: 'Liberar' }
        );
        if (!confirmed) return;
        setLiberandoActivo(activo.id);
        try {
            const res = await authFetch(`/api/activos/${activo.id}/liberar`, { method: 'PUT' });
            if (res.ok) {
                await fetchHistorial(true);
                // Si el grupo queda vacío tras liberar, volver a la lista
                window.dispatchEvent(new CustomEvent('data-updated'));
            } else {
                const err = await res.json().catch(() => ({}));
                await showAlert(err.error || 'No se pudo liberar el activo.', { title: 'Error', type: 'error' });
            }
        } catch {
            await showAlert('Error de conexión al liberar el activo.', { title: 'Error de red', type: 'error' });
        } finally {
            setLiberandoActivo(null);
        }
    };

    const fetchHistorial = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await authFetch('/api/activos/agrupados');
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status} `);
            const data = await res.json();
            setAgrupados(data);
        } catch (err) {

        } finally { if (!silent) setLoading(false); }
    }, [authFetch]);

    const fetchActas = useCallback(async () => {
        setLoadingActas(true);
        try {
            const res = await authFetch('/api/actas');
            const data = await res.json();
            setActas(Array.isArray(data) ? data : []);
        } catch (err) {

        } finally { setLoadingActas(false); }
    }, [authFetch]);

    useEffect(() => {
        fetchHistorial();
        fetchActas();
    }, [fetchHistorial, fetchActas]);

    useEffect(() => {
        const handler = () => {
            fetchHistorial(true);
            fetchActas();
        };
        window.addEventListener('data-updated', handler);
        return () => window.removeEventListener('data-updated', handler);
    }, [fetchHistorial, fetchActas]);

    const handlePrintConsolidado = async (persona, ubicacion, specificActivos = null) => {
        const activosParaImprimir = specificActivos || ubicacion.activos || [];
        if (activosParaImprimir.length === 0) {
            await showAlert('No hay activos seleccionados para imprimir.', { title: 'Sin activos', type: 'info' });
            return;
        }

        const printId = `consolidado-${persona.ci}-${Date.now()}`;
        setPrinting(printId);
        try {
            const { default: jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');

            const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
            const PW = 215.9, PH = 279.4;
            const ML = 20, MR = 20, MT = 48, MB = 22;
            const contentW = PW - ML - MR;

            // ─── LOGO ──────────────────────────────────────────
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
                }
            };

            const fechaStr = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
            let y = MT;
            doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
            doc.text(`ACTA DE ASIGNACIÓN DE ACTIVOS FIJOS`, PW / 2, y, { align: 'center' });
            y += 8;

            autoTable(doc, {
                startY: y, margin: { left: ML, right: MR, bottom: MB },
                body: [
                    ['FECHA:', fechaStr],
                    ['RESPONSABLE:', persona.nombre_completo.toUpperCase()],
                    ['CI / CARGO:', `${persona.ci} – ${persona.cargo}`],
                    ['UBICACIÓN:', `${ubicacion.unidad} / ${ubicacion.oficina} (Piso: ${ubicacion.piso})`],
                ],
                theme: 'plain',
                styles: { font: 'helvetica', fontSize: 11, cellPadding: 1.5 },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
            });
            y = doc.lastAutoTable.finalY + 6;

            autoTable(doc, {
                startY: y, margin: { left: ML, right: MR, bottom: MB },
                head: [['CÓDIGO ACTIVO', 'DESCRIPCIÓN / DETALLE DEL BIEN', 'ESTADO']],
                body: activosParaImprimir.map(a => [
                    a.codigo_activo || '',
                    a.descripcion || '',
                    (a.estado_fisico || 'BUENO').toUpperCase()
                ]),
                theme: 'grid',
                headStyles: { fillColor: [241, 241, 241], textColor: [0, 0, 0], font: 'helvetica', fontStyle: 'bold', fontSize: 10 },
                bodyStyles: { font: 'helvetica', fontSize: 8 },
                columnStyles: { 0: { cellWidth: 40 }, 2: { cellWidth: 25, halign: 'center' } },
            });
            y = doc.lastAutoTable.finalY + 6;

            // Observaciones
            if (ubicacion.observaciones) {
                doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setDrawColor(180, 180, 180);
                const obsLines = doc.splitTextToSize(`OBSERVACIONES: ${ubicacion.observaciones}`, contentW - 8);
                doc.rect(ML, y, contentW, obsLines.length * 4.5 + 4);
                doc.text(obsLines, ML + 4, y + 5);
                y += obsLines.length * 4.5 + 8;
            }

            // Nota Legal
            doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
            doc.setDrawColor(197, 160, 89); doc.setLineWidth(1);
            doc.line(ML, y, ML, y + 14); doc.setLineWidth(0.2);
            const nota = 'NOTA: En cumplimiento a los Art. 141, 146, 147, 154, 159 y 157 del D.S. 0181 y Ley 1178, se procede con el acto. El custodio no podrá efectuar préstamos o transferencias por cuenta propia.';
            const notaLines = doc.splitTextToSize(nota, contentW - 5);
            doc.text(notaLines, ML + 4, y + 4);
            y += notaLines.length * 4 + 12;

            // Firmas
            if (y + 20 > PH - MB) { doc.addPage(); y = MT + 10; } else { y += 6; }
            const col1X = ML + 5, col2X = ML + contentW - 55;
            doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
            doc.line(col1X, y + 15, col1X + 50, y + 15);
            doc.line(col2X, y + 15, col2X + 50, y + 15);
            doc.setFontSize(8); doc.text('ENTREGUÉ CONFORME', col1X + 25, y + 19, { align: 'center' });
            doc.text('RECIBÍ CONFORME', col2X + 25, y + 19, { align: 'center' });

            drawFooter(doc);
            const safeNombre = persona.nombre_completo.trim().replace(/\s+/g, '_');
            doc.save(`Acta_Consolidada_${safeNombre}_${persona.ci}.pdf`);
        } catch (e) {

        } finally {
            setPrinting(null);
        }
    };

    const handlePrintIndividual = async (id, inst) => {
        setPrinting(id);
        try {
            const { default: jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');

            const headers = inst ? { 'x-target-institution': inst } : {};
            const dataRes = await authFetch(`/api/actas/${id}`, { headers }).then(r => r.json());

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
                    ['UBICACIÓN:', `${unidad} / ${oficina} (Piso: ${piso})`],
                ],
                theme: 'plain',
                styles: { font: 'helvetica', fontSize: 11, cellPadding: 1.5, textColor: [0, 0, 0] },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
            });
            y = doc.lastAutoTable.finalY + 6;

            // ─── TABLA DE ACTIVOS ─────────────────────────────────
            autoTable(doc, {
                startY: y, margin: { left: ML, right: MR, bottom: MB }, tableWidth: contentW,
                head: [['CÓDIGO ACTIVO', 'DESCRIPCIÓN / DETALLE DEL BIEN', 'ESTADO']],
                body: (dataRes.activos || []).map(a => [
                    a.codigo_activo || '',
                    a.descripcion || '',
                    (a.estado_fisico || 'BUENO').toUpperCase()
                ]),
                theme: 'grid',
                headStyles: { fillColor: [241, 241, 241], textColor: [0, 0, 0], font: 'helvetica', fontStyle: 'bold', fontSize: 10 },
                bodyStyles: { font: 'helvetica', fontSize: 8, textColor: [0, 0, 0] },
                columnStyles: { 0: { cellWidth: 40 }, 2: { cellWidth: 25, halign: 'center' } },
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
            doc.save(`Acta_${tipo}_${safeNombre}_${id}.pdf`);
        } catch (e) {

        } finally {
            setPrinting(null);
        }
    };

    const filtered = agrupados.filter(p => `${p.nombre_completo} ${p.ci} ${p.cargo}`.toLowerCase().includes(filter.toLowerCase()));

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-slate-400 font-bold text-sm animate-pulse">
                <History size={20} className="animate-spin" /> Cargando activos...
            </div>
        </div>
    );

    return (
        <>
            <div className="space-y-4">
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="p-1.5 sm:p-2 bg-white/10 rounded-xl flex-shrink-0">
                            <History size={18} className="text-white sm:w-[20px] sm:h-[20px]" />
                        </div>
                        <div>
                            <h2 className="text-white font-black text-xs sm:text-sm leading-tight uppercase tracking-wide">
                                Reporte de Activos Asignados
                            </h2>
                            <p className="text-white/40 text-[10px] font-bold uppercase mt-1">Vista Consolidada</p>
                        </div>
                    </div>
                    <button onClick={() => fetchHistorial(false)} className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 bg-white/10 hover:bg-white/20 text-white text-[10px] sm:text-xs font-black rounded-lg transition-all active:scale-95 border border-white/5 uppercase tracking-tighter">
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Actualizar
                    </button>
                </div>

                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por Nombre, CI o Cargo..."
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-slate-500 transition-all"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>

                {filtered.length === 0 ? (
                    <div className="bg-white border border-dashed border-slate-200 rounded-xl py-16 text-center">
                        <History size={40} className="mx-auto text-slate-200 mb-3" />
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Sin resultados</p>
                    </div>
                ) : (
                    /* ─── VISTA PRINCIPAL: LISTADO DE HISTORIAL ──────────────── */
                    !activeViewData ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {filtered.map(persona => (
                                <div key={persona.ci} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                    <div className="p-4 cursor-pointer hover:bg-slate-50 transition-colors flex items-center justify-between"
                                        onClick={() => setExpandedCI(expandedCI === persona.ci ? null : persona.ci)}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-sm font-black text-slate-500 border border-slate-200 flex-shrink-0">
                                                {(persona.nombre_completo || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <div className="font-black text-slate-800 text-sm sm:text-base uppercase">{persona.nombre_completo}</div>
                                                    {persona.institucion && (
                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter ${getInstitutionStyle(persona.institucion)}`}>
                                                            {persona.institucion}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex gap-2 text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5">
                                                    <span className="font-mono text-slate-400">CI {persona.ci}</span>
                                                    <span>·</span>
                                                    <span className="truncate max-w-[120px] sm:max-w-xs">{persona.cargo || 'Sin cargo'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-full transition-all flex-shrink-0 ${expandedCI === persona.ci ? 'bg-slate-100 rotate-180' : 'bg-transparent'}`}>
                                                <ChevronDown size={18} className="text-slate-400" />
                                            </div>
                                        </div>
                                    </div>

                                    {expandedCI === persona.ci && (
                                        <div className="bg-slate-50 border-t border-slate-100 p-2 sm:p-4 animate-in slide-in-from-top-2">
                                            <div className="space-y-3">
                                                {persona.ubicaciones.map((ubic, uIdx) => {
                                                    const subKey = `${persona.ci}-${uIdx}`;
                                                    const printId = `consolidado-${persona.ci}-${uIdx}`;

                                                    return (
                                                        <div key={subKey} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                                            <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
                                                                onClick={() => { setSelectedCI(persona.ci); setSelectedUbicKey(`${ubic.unidad || ''}|${ubic.oficina || ''}|${ubic.piso || ''}|${ubic.acta_id || ''}`); }}>
                                                                <div className="flex items-start sm:items-center gap-3">
                                                                    <div className="p-2 bg-slate-100 text-slate-600 rounded-lg shrink-0 mt-0.5 sm:mt-0">
                                                                        <MapPin size={16} />
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-bold text-slate-800 text-xs sm:text-sm">{ubic.oficina || 'Oficina No Definida'}</span>
                                                                            {ubic.acta_numero && (
                                                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 border border-blue-200 uppercase tracking-tight">
                                                                                    Acta #{ubic.acta_numero}
                                                                                </span>
                                                                            )}
                                                                            {ubic.institucion && (
                                                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter ${getInstitutionStyle(ubic.institucion)}`}>
                                                                                    {ubic.institucion}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-1 mt-0.5">
                                                                            <span>{ubic.unidad || 'Unidad No Definida'}</span>
                                                                            <span>·</span>
                                                                            <span>Piso {ubic.piso || '-'}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-1 sm:mt-0">
                                                                    <div className="text-[10px] sm:text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 flex items-center gap-1">
                                                                        <Package size={12} /> {ubic.activos.length} activos
                                                                    </div>

                                                                    <div className="flex items-center gap-2 justify-end">
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handlePrintConsolidado(persona, ubic); }}
                                                                            disabled={printing === printId}
                                                                            className="flex items-center justify-center p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                                                                            title="Imprimir Acta Consolidada"
                                                                        >
                                                                            {printing === printId ? (
                                                                                <div className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                                                                            ) : (
                                                                                <Printer size={18} />
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* ─── SECCIÓN: CRONOLOGÍA DE MOVIMIENTOS ──────────────── */}
                                                <div className="mt-4 pt-4 border-t border-slate-100">
                                                    <div className="flex items-center gap-2 mb-3 px-1">
                                                        <History size={14} className="text-slate-400" />
                                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Historial de Movimientos</h4>
                                                    </div>

                                                    <div className="space-y-2">
                                                        {actas.filter(a => (a.usuario_id === persona.id || a.usuario === persona.nombre_completo) && a.institucion === persona.institucion).length === 0 ? (
                                                            <div className="p-4 text-center text-[10px] text-slate-300 italic">No se encontraron actas registradas</div>
                                                        ) : (
                                                            actas
                                                                .filter(a => (a.usuario_id === persona.id || a.usuario === persona.nombre_completo) && a.institucion === persona.institucion)
                                                                .sort((a, b) => b.id - a.id)
                                                                .map(acta => {
                                                                    const fecha = new Date(acta.fecha_emision);
                                                                    const dia = fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                                                    const hora = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                                                                    return (
                                                                        <div key={acta.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-200 transition-colors shadow-sm">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${acta.tipo_acta === 'Asignación' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                                                                    {acta.tipo_acta === 'Asignación' ? <ClipboardPlus size={16} /> : <Undo2 size={16} />}
                                                                                </div>
                                                                                <div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${acta.tipo_acta === 'Asignación' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                                            {acta.tipo_acta}
                                                                                        </span>
                                                                                        <span className="text-[10px] font-mono font-bold text-slate-300">#{String(acta.id).padStart(5, '0')}</span>
                                                                                        {acta.institucion && (
                                                                                            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter ${getInstitutionStyle(acta.institucion)}`}>
                                                                                                {acta.institucion}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="text-[10px] font-black text-slate-700 mt-0.5">
                                                                                        {dia} <span className="text-slate-300 mx-1">·</span> {hora}
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            <button
                                                                                onClick={() => handlePrintIndividual(acta.id, acta.institucion)}
                                                                                disabled={printing === acta.id}
                                                                                className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                                                title="Imprimir Acta Original"
                                                                            >
                                                                                {printing === acta.id ? <RefreshCw size={14} className="animate-spin" /> : <Printer size={16} />}
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* ─── VISTA: DETALLE DE ACTIVOS (VENTANA APARTE) ────────────── */
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                            {/* Header de la Vista */}
                            <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-blue-500">
                                        <Package size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-800 text-sm sm:text-lg uppercase tracking-tight">Detalle de Activos Asignados</h3>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{activeViewData.ubicacion.oficina}</span>
                                            {activeViewData.ubicacion.institucion && (
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter ${getInstitutionStyle(activeViewData.ubicacion.institucion)}`}>
                                                    {activeViewData.ubicacion.institucion}
                                                </span>
                                            )}
                                            <span className="text-slate-200">·</span>
                                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{activeViewData.persona.nombre_completo}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => {
                                            if (selectedAssets.length > 0) {
                                                const activos = activeViewData.ubicacion.activos.filter(a => selectedAssets.includes(a.id));
                                                handlePrintConsolidado(activeViewData.persona, activeViewData.ubicacion, activos);
                                            } else {
                                                handlePrintConsolidado(activeViewData.persona, activeViewData.ubicacion);
                                            }
                                        }}
                                        disabled={String(printing).includes('consolidado')}
                                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
                                    >
                                        {String(printing).includes('consolidado') ? <RefreshCw size={14} className="animate-spin" /> : <Printer size={14} />}
                                        {selectedAssets.length > 0 ? `Reimprimir Seleccionados (${selectedAssets.length})` : 'Reimprimir Acta'}
                                    </button>
                                    <button
                                        onClick={() => { setSelectedCI(null); setSelectedUbicKey(null); setEditingAssetId(null); setSelectedAssets([]); setAssetFilter(''); }}
                                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-slate-200"
                                    >
                                        <Undo2 size={14} /> Volver
                                    </button>
                                </div>
                            </div>

                            {/* Barra de Búsqueda de Activos */}
                            <div className="px-4 sm:px-6 py-4 bg-white border-b border-slate-100">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Filtrar activos por código o descripción..."
                                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-slate-500/20 transition-all"
                                        value={assetFilter}
                                        onChange={e => setAssetFilter(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Cuerpo - Tabla de Activos */}
                            <div className="p-0 sm:p-6 overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                                <table className="min-w-full divide-y divide-slate-100">
                                    <thead className="sticky top-0 z-20">
                                        <tr className="bg-slate-50">
                                            <th className="px-4 py-4 text-left w-10 bg-slate-50">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    checked={(activeViewData.ubicacion.activos || []).length > 0 && selectedAssets.length === (activeViewData.ubicacion.activos || []).length}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedAssets((activeViewData.ubicacion.activos || []).map(a => a.id));
                                                        } else {
                                                            setSelectedAssets([]);
                                                        }
                                                    }}
                                                />
                                            </th>
                                            <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">Código</th>
                                            <th className="px-4 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">Descripción</th>
                                            <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">Estado Físico</th>
                                            <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(activeViewData.ubicacion.activos || [])
                                            .filter(a =>
                                                a.codigo_activo?.toLowerCase().includes(assetFilter.toLowerCase()) ||
                                                a.descripcion?.toLowerCase().includes(assetFilter.toLowerCase())
                                            )
                                            .map(a => {
                                                const isUpdating = updatingState === `${a.last_acta_id}-${a.id}`;
                                                const isEditing = editingAssetId === a.id;
                                                const isSelected = selectedAssets.includes(a.id);

                                                return (
                                                    <tr key={a.id} className={`hover:bg-slate-50/50 transition-colors group ${isSelected ? 'bg-blue-50/30' : ''}`}>
                                                        <td className="px-4 py-4 align-top">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                                checked={isSelected}
                                                                onChange={() => {
                                                                    setSelectedAssets(prev =>
                                                                        prev.includes(a.id) ? prev.filter(id => id !== a.id) : [...prev, a.id]
                                                                    );
                                                                }}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-4 whitespace-nowrap align-top">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="font-mono text-[10px] sm:text-xs font-black text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 uppercase">
                                                                    {a.codigo_activo}
                                                                </span>
                                                                {a.institucion && (
                                                                    <span className={`text-[7px] font-black px-1 py-0.5 rounded border uppercase tracking-tighter w-fit ${getInstitutionStyle(a.institucion)}`}>
                                                                        {a.institucion}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 align-top">
                                                            <div className="text-[11px] sm:text-xs text-slate-600 leading-relaxed font-medium max-w-md">
                                                                {a.descripcion}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 whitespace-nowrap text-center align-top">
                                                            <div className="flex flex-col items-center justify-center">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight border flex items-center gap-2 ${a.estado_fisico === 'Bueno' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : a.estado_fisico === 'Regular' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                                        <div className={`w-1.5 h-1.5 rounded-full ${a.estado_fisico === 'Bueno' ? 'bg-emerald-500' : a.estado_fisico === 'Regular' ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                                                                        {a.estado_fisico}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 whitespace-nowrap text-center align-top">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button
                                                                    onClick={() => setEditingAsset(a)}
                                                                    className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                                    title="Editar Activo"
                                                                >
                                                                    <Pencil size={15} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleLiberarActivo(a)}
                                                                    disabled={liberandoActivo === a.id}
                                                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                                                    title="Liberar activo (retornar a Disponible)"
                                                                >
                                                                    {liberandoActivo === a.id ? <RefreshCw size={14} className="animate-spin text-red-400" /> : <Trash2 size={16} />}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer - Informativo */}
                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Mostrando {activeViewData.ubicacion.activos.length} activos asignados
                                </p>
                                <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Bueno
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-amber-500"></div> Regular
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-red-500"></div> Malo
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                )}
            </div >
            <AppDialog {...dialogProps} />

            {/* Modal Editar Activo */}
            {
                editingAsset && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                                        <Pencil size={18} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 text-sm">Editar Detalles del Activo</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{editingAsset.codigo_activo}</p>
                                    </div>
                                </div>
                                <button onClick={() => setEditingAsset(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                    <AlertCircle size={20} className="rotate-45" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveEditAsset} className="p-6 space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block flex items-center gap-1.5"><Package size={12} /> Descripción</label>
                                    <textarea
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                                        rows="3"
                                        value={editingAsset.descripcion}
                                        onChange={e => setEditingAsset(prev => ({ ...prev, descripcion: e.target.value }))}
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block flex items-center gap-1.5"><Hash size={12} /> Serie</label>
                                        <input
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                                            value={editingAsset.serie || ''}
                                            onChange={e => setEditingAsset(prev => ({ ...prev, serie: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block flex items-center gap-1.5">Estado Físico</label>
                                        <select
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                                            value={editingAsset.estado_fisico}
                                            onChange={e => setEditingAsset(prev => ({ ...prev, estado_fisico: e.target.value }))}
                                        >
                                            <option value="Bueno">Bueno</option>
                                            <option value="Regular">Regular</option>
                                            <option value="Malo">Malo</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="pt-4 flex items-center justify-end gap-3">
                                    <button type="button" onClick={() => setEditingAsset(null)} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingAsset}
                                        className="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {savingAsset ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                        {savingAsset ? 'Guardando...' : 'Guardar Cambios'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </>
    );
};

export default HistorialActasView;
