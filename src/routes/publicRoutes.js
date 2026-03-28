const express = require("express");
const publicController = require("../controllers/publicController");

const router = express.Router();

router.get("/kits-search", publicController.searchVisibleKits);
router.get("/kits/:partId/visible", publicController.getVisibleKitByPartId);
router.post("/kits/:partId/price", publicController.priceVisibleKitByPartId);

module.exports = router;