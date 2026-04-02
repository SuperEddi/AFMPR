/**
 * Utilidad compartida para exportar datos a Excel (.xlsx)
 * con formato profesional: colores, bordes, anchos automáticos.
 */
import ExcelJS from 'exceljs';

/**
 * @param {Object} opts
 * @param {string}   opts.filename         - Nombre del archivo sin extensión
 * @param {string}   opts.sheetName        - Nombre de la hoja
 * @param {string}   opts.title            - Título del reporte (fila 1)
 * @param {string}   opts.subtitle         - Subtítulo / info (fila 2)
 * @param {string[]} opts.columns          - Encabezados de columnas
 * @param {Array[]}  opts.rows             - Filas de datos (arrays de valores)
 * @param {string}   opts.headerColor      - Color ARGB del encabezado (ej. 'FF1E3A5F')
 * @param {string}   opts.accentColor      - Color de filas alternas (ej. 'FFE8F0FE')
 */
export async function exportToExcel({
    filename,
    sheetName = 'Reporte',
    title,
    subtitle,
    columns,
    rows,
    headerColor = 'FF1E3A5F',
    accentColor = 'FFE8F4FD',
}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema Activos Presidencia';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(sheetName, {
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
    });

    const totalCols = columns.length;

    // ── Fila 1: Título ──────────────────────────────────────────
    sheet.mergeCells(1, 1, 1, totalCols);
    const titleRow = sheet.getRow(1);
    titleRow.height = 32;
    const titleCell = sheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // ── Fila 2: Subtítulo ──────────────────────────────────────
    sheet.mergeCells(2, 1, 2, totalCols);
    const subRow = sheet.getRow(2);
    subRow.height = 18;
    const subCell = sheet.getCell('A2');
    subCell.value = subtitle;
    subCell.font = { italic: true, size: 9, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // ── Fila 3: vacía separador ────────────────────────────────
    sheet.addRow([]);

    // ── Fila 4: Encabezados de columnas ───────────────────────
    const headerRow = sheet.addRow(columns);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
            left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
            bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
            right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        };
    });

    // ── Filas de datos ─────────────────────────────────────────
    rows.forEach((rowData, idx) => {
        const dataRow = sheet.addRow(rowData);
        dataRow.height = 18;
        const isEven = idx % 2 === 0;
        dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.font = { size: 9, name: 'Calibri', color: { argb: 'FF1A1A2E' } };
            cell.fill = {
                type: 'pattern', pattern: 'solid',
                fgColor: { argb: isEven ? accentColor : 'FFFFFFFF' }
            };
            cell.alignment = { vertical: 'middle', wrapText: colNumber === 3 };
            cell.border = {
                top: { style: 'hair', color: { argb: 'FFD0D7E0' } },
                left: { style: 'hair', color: { argb: 'FFD0D7E0' } },
                bottom: { style: 'hair', color: { argb: 'FFD0D7E0' } },
                right: { style: 'hair', color: { argb: 'FFD0D7E0' } },
            };
        });
    });

    // ── Ancho automático de columnas ───────────────────────────
    sheet.columns.forEach((col, i) => {
        const header = columns[i] || '';
        const maxDataLen = rows.reduce((max, row) => {
            const val = String(row[i] ?? '');
            return Math.max(max, val.length);
        }, 0);
        const width = Math.min(Math.max(header.length + 4, maxDataLen + 2, 10), 50);
        col.width = width;
    });

    // ── Fila de totales al pie ─────────────────────────────────
    const totalRow = sheet.addRow([`Total: ${rows.length} registros`]);
    sheet.mergeCells(totalRow.number, 1, totalRow.number, totalCols);
    totalRow.getCell(1).font = { bold: true, italic: true, size: 9, color: { argb: 'FF555577' } };
    totalRow.getCell(1).alignment = { horizontal: 'right' };

    // ── Descargar ──────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}
