import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const API = `${(import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "")}/api`;
const CATEGORIES = ["Shoes", "Clothes", "Bags", "Drinks", "Electronics", "Accessories", "Other"];
const UNITS = [
  ["pcs", "Pieces (pcs)"], ["boxes", "Boxes (boxes)"], ["dozen", "Dozens (dozen)"],
  ["pairs", "Pairs (pairs)"], ["packs", "Packs (packs)"], ["sets", "Sets (sets)"],
  ["bottles", "Bottles (bottles)"], ["kg", "Kilograms (kg)"], ["L", "Liters (L)"],
  ["other", "Other"],
];
const PAGE_SIZE = 8;
const EMPTY_FORM = { name: "", category: "Shoes", price: "", unit: "pcs", quantity: "" };

const icons = {
  dashboard: "M3 3h8v8H3z M13 3h8v5h-8z M13 10h8v11h-8z M3 13h8v8H3z",
  products: "M4 7 12 3l8 4v10l-8 4-8-4z M4 7l8 4 8-4 M12 11v10",
  add: "M12 5v14 M5 12h14",
  inbound: "M12 19V5 M6 11l6-6 6 6",
  outbound: "M12 5v14 M6 13l6 6 6-6",
  history: "M3 12a9 9 0 1 0 2.6-6.4L3 8 M3 3v5h5 M12 7v5l3 2",
  search: "m20 20-4.5-4.5 M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  close: "M18 6 6 18 M6 6l12 12",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  edit: "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z",
  trash: "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v5 M14 11v5",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  up: "M7 14l5-5 5 5",
  down: "M7 10l5 5 5-5",
  package: "M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z M3.3 7 12 12l8.7-5 M12 22V12 M7.5 4.2l9 5.2",
  money: "M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  warning: "M10.3 3.9 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z M12 9v4 M12 17h.01",
  check: "m5 12 4 4L19 6",
  calendar: "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z",
  printer: "M6 9V3h12v6 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v7H6z M18 12h.01",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
};

