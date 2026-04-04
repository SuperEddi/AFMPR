import React, { useState, useRef, useEffect } from 'react';
import {
    Upload, Download, Database, CheckCircle, AlertTriangle,
    FileText, ArrowRight, Table as TableIcon, Settings2,
    Trash2, XCircle, ChevronDown, Zap, Eye
} from 'lucide-react';
import { AppDialog, useDialog } from '../components/AppDialog';

// ─── Definición de tablas y sus plantillas ─────────────────────────────────
const TABLES = [
    {
        id: 'full',
        label: 'Completa — Usuarios + Activos',
        icon: Database,
        color: 'text-indigo-600',
        bg: 'bg-indigo-50',
        border: 'border-indigo-300',
        fields: ['codigo_activo', 'descripcion', 'estado_actual', 'responsable_nombre', 'responsable_ci', 'responsable_cargo', 'unidad', 'oficina', 'piso'],
        sample: [
            ['MDRYTVT-001', 'Monitor HP 24"', 'SN123456', 'Asignado', 'Juan Perez', '1234567', 'Técnico', 'Sistemas', 'Ofic. 1', 'Piso 1'],
            ['MDRYTVT-002', 'Teclado Logitech', 'SN789012', 'Disponible', '', '', '', '', '', ''],
        ]
    },
    {
        id: 'assets',
        label: 'Solo Activos',
        icon: TableIcon,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-300',
        fields: ['codigo_activo', 'descripcion', 'estado_actual'],
        sample: [
            ['MDRYTVT-001', 'Monitor HP 24"', 'SN123456', 'Disponible'],
            ['MDRYTVT-002', 'Teclado Logitech', 'SN789012', 'Disponible'],
        ]
    },
    {
        id: 'users',
        label: 'Solo Usuarios / Responsables',
        icon: FileText,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        border: 'border-blue-300',
        fields: ['nombre_completo', 'ci', 'cargo'],
        sample: [
            ['Juan Perez Quispe', '1234567', 'Técnico'],
            ['Ana Lopez Mamani', '7654321', 'Secretaria'],
        ]
    },
    {
        id: 'pisos',
        label: 'Catálogo: Pisos',
        icon: TableIcon,
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-300',
        fields: ['numero'],
        sample: [
            ['Piso 1'],
            ['Planta Baja'],
            ['Mezzanine'],
        ]
    },
    {
        id: 'ubicaciones',
        label: 'Catálogo: Ubicaciones Físicas (Edificios)',
        icon: TableIcon,
        color: 'text-purple-600',
        bg: 'bg-purple-50',
        border: 'border-purple-300',
        fields: ['nombre', 'direccion', 'observaciones'],
        sample: [
            ['Edificio Central', 'Av. 20 de Octubre', 'Oficinas Administrativas'],
            ['Almacén El Alto', 'Calle 5 La Ceja', 'Depósito de activos'],
        ]
    },
    {
        id: 'auxiliares',
        label: 'Catálogo: Auxiliares',
        icon: Zap,
        color: 'text-rose-600',
        bg: 'bg-rose-50',
        border: 'border-rose-300',
        fields: ['nombre'],
        sample: [
            ['Muebles de Oficina'],
            ['Equipos de Computación'],
            ['Vehículos'],
        ]
    },
    {
        id: 'grupos',
        label: 'Catálogo: Grupos Contables',
        icon: Settings2,
        color: 'text-cyan-600',
        bg: 'bg-cyan-50',
        border: 'border-cyan-300',
        fields: ['nombre', 'vida_util', 'observaciones'],
        sample: [
            ['Maquinaria y Equipo', '8', 'Vigencia según norma'],
            ['Herramientas General', '4', 'Uso rudo'],
        ]
    }
];

const SEPARATORS = [
    { label: 'Barra  |', value: '|' },
    { label: 'Punto y Coma  ;', value: ';' },
    { label: 'Coma  ,', value: ',' },
    { label: 'Tabulación  →', value: '\t' },
];

