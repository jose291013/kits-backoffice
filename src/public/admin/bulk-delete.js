(function () {
  const API_BASE = "";

  const els = {
    kitSearchInput: document.getElementById("kitSearchInput"),
    kitsTableBody: document.getElementById("kitsTableBody")
  };

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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
      throw new Error(data.error || data.message || `Erreur API (${res.status})`);
    }

    return data;
  }

  function getKitsTable() {
    return els.kitsTableBody ? els.kitsTableBody.closest("table") : null;
  }

  function getBulkPanel() {
    return document.getElementById("bulkKitDeletePanel");
  }

  function getCurrentSearchTerm() {
    return String(els.kitSearchInput?.value || "").trim();
  }

  function getVisiblePartIds() {
    return Array.from(document.querySelectorAll("#kitsTableBody .btn-delete-kit[data-partid]"))
      .map(btn => String(btn.getAttribute("data-partid") || "").trim())
      .filter(Boolean);
  }

  function getSelectedPartIds() {
    return Array.from(document.querySelectorAll("#kitsTableBody .kit-bulk-checkbox:checked"))
      .map(input => String(input.getAttribute("data-partid") || "").trim())
      .filter(Boolean);
  }

  function setBulkMessage(message, type = "muted") {
    const panel = getBulkPanel();
    const box = panel?.querySelector("#bulkKitDeleteMessage");
    if (!box) return;

    box.className = `bulk-delete-message ${type}`;
    box.innerHTML = message;
  }

  function updateBulkCount() {
    const panel = getBulkPanel();
    if (!panel) return;

    const visibleCount = getVisiblePartIds().length;
    const selectedCount = getSelectedPartIds().length;
    const countEl = panel.querySelector("#bulkKitDeleteCount");
    const button = panel.querySelector("#bulkDeleteSelectedKitsBtn");
    const selectAll = panel.querySelector("#bulkSelectFilteredKits");

    if (countEl) {
      countEl.textContent = `${selectedCount} sélectionné(s) / ${visibleCount} kit(s) affiché(s)`;
    }

    if (button) {
      button.disabled = selectedCount === 0;
    }

    if (selectAll) {
      const checkboxes = Array.from(document.querySelectorAll("#kitsTableBody .kit-bulk-checkbox"));
      selectAll.checked = checkboxes.length > 0 && checkboxes.every(input => input.checked);
      selectAll.indeterminate = checkboxes.some(input => input.checked) && !selectAll.checked;
    }
  }

  function ensureBulkPanel() {
    if (!els.kitSearchInput || getBulkPanel()) return;

    const searchRow = els.kitSearchInput.closest(".search-row");
    if (!searchRow) return;

    const panel = document.createElement("div");
    panel.id = "bulkKitDeletePanel";
    panel.className = "bulk-delete-panel";
    panel.innerHTML = `
      <div class="bulk-delete-main">
        <label class="bulk-delete-select-all">
          <input type="checkbox" id="bulkSelectFilteredKits">
          <span>Tout sélectionner les kits filtrés</span>
        </label>
        <span id="bulkKitDeleteCount" class="bulk-delete-count">0 sélectionné / 0 affiché</span>
      </div>
      <div class="bulk-delete-actions">
        <button id="bulkDeleteSelectedKitsBtn" class="btn btn-danger-outline" type="button" disabled>
          Supprimer les kits sélectionnés
        </button>
      </div>
      <div id="bulkKitDeleteMessage" class="bulk-delete-message muted">
        Filtrez une section, par exemple 0473, puis sélectionnez les kits à supprimer avant réimport.
      </div>
    `;

    searchRow.insertAdjacentElement("afterend", panel);

    panel.querySelector("#bulkSelectFilteredKits").addEventListener("change", event => {
      const checked = event.target.checked;
      document.querySelectorAll("#kitsTableBody .kit-bulk-checkbox").forEach(input => {
        input.checked = checked;
      });
      updateBulkCount();
    });

    panel.querySelector("#bulkDeleteSelectedKitsBtn").addEventListener("click", deleteSelectedKits);
  }

  function ensureHeaderColumn() {
    const table = getKitsTable();
    const headerRow = table?.querySelector("thead tr");
    if (!headerRow || headerRow.querySelector(".kit-bulk-header")) return;

    const th = document.createElement("th");
    th.className = "kit-bulk-header";
    th.textContent = "Sélection";
    headerRow.insertBefore(th, headerRow.firstElementChild);
  }

  function enhanceEmptyRows() {
    document.querySelectorAll("#kitsTableBody .table-empty").forEach(cell => {
      const current = Number(cell.getAttribute("colspan") || 7);
      if (current < 8) {
        cell.setAttribute("colspan", "8");
      }
    });
  }

  function enhanceRows() {
    if (!els.kitsTableBody) return;

    ensureBulkPanel();
    ensureHeaderColumn();
    enhanceEmptyRows();

    Array.from(els.kitsTableBody.querySelectorAll("tr")).forEach(row => {
      if (row.classList.contains("kit-bulk-enhanced")) return;

      const deleteBtn = row.querySelector(".btn-delete-kit[data-partid]");
      if (!deleteBtn) return;

      const partId = String(deleteBtn.getAttribute("data-partid") || "").trim();
      if (!partId) return;

      const td = document.createElement("td");
      td.className = "kit-bulk-cell";
      td.innerHTML = `
        <input
          type="checkbox"
          class="kit-bulk-checkbox"
          data-partid="${escapeHtml(partId)}"
          aria-label="Sélectionner ${escapeHtml(partId)}">
      `;

      row.insertBefore(td, row.firstElementChild);
      row.classList.add("kit-bulk-enhanced");

      td.querySelector("input").addEventListener("change", updateBulkCount);
    });

    updateBulkCount();
  }

  async function deleteSelectedKits() {
    const selectedPartIds = getSelectedPartIds();
    const visiblePartIds = getVisiblePartIds();
    const searchTerm = getCurrentSearchTerm();

    if (!selectedPartIds.length) {
      setBulkMessage("Aucun kit sélectionné.", "danger");
      return;
    }

    if (!searchTerm) {
      const continueWithoutFilter = window.confirm(
        `Aucun filtre n'est actif. Vous avez sélectionné ${selectedPartIds.length} kit(s).\n\nContinuer quand même ?`
      );
      if (!continueWithoutFilter) return;
    }

    const preview = selectedPartIds.slice(0, 10).map(x => `- ${x}`).join("\n");
    const extra = selectedPartIds.length > 10 ? `\n... et ${selectedPartIds.length - 10} autre(s)` : "";

    const ok = window.confirm(
      `Vous allez supprimer ${selectedPartIds.length} kit(s) et tous leurs composants.\n\n` +
      `Filtre actuel : ${searchTerm || "aucun"}\n` +
      `Kits affichés : ${visiblePartIds.length}\n\n` +
      `${preview}${extra}\n\nCette action est irréversible. Continuer ?`
    );

    if (!ok) return;

    try {
      const button = document.getElementById("bulkDeleteSelectedKitsBtn");
      if (button) {
        button.disabled = true;
        button.textContent = "Suppression en cours...";
      }

      setBulkMessage("Suppression en cours...", "muted");

      const data = await fetchJson("/api/admin/kits/delete-selected", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          partIds: selectedPartIds,
          filter: searchTerm
        })
      });

      setBulkMessage(
        `<strong>${escapeHtml(data.message || "Suppression terminée")}</strong><br>` +
        `Demandés : ${data.summary?.requested ?? selectedPartIds.length} - ` +
        `Supprimés : ${data.summary?.deleted ?? "-"} - ` +
        `Introuvables : ${data.summary?.notFound ?? "-"} - ` +
        `Erreurs : ${data.summary?.errors ?? "-"}`,
        data.summary?.errors ? "danger" : "success"
      );

      if (typeof refreshAll === "function") {
        await refreshAll();
      } else {
        window.location.reload();
      }
    } catch (err) {
      setBulkMessage(`<strong>Erreur :</strong> ${escapeHtml(err.message)}`, "danger");
    } finally {
      const button = document.getElementById("bulkDeleteSelectedKitsBtn");
      if (button) {
        button.textContent = "Supprimer les kits sélectionnés";
      }
      updateBulkCount();
    }
  }

  function initBulkDelete() {
    if (!els.kitsTableBody) return;

    ensureBulkPanel();
    enhanceRows();

    const observer = new MutationObserver(() => {
      enhanceRows();
    });

    observer.observe(els.kitsTableBody, {
      childList: true,
      subtree: false
    });

    if (els.kitSearchInput) {
      els.kitSearchInput.addEventListener("input", () => {
        setTimeout(enhanceRows, 0);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBulkDelete);
  } else {
    initBulkDelete();
  }
})();