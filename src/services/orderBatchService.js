const db = require("../repositories/db");

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

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function findComponentByRef(itemRef) {
  const rows = await dbAll(`
    SELECT id, component_id, product_name, product_id,
           q2_standard_quotation, q3_height, q4_width
    FROM kit_components
  `);

  const wanted = normalizeText(itemRef);

  return rows.find((row) => {
    return (
      normalizeText(row.component_id) === wanted ||
      normalizeText(row.product_name) === wanted
    );
  }) || null;
}

async function findKitByRef(itemRef) {
  const rows = await dbAll(`
    SELECT id, part_id, kit_name, default_kit_qty
    FROM kits
  `);

  const wanted = normalizeText(itemRef);

  return rows.find((row) => {
    return (
      normalizeText(row.part_id) === wanted ||
      normalizeText(row.kit_name) === wanted
    );
  }) || null;
}

async function getKitComponents(kitId) {
  return dbAll(`
    SELECT id, component_id, product_name, product_id,
           default_component_qty,
           q2_standard_quotation, q3_height, q4_width
    FROM kit_components
    WHERE kit_id = ? AND is_active = 1
    ORDER BY sort_order ASC, id ASC
  `, [kitId]);
}

function parseBooleanLike(value, defaultValue = true) {
  if (value === null || value === undefined || value === "") return defaultValue;

  const v = String(value).trim().toLowerCase();

  if (["true", "1", "yes", "oui", "y"].includes(v)) return true;
  if (["false", "0", "no", "non", "n"].includes(v)) return false;

  return defaultValue;
}

