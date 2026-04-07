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

function toStringSafe(value) {
  return String(normalizeCellValue(value) || "").trim();
}

function toNumberSafe(value, fallback = 0) {
  const raw = normalizeCellValue(value);
  if (raw === "" || raw === null || raw === undefined) return fallback;

  const normalized = String(raw).replace(",", ".").trim();
  const num = Number(normalized);

  return Number.isFinite(num) ? num : fallback;
}

function dimToTenths(value) {
  const num = toNumberSafe(value, 0);
  return String(Math.round(num));
}

function normalizeName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

async function parseExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers = [];
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = toStringSafe(cell.value);
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

function getKitDisplayNameFromRow(row, partId) {
  const langCode = toStringSafe(
    row["Lang / Taal"] ||
    row["LangCode"] ||
    row["lang_code"]
  ).toUpperCase().trim();

  const mcatFr = normalizeName(row["P MCatFR"] || row["PMCatFR"] || "");
  const mcatNl = normalizeName(row["P MCatNL"] || row["PMCatNL"] || "");
  const fallbackName = normalizeName(
    row["Name"] ||
    row["KitName"] ||
    row["kit_name"] ||
    partId
  ) || partId;

  if (langCode === "FR" && mcatFr) {
    return mcatFr;
  }

  if (langCode === "NL" && mcatNl) {
    return mcatNl;
  }

  if (langCode === "BIL" || langCode === "UNI") {
    if (mcatFr && mcatNl) {
      return `${mcatFr} / ${mcatNl}`;
    }
    return mcatFr || mcatNl || fallbackName;
  }

  return fallbackName;
}

function getLangPriority(row) {
  const langCode = toStringSafe(
    row["Lang / Taal"] ||
    row["LangCode"] ||
    row["lang_code"]
  ).toUpperCase().trim();

  if (langCode === "BIL") return 3;
if (langCode === "UNI") return 3;
if (langCode === "FR") return 2;
if (langCode === "NL") return 2;
return 0;
}

function buildKitsFromRows(rows) {
  const kitsMap = new Map();

  rows.forEach((row, index) => {
    const partId = toStringSafe(
      row["Part ID"] ||
      row["PARTID"] ||
      row["PartID"] ||
      row["part_id"]
    );

    if (!partId) return;

    const kitName = getKitDisplayNameFromRow(row, partId);

    const componentId = toStringSafe(
      row["Component ID"] ||
      row["COMPONENTID"] ||
      row["ComponentID"] ||
      row["component_id"]
    );

    if (!componentId) return;

    const productName = componentId;

    const langCode = toStringSafe(
      row["Lang / Taal"] ||
      row["LangCode"] ||
      row["lang_code"]
    );

    const defaultComponentQty = toNumberSafe(
      row["Quantity"] ||
      row["DefaultComponentQty"] ||
      row["default_component_qty"],
      1
    );

    const defaultKitQty = toNumberSafe(
      row["DefaultKitQty"] ||
      row["default_kit_qty"],
      1
    );

    const q2StandardQuotation = toStringSafe(
      row["Numéro unique price motor = Q2 (automatique)"] ||
      row["Q2StandardQuotation"] ||
      row["q2_standard_quotation"] ||
      row["STD quotation MP"]
    );

    const q3Height = toStringSafe(
      row["Height_NEW"] ||
      row["Height"] ||
      row["Q3Height"] ||
      row["q3_height"]
    )
      ? dimToTenths(row["Height_NEW"] || row["Height"] || row["Q3Height"] || row["q3_height"])
      : "";

    const q4Width = toStringSafe(
      row["Width_NEW"] ||
      row["Width"] ||
      row["Q4Width"] ||
      row["q4_width"]
    )
      ? dimToTenths(row["Width_NEW"] || row["Width"] || row["Q4Width"] || row["q4_width"])
      : "";

    const pressersoIdNumber = toStringSafe(
      row["Pressero ID number"] ||
      row["presserso_id_number"] ||
      row["PressersoIdNumber"]
    );

    if (!kitsMap.has(partId)) {
  kitsMap.set(partId, {
    part_id: partId,
    kit_name: kitName,
    default_kit_qty: defaultKitQty,
    is_active: 1,
    components: [],
    _namePriority: getLangPriority(row)
  });
} else {
  const existingKit = kitsMap.get(partId);
  const newPriority = getLangPriority(row);

  if (newPriority > (existingKit._namePriority || 0) && kitName) {
    existingKit.kit_name = kitName;
    existingKit._namePriority = newPriority;
  }
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

  return Array.from(kitsMap.values()).map(kit => {
  delete kit._namePriority;
  return kit;
});
}

async function parseExcelFile(filePath) {
  const rows = await parseExcel(filePath);
  const kits = buildKitsFromRows(rows);

  const seen = new Map();
  const duplicates = [];

  rows.forEach((row, index) => {
    const partId = toStringSafe(
      row["Part ID"] ||
      row["PARTID"] ||
      row["PartID"] ||
      row["part_id"]
    );

    const componentId = toStringSafe(
      row["Component ID"] ||
      row["COMPONENTID"] ||
      row["ComponentID"] ||
      row["component_id"]
    );

    if (!partId || !componentId) return;

    const key = `${partId}__${componentId}`;

    if (seen.has(key)) {
      duplicates.push({
        rowNumber: index + 2,
        partId,
        componentId,
        firstSeenRow: seen.get(key)
      });
    } else {
      seen.set(key, index + 2);
    }
  });

  return {
    rows: rows.length,
    kitsFound: kits.length,
    kits,
    uniqueKitComponentPairs: seen.size,
    duplicateCount: duplicates.length,
    duplicates
  };
}

module.exports = {
  parseExcel,
  parseExcelFile
};