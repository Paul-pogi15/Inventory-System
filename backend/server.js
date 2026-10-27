const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const DB_NAME = process.env.DB_NAME || "inventory_system";

if (!/^[a-zA-Z0-9_]+$/.test(DB_NAME)) {
  throw new Error("DB_NAME may contain only letters, numbers, and underscores.");
}

const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};
const MAX_DB_QUANTITY = 2147483647;
const MAX_PRODUCT_PRICE = 99999999.99;
const UNITS = ["pcs", "boxes", "dozen", "pairs", "packs", "sets", "bottles", "kg", "L", "other"];

app.use(cors());
app.use(express.json({ limit: "1mb" }));

let db;

async function initDatabase() {
  const connection = await mysql.createConnection({
    host: DB_CONFIG.host,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
    port: DB_CONFIG.port,
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await connection.end();

  db = mysql.createPool(DB_CONFIG);
  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(255) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
      quantity DECIMAL(13,3) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS stock_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      productId INT NOT NULL,
      productName VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      quantity DECIMAL(13,3) NOT NULL,
      unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
      date VARCHAR(255) NOT NULL
    )
  `);

  const [productColumns] = await db.execute(
    "SELECT COLUMN_NAME, DATA_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
    [DB_NAME, "products"]
  );
  const productColumnNames = new Set(productColumns.map((column) => column.COLUMN_NAME));
  if (!productColumnNames.has("unit")) {
    await db.query("ALTER TABLE products ADD COLUMN unit VARCHAR(20) NOT NULL DEFAULT 'pcs' AFTER price");
  }
  const productQuantityColumn = productColumns.find((column) => column.COLUMN_NAME === "quantity");
  if (
    productQuantityColumn.DATA_TYPE !== "decimal" ||
    Number(productQuantityColumn.NUMERIC_PRECISION) !== 13 ||
    Number(productQuantityColumn.NUMERIC_SCALE) !== 3
  ) {
    await db.query("ALTER TABLE products MODIFY quantity DECIMAL(13,3) NOT NULL");
  }

  const [historyColumns] = await db.execute(
    "SELECT COLUMN_NAME, DATA_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
    [DB_NAME, "stock_history"]
  );
  const historyColumnNames = new Set(historyColumns.map((column) => column.COLUMN_NAME));
  const historyUnitAdded = !historyColumnNames.has("unit");
  if (historyUnitAdded) {
    await db.query("ALTER TABLE stock_history ADD COLUMN unit VARCHAR(20) NOT NULL DEFAULT 'pcs' AFTER quantity");
  }
  const historyQuantityColumn = historyColumns.find((column) => column.COLUMN_NAME === "quantity");
  if (
    historyQuantityColumn.DATA_TYPE !== "decimal" ||
    Number(historyQuantityColumn.NUMERIC_PRECISION) !== 13 ||
    Number(historyQuantityColumn.NUMERIC_SCALE) !== 3
  ) {
    await db.query("ALTER TABLE stock_history MODIFY quantity DECIMAL(13,3) NOT NULL");
  }
  if (historyUnitAdded) {
    await db.query(`
      UPDATE stock_history AS history
      INNER JOIN products AS product ON product.id = history.productId
      SET history.unit = product.unit
    `);
  }

  const [tableEngines] = await db.execute(
    "SELECT TABLE_NAME, ENGINE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('products', 'stock_history')",
    [DB_NAME]
  );
  for (const table of tableEngines) {
    if (table.ENGINE !== "InnoDB") {
      await db.query(`ALTER TABLE \`${table.TABLE_NAME}\` ENGINE=InnoDB`);
    }
  }

  console.log(`Connected to MySQL database: ${DB_NAME}`);
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
    quantity > MAX_DB_QUANTITY
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
    const [rows] = await db.execute("SELECT * FROM products ORDER BY id DESC");
    res.json(rows);
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
    const [result] = await db.execute(
      "INSERT INTO products (name, category, price, quantity, unit) VALUES (?, ?, ?, ?, ?)",
      [product.name, product.category, product.price, product.quantity, product.unit]
    );
    const [rows] = await db.execute("SELECT * FROM products WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
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
    const [existing] = await db.execute("SELECT id, unit, quantity FROM products WHERE id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: "Product not found." });
    }
    const product = validProductFields(req.body || {}, existing[0].unit);
    if (product.error) {
      return res.status(400).json({ message: product.error });
    }
    if (product.unit !== existing[0].unit && Number(existing[0].quantity) > 0) {
      return res.status(400).json({ message: "The unit cannot be changed while this product has stock. Remove or use the current stock first." });
    }
    await db.execute(
      "UPDATE products SET name = ?, category = ?, price = ?, quantity = ?, unit = ? WHERE id = ?",
      [product.name, product.category, product.price, product.quantity, product.unit, id]
    );
    const [rows] = await db.execute("SELECT * FROM products WHERE id = ?", [id]);
    res.json(rows[0]);
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
    const [result] = await db.execute("DELETE FROM products WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
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

  let connection;
  let transactionStarted = false;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [rows] = await connection.execute(
      "SELECT * FROM products WHERE id = ? FOR UPDATE",
      [initialTransaction.productId]
    );
    if (rows.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ message: "Product not found." });
    }

    const product = rows[0];
    const transaction = validTransaction(req.body || {}, product.unit);
    if (transaction.error) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({ message: transaction.error });
    }
    const currentQuantity = Number(product.quantity);
    if (type === "Stock Out" && transaction.quantity > currentQuantity) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({ message: "Not enough stock available." });
    }
    const newQuantity =
      type === "Stock In"
        ? currentQuantity + transaction.quantity
        : currentQuantity - transaction.quantity;
    if (!Number.isFinite(newQuantity) || newQuantity > MAX_DB_QUANTITY) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({ message: "The resulting stock quantity is too large." });
    }

    await connection.execute("UPDATE products SET quantity = ? WHERE id = ?", [
      newQuantity,
      transaction.productId,
    ]);
    await connection.execute(
      "INSERT INTO stock_history (productId, productName, type, quantity, unit, date) VALUES (?, ?, ?, ?, ?, ?)",
      [product.id, product.name, type, transaction.quantity, product.unit, new Date().toISOString()]
    );
    const [updated] = await connection.execute("SELECT * FROM products WHERE id = ?", [
      transaction.productId,
    ]);
    await connection.commit();
    transactionStarted = false;
    res.json(updated[0]);
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        reportError("Failed to roll back stock transaction", rollbackError);
      }
    }
    reportError(`Failed to record ${type.toLowerCase()}`, error);
    res.status(500).json({ message: `Failed to record ${type.toLowerCase()}.` });
  } finally {
    if (connection) connection.release();
  }
}