async function buildOrderBatches(importId) {
  const validLines = await dbAll(
    `
    SELECT *
    FROM excel_import_lines
    WHERE import_id = ?
      AND status = 'VALID'
    ORDER BY store_code, order_group, row_number
    `,
    [importId]
  );

  if (!validLines.length) {
    throw new Error("Aucune ligne VALID à transformer en batch");
  }
  const existingBatch = await dbGet(
  `
  SELECT id, status, presso_order_number
  FROM order_batches
  WHERE import_id = ?
  LIMIT 1
  `,
  [importId]
);

if (existingBatch) {
  throw new Error(
    `L'import ${importId} a déjà été préparé en batch (${existingBatch.id})`
  );
}

  const groups = new Map();

  for (const line of validLines) {
    const key = `${line.store_code}__${line.order_group || "A"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(line);
  }

  let createdBatches = 0;
  let createdItems = 0;

  for (const [groupKey, lines] of groups.entries()) {
    const first = lines[0];

const rawApprovalValue = first.need_to_apply_approvals;

const normalizedApprovalValue =
  rawApprovalValue === null || rawApprovalValue === undefined
    ? ""
    : String(rawApprovalValue).trim().toLowerCase();

const needToApplyApprovals =
  ["false", "0", "no", "non", "n"].includes(normalizedApprovalValue) ? 0 : 1;

console.log("BUILD APPROVAL DEBUG =", {
  importId,
  storeCode: first.store_code,
  rowId: first.id,
  rawApprovalValue,
  normalizedApprovalValue,
  computedNeedToApplyApprovals: needToApplyApprovals
});

    const store = await dbGet(
      `
      SELECT *
      FROM stores
      WHERE store_code = ?
      `,
      [first.store_code]
    );

    if (!store) {
      throw new Error(`Store introuvable au moment du build: ${first.store_code}`);
    }

    const batchInsert = await dbRun(
  `
  INSERT INTO order_batches (
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
    message,
    need_to_apply_approvals
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  [
    importId,
    first.store_code,
    first.order_group || "A",
    store.presso_user_id,
    store.site_id,
    store.billing_address_id,
    store.preferred_address_id,
    first.po_number || null,
    first.requested_ship_date || null,
    first.ship_method_name || null,
    "READY",
    0,
    null,
    needToApplyApprovals
  ]
);

    const batchId = batchInsert.lastID;
    createdBatches++;

    let batchItemCount = 0;

    for (const line of lines) {
      const lineType = String(line.line_type || "").toUpperCase();

      if (lineType === "COMPONENT") {
        const comp = await findComponentByRef(line.item_ref);

        if (!comp) {
          await dbRun(
            `
            INSERT INTO order_batch_items (
              batch_id,
              source_line_id,
              source_type,
              source_ref,
              q1,
              status,
              message
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
              batchId,
              line.id,
              "COMPONENT_DIRECT",
              line.item_ref,
              line.quantity_q1,
              "ERROR",
              "Component introuvable au build"
            ]
          );
          batchItemCount++;
          createdItems++;
          continue;
        }

        await dbRun(
          `
          INSERT INTO order_batch_items (
            batch_id,
            source_line_id,
            source_type,
            source_ref,
            component_id,
            product_name,
            product_id,
            q1,
            q2,
            q3,
            q4,
            job_number,
            item_notes,
            status,
            message
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            batchId,
            line.id,
            "COMPONENT_DIRECT",
            line.item_ref,
            comp.component_id,
            comp.product_name,
            comp.product_id,
            Number(line.quantity_q1 || 0),
            comp.q2_standard_quotation ? Number(comp.q2_standard_quotation) : null,
            comp.q3_height ? Number(comp.q3_height) : null,
            comp.q4_width ? Number(comp.q4_width) : null,
            line.job_number || null,
            line.item_notes || null,
            "READY",
            null
          ]
        );

        batchItemCount++;
        createdItems++;
      }

      else if (lineType === "KIT") {
        const kit = await findKitByRef(line.item_ref);

        if (!kit) {
          await dbRun(
            `
            INSERT INTO order_batch_items (
              batch_id,
              source_line_id,
              source_type,
              source_ref,
              q1,
              status,
              message
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
              batchId,
              line.id,
              "KIT_EXPANDED",
              line.item_ref,
              line.quantity_q1,
              "ERROR",
              "Kit introuvable au build"
            ]
          );
          batchItemCount++;
          createdItems++;
          continue;
        }

        const kitComponents = await getKitComponents(kit.id);

        if (!kitComponents.length) {
          await dbRun(
            `
            INSERT INTO order_batch_items (
              batch_id,
              source_line_id,
              source_type,
              source_ref,
              q1,
              status,
              message
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
              batchId,
              line.id,
              "KIT_EXPANDED",
              line.item_ref,
              line.quantity_q1,
              "ERROR",
              "Kit sans composants"
            ]
          );
          batchItemCount++;
          createdItems++;
          continue;
        }

        for (const comp of kitComponents) {
          const finalQ1 =
            Number(line.quantity_q1 || 0) * Number(comp.default_component_qty || 1);

          await dbRun(
            `
            INSERT INTO order_batch_items (
              batch_id,
              source_line_id,
              source_type,
              source_ref,
              component_id,
              product_name,
              product_id,
              q1,
              q2,
              q3,
              q4,
              job_number,
              item_notes,
              status,
              message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              batchId,
              line.id,
              "KIT_EXPANDED",
              line.item_ref,
              comp.component_id,
              comp.product_name,
              comp.product_id,
              finalQ1,
              comp.q2_standard_quotation ? Number(comp.q2_standard_quotation) : null,
              comp.q3_height ? Number(comp.q3_height) : null,
              comp.q4_width ? Number(comp.q4_width) : null,
              line.job_number || null,
              line.item_notes || null,
              "READY",
              null
            ]
          );

          batchItemCount++;
          createdItems++;
        }
      }
    }

    await dbRun(
      `
      UPDATE order_batches
      SET total_lines = ?
      WHERE id = ?
      `,
      [batchItemCount, batchId]
    );
  }

  return {
    success: true,
    importId,
    createdBatches,
    createdItems
  };
}

module.exports = {
  buildOrderBatches
};