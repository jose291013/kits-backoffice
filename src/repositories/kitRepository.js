const db = require("./db");

function getAllKits() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM kits ORDER BY part_id`, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function getKitByPartId(partId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM kits WHERE part_id = ?`, [partId], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

module.exports = {
  getAllKits,
  getKitByPartId
};