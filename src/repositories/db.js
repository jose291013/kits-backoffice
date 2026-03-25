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
});

module.exports = db;