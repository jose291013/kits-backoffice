const db = require("../repositories/db");
const axios = require("axios");

const ADMIN_BASE_URL = process.env.PRESSERO_BASE_URL;
const PRODUCT_SITE_DOMAIN = process.env.PRESSERO_PRODUCT_SITE_DOMAIN;
const SHIPPING_SITE_DOMAIN = process.env.PRESSERO_SHIPPING_DOMAIN || process.env.PRESSERO_PRODUCT_SITE_DOMAIN;
const DEFAULT_TAX_RATE = Number(process.env.DEFAULT_TAX_RATE || 0);
const PRESSERO_USERNAME = process.env.PRESSERO_USERNAME;
const PRESSERO_PASSWORD = process.env.PRESSERO_PASSWORD;
const PRESSERO_SUBSCRIBER_ID = process.env.PRESSERO_SUBSCRIBER_ID;
const PRESSERO_CONSUMER_ID = process.env.PRESSERO_CONSUMER_ID;

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
    throw new Error("Token Pressero introuvable");
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
      resolve(rows || []);
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

async function getAddressById(storeId, addressId) {
  return dbGet(
    `
    SELECT *
    FROM store_addresses
    WHERE store_id = ? AND address_id = ?
    `,
    [storeId, addressId]
  );
}

async function priceBatchItem(batch, item) {
  const headers = await getHeaders();

  const payload = {
    Quantities: [
      Number(item.q1 || 0),
      Number(item.q2 || 0),
      Number(item.q3 || 0),
      Number(item.q4 || 0)
    ],
    Options: []
  };

  const response = await axios.post(
    `${ADMIN_BASE_URL}/api/cart/${PRODUCT_SITE_DOMAIN}/product/${item.product_id}/price?userId=${batch.presso_user_id}`,
    payload,
    { headers }
  );

  const data = response.data || {};

  return {
    price: Number(data.Cost || 0),
    weight: Number(data.Weight || 0),
    pricingResponse: data
  };
}

function buildBillToFields(address) {
  return {
    billToAddressId: address?.address_id || null,
    billToTitle: address?.title || null,
    billToBusinessName: address?.business || null,
    billToFirstName: address?.first_name || null,
    billToLastName: address?.last_name || null,
    billToAddress1: address?.address1 || null,
    billToAddress2: address?.address2 || null,
    billToAddress3: address?.address3 || null,
    billToCity: address?.city || null,
    billToState: address?.state_province || null,
    billToPostal: address?.postal || null,
    billToCountry: address?.country || null,
    billToPhone: address?.phone || null,
    billToFax: address?.fax || null,
    billToEmail: address?.email || null
  };
}

function buildShipToFields(address) {
  return {
    shipToAddressId: address?.address_id || null,
    shipToTitle: address?.title || null,
    shipToBusinessName: address?.business || null,
    shipToFirstName: address?.first_name || null,
    shipToLastName: address?.last_name || null,
    shipToAddress1: address?.address1 || null,
    shipToAddress2: address?.address2 || null,
    shipToAddress3: address?.address3 || null,
    shipToCity: address?.city || null,
    shipToState: address?.state_province || null,
    shipToPostal: address?.postal || null,
    shipToCountry: address?.country || null,
    shipToPhone: address?.phone || null,
    shipToFax: address?.fax || null,
    shipToEmail: address?.email || null
  };
}

async function estimateShippingCost(batch, shipAddress, totalWeight) {
  const headers = await getHeaders();

  const payload = {
    Weight: Number(totalWeight || 0),
    Country: shipAddress?.country || "",
    StateProvince: shipAddress?.state_province || "",
    City: shipAddress?.city || "",
    PostalCode: shipAddress?.postal || "",
    District: ""
  };

  const response = await axios.post(
    `${ADMIN_BASE_URL}/api/V2/SiteShipping/${SHIPPING_SITE_DOMAIN}/Estimate`,
    payload,
    { headers }
  );

  const estimates = Array.isArray(response.data) ? response.data : [];

  const shippable = estimates.filter(
    (x) => x?.Estimate?.CanShip === true
  );

  if (!shippable.length) {
    throw new Error("Aucune méthode de livraison valide retournée par SiteShipping/Estimate");
  }

  let selected = null;
  const wantedMethod = String(batch.ship_method_name || "").trim().toLowerCase();

  if (wantedMethod) {
    selected = shippable.find((x) => {
      const serviceName = String(x?.Estimate?.Service?.Name || "").trim().toLowerCase();
      const serviceDescription = String(x?.Estimate?.Service?.Description || "").trim().toLowerCase();

      return (
        serviceName === wantedMethod ||
        serviceDescription === wantedMethod
      );
    });
  }

  if (!selected) {
    selected = shippable.reduce((min, current) => {
      const currentCost = Number(current?.Estimate?.Cost || 0);
      const minCost = Number(min?.Estimate?.Cost || 0);
      return currentCost < minCost ? current : min;
    });
  }

  return {
    shippingCost: Number(selected?.Estimate?.Cost || 0),
    selectedShipping: selected,
    allEstimates: estimates
  };
}

