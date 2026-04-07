const API_BASE = "";

const els = {
  statKits: document.getElementById("statKits"),
  statOk: document.getElementById("statOk"),
  statPending: document.getElementById("statPending"),
  statNotFound: document.getElementById("statNotFound"),

  excelFileInput: document.getElementById("excelFileInput"),
  importExcelBtn: document.getElementById("importExcelBtn"),
  importResult: document.getElementById("importResult"),
  exportExcelBtn: document.getElementById("exportExcelBtn"),

  pendingSummary: document.getElementById("pendingSummary"),
  pendingTableBody: document.getElementById("pendingTableBody"),
  syncPendingBtn: document.getElementById("syncPendingBtn"),
  syncSelectedKitBtn: document.getElementById("syncSelectedKitBtn"),
  syncAllKitsBtn: document.getElementById("syncAllKitsBtn"),

  kitSearchInput: document.getElementById("kitSearchInput"),
  kitsTableBody: document.getElementById("kitsTableBody"),

  kitDetailSection: document.getElementById("kitDetailSection"),
  kitDetailBox: document.getElementById("kitDetailBox"),
  resetAllKitsBtn: document.getElementById("resetAllKitsBtn"),
  kitDetailTableBody: document.getElementById("kitDetailTableBody")
};

const state = {
  kits: [],
  selectedPartId: null
};

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function exportExcel() {
  window.open("/api/admin/export-excel", "_blank");
}

function statusBadge(status) {
  const safe = escapeHtml(status || "-");
  return `<span class="status-badge status-${safe}">${safe}</span>`;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, options);
  const text = await res.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Réponse non JSON (${res.status}) pour ${url}`);
  }

  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `Erreur API (${res.status})`);
  }

  return data;
}

async function syncPendingComponents() {
  try {
    els.pendingSummary.textContent = "Synchronisation en cours...";

    const data = await fetchJson("/api/pressero/sync-pending?limit=200", {
      method: "POST"
    });

    els.pendingSummary.innerHTML = `
      <strong>Synchronisation terminée</strong><br>
      Composants traités : <strong>${data.summary.componentsFound}</strong><br>
      OK : <strong>${data.summary.okCount}</strong><br>
      PARTIAL_OK : <strong>${data.summary.partialOkCount}</strong><br>
      NOT_FOUND : <strong>${data.summary.notFoundCount}</strong><br>
      ERROR : <strong>${data.summary.errorCount}</strong>
    `;

    await refreshAll();
  } catch (err) {
    els.pendingSummary.textContent = err.message;
  }
}

async function syncAllKits() {
  try {
    els.pendingSummary.textContent = "Resynchronisation globale en cours...";

    const data = await fetchJson("/api/pressero/sync-all-kits?limit=5000", {
      method: "POST"
    });

    els.pendingSummary.innerHTML = `
      <strong>Resynchronisation globale terminée</strong><br>
      Kits traités : <strong>${data.summary.kitsProcessed}</strong><br>
      Composants traités : <strong>${data.summary.componentsProcessed}</strong><br>
      OK : <strong>${data.summary.okCount}</strong><br>
      PARTIAL_OK : <strong>${data.summary.partialOkCount}</strong><br>
      NOT_FOUND : <strong>${data.summary.notFoundCount}</strong><br>
      ERROR : <strong>${data.summary.errorCount}</strong>
    `;

    await refreshAll();
  } catch (err) {
    els.pendingSummary.textContent = err.message;
  }
}

async function loadDashboard() {
  const [kitsRes, pendingRes, notFoundRes, okRes] = await Promise.all([
    fetchJson("/api/kits"),
    fetchJson("/api/pressero/pending-components?limit=1"),
    fetchJson("/api/pressero/components-by-status?status=NOT_FOUND&limit=1"),
    fetchJson("/api/pressero/components-by-status?status=OK&limit=1")
  ]);

  els.statKits.textContent = kitsRes.count || 0;
  els.statPending.textContent = pendingRes.summary?.totalPending || 0;
  els.statNotFound.textContent = notFoundRes.summary?.total || 0;
  els.statOk.textContent = okRes.summary?.total || 0;
}

async function syncKit(partId) {
  if (!partId) return;

  try {
    els.kitDetailBox.innerHTML = `Synchronisation en cours pour <strong>${escapeHtml(partId)}</strong>...`;

    const data = await fetchJson(`/api/pressero/sync-kit/${encodeURIComponent(partId)}`, {
      method: "POST"
    });

    els.kitDetailBox.innerHTML = `
      <strong>Synchronisation terminée</strong><br>
      PartID : ${escapeHtml(partId)}<br>
      Composants traités : <strong>${data.componentsProcessed}</strong>
    `;

    await refreshAll();
    await loadKitDetail(partId);
  } catch (err) {
    els.kitDetailBox.textContent = err.message;
  }
}

async function importExcel() {
  const file = els.excelFileInput.files[0];

  if (!file) {
    els.importResult.textContent = "Choisis un fichier Excel avant de lancer l'import.";
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  els.importResult.textContent = "Import en cours...";

  try {
    const res = await fetch(`${API_BASE}/api/import/excel`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (!res.ok || data.ok === false) {
      throw new Error(data.error || "Erreur import Excel");
    }

    els.importResult.innerHTML = `
  <strong>Import terminé</strong><br>
  Fichier : ${escapeHtml(data.filename)}<br>
  Lignes du fichier : ${data.rows}<br>
  Kits trouvés : ${data.kitsFound}<br>
  Couples kit + composant distincts : ${data.uniqueKitComponentPairs ?? "-"}<br>
  Doublons détectés : ${data.duplicateCount ?? 0}<br>
  Kits sauvés : ${data.kitsSaved}<br>
  Composants créés : ${data.componentsCreated}<br>
  Composants mis à jour : ${data.componentsUpdated}<br>
  Composants inchangés : ${data.componentsUnchanged}<br>
  Composants désactivés : ${data.componentsDisabled}<br>
  Importé le : ${escapeHtml(data.importedAt)}
  ${
    data.duplicateCount
      ? `<br><br><strong>Attention :</strong> ${data.duplicateCount} doublon(s) détecté(s) dans le fichier Excel.`
      : ""
  }
