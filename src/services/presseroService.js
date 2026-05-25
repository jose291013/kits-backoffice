const axios = require("axios");
const env = require("../config/env");

let cachedToken = null;
let cachedTokenAt = 0;
const TOKEN_TTL_MS = 10 * 60 * 1000;

const userGroupsCache = new Map();
const USER_CACHE_TTL_MS = 5 * 60 * 1000;

const PRODUCT_LOOKUP_DEBUG_ENABLED = ["1", "true", "yes", "on"].includes(
  String(process.env.DEBUG_PRESSERO_PRODUCT_LOOKUP || "").trim().toLowerCase()
);

let productLookupCounter = 0;

function buildAxiosErrorMessage(step, err) {
  const status = err?.response?.status;
  const data = err?.response?.data;

  let details = "";
  try {
    details = data ? ` | response=${JSON.stringify(data)}` : "";
  } catch {
    details = "";
  }

  return `[${step}] ${err.message}${status ? ` | status=${status}` : ""}${details}`;
}

function getTokenHeaders(token) {
  return {
    Authorization: `Token ${token}`,
    "Content-Type": "application/json",
    "Accept-Language": "en-US",
    Accept: "application/json"
  };
}

function getRawTokenHeaders(token) {
  return {
    Authorization: token,
    "Content-Type": "application/json",
    "Accept-Language": "en-US",
    Accept: "application/json"
  };
}

function normalizeName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeProductLookupValue(value) {
  return String(value || "")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getProductSearchValue(productName) {
  return String(productName || "").trim();
}

function getLookupContext(context = {}) {
  return {
    partId: context.partId || context.part_id || null,
    componentId: context.componentId || context.component_id || context.productName || null,
    productName: context.productName || context.product_name || null,
    langCode: context.langCode || context.lang_code || null,
    pressersoIdNumber: context.pressersoIdNumber || context.presserso_id_number || null,
    kitComponentDbId: context.kitComponentDbId || context.id || null
  };
}

function buildProductCandidates(items = []) {
  return items.slice(0, 20).map((item, index) => ({
    index,
    productId: item.ProductId || null,
    productName: item.ProductName || null,
    normalizedProductName: normalizeProductLookupValue(item.ProductName),
    isActive: item.IsActive ?? null
  }));
}

function shouldLogProductLookup(reason) {
  if (PRODUCT_LOOKUP_DEBUG_ENABLED) return true;

  return [
    "NOT_FOUND",
    "NO_EXACT_MATCH",
    "ERROR",
    "PRODUCT_FOUND_WITHOUT_ID",
    "PRODUCT_DETAILS_ERROR"
  ].includes(reason);
}

function logProductLookup(reason, payload = {}) {
  if (!shouldLogProductLookup(reason)) return;

  const safePayload = {
    reason,
    at: new Date().toISOString(),
    presseroBaseUrl: env.presseroBaseUrl || null,
    presseroProductSiteDomain: env.presseroProductSiteDomain || null,
    ...payload
  };

  console.log(`[PRESSERO PRODUCT LOOKUP][${reason}] ${JSON.stringify(safePayload, null, 2)}`);
}

async function authenticate() {
  const now = Date.now();

  if (cachedToken && (now - cachedTokenAt) < TOKEN_TTL_MS) {
    return cachedToken;
  }

  const url = `${env.presseroBaseUrl}/api/V2/Authentication`;

  console.log("AUTH URL:", url);

  const response = await axios.post(
    url,
    {
      Username: env.presseroUsername,
      Password: env.presseroPassword,
      SubscriberId: env.presseroSubscriberId,
      ConsumerId: env.presseroConsumerId
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Accept-Language": "en-US",
        Accept: "application/json"
      }
    }
  );

  cachedToken = response.data?.Token || null;
  cachedTokenAt = now;

  if (!cachedToken) {
    throw new Error("Token Pressero introuvable");
  }

  return cachedToken;
}

async function postWithAuthRetry(url, body) {
  const token = await authenticate();

  try {
    return await axios.post(url, body, {
      headers: getTokenHeaders(token)
    });
  } catch (err) {
    if (err?.response?.status !== 401) {
      throw err;
    }

    return axios.post(url, body, {
      headers: getRawTokenHeaders(token)
    });
  }
}

async function getWithAuthRetry(url) {
  const token = await authenticate();

  try {
    return await axios.get(url, {
      headers: getTokenHeaders(token)
    });
  } catch (err) {
    if (err?.response?.status !== 401) {
      throw err;
    }

    return axios.get(url, {
      headers: getRawTokenHeaders(token)
    });
  }
}