app.post("/api/stock-in", (req, res) => recordStockChange(req, res, "Stock In"));
app.post("/api/stock-out", (req, res) => recordStockChange(req, res, "Stock Out"));

app.get("/api/stock-history", async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT * FROM stock_history ORDER BY id DESC");
    res.json(rows);
  } catch (error) {
    reportError("Failed to load stock history", error);
    res.status(500).json({ message: "Failed to load stock history." });
  }
});

app.get("/api/dashboard", async (req, res) => {
  try {
    const [[stats]] = await db.execute(`
      SELECT
        COUNT(*) AS totalProducts,
        COALESCE(SUM(quantity), 0) AS totalStock,
        COALESCE(SUM(price * quantity), 0) AS inventoryValue,
        COALESCE(SUM(CASE WHEN quantity > 0 AND quantity < 10 THEN 1 ELSE 0 END), 0) AS lowStockProducts,
        COALESCE(SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END), 0) AS outOfStockProducts
      FROM products
    `);
    const [categories] = await db.execute(`
      SELECT category, COUNT(*) AS productCount, COALESCE(SUM(quantity), 0) AS quantity
      FROM products
      GROUP BY category
      ORDER BY productCount DESC, category ASC
    `);
    const [recentTransactions] = await db.execute(
      "SELECT * FROM stock_history ORDER BY id DESC LIMIT 8"
    );
    res.json({ stats, categories, recentTransactions });
  } catch (error) {
    reportError("Failed to load dashboard", error);
    res.status(500).json({ message: "Failed to load dashboard." });
  }
});

app.get("/", (req, res) => {
  res.send("Inventory System Backend is Running");
});

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    reportError("MySQL connection failed", error);
    process.exit(1);
  }
}

startServer();
