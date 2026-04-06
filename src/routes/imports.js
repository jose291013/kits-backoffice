const express = require("express");
const multer = require("multer");
const { previewExcelImport } = require("../services/excelImportService");
const ExcelJS = require("exceljs");
const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/preview", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Aucun fichier reçu"
      });
    }

    const result = await previewExcelImport(req.file.path, req.file.originalname);

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error("Erreur preview import:", err.message);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

router.get("/template", async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();

    const ws = workbook.addWorksheet("Import_Excel");
    ws.columns = [
      { header: "store_code", key: "store_code", width: 16 },
      { header: "order_group", key: "order_group", width: 14 },
      { header: "po_number", key: "po_number", width: 18 },
      { header: "requested_ship_date", key: "requested_ship_date", width: 18 },
      { header: "ship_method_name", key: "ship_method_name", width: 28 },
      { header: "line_no", key: "line_no", width: 10 },
      { header: "line_type", key: "line_type", width: 14 },
      { header: "item_ref", key: "item_ref", width: 40 },
      { header: "quantity_q1", key: "quantity_q1", width: 14 },
      { header: "job_number", key: "job_number", width: 20 },
      { header: "item_notes", key: "item_notes", width: 34 }
    ];

    ws.addRow({
      store_code: "3305",
      order_group: "A",
      po_number: "PO-3305-001",
      requested_ship_date: "2026-04-20",
      ship_method_name: "Livraison standard",
      line_no: 1,
      line_type: "COMPONENT",
      item_ref: "C_47302676 - ILV stic baseline - UNI",
      quantity_q1: 2,
      job_number: "JOB-3305-01",
      item_notes: "Réassort stickers"
    });

    const help = workbook.addWorksheet("Instructions");
    help.columns = [
      { header: "Champ", key: "field", width: 24 },
      { header: "Description", key: "desc", width: 90 }
    ];
    help.addRow({ field: "store_code", desc: "Code magasin existant dans le référentiel magasins." });
    help.addRow({ field: "order_group", desc: "Permet de regrouper plusieurs lignes dans une même commande par magasin." });
    help.addRow({ field: "line_type", desc: "Valeur attendue : COMPONENT ou KIT." });
    help.addRow({ field: "item_ref", desc: "component_id / product_name si COMPONENT, ou part_id / kit_name si KIT." });
    help.addRow({ field: "quantity_q1", desc: "Quantité de commande." });
    help.addRow({ field: "requested_ship_date", desc: "Format recommandé : YYYY-MM-DD." });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="modele_import_commandes.xlsx"'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Erreur export template commandes:", error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;