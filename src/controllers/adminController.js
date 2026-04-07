const ExcelJS = require("exceljs");
const kitRepository = require("../repositories/kitRepository");

async function getAllKits(req, res, next) {
  try {
    const kits = await kitRepository.getAllKits();

    res.json({
      ok: true,
      count: kits.length,
      kits
    });
  } catch (err) {
    next(err);
  }
}

async function getKitDetail(req, res, next) {
  try {
    const partId = String(req.params.partId || "").trim();
    const kit = await kitRepository.getKitByPartId(partId);

    if (!kit) {
      return res.status(404).json({
        ok: false,
        error: "Kit introuvable"
      });
    }

    res.json({
      ok: true,
      kit
    });
  } catch (err) {
    next(err);
  }
}

async function deleteKit(req, res, next) {
  try {
    const partId = String(req.params.partId || "").trim();

    if (!partId) {
      return res.status(400).json({
        ok: false,
        error: "PartID obligatoire"
      });
    }

    const result = await kitRepository.deleteKitByPartId(partId);

    if (!result.deleted) {
      return res.status(404).json({
        ok: false,
        error: "Kit introuvable"
      });
    }

    res.json({
      ok: true,
      message: "Kit supprimé avec succès",
      partId
    });
  } catch (err) {
    next(err);
  }
}

async function exportExcel(req, res, next) {
  try {
    const rows = await kitRepository.getAllKitComponentsForExport();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Kits Export");

    worksheet.columns = [
      { header: "PartID", key: "part_id", width: 28 },
      { header: "KitName", key: "kit_name", width: 28 },
      { header: "DefaultKitQty", key: "default_kit_qty", width: 14 },
      { header: "KitIsActive", key: "kit_is_active", width: 12 },
      { header: "LastImportedAt", key: "last_imported_at", width: 24 },
      { header: "SortOrder", key: "sort_order", width: 10 },
      { header: "ComponentID", key: "component_id", width: 40 },
      { header: "ProductName", key: "product_name", width: 40 },
      { header: "LangCode", key: "lang_code", width: 12 },
      { header: "DefaultComponentQty", key: "default_component_qty", width: 18 },
      { header: "Q2StandardQuotation", key: "q2_standard_quotation", width: 18 },
      { header: "Q3Height", key: "q3_height", width: 14 },
      { header: "Q4Width", key: "q4_width", width: 14 },
      { header: "PressersoIdNumber", key: "presserso_id_number", width: 18 },
      { header: "ProductId", key: "product_id", width: 38 },
      { header: "ProductIsActive", key: "product_is_active", width: 14 },
      { header: "IsActive", key: "is_active", width: 10 },
      { header: "LastSyncStatus", key: "last_sync_status", width: 16 },
      { header: "LastSyncMessage", key: "last_sync_message", width: 40 }
    ];

    rows.forEach(row => worksheet.addRow(row));

    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = { from: "A1", to: "S1" };

    const fileName = `kits-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

async function resetAllKits(req, res, next) {
  try {
    await kitRepository.resetAllKitsData();

    res.json({
      ok: true,
      message: "Tous les kits et composants ont été supprimés."
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllKits,
  getKitDetail,
  deleteKit,
  resetAllKits,
  exportExcel
};