async function findProductByName(productName, context = {}) {
  const lookupId = ++productLookupCounter;
  const lookupContext = getLookupContext({ ...context, productName });

  try {
    const url = `${env.presseroBaseUrl}/api/site/${env.presseroProductSiteDomain}/products/?pageNumber=0&pageSize=20&includeDeleted=True`;
    const searchValue = getProductSearchValue(productName);
    const target = normalizeProductLookupValue(productName);

    const body = [
      {
        Column: "productName",
        Value: searchValue,
        Operator: "contains"
      }
    ];

    logProductLookup("REQUEST", {
      lookupId,
      lookupContext,
      url,
      searchBody: body,
      searchValue,
      normalizedTarget: target
    });

    const response = await postWithAuthRetry(url, body);
    const items = response.data?.Items || [];

    if (!Array.isArray(items) || items.length === 0) {
      logProductLookup("NOT_FOUND", {
        lookupId,
        lookupContext,
        url,
        searchBody: body,
        searchValue,
        normalizedTarget: target,
        responseStatus: response.status,
        responseKeys: response.data ? Object.keys(response.data) : [],
        totalItemsReturned: Array.isArray(items) ? items.length : null
      });

      return null;
    }

    const exact = items.find(item => {
      return normalizeProductLookupValue(item.ProductName) === target;
    });

    if (exact) {
      logProductLookup("EXACT_MATCH", {
        lookupId,
        lookupContext,
        searchValue,
        normalizedTarget: target,
        itemsReturned: items.length,
        selectedProductId: exact.ProductId || null,
        selectedProductName: exact.ProductName || null
      });

      return exact;
    }

    logProductLookup("NO_EXACT_MATCH", {
      lookupId,
      lookupContext,
      searchValue,
      normalizedTarget: target,
      itemsReturned: items.length,
      selectedFallbackProductId: items[0]?.ProductId || null,
      selectedFallbackProductName: items[0]?.ProductName || null,
      candidates: buildProductCandidates(items)
    });

    return items[0];
  } catch (err) {
    logProductLookup("ERROR", {
      lookupId,
      lookupContext,
      searchedProductName: productName,
      status: err?.response?.status || null,
      responseData: err?.response?.data || null,
      message: err.message
    });

    throw new Error(buildAxiosErrorMessage("FIND_PRODUCT", err));
  }
}

async function getProductDetails(productId, context = {}) {
  try {
    const url = `${env.presseroBaseUrl}/api/site/${env.presseroProductSiteDomain}/Products/${productId}`;
    const response = await getWithAuthRetry(url);
    return response.data;
  } catch (err) {
    logProductLookup("PRODUCT_DETAILS_ERROR", {
      lookupContext: getLookupContext(context),
      productId,
      status: err?.response?.status || null,
      responseData: err?.response?.data || null,
      message: err.message
    });

    throw new Error(buildAxiosErrorMessage("PRODUCT_DETAILS", err));
  }
}

async function getUserByEmail(email) {
  try {
    const token = await authenticate();

    const url = `${env.presseroBaseUrl}/api/site/${env.presseroProductSiteDomain}/users/?pageNumber=0&pageSize=1&email=${encodeURIComponent(email)}&includeDeleted=false`;

    const response = await axios.get(url, {
      headers: getTokenHeaders(token)
    });

    const items = response.data?.Items || [];

    if (!Array.isArray(items) || items.length === 0) {
      return null;
    }

    return items[0];
  } catch (err) {
    throw new Error(buildAxiosErrorMessage("GET_USER_BY_EMAIL", err));
  }
}

async function getUserDetails(userId) {
  try {
    const token = await authenticate();

    const url = `${env.presseroBaseUrl}/api/site/${env.presseroProductSiteDomain}/users/${userId}`;

    const response = await axios.get(url, {
      headers: getTokenHeaders(token)
    });

    return response.data;
  } catch (err) {
    throw new Error(buildAxiosErrorMessage("GET_USER_DETAILS", err));
  }
}

