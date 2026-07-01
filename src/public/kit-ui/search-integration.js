(function () {
  function findCurrentScript() {
    if (document.currentScript) return document.currentScript;

    const scripts = document.getElementsByTagName("script");
    for (let i = scripts.length - 1; i >= 0; i--) {
      const src = scripts[i].src || "";
      if (
        src.indexOf("/kit-search-integration.js") !== -1 ||
        src.indexOf("/kit-ui-assets/search-integration.js") !== -1
      ) {
        return scripts[i];
      }
    }

    return null;
  }

  function attr(script, name) {
    return script ? (script.getAttribute(name) || "").trim() : "";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getBaseUrl(script, config) {
    if (config.apiBaseUrl) return String(config.apiBaseUrl).replace(/\/$/, "");

    const src = script ? (script.src || "") : "";
    if (!src) return window.location.origin;

    return src
      .replace(/\/kit-search-integration\.js(?:\?.*)?$/, "")
      .replace(/\/kit-ui-assets\/search-integration\.js(?:\?.*)?$/, "")
      .replace(/\/$/, "");
  }

  function getSearchText(config) {
    if (config.searchText) return String(config.searchText).trim();

    const params = new URLSearchParams(window.location.search);
    const fromUrl =
      params.get("text") ||
      params.get("q") ||
      params.get("query") ||
      params.get("search") ||
      "";

    if (fromUrl.trim()) return fromUrl.trim();

    const searchInput = document.querySelector('input[type="search"], input[name="text"], input[name="q"], input[name="search"]');
    return searchInput ? String(searchInput.value || "").trim() : "";
  }

  function getEmailFromPage(script, config) {
    const configuredEmail =
      attr(script, "data-user-email") ||
      config.email ||
      "";

    if (configuredEmail && configuredEmail.indexOf("@") !== -1) {
      return configuredEmail.trim();
    }

    const directEmailNode = document.querySelector("[data-user-email]");
    if (directEmailNode) {
      const value =
        directEmailNode.getAttribute("data-user-email") ||
        directEmailNode.textContent ||
        "";
      if (value.indexOf("@") !== -1) return value.trim();
    }

    const correo = document.querySelector("#correo");
    if (correo) {
      const txt = (correo.textContent || "").trim();
      if (txt.indexOf("@") !== -1) return txt;
    }

    const emailLink = document.querySelector('a[href^="mailto:"]');
    if (emailLink) {
      const href = emailLink.getAttribute("href") || "";
      const email = href.replace(/^mailto:/i, "").trim();
      if (email.indexOf("@") !== -1) return email;
    }

    return "";
  }

  function injectStyles() {
    if (document.getElementById("kit-search-integration-styles")) return;

    const style = document.createElement("style");
    style.id = "kit-search-integration-styles";
    style.textContent = `
      .kit-search-results-panel{
        margin:24px 0;
        padding:22px;
        border:1px solid #d8dee6;
        border-radius:22px;
        background:#ffffff;
        box-shadow:0 14px 34px rgba(17,24,39,.08);
        font-family:Inter,Segoe UI,Arial,sans-serif;
        color:#111827;
      }
      .searchPage-search-form + .kit-search-results-panel{
        margin-top:22px;
        margin-bottom:26px;
      }
      .kit-search-results-header{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:16px;
        margin-bottom:16px;
      }
      .kit-search-results-title{
        margin:0;
        font-size:24px;
        line-height:1.1;
        font-weight:800;
        letter-spacing:-.03em;
      }
      .kit-search-results-count{
        color:#6b7280;
        font-size:13px;
        font-weight:700;
        white-space:nowrap;
      }
      .kit-search-results-grid{
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
        gap:14px;
      }
      .kit-search-result-card{
        border:1px solid #e5e7eb;
        border-radius:18px;
        padding:16px;
        background:#f9fafb;
      }
      .kit-search-result-title{
        font-size:16px;
        font-weight:800;
        line-height:1.25;
        margin-bottom:10px;
      }
      .kit-search-result-meta{
        display:grid;
        gap:4px;
        color:#4b5563;
        font-size:12px;
        line-height:1.35;
        margin-bottom:12px;
      }
      .kit-search-lang-list{
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        margin:10px 0 12px;
      }
      .kit-search-lang-badge{
        display:inline-flex;
        align-items:center;
        border:1px solid #d1d5db;
        border-radius:999px;
        padding:4px 8px;
        background:#fff;
        color:#111827;
        font-size:11px;
        font-weight:800;
      }
      .kit-search-matches{
        margin:10px 0 12px;
        padding:10px;
        background:#fff;
        border:1px dashed #d1d5db;
        border-radius:14px;
        color:#4b5563;
        font-size:12px;
        line-height:1.45;
      }
      .kit-search-matches strong{
        color:#111827;
      }
      .kit-search-open-btn{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:42px;
        padding:0 16px;
        border:none;
        border-radius:14px;
        background:#e30613;
        color:#fff !important;
        text-decoration:none !important;
        font-size:13px;
        font-weight:800;
        cursor:pointer;
      }
      .kit-search-open-btn:hover{
        background:#c90512;
      }
      @media(max-width:640px){
        .kit-search-results-panel{padding:16px;border-radius:18px;}
        .kit-search-results-header{display:block;}
        .kit-search-results-count{display:block;margin-top:8px;}
      }
    `;
    document.head.appendChild(style);
  }

  function findNativeSearchForm() {
    return (
      document.querySelector(".searchPage-search-form") ||
      document.querySelector(".searchpage-search-form") ||
      document.querySelector('form[action*="/search"]') ||
      document.querySelector('form[action*="search"]')
    );
  }

  function findMountElement(config) {
    if (config.mountSelector) {
      const configured = document.querySelector(config.mountSelector);
      if (configured) return configured;
    }

    const selectors = [
      "#kitSearchResultsMount",
      "#searchResults",
      ".search-results",
      ".search-results-page",
      ".pressero-search-results",
      ".product-list",
      ".products-list",
      "[data-product-list]",
      "main",
      ".page-content",
      "#mainContent",
      "#content"
    ];

    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (node) return node;
    }

    return document.body;
  }

  function getOrCreatePanel(config) {
    let panel = document.getElementById("kitSearchResultsPanel");
    if (panel) return panel;

    panel = document.createElement("section");
    panel.id = "kitSearchResultsPanel";
    panel.className = "kit-search-results-panel";

    const hasExplicitMount = Boolean(config.mountSelector);
    const nativeSearchForm = hasExplicitMount ? null : findNativeSearchForm();

    if (nativeSearchForm && nativeSearchForm.parentNode) {
      nativeSearchForm.parentNode.insertBefore(panel, nativeSearchForm.nextSibling);
      return panel;
    }

    const mount = findMountElement(config);
    const mode = config.insertMode || "before";

    if (mode === "inside") {
      mount.appendChild(panel);
    } else if (mode === "after" && mount.parentNode) {
      mount.parentNode.insertBefore(panel, mount.nextSibling);
    } else if (mount.parentNode && mount !== document.body) {
      mount.parentNode.insertBefore(panel, mount);
    } else {
      mount.insertBefore(panel, mount.firstChild || null);
    }

    return panel;
  }

  function looksLikeNativeNoResultsAlert(node) {
    const text = String(node.textContent || "").trim().toLowerCase();

    if (!text) return false;

    return (
      text.includes("aucune information") ||
      text.includes("aucun résultat") ||
      (text.includes("aucune") && text.includes("recherche")) ||
      text.includes("no information") ||
      text.includes("no result") ||
      (text.includes("geen") && text.includes("gevonden"))
    );
  }

  function setNativeNoResultsAlertHidden(hidden) {
    const alerts = Array.from(document.querySelectorAll(
      ".searchPage .alert.alert-danger, .searchPage .alert-danger, .page-content .alert.alert-danger, p.alert.alert-danger, .alert.alert-danger"
    ));

    alerts.forEach((alert) => {
      if (!looksLikeNativeNoResultsAlert(alert)) return;

      if (hidden) {
        if (!alert.hasAttribute("data-kit-search-original-display")) {
          alert.setAttribute("data-kit-search-original-display", alert.style.display || "");
        }

        alert.setAttribute("data-kit-search-hidden", "1");
        alert.style.display = "none";
      } else if (alert.getAttribute("data-kit-search-hidden") === "1") {
        alert.style.display = alert.getAttribute("data-kit-search-original-display") || "";
        alert.removeAttribute("data-kit-search-hidden");
      }
    });
  }

  function buildKitUrl(kit, config, baseUrl, email) {
    const partId = kit.part_id || "";

    if (config.kitPageUrl) {
      const url = new URL(config.kitPageUrl, window.location.origin);
      url.searchParams.set("partId", partId);
      return url.toString();
    }

    const url = new URL(baseUrl + "/kit-ui");
    url.searchParams.set("email", email);
    url.searchParams.set("apiBase", baseUrl);
    url.searchParams.set("partId", partId);
    return url.toString();
  }

  function renderKits(kits, config, baseUrl, email, query) {
    const hasKitResults = kits.length > 0;

    setNativeNoResultsAlertHidden(hasKitResults);
    setTimeout(() => setNativeNoResultsAlertHidden(hasKitResults), 150);

    if (!hasKitResults) {
      const existingPanel = document.getElementById("kitSearchResultsPanel");
      if (existingPanel) existingPanel.remove();
      return;
    }

    const panel = getOrCreatePanel(config);
    const maxResults = Number(config.maxResults || 8);
    const visibleKits = kits.slice(0, maxResults);
    const title = config.title || "Kits correspondant à votre recherche";
    const countLabel = kits.length > 1 ? `${kits.length} kits trouvés` : "1 kit trouvé";

    panel.innerHTML = `
      <div class="kit-search-results-header">
        <h2 class="kit-search-results-title">${escapeHtml(title)}</h2>
        <div class="kit-search-results-count">${escapeHtml(countLabel)}</div>
      </div>
      <div class="kit-search-results-grid">
        ${visibleKits.map((kit) => {
          const url = buildKitUrl(kit, config, baseUrl, email);
          const langs = Array.isArray(kit.availableLangs) ? kit.availableLangs : [];
          const matches = Array.isArray(kit.matchedComponents) ? kit.matchedComponents : [];

          return `
            <article class="kit-search-result-card">
              <div class="kit-search-result-title">${escapeHtml(kit.kit_name || kit.part_id)}</div>
              <div class="kit-search-result-meta">
                <div><strong>PartID :</strong> ${escapeHtml(kit.part_id)}</div>
                <div><strong>Composants visibles :</strong> ${Number(kit.visibleComponentCount || 0)}</div>
              </div>
              ${langs.length ? `
                <div class="kit-search-lang-list">
                  ${langs.map((lang) => `<span class="kit-search-lang-badge">${escapeHtml(lang)}</span>`).join("")}
                </div>
              ` : ""}
              ${matches.length ? `
                <div class="kit-search-matches">
                  <strong>Composants trouvés :</strong><br>
                  ${matches.map((component) =>
                    `${escapeHtml(component.component_id)} - ${escapeHtml(component.product_name)}${component.lang_code ? ` (${escapeHtml(component.lang_code)})` : ""}`
                  ).join("<br>")}
                </div>
              ` : ""}
              <a class="kit-search-open-btn" href="${escapeHtml(url)}">Voir le kit</a>
            </article>
          `;
        }).join("")}
      </div>
      ${kits.length > visibleKits.length ? `
        <div class="kit-search-result-meta" style="margin-top:12px;">
          ${escapeHtml(kits.length - visibleKits.length)} résultat(s) supplémentaire(s) masqué(s). Affinez la recherche « ${escapeHtml(query)} ».
        </div>
      ` : ""}
    `;
  }

  async function init() {
    const script = findCurrentScript();
    const globalConfig = window.PRESSERO_KIT_SEARCH_CONFIG || {};
    const config = {
      apiBaseUrl: attr(script, "data-api-base-url") || globalConfig.apiBaseUrl || "",
      email: attr(script, "data-user-email") || globalConfig.email || "",
      kitPageUrl: attr(script, "data-kit-page-url") || globalConfig.kitPageUrl || "",
      mountSelector: attr(script, "data-mount-selector") || globalConfig.mountSelector || "",
      insertMode: attr(script, "data-insert-mode") || globalConfig.insertMode || "before",
      maxResults: attr(script, "data-max-results") || globalConfig.maxResults || 8,
      title: attr(script, "data-title") || globalConfig.title || "",
      searchText: attr(script, "data-search-text") || globalConfig.searchText || ""
    };

    const baseUrl = getBaseUrl(script, config);
    const query = getSearchText(config);
    const email = getEmailFromPage(script, config);

    if (!query || !baseUrl || !email) {
      return;
    }

    injectStyles();

    try {
      const url = `${baseUrl}/api/public/kits-search?email=${encodeURIComponent(email)}&q=${encodeURIComponent(query)}`;
      const response = await fetch(url, { credentials: "omit" });
      const data = await response.json();

      if (!response.ok || data.ok === false) {
        throw new Error(data.error || data.message || "Erreur API kits");
      }

      renderKits(Array.isArray(data.kits) ? data.kits : [], config, baseUrl, email, query);
    } catch (error) {
      console.error("KIT SEARCH INTEGRATION ERROR", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
