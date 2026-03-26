const express = require("express");
const cors = require("cors");
const path = require("path");

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

app.use("/admin-ui", express.static(path.join(__dirname, "public/admin")));

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