async function getUserGroupsByEmail(email) {
  const key = String(email || "").trim().toLowerCase();
  const now = Date.now();

  const cached = userGroupsCache.get(key);
  if (cached && (now - cached.at) < USER_CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const token = await authenticate();

    const userLookupUrl = `${env.presseroBaseUrl}/api/site/${env.presseroProductSiteDomain}/users/?pageNumber=0&pageSize=1&email=${encodeURIComponent(email)}&includeDeleted=false`;

    const userLookupResponse = await axios.get(userLookupUrl, {
      headers: getTokenHeaders(token)
    });

    const items = userLookupResponse.data?.Items || [];

    if (!items.length) {
      const result = {
        found: false,
        email,
        userId: null,
        groups: []
      };

      userGroupsCache.set(key, { at: now, value: result });
      return result;
    }

    const userId = items[0].UserId;
    const detailsUrl = `${env.presseroBaseUrl}/api/site/${env.presseroProductSiteDomain}/users/${userId}`;

    const detailsResponse = await axios.get(detailsUrl, {
      headers: getTokenHeaders(token)
    });

    const result = {
      found: true,
      email,
      userId,
      groups: detailsResponse.data?.Groups || []
    };

    userGroupsCache.set(key, { at: now, value: result });
    return result;
  } catch (err) {
    throw new Error(buildAxiosErrorMessage("GET_USER_GROUPS_BY_EMAIL", err));
  }
}

function extractProductImages(details) {
  const images = Array.isArray(details?.ImagesUrl) ? details.ImagesUrl : [];

  const findByKeyword = (keywords) => {
    return images.find(url => {
      const lower = String(url || "").toLowerCase();
      return keywords.some(keyword => lower.includes(keyword));
    }) || null;
  };

  let xlarge =
    findByKeyword(["xlarge", "_xl", "_xlarge"]) ||
    findByKeyword(["large"]) ||
    findByKeyword(["medium"]) ||
    images[0] ||
    null;

  let large =
    findByKeyword(["large"]) ||
    findByKeyword(["medium"]) ||
    findByKeyword(["small"]) ||
    images[0] ||
    null;

  if (!large) {
    large = `${env.presseroBaseUrl}/files/defaultImages/default_Product_large.png`;
  }

  if (!xlarge) {
    xlarge = `${env.presseroBaseUrl}/files/defaultImages/default_Product_xlarge.png`;
  }

  return {
    productImageLargeUrl: large,
    productImageXlargeUrl: xlarge
  };
}

async function resolveProductByName(productName, context = {}) {
  const searchValue = getProductSearchValue(productName);
  const product = await findProductByName(productName, context);
  const lookupContext = getLookupContext({ ...context, productName });

  if (!product) {
    return {
      found: false,
      productId: null,
      productIsActive: 0,
      allowedGroupsJson: null,
      productImageLargeUrl: null,
      productImageXlargeUrl: null,
      lastSyncStatus: "NOT_FOUND",
      lastSyncMessage: `Produit introuvable pour ProductName="${productName}" | site="${env.presseroProductSiteDomain}" | searchValue="${searchValue}"`
    };
  }

  const productId = product.ProductId || null;

  if (!productId) {
    logProductLookup("PRODUCT_FOUND_WITHOUT_ID", {
      lookupContext,
      productName,
      product
    });

    return {
      found: false,
      productId: null,
      productIsActive: 0,
      allowedGroupsJson: null,
      productImageLargeUrl: null,
      productImageXlargeUrl: null,
      lastSyncStatus: "ERROR",
      lastSyncMessage: `Produit trouvé sans ProductId pour ProductName="${productName}"`
    };
  }

  try {
    const details = await getProductDetails(productId, lookupContext);
    const images = extractProductImages(details);

    return {
      found: true,
      productId: String(productId),
      productIsActive: details?.IsActive ? 1 : 0,
      allowedGroupsJson: JSON.stringify(details?.AllowedGroups || []),
      productImageLargeUrl: images.productImageLargeUrl,
      productImageXlargeUrl: images.productImageXlargeUrl,
      lastSyncStatus: "OK",
      lastSyncMessage: "Synchronisé avec succès"
    };
  } catch (err) {
    return {
      found: true,
      productId: String(productId),
      productIsActive: product?.IsActive ? 1 : 0,
      allowedGroupsJson: null,
      productImageLargeUrl: null,
      productImageXlargeUrl: null,
      lastSyncStatus: "PARTIAL_OK",
      lastSyncMessage: `Produit trouvé, mais détail produit indisponible: ${err.message}`
    };
  }
}

async function resolveProductByComponent(component = {}) {
  return resolveProductByName(component.component_id, {
    id: component.id,
    partId: component.part_id,
    componentId: component.component_id,
    productName: component.product_name,
    langCode: component.lang_code,
    pressersoIdNumber: component.presserso_id_number
  });
}

async function resolveProductByComponentId(componentId) {
  return resolveProductByName(componentId, { componentId });
}

module.exports = {
  authenticate,
  findProductByName,
  getProductDetails,
  resolveProductByName,
  resolveProductByComponent,
  resolveProductByComponentId,
  getUserByEmail,
  getUserDetails,
  getUserGroupsByEmail
};