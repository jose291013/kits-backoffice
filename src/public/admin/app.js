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

  kitSearchInput: document.getElementById("kitSearchInput"),
  kitsTableBody: document.getElementById("kitsTableBody"),

  kitDetailSection: document.getElementById("kitDetailSection"),
  kitDetailBox: document.getElementById("kitDetailBox"),
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
      state.selectedPartId = partId;
      await loadKitDetail(partId);
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

function bindEvents() {
  els.importExcelBtn.addEventListener("click", importExcel);
  els.exportExcelBtn.addEventListener("click", exportExcel);

  els.kitSearchInput.addEventListener("input", () => {
    loadKits();
  });
}

async function init() {
  bindEvents();
  await refreshAll();
}

init();