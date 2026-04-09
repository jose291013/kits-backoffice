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
    ei.id,
    ei.original_filename,
    ei.sheet_name,
    ei.imported_at,
    ei.status,
    ei.total_rows,
    ei.valid_rows,
    ei.error_rows,
    ei.message,
    COUNT(ob.id) AS batch_count
  FROM excel_imports ei
  LEFT JOIN order_batches ob ON ob.import_id = ei.id
  GROUP BY
    ei.id,
    ei.original_filename,
    ei.sheet_name,
    ei.imported_at,
    ei.status,
    ei.total_rows,
    ei.valid_rows,
    ei.error_rows,
    ei.message
  ORDER BY ei.id DESC
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
    ob.id,
    ob.import_id,
    ob.store_code,
    ob.order_group,
    ob.presso_user_id,
    ob.site_id,
    ob.bill_to_address_id,
    ob.ship_to_address_id,
    ob.po_number,
    ob.requested_ship_date,
    ob.ship_method_name,
    ob.status,
    ob.total_lines,
    ob.created_at,
    ob.executed_at,
    ob.message,
    ob.need_to_apply_approvals,
    ob.presso_order_id,
    ob.presso_order_number,
    ob.presso_order_date,
    ROUND(COALESCE(SUM(obi.price), 0), 2) AS total_ht,
    ROUND(COALESCE(SUM(obi.shipping), 0), 2) AS total_shipping,
    ROUND(COALESCE(SUM(obi.tax), 0), 2) AS total_tax,
    ROUND(COALESCE(SUM(obi.price), 0) + COALESCE(SUM(obi.shipping), 0) + COALESCE(SUM(obi.tax), 0), 2) AS total_ttc
  FROM order_batches ob
  LEFT JOIN order_batch_items obi ON obi.batch_id = ob.id
  GROUP BY
    ob.id,
    ob.import_id,
    ob.store_code,
    ob.order_group,
    ob.presso_user_id,
    ob.site_id,
    ob.bill_to_address_id,
    ob.ship_to_address_id,
    ob.po_number,
    ob.requested_ship_date,
    ob.ship_method_name,
    ob.status,
    ob.total_lines,
    ob.created_at,
    ob.executed_at,
    ob.message,
    ob.need_to_apply_approvals,
    ob.presso_order_id,
    ob.presso_order_number,
    ob.presso_order_date
  ORDER BY ob.id DESC
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
    AND (presso_order_number IS NULL AND presso_order_id IS NULL)
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