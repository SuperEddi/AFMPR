/* VERSION: 2026-04-14 21:28 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ClipboardCheck, User, Package, CheckCircle, AlertCircle, X, MapPin, ListFilter, AlertTriangle, CheckSquare, Download, FileText, Printer, Trash2 } from 'lucide-react';
import { AppDialog, useDialog } from '../components/AppDialog';
import { exportToExcel } from '../utils/excelExport';

const getInstitutionStyle = (inst) => {
    const i = (inst || '').toUpperCase();
    if (i === 'TIERRAS') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (i === 'JUSTICIA') return 'bg-amber-50 text-amber-600 border-amber-100';
    if (i === 'PRESIDENCIA') return 'bg-amber-50 text-amber-600 border-amber-100';
    if (i === 'CULTURAS') return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    if (i === 'VICEPRESIDENCIA') return 'bg-rose-50 text-rose-600 border-rose-100';
    return 'bg-blue-50 text-blue-600 border-blue-100';
};

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
    if (!isOpen) return null;
    const maxWidths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };
    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidths[size]} animate-in zoom-in-95 duration-200 overflow-hidden`}>
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                    <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wider">{title}</h3>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <div className="max-h-[85vh] overflow-y-auto custom-scrollbar p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

const ControlActivosView = ({ authFetch = fetch, currentUser, institution }) => {
    console.log('ControlActivosView loaded - VERSION: 2026-04-14 21:30');
    const [usuarios, setUsuarios] = useState([]);
    const [allActivos, setAllActivos] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [auditUserSearch, setAuditUserSearch] = useState('');
    const [expectedActivos, setExpectedActivos] = useState([]);
    const [controlledActivos, setControlledActivos] = useState([]);
    const [surplusActivos, setSurplusActivos] = useState([]); // Sobrantes
    const [loading, setLoading] = useState(false);
    const [scanValue, setScanValue] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [activeListTab, setActiveListTab] = useState('pending'); // 'pending', 'found', 'surplus'
    const [printing, setPrinting] = useState(false);
    const [assetObservations, setAssetObservations] = useState({}); // { activoId: 'obs' }
    const [catalogos, setCatalogos] = useState({ auxiliares: [], grupos: [] });
    const [assigningAsset, setAssigningAsset] = useState(null); // Activo que se está asignando
    const [assignFormData, setAssignFormData] = useState({
        descripcion: '',
        cat_auxiliar_id: '',
        cat_grupo_contable_id: '',
        origen: 'Sobrante'
    });
    const { showAlert, showConfirm, dialogProps } = useDialog();

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [uRes, aRes, cRes] = await Promise.all([
                authFetch('/api/usuarios'),
                authFetch('/api/activos'),
                authFetch('/api/catalogos')
            ]);
            const [uData, aData, cData] = await Promise.all([uRes.json(), aRes.json(), cRes.json()]);
            setUsuarios(Array.isArray(uData) ? uData : []);
            setAllActivos(Array.isArray(aData) ? aData : []);
            setCatalogos(cData);
        } catch (err) {
            // Silently fail to protect technical info
        }
        setLoading(false);
    }, [authFetch]);

    useEffect(() => {
        fetchData();
        window.addEventListener('data-updated', fetchData);
        return () => window.removeEventListener('data-updated', fetchData);
    }, [fetchData, institution]);

    const handleSelectUser = async (user) => {
        setSelectedUser(user);
        setLoading(true);
        try {
            // 1. Cargar auditorías previas usando la institución del usuario seleccionado
            const audRes = await authFetch(`/api/auditorias/usuario/${user.id}`, {
                headers: { 'x-target-institution': user.institucion }
            });
            const audData = await audRes.json();

            // 2. Filtrar activos del usuario (comparar ID e INSTITUCIÓN para evitar colisiones)
            const userAssets = allActivos.filter(a => {
                const sameId = a.usuario_actual_id === user.id;
                const sameInst = (a.institucion || '').toUpperCase() === (user.institucion || '').toUpperCase();
                const sameName = a.responsable && a.responsable.toLowerCase() === user.nombre_completo.toLowerCase();

                // Si coinciden ID e institución, o el nombre coincide en la misma institución
                return (sameId && sameInst) || (sameName && sameInst);
            });

            setExpectedActivos(userAssets);

            // 3. Mapear hallazgos previos
            const prevFound = [];
            const prevSurplus = [];
            const prevObs = {};

            if (Array.isArray(audData)) {
                audData.forEach(aud => {
                    const asset = allActivos.find(a => a.id === aud.activo_id);
                    if (aud.observacion) prevObs[aud.activo_id] = aud.observacion;

                    if (asset) {
                        if (aud.hallazgo === 'Correcto') prevFound.push(asset);
                        else if (aud.hallazgo !== 'Faltante') {
                            // Si es ajeno, necesitamos saber de quién era durante el escaneo
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
            setAssetObservations(prevObs);

        } catch (err) {
            // Silently fail to protect technical info
        }
        setLoading(false);
        setAuditUserSearch('');
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
                        hallazgo: 'Correcto',
                        realizado_por: currentUser?.nombre,
                        institucion: selectedUser.institucion
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
                        hallazgo: hallazgo,
                        realizado_por: currentUser?.nombre,
                        institucion: selectedUser.institucion
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
            // 4. No existe. ¿Registrar como sobrante?
            const confirmRegister = await showConfirm(`El código "${code}" no existe en el inventario global. ¿Deseas registrarlo como un NUEVO ACTIVO SOBRANTE hallado en esta ubicación?`, {
                title: 'Código no encontrado',
                type: 'warning',
                confirmText: 'Registrar como Sobrante'
            });

            if (confirmRegister) {
                try {
                    setLoading(true);
                    const res = await authFetch('/api/activos', {
                        method: 'POST',
                        body: JSON.stringify({
                            codigo_activo: code,
                            descripcion: 'ACTIVO SOBRANTE - HALLADO EN AUDITORÍA',
                            estado_actual: 'Sobrante',
                            registrado_por: currentUser?.nombre
                        })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);

                    // Vincular a la auditoría del usuario
                    await authFetch('/api/auditorias', {
                        method: 'POST',
                        body: JSON.stringify({
                            usuario_auditado_id: selectedUser.id,
                            activo_id: data.id,
                            hallazgo: 'Sobrante',
                            realizado_por: currentUser?.nombre,
                            institucion: selectedUser.institucion
                        })
                    });

                    setSurplusActivos(prev => [data.activo, ...prev]);
                    await showAlert(`Activo ${code} registrado exitosamente como sobrante.`, { title: 'Registrado', type: 'success' });
                } catch (err) {
                    await showAlert('Error al registrar el activo sobrante.', { title: 'Error', type: 'error' });
                } finally {
                    setLoading(false);
                }
            }
        }
    };

    const handleResetAudit = async () => {
        if (!selectedUser) return;
        const confirm = await showConfirm(`¿Estás seguro de reiniciar la auditoría de ${selectedUser.nombre_completo}? Se borrarán todos los escaneos guardados para este funcionario.`, { title: 'Reinicio Completo', type: 'danger', confirmText: 'Reiniciar Todo' });
        if (!confirm) return;

        try {
            await authFetch(`/api/auditorias/usuario/${selectedUser.id}`, {
                method: 'DELETE',
                headers: { 'x-target-institution': selectedUser.institucion }
            });
            setControlledActivos([]);
            setSurplusActivos([]);
            await showAlert('La auditoría ha sido reiniciada.', { title: 'Reinicio Completo', type: 'info' });
        } catch (err) {
            await showAlert('Error al reiniciar la auditoría.', { title: 'Error', type: 'error' });
        }
    };

    const handleDeleteAuditItem = async (activoId, fromTab = 'found') => {
        const isSurplus = fromTab === 'surplus';
        const asset = allActivos.find(a => a.id === activoId);

        if (isSurplus && asset?.codigo_activo?.includes('NUEVO')) {
            const confirmed = await showConfirm(
                '¿Eliminar sobrante?',
                `Este es un activo nuevo registrado como sobrante. ¿Deseas eliminarlo permanentemente del sistema o solo de esta lista de auditoría?`,
                { okText: 'ELIMINAR PERMANENTE', cancelText: 'Solo de lista' }
            );

            if (confirmed === undefined) return; // Cerró el diálogo

            if (confirmed) {
                try {
                    const res = await authFetch(`/api/activos/${activoId}`, {
                        method: 'DELETE',
                        headers: { 'x-target-institution': selectedUser.institucion }
                    });
                    if (res.ok) {
                        setSurplusActivos(prev => prev.filter(a => a.id !== activoId));
                        setAllActivos(prev => prev.filter(a => a.id !== activoId));
                        showAlert('Eliminado', 'El activo ha sido borrado permanentemente.', 'success');
                    }
                } catch (e) {
                    showAlert('Error', 'No se pudo eliminar el activo.');
                }
                return;
            }
        }

        // Borrado normal solo de la auditoría
        try {
            const res = await authFetch(`/api/auditorias/usuario/${selectedUser.id}/activo/${activoId}`, {
                method: 'DELETE',
                headers: { 'x-target-institution': selectedUser.institucion }
            });

            if (res.ok) {
                if (isSurplus) setSurplusActivos(prev => prev.filter(a => a.id !== activoId));
                else setControlledActivos(prev => prev.filter(a => a.id !== activoId));
                showAlert('Referencia eliminada', 'Se ha quitado la marca de la auditoría.', 'success');
            }
        } catch (e) {
            showAlert('Error', 'No se pudo quitar el ítem.');
        }
    };

    const handleOpenAssignModal = (asset) => {
        setAssigningAsset(asset);
        setAssignFormData({
            descripcion: asset.descripcion || '',
            cat_auxiliar_id: asset.cat_auxiliar_id || '',
            cat_grupo_contable_id: asset.cat_grupo_contable_id || '',
            origen: asset.origen || 'Sobrante'
        });
    };

    const handleConfirmAssignment = async () => {
        if (!assignFormData.descripcion) return showAlert('Error', 'La descripción es obligatoria.');

        setLoading(true);
        try {
            const res = await authFetch(`/api/activos/${assigningAsset.id}/auditoria-asignar`, {
                method: 'PUT',
                body: JSON.stringify({
                    ...assignFormData,
                    usuario_auditado_id: selectedUser.id,
                    realizado_por: currentUser?.nombre
                }),
                headers: {
                    'Content-Type': 'application/json',
                    'x-target-institution': selectedUser.institucion
                }
            });

            if (res.ok) {
                // Mover de sobrante a encontrado
                setSurplusActivos(prev => prev.filter(a => a.id !== assigningAsset.id));
                setControlledActivos(prev => [...prev, { ...assigningAsset, ...assignFormData, estado_actual: 'Asignado' }]);
                setAssigningAsset(null);
                showAlert('Asignado', 'El activo se ha registrado y asignado correctamente.', 'success');
                fetchData(); // Refrescar todo
            } else {
                const err = await res.json();
                showAlert('Error', err.message || 'No se pudo completar la asignación.');
            }
        } catch (e) {
            showAlert('Error', 'Ocurrió un error en el servidor.');
        }
        setLoading(false);
    };

    const handleSaveObservation = async (activo, currentObs) => {
        const newObs = prompt(`Observación para ${activo.codigo_activo}:`, currentObs || '');
        if (newObs === null) return;

        try {
            setLoading(true);
            await authFetch('/api/auditorias', {
                method: 'POST',
                body: JSON.stringify({
                    usuario_auditado_id: selectedUser.id,
                    activo_id: activo.id,
                    hallazgo: controlledActivos.find(c => c.id === activo.id) ? 'Correcto' : 'Faltante',
                    realizado_por: currentUser?.nombre,
                    institucion: selectedUser.institucion,
                    observacion: newObs
                })
            });
            setAssetObservations(prev => ({ ...prev, [activo.id]: newObs }));
            await showAlert('Observación guardada.', { title: 'Éxito', type: 'success' });
        } catch (err) {
            await showAlert('Error al guardar la observación.', { title: 'Error', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = async () => {
        if (!selectedUser) return;

        const fechaHoy = new Date().toLocaleDateString('es-ES');
        const pending = expectedActivos.filter(a => !controlledActivos.some(c => c.id === a.id));

        const rows = [];
        // Encontrados
        controlledActivos.forEach(a => {
            rows.push(['✓ ENCONTRADO', a.codigo_activo, a.descripcion || '', a.estado_actual || '', '', assetObservations[a.id] || '']);
        });
        // Faltantes
        pending.forEach(a => {
            rows.push(['✗ FALTANTE', a.codigo_activo, a.descripcion || '', a.estado_actual || '', '', '']);
            if (assetObservations[a.id]) {
                rows.push(['', '', `MOTIVO/OBS: ${assetObservations[a.id]}`, '', '', '', '']);
            } else {
                rows.push(['', '', 'SIN OBSERVACIÓN / PENDIENTE', '', '', '', '']);
            }
        });
        // Sobrantes / Ajenos
        surplusActivos.forEach(a => {
            rows.push([a.warning ? '⚠ AJENO' : '⬡ SOBRANTE', a.codigo_activo, a.descripcion || '', a.estado_actual || '', a.otherResp || '', assetObservations[a.id] || '']);
        });

        await exportToExcel({
            filename: `Auditoria_${selectedUser.nombre_completo.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`,
            sheetName: 'Auditoría',
            title: `INFORME DE AUDITORÍA — ${selectedUser.nombre_completo.toUpperCase()}`,
            subtitle: `CI: ${selectedUser.ci}  ·  Cargo: ${selectedUser.cargo || 'N/A'}  ·  Fecha: ${fechaHoy}  ·  Correctos: ${controlledActivos.length}  Faltantes: ${pending.length}  Sobrantes: ${surplusActivos.length}`,
            columns: ['Estado Auditoría', 'Código Activo', 'Descripción', 'Estado Sistema', 'Responsable Actual (si ajeno)', 'Observación'],
            rows,
            headerColor: 'FF1A237E',
            accentColor: 'FFE8EAF6',
        });
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

                // Fondo blanco para evitar transparencia negra en JPEG
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, targetW, targetH);
                ctx.drawImage(img, 0, 0, targetW, targetH);

                const logoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                doc.addImage(logoDataUrl, 'JPEG', ML, 8, 48, (48 * targetH) / targetW);
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
                    d.setFont('helvetica', 'normal'); d.setFontSize(7); d.setTextColor(60, 60, 60);
                    d.text('Zona Central - Calle Ayacucho Esq. Potosí', PW - MR, PH - 16, { align: 'right' });
                    d.text('Teléfonos: +591 (2) 2184178', PW - MR, PH - 12, { align: 'right' });
                    d.text(`Pág. ${i} / ${total}`, PW / 2, PH - 8, { align: 'center' });

                    // Iniciales del auditor actual
                    const initials = (currentUser?.nombre || 'SISTEMA').split(' ').map(n => n[0]).join('').toUpperCase();
                    d.setFontSize(5.5); d.setTextColor(100, 100, 100);
                    d.text(`USUARIO: ${initials}`, ML, PH - 20.5);
                }
            };

            let y = MT;

            // ─── TÍTULO ──────────────────────────────────────────
            doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(0, 0, 0);
            doc.text(`RELEVAMIENTO DE ACTIVOS FIJOS`, PW / 2, y, { align: 'center' });
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
                    startY: y + 2, margin: { left: ML, right: MR, bottom: MB + 10 }, tableWidth: contentW,
                    head: [['CÓDIGO', 'DESCRIPCIÓN', 'ESTADO SISTEMA', 'OBSERVACIÓN']],
                    body: controlledActivos.map(a => [
                        a.codigo_activo,
                        (a.descripcion || '').replace(/[\u007F-\uFFFF]/g, chr => {
                            const map = { '\u00D1': 'N', '\u00F1': 'n', '\u00C1': 'A', '\u00E1': 'a', '\u00C9': 'E', '\u00E9': 'e', '\u00CD': 'I', '\u00ED': 'i', '\u00D3': 'O', '\u00F3': 'o', '\u00DA': 'U', '\u00FA': 'u' };
                            return map[chr] || chr;
                        }),
                        a.estado_actual,
                        assetObservations[a.id] || ''
                    ]),
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
                    startY: y + 2, margin: { left: ML, right: MR, bottom: MB + 10 }, tableWidth: contentW,
                    head: [['CÓDIGO', 'DESCRIPCIÓN', 'ESTADO/MOTIVO']],
                    body: pending.flatMap(a => [
                        [
                            a.codigo_activo,
                            (a.descripcion || '').replace(/[\u007F-\uFFFF]/g, chr => {
                                const map = { '\u00D1': 'N', '\u00F1': 'n', '\u00C1': 'A', '\u00E1': 'a', '\u00C9': 'E', '\u00E9': 'e', '\u00CD': 'I', '\u00ED': 'i', '\u00D3': 'O', '\u00F3': 'o', '\u00DA': 'U', '\u00FA': 'u' };
                                return map[chr] || chr;
                            }),
                            'FALTANTE'
                        ],
                        [{
                            content: `OBSERVACIÓN: ${assetObservations[a.id] || 'NO LOCALIZADO / SIN JUSTIFICACIÓN'}`,
                            colSpan: 3,
                            styles: { fontStyle: 'italic', textColor: [150, 0, 0], fillColor: [255, 250, 250] }
                        }]
                    ]),
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
                    startY: y + 2, margin: { left: ML, right: MR, bottom: MB + 10 }, tableWidth: contentW,
                    head: [['CÓDIGO', 'DESCRIPCIÓN', 'RESPONSABLE ACTUAL / ESTADO', 'OBSERVACIÓN']],
                    body: surplusActivos.map(a => [
                        a.codigo_activo,
                        (a.descripcion || '').replace(/[\u007F-\uFFFF]/g, chr => {
                            const map = { '\u00D1': 'N', '\u00F1': 'n', '\u00C1': 'A', '\u00E1': 'a', '\u00C9': 'E', '\u00E9': 'e', '\u00CD': 'I', '\u00ED': 'i', '\u00D3': 'O', '\u00F3': 'o', '\u00DA': 'U', '\u00FA': 'u' };
                            return map[chr] || chr;
                        }),
                        a.warning ? `AJENO: ${a.otherResp || 'Otro'}` : (a.estado_actual || 'Disponible'),
                        assetObservations[a.id] || ''
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
            // Silently fail to protect technical info
            await showAlert('Error al generar el PDF del reporte.', { title: 'Error', type: 'error' });
        } finally {
            setPrinting(false);
        }
    };

    const filteredUsers = React.useMemo(() => {
        const t = (auditUserSearch || '').toLowerCase().trim();
        if (!t) return [];

        // Filtrar y dedubicar por nombre + CI
        const seen = new Set();
        return usuarios.filter(u => {
            const match = (u.nombre_completo || '').toLowerCase().includes(t) ||
                String(u.ci || '').includes(t);
            if (!match) return false;

            const key = `${u.nombre_completo}-${u.ci}-${u.institucion}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [usuarios, auditUserSearch]);

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
                        <h2 className="text-base font-semibold text-slate-900 leading-tight">Control de Activos por Funcionario</h2>
                        <p className="text-slate-400 text-xs font-medium">Auditoría, Sobrantes y Faltantes</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {selectedUser && (
                        <>
                            <button onClick={handleExportExcel} className="p-2.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-all flex items-center gap-2 text-[10px] font-semibold uppercase tracking-tight">
                                <Download size={16} /> Excel
                            </button>
                            <button disabled={printing} onClick={handlePrintPDF} className="p-2.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl hover:bg-rose-100 transition-all flex items-center gap-2 text-[10px] font-semibold uppercase tracking-tight disabled:opacity-50">
                                <FileText size={16} /> {printing ? 'Generando...' : 'Reporte PDF'}
                            </button>
                            <div className="w-px h-8 bg-slate-100 mx-1" />
                            <button onClick={handleResetAudit} className="p-2.5 bg-slate-50 text-slate-400 border border-slate-200 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center gap-2 text-[10px] font-semibold uppercase tracking-tight">
                                <X size={16} /> Reiniciar
                            </button>
                            <button
                                onClick={() => { setSelectedUser(null); setExpectedActivos([]); setControlledActivos([]); setSurplusActivos([]); }}
                                className="text-xs font-semibold text-slate-400 hover:text-slate-600 flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 transition-all active:scale-95"
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
                        <h3 className="text-lg font-semibold text-slate-800">Seleccionar Funcionario</h3>
                        <p className="text-slate-500 text-sm">Busca por nombre o CI para iniciar</p>
                    </div>

                    <div className="relative mb-4">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Ej. Juan Pérez o 1234567..."
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm font-medium"
                            value={auditUserSearch}
                            onChange={e => setAuditUserSearch(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                        {loading && <div className="py-10 text-center text-slate-400 animate-pulse flex flex-col items-center gap-2">
                            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            Buscando funcionarios...
                        </div>}
                        {auditUserSearch.length > 0 && filteredUsers.map(u => (
                            <button
                                key={u.id}
                                onClick={() => handleSelectUser(u)}
                                className="w-full p-3.5 flex items-center gap-4 hover:bg-indigo-50 rounded-2xl transition-all border border-transparent hover:border-indigo-100 group text-left"
                            >
                                <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center font-semibold group-hover:bg-white transition-colors uppercase">
                                    {u.nombre_completo.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <div className="font-semibold text-slate-800 text-sm truncate uppercase tracking-tight">{u.nombre_completo}</div>
                                        {u.institucion && (
                                            <span className={`text-[7px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-tighter shrink-0 ${getInstitutionStyle(u.institucion)}`}>
                                                {u.institucion}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{u.cargo} · CI: {u.ci}</div>
                                </div>
                                <div className="p-2 bg-slate-50 rounded-lg text-slate-300 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-all shadow-sm">
                                    <CheckCircle size={16} />
                                </div>
                            </button>
                        ))}
                        {auditUserSearch.length > 0 && filteredUsers.length === 0 && !loading && (
                            <div className="py-8 text-center text-slate-400 text-sm font-medium italic">No se encontraron coincidencias para "{auditUserSearch}"</div>
                        )}
                        {!loading && auditUserSearch.length === 0 && (
                            <div className="py-8 text-center text-slate-300 text-[10px] font-semibold uppercase tracking-[0.2em]">Escribe nombre o CI para filtrar</div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Panel Izquierdo: Datos y Escaneo */}
                    <div className="lg:col-span-4 space-y-5">
                        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-semibold text-lg shadow-lg shadow-indigo-500/20">
                                    {selectedUser.nombre_completo.charAt(0)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-semibold text-slate-900 text-xs leading-tight truncate uppercase tracking-tight">{selectedUser.nombre_completo}</h3>
                                        {selectedUser.institucion && (
                                            <span className={`text-[7px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-tighter shrink-0 ${getInstitutionStyle(selectedUser.institucion)}`}>
                                                {selectedUser.institucion}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-tighter">CI: {selectedUser.ci} · {selectedUser.cargo}</p>
                                </div>
                            </div>

                            <div className="space-y-2 mb-5">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Oficinas y Direcciones</p>
                                {selectedUser.oficinas_detalle ? selectedUser.oficinas_detalle.split(' | ').map((loc, idx) => (
                                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="p-1.5 bg-white rounded-lg border border-slate-200 text-indigo-500 shadow-sm">
                                            <MapPin size={14} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold text-slate-800 leading-tight uppercase">{loc.split(' (')[0]}</p>
                                            <p className="text-[8px] font-medium text-slate-500 uppercase mt-0.5 leading-relaxed">
                                                {loc.split(' (')[1]?.replace(')', '')}
                                            </p>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                                        <MapPin size={14} className="text-slate-300" />
                                        <p className="text-[10px] font-semibold text-slate-400 italic">No hay oficinas registradas</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest flex items-center justify-between">
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
                                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Sugerencias Base General</span>
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
                                                            <div className="flex items-center gap-2">
                                                                <div className="text-xs font-semibold text-slate-200 group-hover:text-blue-300 transition-colors uppercase">{s.codigo_activo}</div>
                                                                {s.institucion && (
                                                                    <span className={`text-[7px] font-semibold px-1 py-0.5 rounded border uppercase tracking-tighter shrink-0 ${getInstitutionStyle(s.institucion)}`}>
                                                                        {s.institucion}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 leading-relaxed font-medium lowercase">{s.descripcion}</div>
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
                                    className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-semibold text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    Validar Activo
                                </button>
                            </div>
                        </section>

                        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                            <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-4">Resumen Auditoría</h4>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl text-center cursor-pointer hover:bg-emerald-100/50 transition-colors" onClick={() => setActiveListTab('found')}>
                                    <p className="text-[9px] font-semibold text-emerald-600 uppercase mb-1">Correctos</p>
                                    <p className="text-2xl font-semibold text-emerald-700">{controlledActivos.length}</p>
                                </div>
                                <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl text-center cursor-pointer hover:bg-rose-100/50 transition-colors" onClick={() => setActiveListTab('pending')}>
                                    <p className="text-[9px] font-semibold text-rose-600 uppercase mb-1">Faltantes</p>
                                    <p className="text-2xl font-semibold text-rose-700">{pendingActivos.length}</p>
                                </div>
                            </div>
                            <div className={`p-3.5 rounded-2xl text-center border transition-colors cursor-pointer ${surplusActivos.length > 0 ? 'bg-amber-50 border-amber-200 hover:bg-amber-100/50' : 'bg-slate-50 border-slate-100'}`} onClick={() => setActiveListTab('surplus')}>
                                <p className={`text-[9px] font-semibold uppercase mb-1 ${surplusActivos.length > 0 ? 'text-amber-600' : 'text-slate-400'}`}>Sobrantes / Otros</p>
                                <p className={`text-2xl font-semibold ${surplusActivos.length > 0 ? 'text-amber-700' : 'text-slate-300'}`}>{surplusActivos.length}</p>
                            </div>
                        </section>
                    </div>

                    {/* Panel Derecho: Listas Categorizadas */}
                    <div className="lg:col-span-8 flex flex-col h-[calc(100vh-14rem)] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">

                        {/* Tabs Navegación */}
                        <div className="sticky top-0 z-10 flex border-b border-slate-100 bg-slate-50 p-2 gap-1 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => setActiveListTab('pending')}
                                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-semibold uppercase tracking-tight transition-all ${activeListTab === 'pending' ? 'bg-white shadow text-rose-600 border border-rose-100' : 'text-slate-400 hover:bg-white hover:text-slate-600'}`}
                            >
                                <ListFilter size={14} /> Faltantes ({pendingActivos.length})
                            </button>
                            <button
                                onClick={() => setActiveListTab('found')}
                                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-semibold uppercase tracking-tight transition-all ${activeListTab === 'found' ? 'bg-white shadow text-emerald-600 border border-emerald-100' : 'text-slate-400 hover:bg-white hover:text-slate-600'}`}
                            >
                                <CheckSquare size={14} /> Encontrados ({controlledActivos.length})
                            </button>
                            <button
                                onClick={() => setActiveListTab('surplus')}
                                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-semibold uppercase tracking-tight transition-all ${activeListTab === 'surplus' ? 'bg-white shadow text-amber-600 border border-amber-100' : 'text-slate-400 hover:bg-white hover:text-slate-600'}`}
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
                                            <p className="text-slate-400 text-sm font-semibold uppercase tracking-tight">¡Auditoría completa!</p>
                                            <p className="text-slate-300 text-xs">No hay activos faltantes en el sistema.</p>
                                        </div>
                                    ) : pendingActivos.map(a => (
                                        <div key={a.id} className="p-4 flex items-center gap-4 hover:bg-slate-50">
                                            <div className="p-2.5 bg-slate-100 text-slate-400 rounded-xl">
                                                <Package size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-mono font-semibold text-xs text-rose-600 uppercase leading-none">{a.codigo_activo}</div>
                                                    {a.institucion && (
                                                        <span className={`text-[7px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-tighter shrink-0 ${getInstitutionStyle(a.institucion)}`}>
                                                            {a.institucion}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-medium leading-relaxed max-w-sm break-words">{a.descripcion}</div>
                                                {assetObservations[a.id] && <div className="text-[9px] text-rose-500 font-semibold bg-rose-50/50 px-1.5 py-0.5 rounded border border-rose-100/50 mt-1 flex items-center gap-1.5 w-fit"> <AlertCircle size={10} /> {assetObservations[a.id]}</div>}
                                                {a.oficina && <div className="text-[9px] text-slate-400 font-semibold mt-0.5">📍 {a.oficina}</div>}
                                            </div>
                                            <div className="flex flex-col gap-1 items-end">
                                                <div className="px-2 py-1 bg-rose-50 border border-rose-100 rounded text-[9px] font-semibold text-rose-500 uppercase tracking-tighter">Faltante</div>
                                                <button onClick={() => handleSaveObservation(a, assetObservations[a.id])} className="text-[8px] font-semibold text-slate-400 hover:text-indigo-600 uppercase flex items-center gap-1 transition-colors">
                                                    <Printer size={10} /> {assetObservations[a.id] ? 'Editar Obs' : 'Añadir Obs'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeListTab === 'found' && (
                                <div className="divide-y divide-slate-50">
                                    {filteredFound.length === 0 ? (
                                        <div className="py-10 text-center text-slate-300 text-[10px] font-semibold uppercase italic tracking-widest py-20">No hay coincidencias en validados</div>
                                    ) : filteredFound.map(a => (
                                        <div key={a.id} className="p-4 flex items-center gap-4 bg-emerald-50/30">
                                            <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl">
                                                <CheckSquare size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-mono font-semibold text-xs text-emerald-700 uppercase leading-none">{a.codigo_activo}</div>
                                                    {a.institucion && (
                                                        <span className={`text-[7px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-tighter shrink-0 ${getInstitutionStyle(a.institucion)}`}>
                                                            {a.institucion}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-emerald-600/70 font-medium leading-relaxed max-w-sm break-words">{a.descripcion}</div>
                                                {assetObservations[a.id] && <div className="text-[9px] text-emerald-600 font-semibold bg-emerald-50/50 px-1.5 py-0.5 rounded border border-emerald-100/50 mt-1 flex items-center gap-1.5 w-fit"> <CheckCircle size={10} /> {assetObservations[a.id]}</div>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleSaveObservation(a, assetObservations[a.id])} className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all" title="Añadir Observación">
                                                    <Printer size={14} />
                                                </button>
                                                <div className="px-2 py-1 bg-emerald-100 border border-emerald-200 rounded text-[9px] font-semibold text-emerald-600 uppercase tracking-tighter">Correcto</div>
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
                                        <div className="py-10 text-center text-slate-300 text-[10px] font-semibold uppercase italic tracking-widest py-20">No hay coincidencias en sobrantes</div>
                                    ) : filteredSurplus.map(a => (
                                        <div key={a.id} className={`p-4 flex items-center gap-4 ${a.warning ? 'bg-amber-50' : 'bg-blue-50/50'}`}>
                                            <div className={`p-2.5 rounded-xl ${a.warning ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                                {a.warning ? <AlertTriangle size={18} /> : <Package size={18} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <div className={`font-mono font-semibold text-xs uppercase leading-none ${a.warning ? 'text-amber-700' : 'text-blue-700'}`}>{a.codigo_activo}</div>
                                                    {a.institucion && (
                                                        <span className={`text-[7px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-tighter shrink-0 ${getInstitutionStyle(a.institucion)}`}>
                                                            {a.institucion}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={`text-[10px] font-medium leading-relaxed max-w-sm break-words ${a.warning ? 'text-amber-600' : 'text-blue-600'}`}>{a.descripcion}</div>
                                                {a.warning && (
                                                    <div className="text-[9px] font-semibold text-rose-500 mt-1 uppercase flex items-center gap-1">
                                                        <AlertCircle size={10} /> Asignado a: {a.otherResp}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className={`px-2 py-1 border rounded text-[9px] font-semibold uppercase tracking-tighter ${a.warning ? 'bg-rose-100 border-rose-200 text-rose-600' : 'bg-blue-100 border-blue-200 text-blue-600'}`}>
                                                    {a.warning ? '¡Ajeno!' : 'Sobrante'}
                                                </div>

                                                {!a.warning && (
                                                    <button
                                                        onClick={() => handleOpenAssignModal(a)}
                                                        className="px-2 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[9px] font-bold uppercase hover:bg-emerald-100 transition-colors"
                                                    >
                                                        Asignar
                                                    </button>
                                                )}

                                                <button onClick={() => handleDeleteAuditItem(a.id, 'surplus')} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Eliminar definitivamente">
                                                    <Trash2 size={14} />
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

            {/* Modal de Asignación de Sobrante */}
            <Modal
                isOpen={!!assigningAsset}
                onClose={() => setAssigningAsset(null)}
                title="Completar Registro y Asignar Sobrante"
                size="lg"
            >
                <div className="space-y-5">
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                        <AlertCircle className="text-blue-500 shrink-0" size={20} />
                        <div>
                            <p className="text-xs font-bold text-blue-700 uppercase">Información del Activo</p>
                            <p className="text-[10px] text-blue-600 leading-tight mt-0.5">
                                Código: <span className="font-mono font-bold">{assigningAsset?.codigo_activo}</span>
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Descripción Completa</label>
                            <textarea
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none h-20"
                                value={assignFormData.descripcion}
                                onChange={e => setAssignFormData({ ...assignFormData, descripcion: e.target.value })}
                                placeholder="Ej: Monitor LED 24' Marca Dell..."
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Grupo Contable</label>
                            <select
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                value={assignFormData.cat_grupo_contable_id}
                                onChange={e => setAssignFormData({ ...assignFormData, cat_grupo_contable_id: e.target.value })}
                            >
                                <option value="">Seleccione Grupo</option>
                                {catalogos.grupos.map(g => (
                                    <option key={g.id} value={g.id}>{g.nombre}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Auxiliar</label>
                            <select
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                value={assignFormData.cat_auxiliar_id}
                                onChange={e => setAssignFormData({ ...assignFormData, cat_auxiliar_id: e.target.value })}
                            >
                                <option value="">Seleccione Auxiliar</option>
                                {catalogos.auxiliares
                                    .filter(a => !assignFormData.cat_grupo_contable_id || a.cat_grupo_contable_id === parseInt(assignFormData.cat_grupo_contable_id))
                                    .map(a => (
                                        <option key={a.id} value={a.id}>{a.nombre}</option>
                                    ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Origen</label>
                            <select
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                value={assignFormData.origen}
                                onChange={e => setAssignFormData({ ...assignFormData, origen: e.target.value })}
                            >
                                <option value="Compra">Compra</option>
                                <option value="Sobrante">Sobrante</option>
                                <option value="Donación">Donación</option>
                            </select>
                        </div>

                        <div className="md:col-span-2 p-3 bg-indigo-50/50 border border-indigo-100/50 rounded-xl overflow-hidden">
                            <p className="text-[10px] text-indigo-700 font-bold mb-1 flex items-center gap-2">
                                <MapPin size={12} /> HEREDAR UBICACIÓN ACTUAL:
                            </p>
                            <p className="text-[9px] text-indigo-600 font-medium leading-relaxed italic">
                                Se registrará en: {selectedUser?.edificio || 'N/A'} - {selectedUser?.unidad || 'N/A'} - {selectedUser?.oficina || 'N/A'}
                                <br />
                                <span className="text-indigo-500 not-italic">Dirección: {selectedUser?.edificio_direccion || 'No especificada'}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => setAssigningAsset(null)}
                            className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-slate-200 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirmAssignment}
                            className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
                        >
                            Confirmar Asignación
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ControlActivosView;
