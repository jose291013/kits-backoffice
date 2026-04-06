const db = require("../repositories/db");
const ExcelJS = require("exceljs");

// helpers
function normalizeText(value) {
  return String(value || "")
    .replace(/\u00A0/g, " ")   // espace insécable -> espace normal
    .replace(/\s+/g, " ")      // espaces multiples -> 1 espace
    .trim()
    .toLowerCase();
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

async function readWorksheetRows(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Aucune feuille trouvée dans le fichier Excel");
  }

  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values
    .slice(1)
    .map((h) => normalizeHeader(h));

  const rows = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const values = row.values.slice(1);
    const obj = {};

    headers.forEach((header, idx) => {
      obj[header] = values[idx] ?? null;
    });

    const hasSomeValue = Object.values(obj).some(
      (v) => v !== null && String(v).trim() !== ""
    );

    if (hasSomeValue) {
      rows.push({
        rowNumber,
        data: obj
      });
    }
  });

  return {
    sheetName: worksheet.name,
    rows
  };
}

async function previewExcelImport(filePath, originalFilename = "upload.xlsx") {
  const { sheetName, rows } = await readWorksheetRows(filePath);

  if (!rows.length) {
    throw new Error("Fichier Excel vide");
  }

  const importResult = await dbRun(
    `
    INSERT INTO excel_imports (
      original_filename,
      stored_filename,
      sheet_name,
      status
    ) VALUES (?, ?, ?, ?)
    `,
    [originalFilename, filePath, sheetName, "UPLOADED"]
  );

  const importId = importResult.lastID;

  let valid = 0;
  let errors = 0;

  for (const row of rows) {
    const r = row.data;

    const storeCode = r.store_code;
    const orderGroup = r.order_group || "A";
    const poNumber = r.po_number || null;
    const requestedShipDate = r.requested_ship_date || null;
    const shipMethodName = r.ship_method_name || null;
    const lineNo = r.line_no || null;
    const lineType = r.line_type;
    const itemRef = r.item_ref;
    const quantity = r.quantity_q1;
    const jobNumber = r.job_number || null;
    const itemNotes = r.item_notes || null;
    const needToApplyApprovals = r.need_to_apply_approvals ?? null;

    let status = "VALID";
    let message = null;

    if (!storeCode || !lineType || !itemRef || quantity === null || quantity === undefined || quantity === "") {
      status = "ERROR";
      message = "Champs obligatoires manquants";
      errors++;
    } else {
      const store = await dbGet(
        `SELECT id FROM stores WHERE store_code = ?`,
        [String(storeCode).trim()]
      );

      if (!store) {
        status = "ERROR";
        message = "Store inconnu";
        errors++;
      }

      if (status === "VALID" && String(lineType).toUpperCase() === "COMPONENT") {
        const rawItemRef = String(itemRef).trim();
const normalizedItemRef = normalizeText(rawItemRef);

const allComponents = await new Promise((resolve, reject) => {
  db.all(
    `SELECT id, component_id, product_name FROM kit_components`,
    [],
    (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    }
  );
});

const comp = allComponents.find((row) => {
  const normalizedComponentId = normalizeText(row.component_id);
  const normalizedProductName = normalizeText(row.product_name);

  return (
    normalizedComponentId === normalizedItemRef ||
    normalizedProductName === normalizedItemRef
  );
});

if (!comp) {
  status = "ERROR";
  message = "Component inconnu";
  errors++;
}
      }

      if (status === "VALID" && String(lineType).toUpperCase() === "KIT") {
        const rawItemRef = String(itemRef).trim();
const normalizedItemRef = normalizeText(rawItemRef);

const allKits = await new Promise((resolve, reject) => {
  db.all(`SELECT id, part_id, kit_name FROM kits`, [], (err, rows) => {
    if (err) return reject(err);
    resolve(rows || []);
  });
});

const kit = allKits.find((row) => {
  const normalizedPartId = normalizeText(row.part_id);
  const normalizedKitName = normalizeText(row.kit_name);

  return (
    normalizedPartId === normalizedItemRef ||
    normalizedKitName === normalizedItemRef
  );
});

if (!kit) {
  status = "ERROR";
  message = "Kit inconnu";
  errors++;
}
      }
    }

    if (status === "VALID") valid++;

    await dbRun(
      `
      INSERT INTO excel_import_lines (
  import_id,
  row_number,
  store_code,
  order_group,
  po_number,
  requested_ship_date,
  ship_method_name,
  line_no,
  line_type,
  item_ref,
  quantity_q1,
  job_number,
  item_notes,
  need_to_apply_approvals,
  status,
  message
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
  importId,
  row.rowNumber,
  storeCode ? String(storeCode).trim() : null,
  orderGroup ? String(orderGroup).trim() : "A",
  poNumber,
  requestedShipDate,
  shipMethodName,
  lineNo,
  lineType ? String(lineType).trim().toUpperCase() : null,
  itemRef ? String(itemRef).trim() : null,
  quantity,
  jobNumber,
  itemNotes,
  needToApplyApprovals,
  status,
  message
]
    );
  }

  const summary = {
    total: rows.length,
    valid,
    errors
  };

  await dbRun(
    `
    UPDATE excel_imports
    SET
      total_rows = ?,
      valid_rows = ?,
      error_rows = ?,
      status = ?,
      preview_json = ?
    WHERE id = ?
    `,
    [
      rows.length,
      valid,
      errors,
      errors > 0 ? "FAILED" : "PREVIEWED",
      JSON.stringify(summary),
      importId
    ]
  );

  return {
    importId,
    sheetName,
    total: rows.length,
    valid,
    errors
  };
}

module.exports = {
  previewExcelImport
};