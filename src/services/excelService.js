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

function buildKitsFromRows(rows) {
  const kitsMap = new Map();

  rows.forEach((row, index) => {
    const partId =
      String(row.PARTID || row.PartID || row.part_id || "").trim();

    if (!partId) return;

    const componentId =
      String(row.ComponentID || row.COMPONENTID || row.component_id || row.ProductName || "").trim();

    const productName =
      String(row.ProductName || row.PRODUCTNAME || componentId || "").trim();

    const langCode =
      String(row.LangCode || row.LANGCODE || row.lang_code || "").trim();

    const defaultComponentQty = Number(
      row.DefaultComponentQty || row.DEFAULTCOMPONENTQTY || row.default_component_qty || 1
    ) || 1;

    const defaultKitQty = Number(
      row.DefaultKitQty || row.DEFAULTKITQTY || row.default_kit_qty || 1
    ) || 1;

    const q2StandardQuotation = String(
      row.Q2StandardQuotation || row.q2_standard_quotation || row["Standard quotation"] || ""
    ).trim();

    const q3Height = String(
      row.Q3Height || row.q3_height || row.Height || ""
    ).trim();

    const q4Width = String(
      row.Q4Width || row.q4_width || row.Width || ""
    ).trim();

    const pressersoIdNumber = String(
      row.PressersoIdNumber || row.presserso_id_number || row["Id Number"] || ""
    ).trim();

    if (!kitsMap.has(partId)) {
      kitsMap.set(partId, {
        part_id: partId,
        kit_name: String(row.KitName || row.kit_name || partId).trim(),
        default_kit_qty: defaultKitQty,
        is_active: 1,
        components: []
      });
    }

    const kit = kitsMap.get(partId);

    kit.components.push({
      component_id: componentId,
      product_name: productName,
      lang_code: langCode,
      default_component_qty: defaultComponentQty,
      sort_order: index + 1,
      is_active: 1,
      q2_standard_quotation: q2StandardQuotation,
      q3_height: q3Height,
      q4_width: q4Width,
      presserso_id_number: pressersoIdNumber
    });
  });

  return Array.from(kitsMap.values());
}

async function parseExcelFile(filePath) {
  const rows = await parseExcel(filePath);
  const kits = buildKitsFromRows(rows);

  return {
    rows: rows.length,
    kitsFound: kits.length,
    kits
  };
}

module.exports = {
  parseExcel,
  parseExcelFile
};