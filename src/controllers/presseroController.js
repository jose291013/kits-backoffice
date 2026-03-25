const kitRepository = require("../repositories/kitRepository");
const presseroService = require("../services/presseroService");

async function syncOneKit(kit) {
  const results = [];

  for (const component of kit.components) {
    try {
      const syncData = await presseroService.resolveProductByName(component.product_name);

      await kitRepository.updateComponentSyncData(component.id, syncData);

      results.push({
        componentId: component.component_id,
        productName: component.product_name,
        status: syncData.lastSyncStatus,
        message: syncData.lastSyncMessage,
        productId: syncData.productId,
        productIsActive: syncData.productIsActive
      });
    } catch (err) {
      const fallback = {
        productId: null,
        productIsActive: 0,
        allowedGroupsJson: null,
        lastSyncStatus: "ERROR",
        lastSyncMessage: err.message
      };

      await kitRepository.updateComponentSyncData(component.id, fallback);

      results.push({
        componentId: component.component_id,
        productName: component.product_name,
        status: "ERROR",
        message: err.message,
        productId: null,
        productIsActive: 0
      });
    }
  }

  return {
    partId: kit.part_id,
    kitId: kit.id,
    componentsProcessed: results.length,
    results
  };
}

async function syncOneComponent(component) {
  try {
    const syncData = await presseroService.resolveProductByName(component.product_name);

    await kitRepository.updateComponentSyncData(component.id, syncData);

    return {
      componentId: component.component_id,
      productName: component.product_name,
      partId: component.part_id || null,
      status: syncData.lastSyncStatus,
      message: syncData.lastSyncMessage,
      productId: syncData.productId,
      productIsActive: syncData.productIsActive
    };
  } catch (err) {
    const fallback = {
      productId: null,
      productIsActive: 0,
      allowedGroupsJson: null,
      lastSyncStatus: "ERROR",
      lastSyncMessage: err.message
    };

    await kitRepository.updateComponentSyncData(component.id, fallback);

    return {
      componentId: component.component_id,
      productName: component.product_name,
      partId: component.part_id || null,
      status: "ERROR",
      message: err.message,
      productId: null,
      productIsActive: 0
    };
  }
}

async function syncPendingComponents(req, res, next) {
  try {
    const limitRaw = Number(req.query.limit || 200);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 200;

    const pendingComponents = await kitRepository.getPendingComponents(limit);

    const summary = {
      requestedLimit: limit,
      componentsFound: pendingComponents.length,
      okCount: 0,
      partialOkCount: 0,
      notFoundCount: 0,
      errorCount: 0
    };

    const results = [];

    for (const component of pendingComponents) {
      const result = await syncOneComponent(component);

      if (result.status === "OK") summary.okCount += 1;
      else if (result.status === "PARTIAL_OK") summary.partialOkCount += 1;
      else if (result.status === "NOT_FOUND") summary.notFoundCount += 1;
      else if (result.status === "ERROR") summary.errorCount += 1;

      results.push(result);
    }

    res.json({
      ok: true,
      summary,
      results
    });
  } catch (err) {
    next(err);
  }
}

async function syncKitByPartId(req, res, next) {
  try {
    const { partId } = req.params;
    const kit = await kitRepository.getKitByPartId(partId);

    if (!kit) {
      return res.status(404).json({
        ok: false,
        error: "Kit introuvable"
      });
    }

    const result = await syncOneKit(kit);

    res.json({
      ok: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
}
async function getPendingComponents(req, res, next) {
  try {
    const limitRaw = Number(req.query.limit || 50);
    const offsetRaw = Number(req.query.offset || 0);

    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50;
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

    const total = await kitRepository.countPendingComponents();
    const items = await kitRepository.getPendingComponents(limit, offset);

    res.json({
      ok: true,
      summary: {
        totalPending: total,
        returned: items.length,
        limit,
        offset
      },
      items: items.map(item => ({
        id: item.id,
        partId: item.part_id,
        componentId: item.component_id,
        productName: item.product_name,
        langCode: item.lang_code,
        productId: item.product_id,
        productIsActive: item.product_is_active,
        lastSyncStatus: item.last_sync_status,
        lastSyncMessage: item.last_sync_message
      }))
    });
  } catch (err) {
    next(err);
  }
}

async function getComponentsByStatus(req, res, next) {
  try {
    const status = String(req.query.status || "").trim();

    if (!status) {
      return res.status(400).json({
        ok: false,
        error: "Le paramètre status est obligatoire"
      });
    }

    const limitRaw = Number(req.query.limit || 50);
    const offsetRaw = Number(req.query.offset || 0);

    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50;
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

    const total = await kitRepository.countComponentsByStatus(status);
    const items = await kitRepository.getComponentsByStatus(status, limit, offset);

    res.json({
      ok: true,
      summary: {
        status,
        total,
        returned: items.length,
        limit,
        offset
      },
      items: items.map(item => ({
        id: item.id,
        partId: item.part_id,
        componentId: item.component_id,
        productName: item.product_name,
        langCode: item.lang_code,
        productId: item.product_id,
        productIsActive: item.product_is_active,
        lastSyncStatus: item.last_sync_status,
        lastSyncMessage: item.last_sync_message
      }))
    });
  } catch (err) {
    next(err);
  }
}

async function syncAllKits(req, res, next) {
  try {
    const kits = await kitRepository.getAllKitsDetailed();

    const summary = {
      kitsProcessed: 0,
      componentsProcessed: 0,
      okCount: 0,
      partialOkCount: 0,
      notFoundCount: 0,
      errorCount: 0
    };

    const kitResults = [];

    for (const kit of kits) {
      const result = await syncOneKit(kit);

      summary.kitsProcessed += 1;
      summary.componentsProcessed += result.componentsProcessed;

      for (const item of result.results) {
        if (item.status === "OK") summary.okCount += 1;
        else if (item.status === "PARTIAL_OK") summary.partialOkCount += 1;
        else if (item.status === "NOT_FOUND") summary.notFoundCount += 1;
        else if (item.status === "ERROR") summary.errorCount += 1;
      }

      kitResults.push({
        partId: result.partId,
        kitId: result.kitId,
        componentsProcessed: result.componentsProcessed,
        statuses: result.results.map(r => ({
          componentId: r.componentId,
          status: r.status,
          productId: r.productId
        }))
      });
    }

    res.json({
      ok: true,
      summary,
      kits: kitResults
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  syncKitByPartId,
  syncAllKits,
  syncPendingComponents,
  getPendingComponents,
  getComponentsByStatus
};