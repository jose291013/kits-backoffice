const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dbDir = process.env.SQLITE_DIR || path.join(__dirname, "../../");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, "data.sqlite");
console.log("SQLITE DB PATH =", dbPath);

const db = new sqlite3.Database(dbPath);
db.configure("busyTimeout", 10000);

function tableInfo(tableName) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function columnExists(columns, columnName) {
  return columns.some((col) => col.name === columnName);
}

function run(sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function addColumnIfMissing(tableName, columns, columnName, columnSql) {
  if (!columnExists(columns, columnName)) {
    try {
      await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}`);
      console.log(`Colonne ${columnName} ajoutée à ${tableName}`);
    } catch (err) {
      console.error(`Erreur ajout colonne ${columnName} sur ${tableName}:`, err.message);
    }
  }
}

db.serialize(() => {
  db.run(`PRAGMA journal_mode = WAL;`);
  db.run(`PRAGMA foreign_keys = ON`);

  // =========================================================
  // A. TABLES EXISTANTES DU PROJET KITS
  // =========================================================

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

  // =========================================================
  // B. STORES / USERS / ADDRESS BOOK
  // =========================================================

  db.run(`
    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_code TEXT NOT NULL UNIQUE,
      store_name TEXT,
      presso_user_email TEXT NOT NULL,
      presso_user_id TEXT,
      site_id TEXT,
      address_book_id TEXT,
      preferred_address_id TEXT,
      billing_address_id TEXT,
      user_type TEXT,
      first_name TEXT,
      last_name TEXT,
      login TEXT,
      is_active INTEGER DEFAULT 1,
      last_synced_at TEXT,
      sync_status TEXT,
      sync_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS store_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id INTEGER NOT NULL,
      address_id TEXT NOT NULL,
      is_preferred INTEGER DEFAULT 0,
      is_billing INTEGER DEFAULT 0,
      business TEXT,
      first_name TEXT,
      last_name TEXT,
      title TEXT,
      address1 TEXT,
      address2 TEXT,
      address3 TEXT,
      city TEXT,
      state_province TEXT,
      postal TEXT,
      country TEXT,
      phone TEXT,
      fax TEXT,
      email TEXT,
      contact_id TEXT,
      vat TEXT,
      default_ship_method TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
      UNIQUE (store_id, address_id)
    )
  `);

  // =========================================================
  // C. CACHE PRODUIT GLOBAL
  // =========================================================

  db.run(`
    CREATE TABLE IF NOT EXISTS product_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      component_id TEXT NOT NULL UNIQUE,
      product_name TEXT NOT NULL,
      product_id TEXT,
      site_id TEXT,
      product_is_active INTEGER DEFAULT 0,
      allowed_groups_json TEXT,
      q2 REAL,
      q3 REAL,
      q4 REAL,
      workflow_id TEXT,
      workflow_name TEXT,
      last_modified TEXT,
      last_sync_status TEXT,
      last_sync_message TEXT,
      last_synced_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // =========================================================
  // D. IMPORTS EXCEL
  // =========================================================

  db.run(`
    CREATE TABLE IF NOT EXISTS excel_imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_filename TEXT NOT NULL,
      stored_filename TEXT,
      sheet_name TEXT,
      imported_by TEXT,
      imported_at TEXT DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'UPLOADED',
      total_rows INTEGER DEFAULT 0,
      valid_rows INTEGER DEFAULT 0,
      error_rows INTEGER DEFAULT 0,
      preview_json TEXT,
      message TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS excel_import_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      import_id INTEGER NOT NULL,
      row_number INTEGER NOT NULL,
      store_code TEXT NOT NULL,
      order_group TEXT DEFAULT 'A',
      po_number TEXT,
      requested_ship_date TEXT,
      ship_method_name TEXT,
      line_no INTEGER,
      line_type TEXT NOT NULL,
      item_ref TEXT NOT NULL,
      quantity_q1 REAL NOT NULL,
      job_number TEXT,
      item_notes TEXT,
      status TEXT DEFAULT 'PENDING',
      message TEXT,
      FOREIGN KEY (import_id) REFERENCES excel_imports(id) ON DELETE CASCADE
    )
  `);

  // =========================================================
  // E. BATCHES DE COMMANDES
  // =========================================================

  db.run(`
    CREATE TABLE IF NOT EXISTS order_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      import_id INTEGER NOT NULL,
      store_code TEXT NOT NULL,
      order_group TEXT NOT NULL DEFAULT 'A',
      presso_user_id TEXT,
      site_id TEXT,
      bill_to_address_id TEXT,
      ship_to_address_id TEXT,
      po_number TEXT,
      requested_ship_date TEXT,
      ship_method_name TEXT,
      status TEXT DEFAULT 'READY',
      total_lines INTEGER DEFAULT 0,
      payload_json TEXT,
      response_json TEXT,
      message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      executed_at TEXT,
      FOREIGN KEY (import_id) REFERENCES excel_imports(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_batch_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      source_line_id INTEGER,
      source_type TEXT NOT NULL,
      source_ref TEXT NOT NULL,
      component_id TEXT,
      product_name TEXT,
      product_id TEXT,
      q1 REAL NOT NULL,
      q2 REAL,
      q3 REAL,
      q4 REAL,
      price REAL,
      tax REAL,
      shipping REAL,
      weight REAL,
      job_number TEXT,
      item_notes TEXT,
      status TEXT DEFAULT 'READY',
      message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES order_batches(id) ON DELETE CASCADE,
      FOREIGN KEY (source_line_id) REFERENCES excel_import_lines(id) ON DELETE SET NULL
    )
  `);

  // =========================================================
  // F. LOGS DE SYNCHRO
  // =========================================================

  db.run(`
    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_type TEXT NOT NULL,
      target_key TEXT,
      status TEXT NOT NULL,
      message TEXT,
      payload_json TEXT,
      response_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // =========================================================
  // INDEXES
  // =========================================================

  db.run(`CREATE INDEX IF NOT EXISTS idx_kits_part_id ON kits(part_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_kit_components_kit_id ON kit_components(kit_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_kit_components_component_id ON kit_components(component_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_kit_components_product_id ON kit_components(product_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_kit_components_product_name ON kit_components(product_name)`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_stores_code ON stores(store_code)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_stores_email ON stores(presso_user_email)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_stores_user_id ON stores(presso_user_id)`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_store_addresses_store_id ON store_addresses(store_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_store_addresses_address_id ON store_addresses(address_id)`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_product_cache_component_id ON product_cache(component_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_product_cache_product_name ON product_cache(product_name)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_product_cache_product_id ON product_cache(product_id)`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_excel_import_lines_import_id ON excel_import_lines(import_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_excel_import_lines_store_code ON excel_import_lines(store_code)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_excel_import_lines_item_ref ON excel_import_lines(item_ref)`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_order_batches_import_id ON order_batches(import_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_order_batches_store_code ON order_batches(store_code)`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_order_batch_items_batch_id ON order_batch_items(batch_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_order_batch_items_component_id ON order_batch_items(component_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_order_batch_items_product_id ON order_batch_items(product_id)`);
});

// =========================================================
// MIGRATIONS CONDITIONNELLES
// =========================================================

(async () => {
  try {
    // kits
    {
      const cols = await tableInfo("kits");
      // SQLite ne permet pas facilement d'ajouter une colonne
// avec DEFAULT CURRENT_TIMESTAMP sur une table existante.
// On laisse donc created_at / updated_at absents pour les anciennes tables.
    }

    // kit_components
    {
      const cols = await tableInfo("kit_components");

      await addColumnIfMissing("kit_components", cols, "source_hash", `source_hash TEXT`);
      await addColumnIfMissing("kit_components", cols, "product_image_large_url", `product_image_large_url TEXT`);
      await addColumnIfMissing("kit_components", cols, "product_image_xlarge_url", `product_image_xlarge_url TEXT`);
      await addColumnIfMissing("kit_components", cols, "sort_order", `sort_order INTEGER DEFAULT 0`);
      await addColumnIfMissing("kit_components", cols, "allowed_groups_json", `allowed_groups_json TEXT`);
      await addColumnIfMissing("kit_components", cols, "product_is_active", `product_is_active INTEGER DEFAULT 0`);
      await addColumnIfMissing("kit_components", cols, "last_synced_at", `last_synced_at TEXT`);
      // SQLite ne permet pas facilement d'ajouter une colonne
// avec DEFAULT CURRENT_TIMESTAMP sur une table existante.
// On laisse donc created_at / updated_at absents pour les anciennes tables.
    }

    // imports
    {
      const cols = await tableInfo("imports");
      await addColumnIfMissing("imports", cols, "message", `message TEXT`);
    }

    // stores
    {
      const cols = await tableInfo("stores");
      await addColumnIfMissing("stores", cols, "store_name", `store_name TEXT`);
      await addColumnIfMissing("stores", cols, "presso_user_email", `presso_user_email TEXT`);
      await addColumnIfMissing("stores", cols, "presso_user_id", `presso_user_id TEXT`);
      await addColumnIfMissing("stores", cols, "site_id", `site_id TEXT`);
      await addColumnIfMissing("stores", cols, "address_book_id", `address_book_id TEXT`);
      await addColumnIfMissing("stores", cols, "preferred_address_id", `preferred_address_id TEXT`);
      await addColumnIfMissing("stores", cols, "billing_address_id", `billing_address_id TEXT`);
      await addColumnIfMissing("stores", cols, "user_type", `user_type TEXT`);
      await addColumnIfMissing("stores", cols, "first_name", `first_name TEXT`);
      await addColumnIfMissing("stores", cols, "last_name", `last_name TEXT`);
      await addColumnIfMissing("stores", cols, "login", `login TEXT`);
      await addColumnIfMissing("stores", cols, "is_active", `is_active INTEGER DEFAULT 1`);
      await addColumnIfMissing("stores", cols, "last_synced_at", `last_synced_at TEXT`);
      await addColumnIfMissing("stores", cols, "sync_status", `sync_status TEXT`);
      await addColumnIfMissing("stores", cols, "sync_message", `sync_message TEXT`);
      await addColumnIfMissing("stores", cols, "created_at", `created_at TEXT DEFAULT CURRENT_TIMESTAMP`);
      await addColumnIfMissing("stores", cols, "updated_at", `updated_at TEXT DEFAULT CURRENT_TIMESTAMP`);
    }

    // store_addresses
    {
      const cols = await tableInfo("store_addresses");
      await addColumnIfMissing("store_addresses", cols, "is_preferred", `is_preferred INTEGER DEFAULT 0`);
      await addColumnIfMissing("store_addresses", cols, "is_billing", `is_billing INTEGER DEFAULT 0`);
      await addColumnIfMissing("store_addresses", cols, "business", `business TEXT`);
      await addColumnIfMissing("store_addresses", cols, "first_name", `first_name TEXT`);
      await addColumnIfMissing("store_addresses", cols, "last_name", `last_name TEXT`);
      await addColumnIfMissing("store_addresses", cols, "title", `title TEXT`);
      await addColumnIfMissing("store_addresses", cols, "address1", `address1 TEXT`);
      await addColumnIfMissing("store_addresses", cols, "address2", `address2 TEXT`);
      await addColumnIfMissing("store_addresses", cols, "address3", `address3 TEXT`);
      await addColumnIfMissing("store_addresses", cols, "city", `city TEXT`);
      await addColumnIfMissing("store_addresses", cols, "state_province", `state_province TEXT`);
      await addColumnIfMissing("store_addresses", cols, "postal", `postal TEXT`);
      await addColumnIfMissing("store_addresses", cols, "country", `country TEXT`);
      await addColumnIfMissing("store_addresses", cols, "phone", `phone TEXT`);
      await addColumnIfMissing("store_addresses", cols, "fax", `fax TEXT`);
      await addColumnIfMissing("store_addresses", cols, "email", `email TEXT`);
      await addColumnIfMissing("store_addresses", cols, "contact_id", `contact_id TEXT`);
      await addColumnIfMissing("store_addresses", cols, "vat", `vat TEXT`);
      await addColumnIfMissing("store_addresses", cols, "default_ship_method", `default_ship_method TEXT`);
      await addColumnIfMissing("store_addresses", cols, "created_at", `created_at TEXT DEFAULT CURRENT_TIMESTAMP`);
      await addColumnIfMissing("store_addresses", cols, "updated_at", `updated_at TEXT DEFAULT CURRENT_TIMESTAMP`);
    }

    // product_cache
    {
      const cols = await tableInfo("product_cache");
      await addColumnIfMissing("product_cache", cols, "site_id", `site_id TEXT`);
      await addColumnIfMissing("product_cache", cols, "product_is_active", `product_is_active INTEGER DEFAULT 0`);
      await addColumnIfMissing("product_cache", cols, "allowed_groups_json", `allowed_groups_json TEXT`);
      await addColumnIfMissing("product_cache", cols, "q2", `q2 REAL`);
      await addColumnIfMissing("product_cache", cols, "q3", `q3 REAL`);
      await addColumnIfMissing("product_cache", cols, "q4", `q4 REAL`);
      await addColumnIfMissing("product_cache", cols, "workflow_id", `workflow_id TEXT`);
      await addColumnIfMissing("product_cache", cols, "workflow_name", `workflow_name TEXT`);
      await addColumnIfMissing("product_cache", cols, "last_modified", `last_modified TEXT`);
      await addColumnIfMissing("product_cache", cols, "last_sync_status", `last_sync_status TEXT`);
      await addColumnIfMissing("product_cache", cols, "last_sync_message", `last_sync_message TEXT`);
      await addColumnIfMissing("product_cache", cols, "last_synced_at", `last_synced_at TEXT`);
      await addColumnIfMissing("product_cache", cols, "created_at", `created_at TEXT DEFAULT CURRENT_TIMESTAMP`);
      await addColumnIfMissing("product_cache", cols, "updated_at", `updated_at TEXT DEFAULT CURRENT_TIMESTAMP`);
    }

    // excel_imports
    {
      const cols = await tableInfo("excel_imports");
      await addColumnIfMissing("excel_imports", cols, "stored_filename", `stored_filename TEXT`);
      await addColumnIfMissing("excel_imports", cols, "sheet_name", `sheet_name TEXT`);
      await addColumnIfMissing("excel_imports", cols, "imported_by", `imported_by TEXT`);
      await addColumnIfMissing("excel_imports", cols, "imported_at", `imported_at TEXT DEFAULT CURRENT_TIMESTAMP`);
      await addColumnIfMissing("excel_imports", cols, "status", `status TEXT NOT NULL DEFAULT 'UPLOADED'`);
      await addColumnIfMissing("excel_imports", cols, "total_rows", `total_rows INTEGER DEFAULT 0`);
      await addColumnIfMissing("excel_imports", cols, "valid_rows", `valid_rows INTEGER DEFAULT 0`);
      await addColumnIfMissing("excel_imports", cols, "error_rows", `error_rows INTEGER DEFAULT 0`);
      await addColumnIfMissing("excel_imports", cols, "preview_json", `preview_json TEXT`);
      await addColumnIfMissing("excel_imports", cols, "message", `message TEXT`);
    }

    // excel_import_lines
    {
      const cols = await tableInfo("excel_import_lines");
      await addColumnIfMissing("excel_import_lines", cols, "order_group", `order_group TEXT DEFAULT 'A'`);
      await addColumnIfMissing("excel_import_lines", cols, "po_number", `po_number TEXT`);
      await addColumnIfMissing("excel_import_lines", cols, "requested_ship_date", `requested_ship_date TEXT`);
      await addColumnIfMissing("excel_import_lines", cols, "ship_method_name", `ship_method_name TEXT`);
      await addColumnIfMissing("excel_import_lines", cols, "line_no", `line_no INTEGER`);
      await addColumnIfMissing("excel_import_lines", cols, "job_number", `job_number TEXT`);
      await addColumnIfMissing("excel_import_lines", cols, "item_notes", `item_notes TEXT`);
      await addColumnIfMissing("excel_import_lines", cols, "status", `status TEXT DEFAULT 'PENDING'`);
      await addColumnIfMissing("excel_import_lines", cols, "message", `message TEXT`);
    }

    // order_batches
    {
      const cols = await tableInfo("order_batches");
      await addColumnIfMissing("order_batches", cols, "presso_user_id", `presso_user_id TEXT`);
      await addColumnIfMissing("order_batches", cols, "site_id", `site_id TEXT`);
      await addColumnIfMissing("order_batches", cols, "bill_to_address_id", `bill_to_address_id TEXT`);
      await addColumnIfMissing("order_batches", cols, "ship_to_address_id", `ship_to_address_id TEXT`);
      await addColumnIfMissing("order_batches", cols, "po_number", `po_number TEXT`);
      await addColumnIfMissing("order_batches", cols, "requested_ship_date", `requested_ship_date TEXT`);
      await addColumnIfMissing("order_batches", cols, "ship_method_name", `ship_method_name TEXT`);
      await addColumnIfMissing("order_batches", cols, "status", `status TEXT DEFAULT 'READY'`);
      await addColumnIfMissing("order_batches", cols, "total_lines", `total_lines INTEGER DEFAULT 0`);
      await addColumnIfMissing("order_batches", cols, "payload_json", `payload_json TEXT`);
      await addColumnIfMissing("order_batches", cols, "response_json", `response_json TEXT`);
      await addColumnIfMissing("order_batches", cols, "message", `message TEXT`);
      await addColumnIfMissing("order_batches", cols, "created_at", `created_at TEXT DEFAULT CURRENT_TIMESTAMP`);
      await addColumnIfMissing("order_batches", cols, "executed_at", `executed_at TEXT`);
    }

    // order_batch_items
    {
      const cols = await tableInfo("order_batch_items");
      await addColumnIfMissing("order_batch_items", cols, "source_line_id", `source_line_id INTEGER`);
      await addColumnIfMissing("order_batch_items", cols, "component_id", `component_id TEXT`);
      await addColumnIfMissing("order_batch_items", cols, "product_name", `product_name TEXT`);
      await addColumnIfMissing("order_batch_items", cols, "product_id", `product_id TEXT`);
      await addColumnIfMissing("order_batch_items", cols, "q2", `q2 REAL`);
      await addColumnIfMissing("order_batch_items", cols, "q3", `q3 REAL`);
      await addColumnIfMissing("order_batch_items", cols, "q4", `q4 REAL`);
      await addColumnIfMissing("order_batch_items", cols, "price", `price REAL`);
      await addColumnIfMissing("order_batch_items", cols, "tax", `tax REAL`);
      await addColumnIfMissing("order_batch_items", cols, "shipping", `shipping REAL`);
      await addColumnIfMissing("order_batch_items", cols, "weight", `weight REAL`);
      await addColumnIfMissing("order_batch_items", cols, "job_number", `job_number TEXT`);
      await addColumnIfMissing("order_batch_items", cols, "item_notes", `item_notes TEXT`);
      await addColumnIfMissing("order_batch_items", cols, "status", `status TEXT DEFAULT 'READY'`);
      await addColumnIfMissing("order_batch_items", cols, "message", `message TEXT`);
      await addColumnIfMissing("order_batch_items", cols, "created_at", `created_at TEXT DEFAULT CURRENT_TIMESTAMP`);
    }

    console.log("Initialisation / migration SQLite terminée.");
  } catch (err) {
    console.error("Erreur migration SQLite:", err.message);
  }
})();

module.exports = db;