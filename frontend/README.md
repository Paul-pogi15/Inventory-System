# Stockwise Inventory Management

React and Vite frontend for the Express inventory API. The backend stores inventory data in its local JSON file and does not require XAMPP, MySQL, or another database server.

For production, build and start the project from the repository root. The backend serves the compiled frontend and API together, so users only need to open one URL:

```powershell
npm.cmd install
npm.cmd run build
npm.cmd start
```

## Run locally in VS Code (Windows PowerShell)

1. Open a terminal in the backend directory:

   ```powershell
   cd "C:\Users\Acer\OneDrive\Documents\Desktop\Inventory System\backend"
   npm.cmd run dev
   ```

   The backend creates and uses the local `backend\inventory-data.json` file automatically. Set `DATA_PATH` to use a different data file or `PORT` to override the default port.

2. In a second VS Code terminal, start the frontend:

   ```powershell
   cd "C:\Users\Acer\OneDrive\Documents\Desktop\Inventory System\frontend"
   npm.cmd run dev
   ```

   Open the local URL printed by Vite (normally `http://localhost:5173`).

The frontend uses the same origin as the backend by default. To use a separately hosted backend, create `frontend\.env.local` with:

```text
VITE_API_URL=http://localhost:5000
```

## Available frontend checks

```powershell
npm.cmd run lint
npm.cmd run build
```

## Features

- Dashboard summary metrics and category / stock-movement visualizations use local file-backed API data.
- Product search, category and stock-level filters, sorting, pagination, details, editing, and deletion.
- Product creation and validated stock-in / stock-out forms with confirmation and toasts.
- Searchable, filterable, date-range transaction history.
- Responsive sidebar and layouts for mobile, tablet, and desktop.
