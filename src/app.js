const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const kitRoutes = require("./routes/kitRoutes");
const importRoutes = require("./routes/importRoutes");
const presseroRoutes = require("./routes/presseroRoutes");
const adminRoutes = require("./routes/adminRoutes");
const publicRoutes = require("./routes/publicRoutes");
const errorHandler = require("./middlewares/errorHandler");

const storesRoutes = require("./routes/stores");
const productsRoutes = require("./routes/products");
const importsRoutes = require("./routes/imports");
const ordersRoutes = require("./routes/orders");
const orderSubmitRoutes = require("./routes/orders-submit");
const backofficeRoutes = require("./routes/backoffice");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const adminUiPath = path.join(__dirname, "public", "admin");
const kitUiPath = path.join(__dirname, "public", "kit-ui");

console.log("ADMIN UI PATH =", adminUiPath);
console.log("INDEX EXISTS =", fs.existsSync(path.join(adminUiPath, "index.html")));
console.log("CSS EXISTS =", fs.existsSync(path.join(adminUiPath, "styles.css")));
console.log("APP JS EXISTS =", fs.existsSync(path.join(adminUiPath, "app.js")));

app.use("/admin-ui", express.static(adminUiPath));
app.get("/admin-ui", (req, res) => {
  res.sendFile(path.join(adminUiPath, "index.html"));
});

// nouveau : accès direct aux scripts du dossier admin
app.use("/admin", express.static(adminUiPath));

app.use("/kit-ui-assets", express.static(kitUiPath));

app.get("/kit-ui", (req, res) => {
  res.sendFile(path.join(kitUiPath, "index.html"));
});

app.get("/kit-ui-loader.js", (req, res) => {
  res.sendFile(path.join(kitUiPath, "loader.js"));
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/kits", kitRoutes);
app.use("/api/import", importRoutes);
app.use("/api/pressero", presseroRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/public", publicRoutes);

// nouvelles routes
app.use("/api/stores", storesRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/imports", importsRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/orders", orderSubmitRoutes);
app.use("/api/backoffice", backofficeRoutes);

app.use(errorHandler);

module.exports = app;