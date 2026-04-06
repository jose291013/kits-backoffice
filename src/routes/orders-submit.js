const express = require("express");
const router = express.Router();
const { submitBatchToPressero } = require("../services/presseroOrderCreateService");

router.post("/submit-batch/:batchId", async (req, res) => {
  try {
    const batchId = Number(req.params.batchId);

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: "batchId invalide"
      });
    }

    const result = await submitBatchToPressero(batchId);
    res.json(result);
  } catch (error) {
    console.error("Erreur submit batch:", error.response?.data || error.message);

    res.status(500).json({
      success: false,
      message: error.message,
      details: error.response?.data || null
    });
  }
});

module.exports = router;