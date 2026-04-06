const express = require("express");
const router = express.Router();
const db = require("../repositories/db");
const { submitBatchToPressero } = require("../services/presseroOrderCreateService");

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

// =========================
// IMPORTS
// =========================

router.get("/imports", async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT
        id,
        original_filename,
        sheet_name,
        imported_at,
        status,
        total_rows,
        valid_rows,
        error_rows,
        message
      FROM excel_imports
      ORDER BY id DESC
    `);

    res.json({ success: true, imports: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/imports/:importId", async (req, res) => {
  try {
    const importId = Number(req.params.importId);

    const row = await dbGet(
      `
      SELECT *
      FROM excel_imports
      WHERE id = ?
      `,
      [importId]
    );

    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Import introuvable"
      });
    }

    res.json({ success: true, import: row });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/imports/:importId/lines", async (req, res) => {
  try {
    const importId = Number(req.params.importId);

    const rows = await dbAll(
      `
      SELECT *
      FROM excel_import_lines
      WHERE import_id = ?
      ORDER BY row_number ASC
      `,
      [importId]
    );

    res.json({ success: true, lines: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// =========================
// BATCHES
// =========================

router.get("/batches", async (req, res) => {
  try {
    const rows = await dbAll(`
  SELECT
    id,
    import_id,
    store_code,
    order_group,
    presso_user_id,
    site_id,
    bill_to_address_id,
    ship_to_address_id,
    po_number,
    requested_ship_date,
    ship_method_name,
    status,
    total_lines,
    created_at,
    executed_at,
    message,
    need_to_apply_approvals,
    presso_order_id,
    presso_order_number,
    presso_order_date
  FROM order_batches
  ORDER BY id DESC
`);

    res.json({ success: true, batches: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/batches/:batchId", async (req, res) => {
  try {
    const batchId = Number(req.params.batchId);

    const row = await dbGet(
      `
      SELECT *
      FROM order_batches
      WHERE id = ?
      `,
      [batchId]
    );

    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Batch introuvable"
      });
    }

    res.json({ success: true, batch: row });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/batches/:batchId/items", async (req, res) => {
  try {
    const batchId = Number(req.params.batchId);

    const rows = await dbAll(
      `
      SELECT *
      FROM order_batch_items
      WHERE batch_id = ?
      ORDER BY id ASC
      `,
      [batchId]
    );

    res.json({ success: true, items: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/submit-all-ready", async (req, res) => {
  try {
    const batches = await dbAll(`
      SELECT id
      FROM order_batches
      WHERE status = 'READY'
      ORDER BY id ASC
    `);

    let sent = 0;
    let failed = 0;
    const results = [];

    for (const batch of batches) {
      try {
        const r = await submitBatchToPressero(batch.id);
        sent++;
        results.push({ batchId: batch.id, status: "SENT", result: r });
      } catch (error) {
        failed++;
        results.push({ batchId: batch.id, status: "FAILED", message: error.message });
      }
    }

    res.json({
      success: true,
      total: batches.length,
      sent,
      failed,
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post("/cleanup-orders", async (req, res) => {
  try {
    await dbRun(`DELETE FROM order_batch_items`);
    await dbRun(`DELETE FROM order_batches`);
    await dbRun(`DELETE FROM excel_import_lines`);
    await dbRun(`DELETE FROM excel_imports`);

    res.json({
      success: true,
      message: "Historique des commandes Excel supprimé"
    });
  } catch (error) {
    console.error("Erreur cleanup orders:", error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;