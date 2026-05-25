# Debug Product Not Found - Kits Backoffice

## Objectif

Ce document explique comment diagnostiquer les erreurs `NOT_FOUND` lors de la synchronisation des composants de kits avec les produits Pressero.

Le cas analysé est le suivant : les produits existent dans l'export produit Pressero, mais certains composants du kit export sont marqués `NOT_FOUND`.

## Flux actuel

1. L'import Excel des kits lit la feuille uploadée.
2. Le champ `Component ID` devient la référence principale du composant.
3. Le repository enregistre le composant avec `last_sync_status = TO_RESYNC`.
4. La synchronisation Pressero cherche ensuite un produit dont `ProductName` contient le `Component ID`.
5. Si aucun produit n'est retourné par l'API Pressero, le composant passe en `NOT_FOUND`.

## Point important

L'import Excel ne valide pas directement l'existence du produit Pressero.

Le `NOT_FOUND` apparaît pendant la synchronisation Pressero, pas pendant la lecture de l'Excel.

## Référence commune

Dans ce projet, la référence commune entre :

- l'Excel d'import kits
- l'Excel produit exporté depuis Pressero

est le `Component ID` côté kits et le `Product Name` côté Pressero.

La recherche API actuelle utilise :

```js
Column: "productName"
Operator: "contains"
Value: componentId
```

## Logs ajoutés

Le fichier `src/services/presseroService.js` contient maintenant des logs de diagnostic autour de la recherche produit.

Les logs sont visibles automatiquement pour les cas suivants :

- `NOT_FOUND`
- `NO_EXACT_MATCH`
- `ERROR`
- `PRODUCT_FOUND_WITHOUT_ID`
- `PRODUCT_DETAILS_ERROR`

Pour tout logger, activer dans Render :

```env
DEBUG_PRESSERO_PRODUCT_LOOKUP=1
```

Puis redeployer le service.

## Que regarder dans Render Logs

Chercher :

```text
[PRESSERO PRODUCT LOOKUP]
```

Les logs indiquent :

- `presseroBaseUrl`
- `presseroProductSiteDomain`
- l'URL appelée
- le corps de recherche envoyé à l'API Pressero
- la valeur recherchée
- la valeur normalisée
- le nombre d'items retournés
- les candidats retournés quand il y a un résultat non exact
- la réponse API en cas d'erreur

## Interprétation des cas

### Cas 1 - NOT_FOUND avec 0 item retourné

Si le log indique `NOT_FOUND` et `totalItemsReturned = 0`, cela veut dire que l'API Pressero ne retourne aucun produit pour ce `Component ID`.

Causes probables :

- mauvais `PRESSERO_PRODUCT_SITE_DOMAIN`
- l'endpoint `/api/site/{domain}/products` ne voit pas le même catalogue que l'export produit
- le produit existe mais n'est pas retourné par le filtre API `contains`
- différence invisible dans le nom : espace insécable, double espace, tiret spécial, caractère masqué

### Cas 2 - NO_EXACT_MATCH

Si le log indique `NO_EXACT_MATCH`, l'API retourne des candidats, mais aucun nom ne correspond exactement après normalisation.

Le code prend alors le premier candidat retourné.

Ce cas est dangereux car il peut relier le composant au mauvais produit.

### Cas 3 - PRODUCT_DETAILS_ERROR

Le produit est trouvé dans la liste, mais l'appel détail produit échoue.

Le composant passe alors en `PARTIAL_OK`, pas en `NOT_FOUND`.

## Requête à comparer

Pour un composant en erreur, comparer dans les logs :

```text
searchValue
normalizedTarget
presseroProductSiteDomain
url
```

Puis vérifier dans l'export produit Pressero que `Product Name` correspond exactement au `searchValue`.

## Hypothèse actuelle la plus probable

Après comparaison des fichiers Excel fournis :

- les `Component ID` de l'import kits existent bien dans l'export produits Pressero
- les composants marqués `NOT_FOUND` dans le kit export existent aussi dans l'export produits

La cause la plus probable n'est donc pas la structure Excel, mais une différence entre :

- ce que l'export produit contient
- ce que l'API `/api/site/{domain}/products` retourne réellement au moment de la synchronisation

## Procédure de test recommandée

1. Vérifier que Render contient bien :

```env
PRESSERO_PRODUCT_SITE_DOMAIN=bricotest.ams.v6.pressero.com
```

2. Activer temporairement :

```env
DEBUG_PRESSERO_PRODUCT_LOOKUP=1
```

3. Redéployer.
4. Lancer une synchro sur quelques composants `NOT_FOUND` seulement, idéalement avec `sync-pending` en limite basse.
5. Copier les logs `[PRESSERO PRODUCT LOOKUP]`.
6. Comparer les candidats retournés avec l'export produit Pressero.

## Important

Ne jamais logger :

- mot de passe Pressero
- token complet
- ConsumerID si considéré sensible

Les logs ajoutés ne doivent pas exposer ces secrets.
