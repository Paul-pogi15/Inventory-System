const { sql } = require("@vercel/postgres");

function mapProduct(row) {
  return {
    id: Number(row.id),
    name: row.name,
    category: row.category,
    price: Number(row.price),
    quantity: Number(row.quantity),
    unit: row.unit,
    created_at: new Date(row.created_at).toISOString(),
  };
}

function mapHistory(row) {
  return {
    id: Number(row.id),
    productId: Number(row.product_id),
    productName: row.product_name,
    type: row.type,
    quantity: Number(row.quantity),
    unit: row.unit,
    date: new Date(row.date).toISOString(),
  };
}

function createPostgresStorage() {
  return {
    async initialize(seedData = {}) {
      await sql`
        CREATE TABLE IF NOT EXISTS products (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          price NUMERIC(12, 2) NOT NULL,
          quantity NUMERIC(14, 3) NOT NULL,
          unit TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS stock_history (
          id BIGSERIAL PRIMARY KEY,
          product_id BIGINT NOT NULL,
          product_name TEXT NOT NULL,
          type TEXT NOT NULL,
          quantity NUMERIC(14, 3) NOT NULL,
          unit TEXT NOT NULL,
          date TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      const { rows } = await sql`SELECT COUNT(*) AS count FROM products`;
      if (Number(rows[0].count) === 0 && Array.isArray(seedData.products)) {
        for (const product of seedData.products) {
          await sql`
            INSERT INTO products (id, name, category, price, quantity, unit, created_at)
            VALUES (${product.id}, ${product.name}, ${product.category}, ${product.price},
                    ${product.quantity}, ${product.unit}, ${product.created_at})
            ON CONFLICT (id) DO NOTHING
          `;
        }
        await sql`SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE((SELECT MAX(id) FROM products), 1), true)`;
      }
    },
    async listProducts() {
      const { rows } = await sql`SELECT * FROM products ORDER BY id DESC`;
      return rows.map(mapProduct);
    },
    async getProduct(id) {
      const { rows } = await sql`SELECT * FROM products WHERE id = ${id}`;
      return rows[0] ? mapProduct(rows[0]) : null;
    },
    async addProduct(fields) {
      const { rows } = await sql`
        INSERT INTO products (name, category, price, quantity, unit)
        VALUES (${fields.name}, ${fields.category}, ${fields.price}, ${fields.quantity}, ${fields.unit})
        RETURNING *
      `;
      const product = mapProduct(rows[0]);
      if (product.quantity > 0) {
        await sql`
          INSERT INTO stock_history (product_id, product_name, type, quantity, unit, date)
          VALUES (${product.id}, ${product.name}, 'Stock In', ${product.quantity}, ${product.unit}, ${product.created_at})
        `;
      }
      return product;
    },
    async updateProduct(id, fields) {
      const { rows } = await sql`
        UPDATE products
        SET name = ${fields.name}, category = ${fields.category}, price = ${fields.price},
            quantity = ${fields.quantity}, unit = ${fields.unit}
        WHERE id = ${id}
        RETURNING *
      `;
      return rows[0] ? mapProduct(rows[0]) : null;
    },
    async deleteProduct(id) {
      const result = await sql`DELETE FROM products WHERE id = ${id}`;
      return result.rowCount > 0;
    },
    async changeStock(id, type, quantity) {
      const delta = type === "Stock In" ? quantity : -quantity;
      const { rows } = await sql`
        UPDATE products
        SET quantity = quantity + ${delta}
        WHERE id = ${id}
        RETURNING *
      `;
      if (!rows[0]) return null;
      const product = mapProduct(rows[0]);
      await sql`
        INSERT INTO stock_history (product_id, product_name, type, quantity, unit)
        VALUES (${product.id}, ${product.name}, ${type}, ${quantity}, ${product.unit})
      `;
      return product;
    },
    async listHistory() {
      const { rows } = await sql`SELECT * FROM stock_history ORDER BY id DESC`;
      return rows.map(mapHistory);
    },
    async dashboard() {
      const [productsResult, categoriesResult, historyResult] = await Promise.all([
        sql`SELECT COUNT(*) AS total_products,
                   COALESCE(SUM(quantity), 0) AS total_stock,
                   COALESCE(SUM(price * quantity), 0) AS inventory_value,
                   COUNT(*) FILTER (WHERE quantity > 0 AND quantity < 10) AS low_stock_products,
                   COUNT(*) FILTER (WHERE quantity = 0) AS out_of_stock_products
            FROM products`,
        sql`SELECT category, COUNT(*) AS product_count, COALESCE(SUM(quantity), 0) AS quantity
            FROM products GROUP BY category
            ORDER BY product_count DESC, category ASC`,
        sql`SELECT * FROM stock_history ORDER BY id DESC LIMIT 8`,
      ]);
      const stats = productsResult.rows[0];
      return {
        stats: {
          totalProducts: Number(stats.total_products),
          totalStock: Number(stats.total_stock),
          inventoryValue: Number(stats.inventory_value),
          lowStockProducts: Number(stats.low_stock_products),
          outOfStockProducts: Number(stats.out_of_stock_products),
        },
        categories: categoriesResult.rows.map((row) => ({
          category: row.category,
          productCount: Number(row.product_count),
          quantity: Number(row.quantity),
        })),
        recentTransactions: historyResult.rows.map(mapHistory),
      };
    },
  };
}

module.exports = { createPostgresStorage };
