(function () {
  const CONFIG = window.PRESSERO_EXCEL_ORDERS_ADMIN_CONFIG || {};
  const API_BASE = CONFIG.apiBaseUrl || window.PRESSERO_EXCEL_ORDERS_API_BASE || "/api";
  const MOUNT = CONFIG.mountSelector || "#excel-orders-admin-app";

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function ce(tag, attrs = {}, html = "") {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") el.className = v;
      else if (k === "style") el.style.cssText = v;
      else el.setAttribute(k, v);
    });
    if (html) el.innerHTML = html;
    return el;
  }

  async function apiJson(url, options = {}) {
    const res = await fetch(API_BASE + url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        "Content-Type": "application/json"
      }
    });
    return res.json();
  }

  async function apiForm(url, formData) {
    const res = await fetch(API_BASE + url, {
      method: "POST",
      body: formData
    });
    return res.json();
  }

  function log(message, type = "info") {
    const box = qs("#eo-log-box");
    if (!box) return;
    const line = ce(
      "div",
      {
        style:
          "padding:8px 10px;border-bottom:1px solid #1f2937;font-size:12px;color:" +
          (type === "error" ? "#fca5a5" : type === "success" ? "#86efac" : "#d1d5db")
      },
      `[${new Date().toLocaleTimeString()}] ${message}`
    );
    box.prepend(line);
  }

  function injectStyles() {
  if (document.getElementById("eo-admin-styles")) return;

  const style = document.createElement("style");
  style.id = "eo-admin-styles";
  style.textContent = `
    :root{
      --brico-red:#d71920;
      --brico-red-dark:#b51218;
      --brico-yellow:#ffd200;
      --brico-yellow-soft:#fff3b3;
      --brico-gray-50:#f7f7f8;
      --brico-gray-100:#efeff1;
      --brico-gray-200:#e3e4e8;
      --brico-gray-300:#d2d5dc;
      --brico-gray-500:#6b7280;
      --brico-gray-700:#374151;
      --brico-gray-900:#111827;
      --shadow-soft:0 10px 30px rgba(17,24,39,.08);
      --radius-xl:22px;
      --radius-lg:16px;
      --radius-md:12px;
    }

    *{box-sizing:border-box}

    .eo-wrap{
      font-family:Arial,sans-serif;
      background:linear-gradient(180deg,#f5f6f8 0%,#eceef2 100%);
      color:var(--brico-gray-900);
      padding:24px;
      min-height:100vh;
    }

    .eo-spinner{
  display:inline-block;
  width:14px;
  height:14px;
  border:2px solid rgba(255,255,255,.45);
  border-top-color:#fff;
  border-radius:50%;
  animation:eoSpin .8s linear infinite;
  vertical-align:-2px;
  margin-right:6px;
}
.eo-btn.secondary .eo-spinner,
.eo-btn.yellow .eo-spinner{
  border:2px solid rgba(17,24,39,.25);
  border-top-color:#111827;
}
@keyframes eoSpin{
  to{ transform:rotate(360deg); }
}

    .eo-page-title{
      font-size:42px;
      font-weight:800;
      margin:0 0 8px;
      letter-spacing:-.02em;
    }

    .eo-page-subtitle{
      margin:0 0 24px;
      color:var(--brico-gray-500);
      font-size:15px;
      line-height:1.5;
      max-width:900px;
    }

    .eo-shell{
      display:grid;
      grid-template-columns:300px 1fr;
      gap:22px;
      align-items:start;
    }

    .eo-shell.sidebar-collapsed{
      grid-template-columns:88px 1fr;
    }

    .eo-sidebar{
      background:linear-gradient(180deg,#ffffff 0%,#f5f6f8 100%);
      border:1px solid var(--brico-gray-200);
      border-radius:28px;
      box-shadow:var(--shadow-soft);
      padding:18px;
      position:sticky;
      top:18px;
      overflow:hidden;
    }

    .eo-sidebar-top{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      margin-bottom:18px;
    }

    .eo-brand{
      display:flex;
      align-items:center;
      gap:12px;
      min-width:0;
    }

    .eo-brand-mark{
      width:42px;
      height:42px;
      border-radius:14px;
      background:linear-gradient(135deg,var(--brico-red) 0%, var(--brico-yellow) 100%);
      box-shadow:0 8px 22px rgba(215,25,32,.28);
      flex:0 0 auto;
    }

    .eo-brand-text{
      min-width:0;
    }

    .eo-brand-title{
      font-size:16px;
      font-weight:800;
      margin:0;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    .eo-brand-sub{
      margin:2px 0 0;
      font-size:12px;
      color:var(--brico-gray-500);
    }

    .eo-shell.sidebar-collapsed .eo-brand-text,
    .eo-shell.sidebar-collapsed .eo-nav-label,
    .eo-shell.sidebar-collapsed .eo-nav-section-title{
      display:none;
    }

    .eo-toggle{
      border:none;
      background:#fff;
      border:1px solid var(--brico-gray-200);
      color:var(--brico-gray-900);
      width:40px;
      height:40px;
      border-radius:12px;
      cursor:pointer;
      font-size:18px;
      font-weight:700;
      flex:0 0 auto;
    }

    .eo-nav{
      display:flex;
      flex-direction:column;
      gap:8px;
    }

    .eo-nav-section-title{
      font-size:11px;
      letter-spacing:.08em;
      text-transform:uppercase;
      color:var(--brico-gray-500);
      padding:10px 10px 4px;
      font-weight:700;
    }

    .eo-nav-btn{
      width:100%;
      border:none;
      background:transparent;
      color:var(--brico-gray-900);
      padding:14px 14px;
      border-radius:16px;
      display:flex;
      align-items:center;
      gap:12px;
      cursor:pointer;
      text-align:left;
      font-weight:700;
      transition:.18s ease;
      border:1px solid transparent;
    }

    .eo-nav-btn:hover{
      background:#fff;
      border-color:var(--brico-gray-200);
      transform:translateY(-1px);
    }

    .eo-nav-btn.active{
      background:linear-gradient(135deg,var(--brico-red) 0%, var(--brico-red-dark) 100%);
      color:#fff;
      box-shadow:0 12px 22px rgba(215,25,32,.20);
    }

    .eo-nav-icon{
      width:18px;
      text-align:center;
      font-size:16px;
      flex:0 0 18px;
    }

    .eo-main{
      min-width:0;
    }

    .eo-kpis{
      display:grid;
      grid-template-columns:repeat(4,1fr);
      gap:14px;
      margin-bottom:20px;
    }

    .eo-kpi{
      background:#fff;
      border:1px solid var(--brico-gray-200);
      border-radius:22px;
      box-shadow:var(--shadow-soft);
      padding:18px 20px;
      position:relative;
      overflow:hidden;
    }

    .eo-kpi::before{
      content:"";
      position:absolute;
      left:0;
      top:0;
      bottom:0;
      width:6px;
      background:linear-gradient(180deg,var(--brico-red),var(--brico-yellow));
    }

    .eo-kpi strong{
      display:block;
      font-size:34px;
      line-height:1;
      margin-bottom:8px;
      font-weight:800;
    }

    .eo-kpi span{
      color:var(--brico-gray-500);
      font-size:13px;
      font-weight:600;
    }

    .eo-view{
      display:none;
    }

    .eo-view.active{
      display:block;
    }

    .eo-card{
      background:rgba(255,255,255,.94);
      backdrop-filter:blur(4px);
      border:1px solid var(--brico-gray-200);
      border-radius:26px;
      box-shadow:var(--shadow-soft);
      padding:24px;
      margin-bottom:20px;
    }

    .eo-card h3{
      margin:0 0 18px;
      font-size:28px;
      line-height:1.1;
      font-weight:800;
      letter-spacing:-.02em;
    }

    .eo-card-sub{
      margin:-8px 0 18px;
      color:var(--brico-gray-500);
      font-size:14px;
    }

    .eo-file,
    .eo-field{
      width:100%;
      border:1px solid var(--brico-gray-300);
      background:#fff;
      border-radius:16px;
      padding:14px 16px;
      font-size:14px;
      outline:none;
    }

    .eo-file:focus,
    .eo-field:focus{
      border-color:var(--brico-red);
      box-shadow:0 0 0 4px rgba(215,25,32,.10);
    }

    .eo-row-2,
    .eo-row-3{
      display:grid;
      gap:12px;
      align-items:center;
    }

    .eo-row-2{
      grid-template-columns:1fr auto auto;
    }

    .eo-row-3{
      grid-template-columns:1fr 1fr 1fr auto;
    }

    .eo-btn{
      border:none;
      padding:14px 18px;
      border-radius:16px;
      cursor:pointer;
      font-weight:800;
      font-size:14px;
      transition:.18s ease;
      white-space:nowrap;
    }

    .eo-btn:hover{
      transform:translateY(-1px);
    }

    .eo-btn.primary{
      background:linear-gradient(135deg,var(--brico-red) 0%, var(--brico-red-dark) 100%);
      color:#fff;
      box-shadow:0 12px 22px rgba(215,25,32,.20);
    }

    .eo-btn.secondary{
      background:#fff;
      color:var(--brico-gray-900);
      border:1px solid var(--brico-gray-300);
    }

    .eo-btn.yellow{
      background:linear-gradient(135deg,#ffe26a 0%, var(--brico-yellow) 100%);
      color:#111827;
      box-shadow:0 12px 22px rgba(255,210,0,.20);
    }

    .eo-btn.green{
      background:linear-gradient(135deg,#16a34a 0%, #15803d 100%);
      color:#fff;
      box-shadow:0 12px 22px rgba(22,163,74,.18);
    }

    .eo-actions{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
    }

    .eo-table-wrap{
      overflow:auto;
      border:1px solid var(--brico-gray-200);
      border-radius:18px;
      background:#fff;
    }

    .eo-table{
      width:100%;
      border-collapse:collapse;
      min-width:760px;
    }

    .eo-table th,
    .eo-table td{
      padding:14px 14px;
      border-bottom:1px solid var(--brico-gray-100);
      text-align:left;
      vertical-align:top;
      font-size:13px;
    }

    .eo-table th{
      background:#fafafa;
      color:var(--brico-gray-700);
      font-weight:800;
      position:sticky;
      top:0;
      z-index:1;
    }

    .eo-table tr:hover td{
      background:#fcfcfd;
    }

    .eo-nav-btn,
.eo-toggle,
.eo-btn{
  appearance:none;
}

    .eo-badge{
      display:inline-flex;
      align-items:center;
      padding:6px 10px;
      border-radius:999px;
      font-size:12px;
      font-weight:800;
    }

    .eo-ready{background:#eef2f7;color:#334155}
    .eo-sent{background:#dcfce7;color:#166534}
    .eo-failed{background:#fee2e2;color:#991b1b}
    .eo-processing{background:#fff3cd;color:#92400e}
    .eo-pending{background:#e5e7eb;color:#374151}
    .eo-ok{background:#dcfce7;color:#166534}

    .eo-two-col{
      display:grid;
      grid-template-columns:1.2fr .8fr;
      gap:20px;
    }

    .eo-log{
      background:#0b1220;
      border-radius:18px;
      border:1px solid #111827;
      min-height:420px;
      max-height:420px;
      overflow:auto;
    }

    @media (max-width: 1200px){
      .eo-kpis{grid-template-columns:repeat(2,1fr)}
      .eo-two-col{grid-template-columns:1fr}
    }

    @media (max-width: 980px){
      .eo-shell,
      .eo-shell.sidebar-collapsed{
        grid-template-columns:1fr;
      }
      .eo-sidebar{
        position:static;
      }
      .eo-row-2,
      .eo-row-3{
        grid-template-columns:1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

function toggleSidebar() {
  const shell = document.querySelector(".eo-shell");
  if (!shell) return;
  shell.classList.toggle("sidebar-collapsed");
}

  function showView(viewId) {
  document.querySelectorAll(".eo-view").forEach((v) => {
    v.classList.remove("active");
  });

  document.querySelectorAll(".eo-nav-btn").forEach((b) => {
    b.classList.remove("active");
  });

  const view = document.querySelector(`[data-view="${viewId}"]`);
  const btn = document.querySelector(`[data-nav="${viewId}"]`);

  if (view) view.classList.add("active");
  if (btn) btn.classList.add("active");
}

  function statusBadge(status) {
    const s = String(status || "").toUpperCase();
    const cls =
      s === "SENT" ? "eo-sent" :
      s === "FAILED" ? "eo-failed" :
      s === "PROCESSING" ? "eo-processing" :
      "eo-ready";
    return `<span class="eo-badge ${cls}">${s || "N/A"}</span>`;
  }

  async function loadStores() {
    const data = await apiJson("/stores");
    const tbody = qs("#eo-stores-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    (data.stores || []).forEach((s) => {
      const tr = ce("tr");
      tr.innerHTML = `
        <td>${s.store_code || ""}</td>
        <td>${s.store_name || ""}</td>
        <td>${s.presso_user_email || ""}</td>
        <td>${statusBadge(s.sync_status)}</td>
        <td>${s.last_synced_at || ""}</td>
      `;
      tbody.appendChild(tr);
    });

    qs("#kpi-stores").textContent = (data.stores || []).length;
  }

  async function loadImports() {
    const data = await apiJson("/backoffice/imports");
    const tbody = qs("#eo-imports-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    const imports = data.imports || [];
    qs("#kpi-imports").textContent = imports.length;

    imports.forEach((i) => {
      const tr = ce("tr");
      tr.innerHTML = `
        <td>${i.id}</td>
        <td>${i.original_filename || ""}</td>
        <td>${statusBadge(i.status)}</td>
        <td>${i.total_rows || 0}</td>
        <td>${i.valid_rows || 0}</td>
        <td>${i.error_rows || 0}</td>
        <td class="eo-actions">
          <button class="eo-btn secondary" data-action="lines" data-id="${i.id}">Voir lignes</button>
          <button class="eo-btn yellow" data-action="build" data-id="${i.id}">Préparer</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("button[data-action='lines']").forEach((btn) => {
  btn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await loadImportLines(btn.dataset.id);
    showView("detail-panel");
  };
});

