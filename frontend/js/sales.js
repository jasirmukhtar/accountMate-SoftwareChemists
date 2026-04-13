let saleItems = [];
let saleProducts = [];

async function renderSales() {
  const el = document.getElementById('page-sales');
  el.innerHTML = loading();
  try {
    const [products, sales] = await Promise.all([
      api.get('/products'),
      api.get('/sales')
    ]);
    saleProducts = products;

    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">SALES</div>
          <div class="page-subtitle">Retail billing to customers</div>
        </div>
        <button class="btn btn-primary" onclick="showNewSaleForm()">+ New Sale</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>INVOICE</th><th>DATE</th><th>CUSTOMER</th><th>CONTACT</th>
            <th>PAYMENT</th><th class="text-right">ITEMS</th><th class="text-right">NET AMT</th><th>ACTIONS</th>
          </tr></thead>
          <tbody>
            ${sales.length === 0
              ? `<tr><td colspan="8">${emptyState('No sales yet')}</td></tr>`
              : sales.map(s => `
                <tr>
                  <td class="mono text-accent">${s.invoice_no}</td>
                  <td>${fmtDate(s.sale_date)}</td>
                  <td>${s.customer_name}</td>
                  <td>${s.customer_contact || '-'}</td>
                  <td><span class="badge badge-blue">${s.payment_mode}</span></td>
                  <td class="text-right">${s.item_count}</td>
                  <td class="text-right mono text-green">${fmtCurrency(s.net_amount)}</td>
                  <td>
                    <button class="btn btn-ghost btn-sm" onclick="viewSale(${s.sales_invoice_id})">View</button>
                    <button class="btn btn-ghost btn-sm text-accent" onclick="printBill(${s.sales_invoice_id})">PDF</button>
                  </td>
                </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch(e) { el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

// ─── Sale Form ────────────────────────────────────────────
function showNewSaleForm() {
  saleItems = [];
  showModal(`
    <div class="section-title">NEW SALE / BILLING</div>
    <div class="form-grid form-grid-4 mb-16">
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">CUSTOMER NAME *</label>
        <input id="sal-cust" class="form-control" placeholder="Retailer / Customer name">
      </div>
      <div class="form-group">
        <label class="form-label">CONTACT</label>
        <input id="sal-contact" class="form-control" placeholder="Phone">
      </div>
      <div class="form-group">
        <label class="form-label">SALE DATE *</label>
        <input id="sal-date" type="date" class="form-control" value="${todayISO()}">
      </div>
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">ADDRESS</label>
        <input id="sal-addr" class="form-control" placeholder="Customer address">
      </div>
      <div class="form-group">
        <label class="form-label">PAYMENT MODE</label>
        <select id="sal-pay" class="form-control">
          <option>CASH</option><option>CREDIT</option><option>UPI</option><option>CHEQUE</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">REMARKS</label>
        <input id="sal-remarks" class="form-control" placeholder="Optional">
      </div>
    </div>

    <div class="section-title">SALE ITEMS</div>

    <!-- No overflow:auto here — plain div so dropdown can escape -->
    <div class="sal-items-plain mb-16">
      <table class="sal-items-table" style="width:100%;border-collapse:collapse">
        <thead>
          <tr class="sal-items-head">
            <th style="min-width:230px">PRODUCT</th>
            <th style="min-width:190px">BATCH / STOCK</th>
            <th style="width:90px">MRP</th>
            <th style="width:85px">RATE (₹)</th>
            <th style="width:65px">QTY</th>
            <th style="width:65px">DISC%</th>
            <th style="width:90px;text-align:right">AMOUNT</th>
            <th style="width:32px"></th>
          </tr>
        </thead>
        <tbody id="sal-items-body"></tbody>
      </table>
    </div>

    <button class="btn btn-secondary btn-sm mb-16" onclick="addSaleRow()">+ Add Item</button>

    <div class="flex justify-between align-center">
      <div class="form-group" style="width:200px">
        <label class="form-label">EXTRA DISCOUNT (₹)</label>
        <input id="sal-disc" type="number" class="form-control" value="0" min="0" oninput="calcSaleTotals()">
      </div>
      <div class="totals-box">
        <div class="total-row"><span>Subtotal (at MRP)</span><span id="sal-subtotal">₹ 0.00</span></div>
        <div class="total-row"><span>Discount</span><span id="sal-disc-disp">₹ 0.00</span></div>
        <div class="total-row net"><span>NET AMOUNT</span><span id="sal-net">₹ 0.00</span></div>
      </div>
    </div>

    <div class="divider"></div>
    <div class="flex gap-8" style="justify-content:flex-end">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveSale()">Save & Generate Invoice</button>
    </div>
  `, '1050px');
  addSaleRow();
}

// ─── Add Row ──────────────────────────────────────────────
function addSaleRow() {
  const idx = saleItems.length;
  saleItems.push({ product_id: null });
  const tbody = document.getElementById('sal-items-body');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.id = `sal-row-${idx}`;
  tr.style.borderBottom = '1px solid var(--border)';
  tr.innerHTML = `
    <td style="padding:6px 8px;position:relative">
      <div class="prod-search-wrap" id="psw-${idx}">
        <input
          class="form-control prod-search-input"
          id="ps-input-${idx}"
          placeholder="Search product…"
          autocomplete="off"
          oninput="filterProductDropdown(${idx})"
          onfocus="openProductDropdown(${idx})"
          onkeydown="prodSearchKey(event,${idx})"
        >
        <!-- Dropdown rendered into body via fixed positioning — escapes any overflow -->
        <input type="hidden" id="ps-val-${idx}">
      </div>
    </td>
    <td style="padding:6px 8px">
      <select class="form-control" id="sal-stock-${idx}" style="min-width:190px" onchange="setSaleStock(${idx},this)">
        <option value="">— pick product first —</option>
      </select>
    </td>
    <td style="padding:6px 8px">
      <span class="mono" id="sal-mrp-${idx}" style="font-size:13px">-</span>
    </td>
    <td style="padding:6px 8px">
      <input type="number" class="form-control" id="sal-rate-${idx}"
             placeholder="Rate" style="width:80px" oninput="calcSaleRow(${idx})">
    </td>
    <td style="padding:6px 8px">
      <input type="number" class="form-control" id="sal-qty-${idx}"
             placeholder="Qty" style="width:60px" value="1" min="1" oninput="calcSaleRow(${idx})">
    </td>
    <td style="padding:6px 8px">
      <input type="number" class="form-control" id="sal-disc-${idx}"
             placeholder="0" style="width:60px" value="0" min="0" max="100" oninput="calcSaleRow(${idx})">
    </td>
    <td style="padding:6px 8px;text-align:right">
      <span class="mono text-green" id="sal-amt-${idx}">0.00</span>
    </td>
    <td style="padding:6px 4px">
      <button class="btn btn-ghost btn-sm text-red" onclick="removeSaleRow(${idx})">✕</button>
    </td>
  `;
  tbody.appendChild(tr);

  // Pre-render dropdown content (all products, hidden)
  ensureDropdownPortal(idx);

  setTimeout(() => {
    const inp = document.getElementById(`ps-input-${idx}`);
    if (inp) inp.focus();
  }, 40);
}

// ─── Dropdown Portal (fixed position, appended to body) ───
// This breaks out of any overflow:hidden/auto ancestor completely.

function ensureDropdownPortal(idx) {
  if (document.getElementById(`ps-portal-${idx}`)) return;
  const portal = document.createElement('div');
  portal.id = `ps-portal-${idx}`;
  portal.className = 'prod-dropdown-portal';
  portal.style.display = 'none';
  document.body.appendChild(portal);
  renderProductDropdown(idx, saleProducts);
}

function renderProductDropdown(idx, list) {
  const portal = document.getElementById(`ps-portal-${idx}`);
  if (!portal) return;
  if (list.length === 0) {
    portal.innerHTML = `<div class="pd-item pd-empty">No products found</div>`;
    return;
  }
  const q = (document.getElementById(`ps-input-${idx}`)?.value || '').toLowerCase();
  portal.innerHTML = list.map(p => {
    // Highlight matched portion
    let name = p.name;
    if (q) {
      const i = name.toLowerCase().indexOf(q);
      if (i >= 0) {
        name = name.substring(0, i)
          + '<mark>' + name.substring(i, i + q.length) + '</mark>'
          + name.substring(i + q.length);
      }
    }
    return `<div class="pd-item"
                 data-id="${p.product_id}"
                 onmousedown="selectProduct(${idx}, ${p.product_id}, '${p.name.replace(/'/g,"\\'")}')"
            >${name}</div>`;
  }).join('');
}

function filterProductDropdown(idx) {
  const q = (document.getElementById(`ps-input-${idx}`)?.value || '').toLowerCase().trim();
  const filtered = q ? saleProducts.filter(p => p.name.toLowerCase().includes(q)) : saleProducts;
  renderProductDropdown(idx, filtered);
  openProductDropdown(idx);
}

function openProductDropdown(idx) {
  // Close all others
  closeAllProductDropdowns();

  const input = document.getElementById(`ps-input-${idx}`);
  const portal = document.getElementById(`ps-portal-${idx}`);
  if (!input || !portal) return;

  // Position portal relative to input using fixed coords
  const rect = input.getBoundingClientRect();
  portal.style.position  = 'fixed';
  portal.style.top       = (rect.bottom + 3) + 'px';
  portal.style.left      = rect.left + 'px';
  portal.style.width     = Math.max(rect.width, 260) + 'px';
  portal.style.display   = 'block';
  portal.style.zIndex    = '99999';
}

function closeAllProductDropdowns() {
  document.querySelectorAll('.prod-dropdown-portal').forEach(p => p.style.display = 'none');
}

// Keyboard nav: arrows + enter + esc
function prodSearchKey(e, idx) {
  const portal = document.getElementById(`ps-portal-${idx}`);
  if (!portal || portal.style.display === 'none') return;
  const items = portal.querySelectorAll('.pd-item:not(.pd-empty)');
  const current = portal.querySelector('.pd-item.focused');
  let ci = Array.from(items).indexOf(current);

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    ci = Math.min(ci + 1, items.length - 1);
    items.forEach(i => i.classList.remove('focused'));
    if (items[ci]) { items[ci].classList.add('focused'); items[ci].scrollIntoView({ block: 'nearest' }); }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    ci = Math.max(ci - 1, 0);
    items.forEach(i => i.classList.remove('focused'));
    if (items[ci]) { items[ci].classList.add('focused'); items[ci].scrollIntoView({ block: 'nearest' }); }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const focused = portal.querySelector('.pd-item.focused');
    if (focused) focused.dispatchEvent(new MouseEvent('mousedown'));
  } else if (e.key === 'Escape' || e.key === 'Tab') {
    closeAllProductDropdowns();
  }
}

async function selectProduct(idx, productId, productName) {
  const inp = document.getElementById(`ps-input-${idx}`);
  const hid = document.getElementById(`ps-val-${idx}`);
  if (inp) inp.value = productName;
  if (hid) hid.value = productId;
  closeAllProductDropdowns();

  saleItems[idx] = saleItems[idx] || {};
  saleItems[idx].product_id = productId;

  await loadSaleStock(idx, productId);

  // Move to qty field
  setTimeout(() => {
    const qty = document.getElementById(`sal-qty-${idx}`);
    if (qty) { qty.select(); qty.focus(); }
  }, 60);
}

// Close portals when clicking outside search inputs
document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('.prod-search-wrap') && !e.target.closest('.prod-dropdown-portal')) {
    closeAllProductDropdowns();
  }
});

// Reposition on scroll/resize
window.addEventListener('scroll', closeAllProductDropdowns, true);
window.addEventListener('resize', closeAllProductDropdowns);

// ─── Stock Loading ────────────────────────────────────────
async function loadSaleStock(idx, productId) {
  const sel = document.getElementById(`sal-stock-${idx}`);
  if (!sel || !productId) return;
  sel.innerHTML = '<option>Loading…</option>';
  try {
    const stocks = await api.get(`/products/${productId}/stock`);
    if (stocks.length === 0) {
      sel.innerHTML = '<option value="">⚠ No stock available</option>';
      document.getElementById(`sal-mrp-${idx}`).textContent = '-';
      return;
    }
    sel.innerHTML = stocks.map(s =>
      `<option value="${s.stock_id}"
               data-mrp="${s.mrp}"
               data-gst="${s.gst_pct || 0}"
               data-batch="${s.batch_no || ''}"
               data-exp="${s.expiry_date || ''}"
               data-bal="${s.qty_balance}">
        ${s.batch_no || 'No batch'} | Exp: ${s.expiry_date ? s.expiry_date.substring(0,7) : '-'} | Bal: ${s.qty_balance} | MRP: ₹${s.mrp}
      </option>`
    ).join('');
    setSaleStock(idx, sel);
  } catch(e) {
    sel.innerHTML = '<option value="">Error loading stock</option>';
  }
}

function setSaleStock(idx, sel) {
  const opt = sel.options[sel.selectedIndex];
  if (!opt || !opt.value) return;
  const mrp = parseFloat(opt.dataset.mrp || 0);
  const gst = parseFloat(opt.dataset.gst  || 0);

  document.getElementById(`sal-mrp-${idx}`).textContent = '₹' + mrp.toFixed(2);

  // Default rate = MRP (retailer sells at MRP, discount applied separately)
  const rateEl = document.getElementById(`sal-rate-${idx}`);
  if (rateEl) { rateEl.value = mrp.toFixed(2); }

  saleItems[idx] = {
    ...saleItems[idx],
    stock_id:    opt.value,
    batch_no:    opt.dataset.batch,
    expiry_date: opt.dataset.exp,
    mrp,
    gst_pct: gst,
    max_qty: parseInt(opt.dataset.bal)
  };
  calcSaleRow(idx);
}

// ─── Row Calc (MRP × QTY − discount only, no GST display) ─
function calcSaleRow(idx) {
  const rate = parseFloat(document.getElementById(`sal-rate-${idx}`)?.value || 0);
  const qty  = parseInt(document.getElementById(`sal-qty-${idx}`)?.value    || 0);
  const disc = parseFloat(document.getElementById(`sal-disc-${idx}`)?.value || 0);
  let amt = rate * qty;
  amt = amt - (amt * disc / 100);
  const el = document.getElementById(`sal-amt-${idx}`);
  if (el) el.textContent = amt.toFixed(2);
  calcSaleTotals();
}

function calcSaleTotals() {
  let subtotal = 0;
  for (let i = 0; i < saleItems.length; i++) {
    subtotal += parseFloat(document.getElementById(`sal-amt-${i}`)?.textContent || 0);
  }
  const disc = parseFloat(document.getElementById('sal-disc')?.value || 0);
  document.getElementById('sal-subtotal').textContent  = fmtCurrency(subtotal);
  document.getElementById('sal-disc-disp').textContent = fmtCurrency(disc);
  document.getElementById('sal-net').textContent       = fmtCurrency(subtotal - disc);
}

function removeSaleRow(idx) {
  const row = document.getElementById(`sal-row-${idx}`);
  if (row) row.remove();
  // Also remove portal
  const portal = document.getElementById(`ps-portal-${idx}`);
  if (portal) portal.remove();
  calcSaleTotals();
}

// ─── Save Sale ────────────────────────────────────────────
async function saveSale() {
  const custName = document.getElementById('sal-cust').value.trim();
  const date     = document.getElementById('sal-date').value;
  if (!custName || !date) { toast('Fill customer name and date', 'error'); return; }

  const items = [];
  for (let i = 0; i < saleItems.length; i++) {
    const row = document.getElementById(`sal-row-${i}`);
    if (!row) continue;
    const productId = document.getElementById(`ps-val-${i}`)?.value;
    if (!productId) continue;
    const stockData = saleItems[i] || {};
    const qty  = parseInt(document.getElementById(`sal-qty-${i}`)?.value  || 0);
    const rate = parseFloat(document.getElementById(`sal-rate-${i}`)?.value || 0);
    const disc = parseFloat(document.getElementById(`sal-disc-${i}`)?.value || 0);
    const amt  = parseFloat(document.getElementById(`sal-amt-${i}`)?.textContent || 0);
    if (qty <= 0) continue;
    items.push({
      product_id:   productId,
      stock_id:     stockData.stock_id    || null,
      batch_no:     stockData.batch_no    || '',
      expiry_date:  stockData.expiry_date || null,
      mrp:          stockData.mrp         || rate,
      sale_rate:    rate,
      qty,
      discount_pct: disc,
      gst_pct:      stockData.gst_pct     || 0,   // kept for backend/PDF only
      line_amount:  amt
    });
  }

  if (items.length === 0) { toast('Add at least one item', 'error'); return; }

  try {
    const result = await api.post('/sales', {
      header: {
        customer_name:    custName,
        customer_address: document.getElementById('sal-addr').value,
        customer_contact: document.getElementById('sal-contact').value,
        sale_date:        date,
        payment_mode:     document.getElementById('sal-pay').value,
        discount_amount:  parseFloat(document.getElementById('sal-disc').value || 0),
        remarks:          document.getElementById('sal-remarks').value
      },
      items
    });

    // Remove all portals before closing modal
    document.querySelectorAll('.prod-dropdown-portal').forEach(p => p.remove());
    toast(`Invoice ${result.invoice_no} saved!`, 'success');
    closeModal();
    renderSales();
    setTimeout(() => printBill(result.sales_invoice_id), 600);
  } catch (e) { toast(e.message, 'error'); }
}

// ─── View & PDF ───────────────────────────────────────────
async function viewSale(id) {
  try {
    const { header, items } = await api.get(`/sales/${id}`);
    showModal(`
      <div class="section-title">${header.invoice_no} — ${header.customer_name}</div>
      <div class="flex gap-16 mb-16" style="font-size:12px;color:var(--text-secondary)">
        <span>Date: <b class="text-accent">${fmtDate(header.sale_date)}</b></span>
        <span>Payment: <b>${header.payment_mode}</b></span>
        <span>Net: <b class="text-green">${fmtCurrency(header.net_amount)}</b></span>
      </div>
      <div class="table-wrap mb-16">
        <table>
          <thead><tr>
            <th>PRODUCT</th><th>BATCH</th><th>EXPIRY</th>
            <th>MRP</th><th>RATE</th><th class="text-right">QTY</th>
            <th class="text-right">DISC%</th><th class="text-right">AMOUNT</th>
          </tr></thead>
          <tbody>
            ${items.map(i => `<tr>
              <td>${i.product_name}</td>
              <td class="mono">${i.batch_no || '-'}</td>
              <td>${fmtDate(i.expiry_date)}</td>
              <td class="mono">${fmtCurrency(i.mrp)}</td>
              <td class="mono">${fmtCurrency(i.sale_rate)}</td>
              <td class="text-right">${i.qty}</td>
              <td class="text-right">${i.discount_pct}%</td>
              <td class="text-right mono text-green">${fmtCurrency(i.line_amount)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="flex gap-8" style="justify-content:flex-end">
        <button class="btn btn-primary" onclick="printBill(${id})">🖨 Print PDF</button>
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>
    `, '900px');
  } catch (e) { toast(e.message, 'error'); }
}

function printBill(invoiceId) {
  window.open(api.pdfUrl(invoiceId), '_blank');
}