function Icon({ name, size = 18, className = "" }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d={icons[name] || icons.package} />
    </svg>
  );
}

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${API}${path}`, options);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "The inventory server is unavailable. Start MySQL in XAMPP, then run npm.cmd run dev in the backend folder and refresh this page.",
        { cause: error }
      );
    }
    throw error;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "The request could not be completed.");
  return data;
}

const normalizeProduct = (product) => ({
  ...product,
  id: Number(product.id),
  price: Number(product.price),
  quantity: Number(product.quantity),
  unit: product.unit || "pcs",
});

const unitLabel = (unit) => UNITS.find(([value]) => value === unit)?.[1] || "Pieces (pcs)";
const quantityIsDecimal = (unit) => unit === "kg" || unit === "L";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value || "—"
    : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function StockStatus({ quantity }) {
  const status = quantity <= 0 ? "Out of stock" : quantity < 10 ? "Low stock" : "In stock";
  return <span className={`status-badge ${quantity <= 0 ? "status-out" : quantity < 10 ? "status-low" : "status-in"}`}>{status}</span>;
}

function ProductForm({ initial = EMPTY_FORM, saving, onSubmit, onCancel, submitText }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const categories = [...new Set([...CATEGORIES, ...(initial.category ? [initial.category] : [])])];

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Enter a product name.";
    if (!form.category) nextErrors.category = "Choose a category.";
    if (form.price === "" || !Number.isFinite(Number(form.price)) || Number(form.price) < 0) {
      nextErrors.price = "Enter a valid price of 0 or more.";
    }
    const quantityPattern = quantityIsDecimal(form.unit) ? /^\d+(?:\.\d{1,3})?$/ : /^\d+$/;
    if (form.quantity === "" || !quantityPattern.test(form.quantity) || Number(form.quantity) < 0) {
      nextErrors.quantity = quantityIsDecimal(form.unit)
        ? "Enter a quantity with up to 3 decimal places."
        : "Enter a whole quantity for this unit.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const saved = await onSubmit({ ...form, name: form.name.trim(), price: Number(form.price), quantity: Number(form.quantity) });
    if (saved && !initial.id) setForm(EMPTY_FORM);
  }

  return (
    <form className="product-form" onSubmit={submit} noValidate>
      <div className="form-grid">
        <div className={`form-group ${errors.name ? "has-error" : ""}`}>
          <label htmlFor="product-name">Product name <span>*</span></label>
          <input id="product-name" autoFocus type="text" maxLength="255" placeholder="e.g. Everyday running shoes"
            value={form.name} onChange={(event) => update("name", event.target.value)} aria-describedby="name-error" />
          {errors.name && <small id="name-error" className="field-error">{errors.name}</small>}
        </div>
        <div className={`form-group ${errors.category ? "has-error" : ""}`}>
          <label htmlFor="product-category">Category <span>*</span></label>
          <select id="product-category" value={form.category} onChange={(event) => update("category", event.target.value)}>
            {categories.map((category) => <option key={category}>{category}</option>)}
          </select>
          {errors.category && <small className="field-error">{errors.category}</small>}
        </div>
        <div className={`form-group ${errors.price ? "has-error" : ""}`}>
          <label htmlFor="product-price">Unit price <span>*</span></label>
          <div className="input-prefix"><span>₱</span><input id="product-price" type="number" min="0" step="0.01" placeholder="0.00"
            value={form.price} onChange={(event) => update("price", event.target.value)} aria-describedby="price-error" /></div>
          {errors.price && <small id="price-error" className="field-error">{errors.price}</small>}
        </div>
        <div className={`form-group ${errors.unit ? "has-error" : ""}`}>
          <label htmlFor="product-unit">Unit of measurement <span>*</span></label>
          <select id="product-unit" value={form.unit || "pcs"} disabled={Boolean(initial.id && Number(initial.quantity) > 0)}
            title={initial.id && Number(initial.quantity) > 0 ? "Unit cannot change while stock is on hand." : undefined}
            onChange={(event) => update("unit", event.target.value)}>
            {UNITS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          {initial.id && Number(initial.quantity) > 0 && <small className="form-hint">Unit is locked while stock is on hand.</small>}
          {errors.unit && <small className="field-error">{errors.unit}</small>}
        </div>
        <div className={`form-group ${errors.quantity ? "has-error" : ""}`}>
          <label htmlFor="product-quantity">{initial.id ? "Quantity" : "Initial quantity"} ({(form.unit || "pcs")}) <span>*</span></label>
          <input id="product-quantity" type="number" min="0" step={quantityIsDecimal(form.unit) ? "0.001" : "1"} placeholder="0"
            value={form.quantity} onChange={(event) => update("quantity", event.target.value)} aria-describedby="quantity-error" />
          {errors.quantity && <small id="quantity-error" className="field-error">{errors.quantity}</small>}
        </div>
      </div>
      <div className="form-actions">
        {onCancel && <button type="button" className="button button-light" onClick={onCancel}>Cancel</button>}
        <button className="button button-primary" type="submit" disabled={saving}>
          {saving && <span className="spinner spinner-small" />} {saving ? "Saving…" : submitText}
        </button>
      </div>
    </form>
  );
}

function App() {
  const [page, setPage] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState({ products: true, history: true });
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [stockStatusFilter, setStockStatusFilter] = useState("All stock levels");
  const [productSort, setProductSort] = useState("newest");
  const [productPage, setProductPage] = useState(1);
  const [historySearch, setHistorySearch] = useState("");
  const [historyType, setHistoryType] = useState("All types");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historySort, setHistorySort] = useState("newest");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [modal, setModal] = useState(null);

  function notify(message, type = "success") {
    setToast({ message, type });
  }

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadProducts = useCallback(async () => {
    setLoading((current) => ({ ...current, products: true }));
    try {
      const data = await request("/products");
      setProducts(Array.isArray(data) ? data.map(normalizeProduct) : []);
      setErrors((current) => ({ ...current, products: "" }));
    } catch (error) {
      setErrors((current) => ({ ...current, products: error.message }));
    } finally {
      setLoading((current) => ({ ...current, products: false }));
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading((current) => ({ ...current, history: true }));
    try {
      const data = await request("/stock-history");
      setHistory(Array.isArray(data) ? data : []);
      setErrors((current) => ({ ...current, history: "" }));
    } catch (error) {
      setErrors((current) => ({ ...current, history: error.message }));
    } finally {
      setLoading((current) => ({ ...current, history: false }));
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadProducts(), loadHistory()]);
  }, [loadProducts, loadHistory]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  function navigate(nextPage) {
    setPage(nextPage);
    setMobileMenuOpen(false);
    if (nextPage !== "products") setGlobalSearch("");
  }

  async function saveProduct(product, id) {
    if (saving) return false;
    setSaving(true);
    try {
      await request(id ? `/products/${id}` : "/products", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
      await loadProducts();
      notify(id ? "Product updated successfully." : "Product added successfully.");
      setModal(null);
      if (!id) navigate("products");
      return true;
    } catch (error) {
      notify(error.message, "error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Delete “${product.name}”? This action cannot be undone.`)) return;
    try {
      await request(`/products/${product.id}`, { method: "DELETE" });
      await loadProducts();
      notify("Product deleted.");
    } catch (error) {
      notify(error.message, "error");
    }
  }

  async function submitStock(event, type) {
    event.preventDefault();
    if (saving) return;
    const product = products.find((item) => item.id === Number(selectedProduct));
    const quantityPattern = product && quantityIsDecimal(product.unit) ? /^\d+(?:\.\d{1,3})?$/ : /^[1-9]\d*$/;
    if (!selectedProduct || !quantityPattern.test(stockQuantity) || Number(stockQuantity) <= 0) {
      notify(product && quantityIsDecimal(product.unit)
        ? "Select a product and enter a positive quantity with up to 3 decimal places."
        : "Select a product and enter a positive whole quantity.", "error");
      return;
    }
    const amount = Number(stockQuantity);
    if (!product) {
      notify("That product is no longer available. Refresh and try again.", "error");
      return;
    }
    if (type === "out" && amount > product.quantity) {
      notify("Stock out quantity cannot exceed available stock.", "error");
      return;
    }
    if (type === "out") {
      setModal({ kind: "stock-confirm", product, amount });
      return;
    }
    await performStock(type, product, amount);
  }

  async function performStock(type, product, amount) {
    if (saving) return;
    setSaving(true);
    try {
      await request(`/stock-${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: amount }),
      });
      await refreshAll();
      setStockQuantity("");
      setSelectedProduct("");
      setModal(null);
      notify(type === "in" ? "Stock added successfully." : "Stock removed successfully.");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  const currentStockProduct = products.find((item) => item.id === Number(selectedProduct));
  const quantityValue = Number(stockQuantity);
  const stockAmountValid = currentStockProduct
    ? (quantityIsDecimal(currentStockProduct.unit) ? /^\d+(?:\.\d{1,3})?$/.test(stockQuantity) : /^[1-9]\d*$/.test(stockQuantity)) && quantityValue > 0
    : false;
  const stockWouldExceed = page === "stockout" && currentStockProduct && stockAmountValid && quantityValue > currentStockProduct.quantity;
  const productFiltered = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    const filtered = products.filter((item) => {
      const matchesSearch = !term || [item.name, item.category, String(item.id)].some((value) => value.toLowerCase().includes(term));
      const matchesCategory = categoryFilter === "All categories" || item.category === categoryFilter;
      const matchesStock = stockStatusFilter === "All stock levels" ||
        (stockStatusFilter === "Needs attention" && item.quantity < 10) ||
        (stockStatusFilter === "Low stock" && item.quantity > 0 && item.quantity < 10) ||
        (stockStatusFilter === "Out of stock" && item.quantity === 0);
      return matchesSearch && matchesCategory && matchesStock;
    });
    return filtered.sort((a, b) => {
      if (productSort === "name") return a.name.localeCompare(b.name);
      if (productSort === "price-low") return a.price - b.price;
      if (productSort === "price-high") return b.price - a.price;
      if (productSort === "quantity-low") return a.quantity - b.quantity;
      if (productSort === "quantity-high") return b.quantity - a.quantity;
      return b.id - a.id;
    });
  }, [products, productSearch, categoryFilter, stockStatusFilter, productSort]);
  const totalProductPages = Math.max(1, Math.ceil(productFiltered.length / PAGE_SIZE));
  const visibleProducts = productFiltered.slice((productPage - 1) * PAGE_SIZE, productPage * PAGE_SIZE);

  useEffect(() => setProductPage(1), [productSearch, categoryFilter, stockStatusFilter, productSort]);
  useEffect(() => {
    if (productPage > totalProductPages) setProductPage(totalProductPages);
  }, [productPage, totalProductPages]);

  const filteredHistory = useMemo(() => history.filter((item) => {
    const term = historySearch.trim().toLowerCase();
    const transactionId = `trx-${String(item.id).padStart(5, "0")}`;
    const matchesSearch = !term || [item.productName, String(item.id), transactionId].some((value) => value.toLowerCase().includes(term));
    const matchesType = historyType === "All types" || item.type === historyType;
    const timestamp = new Date(item.date).getTime();
    const from = historyFrom ? new Date(`${historyFrom}T00:00:00`).getTime() : null;
    const to = historyTo ? new Date(`${historyTo}T00:00:00`).getTime() + 24 * 60 * 60 * 1000 : null;
    const matchesFrom = !from || (!Number.isNaN(timestamp) && timestamp >= from);
    const matchesTo = !to || (!Number.isNaN(timestamp) && timestamp < to);
    return matchesSearch && matchesType && matchesFrom && matchesTo;
  }).sort((a, b) => historySort === "oldest" ? Number(a.id) - Number(b.id) : Number(b.id) - Number(a.id)), [
    history, historySearch, historyType, historyFrom, historyTo, historySort,
  ]);

  const stats = useMemo(() => ({
    totalProducts: products.length,
    productsWithStock: products.filter((product) => product.quantity > 0).length,
    inventoryValue: products.reduce((sum, product) => sum + product.price * product.quantity, 0),
    lowStockProducts: products.filter((product) => product.quantity > 0 && product.quantity < 10).length,
    outOfStockProducts: products.filter((product) => product.quantity === 0).length,
  }), [products]);
  const categoryData = useMemo(() => {
    const categories = new Map();
    products.forEach((product) => {
      const category = categories.get(product.category) || { category: product.category, productCount: 0, quantity: 0 };
      category.productCount += 1;
      category.quantity += product.quantity;
      categories.set(product.category, category);
    });
    return [...categories.values()].sort((a, b) => b.productCount - a.productCount || a.category.localeCompare(b.category));
  }, [products]);
  const recentTransactions = history.slice(0, 8);
  const dashboardLoading = loading.products || loading.history;
  const inboundTotal = history.filter((item) => item.type === "Stock In").reduce((sum, item) => sum + Number(item.quantity), 0);
  const outboundTotal = history.filter((item) => item.type === "Stock Out").reduce((sum, item) => sum + Number(item.quantity), 0);
  const maxCategoryCount = Math.max(1, ...categoryData.map((item) => Number(item.productCount)));
  const maxStockMovement = Math.max(1, inboundTotal, outboundTotal);

  function clearHistoryFilters() {
    setHistorySearch("");
    setHistoryType("All types");
    setHistoryFrom("");
    setHistoryTo("");
    setHistorySort("newest");
  }

  function historyFilterSummary() {
    return [
      `Search: ${historySearch.trim() || "All records"}`,
      `Type: ${historyType}`,
      `Date range: ${historyFrom || "Any"} to ${historyTo || "Any"}`,
      `Sort: ${historySort === "newest" ? "Newest first" : "Oldest first"}`,
    ].join(" | ");
  }

  function printHistory() {
    if (!filteredHistory.length) {
      notify("There are no matching transactions to print.", "error");
      return;
    }
    if (typeof window.print !== "function") {
      notify("Printing is not available in this browser.", "error");
      return;
    }
    try {
      window.print();
    } catch {
      notify("The print dialog could not be opened.", "error");
      return;
    }
    notify("Print dialog opened.");
  }

  function downloadHistory() {
    if (!filteredHistory.length) {
      notify("There are no matching transactions to download.", "error");
      return;
    }
    setExporting(true);
    try {
      const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
      const csvRows = [
        ["Transaction ID", "Product Name", "Transaction Type", "Quantity", "Unit", "Date and Time"],
        ...filteredHistory.map((item) => [
          item.id,
          item.productName,
          item.type,
          item.quantity,
          item.unit || "pcs",
          formatDate(item.date),
        ]),
      ];
      const csv = `\uFEFF${csvRows.map((row) => row.map(escapeCsv).join(",")).join("\r\n")}`;
      const blobUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      const today = new Date();
      const fileDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      link.href = blobUrl;
      link.download = `inventory_stock_history_${fileDate}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
      notify(`${filteredHistory.length} transaction${filteredHistory.length === 1 ? "" : "s"} downloaded.`);
    } catch {
      notify("The stock history CSV could not be created.", "error");
    } finally {
      setExporting(false);
    }
  }

  const navItems = [
    ["dashboard", "Dashboard", "dashboard"],
    ["products", "Item Records", "products"],
    ["add", "Add Product", "add"],
    ["stockin", "Stock In", "inbound"],
    ["stockout", "Stock Out", "outbound"],
    ["history", "Stock History", "history"],
  ];
  const titles = {
    dashboard: ["Overview", "A clear view of your inventory, at a glance."],
    products: ["Item Records", "Manage and keep track of every product."],
    add: ["Add Product", "Create a product record in your inventory."],
    stockin: ["Stock In", "Record incoming items and update your available stock."],
    stockout: ["Stock Out", "Record outgoing items and keep stock levels accurate."],
    history: ["Stock History", "A complete record of your inventory movements."],
  };

  return (
    <>
    <div className="app-shell">
      {mobileMenuOpen && <button aria-label="Close navigation menu" className="mobile-backdrop" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark"><Icon name="package" size={21} /></span>
          <span><strong>Stockwise</strong><small>INVENTORY MANAGEMENT</small></span>
          <button className="mobile-close" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)}><Icon name="close" /></button>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(([id, label, icon]) => (
            <button key={id} className={`nav-item ${page === id ? "active" : ""}`} onClick={() => navigate(id)}>
              <Icon name={icon} /><span>{label}</span>{id === "add" && <span className="nav-plus">+</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button className="menu-toggle" aria-label="Open navigation menu" onClick={() => setMobileMenuOpen(true)}><Icon name="menu" /></button>
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{titles[page][0]}</strong></div>
          <div className="topbar-right">
            <label className="global-search"><Icon name="search" size={17} /><input aria-label="Search products" placeholder="Search products…" value={globalSearch}
              onChange={(event) => { setGlobalSearch(event.target.value); setProductSearch(event.target.value); if (event.target.value) navigate("products"); }} /></label>
            <span className="topbar-divider" />
            <span className="today-date"><Icon name="calendar" size={16} />{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date())}</span>
            <button className="icon-button notification-button" title="View stock alerts" aria-label={`${Number(stats.lowStockProducts) + Number(stats.outOfStockProducts)} stock alerts. View items that need attention`}
              onClick={() => { setStockStatusFilter("Needs attention"); setCategoryFilter("All categories"); setProductSearch(""); navigate("products"); }}>
              <Icon name="bell" size={18} />
              {Number(stats.lowStockProducts) + Number(stats.outOfStockProducts) > 0 && <i />}
            </button>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div><div className="eyebrow">INVENTORY / {titles[page][0].toUpperCase()}</div><h1>{titles[page][0]}</h1><p>{titles[page][1]}</p></div>
            {page === "dashboard" && <button className="button button-primary" onClick={() => navigate("add")}><Icon name="add" size={17} /> Add product</button>}
          </div>

          {page === "dashboard" && (
            <>
              <section className="metric-grid" aria-label="Inventory summary">
                {[
                  { label: "Total products", value: dashboardLoading ? "—" : stats.totalProducts, icon: "products", color: "purple", hint: "Unique items tracked", action: () => navigate("products") },
                  { label: "Products with stock", value: dashboardLoading ? "—" : stats.productsWithStock, icon: "package", color: "blue", hint: "Each product keeps its own unit", action: () => navigate("products") },
                  { label: "Inventory value", value: dashboardLoading ? "—" : formatCurrency(stats.inventoryValue), icon: "money", color: "green", hint: "Based on price × quantity", action: () => navigate("products") },
                  { label: "Low-stock items", value: dashboardLoading ? "—" : stats.lowStockProducts, icon: "warning", color: "amber", hint: "More than 0, fewer than 10", action: () => { setCategoryFilter("All categories"); setStockStatusFilter("Low stock"); setProductSearch(""); navigate("products"); } },
                  { label: "Out of stock", value: dashboardLoading ? "—" : stats.outOfStockProducts, icon: "outbound", color: "red", hint: "Items needing replenishment", action: () => { setCategoryFilter("All categories"); setStockStatusFilter("Out of stock"); setProductSearch(""); navigate("products"); } },
                ].map((item) => (
                  <button className="metric-card" key={item.label} onClick={item.action}>
                    <span className={`metric-icon ${item.color}`}><Icon name={item.icon} size={20} /></span>
                    <span className="metric-copy"><span>{item.label}</span><strong>{item.value}</strong><small>{item.hint}</small></span>
                    <Icon name="arrow" size={16} className="metric-arrow" />
                  </button>
                ))}
              </section>

              <section className="dashboard-grid">
                <div className="panel chart-panel">
                  <div className="panel-heading"><div><h2>Products by category</h2><p>How your catalog is distributed</p></div>                  <button className="text-button" onClick={() => { setCategoryFilter("All categories"); navigate("products"); }}>View records <Icon name="arrow" size={15} /></button></div>
                  {loading.products ? <div className="panel-loading"><span className="spinner" />Loading categories…</div> : categoryData.length ? (
                    <div className="category-chart">{categoryData.map((item, index) => (
                      <button key={item.category} className="category-row" onClick={() => { setCategoryFilter(item.category); navigate("products"); }}>
                        <span className={`category-dot dot-${index % 5}`} /><span className="category-name">{item.category}</span>
                        <span className="bar-track"><i style={{ width: `${Math.max(3, Number(item.productCount) / maxCategoryCount * 100)}%` }} /></span>
                        <strong>{item.productCount}</strong>
                      </button>
                    ))}</div>
                  ) : <div className="empty-state compact"><span className="empty-symbol"><Icon name="products" /></span><strong>No categories yet</strong><p>Add products to see category distribution.</p><button className="button button-light" onClick={() => navigate("add")}>Add first product</button></div>}
                </div>
                <div className="panel movement-panel">
                  <div className="panel-heading"><div><h2>Stock movement</h2><p>Quantity moved across product units</p></div><span className="chart-period">All time</span></div>
                  {loading.history ? <div className="panel-loading"><span className="spinner" />Loading transactions…</div> : (
                    <div className="movement-chart">
                      <div className="movement-columns">
                        <div className="movement-column"><div className="movement-value">{inboundTotal.toLocaleString()}</div><div className="movement-track"><i className="movement-in" style={{ height: `${Math.max(6, inboundTotal / maxStockMovement * 100)}%` }} /></div><span>Stock in</span></div>
                        <div className="movement-column"><div className="movement-value">{outboundTotal.toLocaleString()}</div><div className="movement-track"><i className="movement-out" style={{ height: `${Math.max(6, outboundTotal / maxStockMovement * 100)}%` }} /></div><span>Stock out</span></div>
                      </div>
                      <div className="chart-legend"><span><i className="legend-in" />Received</span><span><i className="legend-out" />Dispatched</span></div>
                    </div>
                  )}
                  <div className="quick-actions"><span>Quick actions</span><div>
                    <button className="quick-action quick-add" onClick={() => navigate("add")}><Icon name="add" size={16} /> Add product</button>
                    <button className="quick-action quick-in" onClick={() => navigate("stockin")}><Icon name="inbound" size={16} /> Stock in</button>
                    <button className="quick-action quick-out" onClick={() => navigate("stockout")}><Icon name="outbound" size={16} /> Stock out</button>
                  </div></div>
                </div>
              </section>

              <section className="panel recent-panel">
                <div className="panel-heading"><div><h2>Recent transactions</h2><p>Your latest inventory activity</p></div><button className="text-button" onClick={() => navigate("history")}>View all <Icon name="arrow" size={15} /></button></div>
                {loading.history ? <div className="panel-loading"><span className="spinner" />Loading recent activity…</div> :
                  <TransactionTable rows={recentTransactions} compact onEmpty={() => navigate("stockin")} />}
              </section>
            </>
          )}

          {page === "products" && (
            <section className="panel table-panel">
              <div className="table-toolbar">
                <div><h2>All products <span className="count-chip">{productFiltered.length}</span></h2><p>Search, filter, and manage your item records.</p></div>
                <button className="button button-primary" onClick={() => navigate("add")}><Icon name="add" size={17} /> Add product</button>
              </div>
              <div className="filter-row">
                <label className="search-field"><Icon name="search" size={17} /><input placeholder="Search name, category or ID…" value={productSearch} aria-label="Search products"
                  onChange={(event) => { setProductSearch(event.target.value); setGlobalSearch(event.target.value); }} /></label>
                <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  <option>All categories</option>{[...new Set(products.map((item) => item.category))].sort().map((item) => <option key={item}>{item}</option>)}
                </select>
                <select aria-label="Filter by stock status" value={stockStatusFilter} onChange={(event) => setStockStatusFilter(event.target.value)}>
                  <option>All stock levels</option><option>Needs attention</option><option>Low stock</option><option>Out of stock</option>
                </select>
                <select aria-label="Sort products" value={productSort} onChange={(event) => setProductSort(event.target.value)}>
                  <option value="newest">Newest first</option><option value="name">Name A–Z</option>
                  <option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option>
                  <option value="quantity-low">Quantity: low to high</option><option value="quantity-high">Quantity: high to low</option>
                </select>
              </div>
              {errors.products && <div className="error-banner" role="alert">{errors.products}</div>}
              {loading.products ? <div className="table-loading"><span className="spinner" />Loading products…</div> :
                <div className="responsive-table"><table><thead><tr><th>Product</th><th>Category</th><th>Unit price</th><th>Quantity</th><th>Status</th><th className="actions-heading">Actions</th></tr></thead>
                  <tbody>{visibleProducts.length ? visibleProducts.map((product) => (
                    <tr key={product.id}>
                      <td><div className="product-cell"><span className="product-avatar">{product.name.trim().charAt(0).toUpperCase()}</span><span><strong>{product.name}</strong><small>SKU-{String(product.id).padStart(4, "0")}</small></span></div></td>
                      <td><span className="category-tag">{product.category}</span></td><td>{formatCurrency(product.price)}</td><td><strong>{product.quantity.toLocaleString()} {product.unit}</strong></td><td><StockStatus quantity={product.quantity} /></td>
                      <td><div className="row-actions">
                        <button className="action-icon" title={`View ${product.name}`} aria-label={`View ${product.name}`} onClick={() => setModal({ kind: "details", product })}><Icon name="eye" size={16} /></button>
                        <button className="action-icon" title={`Edit ${product.name}`} aria-label={`Edit ${product.name}`} onClick={() => setModal({ kind: "edit", product })}><Icon name="edit" size={16} /></button>
                        <button className="action-icon danger" title={`Delete ${product.name}`} aria-label={`Delete ${product.name}`} onClick={() => deleteProduct(product)}><Icon name="trash" size={16} /></button>
                      </div></td>
                    </tr>
                  )) : <tr><td colSpan="6"><div className="empty-state table-empty"><span className="empty-symbol"><Icon name="search" /></span><strong>{products.length ? "No matching products" : "No products yet"}</strong><p>{products.length ? "Try another search or category." : "Add your first product to start tracking inventory."}</p>{!products.length && <button className="button button-primary" onClick={() => navigate("add")}><Icon name="add" size={16} /> Add product</button>}</div></td></tr>}</tbody></table></div>}
              {!loading.products && productFiltered.length > 0 && <div className="pagination"><span>Showing {((productPage - 1) * PAGE_SIZE) + 1}–{Math.min(productPage * PAGE_SIZE, productFiltered.length)} of {productFiltered.length} products</span><div>
                <button className="page-button" aria-label="Previous page" disabled={productPage <= 1} onClick={() => setProductPage((current) => current - 1)}>‹</button>
                <span>Page {productPage} of {totalProductPages}</span>
                <button className="page-button" aria-label="Next page" disabled={productPage >= totalProductPages} onClick={() => setProductPage((current) => current + 1)}>›</button>
              </div></div>}
            </section>
          )}

          {page === "add" && (
            <section className="form-layout">
              <div className="panel form-panel">
                <div className="form-panel-heading"><span className="form-heading-icon"><Icon name="add" size={19} /></span><div><h2>Product information</h2><p>Fields marked with * are required.</p></div></div>
                {errors.products && <div className="error-banner" role="alert">{errors.products}</div>}
                <ProductForm saving={saving} submitText="Save product" onSubmit={(product) => saveProduct(product)} />
              </div>
              <aside className="panel form-aside"><span className="aside-icon"><Icon name="package" size={22} /></span><h3>Keep your catalog organized</h3><p>Add clear names and categories to make your products easier to find and report on.</p><div className="aside-divider" /><div className="aside-tip"><span>TIP</span><p>Initial quantity can be zero. Use <button onClick={() => navigate("stockin")}>Stock In</button> when new items arrive.</p></div></aside>
            </section>
          )}

          {(page === "stockin" || page === "stockout") && (
            <section className="form-layout stock-layout">
              <div className="panel form-panel">
                <div className="form-panel-heading"><span className={`form-heading-icon ${page === "stockin" ? "icon-success" : "icon-danger"}`}><Icon name={page === "stockin" ? "inbound" : "outbound"} size={19} /></span><div><h2>{page === "stockin" ? "Receive inventory" : "Dispatch inventory"}</h2><p>{page === "stockin" ? "Add units to an existing product." : "Remove units from available stock."}</p></div></div>
                {errors.products && <div className="error-banner" role="alert">{errors.products}</div>}
                {loading.products ? <div className="table-loading"><span className="spinner" />Loading products…</div> : products.length === 0 ? (
                  <div className="empty-state form-empty"><span className="empty-symbol"><Icon name="products" /></span><strong>No products available</strong><p>Add a product before recording stock changes.</p><button className="button button-primary" onClick={() => navigate("add")}><Icon name="add" size={16} /> Add product</button></div>
                ) : <form className="product-form stock-form" onSubmit={(event) => submitStock(event, page === "stockin" ? "in" : "out")} noValidate>
                  <div className="form-group"><label htmlFor="stock-product">Select product <span>*</span></label>
                    <select id="stock-product" value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)}>
                      <option value="">Choose an item…</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.quantity} {product.unit} available</option>)}
                    </select>
                  </div>
                  {currentStockProduct && <div className="selected-product"><span className="product-avatar">{currentStockProduct.name.charAt(0).toUpperCase()}</span><span><strong>{currentStockProduct.name}</strong><small>{currentStockProduct.category} · {unitLabel(currentStockProduct.unit)} · SKU-{String(currentStockProduct.id).padStart(4, "0")}</small></span><span className="selected-quantity"><strong>{currentStockProduct.quantity.toLocaleString()} {currentStockProduct.unit}</strong><small>available</small></span></div>}
                  <div className="form-group"><label htmlFor="stock-quantity">{page === "stockin" ? "Quantity to add" : "Quantity to remove"} <span>*</span></label>
                    <input id="stock-quantity" type="number" min="0" step={currentStockProduct && quantityIsDecimal(currentStockProduct.unit) ? "0.001" : "1"} placeholder={currentStockProduct && quantityIsDecimal(currentStockProduct.unit) ? "Enter quantity" : "Enter whole quantity"} value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} />
                    {stockQuantity !== "" && !stockAmountValid && <small className="field-error">{currentStockProduct && quantityIsDecimal(currentStockProduct.unit) ? "Enter a positive quantity with up to 3 decimal places." : "Enter a positive whole number."}</small>}
                  </div>
                  {currentStockProduct && stockAmountValid && (
                    <div className={`quantity-preview ${page === "stockout" ? "preview-out" : ""} ${stockWouldExceed ? "quantity-invalid" : ""}`}>
                      <span>{stockWouldExceed ? "Quantity exceeds available stock" : page === "stockin" ? "Expected quantity after receiving" : "Quantity remaining after dispatch"}</span>
                      <strong>{stockWouldExceed ? `${currentStockProduct.quantity.toLocaleString()} ${currentStockProduct.unit} available` : `${(currentStockProduct.quantity + (page === "stockin" ? quantityValue : -quantityValue)).toLocaleString()} ${currentStockProduct.unit}`}</strong>
                    </div>
                  )}
                  <button className={`button ${page === "stockin" ? "button-success" : "button-danger"}`} type="submit" disabled={saving || !selectedProduct || (stockQuantity !== "" && !stockAmountValid) || stockWouldExceed}>
                    {saving && <span className="spinner spinner-small" />}{page === "stockin" ? <><Icon name="inbound" size={17} /> Receive stock</> : <><Icon name="outbound" size={17} /> Remove stock</>}
                  </button>
                  {page === "stockout" && <p className="form-footnote"><Icon name="warning" size={15} /> You’ll confirm the quantity before it is recorded.</p>}
                </form>}
              </div>
              <aside className="panel form-aside stock-aside"><span className={`aside-icon ${page === "stockout" ? "aside-red" : "aside-green"}`}><Icon name={page === "stockin" ? "inbound" : "outbound"} size={22} /></span><h3>{page === "stockin" ? "Every delivery, recorded" : "Keep stock accurate"}</h3><p>{page === "stockin" ? "Incoming stock is added to the product total and permanently recorded in transaction history." : "Stock cannot go below zero. Each confirmed removal is permanently recorded in transaction history."}</p><div className="aside-divider" /><button className="text-button" onClick={() => navigate("history")}>View stock history <Icon name="arrow" size={15} /></button></aside>
            </section>
          )}

          {page === "history" && (
            <section className="panel table-panel">
              <div className="table-toolbar"><div><h2>Transaction history <span className="count-chip">{filteredHistory.length}</span></h2><p>Review incoming and outgoing stock activity.</p></div>
                <div className="history-summary"><span className="summary-in"><Icon name="inbound" size={15} />{history.filter((item) => item.type === "Stock In").length} received</span><span className="summary-out"><Icon name="outbound" size={15} />{history.filter((item) => item.type === "Stock Out").length} dispatched</span></div>
              </div>
              <div className="filter-row history-filters">
                <label className="search-field"><Icon name="search" size={17} /><input placeholder="Search product or transaction ID…" value={historySearch} aria-label="Search transaction history" onChange={(event) => setHistorySearch(event.target.value)} /></label>
                <select aria-label="Filter by transaction type" value={historyType} onChange={(event) => setHistoryType(event.target.value)}><option>All types</option><option>Stock In</option><option>Stock Out</option></select>
                <label className="date-filter"><span>From</span><input type="date" aria-label="Start date" value={historyFrom} onChange={(event) => setHistoryFrom(event.target.value)} /></label>
                <label className="date-filter"><span>To</span><input type="date" aria-label="End date" value={historyTo} onChange={(event) => setHistoryTo(event.target.value)} /></label>
                <select aria-label="Sort history" value={historySort} onChange={(event) => setHistorySort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
                <button className="button button-light filter-clear" onClick={clearHistoryFilters} disabled={!historySearch && historyType === "All types" && !historyFrom && !historyTo && historySort === "newest"}>Clear filters</button>
                <div className="history-actions">
                  <button className="button button-light" title="Print the displayed stock history" onClick={printHistory} disabled={loading.history || !filteredHistory.length || exporting}><Icon name="printer" size={16} /> Print History</button>
                  <button className="button button-light" title="Download the displayed stock history as CSV" onClick={downloadHistory} disabled={loading.history || !filteredHistory.length || exporting}><Icon name="download" size={16} />{exporting ? "Downloading…" : "Download History"}</button>
                </div>
              </div>
              {errors.history && <div className="error-banner" role="alert">{errors.history}</div>}
              {loading.history ? <div className="table-loading"><span className="spinner" />Loading transaction history…</div> :
                <TransactionTable rows={filteredHistory} onEmpty={clearHistoryFilters} />}
            </section>
          )}
        </div>
      </main>

      {toast && <div className={`toast toast-${toast.type}`} role={toast.type === "error" ? "alert" : "status"}><span className="toast-symbol"><Icon name={toast.type === "error" ? "warning" : "check"} size={17} /></span>{toast.message}<button aria-label="Dismiss notification" onClick={() => setToast(null)}><Icon name="close" size={15} /></button></div>}

      {modal?.kind === "edit" && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title"><div className="modal-header"><div><h2 id="edit-title">Edit product</h2><p>Update product information and stock count.</p></div><button className="icon-button" aria-label="Close dialog" onClick={() => setModal(null)}><Icon name="close" /></button></div>
          <ProductForm key={modal.product.id} initial={modal.product} saving={saving} submitText="Save changes" onCancel={() => setModal(null)} onSubmit={(product) => saveProduct(product, modal.product.id)} />
        </section>
      </div>}

      {modal?.kind === "details" && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
        <section className="modal details-modal" role="dialog" aria-modal="true" aria-labelledby="details-title"><div className="modal-header"><div><h2 id="details-title">Product details</h2><p>Inventory record overview.</p></div><button className="icon-button" aria-label="Close dialog" onClick={() => setModal(null)}><Icon name="close" /></button></div>
          <div className="detail-hero"><span className="product-avatar large">{modal.product.name.charAt(0).toUpperCase()}</span><div><h3>{modal.product.name}</h3><span>SKU-{String(modal.product.id).padStart(4, "0")}</span></div><StockStatus quantity={modal.product.quantity} /></div>
          <div className="detail-grid"><div><span>Category</span><strong>{modal.product.category}</strong></div><div><span>Unit of measurement</span><strong>{unitLabel(modal.product.unit)}</strong></div><div><span>Unit price</span><strong>{formatCurrency(modal.product.price)}</strong></div><div><span>Available quantity</span><strong>{modal.product.quantity.toLocaleString()} {modal.product.unit}</strong></div><div><span>Total inventory value</span><strong>{formatCurrency(modal.product.price * modal.product.quantity)}</strong></div></div>
          <div className="form-actions"><button className="button button-light" onClick={() => setModal(null)}>Close</button><button className="button button-primary" onClick={() => setModal({ kind: "edit", product: modal.product })}><Icon name="edit" size={16} /> Edit product</button></div>
        </section>
      </div>}

      {modal?.kind === "stock-confirm" && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModal(null); }}>
        <section className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-copy"><div className="confirm-icon"><Icon name="warning" size={23} /></div><h2 id="confirm-title">Confirm stock removal</h2><p id="confirm-copy">Remove <strong>{modal.amount} {modal.product.unit}</strong> from <strong>{modal.product.name}</strong>? This will leave <strong>{(modal.product.quantity - modal.amount).toLocaleString()} {modal.product.unit}</strong> in stock.</p>
          <div className="form-actions"><button className="button button-light" onClick={() => setModal(null)} disabled={saving}>Keep stock</button><button className="button button-danger" onClick={() => performStock("out", modal.product, modal.amount)} disabled={saving}>{saving && <span className="spinner spinner-small" />} Confirm removal</button></div>
        </section>
      </div>}
    </div>
    {page === "history" && <section className="print-report" aria-label="Printable stock history report">
      <h1>Inventory Stock History Report</h1>
      <p className="print-generated">Printed {formatDate(new Date().toISOString())}</p>
      <p className="print-filters">{historyFilterSummary()}</p>
      <table><thead><tr><th>Transaction ID</th><th>Product Name</th><th>Transaction Type</th><th>Quantity</th><th>Unit</th><th>Date and Time</th></tr></thead>
        <tbody>{filteredHistory.map((item) => <tr key={item.id}>
          <td>TRX-{String(item.id).padStart(5, "0")}</td><td>{item.productName}</td><td>{item.type}</td>
          <td>{Number(item.quantity).toLocaleString()}</td><td>{item.unit || "pcs"}</td><td>{formatDate(item.date)}</td>
        </tr>)}</tbody>
      </table>
    </section>}
    </>
  );
}

