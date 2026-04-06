const db = require("../repositories/db");
const axios = require("axios");

const ADMIN_BASE_URL = process.env.PRESSERO_BASE_URL;
const PRESSERO_DOMAIN = process.env.PRESSERO_PRODUCT_SITE_DOMAIN;

const PRESSERO_USERNAME = process.env.PRESSERO_USERNAME;
const PRESSERO_PASSWORD = process.env.PRESSERO_PASSWORD;
const PRESSERO_SUBSCRIBER_ID = process.env.PRESSERO_SUBSCRIBER_ID;
const PRESSERO_CONSUMER_ID = process.env.PRESSERO_CONSUMER_ID;

console.log("ADMIN_BASE_URL =", ADMIN_BASE_URL);
console.log("PRESSERO_DOMAIN =", PRESSERO_DOMAIN);
console.log("PRESSERO_USERNAME exists =", !!PRESSERO_USERNAME);
console.log("PRESSERO_PASSWORD exists =", !!PRESSERO_PASSWORD);
console.log("PRESSERO_SUBSCRIBER_ID exists =", !!PRESSERO_SUBSCRIBER_ID);
console.log("PRESSERO_CONSUMER_ID exists =", !!PRESSERO_CONSUMER_ID);


let cachedToken = null;
let cachedTokenAt = null;