`;

    await refreshAll();
  } catch (err) {
    els.importResult.textContent = err.message;
  }
}

async function loadComponentsToTreat() {
  try {
    const [pendingData, notFoundData] = await Promise.all([
      fetchJson("/api/pressero/pending-components?limit=200"),
      fetchJson("/api/pressero/components-by-status?status=NOT_FOUND&limit=200")
    ]);

    const pendingItems = Array.isArray(pendingData.items) ? pendingData.items : [];
    const notFoundItems = Array.isArray(notFoundData.items) ? notFoundData.items : [];

    const map = new Map();

    [...pendingItems, ...notFoundItems].forEach(item => {
      const key = `${item.partId}__${item.componentId}__${item.lastSyncStatus}`;
      map.set(key, item);
    });

    const items = Array.from(map.values());

    els.pendingSummary.innerHTML = `
      Total à traiter : <strong>${items.length}</strong><br>
      À synchroniser : <strong>${pendingData.summary?.totalPending || 0}</strong><br>
      Introuvables : <strong>${notFoundData.summary?.total || 0}</strong>
    `;

    if (!items.length) {
      els.pendingTableBody.innerHTML = `<tr><td colspan="5" class="table-empty">Aucun composant à traiter</td></tr>`;
      return;
    }

    els.pendingTableBody.innerHTML = items.map(item => `
      <tr>
        <td>${escapeHtml(item.partId)}</td>
        <td>${escapeHtml(item.componentId)}</td>
        <td>${escapeHtml(item.langCode)}</td>
        <td>${statusBadge(item.lastSyncStatus)}</td>
        <td>${escapeHtml(item.lastSyncMessage)}</td>
      </tr>
    `).join("");
  } catch (err) {
    els.pendingSummary.textContent = err.message;
  }
}

function filterKits(list, term) {
  const q = String(term || "").trim().toLowerCase();

  if (!q) return list;

  return list.filter(kit =>
    String(kit.part_id || "").toLowerCase().includes(q) ||
    String(kit.kit_name || "").toLowerCase().includes(q)
  );
}

async function loadKits() {
  try {
    const data = await fetchJson("/api/kits");
    state.kits = Array.isArray(data.kits) ? data.kits : [];

    const kits = filterKits(state.kits, els.kitSearchInput.value);

    if (!kits.length) {
      els.kitsTableBody.innerHTML = `<tr><td colspan="7" class="table-empty">Aucun kit trouvé</td></tr>`;
      return;
    }

    els.kitsTableBody.innerHTML = kits.map(kit => {
  const partId = kit.part_id || kit.partId || kit.PartId || "";
  const kitName = kit.kit_name || kit.kitName || kit.KitName || partId;
  const defaultKitQty = kit.default_kit_qty || kit.defaultKitQty || 1;
  const isActive = kit.is_active ?? kit.isActive ?? 0;
  const lastImportedAt = kit.last_imported_at || kit.lastImportedAt || "";

  return `
    <tr>
      <td>${kit.id}</td>
      <td>${escapeHtml(partId)}</td>
      <td>${escapeHtml(kitName)}</td>
      <td>${defaultKitQty}</td>
      <td>${isActive === 1 ? "Oui" : "Non"}</td>
      <td>${escapeHtml(lastImportedAt)}</td>
      <td>
        <div class="kit-action-buttons">
          <button
            class="btn btn-icon btn-secondary btn-view-kit"
            data-partid="${escapeHtml(partId)}"
            title="Voir"
            aria-label="Voir">
            ⌕
          </button>

          <button
            class="btn btn-icon btn-primary btn-sync-kit"
            data-partid="${escapeHtml(partId)}"
            title="Synchroniser"
            aria-label="Synchroniser">
            ↺
          </button>

          <button
            class="btn btn-icon btn-danger btn-delete-kit"
            data-partid="${escapeHtml(partId)}"
            title="Supprimer"
            aria-label="Supprimer">
            🗑
          </button>
        </div>
      </td>
    </tr>
  `;
}).join("");

    bindKitButtons();
  } catch (err) {
    els.kitsTableBody.innerHTML = `<tr><td colspan="7" class="table-empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

