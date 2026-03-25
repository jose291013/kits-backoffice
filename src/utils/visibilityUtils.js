function normalizeGroupName(group) {
  if (!group) return "";
  if (typeof group === "string") return group.trim().toUpperCase();

  return String(
    group.GroupName ||
    group.Name ||
    group.Code ||
    group.groupName ||
    group.name ||
    group.code ||
    ""
  ).trim().toUpperCase();
}

function getVisibleLangsFromGroups(groups = []) {
  const normalized = groups.map(normalizeGroupName).filter(Boolean);

  const visible = new Set(["UNI"]);

  if (normalized.includes("FR")) visible.add("FR");
  if (normalized.includes("NL")) visible.add("NL");
  if (normalized.includes("BIL")) visible.add("BIL");

  return Array.from(visible);
}

function parseAllowedGroupsJson(value) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function componentMatchesAllowedGroups(component, userGroups = []) {
  const allowed = parseAllowedGroupsJson(component.allowed_groups_json);

  if (!allowed.length) return true;

  const normalizedUserGroups = userGroups.map(normalizeGroupName).filter(Boolean);

  const normalizedAllowed = allowed.map(item =>
    normalizeGroupName(item)
  ).filter(Boolean);

  if (normalizedAllowed.includes("TOUT LE MONDE")) return true;
  if (normalizedAllowed.includes("EVERYONE")) return true;

  return normalizedAllowed.some(group => normalizedUserGroups.includes(group));
}

function filterVisibleComponents(components = [], userGroups = []) {
  const visibleLangs = getVisibleLangsFromGroups(userGroups);

  return components.filter(component => {
    const lang = String(component.lang_code || "").trim().toUpperCase();

    const matchesLang = visibleLangs.includes(lang);
    const matchesAllowedGroups = componentMatchesAllowedGroups(component, userGroups);
    const isActive = Number(component.is_active) === 1;
    const hasProduct = !!component.product_id;
    const syncOk = component.last_sync_status === "OK";

    return isActive && hasProduct && syncOk && matchesLang && matchesAllowedGroups;
  });
}

module.exports = {
  normalizeGroupName,
  getVisibleLangsFromGroups,
  filterVisibleComponents
};