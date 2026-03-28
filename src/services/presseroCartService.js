const axios = require("axios");
const env = require("../config/env");
const presseroService = require("./presseroService");

function getTokenHeaders(token) {
  return {
    Authorization: `Token ${token}`,
    "Content-Type": "application/json",
    "Accept-Language": "en-US",
    Accept: "application/json"
  };
}

async function getOrCreateCartId(userId) {
  const token = await presseroService.authenticate();

  const url = `${env.presseroBaseUrl}/api/cart/${env.presseroCartSiteDomain}/?userId=${encodeURIComponent(userId)}`;

  const response = await axios.get(url, {
    headers: getTokenHeaders(token)
  });

  const data = response.data || {};

  const cartId =
    data.CartId ||
    data.cartId ||
    data.Id ||
    data.id ||
    null;

  if (!cartId) {
    throw new Error("Impossible de récupérer le CartId Pressero");
  }

  return cartId;
}

async function addProductToCart(userId, component, quantity) {
  const token = await presseroService.authenticate();
  const cartId = await getOrCreateCartId(userId);

  const url =
    `${env.presseroBaseUrl}/api/cart/${env.presseroCartSiteDomain}/${encodeURIComponent(cartId)}/item/?userId=${encodeURIComponent(userId)}`;

  const payload = {
    ProductId: component.product_id,
    ShipTo: "",
    ShippingMethod: "",
    PricingParameters: {
      Quantities: [
        Number(quantity || 0),
        Number(component.q2_standard_quotation || 0),
        Number(component.q3_height || 0),
        Number(component.q4_width || 0)
      ],
      Options: []
    },
    ItemName: component.product_name || "Via API",
    Notes: `Ajout kit ${component.component_id || ""}`.trim()
  };

  console.log("ADD TO CART URL:", url);
  console.log("ADD TO CART PAYLOAD:", JSON.stringify(payload, null, 2));

  const response = await axios.post(url, payload, {
    headers: getTokenHeaders(token)
  });

  console.log("ADD TO CART RESPONSE:", JSON.stringify(response.data, null, 2));

  return {
    cartId,
    raw: response.data || null
  };
}

module.exports = {
  getOrCreateCartId,
  addProductToCart
};