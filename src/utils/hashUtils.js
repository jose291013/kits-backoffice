const crypto = require("crypto");

function normalize(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function buildComponentSourceHash(component) {
  const raw = [
    normalize(component.componentId),
    normalize(component.productName),
    normalize(component.langCode),
    normalize(component.defaultComponentQty),
    normalize(component.q2StandardQuotation),
    normalize(component.q3Height),
    normalize(component.q4Width)
  ].join("||");

  return crypto.createHash("sha1").update(raw).digest("hex");
}

module.exports = {
  buildComponentSourceHash
};