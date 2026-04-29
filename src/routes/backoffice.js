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

function nowIso() {
  return new Date().toISOString();
}

function getArchiveReason(req, fallback) {
  return String(req.body?.reason || fallback || "Archived from backoffice")
    .trim()
    .slice(0, 300);
}

function isProtectedBatch(batch) {
  const status = String(batch?.status || "").toUpperCase();

  return (
    status === "SENT" ||
    status === "PROCESSING" ||
    !!batch?.presso_order_number ||
    !!batch?.presso_order_id
  );
}

async function getBatchForArchive(batchId) {
  return dbGet(
    `
    SELECT *
    FROM order_batches
    WHERE id = ?
      AND deleted_at IS NULL
    `,
    [batchId]
  );
}

async function archiveBatchCascade(batchId, reason, archivedAt) {
  await dbRun(
    `
    UPDATE order_batch_items
    SET deleted_at = ?, deleted_reason = ?
    WHERE batch_id = ?
      AND deleted_at IS NULL
    `,
    [archivedAt, reason, batchId]
  );

  const result = await dbRun(
    `
    UPDATE order_batches
    SET deleted_at = ?, deleted_reason = ?
    WHERE id = ?
      AND deleted_at IS NULL
    `,
    [archivedAt, reason, batchId]
  );

  return result.changes || 0;
}

