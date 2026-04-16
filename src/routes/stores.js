const express = require("express");
const multer = require("multer");
const router = express.Router();
const ExcelJS = require("exceljs");
const db = require("../repositories/db");

const { syncStoreFromPressero } = require("../services/storeSyncService");
const { importStoresMaster } = require("../services/storeMasterImportService");
const { syncAllStores } = require("../services/storeBulkSyncService");

const upload = multer({ dest: "uploads/" });

router.post("/sync", async (req, res) => {
  try {
    const { storeCode, storeName, pressoUserEmail } = req.body;

    if (!storeCode || !pressoUserEmail) {
      return res.status(400).json({
        success: false,
        message: "storeCode et pressoUserEmail sont obligatoires"
      });
    }

    const result = await syncStoreFromPressero({
      storeCode,
      storeName,
      pressoUserEmail
    });

    res.json(result);
  } catch (error) {
    console.error("Erreur sync store:", error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post("/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Aucun fichier reçu"
      });
    }

    const result = await importStoresMaster(req.file.path, req.file.originalname);
    res.json(result);
  } catch (error) {
    console.error("Erreur import stores:", error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post("/sync-all", async (req, res) => {
  try {
    const result = await syncAllStores();
    res.json(result);
  } catch (error) {
    console.error("Erreur sync-all stores:", error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get("/", async (req, res) => {
  const db = require("../repositories/db");
  db.all(
    `
    SELECT
      id,
      store_code,
      store_name,
      presso_user_email,
      presso_user_id,
      site_id,
      sync_status,
      sync_message,
      last_synced_at
    FROM stores
    ORDER BY store_code ASC
    `,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: err.message
        });
      }
      res.json({
        success: true,
        stores: rows || []
      });
    }
  );
});

router.get("/export", async (req, res) => {
  try {
    db.all(
      `
      SELECT
  store_code,
  store_name,
  presso_user_email AS pressero_user_email,
  sync_status,
  sync_message,
  last_synced_at
FROM stores
ORDER BY store_code ASC
      `,
      [],
      async (err, rows) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: err.message
          });
        }

        const workbook = new ExcelJS.Workbook();

        const ws = workbook.addWorksheet("stores_master");
        ws.columns = [
          { header: "store_code", key: "store_code", width: 16 },
          { header: "store_name", key: "store_name", width: 34 },
          { header: "pressero_user_email", key: "pressero_user_email", width: 30 },
          { header: "sync_status", key: "sync_status", width: 16 },
          { header: "sync_message", key: "sync_message", width: 40 },
          { header: "last_synced_at", key: "last_synced_at", width: 24 }
        ];

        (rows || []).forEach((row) => ws.addRow(row));

        const help = workbook.addWorksheet("instructions");
        help.columns = [
          { header: "Champ", key: "field", width: 24 },
          { header: "Description", key: "desc", width: 80 }
        ];
        help.addRow({
          field: "store_code",
          desc: "Code magasin unique utilisé dans les imports de commandes."
        });
        help.addRow({
          field: "store_name",
          desc: "Nom du magasin."
        });
        help.addRow({
          field: "pressero_user_email",
          desc: "Email de l’utilisateur Pressero lié au magasin. C’est cet email qui sert à récupérer userId et adresses."
        });
        help.addRow({
          field: "sync_status / sync_message / last_synced_at",
          desc: "Colonnes informatives. Vous pouvez les conserver pour suivi."
        });

        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        const fileName = `stores-master-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.xlsx`;

res.setHeader(
  "Content-Disposition",
  `attachment; filename="${fileName}"`
);

        await workbook.xlsx.write(res);
        res.end();
      }
    );
  } catch (error) {
    console.error("Erreur export stores:", error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;