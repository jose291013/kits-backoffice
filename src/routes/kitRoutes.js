const express = require("express");
const kitController = require("../controllers/kitController");

const router = express.Router();

router.get("/", kitController.getAllKits);
router.get("/:partId", kitController.getKitByPartId);

module.exports = router;