function getBatchesQuery(whereClause = "1=1") {
  return `
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
      ROUND(
        COALESCE(SUM(obi.price), 0) +
        COALESCE(SUM(obi.shipping), 0) +
        COALESCE(SUM(obi.tax), 0),
        2
      ) AS total_ttc
    FROM order_batches ob
LEFT JOIN order_batch_items obi
  ON obi.batch_id = ob.id
  AND obi.deleted_at IS NULL
WHERE (${whereClause})
  AND ob.deleted_at IS NULL
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
    ORDER BY
      COALESCE(ob.executed_at, ob.created_at) DESC,
      ob.id DESC
  `;
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
  LEFT JOIN order_batches ob
    ON ob.import_id = ei.id
    AND ob.deleted_at IS NULL
  WHERE ei.deleted_at IS NULL
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
  AND deleted_at IS NULL
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
  AND deleted_at IS NULL
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
    const rows = await dbAll(getBatchesQuery());

    res.json({ success: true, batches: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});



router.get("/batches/active", async (req, res) => {
  try {
    const rows = await dbAll(
      getBatchesQuery(`ob.status IN ('READY', 'FAILED', 'PROCESSING')`)
    );

    res.json({ success: true, batches: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/batches/history", async (req, res) => {
  try {
    const rows = await dbAll(
      getBatchesQuery(`ob.status = 'SENT'`)
    );

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
  AND deleted_at IS NULL
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
  AND deleted_at IS NULL
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
  AND deleted_at IS NULL
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

router.post("/imports/:importId/archive", async (req, res) => {
  const importId = Number(req.params.importId);
  const reason = getArchiveReason(req, "Import archivé depuis le back-office");
  const archivedAt = nowIso();

  if (!importId) {
    return res.status(400).json({
      success: false,
      message: "importId invalide"
    });
  }

  try {
    const importRow = await dbGet(
      `
      SELECT *
      FROM excel_imports
      WHERE id = ?
        AND deleted_at IS NULL
      `,
      [importId]
    );

    if (!importRow) {
      return res.status(404).json({
        success: false,
        message: "Import introuvable ou déjà archivé"
      });
    }

    const protectedCount = await dbGet(
      `
      SELECT COUNT(*) AS count
      FROM order_batches
      WHERE import_id = ?
        AND deleted_at IS NULL
        AND (
          status IN ('SENT', 'PROCESSING')
          OR presso_order_number IS NOT NULL
          OR presso_order_id IS NOT NULL
        )
      `,
      [importId]
    );

    if (Number(protectedCount?.count || 0) > 0) {
      return res.status(409).json({
        success: false,
        message: "Impossible d’archiver cet import car il contient des commandes envoyées ou en cours de traitement."
      });
    }

    await dbRun("BEGIN IMMEDIATE TRANSACTION");

    await dbRun(
      `
      UPDATE excel_imports
      SET deleted_at = ?, deleted_reason = ?
      WHERE id = ?
        AND deleted_at IS NULL
      `,
      [archivedAt, reason, importId]
    );

    await dbRun(
      `
      UPDATE excel_import_lines
      SET deleted_at = ?, deleted_reason = ?
      WHERE import_id = ?
        AND deleted_at IS NULL
      `,
      [archivedAt, reason, importId]
    );

    await dbRun(
      `
      UPDATE order_batch_items
      SET deleted_at = ?, deleted_reason = ?
      WHERE batch_id IN (
        SELECT id FROM order_batches WHERE import_id = ?
      )
        AND deleted_at IS NULL
      `,
      [archivedAt, reason, importId]
    );

    await dbRun(
      `
      UPDATE order_batches
      SET deleted_at = ?, deleted_reason = ?
      WHERE import_id = ?
        AND deleted_at IS NULL
      `,
      [archivedAt, reason, importId]
    );

    await dbRun("COMMIT");

    res.json({
      success: true,
      importId,
      message: "Import archivé avec ses lignes et batchs non envoyés."
    });
  } catch (error) {
    await dbRun("ROLLBACK").catch(() => {});
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post("/imports/:importId/archive-failed-lines", async (req, res) => {
  const importId = Number(req.params.importId);
  const reason = getArchiveReason(req, "Lignes en erreur archivées depuis le back-office");
  const archivedAt = nowIso();

  if (!importId) {
    return res.status(400).json({
      success: false,
      message: "importId invalide"
    });
  }

  try {
    const batchCount = await dbGet(
      `
      SELECT COUNT(*) AS count
      FROM order_batches
      WHERE import_id = ?
        AND deleted_at IS NULL
      `,
      [importId]
    );

    if (Number(batchCount?.count || 0) > 0) {
      return res.status(409).json({
        success: false,
        message: "Impossible de retirer les lignes en erreur car cet import a déjà été préparé en batchs."
      });
    }

    const result = await dbRun(
      `
      UPDATE excel_import_lines
      SET deleted_at = ?, deleted_reason = ?
      WHERE import_id = ?
        AND deleted_at IS NULL
        AND status IN ('ERROR', 'FAILED')
      `,
      [archivedAt, reason, importId]
    );

    const counts = await dbGet(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'VALID' THEN 1 ELSE 0 END) AS valid,
        SUM(CASE WHEN status IN ('ERROR', 'FAILED') THEN 1 ELSE 0 END) AS errors
      FROM excel_import_lines
      WHERE import_id = ?
        AND deleted_at IS NULL
      `,
      [importId]
    );

    const total = Number(counts?.total || 0);
    const valid = Number(counts?.valid || 0);
    const errors = Number(counts?.errors || 0);
    const nextStatus = errors > 0 ? "FAILED" : "PREVIEWED";

    await dbRun(
      `
      UPDATE excel_imports
      SET total_rows = ?,
          valid_rows = ?,
          error_rows = ?,
          status = ?,
          message = ?
      WHERE id = ?
        AND deleted_at IS NULL
      `,
      [
        total,
        valid,
        errors,
        nextStatus,
        result.changes
          ? `${result.changes} ligne(s) en erreur archivée(s).`
          : "Aucune ligne en erreur à archiver.",
        importId
      ]
    );

    res.json({
      success: true,
      importId,
      archivedLines: result.changes || 0,
      total,
      valid,
      errors,
      status: nextStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post("/batches/:batchId/archive", async (req, res) => {
  const batchId = Number(req.params.batchId);
  const reason = getArchiveReason(req, "Batch archivé depuis le back-office");
  const archivedAt = nowIso();

  if (!batchId) {
    return res.status(400).json({
      success: false,
      message: "batchId invalide"
    });
  }

  try {
    const batch = await getBatchForArchive(batchId);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch introuvable ou déjà archivé"
      });
    }

    if (isProtectedBatch(batch)) {
      return res.status(409).json({
        success: false,
        message: "Impossible d’archiver un batch envoyé, en cours de traitement ou déjà lié à une commande Pressero."
      });
    }

    await archiveBatchCascade(batchId, reason, archivedAt);

    res.json({
      success: true,
      batchId,
      message: "Batch archivé avec ses items."
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post("/batches/archive-selected", async (req, res) => {
  const batchIds = Array.isArray(req.body?.batchIds)
    ? req.body.batchIds.map(Number).filter(Boolean)
    : [];

  const reason = getArchiveReason(req, "Batchs sélectionnés archivés depuis le back-office");
  const archivedAt = nowIso();

  if (!batchIds.length) {
    return res.status(400).json({
      success: false,
      message: "Aucun batch sélectionné"
    });
  }

  try {
    const archived = [];
    const blocked = [];
    const notFound = [];

    for (const batchId of batchIds) {
      const batch = await getBatchForArchive(batchId);

      if (!batch) {
        notFound.push(batchId);
        continue;
      }

      if (isProtectedBatch(batch)) {
        blocked.push({
          batchId,
          status: batch.status,
          orderNumber: batch.presso_order_number || null
        });
        continue;
      }

      await archiveBatchCascade(batchId, reason, archivedAt);
      archived.push(batchId);
    }

    res.json({
      success: true,
      total: batchIds.length,
      archived,
      blocked,
      notFound
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