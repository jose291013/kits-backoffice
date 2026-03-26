const express = require("express");
const adminController = require("../controllers/adminController");

const router = express.Router();

router.get("/export-excel", adminController.exportExcel);

module.exports = router;