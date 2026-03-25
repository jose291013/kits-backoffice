const express = require("express");

const router = express.Router();

router.get("/test", (req, res) => {
  res.json({ ok: true, message: "admin routes ok" });
});

module.exports = router;