let purchaseItems = [];
let allProducts = [];
let allDistributors = [];

async function renderPurchase() {
  const el = document.getElementById('page-purchase');
  el.innerHTML = loading();
  try {
    const [products, distributors, purchases] = await Promise.all([
      api.get('/products'),
      api.get('/distributors'),
      api.get('/purchase')
    ]);
    allProducts = products;
    allDistributors = distributors;
    purchaseItems = [];

    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">PURCHASE</div>
          <div class="page-subtitle">Record purchases from distributors</div>
        </div>
        <button class="btn btn-primary" onclick="showNewPurchaseForm()">+ New Purchase</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>#</th><th>DATE</th><th>DISTRIBUTOR</th><th>INVOICE NO</th>
            <th class="text-right">ITEMS</th><th class="text-right">AMOUNT</th><th>ACTION</th>
          </tr></thead>
          <tbody>
            ${purchases.length === 0
              ? `<tr><td colspan="7">${emptyState('No purchases yet')}</td></tr>`
              : purchases.map(p => `
                <tr>
                  <td class="mono text-accent">${p.purchase_id}</td>
                  <td>${fmtDate(p.purchase_date)}</td>
                  <td>${p.distributor_name}</td>
                  <td class="mono">${p.invoice_no || '-'}</td>
                  <td class="text-right">${p.item_count}</td>
                  <td class="text-right mono">${fmtCurrency(p.net_amount)}</td>
                  <td>
                    <button class="btn btn-ghost btn-sm" onclick="viewPurchase(${p.purchase_id})">View</button>
                    <button class="btn btn-ghost btn-sm text-red" onclick="deletePurchase(${p.purchase_id})">Del</button>
                  </td>
                </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch(e) { el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

function showNewPurchaseForm() {
  purchaseItems = [];
  showModal(`
    <div class="section-title">NEW PURCHASE ENTRY</div>
    <div class="form-grid form-grid-3 mb-16">
      <div class="form-group">
        <label class="form-label">DISTRIBUTOR *</label>
        <select id="pur-dist" class="form-control">
          <option value="">Select...</option>
          ${allDistributors.map(d => `<option value="${d.distributor_id}">${d.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">INVOICE NO</label>
        <input id="pur-inv" class="form-control" placeholder="Supplier invoice #">
      </div>
      <div class="form-group">
        <label class="form-label">PURCHASE DATE *</label>
        <input id="pur-date" type="date" class="form-control" value="${todayISO()}">
      </div>
    </div>

    <div class="section-title">PURCHASE ITEMS</div>
    <div class="sal-items-plain mb-16">
      <table class="sal-items-table" style="width:100%;border-collapse:collapse">
        <thead>
          <tr class="sal-items-head">
            <th style="min-width:230px">PRODUCT</th>
            <th style="width:95px">BATCH</th>
            <th style="width:130px">EXPIRY</th>
            <th style="width:78px">MRP</th>
            <th style="width:78px">PUR.RATE</th>
            <th style="width:62px">QTY</th>
            <th style="width:55px">FREE</th>
            <th style="width:55px">DISC%</th>
            <th style="width:55px">GST%</th>
            <th style="width:80px;text-align:right">AMOUNT</th>
            <th style="width:32px"></th>
          </tr>
        </thead>
        <tbody id="pur-items-body"></tbody>
      </table>
    </div>
    <button class="btn btn-secondary btn-sm mb-16" onclick="addPurchaseRow()">+ Add Item</button>

    <div class="flex justify-between align-center">
      <div class="form-group" style="width:200px">
        <label class="form-label">DISCOUNT AMOUNT</label>
        <input id="pur-disc" type="number" class="form-control" value="0" min="0" oninput="calcPurchaseTotals()">
      </div>
      <div class="totals-box">
        <div class="total-row"><span>Subtotal</span><span id="pur-subtotal">₹ 0.00</span></div>
        <div class="total-row"><span>Discount</span><span id="pur-discount-disp">₹ 0.00</span></div>
        <div class="total-row net"><span>NET</span><span id="pur-net">₹ 0.00</span></div>
      </div>
    </div>

    <div class="divider"></div>
    <div class="flex gap-8" style="justify-content:flex-end">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="savePurchase()">Save Purchase</button>
    </div>
  `, '1100px');
  addPurchaseRow();
}

// ─── Add Row with searchable product picker ───────────────
function addPurchaseRow() {
  const idx = purchaseItems.length;
  purchaseItems.push({});
  const tbody = document.getElementById('pur-items-body');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.id = `pur-row-${idx}`;
  tr.style.borderBottom = '1px solid var(--border)';
  tr.innerHTML = `
    <td style="padding:6px 8px;position:relative">
      <div class="prod-search-wrap" id="pur-psw-${idx}">
        <input class="form-control prod-search-input"
               id="pur-ps-input-${idx}"
               placeholder="Search product…"
               autocomplete="off"
               oninput="purFilterDrop(${idx})"
               onfocus="purOpenDrop(${idx})"
               onkeydown="purSearchKey(event,${idx})">
        <input type="hidden" id="pur-ps-val-${idx}">
      </div>
    </td>
    <td style="padding:6px 8px">
      <input class="form-control" id="pur-batch-${idx}" placeholder="Batch" style="width:88px">
    </td>
    <td style="padding:6px 8px">
      <input type="date" class="form-control" id="pur-exp-${idx}" style="width:128px">
    </td>
    <td style="padding:6px 8px">
      <input type="number" class="form-control" id="pur-mrp-${idx}"
             placeholder="MRP" style="width:72px" oninput="calcPurRow(${idx})">
    </td>
    <td style="padding:6px 8px">
      <input type="number" class="form-control" id="pur-rate-${idx}"
             placeholder="Rate" style="width:72px" oninput="calcPurRow(${idx})">
    </td>
    <td style="padding:6px 8px">
      <input type="number" class="form-control" id="pur-qty-${idx}"
             placeholder="Qty" style="width:58px" value="0" oninput="calcPurRow(${idx})">
    </td>
    <td style="padding:6px 8px">
      <input type="number" class="form-control" id="pur-free-${idx}"
             placeholder="0" style="width:50px" value="0">
    </td>
    <td style="padding:6px 8px">
      <input type="number" class="form-control" id="pur-disc-${idx}"
             placeholder="0" style="width:50px" value="0" oninput="calcPurRow(${idx})">
    </td>
    <td style="padding:6px 8px">
      <input type="number" class="form-control" id="pur-gst-${idx}"
             placeholder="0" style="width:50px" value="0" oninput="calcPurRow(${idx})">
    </td>
    <td style="padding:6px 8px;text-align:right">
      <span class="mono" id="pur-amt-${idx}">0.00</span>
    </td>
    <td style="padding:6px 4px">
      <button class="btn btn-ghost btn-sm text-red" onclick="removePurRow(${idx})">✕</button>
    </td>
  `;
  tbody.appendChild(tr);

  purEnsurePortal(idx);
  setTimeout(() => document.getElementById(`pur-ps-input-${idx}`)?.focus(), 40);
}

// ─── Purchase product search portal ──────────────────────
function purEnsurePortal(idx) {
  if (document.getElementById(`pur-portal-${idx}`)) return;
  const portal = document.createElement('div');
  portal.id = `pur-portal-${idx}`;
  portal.className = 'prod-dropdown-portal';
  portal.style.display = 'none';
  document.body.appendChild(portal);
  purRenderDrop(idx, allProducts);
}

function purRenderDrop(idx, list) {
  const portal = document.getElementById(`pur-portal-${idx}`);
  if (!portal) return;
  const q = (document.getElementById(`pur-ps-input-${idx}`)?.value || '').toLowerCase();
  if (list.length === 0) {
    portal.innerHTML = `<div class="pd-item pd-empty">No products found</div>`;
    return;
  }
  portal.innerHTML = list.map(p => {
    let name = p.name;
    if (q) {
      const i = name.toLowerCase().indexOf(q);
      if (i >= 0) name = name.substring(0,i) + '<mark>' + name.substring(i, i+q.length) + '</mark>' + name.substring(i+q.length);
    }
    return `<div class="pd-item" onmousedown="purSelectProduct(${idx},${p.product_id},'${p.name.replace(/'/g,"\\'")}')">${name}</div>`;
  }).join('');
}

function purFilterDrop(idx) {
  const q = (document.getElementById(`pur-ps-input-${idx}`)?.value || '').toLowerCase().trim();
  const filtered = q ? allProducts.filter(p => p.name.toLowerCase().includes(q)) : allProducts;
  purRenderDrop(idx, filtered);
  purOpenDrop(idx);
}

function purOpenDrop(idx) {
  document.querySelectorAll('.prod-dropdown-portal').forEach(p => p.style.display = 'none');
  const input  = document.getElementById(`pur-ps-input-${idx}`);
  const portal = document.getElementById(`pur-portal-${idx}`);
  if (!input || !portal) return;
  const rect = input.getBoundingClientRect();
  portal.style.position = 'fixed';
  portal.style.top      = (rect.bottom + 3) + 'px';
  portal.style.left     = rect.left + 'px';
  portal.style.width    = Math.max(rect.width, 260) + 'px';
  portal.style.display  = 'block';
  portal.style.zIndex   = '99999';
}

function purSearchKey(e, idx) {
  const portal = document.getElementById(`pur-portal-${idx}`);
  if (!portal || portal.style.display === 'none') return;
  const items = portal.querySelectorAll('.pd-item:not(.pd-empty)');
  const current = portal.querySelector('.pd-item.focused');
  let ci = Array.from(items).indexOf(current);
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    ci = Math.min(ci+1, items.length-1);
    items.forEach(i => i.classList.remove('focused'));
    if (items[ci]) { items[ci].classList.add('focused'); items[ci].scrollIntoView({block:'nearest'}); }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    ci = Math.max(ci-1, 0);
    items.forEach(i => i.classList.remove('focused'));
    if (items[ci]) { items[ci].classList.add('focused'); items[ci].scrollIntoView({block:'nearest'}); }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const focused = portal.querySelector('.pd-item.focused');
    if (focused) focused.dispatchEvent(new MouseEvent('mousedown'));
  } else if (e.key === 'Escape' || e.key === 'Tab') {
    document.querySelectorAll('.prod-dropdown-portal').forEach(p => p.style.display = 'none');
  }
}

async function purSelectProduct(idx, productId, productName) {
  document.getElementById(`pur-ps-input-${idx}`).value = productName;
  document.getElementById(`pur-ps-val-${idx}`).value   = productId;
  document.querySelectorAll('.prod-dropdown-portal').forEach(p => p.style.display = 'none');

  purchaseItems[idx].product_id = productId;

  // Pre-fill GST from product master immediately
  const prod = allProducts.find(p => p.product_id == productId);
  if (prod) {
    document.getElementById(`pur-gst-${idx}`).value = prod.gst_percent || 0;
  }

  // Fetch last purchase rate + MRP from backend
  try {
    const last = await api.get(`/products/${productId}/last-rate`);
    if (last) {
      const mrpEl  = document.getElementById(`pur-mrp-${idx}`);
      const rateEl = document.getElementById(`pur-rate-${idx}`);
      const gstEl  = document.getElementById(`pur-gst-${idx}`);
      if (mrpEl  && !mrpEl.value)  mrpEl.value  = last.mrp           || '';
      if (rateEl && !rateEl.value) rateEl.value  = last.purchase_rate || '';
      if (gstEl)                   gstEl.value   = last.gst_pct       || prod?.gst_percent || 0;
      calcPurRow(idx);
    }
  } catch(_) {}

  // Move focus to batch
  setTimeout(() => document.getElementById(`pur-batch-${idx}`)?.focus(), 50);
}

function removePurRow(idx) {
  document.getElementById(`pur-row-${idx}`)?.remove();
  document.getElementById(`pur-portal-${idx}`)?.remove();
  calcPurchaseTotals();
}

function calcPurRow(idx) {
  const rate = parseFloat(document.getElementById(`pur-rate-${idx}`)?.value || 0);
  const qty  = parseFloat(document.getElementById(`pur-qty-${idx}`)?.value  || 0);
  const disc = parseFloat(document.getElementById(`pur-disc-${idx}`)?.value || 0);
  const gst  = parseFloat(document.getElementById(`pur-gst-${idx}`)?.value  || 0);
  let amt = rate * qty;
  amt = amt - (amt * disc / 100);
  amt = amt + (amt * gst / 100);
  const el = document.getElementById(`pur-amt-${idx}`);
  if (el) el.textContent = amt.toFixed(2);
  calcPurchaseTotals();
}

function calcPurchaseTotals() {
  let subtotal = 0;
  for (let i = 0; i < purchaseItems.length; i++) {
    const el = document.getElementById(`pur-amt-${i}`);
    if (el) subtotal += parseFloat(el.textContent || 0);
  }
  const disc = parseFloat(document.getElementById('pur-disc')?.value || 0);
  document.getElementById('pur-subtotal').textContent      = fmtCurrency(subtotal);
  document.getElementById('pur-discount-disp').textContent = fmtCurrency(disc);
  document.getElementById('pur-net').textContent           = fmtCurrency(subtotal - disc);
}

async function savePurchase() {
  const distId = document.getElementById('pur-dist').value;
  const date   = document.getElementById('pur-date').value;
  if (!distId || !date) { toast('Fill distributor and date', 'error'); return; }

  const items = [];
  for (let i = 0; i < purchaseItems.length; i++) {
    const row = document.getElementById(`pur-row-${i}`);
    if (!row) continue;
    const productId = document.getElementById(`pur-ps-val-${i}`)?.value;
    if (!productId) continue;
    const amt = parseFloat(document.getElementById(`pur-amt-${i}`)?.textContent || 0);
    items.push({
      product_id:    productId,
      batch_no:      document.getElementById(`pur-batch-${i}`)?.value || '',
      expiry_date:   document.getElementById(`pur-exp-${i}`)?.value   || null,
      mrp:           parseFloat(document.getElementById(`pur-mrp-${i}`)?.value   || 0),
      purchase_rate: parseFloat(document.getElementById(`pur-rate-${i}`)?.value  || 0),
      qty_ordered:   parseInt(document.getElementById(`pur-qty-${i}`)?.value     || 0),
      qty_free:      parseInt(document.getElementById(`pur-free-${i}`)?.value    || 0),
      discount_pct:  parseFloat(document.getElementById(`pur-disc-${i}`)?.value  || 0),
      gst_pct:       parseFloat(document.getElementById(`pur-gst-${i}`)?.value   || 0),
      line_amount:   amt
    });
  }

  if (items.length === 0) { toast('Add at least one item', 'error'); return; }

  try {
    await api.post('/purchase', {
      header: {
        distributor_id:  distId,
        invoice_no:      document.getElementById('pur-inv').value,
        purchase_date:   date,
        discount_amount: parseFloat(document.getElementById('pur-disc').value || 0)
      },
      items
    });
    document.querySelectorAll('.prod-dropdown-portal').forEach(p => p.remove());
    toast('Purchase saved & stock updated!', 'success');
    closeModal();
    renderPurchase();
  } catch (e) { toast(e.message, 'error'); }
}

async function viewPurchase(id) {
  try {
    const { header, items } = await api.get(`/purchase/${id}`);
    showModal(`
      <div class="section-title">PURCHASE #${id} — ${header.distributor_name}</div>
      <div class="flex gap-16 mb-16" style="font-size:12px;color:var(--text-secondary)">
        <span>Date: <b class="text-accent">${fmtDate(header.purchase_date)}</b></span>
        <span>Invoice: <b>${header.invoice_no || '-'}</b></span>
        <span>Net: <b class="text-green">${fmtCurrency(header.net_amount)}</b></span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>PRODUCT</th><th>BATCH</th><th>EXPIRY</th><th>MRP</th>
            <th>RATE</th><th>QTY</th><th>FREE</th><th class="text-right">TOTAL QTY</th><th class="text-right">AMOUNT</th>
          </tr></thead>
          <tbody>
            ${items.map(i => `<tr>
              <td>${i.product_name}</td>
              <td class="mono">${i.batch_no || '-'}</td>
              <td>${fmtDate(i.expiry_date)}</td>
              <td class="mono">${fmtCurrency(i.mrp)}</td>
              <td class="mono">${fmtCurrency(i.purchase_rate)}</td>
              <td class="text-right">${i.qty_ordered}</td>
              <td class="text-right">${i.qty_free}</td>
              <td class="text-right mono text-accent"><b>${i.qty_total}</b></td>
              <td class="text-right mono">${fmtCurrency(i.line_amount)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `, '900px');
  } catch (e) { toast(e.message, 'error'); }
}

async function deletePurchase(id) {
  if (!confirmDel('Delete this purchase and reverse stock?')) return;
  try {
    await api.delete(`/purchase/${id}`);
    toast('Purchase deleted', 'success');
    renderPurchase();
  } catch (e) { toast(e.message, 'error'); }
}

// Close portals on outside click / scroll
document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('.prod-search-wrap') && !e.target.closest('.prod-dropdown-portal')) {
    document.querySelectorAll('.prod-dropdown-portal').forEach(p => p.style.display = 'none');
  }
});