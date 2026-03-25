const ExcelJS = require("exceljs");

function normalizeCellValue(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    if (value.text) return String(value.text).trim();
    if (value.hyperlink && value.text) return String(value.text).trim();
    if (value.result !== undefined && value.result !== null) return value.result;
    if (Array.isArray(value.richText)) {
      return value.richText.map(part => part.text || "").join("").trim();
    }
    return JSON.stringify(value);
  }

  return String(value).trim();
}

async function parseExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers = [];
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = String(normalizeCellValue(cell.value) || "").trim();
  });

  const rows = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const obj = {};
    headers.forEach((header, colNumber) => {
      if (!header) return;
      obj[header] = normalizeCellValue(row.getCell(colNumber).value);
    });

    rows.push(obj);
  });

  return rows;
}

module.exports = {
  parseExcel
};