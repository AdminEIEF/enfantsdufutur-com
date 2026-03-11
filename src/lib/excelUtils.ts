import ExcelJS from 'exceljs';

export interface ExcelHeaderInfo {
  schoolName: string;
  niveau: string;
  classe: string;
  garcons: number;
  filles: number;
  total: number;
}

/**
 * Export data to an Excel file and trigger download
 */
export async function exportToExcel(data: Record<string, any>[], filename: string, sheetName = 'Données', headerInfo?: ExcelHeaderInfo) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  if (data.length === 0) return;

  const keys = Object.keys(data[0]);
  const colCount = keys.length;

  let dataStartRow = 1;

  if (headerInfo) {
    // Row 1: School name (bold, centered, merged)
    worksheet.mergeCells(1, 1, 1, colCount);
    const schoolCell = worksheet.getCell(1, 1);
    schoolCell.value = headerInfo.schoolName;
    schoolCell.font = { bold: true, size: 14 };
    schoolCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 2: Niveau
    worksheet.mergeCells(2, 1, 2, colCount);
    const niveauCell = worksheet.getCell(2, 1);
    niveauCell.value = `Niveau : ${headerInfo.niveau}`;
    niveauCell.font = { bold: true, size: 12 };
    niveauCell.alignment = { horizontal: 'center' };

    // Row 3: Classe
    worksheet.mergeCells(3, 1, 3, colCount);
    const classeCell = worksheet.getCell(3, 1);
    classeCell.value = `Classe : ${headerInfo.classe}`;
    classeCell.font = { bold: true, size: 12 };
    classeCell.alignment = { horizontal: 'center' };

    // Row 4: Effectifs
    worksheet.mergeCells(4, 1, 4, colCount);
    const effectifCell = worksheet.getCell(4, 1);
    effectifCell.value = `Effectif : ${headerInfo.total}  |  Garçons : ${headerInfo.garcons}  |  Filles : ${headerInfo.filles}`;
    effectifCell.font = { bold: true, size: 11 };
    effectifCell.alignment = { horizontal: 'center' };

    // Row 5: empty separator
    dataStartRow = 6;

    // Set column widths manually (don't use worksheet.columns which overwrites row 1)
    keys.forEach((key, i) => {
      const col = worksheet.getColumn(i + 1);
      col.width = Math.max(key.length, ...data.map(row => String(row[key] ?? '').length)) + 2;
    });

    // Table header row at dataStartRow
    const headerRow = worksheet.getRow(dataStartRow);
    keys.forEach((key, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = key;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      cell.alignment = { horizontal: 'center' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
      };
    });
    headerRow.commit();

    // Data rows
    data.forEach((row, idx) => {
      const dataRow = worksheet.getRow(dataStartRow + 1 + idx);
      keys.forEach((key, i) => {
        dataRow.getCell(i + 1).value = row[key];
      });
      dataRow.commit();
    });
  } else {
    // Simple mode
    worksheet.columns = keys.map(key => ({
      header: key,
      key,
      width: Math.max(key.length, ...data.map(row => String(row[key] ?? '').length)) + 2,
    }));
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    data.forEach(row => worksheet.addRow(row));
  }

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Read an Excel file and return rows as objects
 */
export function readExcelFile(file: File): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) { resolve([]); return; }

        const headers: string[] = [];
        worksheet.getRow(1).eachCell((cell, colNumber) => {
          headers[colNumber - 1] = String(cell.value ?? '');
        });

        const rows: Record<string, any>[] = [];
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // skip header
          const obj: Record<string, any> = {};
          row.eachCell((cell, colNumber) => {
            const key = headers[colNumber - 1];
            if (key) obj[key] = cell.value;
          });
          if (Object.keys(obj).length > 0) rows.push(obj);
        });

        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsArrayBuffer(file);
  });
}
