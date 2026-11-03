# Stockwise Inventory Management

React and Vite frontend for the Express and SQLite inventory API.

## Run locally in VS Code (Windows PowerShell)

1. Open a terminal in the backend directory:

   ```powershell
   cd "C:\Users\Acer\OneDrive\Documents\Desktop\Inventory System\backend"
   npm.cmd run dev
   ```

   The backend creates and uses the local `backend\inventory.db` SQLite file automatically. Set `DB_PATH` to use a different database file or `PORT` to override the default port.

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

## Available frontend checks

```powershell
npm.cmd run lint
npm.cmd run build
```

## Features

- Dashboard summary metrics and category / stock-movement visualizations use SQLite-backed API data.
- Product search, category and stock-level filters, sorting, pagination, details, editing, and deletion.
- Product creation and validated stock-in / stock-out forms with confirmation and toasts.
- Searchable, filterable, date-range transaction history.
- Responsive sidebar and layouts for mobile, tablet, and desktop.
