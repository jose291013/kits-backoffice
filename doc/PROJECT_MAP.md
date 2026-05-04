# Project Map — Kits Backoffice + Commandes par Excel

## 1. Serveur principal

### src/app.js
Rôle :
- Configure Express, CORS, JSON, fichiers statiques.
- Monte les routes API.
- Sert les deux interfaces admin.

Routes statiques :
- /admin-ui : ancien back-office kits
- /admin : scripts et interface admin liés aux commandes Excel
- /kit-ui : front de commande kits
- /kit-ui-loader.js : loader du front kits

Routes API :
- /api/kits
- /api/import
- /api/pressero
- /api/admin
- /api/public
- /api/stores
- /api/products
- /api/imports
- /api/orders
- /api/backoffice

---

## 2. Base de données

### src/repositories/db.js
Rôle :
- Ouvre SQLite.
- Crée les tables.
- Lance les migrations conditionnelles.
- Gère les colonnes ajoutées progressivement.

Tables principales kits :
- kits
- kit_components
- product_cache

Tables principales commandes Excel :
- stores
- store_addresses
- excel_imports
- excel_import_lines
- order_batches
- order_batch_items
- sync_logs

---

## 3. Back-office Kits

### src/routes/adminRoutes.js
Rôle :
- Routes admin pour les kits.
- Suppression / reset / export Excel.

Routes :
- GET /api/admin/kits
- GET /api/admin/kits/:partId
- DELETE /api/admin/kits/:partId
- GET /api/admin/export-excel
- POST /api/admin/reset-all-kits

### src/public/admin/index.html
Rôle :
- Page HTML de l’ancien back-office kits.

### src/public/admin/app.js
Rôle :
- JS front de l’ancien back-office kits.
- Import Excel kits.
- Synchronisation composants.
- Liste et détail des kits.

---

## 4. Back-office Commandes par Excel

### src/routes/imports.js
Rôle :
- Import Excel commandes.
- Génération du modèle Excel.

Routes :
- POST /api/imports/preview
- GET /api/imports/template

### src/routes/orders-submit.js
Rôle :
- Envoi d’un batch précis vers Pressero.

Routes :
- POST /api/orders/submit-batch/:batchId

### src/routes/backoffice.js
Rôle :
- Liste des imports.
- Liste des lignes d’import.
- Liste des batchs actifs.
- Historique des batchs envoyés.
- Détail des items batch.
- Envoi global.
- Nettoyage actuel global des commandes Excel.

Routes :
- GET /api/backoffice/imports
- GET /api/backoffice/imports/:importId
- GET /api/backoffice/imports/:importId/lines
- GET /api/backoffice/batches
- GET /api/backoffice/batches/active
- GET /api/backoffice/batches/history
- GET /api/backoffice/batches/:batchId
- GET /api/backoffice/batches/:batchId/items
- POST /api/backoffice/submit-all-ready
- POST /api/backoffice/cleanup-orders

### src/public/admin/pressero-excel-orders-admin.js
Rôle :
- Interface front du back-office Commandes par Excel.
- Import commandes.
- Référentiel magasins.
- Imports à préparer.
- Imports préparés.
- Commandes prêtes à envoyer.
- Historique commandes.
- Détail et journal.

---

## 5. Prochaine évolution : suppressions intelligentes

Objectif :
- Remplacer le bouton global “Vider les tests commandes”.
- Ajouter des suppressions contrôlées et sélectives.

Approche recommandée :
- soft delete via deleted_at / deleted_reason
- blocage des batchs SENT
- suppression sélective des imports FAILED
- suppression sélective des batchs READY ou FAILED