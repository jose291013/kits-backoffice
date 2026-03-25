const kitRepository = require("../repositories/kitRepository");

async function getAllKits(req, res, next) {
  try {
    const kits = await kitRepository.getAllKits();

    res.json({
      ok: true,
      count: kits.length,
      kits
    });
  } catch (err) {
    next(err);
  }
}

async function getKitByPartId(req, res, next) {
  try {
    const { partId } = req.params;
    const kit = await kitRepository.getKitByPartId(partId);

    if (!kit) {
      return res.status(404).json({
        ok: false,
        error: "Kit introuvable"
      });
    }

    res.json({
      ok: true,
      kit
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllKits,
  getKitByPartId
};