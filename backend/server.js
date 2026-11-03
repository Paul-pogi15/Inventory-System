const express = require("express");
const cors = require("cors");
const path = require("node:path");
const fs = require("node:fs");
const { createStorage } = require("./storage");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const DATA_PATH = process.env.DATA_PATH || (
  process.env.VERCEL
    ? path.join("/tmp", "inventory-data.json")
    : path.join(__dirname, "..", "server", "Database", "inventory-data.json")
);
const FRONTEND_DIST_PATH = path.join(__dirname, "..", "frontend", "dist");
const MAX_QUANTITY = 2147483647;
const MAX_PRODUCT_PRICE = 99999999.99;
const UNITS = ["pcs", "boxes", "dozen", "pairs", "packs", "sets", "bottles", "kg", "L", "other"];

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const storage = createStorage(DATA_PATH);

function initializeStorage() {
  storage.initialize();
  console.log(`Using local inventory data file: ${DATA_PATH}`);
}

function validProductId(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  if (!/^[1-9]\d*$/.test(String(value))) {
    return null;
  }
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validQuantity(value, unit, allowZero) {
  const hasQuantity =
    (typeof value === "number" && Number.isFinite(value)) ||
    (typeof value === "string" && value.trim() !== "");
  const quantity = Number(value);
  const decimalAllowed = unit === "kg" || unit === "L";
  const quantityPattern = decimalAllowed ? /^\d+(?:\.\d{1,3})?$/ : /^\d+$/;
  if (
    !hasQuantity ||
    !quantityPattern.test(String(value).trim()) ||
    !Number.isFinite(quantity) ||
    quantity < (allowZero ? 0 : Number.MIN_VALUE) ||
    quantity > MAX_QUANTITY
  ) {
    return null;
  }
  return quantity;
}

function validProductFields(body = {}, defaultUnit = "pcs") {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const hasPrice =
    (typeof body.price === "number" && Number.isFinite(body.price)) ||
    (typeof body.price === "string" && body.price.trim() !== "");
  const price = Number(body.price);
  const unit = body.unit === undefined ? defaultUnit : body.unit;
  const quantity = validQuantity(body.quantity, unit, true);

  if (!name || name.length > 255 || !category || category.length > 255) {
    return { error: "Enter a product name and category (up to 255 characters)." };
  }
  if (typeof unit !== "string" || !UNITS.includes(unit)) {
    return { error: "Choose a valid unit of measurement." };
  }
  if (!hasPrice || !Number.isFinite(price) || price < 0 || price > MAX_PRODUCT_PRICE) {
    return { error: "Price must be between 0 and 99,999,999.99." };
  }
  if (quantity === null) {
    return { error: unit === "kg" || unit === "L"
      ? "Quantity must be between 0 and 2,147,483,647 with up to 3 decimal places."
      : "Quantity must be a whole number between 0 and 2,147,483,647 for this unit." };
  }
  return { name, category, price, quantity, unit };
}

function validTransaction(body = {}, unit) {
  const productId = validProductId(body.productId);
  if (!productId) {
    return { error: "Select a valid product." };
  }
  if (unit === undefined) {
    return { productId };
  }
  const quantity = validQuantity(body.quantity, unit, false);
  if (quantity === null) {
    return { error: unit === "kg" || unit === "L"
      ? "Quantity must be positive with up to 3 decimal places."
      : "Quantity must be a positive whole number for this unit." };
  }
  return { productId, quantity };
}

function reportError(label, error) {
  console.error(`${label}:`, error);
}

app.get("/api/products", async (req, res) => {
  try {
    res.json(storage.listProducts());
  } catch (error) {
    reportError("Failed to load products", error);
    res.status(500).json({ message: "Failed to load products." });
  }
});

app.post("/api/products", async (req, res) => {
  const product = validProductFields(req.body || {});
  if (product.error) {
    return res.status(400).json({ message: product.error });
  }

  try {
    res.status(201).json(storage.addProduct(product));
  } catch (error) {
    reportError("Failed to add product", error);
    res.status(500).json({ message: "Failed to add product." });
  }
});

app.put("/api/products/:id", async (req, res) => {
  const id = validProductId(req.params.id);
  if (!id) {
    return res.status(400).json({ message: "Product ID is invalid." });
  }

  try {
    const existing = storage.getProduct(id);
    if (!existing) {
      return res.status(404).json({ message: "Product not found." });
    }
    const product = validProductFields(req.body || {}, existing.unit);
    if (product.error) {
      return res.status(400).json({ message: product.error });
    }
    if (product.unit !== existing.unit && Number(existing.quantity) > 0) {
      return res.status(400).json({ message: "The unit cannot be changed while this product has stock. Remove or use the current stock first." });
    }
    res.json(storage.updateProduct(id, product));
  } catch (error) {
    reportError("Failed to update product", error);
    res.status(500).json({ message: "Failed to update product." });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  const id = validProductId(req.params.id);
  if (!id) {
    return res.status(400).json({ message: "Product ID is invalid." });
  }

  try {
    if (!storage.deleteProduct(id)) {
      return res.status(404).json({ message: "Product not found." });
    }
    res.json({ message: "Product deleted." });
  } catch (error) {
    reportError("Failed to delete product", error);
    res.status(500).json({ message: "Failed to delete product." });
  }
});

async function recordStockChange(req, res, type) {
  const initialTransaction = validTransaction(req.body || {});
  if (initialTransaction.error) {
    return res.status(400).json({ message: initialTransaction.error });
  }

  try {
    const product = storage.getProduct(initialTransaction.productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    const transaction = validTransaction(req.body || {}, product.unit);
    if (transaction.error) {
      return res.status(400).json({ message: transaction.error });
    }
    const currentQuantity = Number(product.quantity);
    if (type === "Stock Out" && transaction.quantity > currentQuantity) {
      return res.status(400).json({ message: "Not enough stock available." });
    }
    const newQuantity =
      type === "Stock In"
        ? currentQuantity + transaction.quantity
        : currentQuantity - transaction.quantity;
    if (!Number.isFinite(newQuantity) || newQuantity > MAX_QUANTITY) {
      return res.status(400).json({ message: "The resulting stock quantity is too large." });
    }

    res.json(storage.changeStock(transaction.productId, type, transaction.quantity));
  } catch (error) {
    reportError(`Failed to record ${type.toLowerCase()}`, error);
    res.status(500).json({ message: `Failed to record ${type.toLowerCase()}.` });
  }
}

app.post("/api/stock-in", (req, res) => recordStockChange(req, res, "Stock In"));
app.post("/api/stock-out", (req, res) => recordStockChange(req, res, "Stock Out"));

app.get("/api/stock-history", async (req, res) => {
  try {
    res.json(storage.listHistory());
  } catch (error) {
    reportError("Failed to load stock history", error);
    res.status(500).json({ message: "Failed to load stock history." });
  }
});

app.get("/api/dashboard", async (req, res) => {
  try {
    res.json(storage.dashboard());
  } catch (error) {
    reportError("Failed to load dashboard", error);
    res.status(500).json({ message: "Failed to load dashboard." });
  }
});

if (fs.existsSync(FRONTEND_DIST_PATH)) {
  app.use(express.static(FRONTEND_DIST_PATH));
}

app.use((req, res, next) => {
  if (
    req.method !== "GET" ||
    req.path.startsWith("/api/") ||
    !fs.existsSync(path.join(FRONTEND_DIST_PATH, "index.html"))
  ) {
    return next();
  }
  return res.sendFile(path.join(FRONTEND_DIST_PATH, "index.html"));
});

app.get("/", (req, res) => {
  res.send("Inventory System Backend is Running");
});

function startServer() {
  try {
    initializeStorage();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    reportError("Local inventory data initialization failed", error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
} else {
  initializeStorage();
}

module.exports = app;
