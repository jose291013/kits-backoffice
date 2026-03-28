const express = require("express");
const importController = require("../controllers/importController");
const upload = require("../middlewares/uploadExcel");

const router = express.Router();

router.post("/excel", upload.single("file"), importController.importExcel);

module.exports = router;