function bindKitButtons() {
  document.querySelectorAll(".btn-view-kit").forEach(btn => {
    btn.addEventListener("click", async () => {
      const partId = btn.getAttribute("data-partid");
      state.selectedPartId = partId;
      await loadKitDetail(partId);
      els.kitDetailSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.querySelectorAll(".btn-delete-kit").forEach(btn => {
    btn.addEventListener("click", async () => {
      const partId =
        btn.getAttribute("data-partid") ||
        btn.dataset.partid ||
        "";

      console.log("DELETE KIT CLICKED:", partId, btn.outerHTML);

      await deleteKit(partId);
    });
  });

  document.querySelectorAll(".btn-sync-kit").forEach(btn => {
    btn.addEventListener("click", async () => {
      const partId = btn.getAttribute("data-partid");
      state.selectedPartId = partId;
      await syncKit(partId);
      els.kitDetailSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

async function loadKitDetail(partId) {
  try {
    const data = await fetchJson(`/api/kits/${encodeURIComponent(partId)}`);
    const kit = data.kit;

    els.kitDetailBox.innerHTML = `
      <strong>${escapeHtml(kit.kit_name)}</strong><br>
      PartID : ${escapeHtml(kit.part_id)}<br>
      Quantité kit par défaut : ${kit.default_kit_qty}<br>
      Dernier import : ${escapeHtml(kit.last_imported_at || "")}
    `;

    if (!kit.components || !kit.components.length) {
      els.kitDetailTableBody.innerHTML = `<tr><td colspan="7" class="table-empty">Aucun composant</td></tr>`;
      return;
    }

    els.kitDetailTableBody.innerHTML = kit.components.map(component => `
      <tr>
        <td>${component.sort_order}</td>
        <td>${escapeHtml(component.component_id)}</td>
        <td>${escapeHtml(component.lang_code)}</td>
        <td>${component.default_component_qty}</td>
        <td>${escapeHtml(component.product_id || "")}</td>
        <td>${statusBadge(component.last_sync_status)}</td>
        <td>${escapeHtml(component.last_sync_message || "")}</td>
      </tr>
    `).join("");
  } catch (err) {
    els.kitDetailBox.textContent = err.message;
    els.kitDetailTableBody.innerHTML = `<tr><td colspan="7" class="table-empty">Erreur de chargement</td></tr>`;
  }
}

async function refreshAll() {
  await Promise.all([
    loadDashboard(),
    loadComponentsToTreat(),
    loadKits()
  ]);

  if (state.selectedPartId) {
    await loadKitDetail(state.selectedPartId);
  }
}

async function deleteKit(partId) {
  const safePartId = String(partId || "").trim();

  if (!safePartId) {
    console.error("DELETE KIT ERROR: partId vide", partId);
    els.kitDetailBox.innerHTML = `<strong>Erreur :</strong><br>PartID introuvable pour la suppression.`;
    return;
  }

  const ok = window.confirm(
    `Voulez-vous vraiment supprimer le kit suivant ?\n\n${safePartId}\n\nCette action supprimera aussi tous ses composants.`
  );
  if (!ok) return;

  try {
    els.kitDetailBox.innerHTML = `Suppression du kit <strong>${escapeHtml(safePartId)}</strong> en cours...`;

    const url = `/api/admin/kits/${encodeURIComponent(safePartId)}`;
    console.log("DELETE KIT REQUEST:", url);

    const data = await fetchJson(url, {
      method: "DELETE"
    });

    state.selectedPartId = "";

    els.kitDetailBox.innerHTML = `
      <strong>${escapeHtml(data.message || "Kit supprimé avec succès")}</strong><br>
      ${escapeHtml(safePartId)}
    `;

    els.kitDetailTableBody.innerHTML =
      `<tr><td colspan="7" class="table-empty">Aucun composant</td></tr>`;

    await loadDashboard();
    await loadComponentsToTreat();
    await loadKits();
  } catch (err) {
    console.error("DELETE KIT ERROR:", err);
    els.kitDetailBox.innerHTML = `<strong>Erreur :</strong><br>${escapeHtml(err.message)}`;
  }
}

function bindEvents() {
  els.importExcelBtn.addEventListener("click", importExcel);
  els.exportExcelBtn.addEventListener("click", exportExcel);
  els.syncPendingBtn.addEventListener("click", syncPendingComponents);
  els.syncAllKitsBtn.addEventListener("click", syncAllKits);
  els.resetAllKitsBtn.addEventListener("click", resetAllKits);

  els.kitSearchInput.addEventListener("input", () => {
    loadKits();
  });
  els.syncSelectedKitBtn.addEventListener("click", async () => {
  if (!state.selectedPartId) return;
  await syncKit(state.selectedPartId);
});
}

async function init() {
  bindEvents();
  await refreshAll();
}

async function resetAllKits() {
  const ok = window.confirm(
    "Voulez-vous vraiment supprimer tous les kits et tous leurs composants ?\n\nCette action est irréversible."
  );
  if (!ok) return;

  try {
    els.importResult.innerHTML = "Réinitialisation en cours...";

    const data = await fetchJson("/api/admin/reset-all-kits", {
      method: "POST"
    });

    state.selectedPartId = null;
    els.kitDetailBox.innerHTML = "";
    els.kitDetailTableBody.innerHTML = `<tr><td colspan="7" class="table-empty">Aucun composant</td></tr>`;

    els.importResult.innerHTML = `<strong>${escapeHtml(data.message || "Réinitialisation terminée")}</strong>`;

    await refreshAll();
  } catch (err) {
    console.error("RESET ALL KITS ERROR:", err);
    els.importResult.innerHTML = `<strong>Erreur :</strong> ${escapeHtml(err.message)}`;
  }
}

init();