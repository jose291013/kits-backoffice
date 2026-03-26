const API_BASE = "";

const els = {
  statKits: document.getElementById("statKits"),
  statOk: document.getElementById("statOk"),
  statPending: document.getElementById("statPending"),
  statNotFound: document.getElementById("statNotFound"),

  refreshDashboardBtn: document.getElementById("refreshDashboardBtn"),
  syncPendingBtn: document.getElementById("syncPendingBtn"),

  excelFileInput: document.getElementById("excelFileInput"),
  importExcelBtn: document.getElementById("importExcelBtn"),
  importResult: document.getElementById("importResult"),

  loadPendingBtn: document.getElementById("loadPendingBtn"),
  pendingSummary: document.getElementById("pendingSummary"),
  pendingTableBody: document.getElementById("pendingTableBody"),

  loadNotFoundBtn: document.getElementById("loadNotFoundBtn"),
  notFoundSummary: document.getElementById("notFoundSummary"),
  notFoundTableBody: document.getElementById("notFoundTableBody"),

  kitSearchInput: document.getElementById("kitSearchInput"),
  loadKitsBtn: document.getElementById("loadKitsBtn"),
  kitsTableBody: document.getElementById("kitsTableBody"),

  kitDetailBox: document.getElementById("kitDetailBox"),
  kitDetailTableBody: document.getElementById("kitDetailTableBody")
};

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusBadge(status) {
  const safe = escapeHtml(status || "");
  return `<span class="status-badge status-${safe}">${safe || "-"}</span>`;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, options);
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || "Erreur API");
  }
  return data;
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
      Lignes : ${data.rows}<br>
      Kits trouvés : ${data.kitsFound}<br>
      Kits sauvés : ${data.kitsSaved}<br>
      Composants créés : ${data.componentsCreated}<br>
      Composants mis à jour : ${data.componentsUpdated}<br>
      Composants inchangés : ${data.componentsUnchanged}<br>
      Composants désactivés : ${data.componentsDisabled}<br>
      Importé le : ${escapeHtml(data.importedAt)}
    `;

    await loadDashboard();
  } catch (err) {
    els.importResult.textContent = err.message;
  }
}

async function loadPendingComponents() {
  try {
    const data = await fetchJson("/api/pressero/pending-components?limit=100");

    els.pendingSummary.innerHTML = `
      Total en attente : <strong>${data.summary.totalPending}</strong><br>
      Retournés : <strong>${data.summary.returned}</strong>
    `;

    if (!data.items.length) {
      els.pendingTableBody.innerHTML = `<tr><td colspan="5" class="table-empty">Aucun composant en attente</td></tr>`;
      return;
    }

    els.pendingTableBody.innerHTML = data.items.map(item => `
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

async function loadNotFoundComponents() {
  try {
    const data = await fetchJson("/api/pressero/components-by-status?status=NOT_FOUND&limit=100");

    els.notFoundSummary.innerHTML = `
      Total introuvables : <strong>${data.summary.total}</strong><br>
      Retournés : <strong>${data.summary.returned}</strong>
    `;

    if (!data.items.length) {
      els.notFoundTableBody.innerHTML = `<tr><td colspan="5" class="table-empty">Aucun composant introuvable</td></tr>`;
      return;
    }

    els.notFoundTableBody.innerHTML = data.items.map(item => `
      <tr>
        <td>${escapeHtml(item.partId)}</td>
        <td>${escapeHtml(item.componentId)}</td>
        <td>${escapeHtml(item.langCode)}</td>
        <td>${statusBadge(item.lastSyncStatus)}</td>
        <td>${escapeHtml(item.lastSyncMessage)}</td>
      </tr>
    `).join("");
  } catch (err) {
    els.notFoundSummary.textContent = err.message;
  }
}

async function loadKits() {
  try {
    const data = await fetchJson("/api/kits");
    const term = (els.kitSearchInput.value || "").trim().toLowerCase();

    let kits = Array.isArray(data.kits) ? data.kits : [];

    if (term) {
      kits = kits.filter(kit =>
        String(kit.part_id || "").toLowerCase().includes(term) ||
        String(kit.kit_name || "").toLowerCase().includes(term)
      );
    }

    if (!kits.length) {
      els.kitsTableBody.innerHTML = `<tr><td colspan="7" class="table-empty">Aucun kit trouvé</td></tr>`;
      return;
    }

    els.kitsTableBody.innerHTML = kits.map(kit => `
      <tr>
        <td>${kit.id}</td>
        <td>${escapeHtml(kit.part_id)}</td>
        <td>${escapeHtml(kit.kit_name)}</td>
        <td>${kit.default_kit_qty}</td>
        <td>${kit.is_active === 1 ? "Oui" : "Non"}</td>
        <td>${escapeHtml(kit.last_imported_at || "")}</td>
        <td><button class="btn btn-secondary btn-view-kit" data-partid="${escapeHtml(kit.part_id)}">Voir</button></td>
      </tr>
    `).join("");

    bindKitButtons();
  } catch (err) {
    els.kitsTableBody.innerHTML = `<tr><td colspan="7" class="table-empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

function bindKitButtons() {
  document.querySelectorAll(".btn-view-kit").forEach(btn => {
    btn.addEventListener("click", async () => {
      const partId = btn.getAttribute("data-partid");
      await loadKitDetail(partId);
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

async function syncPending() {
  try {
    els.pendingSummary.textContent = "Synchronisation en cours...";
    const data = await fetchJson("/api/pressero/sync-pending?limit=200", {
      method: "POST"
    });

    els.pendingSummary.innerHTML = `
      Synchronisation terminée.<br>
      Composants trouvés : <strong>${data.summary.componentsFound}</strong><br>
      OK : <strong>${data.summary.okCount}</strong><br>
      NOT_FOUND : <strong>${data.summary.notFoundCount}</strong><br>
      ERROR : <strong>${data.summary.errorCount}</strong>
    `;

    await loadDashboard();
    await loadPendingComponents();
    await loadNotFoundComponents();
  } catch (err) {
    els.pendingSummary.textContent = err.message;
  }
}

function bindEvents() {
  els.refreshDashboardBtn.addEventListener("click", async () => {
    await loadDashboard();
  });

  els.importExcelBtn.addEventListener("click", importExcel);
  els.loadPendingBtn.addEventListener("click", loadPendingComponents);
  els.loadNotFoundBtn.addEventListener("click", loadNotFoundComponents);
  els.loadKitsBtn.addEventListener("click", loadKits);
  els.syncPendingBtn.addEventListener("click", syncPending);
}

async function init() {
  bindEvents();
  await loadDashboard();
  await loadPendingComponents();
  await loadNotFoundComponents();
  await loadKits();
}

init();