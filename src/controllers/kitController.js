const kitRepository = require("../repositories/kitRepository");

async function getAllKits(req, res, next) {
  try {
    const kits = await kitRepository.getAllKits();
    res.json({ ok: true, kits });
  } catch (err) {
    next(err);
  }
}

async function getKitByPartId(req, res, next) {
  try {
    const kit = await kitRepository.getKitByPartId(req.params.partId);
    if (!kit) {
      return res.status(404).json({ error: "Kit introuvable" });
    }
    res.json({ ok: true, kit });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllKits,
  getKitByPartId
};