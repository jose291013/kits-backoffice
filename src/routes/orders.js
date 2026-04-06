const express = require("express");
const router = express.Router();
const { buildOrderBatches } = require("../services/orderBatchService");

router.post("/build-from-import/:importId", async (req, res) => {
  try {
    const importId = Number(req.params.importId);

    if (!importId) {
      return res.status(400).json({
        success: false,
        message: "importId invalide"
      });
    }

    const result = await buildOrderBatches(importId);

    res.json(result);
  } catch (error) {
    console.error("Erreur build order batches:", error.message);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;