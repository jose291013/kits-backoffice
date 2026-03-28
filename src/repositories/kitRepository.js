const db = require("./db");
const { buildComponentSourceHash } = require("../utils/hashUtils");

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({
        lastID: this.lastID,
        changes: this.changes
      });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function getAllKits() {
  const kits = await all(
    `
    SELECT *
    FROM kits
    ORDER BY part_id
    `
  );

  return kits;
}

async function getKitByPartId(partId) {
  const kit = await get(
    `
    SELECT *
    FROM kits
    WHERE part_id = ?
    `,
    [partId]
  );

  if (!kit) return null;

  const components = await all(
    `
    SELECT *
    FROM kit_components
    WHERE kit_id = ?
    ORDER BY sort_order, id
    `,
    [kit.id]
  );

  return {
    ...kit,
    components
  };
}

async function getKitById(kitId) {
  const kit = await get(
    `
    SELECT *
    FROM kits
    WHERE id = ?
    `,
    [kitId]
  );

  if (!kit) return null;

  const components = await all(
    `
    SELECT *
    FROM kit_components
    WHERE kit_id = ?
    ORDER BY sort_order, id
    `,
    [kit.id]
  );

  return {
    ...kit,
    components
  };
}

async function upsertKit({ partId, kitName, defaultKitQty = 1, isActive = 1, lastImportedAt }) {
  const existing = await get(
    `
    SELECT id
    FROM kits
    WHERE part_id = ?
    `,
    [partId]
  );

  if (existing) {
    await run(
      `
      UPDATE kits
      SET kit_name = ?,
          default_kit_qty = ?,
          is_active = ?,
          last_imported_at = ?
      WHERE id = ?
      `,
      [kitName, defaultKitQty, isActive, lastImportedAt, existing.id]
    );

    return existing.id;
  }

  const result = await run(
    `
    INSERT INTO kits (
      part_id,
      kit_name,
      default_kit_qty,
      is_active,
      last_imported_at
    )
    VALUES (?, ?, ?, ?, ?)
    `,
    [partId, kitName, defaultKitQty, isActive, lastImportedAt]
  );

  return result.lastID;
}

async function deleteComponentsByKitId(kitId) {
  await run(
    `
    DELETE FROM kit_components
    WHERE kit_id = ?
    `,
    [kitId]
  );
}

async function getAllKitComponentsForExport() {
  return all(
    `
    SELECT
      k.part_id,
      k.kit_name,
      k.default_kit_qty,
      k.is_active AS kit_is_active,
      k.last_imported_at,

      kc.sort_order,
      kc.component_id,
      kc.product_name,
      kc.lang_code,
      kc.default_component_qty,
      kc.q2_standard_quotation,
      kc.q3_height,
      kc.q4_width,
      kc.presserso_id_number,
      kc.product_id,
      kc.product_is_active,
      kc.is_active,
      kc.last_sync_status,
      kc.last_sync_message
    FROM kits k
    INNER JOIN kit_components kc ON kc.kit_id = k.id
    ORDER BY k.part_id, kc.sort_order, kc.id
    `
  );
}

