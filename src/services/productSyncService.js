const db = require("../repositories/db");
const axios = require("axios");

const ADMIN_BASE_URL = process.env.PRESSERO_BASE_URL;
const PRESSERO_DOMAIN = process.env.PRESSERO_PRODUCT_SITE_DOMAIN;

const PRESSERO_USERNAME = process.env.PRESSERO_USERNAME;
const PRESSERO_PASSWORD = process.env.PRESSERO_PASSWORD;
const PRESSERO_SUBSCRIBER_ID = process.env.PRESSERO_SUBSCRIBER_ID;
const PRESSERO_CONSUMER_ID = process.env.PRESSERO_CONSUMER_ID;

// ===== TOKEN =====
let cachedToken = null;
let cachedTokenAt = null;

async function getAccessToken() {
  const now = Date.now();

  if (cachedToken && cachedTokenAt && (now - cachedTokenAt < 50 * 60 * 1000)) {
    return cachedToken;
  }

  const response = await axios.post(
    `${ADMIN_BASE_URL}/api/V2/Authentication`,
    {
      UserName: PRESSERO_USERNAME,
      Password: PRESSERO_PASSWORD,
      SubscriberId: PRESSERO_SUBSCRIBER_ID,
      ConsumerID: PRESSERO_CONSUMER_ID
    },
    {
      headers: { "Content-Type": "application/json" }
    }
  );

  const token = response.data.Token;

  cachedToken = token;
  cachedTokenAt = now;

  return token;
}

async function getHeaders() {
  const token = await getAccessToken();

  return {
    Authorization: `token ${token}`,
    "Content-Type": "application/json"
  };
}

// ===== DB HELPERS =====
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

// ===== MAIN =====

async function findProductByName(productName) {
  const headers = await getHeaders();

  const response = await axios.post(
    `${ADMIN_BASE_URL}/api/site/${PRESSERO_DOMAIN}/products/?pageNumber=0&pageSize=1&includeDeleted=true`,
    [
      {
        Column: "productName",
        Operator: "contains",
        Value: productName
      }
    ],
    { headers }
  );

  const items = response.data?.Items || [];

  if (!items.length) {
    throw new Error(`Produit introuvable pour ${productName}`);
  }

  return items[0];
}

async function getProductDetails(productId) {
  const headers = await getHeaders();

  const response = await axios.get(
    `${ADMIN_BASE_URL}/api/site/${PRESSERO_DOMAIN}/Products/${productId}`,
    { headers }
  );

  return response.data;
}

async function syncProductByComponentId(componentId) {
  // 1. récupérer le composant
  const component = await dbGet(
    `SELECT * FROM kit_components WHERE component_id = ?`,
    [componentId]
  );

  if (!component) {
    throw new Error(`Component introuvable: ${componentId}`);
  }

  const productName = component.product_name;

  // 2. trouver le produit
  const product = await findProductByName(productName);

  const productId = product.ProductId;

  // 3. récupérer les détails
  const details = await getProductDetails(productId);

  const q2 = details.MinQty2 || null;
  const q3 = details.MinQty3 || null;
  const q4 = details.MinQty4 || null;

  // 4. sauvegarder
  await dbRun(
    `
    UPDATE kit_components
    SET
      product_id = ?,
      product_is_active = ?,
      q2_standard_quotation = ?,
      q3_height = ?,
      q4_width = ?,
      last_sync_status = 'OK',
      last_sync_message = NULL,
      last_synced_at = CURRENT_TIMESTAMP
    WHERE component_id = ?
    `,
    [
      productId,
      details.IsActive ? 1 : 0,
      q2,
      q3,
      q4,
      componentId
    ]
  );

  return {
    success: true,
    componentId,
    productId,
    q2,
    q3,
    q4
  };
}

module.exports = {
  syncProductByComponentId
};