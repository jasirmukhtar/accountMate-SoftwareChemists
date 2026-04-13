# MARG ERP — Offline Desktop ERP
### Purchase · Sale · Stock · Analytics

---

## ⚡ Quick Setup

### 1. Prerequisites
- **Node.js** v18+ → https://nodejs.org
- **MySQL** 8.0+ → https://dev.mysql.com/downloads/
- **Git** (optional)

### 2. Install Dependencies
```bash
cd marg-erp
npm install
```

### 3. Configure Environment
Edit `.env` file with your details:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=marg_erp

SHOP_NAME=Your Store Name
SHOP_ADDRESS=Your Full Address
SHOP_CONTACT=+91-XXXXXXXXXX
SHOP_GST=Your GST Number
```

### 4. Run (Web Mode — for testing)
```bash
node backend/server.js
# Open http://localhost:3737 in browser
```

### 5. Run (Desktop App — Electron)
```bash
npm start
```

### 6. Build Installer (Windows .exe)
```bash
npm install --save-dev electron-builder
npx electron-builder --win
```

---

## 🗂 Project Structure
```
marg-erp/
├── main.js                 ← Electron desktop wrapper
├── .env                    ← Shop config + DB credentials
├── backend/
│   ├── server.js           ← Express API server (port 3737)
│   ├── db/
│   │   ├── schema.sql      ← MySQL schema (auto-runs on start)
│   │   └── connection.js   ← DB pool
│   └── routes/
│       ├── products.js     ← Product CRUD + stock lookup
│       ├── distributors.js ← Distributor CRUD
│       ├── purchase.js     ← Purchase entry + stock update
│       ├── sales.js        ← Sale billing + PDF generation
│       └── analytics.js    ← Charts data + expiry alerts
└── frontend/
    ├── index.html          ← Single page app shell
    ├── css/main.css        ← Dark industrial theme
    └── js/
        ├── app.js          ← Navigation router + boot
        ├── api.js          ← Fetch wrapper
        ├── utils.js        ← Toast, modal, formatters
        ├── dashboard.js    ← KPI cards + bar chart
        ├── purchase.js     ← Purchase entry form
        ├── sales.js        ← Billing form + PDF trigger
        ├── stock.js        ← Stock ledger + batch view
        ├── products.js     ← Product master
        ├── distributors.js ← Distributor master
        ├── analytics.js    ← Daywise/monthly charts
        └── expiry.js       ← Expiry alert dashboard
```

---

## 📋 Database Tables

| Table | Purpose |
|-------|---------|
| `products` | Product master (name, unit, HSN, GST%) |
| `distributors` | Registered supplier list |
| `customers` | Retailer/customer records |
| `purchase_header` | Purchase invoice header |
| `purchase_details` | Line items per purchase |
| `stock` | Live stock (auto-updated on purchase/sale) |
| `sales_header` | Sale invoice header |
| `sales_items` | Line items per sale |

---

## 🖨 PDF Invoice
- Auto-generated on every sale
- Shop details injected from `.env`
- Opens in browser/PDF viewer
- Invoice format: `INV-YYYYMM-XXXX`

---

## ⌨ Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `Alt+1` | Dashboard |
| `Alt+2` | Purchase |
| `Alt+3` | Sales |
| `Alt+4` | Stock |
| `Alt+5` | Analytics |
| `Escape` | Close modal |