async function submitBatchToPressero(batchId) {
  await dbRun(
    `
    UPDATE order_batches
    SET status = ?, message = ?
    WHERE id = ?
    `,
    ["PROCESSING", null, batchId]
  );

  try {
    const batch = await dbGet(
      `
      SELECT *
      FROM order_batches
      WHERE id = ?
      `,
      [batchId]
    );

    if (!batch) {
      throw new Error(`Batch introuvable: ${batchId}`);
    }

    if (!batch.presso_user_id || !batch.site_id) {
      throw new Error("Batch incomplet: presso_user_id ou site_id manquant");
    }

    const store = await dbGet(
      `
      SELECT *
      FROM stores
      WHERE store_code = ?
      `,
      [batch.store_code]
    );

    if (!store) {
      throw new Error(`Store introuvable pour batch ${batchId}`);
    }

    const batchItems = await dbAll(
      `
      SELECT *
      FROM order_batch_items
      WHERE batch_id = ?
        AND status = 'READY'
      ORDER BY id ASC
      `,
      [batchId]
    );

    if (!batchItems.length) {
      throw new Error(`Aucun item READY dans le batch ${batchId}`);
    }

    const billAddress = await getAddressById(store.id, batch.bill_to_address_id);
    const shipAddress = await getAddressById(store.id, batch.ship_to_address_id);

    if (!billAddress) {
      throw new Error(`Adresse de facturation introuvable pour batch ${batchId}`);
    }

    if (!shipAddress) {
      throw new Error(`Adresse de livraison introuvable pour batch ${batchId}`);
    }

    const pricedItems = [];
    let totalWeight = 0;

    // 1) pricing + poids uniquement
    for (const item of batchItems) {
      if (!item.product_id) {
        throw new Error(`Item ${item.id} sans product_id`);
      }

      const pricing = await priceBatchItem(batch, item);

      const linePrice = Number(pricing.price || 0);
      const lineWeight = Number(pricing.weight || 0);

      totalWeight += lineWeight;

      pricedItems.push({
        item,
        price: linePrice,
        weight: lineWeight
      });
    }

    // 2) estimation du shipping du batch
    const shippingEstimation = await estimateShippingCost(batch, shipAddress, totalWeight);
    const totalShipping = Number(shippingEstimation.shippingCost || 0);

    // 3) répartition du shipping au prorata du poids + calcul TVA
    const totalWeightForSplit =
      pricedItems.reduce((sum, x) => sum + Number(x.weight || 0), 0) || 1;

    const orderItems = pricedItems.map((x, index) => {
      let lineShipping = 0;

      if (index === pricedItems.length - 1) {
        const alreadyAllocated = pricedItems
          .slice(0, index)
          .reduce((sum, prev, prevIndex) => {
            const prevShipping = Number(
              (
                totalShipping *
                (Number(pricedItems[prevIndex].weight || 0) / totalWeightForSplit)
              ).toFixed(2)
            );
            return sum + prevShipping;
          }, 0);

        lineShipping = Number((totalShipping - alreadyAllocated).toFixed(2));
      } else {
        lineShipping = Number(
          (
            totalShipping *
            (Number(x.weight || 0) / totalWeightForSplit)
          ).toFixed(2)
        );
      }

      const lineTax = Number(((x.price + lineShipping) * DEFAULT_TAX_RATE).toFixed(2));

      return {
        productId: x.item.product_id,
        jobNumber: x.item.job_number || `BATCH-${batchId}-ITEM-${x.item.id}`,
        projectedShipDate: batch.requested_ship_date || null,
        quantity: Number(x.item.q1 || 0),
        price: x.price,
        tax: lineTax,
        discount: 0,
        shipping: lineShipping,
        weight: x.weight,
        itemNotes: x.item.item_notes || null,
        shipMethodName: batch.ship_method_name || null,
        ...buildShipToFields(shipAddress),
        edocSessionId: null
      };
    });

    // 4) mise à jour DB avec les vraies valeurs finales
    for (let i = 0; i < pricedItems.length; i++) {
      const x = pricedItems[i];
      const orderItem = orderItems[i];

      await dbRun(
        `
        UPDATE order_batch_items
        SET price = ?, weight = ?, tax = ?, shipping = ?, message = ?
        WHERE id = ?
        `,
        [
          orderItem.price,
          orderItem.weight,
          orderItem.tax,
          orderItem.shipping,
          null,
          x.item.id
        ]
      );
    }

    const payload = {
      siteId: batch.site_id,
      userId: batch.presso_user_id,
      notes: `Import Excel - batch ${batchId}`,
      isPaid: false,
      requestedShipDate: batch.requested_ship_date || null,
      poNumber: batch.po_number || null,
      ...buildBillToFields(billAddress),
      paymentMethod: process.env.PRESSERO_PAYMENT_METHOD || null,
      budgetId: null,
      processingOptions: {
  needToApplyApprovals: Number(batch.need_to_apply_approvals) === 1,
  needToGenerateNotifications: true
},
      items: orderItems
    };

    const headers = await getHeaders();

    const response = await axios.post(
      `${ADMIN_BASE_URL}/api/v2/Orders/Create`,
      payload,
      { headers }
    );

    const responseData = response.data || {};
    const pressoOrderId = responseData.OrderId || null;
    const pressoOrderNumber = responseData.OrderNumber || null;
    const pressoOrderDate = responseData.OrderDate || null;

    await dbRun(
  `
  UPDATE order_batches
  SET
    payload_json = ?,
    response_json = ?,
    status = ?,
    executed_at = CURRENT_TIMESTAMP,
    message = ?,
    presso_order_id = ?,
    presso_order_number = ?,
    presso_order_date = ?
  WHERE id = ?
  `,
  [
    JSON.stringify(payload),
    JSON.stringify(responseData),
    "SENT",
    null,
    pressoOrderId,
    pressoOrderNumber,
    pressoOrderDate,
    batchId
  ]
);

    return {
  success: true,
  batchId,
  payload,
  response: responseData,
  pressoOrderId,
  pressoOrderNumber,
  pressoOrderDate
};
  } catch (error) {
    await dbRun(
      `
      UPDATE order_batches
      SET
        status = ?,
        message = ?,
        response_json = ?,
        executed_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        "FAILED",
        error.message,
        JSON.stringify(error.response?.data || null),
        batchId
      ]
    );

    throw error;
  }
}

module.exports = {
  submitBatchToPressero
};