tbody.querySelectorAll("button[data-action='build']").forEach((btn) => {
  btn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(btn, true, "Préparation...");
    try {
      await buildImport(btn.dataset.id);
    } finally {
      setBusy(btn, false);
    }
  };
});
  }

  
  async function loadImportLines(importId) {
    const data = await apiJson(`/backoffice/imports/${importId}/lines`);
    const box = qs("#eo-detail-box");
    box.innerHTML = `<h4 style="margin:0 0 12px">Lignes import ${importId}</h4>`;

    const table = ce("table", { class: "eo-table" });
    table.innerHTML = `
      <thead>
        <tr>
          <th>Ligne</th>
          <th>Store</th>
          <th>Type</th>
          <th>Référence</th>
          <th>Qté</th>
          <th>Status</th>
          <th>Message</th>
        </tr>
      </thead>
      <tbody>
        ${(data.lines || []).map((l) => `
          <tr>
            <td>${l.row_number}</td>
            <td>${l.store_code || ""}</td>
            <td>${l.line_type || ""}</td>
            <td>${l.item_ref || ""}</td>
            <td>${l.quantity_q1 || ""}</td>
            <td>${statusBadge(l.status)}</td>
            <td>${l.message || ""}</td>
          </tr>
        `).join("")}
      </tbody>
    `;
    box.appendChild(table);
  }

  async function buildImport(importId) {
    const res = await apiJson(`/orders/build-from-import/${importId}`, { method: "POST" });
    log(`Préparation import ${importId}: ${JSON.stringify(res)}`, res.success ? "success" : "error");
    await loadBatches();
  }

  async function loadBatches() {
    const data = await apiJson("/backoffice/batches");
    const tbody = qs("#eo-batches-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    const batches = data.batches || [];
    qs("#kpi-batches").textContent = batches.length;
    qs("#kpi-ready").textContent = batches.filter(b => b.status === "READY").length;

    batches.forEach((b) => {
      const tr = ce("tr");
      tr.innerHTML = `
  <td>${b.id}</td>
  <td>${b.import_id || ""}</td>
  <td>${b.store_code || ""}</td>
  <td>${statusBadge(b.status)}</td>
  <td>${b.total_lines || 0}</td>
  <td>${Number(b.need_to_apply_approvals) === 1 ? "Oui" : "Non"}</td>
  <td>${b.presso_order_number || ""}</td>
  <td>${b.executed_at || ""}</td>
  <td>${b.message || ""}</td>
  <td class="eo-actions">
  <button class="eo-btn secondary" data-action="items" data-id="${b.id}">Voir items</button>
  ${
    b.presso_order_number || String(b.status || "").toUpperCase() === "SENT"
      ? `<button class="eo-btn secondary" disabled>Déjà envoyée</button>`
      : `<button class="eo-btn green" data-action="send" data-id="${b.id}">Envoyer</button>`
  }
</td>
`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("button[data-action='items']").forEach((btn) => {
  btn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await loadBatchItems(btn.dataset.id);
    showView("detail-panel");
  };
});

tbody.querySelectorAll("button[data-action='send']").forEach((btn) => {
  btn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(btn, true, "Envoi...");
    try {
      await sendBatch(btn.dataset.id);
    } finally {
      setBusy(btn, false);
    }
  };
});
  }

  async function loadBatchItems(batchId) {
    const data = await apiJson(`/backoffice/batches/${batchId}/items`);
    const box = qs("#eo-detail-box");
    box.innerHTML = `<h4 style="margin:0 0 12px">Items batch ${batchId}</h4>`;

    const table = ce("table", { class: "eo-table" });
    table.innerHTML = `
      <thead>
        <tr>
          <th>Source</th>
          <th>Produit</th>
          <th>Q1</th>
          <th>Q2</th>
          <th>Q3</th>
          <th>Q4</th>
          <th>Prix</th>
          <th>TVA</th>
          <th>Shipping</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${(data.items || []).map((i) => `
          <tr>
            <td>${i.source_ref || ""}</td>
            <td>${i.product_name || ""}</td>
            <td>${i.q1 || ""}</td>
            <td>${i.q2 || ""}</td>
            <td>${i.q3 || ""}</td>
            <td>${i.q4 || ""}</td>
            <td>${i.price ?? ""}</td>
            <td>${i.tax ?? ""}</td>
            <td>${i.shipping ?? ""}</td>
            <td>${statusBadge(i.status)}</td>
          </tr>
        `).join("")}
      </tbody>
    `;
    box.appendChild(table);
  }

  async function sendBatch(batchId) {
    const res = await apiJson(`/orders/submit-batch/${batchId}`, { method: "POST" });
    log(`Batch ${batchId}: ${JSON.stringify(res)}`, res.success ? "success" : "error");
    await loadBatches();
  }

  async function cleanupOrders() {
  const confirmed = window.confirm(
    "Voulez-vous vraiment supprimer tout l’historique des imports et batches de commandes ?"
  );

  if (!confirmed) return;

  const res = await apiJson("/backoffice/cleanup-orders", {
    method: "POST"
  });

  log(
    `Nettoyage commandes: ${JSON.stringify(res)}`,
    res.success ? "success" : "error"
  );

  await loadImports();
  await loadBatches();

  const box = qs("#eo-detail-box");
  if (box) {
    box.innerHTML = "Historique des commandes nettoyé.";
  }
}

  async function importStoresMaster(file) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await apiForm("/stores/import", fd);
    log(`Import magasins: ${JSON.stringify(res)}`, res.success ? "success" : "error");
renderStoreImportResults(res, "import");
await loadStores();
  }

  async function syncAllStores() {
    const res = await apiJson("/stores/sync-all", { method: "POST" });
    log(`Sync magasins: ${JSON.stringify(res)}`, res.success ? "success" : "error");
renderStoreImportResults(res, "sync");
await loadStores();
  }

  async function uploadOrdersExcel(file) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await apiForm("/imports/preview", fd);
    log(`Import commandes: ${JSON.stringify(res)}`, res.success ? "success" : "error");
    await loadImports();
  }

  function setBusy(button, busy, busyText = "Traitement...") {
  if (!button) return;

  if (busy) {
    button.dataset.originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="eo-spinner"></span> ${busyText}`;
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.originalText || button.innerHTML;
  }
}

  function exportStoresMaster() {
  window.open(`${API_BASE}/stores/export`, "_blank");
}

function downloadOrdersTemplate() {
  window.open(`${API_BASE}/imports/template`, "_blank");
}

async function sendAllReady(button) {
  setBusy(button, true, "Envoi...");
  try {
    const res = await apiJson("/backoffice/submit-all-ready", { method: "POST" });
    log(`Envoi global: ${JSON.stringify(res)}`, res.success ? "success" : "error");
    await loadBatches();
    showView("batches-panel");
  } finally {
    setBusy(button, false);
  }
}

async function buildAllImports(button) {
  const data = await apiJson("/backoffice/imports");
  const imports = (data.imports || []).filter((x) => String(x.status).toUpperCase() === "PREVIEWED");

  if (!imports.length) {
    log("Aucun import PREVIEWED à préparer.", "info");
    return;
  }

  setBusy(button, true, "Préparation...");
  try {
    for (const imp of imports) {
      const res = await apiJson(`/orders/build-from-import/${imp.id}`, { method: "POST" });
      log(`Préparation import ${imp.id}: ${JSON.stringify(res)}`, res.success ? "success" : "error");
    }

    await loadImports();
    await loadBatches();
    showView("batches-panel");
  } finally {
    setBusy(button, false);
  }
}

function renderStoreImportResults(res, mode) {
  const box = qs("#eo-store-results-box");
  if (!box) return;

  if (!res) {
    box.innerHTML = "Aucun résultat.";
    return;
  }

  const items =
    mode === "import"
      ? (res.details || [])
      : (res.results || []);

  const summaryHtml = mode === "import"
    ? `
      <div class="eo-actions" style="margin-bottom:12px">
        <span class="eo-badge eo-ok">Créés: ${res.created || 0}</span>
        <span class="eo-badge eo-ready">Mis à jour: ${res.updated || 0}</span>
        <span class="eo-badge eo-failed">Erreurs: ${res.errors || 0}</span>
        <span class="eo-badge eo-processing">Total: ${res.total || 0}</span>
      </div>
    `
    : `
      <div class="eo-actions" style="margin-bottom:12px">
        <span class="eo-badge eo-ok">OK: ${res.ok || 0}</span>
        <span class="eo-badge eo-failed">Échecs: ${res.failed || 0}</span>
        <span class="eo-badge eo-processing">Total: ${res.total || 0}</span>
      </div>
    `;

  const rowsHtml = items.map((x) => {
    if (mode === "import") {
      return `
        <tr>
          <td>${x.rowNumber ?? ""}</td>
          <td>${x.storeCode || ""}</td>
          <td>${statusBadge(x.status)}</td>
          <td>${x.message || ""}</td>
        </tr>
      `;
    }

    return `
      <tr>
        <td>${x.storeCode || ""}</td>
        <td>${statusBadge(x.status)}</td>
        <td>${x.message || ""}</td>
      </tr>
    `;
  }).join("");

  box.innerHTML = `
    ${summaryHtml}
    <div class="eo-table-wrap">
      <table class="eo-table">
        <thead>
          <tr>
            ${mode === "import" ? "<th>Ligne</th>" : ""}
            <th>Store</th>
            <th>Statut</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="${mode === "import" ? 4 : 3}">Aucune donnée.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

  function render() {
    injectStyles();

    const root = qs(MOUNT);
    if (!root) return;

    root.innerHTML = `
  <div class="eo-wrap">
    <h1 class="eo-page-title">Commandes multi-magasins par Excel</h1>
    <p class="eo-page-subtitle">
      Importez vos magasins, synchronisez Pressero, puis chargez un fichier Excel pour préparer, contrôler et envoyer des commandes en masse.
    </p>

    <div class="eo-shell">
      <aside class="eo-sidebar">
        <div class="eo-sidebar-top">
          <div class="eo-brand">
            <div class="eo-brand-mark"></div>
            <div class="eo-brand-text">
              <p class="eo-brand-title">Back-office commandes</p>
              <p class="eo-brand-sub">BRICO Belgique</p>
            </div>
          </div>
          <button type="button" class="eo-toggle" id="eo-toggle-sidebar">☰</button>
        </div>

        <div class="eo-nav">
          <div class="eo-nav-section-title">Menu</div>

          <button type="button" class="eo-nav-btn active" data-nav="orders-import">
            <span class="eo-nav-icon">📥</span>
            <span class="eo-nav-label">Importer des commandes</span>
          </button>

          <button type="button" class="eo-nav-btn" data-nav="stores-master">
            <span class="eo-nav-icon">🏬</span>
            <span class="eo-nav-label">Référentiel magasins</span>
          </button>

          <button type="button" class="eo-nav-btn" data-nav="imports-history">
            <span class="eo-nav-icon">🧾</span>
            <span class="eo-nav-label">Historique des imports</span>
          </button>

          <button type="button" class="eo-nav-btn" data-nav="batches-panel">
            <span class="eo-nav-icon">📦</span>
            <span class="eo-nav-label">Commandes prêtes à envoyer</span>
          </button>

          <button type="button" class="eo-nav-btn" data-nav="detail-panel">
            <span class="eo-nav-icon">📝</span>
            <span class="eo-nav-label">Détails & journal</span>
          </button>
        </div>
      </aside>

      <main class="eo-main">
        <div class="eo-kpis">
          <div class="eo-kpi"><strong id="kpi-stores">0</strong><span>Magasins</span></div>
          <div class="eo-kpi"><strong id="kpi-imports">0</strong><span>Imports</span></div>
          <div class="eo-kpi"><strong id="kpi-batches">0</strong><span>Commandes préparées</span></div>
          <div class="eo-kpi"><strong id="kpi-ready">0</strong><span>Prêtes à envoyer</span></div>
        </div>

        <section class="eo-view active" data-view="orders-import">
          <div class="eo-card">
            <h3>Importer des commandes</h3>
            <p class="eo-card-sub">Chargez un fichier Excel multi-magasins pour analyser les lignes avant préparation des commandes.</p>
            <div class="eo-row-2">
  <input type="file" id="eo-orders-file" class="eo-file" />
  <button type="button" class="eo-btn primary" id="eo-btn-import-orders">Importer les commandes</button>
  <button type="button" class="eo-btn secondary" id="eo-btn-refresh-imports">Rafraîchir</button>
</div>

<div class="eo-actions" style="margin-top:12px">
  <button type="button" class="eo-btn yellow" id="eo-btn-template-orders">Télécharger le modèle commandes</button>
</div>
          </div>
        </section>

        <section class="eo-view" data-view="stores-master">
          <div class="eo-card">
            <h3>Référentiel magasins</h3>
            <p class="eo-card-sub">Importez la liste maîtresse des magasins, puis enrichissez-la automatiquement avec les données Pressero.</p>

<div class="eo-row-2">
  <input type="file" id="eo-stores-file" class="eo-file" />
  <button type="button" class="eo-btn primary" id="eo-btn-import-stores">Importer les magasins</button>
  <button type="button" class="eo-btn green" id="eo-btn-sync-stores">Synchroniser tous les magasins</button>
</div>

<div class="eo-actions" style="margin-top:12px">
  <button type="button" class="eo-btn secondary" id="eo-btn-export-stores">Exporter les magasins</button>
</div>

            <div class="eo-section eo-table-wrap" style="margin-top:18px">
              <table class="eo-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Nom</th>
                    <th>Email Pressero</th>
                    <th>Statut</th>
                    <th>Dernière sync</th>
                  </tr>
                </thead>
                <tbody id="eo-stores-body"></tbody>
              </table>
            </div>
          </div>
          <div class="eo-card" style="margin-top:20px">
  <h3>Résultats d’import et de synchronisation</h3>
  <p class="eo-card-sub">Derniers messages d’erreur ou d’avancement sur les magasins.</p>
  <div id="eo-store-results-box" style="min-height:180px;color:#374151">
    Aucun résultat pour le moment.
  </div>
</div>
                  </section>

        <section class="eo-view" data-view="imports-history">
          <div class="eo-card">
            <h3>Historique des imports</h3>
            <p class="eo-card-sub">Contrôlez les imports chargés, consultez les lignes détectées et préparez les commandes.</p>
<div class="eo-actions" style="margin-bottom:14px">
  <button type="button" class="eo-btn yellow" id="eo-btn-build-all-imports">Tout préparer</button>
</div>
            <div class="eo-table-wrap">
              <table class="eo-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Fichier</th>
                    <th>Statut</th>
                    <th>Total</th>
                    <th>Valides</th>
                    <th>Erreurs</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="eo-imports-body"></tbody>
              </table>
            </div>
          </div>
        </section>

        <section class="eo-view" data-view="batches-panel">
          <div class="eo-card">
            <h3>Commandes prêtes à envoyer</h3>
            <p class="eo-card-sub">Vérifiez les commandes préparées, puis envoyez-les vers Pressero.</p>

            <div class="eo-actions" style="margin-bottom:14px">
              <button class="eo-btn secondary" id="eo-btn-refresh-batches">Rafraîchir</button>
              <button class="eo-btn yellow" id="eo-btn-cleanup-orders">Vider les tests commandes</button>
              <button type="button" class="eo-btn green" id="eo-btn-send-all-ready">Tout envoyer</button>
            </div>

            <div class="eo-table-wrap">
              <table class="eo-table">
                <thead>
  <tr>
    <th>ID</th>
    <th>Import</th>
    <th>Store</th>
    <th>Statut</th>
    <th>Lignes</th>
    <th>Approbation</th>
    <th>N° commande</th>
    <th>Envoyé le</th>
    <th>Message</th>
    <th>Actions</th>
  </tr>
</thead>
                <tbody id="eo-batches-body"></tbody>
              </table>
            </div>
          </div>
        </section>

        <section class="eo-view" data-view="detail-panel">
  <div class="eo-card">
    <h3>Détail</h3>
    <p class="eo-card-sub">Sélectionnez un import ou une commande préparée pour afficher son contenu détaillé.</p>
    <div id="eo-detail-box" style="min-height:320px;color:#374151">
      Sélectionnez un import ou une commande préparée pour voir le détail.
    </div>
  </div>

  <div class="eo-card">
    <h3>Journal</h3>
    <p class="eo-card-sub">Historique des dernières actions effectuées depuis l’interface.</p>
    <div id="eo-log-box" class="eo-log"></div>
  </div>
</section>
      </main>
    </div>
  </div>
`;

    

    qs("#eo-btn-send-all-ready").onclick = async (e) => {
  e.preventDefault();
  e.stopPropagation();
  await sendAllReady(e.currentTarget);
};

qs("#eo-btn-import-stores").onclick = async (e) => {
  e.preventDefault();
  e.stopPropagation();
  const btn = e.currentTarget;
  const file = qs("#eo-stores-file").files[0];
  if (!file) return log("Sélectionnez un fichier magasins", "error");

  setBusy(btn, true, "Import...");
  try {
    await importStoresMaster(file);
  } finally {
    setBusy(btn, false);
  }
};

qs("#eo-btn-sync-stores").onclick = async (e) => {
  e.preventDefault();
  e.stopPropagation();
  const btn = e.currentTarget;

  setBusy(btn, true, "Sync...");
  try {
    await syncAllStores();
  } finally {
    setBusy(btn, false);
  }
};

qs("#eo-btn-import-orders").onclick = async (e) => {
  e.preventDefault();
  e.stopPropagation();
  const btn = e.currentTarget;
  const file = qs("#eo-orders-file").files[0];
  if (!file) return log("Sélectionnez un fichier commandes", "error");

  setBusy(btn, true, "Import...");
  try {
    await uploadOrdersExcel(file);
  } finally {
    setBusy(btn, false);
  }
};

    

    qs("#eo-btn-template-orders").onclick = (e) => {
  e.preventDefault();
  e.stopPropagation();
  downloadOrdersTemplate();
};

    qs("#eo-btn-export-stores").onclick = (e) => {
  e.preventDefault();
  e.stopPropagation();
  exportStoresMaster();
};

qs("#eo-btn-build-all-imports").onclick = async (e) => {
  e.preventDefault();
  e.stopPropagation();
  await buildAllImports(e.currentTarget);
};

    qs("#eo-btn-refresh-imports").onclick = loadImports;
    qs("#eo-btn-refresh-batches").onclick = loadBatches;
    qs("#eo-btn-cleanup-orders").onclick = cleanupOrders;
    qs("#eo-toggle-sidebar").onclick = (e) => {
  e.preventDefault();
  e.stopPropagation();
  toggleSidebar();
};

    document.querySelectorAll(".eo-nav-btn").forEach((btn) => {
  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    showView(btn.dataset.nav);
  };
});

    loadStores();
    loadImports();
    loadBatches();
  }

  document.addEventListener("DOMContentLoaded", render);
})();