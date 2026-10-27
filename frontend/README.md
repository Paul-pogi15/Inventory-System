# Stockwise Inventory Management

React and Vite frontend for the existing Express and MySQL inventory API.

## Run locally in VS Code (Windows PowerShell)

1. Start MySQL and open a terminal in the backend directory:

   ```powershell
   cd "C:\Users\Acer\OneDrive\Documents\Desktop\Inventory System\backend"
   $env:DB_HOST = "localhost"
   $env:DB_USER = "root"
   $env:DB_PASSWORD = "your_mysql_password"
   npm.cmd run dev
   ```

   Replace `your_mysql_password` with the password for your local MySQL account. If the account has no password, set it to an empty string. The backend creates the `inventory_system` database and its existing tables if needed. You may set `DB_NAME`, `DB_PORT`, or `PORT` to override the defaults.

2. In a second VS Code terminal, start the frontend:

   ```powershell
   cd "C:\Users\Acer\OneDrive\Documents\Desktop\Inventory System\frontend"
   npm.cmd run dev
   ```

   Open the local URL printed by Vite (normally `http://localhost:5173`).

The frontend uses `http://localhost:5000/api` by default. To use a different backend origin, create `frontend\.env.local` with:

```text
VITE_API_URL=http://localhost:5000
```

Do not put database credentials in frontend environment variables.

## Available frontend checks

```powershell
npm.cmd run lint
npm.cmd run build
```

## Features

- Dashboard summary metrics and category / stock-movement visualizations use MySQL-backed API data.
- Product search, category and stock-level filters, sorting, pagination, details, editing, and deletion.
- Product creation and validated stock-in / stock-out forms with confirmation and toasts.
- Searchable, filterable, date-range transaction history.
- Responsive sidebar and layouts for mobile, tablet, and desktop.
