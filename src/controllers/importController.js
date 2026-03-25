const { parseExcel } = require("../services/excelService");
const { groupRowsByKit } = require("../services/kitService");
const kitRepository = require("../repositories/kitRepository");

async function importExcel(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier reçu" });
    }

    const rows = await parseExcel(req.file.path);
    const kits = groupRowsByKit(rows);

    const saveResult = await kitRepository.saveImportedKits(kits);

    res.json({
  ok: true,
  filename: req.file.originalname,
  rows: rows.length,
  kitsFound: kits.length,
  kitsSaved: saveResult.kitsSaved,
  componentsSaved: saveResult.componentsSaved,
  componentsCreated: saveResult.componentsCreated,
  componentsUpdated: saveResult.componentsUpdated,
  componentsUnchanged: saveResult.componentsUnchanged,
  componentsDisabled: saveResult.componentsDisabled,
  importedAt: saveResult.importedAt
});
  } catch (err) {
    next(err);
  }
}

module.exports = {
  importExcel
};