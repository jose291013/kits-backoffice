const axios = require("axios");
const env = require("../config/env");
const presseroService = require("./presseroService");

function getTokenHeaders(token) {
  return {
    Authorization: `Token ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json"
  };
}

function parsePriceValue(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;

  const normalized = String(value).replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

async function priceComponent(component, quantity, userId) {
  const token = await presseroService.authenticate();

  console.log("PRESSERO CART SITE DOMAIN =", env.presseroCartSiteDomain);
  console.log("PRICE PRODUCT ID =", component.product_id);
  console.log("PRICE USER ID =", userId);

  const url =
    `${env.presseroBaseUrl}/api/cart/${env.presseroCartSiteDomain}/product/${component.product_id}/price?userId=${encodeURIComponent(userId)}`;

  const payload = {
    Quantities: [
      Number(quantity || 0),
      Number(component.q2_standard_quotation || 0),
      Number(component.q3_height || 0),
      Number(component.q4_width || 0)
    ],
    Options: []
  };

  console.log("PRICING URL:", url);
  console.log("PRICING PAYLOAD:", JSON.stringify(payload, null, 2));

  const response = await axios.post(url, payload, {
    headers: getTokenHeaders(token)
  });

  console.log("PRICING RESPONSE:", JSON.stringify(response.data, null, 2));

  const data = response.data || {};

  const totalPrice =
    parsePriceValue(data.Cost) ||
    parsePriceValue(data.DisplayCost) ||
    parsePriceValue(data.Price) ||
    parsePriceValue(data.TotalPrice) ||
    0;

  const unitPrice = quantity > 0 ? totalPrice / quantity : 0;

  return {
    raw: data,
    unitPrice,
    totalPrice
  };
}

module.exports = {
  priceComponent
};