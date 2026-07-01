(function () {
  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getBrowserLanguage() {
    const langs = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator.language || navigator.userLanguage || "fr"];

    const first = String(langs[0] || "fr").toLowerCase();

    if (first.startsWith("nl")) return "nl";
    if (first.startsWith("fr")) return "fr";
    return "fr";
  }

  const UI_LANG = getBrowserLanguage();

  const I18N = {
    fr: {
      htmlLang: "fr",
      formatLocale: "fr-FR",
      pageTitle: "Commande par kit",

      nonJsonResponse: "Réponse non JSON ({status}) : {preview}",
      apiError: "Erreur API ({status})",

      modalCloseAria: "Fermer",
      modalImageAlt: "Image agrandie",

      allLabel: "Tout afficher",
      emptyQuantityAlert: "Aucun composant avec quantité à ajouter au panier.",
      addToCartSuccess: "Ajout au panier réussi. {count} composant(s) ajouté(s).",
      pricingError: "Erreur lors du calcul du prix.",
      addToCartError: "Erreur lors de l'ajout au panier.",

      searchTitle: "Commande par kit",
      searchSubtitle: "Recherchez un kit ou un composant, ouvrez le kit, filtrez les langues si nécessaire puis préparez la commande.",
      searchPanelTitle: "Recherche rapide dans les kits",
      searchPanelHint: "Saisissez un PartID, un nom de kit, un code composant ou un nom de composant, puis cliquez sur Rechercher.",
      searchPlaceholder: "Rechercher par kit, PartID, code composant ou nom de composant...",
      searchButton: "Rechercher",
      searching: "Recherche...",
      clearSearch: "Effacer",
      allVisibleKits: "Tous les kits visibles pour votre utilisateur",
      searchResultsFor: "Résultats pour : {query}",
      matchedComponents: "Composants trouvés",
      componentSearchNote: "La recherche inclut les composants des kits.",
      partId: "PartID",
      visibleComponents: "Composants visibles",
      viewButton: "Voir",
      noKitFound: "Aucun kit trouvé.",

      user: "Utilisateur",
      kitQuantity: "Quantité de kits",
      totalKitPrice: "Prix total du kit",
      close: "Fermer",
      resetToZero: "Remettre à 0",

      noImage: "Aucune image",
      zoomImageAria: "Agrandir l'image",
      component: "Composant",
      language: "Langue",
      quantity: "Quantité",
      componentPrice: "Prix composant",

      footerKitTotal: "Total du kit",
      pricingLoading: "Mise à jour du prix...",
      addToCart: "Ajouter au panier",
      addingToCart: "Ajout en cours...",

      loading: "Chargement...",
      missingEmail: "Configuration incomplète : email utilisateur manquant.",
      loadingError: "Erreur de chargement"
    },

    nl: {
      htmlLang: "nl",
      formatLocale: "nl-BE",
      pageTitle: "Bestellen per kit",

      nonJsonResponse: "Niet-JSON antwoord ({status}) : {preview}",
      apiError: "API-fout ({status})",

      modalCloseAria: "Sluiten",
      modalImageAlt: "Vergrote afbeelding",

      allLabel: "Alles tonen",
      emptyQuantityAlert: "Geen component met hoeveelheid om aan de winkelwagen toe te voegen.",
      addToCartSuccess: "Toevoegen aan winkelwagen geslaagd. {count} component(en) toegevoegd.",
      pricingError: "Fout bij het berekenen van de prijs.",
      addToCartError: "Fout bij het toevoegen aan de winkelwagen.",

      searchTitle: "Bestellen per kit",
      searchSubtitle: "Zoek een kit of component, open de kit, filter indien nodig op taal en bereid vervolgens de bestelling voor.",
      searchPanelTitle: "Snel zoeken in kits",
      searchPanelHint: "Voer een PartID, kitnaam, componentcode of componentnaam in en klik vervolgens op Zoeken.",
      searchPlaceholder: "Zoeken op kit, PartID, componentcode of componentnaam...",
      searchButton: "Zoeken",
      searching: "Zoeken...",
      clearSearch: "Wissen",
      allVisibleKits: "Alle zichtbare kits voor uw gebruiker",
      searchResultsFor: "Resultaten voor: {query}",
      matchedComponents: "Gevonden componenten",
      componentSearchNote: "De zoekopdracht omvat ook de componenten van de kits.",
      partId: "PartID",
      visibleComponents: "Zichtbare componenten",
      viewButton: "Bekijken",
      noKitFound: "Geen kit gevonden.",

      user: "Gebruiker",
      kitQuantity: "Aantal kits",
      totalKitPrice: "Totale kitprijs",
      close: "Sluiten",
      resetToZero: "Alles op 0 zetten",

      noImage: "Geen afbeelding",
      zoomImageAria: "Afbeelding vergroten",
      component: "Component",
      language: "Taal",
      quantity: "Aantal",
      componentPrice: "Componentprijs",

      footerKitTotal: "Totaal van de kit",
      pricingLoading: "Prijs wordt bijgewerkt...",
      addToCart: "Toevoegen aan winkelwagen",
      addingToCart: "Bezig met toevoegen...",

      loading: "Laden...",
      missingEmail: "Onvolledige configuratie: gebruikers-e-mailadres ontbreekt.",
      loadingError: "Laadfout"
    }
  };

  const TXT = I18N[UI_LANG] || I18N.fr;

  function t(key, vars) {
    let text = TXT[key] || I18N.fr[key] || key;

    if (vars && typeof vars === "object") {
      Object.keys(vars).forEach((name) => {
        text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(vars[name]));
      });
    }

    return text;
  }

  function formatCurrency(value) {
    const amount = Number(value || 0);
    return new Intl.NumberFormat(TXT.formatLocale, {
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

  if (document.documentElement) {
    document.documentElement.lang = TXT.htmlLang;
  }

  if (document.title) {
    document.title = t("pageTitle");
  }

  const state = {
    loading: true,
    searchLoading: false,
    pricingLoading: false,
    searchInput: "",
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
    const res = await fetch(`${url}`, options);
    const text = await res.text();

    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        t("nonJsonResponse", {
          status: res.status,
          preview: text.slice(0, 300)
        })
      );
    }

    if (!res.ok || data.ok === false) {
      throw new Error(data.error || data.message || t("apiError", { status: res.status }));
    }

    return data;
  }

  function getPricingMap() {
    const map = {};
    state.pricingItems.forEach((item) => {
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
    state.visibleComponents.forEach((component) => {
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
          <button type="button" class="kit-image-modal-close" aria-label="${escapeHtml(t("modalCloseAria"))}">×</button>
          <img class="kit-image-modal-img" src="" alt="${escapeHtml(t("modalImageAlt"))}">
        </div>
      `;
      document.body.appendChild(modal);

      const closeModal = () => {
        modal.classList.remove("open");
      };

      modal.querySelector(".kit-image-modal-backdrop").addEventListener("click", closeModal);
      modal.querySelector(".kit-image-modal-close").addEventListener("click", closeModal);

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.classList.contains("open")) {
          closeModal();
        }
      });
    }

    const img = modal.querySelector(".kit-image-modal-img");
    img.src = imageUrl;
    img.alt = t("modalImageAlt");
    modal.classList.add("open");
  }

  async function loadKitSearch() {
    const url =
      `${config.apiBase}/api/public/kits-search?email=${encodeURIComponent(config.email)}&q=${encodeURIComponent(state.searchQuery)}`;

    const data = await fetchJson(url);
    state.kits = Array.isArray(data.kits) ? data.kits : [];
  }

  async function runKitSearch() {
    state.searchQuery = String(state.searchInput || "").trim();
    state.searchLoading = true;
    render();

    try {
      await loadKitSearch();
    } catch (err) {
      console.error("KIT SEARCH ERROR:", err);
      alert(err.message || t("loadingError"));
    } finally {
      state.searchLoading = false;
      render();
    }
  }

  async function clearKitSearch() {
    state.searchInput = "";
    state.searchQuery = "";
    state.searchLoading = true;
    render();

    try {
      await loadKitSearch();
    } catch (err) {
      console.error("KIT SEARCH ERROR:", err);
      alert(err.message || t("loadingError"));
    } finally {
      state.searchLoading = false;
      render();
    }
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
        .map((c) => String(c.lang_code || "").trim())
        .filter(Boolean)
    )];

    const views = [{ key: "ALL", label: t("allLabel") }];

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

  function refreshHeaderCartCount(addedCount = 0) {
  const nodes = document.querySelectorAll('.store-data[data-cart="count"]');
  if (!nodes.length) return;

  nodes.forEach(node => {
    const current = parseInt((node.textContent || "0").trim(), 10) || 0;
    node.textContent = String(current + addedCount);
  });
}

  async function addCurrentKitToCart() {
    if (!state.selectedPartId) return;

    const componentsPayload = state.filteredComponents
      .map((component) => ({
        componentId: component.component_id,
        quantity: Number(state.componentQuantities[component.component_id] || 0)
      }))
      .filter((item) => item.quantity > 0);

    if (!componentsPayload.length) {
      alert(t("emptyQuantityAlert"));
      return;
    }

    const url = `${config.apiBase}/api/public/kits/${encodeURIComponent(state.selectedPartId)}/add-to-cart`;

    const data = await fetchJson(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: config.email,
        components: componentsPayload
      })
    });

    refreshHeaderCartCount(data.addedCount || 0);

    alert(t("addToCartSuccess", { count: data.addedCount }));
    window.location.reload();
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
    state.filteredComponents = state.visibleComponents.filter((component) =>
      allowed.includes(String(component.lang_code || "").trim())
    );
  }

  async function loadPricing() {
    const url = `${config.apiBase}/api/public/kits/${encodeURIComponent(state.selectedPartId)}/price`;

    const componentsPayload = state.filteredComponents.map((component) => ({
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
        console.error("PRICING ERROR:", err);
        alert(err.message || t("pricingError"));
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
    state.visibleComponents.forEach((component) => {
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
    const hasQuery = Boolean(String(state.searchQuery || "").trim());
    const resultLabel = hasQuery
      ? t("searchResultsFor", { query: state.searchQuery })
      : t("allVisibleKits");

    return `
      <div class="kit-app-shell">
        <section class="kit-topbar">
          <h1 class="kit-page-title">${escapeHtml(t("searchTitle"))}</h1>
          <p class="kit-page-subtitle">
            ${escapeHtml(t("searchSubtitle"))}
          </p>
        </section>

        <section
          class="kit-search-panel"
          style="background:linear-gradient(135deg,#ffffff 0%,#fff8d8 100%);border:2px solid rgba(255,210,0,.9);box-shadow:0 18px 44px rgba(17,24,39,.11);">
          <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:16px;">
            <div>
              <h2 style="margin:0 0 6px;font-family:Manrope,Inter,Arial,sans-serif;font-size:28px;line-height:1.08;font-weight:800;letter-spacing:-.03em;">
                ${escapeHtml(t("searchPanelTitle"))}
              </h2>
              <p style="margin:0;color:#6b7280;line-height:1.55;max-width:920px;">
                ${escapeHtml(t("searchPanelHint"))}
              </p>
            </div>
            <div class="inline-note" style="font-weight:700;color:#374151;background:#fff;border:1px solid #e5e7eb;border-radius:999px;padding:8px 12px;">
              ${escapeHtml(t("componentSearchNote"))}
            </div>
          </div>

          <div class="kit-search-row" style="align-items:stretch;">
            <input
              id="kitSearchInput"
              class="kit-search-input"
              type="text"
              placeholder="${escapeHtml(t("searchPlaceholder"))}"
              value="${escapeHtml(state.searchInput)}"
              autocomplete="off">
            <button id="kitSearchButton" class="btn btn-primary" type="button" ${state.searchLoading ? "disabled" : ""}>
              ${escapeHtml(state.searchLoading ? t("searching") : t("searchButton"))}
            </button>
            <button id="kitClearSearchButton" class="btn btn-secondary" type="button" ${state.searchLoading ? "disabled" : ""}>
              ${escapeHtml(t("clearSearch"))}
            </button>
          </div>

          <div class="kit-result-meta" style="margin-top:14px;font-weight:700;">
            ${escapeHtml(resultLabel)} · ${state.kits.length} ${escapeHtml(state.kits.length > 1 ? "kits" : "kit")}
          </div>

          <div class="kit-search-results">
            ${state.kits.length
              ? state.kits.map((kit) => {
                const matches = Array.isArray(kit.matchedComponents) ? kit.matchedComponents : [];

                return `
                  <article class="kit-result-card">
                    <div class="kit-result-title">${escapeHtml(kit.kit_name)}</div>
                    <div class="kit-result-meta">
                      <div><strong>${escapeHtml(t("partId"))} :</strong> ${escapeHtml(kit.part_id)}</div>
                      <div><strong>${escapeHtml(t("visibleComponents"))} :</strong> ${kit.visibleComponentCount}</div>
                    </div>
                    <div class="kit-result-badges">
                      ${(kit.availableLangs || []).map((lang) => `
                        <span class="lang-badge">${escapeHtml(lang)}</span>
                      `).join("")}
                    </div>
                    ${matches.length ? `
                      <div class="kit-result-meta" style="background:#fff;border:1px dashed #d1d5db;border-radius:14px;padding:10px;">
                        <strong>${escapeHtml(t("matchedComponents"))} :</strong><br>
                        ${matches.map((component) =>
                          `${escapeHtml(component.component_id)} - ${escapeHtml(component.product_name)}${component.lang_code ? ` (${escapeHtml(component.lang_code)})` : ""}`
                        ).join("<br>")}
                      </div>
                    ` : ""}
                    <div>
                      <button class="btn btn-primary btn-open-kit" data-partid="${escapeHtml(kit.part_id)}">${escapeHtml(t("viewButton"))}</button>
                    </div>
                  </article>
                `;
              }).join("")
              : `<div class="kit-empty">${escapeHtml(t("noKitFound"))}</div>`
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
              <div><strong>${escapeHtml(t("partId"))} :</strong> ${escapeHtml(state.selectedKit.part_id)}</div>
              <div><strong>${escapeHtml(t("user"))} :</strong> ${escapeHtml(config.email)}</div>
            </div>
          </div>

          <div class="kit-header-side">
            <div class="kit-qty-box">
              <label for="kitQuantityInput">${escapeHtml(t("kitQuantity"))}</label>
              <input id="kitQuantityInput" class="qty-input" type="number" min="0" step="1" value="${state.kitQuantity}">
            </div>

            <div class="total-box">
              <div class="total-label">${escapeHtml(t("totalKitPrice"))}</div>
              <div class="total-value">${formatCurrency(state.totalPrice)}</div>
            </div>

            <div class="kit-header-actions">
              <button id="closeKitBtn" class="btn btn-secondary" type="button">${escapeHtml(t("close"))}</button>
              <button id="resetAllBtn" class="btn btn-secondary" type="button">${escapeHtml(t("resetToZero"))}</button>
            </div>
          </div>
        </section>

        <section class="kit-search-panel">
          <div class="language-filters">
            ${languageViews.map((view) => `
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
          ${state.filteredComponents.map((component) => {
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
                        aria-label="${escapeHtml(t("zoomImageAria"))}">
                        <img
                          class="kit-card-image"
                          src="${escapeHtml(imageUrl)}"
                          alt="${escapeHtml(component.product_name)}"
                          loading="lazy">
                        <span class="kit-card-image-zoom" aria-hidden="true">🔍</span>
                      </button>
                    `
                    : `<div class="kit-card-no-image">${escapeHtml(t("noImage"))}</div>`}
                </div>

                <div class="kit-card-body">
                  <div class="kit-card-title">${escapeHtml(component.product_name)}</div>

                  <div class="kit-card-meta">
                    <div><strong>${escapeHtml(t("component"))} :</strong> ${escapeHtml(component.component_id)}</div>
                    <div><strong>${escapeHtml(t("partId"))} :</strong> ${escapeHtml(state.selectedKit.part_id)}</div>
                    <div><strong>${escapeHtml(t("language"))} :</strong> ${escapeHtml(component.lang_code)}</div>
                  </div>

                  <div class="kit-card-row">
                    <div class="kit-card-label">${escapeHtml(t("quantity"))}</div>
                    <input
                      class="qty-input component-qty-input"
                      type="number"
                      min="0"
                      step="1"
                      data-component-id="${escapeHtml(componentId)}"
                      value="${qty}">
                  </div>

                  <div class="price-box">
                    <div class="price-label">${escapeHtml(t("componentPrice"))}</div>
                    <div class="price-value">${formatCurrency(totalPrice)}</div>
                  </div>
                </div>
              </article>
            `;
          }).join("")}
        </section>

        <section class="kit-footer">
          <div class="footer-total-block">
            <div class="footer-total-label">${escapeHtml(t("footerKitTotal"))}</div>
            <div class="footer-total-value">${formatCurrency(state.totalPrice)}</div>
            <div class="pricing-loading">${state.pricingLoading ? escapeHtml(t("pricingLoading")) : ""}</div>
          </div>

          <div class="footer-actions">
            <button id="footerCloseBtn" class="btn btn-secondary" type="button">${escapeHtml(t("close"))}</button>
            <button id="addToCartBtn" class="btn btn-primary" type="button">${escapeHtml(t("addToCart"))}</button>
          </div>
        </section>
      </div>
    `;
  }

  function bindSearchEvents() {
    const searchInput = document.getElementById("kitSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        state.searchInput = e.target.value || "";
      });

      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          runKitSearch();
        }
      });
    }

    const searchButton = document.getElementById("kitSearchButton");
    if (searchButton) {
      searchButton.addEventListener("click", runKitSearch);
    }

    const clearSearchButton = document.getElementById("kitClearSearchButton");
    if (clearSearchButton) {
      clearSearchButton.addEventListener("click", clearKitSearch);
    }

    document.querySelectorAll(".btn-open-kit").forEach((button) => {
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
      kitQtyInput.addEventListener("change", (e) => setKitQuantity(e.target.value));
    }

    document.querySelectorAll(".component-qty-input").forEach((input) => {
      input.addEventListener("change", (e) => {
        const componentId = e.target.getAttribute("data-component-id");
        setComponentQuantity(componentId, e.target.value);
      });
    });

    document.querySelectorAll("[data-language-view]").forEach((button) => {
      button.addEventListener("click", () => {
        const viewKey = button.getAttribute("data-language-view");
        setLanguageView(viewKey);
      });
    });

    document.querySelectorAll(".kit-card-image-button").forEach((button) => {
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
      addToCartBtn.addEventListener("click", async () => {
        try {
          addToCartBtn.disabled = true;
          addToCartBtn.textContent = t("addingToCart");
          await addCurrentKitToCart();
        } catch (err) {
          console.error(err);
          alert(err.message || t("addToCartError"));
        } finally {
          addToCartBtn.disabled = false;
          addToCartBtn.textContent = t("addToCart");
        }
      });
    }
  }

  function render() {
    if (!root) return;

    if (state.loading) {
      root.innerHTML = `<div class="kit-loading">${escapeHtml(t("loading"))}</div>`;
      return;
    }

    if (!config.email) {
      root.innerHTML = `<div class="kit-error">${escapeHtml(t("missingEmail"))}</div>`;
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
      root.innerHTML = `<div class="kit-error">${escapeHtml(err.message || t("loadingError"))}</div>`;
    }
  }

  init();
})();
