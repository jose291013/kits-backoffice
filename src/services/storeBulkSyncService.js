const db = require("../repositories/db");
const { syncStoreFromPressero } = require("./storeSyncService");

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function syncAllStores() {
  const stores = await dbAll(`
    SELECT store_code, store_name, presso_user_email
    FROM stores
    ORDER BY store_code ASC
  `);

  let ok = 0;
  let failed = 0;
  const results = [];

  for (const store of stores) {
    try {
      const res = await syncStoreFromPressero({
        storeCode: store.store_code,
        storeName: store.store_name,
        pressoUserEmail: store.presso_user_email
      });

      ok++;
      results.push({
        storeCode: store.store_code,
        status: "OK",
        result: res.store
      });
    } catch (error) {
      failed++;
      results.push({
        storeCode: store.store_code,
        status: "FAILED",
        message: error.message
      });
    }
  }

  return {
    success: true,
    total: stores.length,
    ok,
    failed,
    results
  };
}

module.exports = {
  syncAllStores
};