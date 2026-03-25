function getVisibleLangs(userGroups = []) {
  const normalized = userGroups.map(g => String(g).toUpperCase());

  if (normalized.includes("NL")) return ["UNI", "NL"];
  if (normalized.includes("FR")) return ["UNI", "FR"];
  if (normalized.includes("BIL")) return ["UNI", "BIL"];

  return ["UNI"];
}

module.exports = {
  getVisibleLangs
};