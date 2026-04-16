const db = require("../repositories/db");
const ExcelJS = require("exceljs");

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

async function readRows(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("Aucune feuille trouvée");

  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values.slice(1).map(normalizeHeader);

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const values = row.values.slice(1);
    const obj = {};

    headers.forEach((h, i) => {
      obj[h] = values[i] ?? null;
    });

    const hasValue = Object.values(obj).some(
      (v) => v !== null && String(v).trim() !== ""
    );

    if (hasValue) {
      rows.push({ rowNumber, data: obj });
    }
  });

  return rows;
}

function pick(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }
  return null;
}

function normalizeScalar(value) {
  if (value == null) return "";

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  if (typeof value === "object") {
    if (typeof value.text === "string") return value.text.trim();
    if (typeof value.result === "string") return value.result.trim();
    if (typeof value.hyperlink === "string") return value.hyperlink.trim();
    if (Array.isArray(value.richText)) {
      return value.richText.map((x) => x.text || "").join("").trim();
    }
  }

  return String(value).trim();
}

async function importStoresMaster(filePath, originalFilename = "stores_master.xlsx") {
  const rows = await readRows(filePath);

  if (!rows.length) {
    throw new Error("Fichier Excel vide");
  }

  let created = 0;
  let updated = 0;
  let errors = 0;
  const details = [];

  for (const row of rows) {
    const storeCode = normalizeScalar(row.data.store_code);
    const storeName = normalizeScalar(row.data.store_name);
    const email = normalizeScalar(row.data.pressero_user_email).toLowerCase();

    if (!storeCode || !storeName || !email) {
      errors++;
      details.push({
        rowNumber: row.rowNumber,
        status: "ERROR",
        message: "Colonnes obligatoires manquantes"
      });
      continue;
    }

    const existing = await dbGet(
      `SELECT id FROM stores WHERE store_code = ?`,
      [storeCode]
    );

    if (existing) {
  await dbRun(
    `
    UPDATE stores
    SET
      store_name = ?,
      presso_user_email = ?,
      presso_user_id = NULL,
      site_id = NULL,
      address_book_id = NULL,
      preferred_address_id = NULL,
      billing_address_id = NULL,
      sync_status = ?,
      sync_message = NULL,
      last_synced_at = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE store_code = ?
    `,
    [storeName, email, "PENDING", storeCode]
  );

  updated++;
  details.push({
    rowNumber: row.rowNumber,
    status: "UPDATED",
    storeCode
  });
} else {
      await dbRun(
        `
        INSERT INTO stores (
          store_code,
          store_name,
          presso_user_email,
          sync_status,
          sync_message
        ) VALUES (?, ?, ?, ?, ?)
        `,
        [storeCode, storeName, email, "PENDING", null]
      );
      created++;
      details.push({
        rowNumber: row.rowNumber,
        status: "CREATED",
        storeCode
      });
    }
  }

  return {
    success: true,
    filename: originalFilename,
    total: rows.length,
    created,
    updated,
    errors,
    details
  };
}

module.exports = {
  importStoresMaster
};