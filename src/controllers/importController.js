const fs = require("fs");
const excelService = require("../services/excelService");
const kitRepository = require("../repositories/kitRepository");

async function importExcel(req, res, next) {
  const file = req.file;

  try {
    if (!file) {
      return res.status(400).json({
        ok: false,
        error: "Aucun fichier reçu"
      });
    }

    const rows = await excelService.parseExcel(file.path);

    const saveResult = await kitRepository.saveImportedKits(result.kits, {
      filename: file.originalname
    });

    res.json({
  ok: true,
  filename: file.originalname,
  rows: result.rows,
  kitsFound: result.kitsFound,
  kitsSaved: saveResult.kitsSaved,
  componentsSaved: saveResult.componentsSaved,
  componentsCreated: saveResult.componentsCreated,
  componentsUpdated: saveResult.componentsUpdated,
  componentsUnchanged: saveResult.componentsUnchanged,
  componentsDisabled: saveResult.componentsDisabled,
  importedAt: saveResult.importedAt,
  message: result.kitsFound === 0
    ? "Aucun kit détecté, aucune modification effectuée."
    : "Import terminé avec succès."
});
  } catch (err) {
    next(err);
  } finally {
    if (file?.path) {
      fs.unlink(file.path, unlinkErr => {
        if (unlinkErr) {
          console.error("Erreur suppression fichier upload:", unlinkErr.message);
        }
      });
    }
  }
}

module.exports = {
  importExcel
};