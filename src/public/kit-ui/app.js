(function () {
  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatCurrency(value) {
    const amount = Number(value || 0);
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR"
    }).format(amount);
  }

  function readConfig() {
    const params = new URLSearchParams(window.location.search);
    return {
      apiBase: params.get("apiBase") || window.location.origin,
      email: params.get("email") || "",
      initialPartId: params.get("partId") || ""
    };
  }

  const config = readConfig();
  const root = document.getElementById("kitUiRoot");

  const state = {
    loading: true,
    pricingLoading: false,
    searchQuery: "",
    kits: [],
    selectedKit: null,
    selectedPartId: config.initialPartId || "",
    visibleComponents: [],
    filteredComponents: [],
    kitQuantity: 1,
    componentQuantities: {},
    pricingItems: [],
    totalPrice: 0,
    languageView: "ALL"
  };

  async function fetchJson(url, options = {}) {
    const res = await fetch(url, options);
    const data = await res.json();

    if (!res.ok || data.ok === false) {
      throw new Error(data.error || "Erreur API");
    }

    return data;
  }

  function getPricingMap() {
    const map = {};
    state.pricingItems.forEach(item => {
      map[item.componentId] = item;
    });
    return map;
  }

  function getInitialQuantity(component) {
    const base = Number(component.default_component_qty || 0);
    return Math.max(0, base * state.kitQuantity);
  }

  function setDefaultQuantitiesFromKitQty() {
    const obj = {};
    state.visibleComponents.forEach(component => {
      obj[component.component_id] = getInitialQuantity(component);
    });
    state.componentQuantities = obj;
  }

  function buildComponentImageUrl(component) {
  return (
    component.product_image_large_url ||
    component.product_image_xlarge_url ||
    ""
  );
}

  function openImageModal(imageUrl) {
    if (!imageUrl) return;

    let modal = document.getElementById("kitImageModal");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "kitImageModal";
      modal.className = "kit-image-modal";
      modal.innerHTML = `
        <div class="kit-image-modal-backdrop"></div>
        <div class="kit-image-modal-content">
          <button type="button" class="kit-image-modal-close" aria-label="Fermer">×</button>
          <img class="kit-image-modal-img" src="" alt="Image agrandie">
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector(".kit-image-modal-backdrop").addEventListener("click", () => {
        modal.classList.remove("open");
      });

      modal.querySelector(".kit-image-modal-close").addEventListener("click", () => {
        modal.classList.remove("open");
      });
    }

    const img = modal.querySelector(".kit-image-modal-img");
    img.src = imageUrl;
    modal.classList.add("open");
  }

  async function loadKitSearch() {
    const url =
      `${config.apiBase}/api/public/kits-search?email=${encodeURIComponent(config.email)}&q=${encodeURIComponent(state.searchQuery)}`;

    const data = await fetchJson(url);
    state.kits = Array.isArray(data.kits) ? data.kits : [];
  }

  async function loadVisibleKit(partId) {
    const url =
      `${config.apiBase}/api/public/kits/${encodeURIComponent(partId)}/visible?email=${encodeURIComponent(config.email)}`;

    const data = await fetchJson(url);

    state.selectedKit = data.kit;
    state.selectedPartId = partId;
    state.visibleComponents = Array.isArray(data.kit?.components) ? data.kit.components : [];
    state.kitQuantity = Number(data.kit?.default_kit_qty || 1) || 1;
    state.languageView = "ALL";

    setDefaultQuantitiesFromKitQty();
    applyLanguageFilter();
  }

  function getAvailableLanguageViews() {
  const langs = [...new Set(
    state.visibleComponents
      .map(c => String(c.lang_code || "").trim())
      .filter(Boolean)
  )];

  const views = [{ key: "ALL", label: "Tout afficher" }];

  if (langs.includes("FR")) {
    views.push({ key: "FR_UNI", label: "FR + UNI" });
  }

  if (langs.includes("NL")) {
    views.push({ key: "NL_UNI", label: "NL + UNI" });
  }

  if (langs.includes("BIL")) {
    views.push({ key: "BIL_UNI", label: "BIL + UNI" });
  }

  return views;
}

  function applyLanguageFilter() {
    if (state.languageView === "ALL") {
      state.filteredComponents = [...state.visibleComponents];
      return;
    }

    const viewMap = {
      FR_UNI: ["FR", "UNI"],
      NL_UNI: ["NL", "UNI"],
      BIL_UNI: ["BIL", "UNI"]
    };

    const allowed = viewMap[state.languageView] || [];
    state.filteredComponents = state.visibleComponents.filter(component =>
      allowed.includes(String(component.lang_code || "").trim())
    );
  }

  async function loadPricing() {
    const url = `${config.apiBase}/api/public/kits/${encodeURIComponent(state.selectedPartId)}/price`;

    const componentsPayload = state.filteredComponents.map(component => ({
      componentId: component.component_id,
      quantity: Number(state.componentQuantities[component.component_id] || 0)
    }));

    const data = await fetchJson(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: config.email,
        kitQuantity: state.kitQuantity,
        components: componentsPayload
      })
    });

    state.pricingItems = Array.isArray(data.items) ? data.items : [];
    state.totalPrice = Number(data.totalPrice || 0);
  }

  let pricingTimer = null;

  function requestPricing() {
    clearTimeout(pricingTimer);
    state.pricingLoading = true;
    render();

    pricingTimer = setTimeout(async () => {
      try {
        await loadPricing();
      } catch (err) {
        console.error(err);
      } finally {
        state.pricingLoading = false;
        render();
      }
    }, 250);
  }

  function setKitQuantity(value) {
    state.kitQuantity = Math.max(0, Number(value || 0));
    setDefaultQuantitiesFromKitQty();
    applyLanguageFilter();
    render();
    requestPricing();
  }

  function setComponentQuantity(componentId, value) {
    state.componentQuantities[componentId] = Math.max(0, Number(value || 0));
    render();
    requestPricing();
  }

  function resetAllQuantities() {
    const obj = {};
    state.visibleComponents.forEach(component => {
      obj[component.component_id] = 0;
    });
    state.componentQuantities = obj;
    applyLanguageFilter();
    render();
    requestPricing();
  }

  function closeSelectedKit() {
    state.selectedKit = null;
    state.selectedPartId = "";
    state.visibleComponents = [];
    state.filteredComponents = [];
    state.pricingItems = [];
    state.totalPrice = 0;
    state.languageView = "ALL";
    render();
  }

  function setLanguageView(viewKey) {
    state.languageView = viewKey;
    applyLanguageFilter();
    render();
    requestPricing();
  }

  function buildSearchView() {
    return `
      <div class="kit-app-shell">
        <section class="kit-topbar">
          <h1 class="kit-page-title">Commande par kit</h1>
          <p class="kit-page-subtitle">
            Recherchez un kit, ouvrez-le, filtrez les langues si nécessaire puis préparez la commande.
          </p>
        </section>

        <section class="kit-search-panel">
          <div class="kit-search-row">
            <input
              id="kitSearchInput"
              class="kit-search-input"
              type="text"
              placeholder="Rechercher un kit par PartID ou nom..."
              value="${escapeHtml(state.searchQuery)}">
          </div>

          <div class="kit-search-results">
            ${state.kits.length
              ? state.kits.map(kit => `
                <article class="kit-result-card">
                  <div class="kit-result-title">${escapeHtml(kit.kit_name)}</div>
                  <div class="kit-result-meta">
                    <div><strong>PartID :</strong> ${escapeHtml(kit.part_id)}</div>
                    <div><strong>Composants visibles :</strong> ${kit.visibleComponentCount}</div>
                  </div>
                  <div class="kit-result-badges">
                    ${(kit.availableLangs || []).map(lang => `
                      <span class="lang-badge">${escapeHtml(lang)}</span>
                    `).join("")}
                  </div>
                  <div>
                    <button class="btn btn-primary btn-open-kit" data-partid="${escapeHtml(kit.part_id)}">Voir</button>
                  </div>
                </article>
              `).join("")
              : `<div class="kit-empty">Aucun kit trouvé.</div>`
            }
          </div>
        </section>
      </div>
    `;
  }

  function buildDetailView() {
  const pricingMap = getPricingMap();
  const languageViews = getAvailableLanguageViews();

  return `
    <div class="kit-detail-shell">
      <section class="kit-header">
        <div>
          <h1 class="kit-title">${escapeHtml(state.selectedKit.kit_name)}</h1>
          <div class="kit-meta">
            <div><strong>PartID :</strong> ${escapeHtml(state.selectedKit.part_id)}</div>
            <div><strong>Utilisateur :</strong> ${escapeHtml(config.email)}</div>
          </div>
        </div>

        <div class="kit-header-side">
          <div class="kit-qty-box">
            <label for="kitQuantityInput">Quantité de kits</label>
            <input id="kitQuantityInput" class="qty-input" type="number" min="0" step="1" value="${state.kitQuantity}">
          </div>

          <div class="total-box">
            <div class="total-label">Prix total du kit</div>
            <div class="total-value">${formatCurrency(state.totalPrice)}</div>
          </div>

          <div class="kit-header-actions">
            <button id="closeKitBtn" class="btn btn-secondary" type="button">Fermer</button>
            <button id="resetAllBtn" class="btn btn-secondary" type="button">Remettre à 0</button>
          </div>
        </div>
      </section>

      <section class="kit-search-panel">
        <div class="language-filters">
          ${languageViews.map(view => `
            <button
              type="button"
              class="filter-chip ${state.languageView === view.key ? "active" : ""}"
              data-language-view="${escapeHtml(view.key)}">
              ${escapeHtml(view.label)}
            </button>
          `).join("")}
        </div>
      </section>

      <section class="kit-grid">
        ${state.filteredComponents.map(component => {
          const componentId = component.component_id;
          const qty = Number(state.componentQuantities[componentId] || 0);
          const pricing = pricingMap[componentId];
          const totalPrice = pricing ? pricing.totalPrice : 0;
          const imageUrl = buildComponentImageUrl(component);
          const xlargeUrl = component.product_image_xlarge_url || imageUrl;

          return `
            <article class="kit-card">
              <div class="kit-card-image-wrap">
                ${imageUrl
                  ? `
                    <button
                      type="button"
                      class="kit-card-image-button"
                      data-xlarge-url="${escapeHtml(xlargeUrl)}"
                      aria-label="Agrandir l'image">
                      <img
                        class="kit-card-image"
                        src="${escapeHtml(imageUrl)}"
                        alt="${escapeHtml(component.product_name)}"
                        loading="lazy">
                      <span class="kit-card-image-zoom" aria-hidden="true">🔍</span>
                    </button>
                  `
                  : `<div class="kit-card-no-image">Aucune image</div>`}
              </div>

              <div class="kit-card-body">
                <div class="kit-card-title">${escapeHtml(component.product_name)}</div>

                <div class="kit-card-meta">
                  <div><strong>Composant :</strong> ${escapeHtml(component.component_id)}</div>
                  <div><strong>PartID :</strong> ${escapeHtml(state.selectedKit.part_id)}</div>
                  <div><strong>Langue :</strong> ${escapeHtml(component.lang_code)}</div>
                </div>

                <div class="kit-card-row">
                  <div class="kit-card-label">Quantité</div>
                  <input
                    class="qty-input component-qty-input"
                    type="number"
                    min="0"
                    step="1"
                    data-component-id="${escapeHtml(componentId)}"
                    value="${qty}">
                </div>

                <div class="price-box">
                  <div class="price-label">Prix composant</div>
                  <div class="price-value">${formatCurrency(totalPrice)}</div>
                </div>
              </div>
            </article>
          `;
        }).join("")}
      </section>

      <section class="kit-footer">
        <div class="footer-total-block">
          <div class="footer-total-label">Total du kit</div>
          <div class="footer-total-value">${formatCurrency(state.totalPrice)}</div>
          <div class="pricing-loading">${state.pricingLoading ? "Mise à jour du prix..." : ""}</div>
        </div>

        <div class="footer-actions">
          <button id="footerCloseBtn" class="btn btn-secondary" type="button">Fermer</button>
          <button id="addToCartBtn" class="btn btn-primary" type="button">Ajouter au panier</button>
        </div>
      </section>
    </div>
  `;
}

  function bindSearchEvents() {
    const searchInput = document.getElementById("kitSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", async (e) => {
        state.searchQuery = e.target.value || "";
        await loadKitSearch();
        render();
      });
    }

    document.querySelectorAll(".btn-open-kit").forEach(button => {
      button.addEventListener("click", async () => {
        const partId = button.getAttribute("data-partid");
        state.loading = true;
        render();

        try {
          await loadVisibleKit(partId);
          await loadPricing();
        } finally {
          state.loading = false;
          render();
        }
      });
    });
  }

  function bindDetailEvents() {
    const kitQtyInput = document.getElementById("kitQuantityInput");
    if (kitQtyInput) {
      kitQtyInput.addEventListener("change", e => setKitQuantity(e.target.value));
    }

    document.querySelectorAll(".component-qty-input").forEach(input => {
      input.addEventListener("change", e => {
        const componentId = e.target.getAttribute("data-component-id");
        setComponentQuantity(componentId, e.target.value);
      });
    });

    document.querySelectorAll("[data-language-view]").forEach(button => {
      button.addEventListener("click", () => {
        const viewKey = button.getAttribute("data-language-view");
        setLanguageView(viewKey);
      });
    });

    document.querySelectorAll(".kit-card-image-button").forEach(button => {
      button.addEventListener("click", () => {
        const imageUrl = button.getAttribute("data-xlarge-url");
        openImageModal(imageUrl);
      });
    });

    const resetAllBtn = document.getElementById("resetAllBtn");
    if (resetAllBtn) {
      resetAllBtn.addEventListener("click", resetAllQuantities);
    }

    const closeKitBtn = document.getElementById("closeKitBtn");
    if (closeKitBtn) {
      closeKitBtn.addEventListener("click", closeSelectedKit);
    }

    const footerCloseBtn = document.getElementById("footerCloseBtn");
    if (footerCloseBtn) {
      footerCloseBtn.addEventListener("click", closeSelectedKit);
    }

    const addToCartBtn = document.getElementById("addToCartBtn");
    if (addToCartBtn) {
      addToCartBtn.addEventListener("click", () => {
        alert("Étape suivante : brancher la route add-to-cart.");
      });
    }
  }

  function render() {
    if (!root) return;

    if (state.loading) {
      root.innerHTML = `<div class="kit-loading">Chargement...</div>`;
      return;
    }

    if (!config.email) {
      root.innerHTML = `<div class="kit-error">Configuration incomplète : email utilisateur manquant.</div>`;
      return;
    }

    root.innerHTML = state.selectedKit ? buildDetailView() : buildSearchView();

    if (state.selectedKit) {
      bindDetailEvents();
    } else {
      bindSearchEvents();
    }
  }

  async function init() {
    try {
      state.loading = true;
      render();

      await loadKitSearch();

      if (state.selectedPartId) {
        await loadVisibleKit(state.selectedPartId);
        await loadPricing();
      }

      state.loading = false;
      render();
    } catch (err) {
      console.error(err);
      root.innerHTML = `<div class="kit-error">${escapeHtml(err.message || "Erreur de chargement")}</div>`;
    }
  }

  init();
})();