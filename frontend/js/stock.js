async function renderStock() {
  const el = document.getElementById('page-stock');
  el.innerHTML = loading();
  try {
    const stocks = await api.get('/products/stock/all');
    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">STOCK LEDGER</div>
          <div class="page-subtitle">Current inventory across all products</div>
        </div>
        <div class="search-bar">
          <span style="color:var(--text-muted)">⌕</span>
          <input id="stock-search" placeholder="Search product..." oninput="filterStock()">
        </div>
      </div>

      <div class="table-wrap" id="stock-table-wrap">
        <table>
          <thead><tr>
            <th>#</th>
            <th>PRODUCT NAME</th>
            <th>UNIT</th>
            <th class="text-right">BATCHES</th>
            <th class="text-right">TOTAL STOCK</th>
            <th>NEAREST EXPIRY</th>
            <th>STATUS</th>
            <th>ACTION</th>
          </tr></thead>
          <tbody id="stock-tbody">
            ${renderStockRows(stocks)}
          </tbody>
        </table>
      </div>
    `;
    window._stockData = stocks;
  } catch(e) { el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

function renderStockRows(data) {
  if (!data.length) return `<tr><td colspan="8">${emptyState('No stock records')}</td></tr>`;
  return data.map((s, i) => {
    const stock = parseInt(s.total_stock || 0);
    let statusBadge = '';
    if (stock === 0)        statusBadge = `<span class="badge badge-red">OUT OF STOCK</span>`;
    else if (stock < 10)    statusBadge = `<span class="badge badge-amber">LOW STOCK</span>`;
    else                    statusBadge = `<span class="badge badge-green">IN STOCK</span>`;

    let expiryCell = '-';
    if (s.nearest_expiry) {
      const days = Math.ceil((new Date(s.nearest_expiry) - new Date()) / 86400000);
      const cls  = days < 30 ? 'text-red' : days < 90 ? 'text-accent' : 'text-green';
      expiryCell = `<span class="${cls}">${fmtDate(s.nearest_expiry)} <small>(${days}d)</small></span>`;
    }

    return `<tr data-name="${s.name.toLowerCase()}">
      <td class="mono text-muted">${i+1}</td>
      <td><b>${s.name}</b></td>
      <td>${s.unit}</td>
      <td class="text-right">${s.batches || 0}</td>
      <td class="text-right mono text-accent">${stock}</td>
      <td>${expiryCell}</td>
      <td>${statusBadge}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="viewBatchStock(${s.product_id}, '${s.name.replace(/'/g,"\\'")}')">Batches</button></td>
    </tr>`;
  }).join('');
}

function filterStock() {
  const q = document.getElementById('stock-search').value.toLowerCase();
  const rows = document.querySelectorAll('#stock-tbody tr[data-name]');
  rows.forEach(r => {
    r.style.display = r.dataset.name.includes(q) ? '' : 'none';
  });
}

async function viewBatchStock(productId, productName) {
  try {
    const stocks = await api.get(`/products/${productId}/stock`);
    showModal(`
      <div class="section-title">BATCH-WISE STOCK — ${productName}</div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>BATCH</th><th>EXPIRY</th><th>MRP</th><th>PUR.RATE</th>
            <th class="text-right">QTY IN</th><th class="text-right">SOLD</th><th class="text-right">BALANCE</th>
          </tr></thead>
          <tbody>
            ${stocks.length === 0 ? `<tr><td colspan="7">${emptyState('No stock')}</td></tr>` :
              stocks.map(s => {
                const daysLeft = s.expiry_date ? Math.ceil((new Date(s.expiry_date) - new Date()) / 86400000) : null;
                const expCls   = daysLeft !== null ? (daysLeft < 30 ? 'text-red' : daysLeft < 90 ? 'text-accent' : '') : '';
                return `<tr>
                  <td class="mono">${s.batch_no || '-'}</td>
                  <td class="${expCls}">${fmtDate(s.expiry_date)}${daysLeft !== null ? ` <small>(${daysLeft}d)</small>` : ''}</td>
                  <td class="mono">${fmtCurrency(s.mrp)}</td>
                  <td class="mono">${fmtCurrency(s.purchase_rate)}</td>
                  <td class="text-right">${s.qty_in}</td>
                  <td class="text-right">${s.qty_sold}</td>
                  <td class="text-right mono text-green"><b>${s.qty_balance}</b></td>
                </tr>`;
              }).join('')}
          </tbody>
        </table>
      </div>
    `, '750px');
  } catch(e) { toast(e.message, 'error'); }
}
