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
      partId: params.get("partId") || "",
      email: params.get("email") || ""
    };
  }

  const config = readConfig();
  const root = document.getElementById("kitUiRoot");

  const state = {
    kit: null,
    visibleComponents: [],
    kitQuantity: 1,
    componentQuantities: {},
    pricingItems: [],
    totalPrice: 0,
    loading: true,
    pricingLoading: false
  };

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
    return component.product_image_url || "";
  }

  async function fetchJson(url, options = {}) {
    const res = await fetch(url, options);
    const data = await res.json();

    if (!res.ok || data.ok === false) {
      throw new Error(data.error || "Erreur API");
    }

    return data;
  }

  async function loadVisibleKit() {
    const url =
      `${config.apiBase}/api/public/kits/${encodeURIComponent(config.partId)}/visible?email=${encodeURIComponent(config.email)}`;

    const data = await fetchJson(url);

    state.kit = data.kit;
    state.visibleComponents = Array.isArray(data.kit?.components) ? data.kit.components : [];
    state.kitQuantity = Number(data.kit?.default_kit_qty || 1) || 1;
    setDefaultQuantitiesFromKitQty();
  }

  async function loadPricing() {
    const url = `${config.apiBase}/api/public/kits/${encodeURIComponent(config.partId)}/price`;

    const componentsPayload = state.visibleComponents.map(component => ({
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
    render();
    requestPricing();
  }

  function buildHeader() {
    return `
      <section class="kit-header">
        <div>
          <h1 class="kit-title">${escapeHtml(state.kit.kit_name)}</h1>
          <div class="kit-meta">
            <div><strong>PartID :</strong> ${escapeHtml(state.kit.part_id)}</div>
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
            <button id="resetAllBtn" class="btn btn-secondary" type="button">Remettre à 0</button>
          </div>
        </div>
      </section>
    `;
  }

  function buildGrid() {
    const pricingMap = getPricingMap();

    return `
      <section class="kit-grid">
        ${state.visibleComponents.map(component => {
          const componentId = component.component_id;
          const qty = Number(state.componentQuantities[componentId] || 0);
          const pricing = pricingMap[componentId];
          const totalPrice = pricing ? pricing.totalPrice : 0;
          const imageUrl = buildComponentImageUrl(component);

          return `
            <article class="kit-card">
              <div class="kit-card-image-wrap">
                ${imageUrl
                  ? `<img class="kit-card-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(component.product_name)}">`
                  : `<div class="kit-card-no-image">Aucune image</div>`}
              </div>

              <div class="kit-card-body">
                <div class="kit-card-title">${escapeHtml(component.product_name)}</div>

                <div class="kit-card-meta">
                  <div><strong>Composant :</strong> ${escapeHtml(component.component_id)}</div>
                  <div><strong>PartID :</strong> ${escapeHtml(state.kit.part_id)}</div>
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
    `;
  }

  function buildFooter() {
    return `
      <section class="kit-footer">
        <div class="footer-total-block">
          <div class="footer-total-label">Total du kit</div>
          <div class="footer-total-value">${formatCurrency(state.totalPrice)}</div>
          <div class="pricing-loading">${state.pricingLoading ? "Mise à jour du prix..." : ""}</div>
        </div>

        <div class="footer-actions">
          <button id="footerResetBtn" class="btn btn-secondary" type="button">Remettre à 0</button>
          <button id="addToCartBtn" class="btn btn-primary" type="button">Ajouter au panier</button>
        </div>
      </section>
    `;
  }

  function bindEvents() {
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

    const resetAllBtn = document.getElementById("resetAllBtn");
    if (resetAllBtn) {
      resetAllBtn.addEventListener("click", resetAllQuantities);
    }

    const footerResetBtn = document.getElementById("footerResetBtn");
    if (footerResetBtn) {
      footerResetBtn.addEventListener("click", resetAllQuantities);
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
      root.innerHTML = `<div class="kit-loading">Chargement du kit...</div>`;
      return;
    }

    if (!state.kit) {
      root.innerHTML = `<div class="kit-empty">Aucun kit chargé.</div>`;
      return;
    }

    if (!state.visibleComponents.length) {
      root.innerHTML = `<div class="kit-empty">Aucun composant visible pour cet utilisateur.</div>`;
      return;
    }

    root.innerHTML = `
      <div class="kit-shell">
        ${buildHeader()}
        ${buildGrid()}
        ${buildFooter()}
      </div>
    `;

    bindEvents();
  }

  async function init() {
    try {
      if (!config.partId || !config.email) {
        throw new Error("Configuration incomplète : partId ou email manquant.");
      }

      state.loading = true;
      render();

      await loadVisibleKit();
      await loadPricing();

      state.loading = false;
      render();
    } catch (err) {
      console.error(err);
      root.innerHTML = `<div class="kit-error">${escapeHtml(err.message || "Erreur de chargement")}</div>`;
    }
  }

  init();
})();