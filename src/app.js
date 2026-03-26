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

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const adminUiPath = path.join(__dirname, "public", "admin");

console.log("ADMIN UI PATH =", adminUiPath);
console.log("INDEX EXISTS =", fs.existsSync(path.join(adminUiPath, "index.html")));
console.log("CSS EXISTS =", fs.existsSync(path.join(adminUiPath, "styles.css")));
console.log("APP JS EXISTS =", fs.existsSync(path.join(adminUiPath, "app.js")));

app.use("/admin-ui", express.static(adminUiPath));

app.get("/admin-ui", (req, res) => {
  res.sendFile(path.join(adminUiPath, "index.html"));
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/kits", kitRoutes);
app.use("/api/import", importRoutes);
app.use("/api/pressero", presseroRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/public", publicRoutes);

app.use(errorHandler);

module.exports = app;