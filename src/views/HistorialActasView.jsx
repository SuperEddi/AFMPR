import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    History, User, Calendar, FileText, Printer, Search, RefreshCw,
    ChevronDown, ChevronRight, MapPin, Package, AlertCircle,
    ClipboardPlus, Undo2, PenLine, Trash2, Pencil, CheckCircle,
    Hash, Building2, Download, X, ArrowLeft, Layers
} from 'lucide-react';
import QuickAddSelect from '../components/QuickAddSelect';
import { AppDialog, useDialog } from '../components/AppDialog';

const getInstitutionStyle = (inst) => {
    const i = (inst || '').toUpperCase();
    if (i === 'TIERRAS') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (i === 'JUSTICIA') return 'bg-amber-50 text-amber-600 border-amber-100';
    return 'bg-blue-50 text-blue-600 border-blue-100';
};

const HistorialActasView = ({ authFetch = fetch, currentUser }) => {
    // --- ORIGINAL STATES ---
    const [agrupados, setAgrupados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [printing, setPrinting] = useState(null);
    const [filter, setFilter] = useState('');
    const [expandedCI, setExpandedCI] = useState(null);
    const [actas, setActas] = useState([]);
    const [selectedCI, setSelectedCI] = useState(null);
    const [selectedUbicKey, setSelectedUbicKey] = useState(null);
    const [selectedAssets, setSelectedAssets] = useState([]);
    const [assetFilter, setAssetFilter] = useState('');
    const [liberandoActivo, setLiberandoActivo] = useState(null);
    const [editingAsset, setEditingAsset] = useState(null);
    const [movingAssetsParams, setMovingAssetsParams] = useState(null);
    const [savingAsset, setSavingAsset] = useState(false);
    const [selectedUbicKeys, setSelectedUbicKeys] = useState([]);

    // --- NEW STATES (CONSOLIDADO) ---
    const [activeTab, setActiveTab] = useState('historial');
    const [allActivos, setAllActivos] = useState([]);
    const [loadingAll, setLoadingAll] = useState(false);
    const [catalogos, setCatalogos] = useState({
        ubicaciones: [], unidades: [], oficinas: [], pisos: [], auxiliares: [], grupos: []
    });
    const [viewPath, setViewPath] = useState([{ type: 'root', label: 'Inicio', id: 'root' }]);

    const { showAlert, showConfirm, dialogProps } = useDialog();

    // --- SHARED FETCHERS ---
    const fetchHistorial = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await authFetch('/api/activos/agrupados');
            if (res.ok) setAgrupados(await res.json());
        } catch (err) { console.error(err); }
        finally { if (!silent) setLoading(false); }
    }, [authFetch]);

    const fetchActas = useCallback(async () => {
        try {
            const res = await authFetch('/api/actas');
            if (res.ok) setActas(await res.json());
        } catch (err) { console.error(err); }
    }, [authFetch]);

    const fetchAllActivos = useCallback(async () => {
        setLoadingAll(true);
        try {
            const res = await authFetch('/api/activos');
            if (res.ok) setAllActivos(await res.json());
        } catch (err) { console.error(err); }
        finally { setLoadingAll(false); }
    }, [authFetch]);

    const fetchCatalogos = useCallback(async () => {
        try {
            const results = await Promise.all([
                authFetch('/api/catalogos/ubicaciones').then(r => r.json()),
                authFetch('/api/catalogos/unidades').then(r => r.json()),
                authFetch('/api/catalogos/oficinas').then(r => r.json()),
                authFetch('/api/catalogos/pisos').then(r => r.json()),
                authFetch('/api/catalogos/auxiliares').then(r => r.json()),
                authFetch('/api/catalogos/grupos').then(r => r.json())
            ]);
            setCatalogos({
                ubicaciones: results[0], unidades: results[1], oficinas: results[2],
                pisos: results[3], auxiliares: results[4], grupos: results[5]
            });
        } catch (e) { console.error(e); }
    }, [authFetch]);

    useEffect(() => {
        fetchHistorial(); fetchActas(); fetchCatalogos();
    }, [fetchHistorial, fetchActas, fetchCatalogos]);

    useEffect(() => {
        if (activeTab === 'consolidado') fetchAllActivos();
    }, [activeTab, fetchAllActivos]);

    // --- HANDLERS (ORIGINAL & NEW) ---
    const activeViewData = useMemo(() => {
        if (!selectedCI || !selectedUbicKey) return null;
        const persona = agrupados.find(p => p.ci === selectedCI);
        if (!persona) return null;
        const uKey = selectedUbicKey;
        const ub = persona.ubicaciones.find(u => `${u.edificio || ''}|${u.unidad || ''}|${u.oficina || ''}|${u.piso || ''}` === uKey);
        if (!ub) return null;
        return { persona, ubicacion: ub };
    }, [agrupados, selectedCI, selectedUbicKey]);

    const handleSaveEditAsset = async (e) => {
        e.preventDefault();
        setSavingAsset(true);
        try {
            const assetId = editingAsset.id;
            const targetActaId = editingAsset.last_acta_id || editingAsset.acta_id;

            const resAsset = await authFetch(`/api/activos/${assetId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...editingAsset, registrado_por: currentUser?.nombre })
            });

            const resStatus = await authFetch('/api/detalles_acta/estado', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ acta_id: targetActaId, activo_id: assetId, estado_fisico: editingAsset.estado_fisico })
            });

            if (resAsset.ok && resStatus.ok) {
                await Promise.all([fetchHistorial(true), fetchActas(), fetchAllActivos()]);
                setEditingAsset(null);
                await showAlert('Cambios guardados con éxito.', { type: 'success' });
            } else {
                await showAlert('Error al guardar.', { type: 'error' });
            }
        } catch { await showAlert('Error de red.', { type: 'error' }); }
        finally { setSavingAsset(false); }
    };

    const handleBulkMove = async (e) => {
        e.preventDefault();
        setSavingAsset(true);
        try {
            const promises = selectedAssets.map(assetId => {
                const assetData = (activeViewData?.ubicacion?.activos || []).find(a => a.id === assetId);
                return authFetch(`/api/activos/${assetId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...assetData,
                        ubicacion_fisica_id: movingAssetsParams.ubicacion_fisica_id,
                        cat_unidad_id: movingAssetsParams.cat_unidad_id,
                        cat_oficina_id: movingAssetsParams.cat_oficina_id,
                        cat_piso_id: movingAssetsParams.cat_piso_id,
                        registrado_por: currentUser?.nombre
                    })
                });
            });

            const results = await Promise.all(promises);
            const allOk = results.every(r => r.ok);

            if (allOk) {
                await Promise.all([fetchHistorial(true), fetchActas(), fetchAllActivos()]);

                // Si movemos todo a una nueva ubicación, intentamos actualizar el key para no perder la vista
                const newKey = `${movingAssetsParams.ubicacion_fisica_id || ''}|${movingAssetsParams.cat_unidad_id || ''}|${movingAssetsParams.cat_oficina_id || ''}|${movingAssetsParams.cat_piso_id || ''}`;
                // Sin embargo, como el key usa nombres en el agrupado del front, es mejor limpiar y dejar que el memo actúe
                // O mejor aún, si el antiguo key ya no existe, el memo devolverá null y volverá a la lista, lo cual es seguro.

                setMovingAssetsParams(null);
                setSelectedAssets([]);
                await showAlert('Movimientos masivos guardados con éxito.', { type: 'success' });
            } else {
                await showAlert('Error al guardar algunos movimientos.', { type: 'error' });
            }
        } catch { await showAlert('Error de red.', { type: 'error' }); }
        finally { setSavingAsset(false); }
    };

    const handleLiberarActivo = async (activo) => {
        const confirmed = await showConfirm(`El activo "${activo.codigo_activo}" será desvinculado.`, { title: '¿Liberar activo?', type: 'danger' });
        if (!confirmed) return;
        setLiberandoActivo(activo.id);
        try {
            const res = await authFetch(`/api/activos/${activo.id}/liberar`, { method: 'PUT', body: JSON.stringify({ registrado_por: currentUser?.nombre }) });
            if (res.ok) {
                await Promise.all([fetchHistorial(true), fetchActas(), fetchAllActivos()]);
                await showAlert('Activo liberado.', { type: 'success' });
            }
        } catch { await showAlert('Error de red.', { type: 'error' }); }
        finally { setLiberandoActivo(null); }
    };

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

            // --- LOGO / MEMBRETADO ---
            try {
                const img = new Image();
                img.src = `${window.location.origin}/logo.png`;
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const targetW = 400;
                const targetH = (img.height * targetW) / img.width;
                canvas.width = targetW;
                canvas.height = targetH;
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, targetW, targetH);
                ctx.drawImage(img, 0, 0, targetW, targetH);
                const logoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                doc.addImage(logoDataUrl, 'JPEG', ML, 8, 48, (48 * targetH) / targetW);
            } catch (e) { console.warn("No se pudo cargar el logo:", e); }

            doc.setDrawColor(197, 160, 89); doc.setLineWidth(0.6);
            doc.line(ML, 40, PW - MR, 40);

            // --- FOOTER ---
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
                    d.text('Zona Central - Calle Ayacucho Esq. Potosí', PW - MR, PH - 16, { align: 'right' });
                    d.text('Teléfonos: +591 (2) 2184178', PW - MR, PH - 12, { align: 'right' });
                    d.text(`Página ${i} de ${total}`, PW / 2, PH - 8, { align: 'center' });
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
            console.error(e);
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
            await generateActaPDF(doc, dataRes, jsPDF, autoTable);
            doc.save(`Acta_${id}.pdf`);
        } catch (e) { console.error(e); }
        finally { setPrinting(null); }
    };

    const handlePrintMultiple = async (actasArr) => {
        if (actasArr.length === 0) return;
        setPrinting('multiple');
        try {
            const { default: jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');
            const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });

            const PW = 215.9, PH = 279.4;
            const ML = 20, MR = 20, MT = 48, MB = 22;
            const contentW = PW - ML - MR;

            // Pre-cargar datos de todas las actas
            const allData = await Promise.all(actasArr.map(async a => {
                const headers = a.institucion ? { 'x-target-institution': a.institucion } : {};
                return authFetch(`/api/actas/${a.id}`, { headers }).then(r => r.json());
            }));

            // --- LOGO / MEMBRETADO ---
            try {
                const img = new Image();
                img.src = `${window.location.origin}/logo.png`;
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const targetW = 400;
                const targetH = (img.height * targetW) / img.width;
                canvas.width = targetW;
                canvas.height = targetH;
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, targetW, targetH);
                ctx.drawImage(img, 0, 0, targetW, targetH);
                const logoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                doc.addImage(logoDataUrl, 'JPEG', ML, 8, 48, (48 * targetH) / targetW);
            } catch (e) { console.warn("No se pudo cargar el logo:", e); }

            doc.setDrawColor(197, 160, 89); doc.setLineWidth(0.6);
            doc.line(ML, 40, PW - MR, 40);

            const first = allData[0];
            const nombre = first.nombre_completo || first.usuario_nombre || 'N/A';
            const ci = first.ci || first.usuario_ci || '';
            const cargo = first.cargo || first.usuario_cargo || '';
            const fechaStr = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

            let y = MT;
            doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
            doc.text(`ACTA DE ASIGNACIÓN DE ACTIVOS`, PW / 2, y, { align: 'center' });
            y += 8;

            autoTable(doc, {
                startY: y, margin: { left: ML, right: MR, bottom: MB },
                body: [
                    ['FECHA:', fechaStr],
                    ['RESPONSABLE:', nombre.toUpperCase()],
                    ['CI / CARGO:', `${ci} – ${cargo}`],
                ],
                theme: 'plain',
                styles: { font: 'helvetica', fontSize: 11, cellPadding: 1.5 },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
            });
            y = doc.lastAutoTable.finalY + 4;

            // --- SECCIONES POR ACTA ---
            for (const data of allData) {
                const unidad = data.unidad || data.usuario_unidad || '';
                const oficina = data.oficina || data.usuario_oficina || '';
                const piso = data.piso || data.usuario_piso || '';
                const actaId = data.id;

                // Verificar espacio para el header de oficina + al menos 2 filas
                if (y + 30 > PH - MB) { doc.addPage(); y = 20; }

                doc.setFontSize(10); doc.setFont('helvetica', 'bold');

                doc.setTextColor(0, 0, 0); // Black for prefix
                doc.text(`OFICINA: `, ML, y);
                let currentX = ML + doc.getTextWidth(`OFICINA: `);

                doc.setTextColor(0, 100, 0); // Green for office
                doc.text(oficina.toUpperCase(), currentX, y);
                currentX += doc.getTextWidth(oficina.toUpperCase());

                doc.setTextColor(0, 0, 0); // Black for suffix
                doc.text(` (Piso: ${piso}) - ${unidad.toUpperCase()} (Acta: #${actaId})`, currentX, y);

                y += 2;
                doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2); // Set line to black as requested
                doc.line(ML, y, PW - MR, y);
                y += 4;

                autoTable(doc, {
                    startY: y, margin: { left: ML, right: MR, bottom: MB },
                    head: [['CÓDIGO ACTIVO', 'DESCRIPCIÓN / DETALLE DEL BIEN', 'ESTADO']],
                    body: (data.activos || []).map(a => [
                        a.codigo_activo || '',
                        a.descripcion || '',
                        (a.estado_fisico || 'BUENO').toUpperCase()
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [241, 241, 241], textColor: [0, 0, 0], font: 'helvetica', fontStyle: 'bold', fontSize: 9 },
                    bodyStyles: { font: 'helvetica', fontSize: 8 },
                    columnStyles: { 0: { cellWidth: 35 }, 2: { cellWidth: 20, halign: 'center' } },
                });
                y = doc.lastAutoTable.finalY + 8;
            }

            // Footer y Notas Legales
            if (y + 30 > PH - MB) { doc.addPage(); y = 20; }
            doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
            doc.setDrawColor(197, 160, 89); doc.setLineWidth(1);
            doc.line(ML, y, ML, y + 10);
            const nota = 'NOTA: En cumplimiento a los Art. 141, 146, 147, 154, 159 y 157 del D.S. 0181 y Ley 1178, se procede con el acto. El custodio no podrá efectuar préstamos o transferencias por cuenta propia.';
            doc.text(doc.splitTextToSize(nota, contentW - 5), ML + 4, y + 4);
            y += 20;

            const col1X = ML + 5, col2X = ML + contentW - 55;
            doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
            doc.line(col1X, y + 15, col1X + 50, y + 15);
            doc.line(col2X, y + 15, col2X + 50, y + 15);
            doc.text('ENTREGUÉ CONFORME', col1X + 25, y + 19, { align: 'center' });
            doc.text('RECIBÍ CONFORME', col2X + 25, y + 19, { align: 'center' });

            const total = doc.internal.getNumberOfPages();
            for (let i = 1; i <= total; i++) {
                doc.setPage(i);
                doc.setFillColor(218, 41, 28); doc.rect(ML, PH - 18, 25, 1.5, 'F');
                doc.setFillColor(244, 228, 0); doc.rect(ML + 25, PH - 18, 25, 1.5, 'F');
                doc.setFillColor(0, 122, 51); doc.rect(ML + 50, PH - 18, 25, 1.5, 'F');
                doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
                doc.text('MINISTERIO DE LA PRESIDENCIA', PW - MR, PH - 20, { align: 'right' });
                doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(60, 60, 60);
                doc.text('Zona Central - Calle Ayacucho Esq. Potosí', PW - MR, PH - 16, { align: 'right' });
                doc.text('Teléfonos: +591 (2) 2184178', PW - MR, PH - 12, { align: 'right' });
                doc.text(`Página ${i} de ${total}`, PW / 2, PH - 8, { align: 'center' });
            }

            doc.save(`Reporte_Consolidado_${nombre.replace(/\s+/g, '_')}.pdf`);
        } catch (e) { console.error(e); }
        finally { setPrinting(null); }
    };

    const generateActaPDF = async (doc, dataRes, jsPDF, autoTable) => {
        const PW = 215.9, PH = 279.4;
        const ML = 20, MR = 20, MT = 48, MB = 22;
        const contentW = PW - ML - MR;

        // ─── LOGO / MEMBRETADO ───
        try {
            const img = new Image();
            img.src = `${window.location.origin}/logo.png`;
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const targetW = 400;
            const targetH = (img.height * targetW) / img.width;
            canvas.width = targetW;
            canvas.height = targetH;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, targetW, targetH);
            ctx.drawImage(img, 0, 0, targetW, targetH);
            const logoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            doc.addImage(logoDataUrl, 'JPEG', ML, 8, 48, (48 * targetH) / targetW);
        } catch (e) {
            console.warn("No se pudo cargar el logo en reporte individual:", e);
        }

        doc.setDrawColor(197, 160, 89); doc.setLineWidth(0.6);
        doc.line(ML, 40, PW - MR, 40);

        const drawFooter = (d) => {
            const total = d.internal.getNumberOfPages();
            const curr = d.internal.getCurrentPageInfo().pageNumber;
            d.setFillColor(218, 41, 28); d.rect(ML, PH - 18, 25, 1.5, 'F');
            d.setFillColor(244, 228, 0); d.rect(ML + 25, PH - 18, 25, 1.5, 'F');
            d.setFillColor(0, 122, 51); d.rect(ML + 50, PH - 18, 25, 1.5, 'F');
            d.setFontSize(8); d.setFont('helvetica', 'bold'); d.setTextColor(0, 0, 0);
            d.text('MINISTERIO DE LA PRESIDENCIA', PW - MR, PH - 20, { align: 'right' });
            d.setFont('helvetica', 'normal'); d.setFontSize(7); d.setTextColor(60, 60, 60);
            d.text('Zona Central - Calle Ayacucho Esq. Potosí', PW - MR, PH - 16, { align: 'right' });
            d.text('Teléfonos: +591 (2) 2184178', PW - MR, PH - 12, { align: 'right' });
            d.text(`Página ${curr} de ${total}`, PW / 2, PH - 8, { align: 'center' });
        };

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
        doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(0, 0, 0);
        doc.text(`ACTA DE ${tipo.toUpperCase()} DE ACTIVOS`, PW / 2, y, { align: 'center' });
        y += 8;

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
        y = doc.lastAutoTable.finalY + 4;

        if (dataRes.observaciones) {
            doc.setFontSize(9); doc.setFont('helvetica', 'italic'); doc.setDrawColor(180, 180, 180);
            const obsLines = doc.splitTextToSize(`OBSERVACIONES: ${dataRes.observaciones}`, contentW - 8);
            doc.rect(ML, y, contentW, obsLines.length * 4.5 + 4);
            doc.text(obsLines, ML + 4, y + 5);
            y += obsLines.length * 4.5 + 8;
        }

        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
        doc.setDrawColor(197, 160, 89); doc.setLineWidth(1);
        doc.line(ML, y, ML, y + 14); doc.setLineWidth(0.2);
        const nota = 'NOTA: En cumplimiento a los Art. 141, 146, 147, 154, 159 y 157 del D.S. 0181 y Ley 1178, se procede con el acto. El custodio no podrá efectuar préstamos o transferencias por cuenta propia.';
        const notaLines = doc.splitTextToSize(nota, contentW - 5);
        doc.text(notaLines, ML + 4, y + 4);
        y += 18;

        const col1X = ML + 5, col2X = ML + contentW - 55;
        doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
        doc.line(col1X, y + 15, col1X + 50, y + 15);
        doc.line(col2X, y + 15, col2X + 50, y + 15);
        doc.text('ENTREGUÉ CONFORME', col1X + 25, y + 19, { align: 'center' });
        doc.text('RECIBÍ CONFORME', col2X + 25, y + 19, { align: 'center' });

        drawFooter(doc);
    };


    // --- CONSOLIDADO DRILL-DOWN LOGIC ---
    const currentLevel = viewPath[viewPath.length - 1];
    const drillDownData = useMemo(() => {
        if (activeTab !== 'consolidado') return [];
        // Filtrar activos para mostrar únicamente los que tienen responsable (Asignados)
        // Esto elimina el problema de ver "DISPONIBLE" y limpia la vista estructural
        let data = allActivos.filter(a => a.estado_actual === 'Asignado');

        viewPath.forEach(step => {
            if (step.type === 'edificio') data = data.filter(a => a.edificio === step.id || (step.id === 'SIN EDIFICIO' && !a.edificio));
            if (step.type === 'unidad') data = data.filter(a => a.unidad === step.id || (step.id === 'SIN UNIDAD' && !a.unidad));
            if (step.type === 'piso') data = data.filter(a => String(a.piso) === String(step.id));
            if (step.type === 'oficina') data = data.filter(a => a.oficina === step.id);
        });

        const nextTypeMap = { 'root': 'edificio', 'edificio': 'unidad', 'unidad': 'piso', 'piso': 'oficina', 'oficina': 'responsable' };
        const nextType = nextTypeMap[currentLevel.type];

        if (nextType === 'responsable') {
            const resps = {};
            data.forEach(a => {
                const name = a.usuario_nombre || 'S/N';
                if (!resps[name]) resps[name] = { id: name, name, assets: [] };
                resps[name].assets.push(a);
            });
            return Object.values(resps).sort((a, b) => a.name.localeCompare(b.name));
        }

        const groups = {};
        data.forEach(a => {
            let val = a[nextType];
            if (!val) {
                if (nextType === 'edificio') val = 'SIN EDIFICIO';
                else if (nextType === 'unidad') val = 'SIN UNIDAD';
                else val = 'S/D';
            }
            const key = val;
            if (!groups[key]) groups[key] = { id: key, name: val, count: 0 };
            groups[key].count++;
        });
        return Object.values(groups).sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
    }, [allActivos, viewPath, currentLevel, activeTab]);

    const handleStepClick = (item) => {
        const nextTypeMap = { 'root': 'edificio', 'edificio': 'unidad', 'unidad': 'piso', 'piso': 'oficina', 'oficina': 'responsable' };
        setViewPath([...viewPath, { type: nextTypeMap[currentLevel.type], label: item.name, id: item.id, assets: item.assets }]);
    };

    const handleBack = () => { if (viewPath.length > 1) setViewPath(viewPath.slice(0, -1)); };

    const exportToExcelFull = async () => {
        const { exportToExcel } = await import('../utils/excelExport');
        // El reporte también debe ser únicamente de activos asignados para profesionalismo
        const rows = allActivos
            .filter(a => a.estado_actual === 'Asignado')
            .map(a => [
                a.edificio || 'S/D', a.unidad || 'S/D', a.piso || 'S/D', a.oficina || 'S/D',
                a.usuario_nombre || 'S/N', a.codigo_activo, a.descripcion, a.estado_fisico, a.institucion
            ]);
        await exportToExcel({
            filename: 'Reporte_Consolidado_Asignados',
            title: 'Reporte Consolidado Estructural (Solo Asignados)',
            columns: ['Edificio', 'Unidad', 'Piso', 'Oficina', 'Responsable', 'Código', 'Descripción', 'Estado', 'Institución'],
            rows
        });
    };

    if (loading) return <div className="flex items-center justify-center py-20 text-slate-400 gap-3"><RefreshCw size={20} className="animate-spin" /> Cargando datos...</div>;

    return (
        <div className="space-y-4">
            {/* TOGGLE HEADER */}
            <div className="bg-slate-900 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-xl text-white"><History size={20} /></div>
                    <h2 className="text-white font-bold text-sm uppercase tracking-wide">Gestión del Historial</h2>
                </div>
                <div className="flex bg-white/10 p-1 rounded-xl">
                    <button onClick={() => setActiveTab('historial')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'historial' ? 'bg-white text-slate-900' : 'text-white/60 hover:text-white'}`}>PERSONAS</button>
                    <button onClick={() => setActiveTab('consolidado')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'consolidado' ? 'bg-white text-slate-900' : 'text-white/60 hover:text-white'}`}>CONSOLIDADO</button>
                </div>
            </div>

            {activeTab === 'historial' ? (
                /* --- PERSONAS TAB (ORIGINAL LOGIC) --- */
                <div className="space-y-4">
                    {!activeViewData ? (
                        <>
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="text" placeholder="Buscar por nombre, CI o cargo..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none" value={filter} onChange={e => setFilter(e.target.value)} />
                            </div>
                            <div className="space-y-3">
                                {agrupados.filter(p => `${p.nombre_completo} ${p.ci} ${p.cargo}`.toLowerCase().includes(filter.toLowerCase())).map(persona => (
                                    <div key={persona.ci} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                        <div className="p-4 cursor-pointer hover:bg-slate-50 flex items-center justify-between" onClick={() => setExpandedCI(expandedCI === persona.ci ? null : persona.ci)}>
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-400">{persona.nombre_completo.charAt(0)}</div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="font-bold text-slate-800 text-sm uppercase">{persona.nombre_completo}</div>
                                                        {persona.institucion && <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter ${getInstitutionStyle(persona.institucion)}`}>{persona.institucion}</span>}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-mono">CI: {persona.ci} · {persona.cargo}</div>
                                                </div>
                                            </div>
                                            <ChevronDown size={18} className={`text-slate-300 transition-transform ${expandedCI === persona.ci ? 'rotate-180' : ''}`} />
                                        </div>
                                        {expandedCI === persona.ci && (
                                            <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-4">
                                                {/* UBICACIONES */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between px-1">
                                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ubicaciones Actuales</h4>
                                                        {selectedUbicKeys.length > 0 && (
                                                            <button
                                                                onClick={() => {
                                                                    const selUbics = persona.ubicaciones.filter(u => selectedUbicKeys.includes(`${u.edificio || ''}|${u.unidad || ''}|${u.oficina || ''}|${u.piso || ''}`));
                                                                    const combinedActivos = selUbics.flatMap(u => u.activos);
                                                                    const combinedUbicacion = {
                                                                        unidad: 'VARIAS UNIDADES',
                                                                        oficina: 'VARIAS OFICINAS',
                                                                        piso: 'VARIOS',
                                                                        activos: combinedActivos
                                                                    };
                                                                    handlePrintConsolidado(persona, combinedUbicacion);
                                                                }}
                                                                className="text-[9px] font-black bg-emerald-600 text-white px-2 py-1 rounded-lg uppercase tracking-tighter hover:bg-emerald-700 transition-all flex items-center gap-1"
                                                            >
                                                                <Printer size={10} /> Generar Consolidado ({selectedUbicKeys.length})
                                                            </button>
                                                        )}
                                                    </div>
                                                    {persona.ubicaciones.map((u, i) => (
                                                        <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm hover:border-indigo-200 transition-all">
                                                            <div className="flex items-center gap-3">
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-4 h-4 rounded border-slate-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                                    checked={selectedUbicKeys.includes(`${u.edificio || ''}|${u.unidad || ''}|${u.oficina || ''}|${u.piso || ''}`)}
                                                                    onChange={(e) => {
                                                                        const key = `${u.edificio || ''}|${u.unidad || ''}|${u.oficina || ''}|${u.piso || ''}`;
                                                                        setSelectedUbicKeys(prev =>
                                                                            prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]
                                                                        );
                                                                    }}
                                                                />
                                                                <div className="flex items-center gap-3 cursor-pointer" onClick={() => {
                                                                    setSelectedCI(persona.ci);
                                                                    setSelectedUbicKey(`${u.edificio || ''}|${u.unidad || ''}|${u.oficina || ''}|${u.piso || ''}`);
                                                                }}>
                                                                    <MapPin size={16} className="text-slate-400" />
                                                                    <div>
                                                                        <div className="text-xs font-bold text-slate-700">
                                                                            {u.oficina} (Piso {String(u.piso || '').toUpperCase().replace('PISO', '').trim()})
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-400 font-semibold uppercase">{u.unidad}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">{u.activos.length} ACTIVOS</div>
                                                                <button onClick={(e) => { e.stopPropagation(); setSelectedCI(persona.ci); setSelectedUbicKey(`${u.edificio || ''}|${u.unidad || ''}|${u.oficina || ''}|${u.piso || ''}`); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all" title="Gestionar Activos"><Pencil size={16} /></button>
                                                                <button onClick={(e) => { e.stopPropagation(); handlePrintConsolidado(persona, u); }} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="Imprimir Acta Consolidada"><Printer size={16} /></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* CRONOLOGÍA */}
                                                <div className="pt-4 border-t border-slate-200">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Cronología de Actas</h4>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {actas.filter(a => a.usuario_id === persona.id || a.usuario === persona.nombre_completo).sort((a, b) => b.id - a.id).map(acta => (
                                                            <div key={acta.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm hover:border-indigo-200 transition-all">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`p-2 rounded-lg ${acta.tipo_acta === 'Asignación' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                                                        {acta.tipo_acta === 'Asignación' ? <ClipboardPlus size={16} /> : <Undo2 size={16} />}
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[10px] font-bold text-slate-700">Acta #{acta.id}</span>
                                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase ${acta.tipo_acta === 'Asignación' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>{acta.tipo_acta}</span>
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-400">{new Date(acta.fecha_emision).toLocaleDateString()}</div>
                                                                    </div>
                                                                </div>
                                                                <button onClick={() => handlePrintIndividual(acta.id, acta.institucion)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all"><Printer size={16} /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        /* DETALLE DE ACTIVOS (PERSONAS VIEWDETAIL) */
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
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                {activeViewData?.ubicacion?.oficina} (Piso {String(activeViewData?.ubicacion?.piso || '').toUpperCase().replace('PISO', '').trim()})
                                            </span>
                                            {activeViewData?.ubicacion?.institucion && (
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-tighter ${getInstitutionStyle(activeViewData.ubicacion?.institucion)}`}>
                                                    {activeViewData.ubicacion?.institucion}
                                                </span>
                                            )}
                                            <span className="text-slate-200">·</span>
                                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{activeViewData.persona.nombre_completo}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {selectedAssets.length > 0 && (
                                        <button
                                            onClick={() => setMovingAssetsParams({
                                                ubicacion_fisica_id: '',
                                                cat_unidad_id: '',
                                                cat_oficina_id: '',
                                                cat_piso_id: ''
                                            })}
                                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                                        >
                                            <MapPin size={14} /> Mover Seleccionados ({selectedAssets.length})
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            if (selectedAssets.length > 0) {
                                                const activos = (activeViewData?.ubicacion?.activos || []).filter(a => selectedAssets.includes(a.id));
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
                                        onClick={() => { setSelectedCI(null); setSelectedUbicKey(null); setSelectedAssets([]); setAssetFilter(''); }}
                                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-slate-200"
                                    >
                                        <ArrowLeft size={14} /> Volver
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
                                        {(activeViewData?.ubicacion?.activos || [])
                                            .filter(a =>
                                                a.codigo_activo?.toLowerCase().includes(assetFilter.toLowerCase()) ||
                                                a.descripcion?.toLowerCase().includes(assetFilter.toLowerCase())
                                            )
                                            .map(a => {
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
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 align-top text-[11px] font-medium text-slate-600">{a.descripcion}</td>
                                                        <td className="px-4 py-4 whitespace-nowrap text-center align-top">
                                                            <div className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight border ${a.estado_fisico === 'Bueno' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                                                {a.estado_fisico}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 whitespace-nowrap text-center align-top">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button onClick={() => setEditingAsset(a)} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Pencil size={15} /></button>
                                                                <button onClick={() => handleLiberarActivo(a)} disabled={liberandoActivo === a.id} className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50">
                                                                    {liberandoActivo === a.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={16} />}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div >
            ) : (
                /* --- CONSOLIDADO TAB (DRILL-DOWN LOGIC) --- */
                <div className="space-y-6">
                    <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-lg space-y-6 min-h-[500px] flex flex-col">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3 overflow-hidden w-full">
                                {viewPath.length > 1 && <button onClick={handleBack} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-all flex-shrink-0"><ArrowLeft size={18} /></button>}
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest overflow-x-auto whitespace-nowrap py-1 scrollbar-hide">
                                    {viewPath.map((step, idx) => (
                                        <React.Fragment key={idx}>
                                            {idx > 0 && <ChevronRight size={14} className="text-slate-300" />}
                                            <span onClick={() => setViewPath(viewPath.slice(0, idx + 1))} className={`cursor-pointer transition-colors ${idx === viewPath.length - 1 ? 'text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg' : 'text-slate-400 hover:text-slate-600'}`}>{step.label}</span>
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                            <button onClick={exportToExcelFull} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex-shrink-0"><Download size={14} /> EXCEL FULL</button>
                        </div>
                        <div className="flex-1 animate-in fade-in slide-in-from-right-4 duration-300">
                            {currentLevel.type === 'responsable' ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center font-black text-indigo-500 shadow-sm text-lg border border-indigo-100">{currentLevel.label.charAt(0)}</div>
                                            <div><h4 className="font-black text-slate-800 uppercase tracking-tight">{currentLevel.label}</h4><p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Responsable de {currentLevel.assets.length} activos en esta oficina</p></div>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100"><tr><th className="px-4 py-3">Código</th><th className="px-4 py-3">Descripción</th><th className="px-4 py-3 text-center">Estado</th></tr></thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {currentLevel.assets.map(a => (
                                                    <tr key={a.id} className="hover:bg-slate-50/80 group">
                                                        <td className="px-4 py-4"><span className="font-mono text-[11px] font-bold text-slate-700 bg-white px-2 py-1 rounded-lg border border-slate-200">{a.codigo_activo}</span></td>
                                                        <td className="px-4 py-4"><span className="text-[11px] font-semibold text-slate-600">{a.descripcion}</span></td>
                                                        <td className="px-4 py-4 text-center"><span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${a.institucion ? getInstitutionStyle(a.institucion) : ''}`}>{a.estado_fisico}</span></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {drillDownData.map(item => {
                                        const nextTypeMap = { 'root': 'edificio', 'edificio': 'unidad', 'unidad': 'piso', 'piso': 'oficina', 'oficina': 'responsable' };
                                        const nextType = nextTypeMap[currentLevel.type];
                                        const isResp = nextType === 'responsable';
                                        return (
                                            <div key={item.id} onClick={() => handleStepClick(item)} className="group relative bg-white border border-slate-100 p-5 rounded-3xl hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-500/10 cursor-pointer transition-all duration-300 transform-gpu hover:-translate-y-1 active:scale-95">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${nextType === 'edificio' ? 'bg-indigo-50 text-indigo-500' : nextType === 'unidad' ? 'bg-emerald-50 text-emerald-500' : nextType === 'piso' ? 'bg-amber-50 text-amber-500' : nextType === 'oficina' ? 'bg-blue-50 text-blue-500' : 'bg-slate-50 text-slate-500'}`}>
                                                        {nextType === 'edificio' ? <Building2 size={24} /> : nextType === 'unidad' ? <Layers size={24} /> : nextType === 'piso' ? <Hash size={24} /> : nextType === 'oficina' ? <MapPin size={24} /> : <User size={24} />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{nextType.toUpperCase()}</p>
                                                        <h4 className="font-black text-slate-800 uppercase tracking-tight text-xs truncate group-hover:text-indigo-600 transition-colors uppercase">{String(item.name).toUpperCase()}</h4>
                                                    </div>
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isResp ? `${item.assets.length} ACTIVOS` : `${item.count} ACTIVOS`}</span>
                                                    {isResp && allActivos.filter(a => a.usuario_nombre === item.name).map(a => a.oficina).filter((v, i, self) => self.indexOf(v) === i).length > 1 && (
                                                        <span className="px-2 py-1 bg-red-50 text-red-500 rounded-lg text-[8px] font-black uppercase tracking-tighter border border-red-100 flex items-center gap-1"><AlertCircle size={8} /> MULTI-OFICINA</span>
                                                    )}
                                                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-500 group-hover:text-white transition-all transform group-hover:rotate-45 shadow-sm"><ChevronRight size={14} /></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <AppDialog {...dialogProps} />

            {/* SHARED BULK MOVE MODAL */}
            {movingAssetsParams && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-white overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-8 py-6 bg-slate-900 flex items-center justify-between">
                            <div className="flex items-center gap-4 text-white"><MapPin size={20} /><h3 className="font-black uppercase tracking-tight">Mover {selectedAssets.length} Activos</h3></div>
                            <button onClick={() => setMovingAssetsParams(null)} className="text-white/40 hover:text-white"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleBulkMove} className="p-8 space-y-6 overflow-y-auto flex-1">
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Edificio Destino</label>
                                        <QuickAddSelect options={catalogos.ubicaciones} labelField="nombre" placeholder="Edificio..." value={movingAssetsParams.ubicacion_fisica_id || ''} onChange={id => setMovingAssetsParams({ ...movingAssetsParams, ubicacion_fisica_id: id, cat_unidad_id: '', oficina_id: '' })} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Piso Destino</label>
                                        <QuickAddSelect options={catalogos.pisos} labelField="numero" placeholder="Piso..." value={movingAssetsParams.cat_piso_id || ''} onChange={id => setMovingAssetsParams({ ...movingAssetsParams, cat_piso_id: id })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Unidad Destino</label>
                                        <QuickAddSelect options={catalogos.unidades.filter(u => !movingAssetsParams.ubicacion_fisica_id || u.ubicacion_fisica_id == movingAssetsParams.ubicacion_fisica_id)} labelField="nombre" placeholder="Unidad..." value={movingAssetsParams.cat_unidad_id || ''} onChange={id => setMovingAssetsParams({ ...movingAssetsParams, cat_unidad_id: id, cat_oficina_id: '' })} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Oficina Destino</label>
                                        <QuickAddSelect options={catalogos.oficinas.filter(o => !movingAssetsParams.cat_unidad_id || o.unidad_id == movingAssetsParams.cat_unidad_id)} labelField="nombre" placeholder="Oficina..." value={movingAssetsParams.cat_oficina_id || ''} onChange={id => setMovingAssetsParams({ ...movingAssetsParams, cat_oficina_id: id })} />
                                    </div>
                                </div>
                            </div>
                            <button type="submit" disabled={savingAsset} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-colors">{savingAsset ? <RefreshCw className="animate-spin" /> : <CheckCircle />} MOVER ACTIVOS SELECCIONADOS</button>
                        </form>
                    </div>
                </div>
            )}

            {/* SHARED EDIT MODAL */}
            {
                editingAsset && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-white overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="px-8 py-6 bg-slate-900 flex items-center justify-between">
                                <div className="flex items-center gap-4 text-white"><Pencil size={20} /><h3 className="font-black uppercase tracking-tight">Editar Activo</h3></div>
                                <button onClick={() => setEditingAsset(null)} className="text-white/40 hover:text-white"><X size={24} /></button>
                            </div>
                            <form onSubmit={handleSaveEditAsset} className="p-8 space-y-6 overflow-y-auto flex-1">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Descripción</label>
                                    <textarea className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold outline-none" rows="3" value={editingAsset.descripcion} onChange={e => setEditingAsset({ ...editingAsset, descripcion: e.target.value })} />
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Edificio</label>
                                                <QuickAddSelect options={catalogos.ubicaciones} labelField="nombre" placeholder="Edificio..." value={editingAsset.ubicacion_fisica_id || ''} onChange={id => setEditingAsset({ ...editingAsset, ubicacion_fisica_id: id, cat_unidad_id: '', oficina_id: '' })} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Piso</label>
                                                <QuickAddSelect options={catalogos.pisos} labelField="numero" placeholder="Piso..." value={editingAsset.cat_piso_id || ''} onChange={id => setEditingAsset({ ...editingAsset, cat_piso_id: id })} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Unidad</label>
                                                <QuickAddSelect options={catalogos.unidades.filter(u => !editingAsset.ubicacion_fisica_id || u.ubicacion_fisica_id == editingAsset.ubicacion_fisica_id)} labelField="nombre" placeholder="Unidad..." value={editingAsset.cat_unidad_id || ''} onChange={id => setEditingAsset({ ...editingAsset, cat_unidad_id: id, cat_oficina_id: '' })} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Oficina</label>
                                                <QuickAddSelect options={catalogos.oficinas.filter(o => !editingAsset.cat_unidad_id || o.unidad_id == editingAsset.cat_unidad_id)} labelField="nombre" placeholder="Oficina..." value={editingAsset.cat_oficina_id || ''} onChange={id => setEditingAsset({ ...editingAsset, cat_oficina_id: id })} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Estado Físico</label>
                                            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none" value={editingAsset.estado_fisico || 'Bueno'} onChange={e => setEditingAsset({ ...editingAsset, estado_fisico: e.target.value })}>
                                                <option value="Bueno">BUENO</option>
                                                <option value="Regular">REGULAR</option>
                                                <option value="Malo">MALO</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <button type="submit" disabled={savingAsset} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3">{savingAsset ? <RefreshCw className="animate-spin" /> : <CheckCircle />} GUARDAR CAMBIOS</button>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default HistorialActasView;
