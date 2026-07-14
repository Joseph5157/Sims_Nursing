const ExcelJS = require('exceljs');

// Builds a single-sheet workbook with a styled header row (bold white text on
// brand-blue fill) and returns the .xlsx buffer. `columns` follows ExcelJS's
// `sheet.columns` shape: [{ header, key, width }]. `rows` are plain objects
// keyed to match `columns[].key`.
async function buildWorkbook(sheetName, columns, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns;

  sheet.getRow(1).eachCell((cell) => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  sheet.getRow(1).height = 22;

  rows.forEach((row) => sheet.addRow(row));

  return workbook.xlsx.writeBuffer();
}

// Sends an .xlsx buffer as a file download with the standard headers.
function sendWorkbook(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

module.exports = { buildWorkbook, sendWorkbook };
