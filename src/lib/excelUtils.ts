import ExcelJS from 'exceljs';

/**
 * Export data to an Excel file and trigger download
 */
export async function exportToExcel(data: Record<string, any>[], filename: string, sheetName = 'Données') {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  if (data.length === 0) return;

  // Set columns from keys
  const keys = Object.keys(data[0]);
  worksheet.columns = keys.map(key => ({
    header: key,
    key,
    width: Math.max(key.length, ...data.map(row => String(row[key] ?? '').length)) + 2,
  }));

  // Add rows
  data.forEach(row => worksheet.addRow(row));

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
