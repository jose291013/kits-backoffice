const kitRepository = require("../repositories/kitRepository");
const presseroService = require("../services/presseroService");
const { filterVisibleComponents, getVisibleLangsFromGroups } = require("../utils/visibilityUtils");
const presseroPricingService = require("../services/presseroPricingService");
const presseroCartService = require("../services/presseroCartService");

async function getVisibleKitByPartId(req, res, next) {
  try {
    const { partId } = req.params;
    const email = String(req.query.email || "").trim();

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "Le paramètre email est obligatoire"
      });
    }

    const kit = await kitRepository.getKitByPartId(partId);

    if (!kit) {
      return res.status(404).json({
        ok: false,
        error: "Kit introuvable"
      });
    }

    const userInfo = await presseroService.getUserGroupsByEmail(email);

    if (!userInfo.found) {
      return res.status(404).json({
        ok: false,
        error: "Utilisateur introuvable",
        email
      });
    }

    const visibleComponents = filterVisibleComponents(kit.components, userInfo.groups);

    if (!visibleComponents.length) {
      return res.json({
        ok: true,
        email,
        userGroups: userInfo.groups,
        visibleLangs: getVisibleLangsFromGroups(userInfo.groups),
        kitVisible: false,
        message: "Aucun composant visible pour cet utilisateur",
        kit: {
          id: kit.id,
          part_id: kit.part_id,
          kit_name: kit.kit_name,
          default_kit_qty: kit.default_kit_qty,
          components: []
        }
      });
    }

    res.json({
      ok: true,
      email,
      userGroups: userInfo.groups,
      visibleLangs: getVisibleLangsFromGroups(userInfo.groups),
      kitVisible: true,
      kit: {
        id: kit.id,
        part_id: kit.part_id,
        kit_name: kit.kit_name,
        default_kit_qty: kit.default_kit_qty,
        components: visibleComponents
      }
    });
  } catch (err) {
    next(err);
  }
}

async function searchVisibleKits(req, res, next) {
  try {
    const email = String(req.query.email || "").trim();
    const q = String(req.query.q || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "Le paramètre email est obligatoire"
      });
    }

    const userInfo = await presseroService.getUserGroupsByEmail(email);

    if (!userInfo.found) {
      return res.status(404).json({
        ok: false,
        error: "Utilisateur introuvable",
        email
      });
    }

    const allKits = await kitRepository.getAllKitsDetailed();
    const visibleLangs = getVisibleLangsFromGroups(userInfo.groups);

    const kits = allKits
      .map(kit => {
        const visibleComponents = filterVisibleComponents(kit.components || [], userInfo.groups);

        return {
          id: kit.id,
          part_id: kit.part_id,
          kit_name: kit.kit_name,
          default_kit_qty: kit.default_kit_qty,
          visibleComponentCount: visibleComponents.length,
          availableLangs: [...new Set(
            visibleComponents
              .map(c => String(c.lang_code || "").trim())
              .filter(Boolean)
          )],
          hasVisibleComponents: visibleComponents.length > 0
        };
      })
      .filter(kit => kit.hasVisibleComponents)
      .filter(kit => {
        if (!q) return true;
        return (
          String(kit.part_id || "").toLowerCase().includes(q) ||
          String(kit.kit_name || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => String(a.part_id).localeCompare(String(b.part_id)));

    res.json({
      ok: true,
      email,
      userGroups: userInfo.groups,
      visibleLangs,
      count: kits.length,
      kits
    });
  } catch (err) {
    next(err);
  }
}

async function addVisibleKitToCart(req, res, next) {
  try {
    const { partId } = req.params;
    const email = String(req.body.email || "").trim();
    const requestedComponents = Array.isArray(req.body.components) ? req.body.components : [];

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "Le champ email est obligatoire"
      });
    }

    const kit = await kitRepository.getKitByPartId(partId);

    if (!kit) {
      return res.status(404).json({
        ok: false,
        error: "Kit introuvable"
      });
    }

    const userInfo = await presseroService.getUserGroupsByEmail(email);

    if (!userInfo.found) {
      return res.status(404).json({
        ok: false,
        error: "Utilisateur introuvable",
        email
      });
    }

    const visibleComponents = filterVisibleComponents(kit.components, userInfo.groups);

    const requestedMap = new Map(
      requestedComponents.map(item => [
        String(item.componentId || "").trim(),
        Number(item.quantity || 0)
      ])
    );

    const componentsToAdd = visibleComponents
      .map(component => {
        const componentId = String(component.component_id || "").trim();
        const quantity = Number(requestedMap.get(componentId) || 0);

        return {
          component,
          quantity
        };
      })
      .filter(item => item.quantity > 0 && item.component.product_id);

    if (!componentsToAdd.length) {
      return res.status(400).json({
        ok: false,
        error: "Aucun composant à ajouter au panier"
      });
    }

    const results = [];

    for (const item of componentsToAdd) {
      const addResult = await presseroCartService.addProductToCart(
        userInfo.userId,
        item.component,
        item.quantity
      );

      results.push({
        componentId: item.component.component_id,
        productId: item.component.product_id,
        quantity: item.quantity,
        cartId: addResult.cartId
      });
    }

    res.json({
      ok: true,
      message: "Kit ajouté au panier avec succès",
      addedCount: results.length,
      results
    });
  } catch (err) {
    next(err);
  }
}

async function priceVisibleKitByPartId(req, res, next) {
  try {
    const { partId } = req.params;
    const email = String(req.body.email || "").trim();
    const kitQuantity = Number(req.body.kitQuantity || 1);
    const requestedComponents = Array.isArray(req.body.components) ? req.body.components : [];

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "Le champ email est obligatoire"
      });
    }

    const kit = await kitRepository.getKitByPartId(partId);

    if (!kit) {
      return res.status(404).json({
        ok: false,
        error: "Kit introuvable"
      });
    }

    const userInfo = await presseroService.getUserGroupsByEmail(email);

    if (!userInfo.found) {
      return res.status(404).json({
        ok: false,
        error: "Utilisateur introuvable",
        email
      });
    }

    const visibleComponents = filterVisibleComponents(kit.components, userInfo.groups);

    const requestedMap = new Map(
      requestedComponents.map(item => [
        String(item.componentId || "").trim(),
        Number(item.quantity || 0)
      ])
    );

    const items = [];
    let totalPrice = 0;

    for (const component of visibleComponents) {
      const componentId = String(component.component_id || "").trim();

      let quantity;

      if (requestedMap.has(componentId)) {
        quantity = Number(requestedMap.get(componentId) || 0);
      } else {
        quantity = Number(component.default_component_qty || 0) * kitQuantity;
      }

      if (!quantity || quantity <= 0) {
        continue;
      }

      const pricing = await presseroPricingService.priceComponent(component, quantity, userInfo.userId);

      items.push({
        componentId: component.component_id,
        productId: component.product_id,
        quantity,
        unitPrice: pricing.unitPrice,
        totalPrice: pricing.totalPrice
      });

      totalPrice += pricing.totalPrice;
    }

    res.json({
      ok: true,
      partId,
      currency: "EUR",
      kitQuantity,
      items,
      totalPrice
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getVisibleKitByPartId,
  priceVisibleKitByPartId,
  searchVisibleKits,
  addVisibleKitToCart
};