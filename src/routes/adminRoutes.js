const express = require("express");
const adminController = require("../controllers/adminController");

const router = express.Router();

router.get("/kits", adminController.getAllKits);
router.get("/kits/:partId", adminController.getKitDetail);
router.delete("/kits/:partId", adminController.deleteKit);
router.get("/export-excel", adminController.exportExcel);

module.exports = router;