async function insertComponent(data) {
  const result = await run(
    `
    INSERT INTO kit_components (
      kit_id,
      component_id,
      product_name,
      lang_code,
      default_component_qty,
      sort_order,
      is_active,
      product_id,
      product_is_active,
      allowed_groups_json,
      q2_standard_quotation,
      q3_height,
      q4_width,
      presserso_id_number,
      product_image_large_url,
      product_image_xlarge_url,
      source_hash,
      last_sync_status,
      last_sync_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      data.kitId,
      data.componentId || null,
      data.productName || null,
      data.langCode || null,
      data.defaultComponentQty || 0,
      data.sortOrder || 0,
      data.isActive ?? 1,
      data.productId || null,
      data.productIsActive || 0,
      data.allowedGroupsJson || null,
      data.q2StandardQuotation || null,
      data.q3Height || null,
      data.q4Width || null,
      data.pressersoIdNumber || null,
      data.productImageLargeUrl || null,
      data.productImageXlargeUrl || null,
      data.sourceHash || null,
      data.lastSyncStatus || null,
      data.lastSyncMessage || null
    ]
  );

  return result.lastID;
}
async function updateComponentSyncData(componentDbId, syncData) {
  await run(
    `
    UPDATE kit_components
    SET product_id = ?,
        product_is_active = ?,
        allowed_groups_json = ?,
        product_image_large_url = ?,
        product_image_xlarge_url = ?,
        last_sync_status = ?,
        last_sync_message = ?
    WHERE id = ?
    `,
    [
      syncData.productId,
      syncData.productIsActive,
      syncData.allowedGroupsJson,
      syncData.productImageLargeUrl || null,
      syncData.productImageXlargeUrl || null,
      syncData.lastSyncStatus,
      syncData.lastSyncMessage,
      componentDbId
    ]
  );
}

async function getAllKitsDetailed() {
  const kits = await all(
    `
    SELECT *
    FROM kits
    ORDER BY part_id
    `
  );

  const detailed = [];

  for (const kit of kits) {
    const components = await all(
      `
      SELECT *
      FROM kit_components
      WHERE kit_id = ?
      ORDER BY sort_order, id
      `,
      [kit.id]
    );

    detailed.push({
      ...kit,
      components
    });
  }

  return detailed;
}

async function getComponentsByKitId(kitId) {
  return all(
    `
    SELECT
      kc.id,
      kc.kit_id,
      kc.component_id,
      kc.product_name,
      kc.lang_code,
      kc.default_component_qty,
      kc.sort_order,
      kc.is_active,
      kc.product_id,
      kc.product_is_active,
      kc.allowed_groups_json,
      kc.q2_standard_quotation,
      kc.q3_height,
      kc.q4_width,
      kc.presserso_id_number,
      kc.product_image_large_url,
      kc.product_image_xlarge_url,
      kc.last_sync_status,
      kc.last_sync_message,
      kc.source_hash
    FROM kit_components kc
    WHERE kc.kit_id = ?
    ORDER BY kc.sort_order, kc.id
    `,
    [kitId]
  );
}

async function getComponentByKitIdAndComponentId(kitId, componentId) {
  return get(
    `
    SELECT *
    FROM kit_components
    WHERE kit_id = ? AND component_id = ?
    LIMIT 1
    `,
    [kitId, componentId]
  );
}

async function updateComponentById(componentDbId, data) {
  await run(
    `
    UPDATE kit_components
    SET product_name = ?,
        lang_code = ?,
        default_component_qty = ?,
        sort_order = ?,
        is_active = ?,
        q2_standard_quotation = ?,
        q3_height = ?,
        q4_width = ?,
        presserso_id_number = ?,
        source_hash = ?,
        last_sync_status = ?,
        last_sync_message = ?
    WHERE id = ?
    `,
    [
      data.productName,
      data.langCode,
      data.defaultComponentQty,
      data.sortOrder,
      data.isActive,
      data.q2StandardQuotation,
      data.q3Height,
      data.q4Width,
      data.pressersoIdNumber,
      data.sourceHash,
      data.lastSyncStatus,
      data.lastSyncMessage,
      componentDbId
    ]
  );
}

async function deactivateMissingComponents(kitId, existingComponentIds) {
  if (!existingComponentIds.length) {
    await run(
      `
      UPDATE kit_components
      SET is_active = 0,
          last_sync_status = 'DISABLED',
          last_sync_message = 'Composant absent du dernier import Excel'
      WHERE kit_id = ?
      `,
      [kitId]
    );
    return;
  }

  const placeholders = existingComponentIds.map(() => "?").join(",");

  await run(
    `
    UPDATE kit_components
    SET is_active = 0,
        last_sync_status = 'DISABLED',
        last_sync_message = 'Composant absent du dernier import Excel'
    WHERE kit_id = ?
      AND component_id NOT IN (${placeholders})
    `,
    [kitId, ...existingComponentIds]
  );
}
async function getPendingComponents(limit = 200, offset = 0) {
  return all(
    `
    SELECT
      kc.*,
      k.part_id
    FROM kit_components kc
    INNER JOIN kits k ON k.id = kc.kit_id
    WHERE kc.is_active = 1
      AND (
        kc.last_sync_status = 'TO_RESYNC'
        OR kc.last_sync_status = 'NOT_FOUND'
        OR kc.product_id IS NULL
      )
    ORDER BY
      CASE
        WHEN kc.last_sync_status = 'TO_RESYNC' THEN 1
        WHEN kc.last_sync_status = 'NOT_FOUND' THEN 2
        ELSE 3
      END,
      k.part_id,
      kc.sort_order,
      kc.id
    LIMIT ?
    OFFSET ?
    `,
    [limit, offset]
  );
}
async function countPendingComponents() {
  const row = await get(
    `
    SELECT COUNT(*) AS total
    FROM kit_components kc
    WHERE kc.is_active = 1
      AND (
        kc.last_sync_status = 'TO_RESYNC'
        OR kc.last_sync_status = 'NOT_FOUND'
        OR kc.product_id IS NULL
      )
    `
  );

  return row?.total || 0;
}

async function getComponentsByStatus(status, limit = 100, offset = 0) {
  return all(
    `
    SELECT
      kc.*,
      k.part_id
    FROM kit_components kc
    INNER JOIN kits k ON k.id = kc.kit_id
    WHERE kc.last_sync_status = ?
    ORDER BY k.part_id, kc.sort_order, kc.id
    LIMIT ?
    OFFSET ?
    `,
    [status, limit, offset]
  );
}
async function countComponentsByStatus(status) {
  const row = await get(
    `
    SELECT COUNT(*) AS total
    FROM kit_components
    WHERE last_sync_status = ?
    `,
    [status]
  );

  return row?.total || 0;
}

async function saveImportedKits(kits) {
  const importedAt = new Date().toISOString();

  let kitsSaved = 0;
  let componentsSaved = 0;
  let componentsCreated = 0;
  let componentsUpdated = 0;
  let componentsUnchanged = 0;
  let componentsDisabled = 0;

  for (const kit of kits) {
    const kitId = await upsertKit({
  partId: kit.part_id,
  kitName: kit.kit_name,
  defaultKitQty: kit.default_kit_qty || 1,
  isActive: 1,
  lastImportedAt: importedAt
});

    const importedComponentIds = [];

    const components = Array.isArray(kit.components) ? kit.components : [];

    for (let i = 0; i < components.length; i += 1) {
  const component = components[i];
  const sortOrder = i + 1;
  const sourceHash = buildComponentSourceHash(component);

  importedComponentIds.push(component.component_id);

  const existing = await getComponentByKitIdAndComponentId(kitId, component.component_id);

  if (!existing) {
    await insertComponent({
      kitId,
      componentId: component.component_id,
      productName: component.product_name,
      langCode: component.lang_code,
      defaultComponentQty: component.default_component_qty,
      sortOrder,
      isActive: 1,
      productId: null,
      productIsActive: 0,
      allowedGroupsJson: null,
      q2StandardQuotation: component.q2_standard_quotation,
      q3Height: component.q3_height,
      q4Width: component.q4_width,
      pressersoIdNumber: component.presserso_id_number || null,
      productImageLargeUrl: component.product_image_large_url || null,
      productImageXlargeUrl: component.product_image_xlarge_url || null,
      sourceHash,
      lastSyncStatus: "TO_RESYNC",
      lastSyncMessage: "Nouveau composant importé, synchronisation requise"
    });

    componentsSaved += 1;
    componentsCreated += 1;
    continue;
  }

  const hasChanged = existing.source_hash !== sourceHash;

  if (hasChanged) {
    await updateComponentById(existing.id, {
      productName: component.product_name,
      langCode: component.lang_code,
      defaultComponentQty: component.default_component_qty,
      sortOrder,
      isActive: 1,
      q2StandardQuotation: component.q2_standard_quotation,
      q3Height: component.q3_height,
      q4Width: component.q4_width,
      pressersoIdNumber: component.presserso_id_number || null,
      sourceHash,
      lastSyncStatus: "TO_RESYNC",
      lastSyncMessage: "Composant modifié, resynchronisation requise"
    });

    await updateComponentSyncData(existing.id, {
      productId: null,
      productIsActive: 0,
      allowedGroupsJson: null,
      productImageLargeUrl: null,
      productImageXlargeUrl: null,
      lastSyncStatus: "TO_RESYNC",
      lastSyncMessage: "Composant modifié, resynchronisation requise"
    });

    componentsSaved += 1;
    componentsUpdated += 1;
  } else {
    await updateComponentById(existing.id, {
      productName: component.product_name,
      langCode: component.lang_code,
      defaultComponentQty: component.default_component_qty,
      sortOrder,
      isActive: 1,
      q2StandardQuotation: component.q2_standard_quotation,
      q3Height: component.q3_height,
      q4Width: component.q4_width,
      pressersoIdNumber: component.presserso_id_number || null,
      sourceHash,
      lastSyncStatus: existing.last_sync_status,
      lastSyncMessage: existing.last_sync_message
    });

    componentsUnchanged += 1;
  }
}

    const beforeDeactivate = await getComponentsByKitId(kitId);
    const activeBefore = beforeDeactivate.filter(c => c.is_active === 1).length;

    await deactivateMissingComponents(kitId, importedComponentIds);

    const afterDeactivate = await getComponentsByKitId(kitId);
    const activeAfter = afterDeactivate.filter(c => c.is_active === 1).length;

    componentsDisabled += Math.max(0, activeBefore - activeAfter);

    kitsSaved += 1;
  }

  return {
    importedAt,
    kitsSaved,
    componentsSaved,
    componentsCreated,
    componentsUpdated,
    componentsUnchanged,
    componentsDisabled
  };
}

module.exports = {
  getAllKits,
  getKitByPartId,
  getKitById,
  upsertKit,
  deleteComponentsByKitId,
  insertComponent,
  updateComponentById,
  deactivateMissingComponents,
  getComponentsByKitId,
  getComponentByKitIdAndComponentId,
  getAllKitsDetailed,
  getPendingComponents,
  countPendingComponents,
  getComponentsByStatus,
  countComponentsByStatus,
  getAllKitComponentsForExport,
  saveImportedKits,
  updateComponentSyncData
};