async function getAccessToken() {
  const now = Date.now();

  if (cachedToken && cachedTokenAt && (now - cachedTokenAt < 50 * 60 * 1000)) {
    return cachedToken;
  }

  const url = `${ADMIN_BASE_URL}/api/V2/Authentication`;

  const response = await axios.post(
    url,
    {
      UserName: PRESSERO_USERNAME,
      Password: PRESSERO_PASSWORD,
      SubscriberId: PRESSERO_SUBSCRIBER_ID,
      ConsumerID: PRESSERO_CONSUMER_ID
    },
    {
      headers: {
        "Content-Type": "application/json"
      }
    }
  );

  const data = response.data || {};

  const token =
    data.Token ||
    data.token ||
    data.AccessToken ||
    data.accessToken ||
    data.Jwt ||
    data.jwt ||
    data.AuthorizationToken ||
    data.authorizationToken;

  if (!token) {
    throw new Error("Token Pressero introuvable dans la réponse d'authentification");
  }

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

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
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

async function getUserIdByEmail(email) {
  const headers = await getHeaders();

  const url =
    `${ADMIN_BASE_URL}/api/site/${PRESSERO_DOMAIN}/users/` +
    `?pageNumber=0&pageSize=1&email=${encodeURIComponent(email)}&includeDeleted=false`;

  const response = await axios.get(url, { headers });

  const data = response.data || {};
  const items = data.Items || data.items || [];

  if (!items.length) {
    throw new Error(`Aucun utilisateur trouvé pour l'email ${email}`);
  }

  const user = items[0];
  return user.UserId || user.userId || user.Id || user.id;
}

async function getUserInfo(userId) {
  const headers = await getHeaders();
  const url = `${ADMIN_BASE_URL}/api/V2/users/${userId}/Info`;

  const response = await axios.get(url, { headers });
  return response.data;
}

async function upsertStore({
  storeCode,
  storeName,
  pressoUserEmail,
  userInfo
}) {
  const preferredAddress =
    userInfo?.UserSite?.AddressBook?.PreferredAddress || null;

  const addresses =
    userInfo?.UserSite?.AddressBook?.Addresses || [];

  let billingAddress = null;

  if (preferredAddress) {
    billingAddress =
      addresses.find((a) => a.AddressId !== preferredAddress.AddressId) || null;
  } else {
    billingAddress = addresses[0] || null;
  }

  const existingStore = await dbGet(
    `SELECT * FROM stores WHERE store_code = ?`,
    [storeCode]
  );

  const storePayload = {
    store_code: storeCode,
    store_name: storeName || null,
    presso_user_email: pressoUserEmail,
    presso_user_id: userInfo?.UserID || null,
    site_id: userInfo?.SiteId || userInfo?.UserSite?.SiteId || null,
    address_book_id: userInfo?.UserSite?.AddressBook?.AddressBookId || null,
    preferred_address_id: preferredAddress?.AddressId || null,
    billing_address_id: billingAddress?.AddressId || null,
    user_type: userInfo?.UserType || null,
    first_name: userInfo?.FirstName || null,
    last_name: userInfo?.LastName || null,
    login: userInfo?.Login || null,
    is_active: userInfo?.IsActive ? 1 : 0,
    last_synced_at: new Date().toISOString(),
    sync_status: "OK",
    sync_message: null
  };

  let storeId;

  if (existingStore) {
    await dbRun(
      `
      UPDATE stores
      SET
        store_name = ?,
        presso_user_email = ?,
        presso_user_id = ?,
        site_id = ?,
        address_book_id = ?,
        preferred_address_id = ?,
        billing_address_id = ?,
        user_type = ?,
        first_name = ?,
        last_name = ?,
        login = ?,
        is_active = ?,
        last_synced_at = ?,
        sync_status = ?,
        sync_message = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE store_code = ?
      `,
      [
        storePayload.store_name,
        storePayload.presso_user_email,
        storePayload.presso_user_id,
        storePayload.site_id,
        storePayload.address_book_id,
        storePayload.preferred_address_id,
        storePayload.billing_address_id,
        storePayload.user_type,
        storePayload.first_name,
        storePayload.last_name,
        storePayload.login,
        storePayload.is_active,
        storePayload.last_synced_at,
        storePayload.sync_status,
        storePayload.sync_message,
        storePayload.store_code
      ]
    );

    storeId = existingStore.id;
  } else {
    const result = await dbRun(
      `
      INSERT INTO stores (
        store_code,
        store_name,
        presso_user_email,
        presso_user_id,
        site_id,
        address_book_id,
        preferred_address_id,
        billing_address_id,
        user_type,
        first_name,
        last_name,
        login,
        is_active,
        last_synced_at,
        sync_status,
        sync_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        storePayload.store_code,
        storePayload.store_name,
        storePayload.presso_user_email,
        storePayload.presso_user_id,
        storePayload.site_id,
        storePayload.address_book_id,
        storePayload.preferred_address_id,
        storePayload.billing_address_id,
        storePayload.user_type,
        storePayload.first_name,
        storePayload.last_name,
        storePayload.login,
        storePayload.is_active,
        storePayload.last_synced_at,
        storePayload.sync_status,
        storePayload.sync_message
      ]
    );

    storeId = result.lastID;
  }

  return {
    storeId,
    preferredAddress,
    billingAddress,
    addresses
  };
}

async function replaceStoreAddresses(storeId, preferredAddress, billingAddress, addresses) {
  await dbRun(`DELETE FROM store_addresses WHERE store_id = ?`, [storeId]);

  for (const address of addresses) {
    const isPreferred =
      preferredAddress && address.AddressId === preferredAddress.AddressId ? 1 : 0;

    const isBilling =
      billingAddress && address.AddressId === billingAddress.AddressId ? 1 : 0;

    await dbRun(
      `
      INSERT INTO store_addresses (
        store_id,
        address_id,
        is_preferred,
        is_billing,
        business,
        first_name,
        last_name,
        title,
        address1,
        address2,
        address3,
        city,
        state_province,
        postal,
        country,
        phone,
        fax,
        email,
        contact_id,
        vat,
        default_ship_method
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        storeId,
        address.AddressId || null,
        isPreferred,
        isBilling,
        address.Business || null,
        address.FirstName || null,
        address.LastName || null,
        address.Title || null,
        address.Address1 || null,
        address.Address2 || null,
        address.Address3 || null,
        address.City || null,
        address.StateProvince || null,
        address.Postal || null,
        address.Country || null,
        address.Phone || null,
        address.Fax || null,
        address.Email || null,
        address.ContactId || null,
        address.Vat || null,
        address.DefaultShipMethod || null
      ]
    );
  }
}

async function logSync(syncType, targetKey, status, message, payloadJson, responseJson) {
  await dbRun(
    `
    INSERT INTO sync_logs (
      sync_type,
      target_key,
      status,
      message,
      payload_json,
      response_json
    ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      syncType,
      targetKey || null,
      status,
      message || null,
      payloadJson ? JSON.stringify(payloadJson) : null,
      responseJson ? JSON.stringify(responseJson) : null
    ]
  );
}

async function syncStoreFromPressero({ storeCode, storeName, pressoUserEmail }) {
  try {
    const userId = await getUserIdByEmail(pressoUserEmail);
    const userInfo = await getUserInfo(userId);

    const { storeId, preferredAddress, billingAddress, addresses } =
      await upsertStore({
        storeCode,
        storeName,
        pressoUserEmail,
        userInfo
      });

    await replaceStoreAddresses(storeId, preferredAddress, billingAddress, addresses);

    await logSync(
      "ADDRESSBOOK",
      storeCode,
      "OK",
      `Synchronisation OK pour ${storeCode}`,
      { storeCode, storeName, pressoUserEmail },
      { userId, addressCount: addresses.length }
    );

    const savedStore = await dbGet(`SELECT * FROM stores WHERE id = ?`, [storeId]);
    const savedAddresses = await dbAll(
      `SELECT * FROM store_addresses WHERE store_id = ? ORDER BY is_preferred DESC, is_billing DESC, id ASC`,
      [storeId]
    );

    return {
      success: true,
      store: savedStore,
      addresses: savedAddresses
    };
  } catch (error) {
    await logSync(
      "ADDRESSBOOK",
      storeCode,
      "ERROR",
      error.message,
      { storeCode, storeName, pressoUserEmail },
      null
    );

    throw error;
  }
}

module.exports = {
  syncStoreFromPressero
};