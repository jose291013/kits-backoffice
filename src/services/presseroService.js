const axios = require("axios");
const env = require("../config/env");

let cachedToken = null;
let cachedTokenAt = null;

function isTokenStillValid() {
  if (!cachedToken || !cachedTokenAt) return false;
  const now = Date.now();
  const ageMs = now - cachedTokenAt;
  return ageMs < 50 * 60 * 1000;
}

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
    "Content-Type": "application/json"
  };
}

async function authenticate() {
  if (isTokenStillValid()) {
    return cachedToken;
  }

  try {
    const url = `${env.presseroBaseUrl}/api/v2/Authentication`;

    const payload = {
      UserName: env.presseroUsername,
      Password: env.presseroPassword,
      SubscriberId: env.presseroSubscriberId,
      ConsumerID: env.presseroConsumerId
    };

    const response = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" }
    });

    console.log("AUTH RESPONSE:", JSON.stringify(response.data, null, 2));

    const token =
      (typeof response.data === "string" ? response.data : null) ||
      response.data?.Token ||
      response.data?.token ||
      response.data?.access_token ||
      response.data?.data?.Token ||
      response.data?.Data?.Token ||
      response.data?.AuthToken ||
      response.data?.authToken;

    if (!token) {
      throw new Error(`Token introuvable dans la réponse auth: ${JSON.stringify(response.data)}`);
    }

    cachedToken = String(token).trim().replace(/^"+|"+$/g, "");
    cachedTokenAt = Date.now();

    console.log("AUTH TOKEN PREVIEW:", cachedToken.slice(0, 20), "...");

    return cachedToken;
  } catch (err) {
    throw new Error(buildAxiosErrorMessage("AUTH", err));
  }
}

async function postWithAuthRetry(url, body) {
  const token = await authenticate();

  try {
    console.log("TRY AUTH HEADER: Token");
    return await axios.post(url, body, {
      headers: getTokenHeaders(token)
    });
  } catch (err) {
    console.log("TOKEN FAILED:", err?.response?.status, err?.response?.data);

    if (err?.response?.status !== 401) throw err;

    console.log("TRY AUTH HEADER: Raw token");
    return axios.post(url, body, {
      headers: getRawTokenHeaders(token)
    });
  }
}

async function getWithAuthRetry(url) {
  const token = await authenticate();

  console.log("GET DETAILS URL:", url);
  console.log("GET DETAILS AUTH:", `Token ${token}`);

  return axios.get(url, {
    headers: getTokenHeaders(token)
  });
}

async function findProductByName(productName) {
  try {
    const url = `${env.presseroBaseUrl}/api/site/${env.presseroProductSiteDomain}/products/?pageNumber=0&pageSize=1&includeDeleted=True`;

    const body = [
      {
        Column: "productName",
        Value: productName,
        Operator: "contains"
      }
    ];

    console.log("FIND PRODUCT URL:", url);
    console.log("FIND PRODUCT BODY:", JSON.stringify(body, null, 2));
    console.log("PRESSERO PRODUCT SITE DOMAIN =", env.presseroProductSiteDomain);

    const response = await postWithAuthRetry(url, body);

    console.log("FIND PRODUCT RESPONSE:", JSON.stringify(response.data, null, 2));

    const items = response.data?.Items || [];

    if (!Array.isArray(items) || items.length === 0) {
      return null;
    }

    return items[0];
  } catch (err) {
    throw new Error(buildAxiosErrorMessage("FIND_PRODUCT", err));
  }
}

async function getProductDetails(productId) {
  try {
    const url = `${env.presseroBaseUrl}/api/site/${env.presseroProductSiteDomain}/Products/${productId}`;

    const response = await getWithAuthRetry(url);

    console.log("PRODUCT DETAILS RESPONSE:", JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (err) {
    throw new Error(buildAxiosErrorMessage("PRODUCT_DETAILS", err));
  }
}

async function getUserByEmail(email) {
  const token = await authenticate();

  const url = `${env.presseroBaseUrl}/api/site/${env.presseroProductSiteDomain}/users/?pageNumber=0&pageSize=1&email=${encodeURIComponent(email)}&includeDeleted=false`;
  console.log("GET USER BY EMAIL URL:", url);
  console.log("GET USER BY EMAIL HEADERS:", JSON.stringify(getTokenHeaders(token), null, 2));


  const response = await axios.get(url, {
    headers: getTokenHeaders(token)
  });

  const items = response.data?.Items || [];

  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return items[0];
}

async function getUserDetails(userId) {
  const token = await authenticate();

  const url = `${env.presseroBaseUrl}/api/site/${env.presseroProductSiteDomain}/users/${userId}`;

  const response = await axios.get(url, {
    headers: getTokenHeaders(token)
  });

  return response.data;
}

async function getUserGroupsByEmail(email) {
  const user = await getUserByEmail(email);

  if (!user) {
    return {
      found: false,
      email,
      userId: null,
      groups: []
    };
  }

  const userId = user.UserId || user.userId || null;

  if (!userId) {
    return {
      found: false,
      email,
      userId: null,
      groups: []
    };
  }

  const details = await getUserDetails(userId);
  const groups = Array.isArray(details?.Groups) ? details.Groups : [];

  return {
    found: true,
    email,
    userId,
    groups
  };
}

function extractProductImages(details) {
  const images = Array.isArray(details?.ImagesUrl) ? details.ImagesUrl : [];

  if (!images.length) {
    return {
      productImageLargeUrl: null,
      productImageXlargeUrl: null
    };
  }

  const findByKeyword = (keywords) => {
    return images.find(url => {
      const lower = String(url || "").toLowerCase();
      return keywords.some(keyword => lower.includes(keyword));
    }) || null;
  };

  const xlarge =
    findByKeyword(["xlarge", "_xl", "_xlarge"]) ||
    findByKeyword(["large"]) ||
    findByKeyword(["medium"]) ||
    images[0] ||
    null;

  const large =
    findByKeyword(["large"]) ||
    findByKeyword(["medium"]) ||
    findByKeyword(["small"]) ||
    images[0] ||
    null;

  return {
    productImageLargeUrl: large,
    productImageXlargeUrl: xlarge
  };
}

async function resolveProductByName(productName) {
  const product = await findProductByName(productName);

  if (!product) {
    return {
      found: false,
      productId: null,
      productIsActive: 0,
      allowedGroupsJson: null,
      productImageLargeUrl: null,
      productImageXlargeUrl: null,
      lastSyncStatus: "NOT_FOUND",
      lastSyncMessage: `Produit introuvable pour ProductName="${productName}"`
    };
  }

  const productId = product.ProductId || null;

  if (!productId) {
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
    const details = await getProductDetails(productId);

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

module.exports = {
  authenticate,
  findProductByName,
  getProductDetails,
  resolveProductByName,
  getUserByEmail,
  getUserDetails,
  getUserGroupsByEmail
};