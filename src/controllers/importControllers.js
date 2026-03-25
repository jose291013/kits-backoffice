const { parseExcel } = require("../services/excelService");
const { groupRowsByKit } = require("../services/kitService");

async function importExcel(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier reçu" });
    }

    const rows = parseExcel(req.file.path);
    const kits = groupRowsByKit(rows);

    res.json({
      ok: true,
      filename: req.file.originalname,
      rows: rows.length,
      kitsFound: kits.length,
      kits
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  importExcel
};