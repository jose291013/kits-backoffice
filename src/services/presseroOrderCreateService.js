const db = require("../repositories/db");
const axios = require("axios");

const ADMIN_BASE_URL = process.env.PRESSERO_BASE_URL;
const PRODUCT_SITE_DOMAIN = process.env.PRESSERO_PRODUCT_SITE_DOMAIN;
const CART_SITE_DOMAIN =
  process.env.PRESSERO_CART_SITE_DOMAIN || process.env.PRESSERO_PRODUCT_SITE_DOMAIN;
const SHIPPING_SITE_DOMAIN = process.env.PRESSERO_SHIPPING_DOMAIN || process.env.PRESSERO_PRODUCT_SITE_DOMAIN;
const rawTaxRate = process.env.DEFAULT_TAX_RATE;
const DEFAULT_TAX_RATE =
  rawTaxRate === undefined || rawTaxRate === null || rawTaxRate === ""
    ? 0.21
    : Number(rawTaxRate);
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
    Authorization: `Token ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json"
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

function parsePriceValue(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;

  const normalized = String(value).replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
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
    `${ADMIN_BASE_URL}/api/cart/${CART_SITE_DOMAIN}/product/${item.product_id}/price?userId=${encodeURIComponent(batch.presso_user_id)}`,
    payload,
    { headers }
  );

  const data = response.data || {};

  const totalPrice =
    parsePriceValue(data.Cost) ||
    parsePriceValue(data.DisplayCost) ||
    parsePriceValue(data.Price) ||
    parsePriceValue(data.TotalPrice) ||
    0;

  return {
    price: totalPrice,
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
      serviceDescription === wantedMethod ||
      serviceName.includes(wantedMethod) ||
      serviceDescription.includes(wantedMethod)
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

  console.log("SHIPPING ESTIMATES =", JSON.stringify(estimates, null, 2));
console.log("SELECTED SHIPPING OBJECT =", JSON.stringify(selected, null, 2));

  return {
    shippingCost: Number(selected?.Estimate?.Cost || 0),
    selectedShipping: selected,
    allEstimates: estimates
  };
}

function extractSelectedShipMethodName(selectedShipping, allEstimates, shipAddress, fallbackValue = null) {
  const batchMethod = String(fallbackValue || "").trim();
  if (batchMethod) {
    return batchMethod;
  }

  const addressMethod = String(shipAddress?.default_ship_method || "").trim();
  if (addressMethod) {
    return addressMethod;
  }

  const serviceDescription = String(selectedShipping?.Estimate?.Service?.Description || "").trim();
  if (serviceDescription) {
    return serviceDescription;
  }

  const serviceName = String(selectedShipping?.Estimate?.Service?.Name || "").trim();
  if (serviceName) {
    return serviceName;
  }

  return null;
}

function normalizePresseroDate(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const s = String(value).trim();

  if (!s) return null;

  // déjà au bon format
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  // cas ISO complet : 2026-04-22T00:00:00.000Z
  const isoPrefix = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoPrefix) {
    return isoPrefix[1];
  }

  // fallback parsing JS
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return null;
}

function buildWorkDataNotes(row) {
  const parts = [];

  if (row?.item?.q1 !== null && row?.item?.q1 !== undefined && row.item.q1 !== "") {
    parts.push(`Quantity=${row.item.q1}`);
  }

  if (row?.item?.q2 !== null && row?.item?.q2 !== undefined && row.item.q2 !== "") {
    parts.push(`Reference=${row.item.q2}`);
  }

  if (row?.item?.q3 !== null && row?.item?.q3 !== undefined && row.item.q3 !== "") {
    parts.push(`Height=${row.item.q3}`);
  }

  if (row?.item?.q4 !== null && row?.item?.q4 !== undefined && row.item.q4 !== "") {
    parts.push(`Width=${row.item.q4}`);
  }

  return parts.join(" | ");
}

function mergeItemNotes(existingNotes, workDataNotes) {
  const base = String(existingNotes || "").trim();
  const extra = String(workDataNotes || "").trim();

  if (base && extra) return `${base} | ${extra}`;
  return base || extra || null;
}

async function hydrateBatchFinancials(batchId) {
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
    throw new Error(`Batch incomplet: presso_user_id ou site_id manquant pour ${batchId}`);
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

  for (const item of batchItems) {
    if (!item.product_id) {
      throw new Error(`Item ${item.id} sans product_id`);
    }

    const pricing = await priceBatchItem(batch, item);

    await dbRun(
  `
  UPDATE order_batch_items
  SET message = ?
  WHERE id = ?
  `,
  [
    JSON.stringify({
      batchId: batch.id,
      productId: item.product_id,
      productName: item.product_name,
      q1: item.q1,
      q2: item.q2,
      q3: item.q3,
      q4: item.q4,
      parsedPrice: pricing.price,
      response: pricing.pricingResponse || null
    }).slice(0, 1500),
    item.id
  ]
);

    const linePrice = Number(pricing.price || 0);
    const lineWeight = Number(pricing.weight || 0);

    totalWeight += lineWeight;

    pricedItems.push({
      item,
      price: linePrice,
      weight: lineWeight
    });
  }

  const shippingEstimation = await estimateShippingCost(batch, shipAddress, totalWeight);
const totalShipping = Number(shippingEstimation.shippingCost || 0);

const selectedShipMethodName = extractSelectedShipMethodName(
  shippingEstimation.selectedShipping,
  shippingEstimation.allEstimates,
  shipAddress,
  batch.ship_method_name || null
);
console.log("SHIP ADDRESS DEFAULT METHOD =", shipAddress?.default_ship_method || null);

if (!selectedShipMethodName) {
  throw new Error("Aucune méthode de livraison valide n'a pu être déterminée");
}

if (!batch.ship_method_name && selectedShipMethodName) {
  await dbRun(
    `
    UPDATE order_batches
    SET ship_method_name = ?
    WHERE id = ?
    `,
    [selectedShipMethodName, batchId]
  );

  batch.ship_method_name = selectedShipMethodName;
}

  const totalWeightForSplit =
    pricedItems.reduce((sum, x) => sum + Number(x.weight || 0), 0) || 1;

  const enrichedItems = pricedItems.map((x, index) => {
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
    const lineTotalTtc = Number((x.price + lineShipping + lineTax).toFixed(2));

    return {
      item: x.item,
      price: x.price,
      weight: x.weight,
      shipping: lineShipping,
      tax: lineTax,
      totalTtc: lineTotalTtc
    };
  });

  for (const row of enrichedItems) {
    await dbRun(
      `
      UPDATE order_batch_items
      SET price = ?, weight = ?, tax = ?, shipping = ?, message = ?
      WHERE id = ?
      `,
      [
        row.price,
        row.weight,
        row.tax,
        row.shipping,
        null,
        row.item.id
      ]
    );
  }

  const totals = enrichedItems.reduce(
    (acc, row) => {
      acc.totalHt += Number(row.price || 0);
      acc.totalShipping += Number(row.shipping || 0);
      acc.totalTax += Number(row.tax || 0);
      acc.totalTtc += Number(row.totalTtc || 0);
      return acc;
    },
    {
      totalHt: 0,
      totalShipping: 0,
      totalTax: 0,
      totalTtc: 0
    }
  );

  await dbRun(
  `
  UPDATE order_batches
  SET
    total_ht = ?,
    total_shipping = ?,
    total_tax = ?,
    total_ttc = ?
  WHERE id = ?
  `,
  [
    Number(totals.totalHt.toFixed(2)),
    Number(totals.totalShipping.toFixed(2)),
    Number(totals.totalTax.toFixed(2)),
    Number(totals.totalTtc.toFixed(2)),
    batchId
  ]
);

  return {
  batch,
  store,
  billAddress,
  shipAddress,
  selectedShipMethodName,
  items: enrichedItems,
  totals: {
    totalHt: Number(totals.totalHt.toFixed(2)),
    totalShipping: Number(totals.totalShipping.toFixed(2)),
    totalTax: Number(totals.totalTax.toFixed(2)),
    totalTtc: Number(totals.totalTtc.toFixed(2))
  }
};
}

function buildOrderItemsForCreate(
  batchId,
  enrichedItems,
  shipAddress,
  selectedShipMethodName,
  batchRequestedShipDate
) {
  return enrichedItems.map((row) => ({
    productId: row.item.product_id,
    jobNumber: row.item.job_number || `BATCH-${batchId}-ITEM-${row.item.id}`,
    projectedShipDate: batchRequestedShipDate || null,
    quantity: Number(row.item.q1 || 0),
    price: row.price,
    tax: row.tax,
    discount: 0,
    shipping: row.shipping,
    weight: row.weight,
    itemNotes: mergeItemNotes(
  row.item.item_notes,
  buildWorkDataNotes(row)
),
    shipMethodName: selectedShipMethodName || null,
    ...buildShipToFields(shipAddress),
    edocSessionId: null
  }));
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
    const hydrated = await hydrateBatchFinancials(batchId);
    const { batch, billAddress, shipAddress, selectedShipMethodName, items: enrichedItems } = hydrated;
    const normalizedRequestedShipDate = normalizePresseroDate(batch.requested_ship_date);

    if (batch.presso_order_number || batch.presso_order_id || String(batch.status || "").toUpperCase() === "SENT") {
      throw new Error(`Le batch ${batchId} a déjà été envoyé à Pressero`);
    }

    const orderItems = buildOrderItemsForCreate(
  batchId,
  enrichedItems,
  shipAddress,
  selectedShipMethodName,
  normalizedRequestedShipDate
);

console.log("SELECTED SHIP METHOD NAME =", selectedShipMethodName);
console.log("ORDER ITEMS WITH SHIPPING =", JSON.stringify(
  orderItems.map((x) => ({
    productId: x.productId,
    quantity: x.quantity,
    shipMethodName: x.shipMethodName,
    price: x.price,
    tax: x.tax,
    shipping: x.shipping
  })),
  null,
  2
));

    const payload = {
      siteId: batch.site_id,
      userId: batch.presso_user_id,
      notes: `Import Excel - batch ${batchId}`,
      isPaid: false,
      requestedShipDate: normalizedRequestedShipDate,
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
    console.error("SUBMIT BATCH ERROR STATUS =", error.response?.status);
console.error("SUBMIT BATCH ERROR DATA =", JSON.stringify(error.response?.data || null, null, 2));
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
  submitBatchToPressero,
  hydrateBatchFinancials
};