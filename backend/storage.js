const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_DATA = { nextProductId: 1, nextHistoryId: 1, products: [], stockHistory: [] };

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createStorage(filePath) {
  let data;

  function save() {
    const temporaryPath = `${filePath}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    fs.renameSync(temporaryPath, filePath);
  }

  function initialize() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath)) {
      data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      data.nextProductId = Number(data.nextProductId) || 1;
      data.nextHistoryId = Number(data.nextHistoryId) || 1;
      data.products = Array.isArray(data.products) ? data.products : [];
      data.stockHistory = Array.isArray(data.stockHistory) ? data.stockHistory : [];
      return;
    }
    data = clone(DEFAULT_DATA);
    save();
  }

  function findProduct(id) {
    return data.products.find((product) => product.id === id);
  }

  return {
    initialize,
    listProducts() {
      return clone([...data.products].sort((a, b) => b.id - a.id));
    },
    getProduct(id) {
      const product = findProduct(id);
      return product ? clone(product) : null;
    },
    addProduct(fields) {
      const product = {
        id: data.nextProductId++,
        ...fields,
        created_at: new Date().toISOString(),
      };
      data.products.push(product);
      if (product.quantity > 0) {
        data.stockHistory.push({
          id: data.nextHistoryId++,
          productId: product.id,
          productName: product.name,
          type: "Stock In",
          quantity: product.quantity,
          unit: product.unit,
          date: product.created_at,
        });
      }
      save();
      return clone(product);
    },
    updateProduct(id, fields) {
      const product = findProduct(id);
      if (!product) return null;
      Object.assign(product, fields);
      save();
      return clone(product);
    },
    deleteProduct(id) {
      const index = data.products.findIndex((product) => product.id === id);
      if (index < 0) return false;
      data.products.splice(index, 1);
      save();
      return true;
    },
    changeStock(id, type, quantity) {
      const product = findProduct(id);
      if (!product) return null;
      product.quantity = type === "Stock In"
        ? product.quantity + quantity
        : product.quantity - quantity;
      data.stockHistory.push({
        id: data.nextHistoryId++,
        productId: product.id,
        productName: product.name,
        type,
        quantity,
        unit: product.unit,
        date: new Date().toISOString(),
      });
      save();
      return clone(product);
    },
    listHistory() {
      return clone([...data.stockHistory].sort((a, b) => b.id - a.id));
    },
    dashboard() {
      const categories = new Map();
      for (const product of data.products) {
        const category = categories.get(product.category) || { category: product.category, productCount: 0, quantity: 0 };
        category.productCount += 1;
        category.quantity += product.quantity;
        categories.set(product.category, category);
      }
      return {
        stats: {
          totalProducts: data.products.length,
          totalStock: data.products.reduce((sum, product) => sum + product.quantity, 0),
          inventoryValue: data.products.reduce((sum, product) => sum + product.price * product.quantity, 0),
          lowStockProducts: data.products.filter((product) => product.quantity > 0 && product.quantity < 10).length,
          outOfStockProducts: data.products.filter((product) => product.quantity === 0).length,
        },
        categories: [...categories.values()].sort((a, b) => b.productCount - a.productCount || a.category.localeCompare(b.category)),
        recentTransactions: [...data.stockHistory].sort((a, b) => b.id - a.id).slice(0, 8),
      };
    },
  };
}

module.exports = { createStorage };
