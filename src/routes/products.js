const express = require("express");
const router = express.Router();
const { syncProductByComponentId } = require("../services/productSyncService");

router.post("/sync", async (req, res) => {
  try {
    const { componentId } = req.body;

    if (!componentId) {
      return res.status(400).json({
        success: false,
        message: "componentId obligatoire"
      });
    }

    const result = await syncProductByComponentId(componentId);

    res.json(result);
  } catch (error) {
    console.error("Erreur sync produit:", error.message);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;