// ─── Componente Principal ──────────────────────────────────────────────────
const MigracionView = ({ authFetch = fetch }) => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [password, setPassword] = useState('');
    const [separator, setSeparator] = useState('|');
    const [autoDetected, setAutoDetected] = useState(false);
    const [tableType, setTableType] = useState('full');
    const [previewData, setPreviewData] = useState([]);
    const { showAlert, dialogProps } = useDialog();
    const [previewHeaders, setPreviewHeaders] = useState([]);
    const [rawText, setRawText] = useState('');
    const [fileName, setFileName] = useState('');
    const fileInputRef = useRef(null);

    const selectedTable = TABLES.find(t => t.id === tableType);

    // Re-parsear en tiempo real cuando cambia el separador o el texto
    useEffect(() => {
        if (rawText && selectedTable) {
            const { headers, data } = parseCSV(rawText, separator, selectedTable.fields);
            setPreviewHeaders(headers);
            setPreviewData(data);
            if (headers.length <= 1 && data.length > 0 && Object.keys(data[0]).length <= 2) {
                setError('⚠ Verifica el separador. Parecen no coincidir las columnas.');
            } else {
                setError(null);
            }
        }
    }, [separator, rawText, selectedTable]);

    // ─── Utilidades ─────────────────────────────────────────────────────────
    const autoDetectSeparator = (text) => {
        const firstLine = text.split(/\r?\n/)[0] || '';
        const counts = {
            '|': (firstLine.match(/\|/g) || []).length,
            ';': (firstLine.match(/;/g) || []).length,
            ',': (firstLine.match(/,/g) || []).length,
            '\t': (firstLine.match(/\t/g) || []).length,
        };
        let best = '|', max = 0;
        for (const [sep, count] of Object.entries(counts)) {
            if (count > max) { max = count; best = sep; }
        }
        return best;
    };

    const cleanQuotes = (str) => {
        if (!str) return '';
        let cleaned = str.trim();
        cleaned = cleaned.replace(/^["']+|["']+$/g, '');
        return cleaned.trim();
    };

    const parseCSV = (text, usedSeparator, expectedFields) => {
        try {
            // Eliminar espacios vacíos y limpiar comillas completas de la fila que el excel a veces agrega
            const lines = text.split(/\r?\n/).filter(l => l.trim() !== '').map(l => l.trim().replace(/^"+|"+$/g, ''));
            if (!lines.length) return { headers: [], data: [] };

            const split = (line) => line.split(usedSeparator).map(cleanQuotes);
            let headers = split(lines[0]);
            let dataStartIndex = 1;

            const firstDataRow = lines.length > 1 ? split(lines[1]) : [];

            // Auto-asignación inteligente de cabeceras si faltan o si la cabecera es el basura "datos"
            const firstRowRaw = split(lines[0]);
            const isSingleColNoHeader = expectedFields && expectedFields.length === 1 && firstRowRaw.length === 1 && firstRowRaw[0].toLowerCase() !== expectedFields[0].toLowerCase();

            if (expectedFields && (headers.length < firstDataRow.length || headers[0].toLowerCase() === 'datos' || isSingleColNoHeader)) {
                const colsCount = Math.max(headers.length, firstDataRow.length);
                headers = expectedFields.slice(0, colsCount);

                // Si detectamos que no hay cabecera (es info real), empezamos desde la fila 0
                if (isSingleColNoHeader) {
                    dataStartIndex = 0;
                } else if (split(lines[0]).length <= 1 && lines[0].toLowerCase().includes('datos')) {
                    dataStartIndex = 1;
                } else {
                    dataStartIndex = 0;
                }
            }

            const data = lines.slice(dataStartIndex).map((line, idx) => {
                const values = split(line);
                const obj = { _id: idx };
                headers.forEach((h, i) => { obj[h] = values[i] || ''; });
                return obj;
            });
            return { headers, data };
        } catch { return { headers: [], data: [] }; }
    };

    // ─── Descarga de Plantilla ───────────────────────────────────────────────
    const downloadTemplate = () => {
        const { fields, sample } = selectedTable;
        const sep = separator;
        const lines = [fields.join(sep), ...sample.map(r => r.join(sep))];
        const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Plantilla_${tableType}_sep${sep === '\t' ? 'TAB' : sep}.csv`;
        link.click();
    };

    // ─── Carga de Archivo ────────────────────────────────────────────────────
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target.result;
            setRawText(text);
            setResult(null);
            setError(null);

            // Auto-detectar separador
            const firstLine = text.split(/\r?\n/)[0] || '';
            const colsWithCurrent = firstLine.split(separator).length;
            if (colsWithCurrent <= 1) {
                const detected = autoDetectSeparator(text);
                setSeparator(detected);
                setAutoDetected(true);
            } else {
                setAutoDetected(false);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };

    // ─── Migración ───────────────────────────────────────────────────────────
    const handleMigrate = async () => {
        if (!password) { await showAlert('Debe ingresar la contraseña de administrador.', { title: 'Contraseña requerida', type: 'warning' }); return; }
        if (!previewData.length) { await showAlert('No hay datos para migrar.', { title: 'Sin datos', type: 'info' }); return; }
        setLoading(true); setError(null); setResult(null);
        try {
            const res = await authFetch('/api/migrate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
                body: JSON.stringify({ data: previewData, type: tableType })
            });
            const resData = await res.json();
            if (res.ok) {
                setResult(resData);
                setPreviewData([]);
                setRawText('');
                setFileName('');
                window.dispatchEvent(new CustomEvent('data-updated'));
            } else {
                setError(resData.error || 'Error durante la migración.');
            }
        } catch { setError('Error de conexión con el servidor.'); }
        finally { setLoading(false); }
    };

    // ─── Edición inline ──────────────────────────────────────────────────────
    const updateCell = (rowIndex, header, value) => {
        const nd = [...previewData];
        nd[rowIndex][header] = value;
        setPreviewData(nd);
    };
    const removeRow = (id) => setPreviewData(previewData.filter(r => r._id !== id));

    // ─── Validación de columnas ──────────────────────────────────────────────
    const missingCols = selectedTable.fields.filter(f => !previewHeaders.includes(f));
    const extraCols = previewHeaders.filter(h => !selectedTable.fields.includes(h));

    const sepLabel = SEPARATORS.find(s => s.value === separator)?.label || separator;

    return (
        <>
            <div className="max-w-6xl mx-auto space-y-5 pb-20">

                {/* ─── Header ─── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/30">
                            <Database size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 leading-tight">Migración Inteligente</h2>
                            <p className="text-slate-400 text-xs font-medium">Carga masiva · detección automática · vista previa editable</p>
                        </div>
                    </div>
                </div>

                {/* ─── Panel de Configuración ─── */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-5">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Settings2 size={13} className="text-indigo-400" /> Configuración
                    </h3>

                    <div className="grid sm:grid-cols-2 gap-5">
                        {/* Tabla destino */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase block">Tabla Destino</label>
                            <div className="relative">
                                <select
                                    value={tableType}
                                    onChange={e => setTableType(e.target.value)}
                                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 cursor-pointer"
                                >
                                    {TABLES.map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                </select>
                                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                            {/* Campos requeridos */}
                            <div className="flex flex-wrap gap-1 pt-1">
                                {selectedTable.fields.map(f => (
                                    <span key={f} className="bg-indigo-50 text-indigo-600 text-[9px] font-black px-2 py-0.5 rounded-md border border-indigo-100">{f}</span>
                                ))}
                            </div>
                        </div>

                        {/* Separador */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2">
                                Separador de CSV
                                {autoDetected && (
                                    <span className="flex items-center gap-1 text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                                        <Zap size={9} /> Auto-detectado
                                    </span>
                                )}
                            </label>
                            <div className="grid grid-cols-2 gap-1.5">
                                {SEPARATORS.map(sep => (
                                    <button
                                        key={sep.value}
                                        onClick={() => { setSeparator(sep.value); setAutoDetected(false); }}
                                        className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${separator === sep.value
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/30'
                                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        {sep.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Descarga de plantilla */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                        <div>
                            <p className="text-xs font-black text-slate-700">Descargar plantilla lista para llenar</p>
                            <p className="text-[10px] text-slate-400">Formato: <span className="font-bold text-indigo-600">{selectedTable.label}</span> · Separador: <span className="font-bold text-indigo-600">{sepLabel}</span></p>
                        </div>
                        <button
                            onClick={downloadTemplate}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all active:scale-95 whitespace-nowrap"
                        >
                            <Download size={14} /> Descargar Plantilla
                        </button>
                    </div>
                </div>

                {/* ─── Zona de Carga ─── */}
                <div
                    className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-4 hover:border-indigo-300 transition-colors cursor-pointer group"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { const input = fileInputRef.current; const dt = new DataTransfer(); dt.items.add(f); input.files = dt.files; handleFileUpload({ target: input }); } }}
                >
                    <div className="w-14 h-14 bg-slate-50 group-hover:bg-indigo-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-indigo-400 transition-colors shadow-inner">
                        <Upload size={28} />
                    </div>
                    <div>
                        {fileName ? (
                            <>
                                <p className="font-black text-slate-800 text-sm">{fileName}</p>
                                <p className="text-slate-400 text-xs mt-0.5">Haz clic para cambiar archivo</p>
                            </>
                        ) : (
                            <>
                                <p className="font-black text-slate-700 text-base">Arrastra o haz clic para cargar</p>
                                <p className="text-slate-400 text-xs mt-1">Archivos .CSV · detección automática de separador</p>
                            </>
                        )}
                    </div>
                    <button
                        onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-black text-xs shadow-xl hover:bg-indigo-600 transition-all active:scale-95"
                    >
                        SELECCIONAR ARCHIVO CSV
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.txt" className="hidden" />
                </div>

                {/* ─── INDICADOR TIEMPO REAL cuando hay texto pero sin datos ─── */}
                {rawText && !previewData.length && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                        <AlertTriangle size={18} className="text-amber-500 shrink-0" />
                        <p className="text-amber-800 text-xs font-bold">No se pudieron separar columnas. Cambia el separador o verifica el formato del archivo.</p>
                    </div>
                )}

                {/* ─── Vista Previa ─── */}
                {previewData.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">

                        {/* Cabecera de la preview */}
                        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                                    <Eye size={16} />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 text-sm">Vista Previa en Tiempo Real</h3>
                                    <p className="text-[10px] text-slate-400 font-medium">
                                        {previewData.length} filas · {previewHeaders.length} columnas · Separador: <span className="text-indigo-600 font-black">{sepLabel}</span>
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => { setPreviewData([]); setRawText(''); setFileName(''); }} className="text-slate-300 hover:text-rose-500 transition-colors">
                                <XCircle size={20} />
                            </button>
                        </div>

                        {/* Alertas de columnas */}
                        {(missingCols.length > 0 || extraCols.length > 0) && (
                            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 space-y-1.5">
                                {missingCols.length > 0 && (
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle size={13} className="text-amber-600 mt-0.5 shrink-0" />
                                        <p className="text-[10px] font-bold text-amber-800">
                                            Columnas esperadas faltantes: {' '}
                                            {missingCols.map(c => <span key={c} className="bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded mr-1 font-black">{c}</span>)}
                                        </p>
                                    </div>
                                )}
                                {extraCols.length > 0 && (
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle size={13} className="text-slate-400 mt-0.5 shrink-0" />
                                        <p className="text-[10px] font-bold text-slate-500">
                                            Columnas extra (se ignorarán): {' '}
                                            {extraCols.map(c => <span key={c} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded mr-1">{c}</span>)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tabla editable */}
                        <div className="overflow-x-auto max-h-[420px] overflow-y-auto custom-scrollbar border-b border-slate-100">
                            <table className="w-full text-left border-collapse table-auto">
                                <thead className="sticky top-0 bg-slate-100 z-20">
                                    <tr>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase w-10 text-center border-r border-slate-200">#</th>
                                        {previewHeaders.map(h => {
                                            const isExpected = selectedTable.fields.includes(h);
                                            const isMissing = !isExpected;
                                            return (
                                                <th key={h} className={`px-4 py-3 text-[10px] font-black uppercase tracking-wider min-w-[140px] whitespace-nowrap ${isExpected ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                    {h}
                                                    {isMissing && <span className="ml-1 text-[8px] bg-slate-200 text-slate-500 px-1 rounded">extra</span>}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {previewData.slice(0, 100).map((row, idx) => (
                                        <tr key={row._id} className="hover:bg-indigo-50/30 transition-colors group">
                                            <td className="px-4 py-2 border-r border-slate-100 text-center">
                                                <button onClick={() => removeRow(row._id)} className="text-slate-200 hover:text-rose-500 transition-colors p-1 hover:bg-rose-50 rounded-lg">
                                                    <Trash2 size={13} />
                                                </button>
                                            </td>
                                            {previewHeaders.map(h => {
                                                const isEmpty = !row[h] || row[h].trim() === '';
                                                const isRequired = selectedTable.fields.includes(h) && ['codigo_activo', 'descripcion', 'nombre_completo', 'ci'].includes(h);
                                                const hasError = isRequired && isEmpty;
                                                return (
                                                    <td key={h} className="px-4 py-1.5">
                                                        <input
                                                            type="text"
                                                            value={row[h] || ''}
                                                            onChange={e => updateCell(idx, h, e.target.value)}
                                                            className={`w-full bg-transparent text-[11px] font-bold outline-none focus:bg-white px-2 py-1 rounded transition-all border ${hasError
                                                                ? 'border-rose-300 text-rose-600 bg-rose-50/50 focus:ring-rose-200'
                                                                : 'border-transparent text-slate-700 focus:border-indigo-200 focus:text-indigo-700'
                                                                } focus:ring-2 focus:ring-indigo-100`}
                                                        />
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {previewData.length > 100 && (
                                <div className="p-3 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest bg-slate-50">
                                    Mostrando primeros 100 de {previewData.length} registros
                                </div>
                            )}
                        </div>

                        {/* Pie: Contraseña + Botón Migrar */}
                        <div className="p-5 bg-slate-50/80 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-5">
                            <div className="space-y-1.5 w-full md:max-w-xs">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contraseña de Administrador</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Ingresa la clave para confirmar"
                                    className="w-full px-4 py-3 rounded-xl border border-indigo-100 outline-none focus:ring-2 focus:ring-indigo-500/30 font-bold text-sm shadow-sm"
                                />
                            </div>
                            <button
                                onClick={handleMigrate}
                                disabled={loading || !previewData.length}
                                className="w-full md:w-auto flex items-center justify-center gap-3 px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-2xl shadow-indigo-500/40 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group text-sm"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>PROCESANDO...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>INICIAR MIGRACIÓN ({previewData.length} registros)</span>
                                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── Resultado ─── */}
                {result && (
                    <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl flex items-start gap-4 animate-in fade-in">
                        <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/30">
                            <CheckCircle size={22} />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-emerald-900 font-black text-base">¡Migración Completada!</h4>
                            <p className="text-emerald-600 text-xs mt-0.5">Los datos ya están disponibles en el sistema.</p>
                            <div className="grid grid-cols-3 gap-3 mt-4">
                                <StatBox label="Activos" value={result.created_assets ?? '—'} color="emerald" />
                                <StatBox label="Usuarios" value={result.created_users ?? '—'} color="blue" />
                                <StatBox label="Errores" value={result.failed ?? 0} color="rose" />
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── Error ─── */}
                {error && (
                    <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl flex items-center gap-4 animate-in fade-in">
                        <div className="p-2 bg-rose-500 text-white rounded-lg shrink-0">
                            <AlertTriangle size={18} />
                        </div>
                        <p className="text-rose-800 font-bold text-sm">{error}</p>
                    </div>
                )}
            </div>
            <AppDialog {...dialogProps} />
        </>
    );
};

const StatBox = ({ label, value, color }) => {
    const cls = { emerald: 'text-emerald-600', blue: 'text-indigo-600', rose: 'text-rose-600' };
    return (
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{label}</span>
            <span className={`text-2xl font-black mt-1 block ${cls[color]}`}>{value}</span>
        </div>
    );
};

export default MigracionView;
