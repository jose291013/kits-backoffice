const express = require("express");
const presseroController = require("../controllers/presseroController");

const router = express.Router();

router.post("/sync-kit/:partId", presseroController.syncKitByPartId);
router.post("/sync-pending", presseroController.syncPendingComponents);
router.post("/sync-all-kits", presseroController.syncAllKits);

router.get("/pending-components", presseroController.getPendingComponents);
router.get("/components-by-status", presseroController.getComponentsByStatus);

module.exports = router;