function TransactionTable({ rows, onEmpty, compact = false }) {
  return <div className="responsive-table"><table><thead><tr>{!compact && <th>TRANSACTION</th>}<th>PRODUCT</th><th>TYPE</th><th>QUANTITY</th><th>DATE &amp; TIME</th></tr></thead>
    <tbody>{rows.length ? rows.map((item) => <tr key={item.id}>
      {!compact && <td className="transaction-id">TRX-{String(item.id).padStart(5, "0")}</td>}
      <td><div className="transaction-product"><span className="mini-product"><Icon name="package" size={15} /></span><strong>{item.productName}</strong></div></td>
      <td><span className={`transaction-type ${item.type === "Stock In" ? "type-in" : "type-out"}`}><i />{item.type}</span></td>
      <td><strong className={item.type === "Stock In" ? "quantity-in" : "quantity-out"}>{item.type === "Stock In" ? "+" : "−"}{Number(item.quantity).toLocaleString()} {item.unit || "pcs"}</strong></td>
      <td className="date-cell">{formatDate(item.date)}</td>
    </tr>) : <tr><td colSpan={compact ? 4 : 5}><div className="empty-state table-empty"><span className="empty-symbol"><Icon name="history" /></span><strong>No transactions found</strong><p>Stock movements will appear here once recorded.</p>{onEmpty && <button className="button button-light" onClick={onEmpty}>Clear filters</button>}</div></td></tr>}</tbody></table></div>;
}

export default App;
