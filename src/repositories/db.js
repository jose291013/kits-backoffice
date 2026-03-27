const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "../../data.sqlite");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS kits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id TEXT UNIQUE,
      kit_name TEXT,
      default_kit_qty INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      last_imported_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS kit_components (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kit_id INTEGER NOT NULL,
      component_id TEXT,
      product_name TEXT,
      lang_code TEXT,
      default_component_qty INTEGER,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      product_id TEXT,
      product_is_active INTEGER DEFAULT 0,
      allowed_groups_json TEXT,
      q2_standard_quotation TEXT,
      q3_height TEXT,
      q4_width TEXT,
      presserso_id_number TEXT,
      product_image_large_url TEXT,
      product_image_xlarge_url TEXT,
      source_hash TEXT,
      last_sync_status TEXT,
      last_sync_message TEXT,
      FOREIGN KEY (kit_id) REFERENCES kits(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      imported_at TEXT,
      status TEXT,
      summary_json TEXT
    )
  `);

  db.all(`PRAGMA table_info(kit_components)`, [], (err, columns) => {
  if (err) {
    console.error("Erreur PRAGMA kit_components:", err.message);
    return;
  }

  const columnNames = columns.map(col => col.name);

  if (!columnNames.includes("source_hash")) {
    db.run(`ALTER TABLE kit_components ADD COLUMN source_hash TEXT`, alterErr => {
      if (alterErr) {
        console.error("Erreur ajout colonne source_hash:", alterErr.message);
      } else {
        console.log("Colonne source_hash ajoutée à kit_components");
      }
    });
  }

  if (!columnNames.includes("product_image_large_url")) {
    db.run(`ALTER TABLE kit_components ADD COLUMN product_image_large_url TEXT`, alterErr => {
      if (alterErr) {
        console.error("Erreur ajout colonne product_image_large_url:", alterErr.message);
      } else {
        console.log("Colonne product_image_large_url ajoutée à kit_components");
      }
    });
  }

  if (!columnNames.includes("product_image_xlarge_url")) {
    db.run(`ALTER TABLE kit_components ADD COLUMN product_image_xlarge_url TEXT`, alterErr => {
      if (alterErr) {
        console.error("Erreur ajout colonne product_image_xlarge_url:", alterErr.message);
      } else {
        console.log("Colonne product_image_xlarge_url ajoutée à kit_components");
      }
    });
  }
});
});

module.exports = db;