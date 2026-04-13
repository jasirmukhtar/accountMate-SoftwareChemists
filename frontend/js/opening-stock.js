let osItems = [];
let osProducts = [];

async function renderOpeningStock() {
  const el = document.getElementById('page-opening-stock');
  el.innerHTML = loading();
  try {
    const [products, entries] = await Promise.all([
      api.get('/products'),
      api.get('/opening-stock')
    ]);
    osProducts = products;

    const grouped = {};
    entries.forEach(e => {
      const day = (e.added_at || '').substring(0, 10);
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(e);
    });

    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">OPENING STOCK</div>
          <div class="page-subtitle">Add existing stock not linked to any purchase</div>
        </div>
        <button class="btn btn-primary" onclick="showOpeningStockForm()">+ Add Opening Stock</button>
      </div>

      ${entries.length === 0
        ? `<div class="card">${emptyState('No opening stock entries yet.')}</div>`
        : Object.keys(grouped).sort().reverse().map(day => `
            <div class="section-title" style="margin-bottom:8px">
              Added on ${day}
              <span class="badge badge-blue" style="margin-left:8px">${grouped[day].length} entries</span>
            </div>
            <div class="table-wrap mb-24">
              <table>
                <thead><tr>
                  <th>PRODUCT</th><th>UNIT</th><th>BATCH</th><th>EXPIRY</th>
                  <th>MRP</th><th>PUR.RATE</th><th>GST%</th>
                  <th class="text-right">QTY IN</th>
                  <th class="text-right">SOLD</th>
                  <th class="text-right">BALANCE</th>
                  <th></th>
                </tr></thead>
                <tbody>
                  ${grouped[day].map(e => {
                    const daysLeft = e.expiry_date
                      ? Math.ceil((new Date(e.expiry_date) - new Date()) / 86400000) : null;
                    const expCls = daysLeft !== null
                      ? (daysLeft < 30 ? 'text-red' : daysLeft < 90 ? 'text-accent' : '') : '';
                    return `<tr>
                      <td><b>${e.product_name}</b></td>
                      <td>${e.unit}</td>
                      <td class="mono">${e.batch_no || '-'}</td>
                      <td class="${expCls}">
                        ${fmtDate(e.expiry_date)}
                        ${daysLeft !== null ? `<small>(${daysLeft}d)</small>` : ''}
                      </td>
                      <td class="mono">${fmtCurrency(e.mrp)}</td>
                      <td class="mono">${fmtCurrency(e.purchase_rate)}</td>
                      <td class="mono">${e.gst_pct}%</td>
                      <td class="text-right mono text-accent">${e.qty_in}</td>
                      <td class="text-right mono">${e.qty_sold}</td>
                      <td class="text-right mono text-green"><b>${e.qty_balance}</b></td>
                      <td>
                        ${e.qty_sold == 0
                          ? `<button class="btn btn-ghost btn-sm text-red" onclick="deleteOpeningStock(${e.stock_id})">Del</button>`
                          : `<span style="font-size:10px;color:var(--text-muted)">in use</span>`}
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `).join('')
      }
    `;
  } catch(e) { el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

// ─── Entry Form ───────────────────────────────────────────
function showOpeningStockForm() {
  osItems = [];
  showModal(`
    <div class="section-title">ADD OPENING STOCK</div>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px">
      Stock already on hand but not in the system. Same batch merges with existing stock automatically.
    </p>

    <div class="sal-items-plain mb-12">
      <table class="sal-items-table" style="width:100%;border-collapse:collapse">
        <thead>
          <tr class="sal-items-head">
            <th style="min-width:230px">PRODUCT *</th>
            <th style="width:95px">BATCH NO</th>
            <th style="width:130px">EXPIRY DATE</th>
            <th style="width:78px">MRP</th>
            <th style="width:78px">PUR.RATE</th>
            <th style="width:62px">QTY *</th>
            <th style="width:55px">GST%</th>
            <th style="width:32px"></th>
          </tr>
        </thead>
        <tbody id="os-items-body"></tbody>
      </table>
    </div>

    <button class="btn btn-secondary btn-sm mb-16" onclick="addOsRow()">+ Add Row</button>

    <div class="flex gap-8" style="justify-content:flex-end">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveOpeningStock()">Save Opening Stock</button>
    </div>
  `, '960px');

  addOsRow(); addOsRow(); addOsRow();
}

function addOsRow() {
  const idx = osItems.length;
  osItems.push({});
  const tbody = document.getElementById('os-items-body');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.id = `os-row-${idx}`;
  tr.style.borderBottom = '1px solid var(--border)';
  tr.innerHTML = `
    <td style="padding:6px 8px;position:relative">
      <div class="prod-search-wrap" id="os-psw-${idx}">
        <input class="form-control prod-search-input"
               id="os-ps-input-${idx}"
               placeholder="Search product…"
               autocomplete="off"
               oninput="osFilterDrop(${idx})"
               onfocus="osOpenDrop(${idx})"
               onkeydown="osSearchKey(event,${idx})">
        <input type="hidden" id="os-ps-val-${idx}">
      </div>
    </td>
    <td style="padding:6px 8px">
      <input class="form-control" id="os-batch-${idx}" placeholder="e.g. BT-001" style="width:88px">
    </td>
    <td style="padding:6px 8px">
      <input type="date" class="form-control" id="os-exp-${idx}" style="width:128px">
    </td>
    <td style="padding:6px 8px">
      <input type="number" class="form-control" id="os-mrp-${idx}"
             placeholder="0.00" min="0" step="0.01" style="width:72px">
    </td>
    <td style="padding:6px 8px">
      <input type="number" class="form-control" id="os-rate-${idx}"
             placeholder="0.00" min="0" step="0.01" style="width:72px">
    </td>
    <td style="padding:6px 8px">
      <input type="number" class="form-control" id="os-qty-${idx}"
             placeholder="0" min="1" style="width:58px">
    </td>
    <td style="padding:6px 8px">
      <input type="number" class="form-control" id="os-gst-${idx}"
             placeholder="0" min="0" max="28" style="width:50px" value="0">
    </td>
    <td style="padding:6px 4px">
      <button class="btn btn-ghost btn-sm text-red" onclick="removeOsRow(${idx})">✕</button>
    </td>
  `;
  tbody.appendChild(tr);
  osEnsurePortal(idx);
}

// ─── Opening Stock search portal ─────────────────────────
function osEnsurePortal(idx) {
  if (document.getElementById(`os-portal-${idx}`)) return;
  const portal = document.createElement('div');
  portal.id = `os-portal-${idx}`;
  portal.className = 'prod-dropdown-portal';
  portal.style.display = 'none';
  document.body.appendChild(portal);
  osRenderDrop(idx, osProducts);
}

function osRenderDrop(idx, list) {
  const portal = document.getElementById(`os-portal-${idx}`);
  if (!portal) return;
  const q = (document.getElementById(`os-ps-input-${idx}`)?.value || '').toLowerCase();
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
    return `<div class="pd-item" onmousedown="osSelectProduct(${idx},${p.product_id},'${p.name.replace(/'/g,"\\'")}')">${name}</div>`;
  }).join('');
}

function osFilterDrop(idx) {
  const q = (document.getElementById(`os-ps-input-${idx}`)?.value || '').toLowerCase().trim();
  const filtered = q ? osProducts.filter(p => p.name.toLowerCase().includes(q)) : osProducts;
  osRenderDrop(idx, filtered);
  osOpenDrop(idx);
}

function osOpenDrop(idx) {
  document.querySelectorAll('.prod-dropdown-portal').forEach(p => p.style.display = 'none');
  const input  = document.getElementById(`os-ps-input-${idx}`);
  const portal = document.getElementById(`os-portal-${idx}`);
  if (!input || !portal) return;
  const rect = input.getBoundingClientRect();
  portal.style.position = 'fixed';
  portal.style.top      = (rect.bottom + 3) + 'px';
  portal.style.left     = rect.left + 'px';
  portal.style.width    = Math.max(rect.width, 260) + 'px';
  portal.style.display  = 'block';
  portal.style.zIndex   = '99999';
}

function osSearchKey(e, idx) {
  const portal = document.getElementById(`os-portal-${idx}`);
  if (!portal || portal.style.display === 'none') return;
  const items = portal.querySelectorAll('.pd-item:not(.pd-empty)');
  const current = portal.querySelector('.pd-item.focused');
  let ci = Array.from(items).indexOf(current);
  if (e.key === 'ArrowDown') {
    e.preventDefault(); ci = Math.min(ci+1, items.length-1);
    items.forEach(i => i.classList.remove('focused'));
    if (items[ci]) { items[ci].classList.add('focused'); items[ci].scrollIntoView({block:'nearest'}); }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault(); ci = Math.max(ci-1, 0);
    items.forEach(i => i.classList.remove('focused'));
    if (items[ci]) { items[ci].classList.add('focused'); items[ci].scrollIntoView({block:'nearest'}); }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    portal.querySelector('.pd-item.focused')?.dispatchEvent(new MouseEvent('mousedown'));
  } else if (e.key === 'Escape' || e.key === 'Tab') {
    document.querySelectorAll('.prod-dropdown-portal').forEach(p => p.style.display = 'none');
  }
}

async function osSelectProduct(idx, productId, productName) {
  document.getElementById(`os-ps-input-${idx}`).value = productName;
  document.getElementById(`os-ps-val-${idx}`).value   = productId;
  document.querySelectorAll('.prod-dropdown-portal').forEach(p => p.style.display = 'none');

  osItems[idx] = osItems[idx] || {};
  osItems[idx].product_id = productId;

  // Pre-fill GST from product master immediately
  const prod = osProducts.find(p => p.product_id == productId);
  if (prod) {
    document.getElementById(`os-gst-${idx}`).value = prod.gst_percent || 0;
  }

  // Fetch last known rate + MRP
  try {
    const last = await api.get(`/products/${productId}/last-rate`);
    if (last) {
      const mrpEl  = document.getElementById(`os-mrp-${idx}`);
      const rateEl = document.getElementById(`os-rate-${idx}`);
      const gstEl  = document.getElementById(`os-gst-${idx}`);
      if (mrpEl  && !mrpEl.value)  mrpEl.value  = last.mrp           || '';
      if (rateEl && !rateEl.value) rateEl.value  = last.purchase_rate || '';
      if (gstEl)                   gstEl.value   = last.gst_pct       || prod?.gst_percent || 0;
    }
  } catch(_) {}

  // Move to batch
  setTimeout(() => document.getElementById(`os-batch-${idx}`)?.focus(), 50);
}

function removeOsRow(idx) {
  document.getElementById(`os-row-${idx}`)?.remove();
  document.getElementById(`os-portal-${idx}`)?.remove();
}

async function saveOpeningStock() {
  const items = [];

  for (let i = 0; i < osItems.length; i++) {
    const row = document.getElementById(`os-row-${i}`);
    if (!row) continue;
    const productId = document.getElementById(`os-ps-val-${i}`)?.value;
    if (!productId) continue;

    const qty = parseInt(document.getElementById(`os-qty-${i}`)?.value || 0);
    if (qty <= 0) { toast(`Row ${i+1}: Qty must be > 0`, 'error'); return; }

    items.push({
      product_id:    parseInt(productId),
      batch_no:      document.getElementById(`os-batch-${i}`)?.value?.trim() || '',
      expiry_date:   document.getElementById(`os-exp-${i}`)?.value   || null,
      mrp:           parseFloat(document.getElementById(`os-mrp-${i}`)?.value  || 0),
      purchase_rate: parseFloat(document.getElementById(`os-rate-${i}`)?.value || 0),
      qty_in:        qty,
      gst_pct:       parseFloat(document.getElementById(`os-gst-${i}`)?.value  || 0)
    });
  }

  if (items.length === 0) { toast('Add at least one item with a product and qty', 'error'); return; }

  try {
    const result = await api.post('/opening-stock', { items });
    document.querySelectorAll('.prod-dropdown-portal').forEach(p => p.remove());
    toast(result.message, 'success');
    closeModal();
    renderOpeningStock();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteOpeningStock(stockId) {
  if (!confirmDel('Delete this opening stock entry?')) return;
  try {
    await api.delete(`/opening-stock/${stockId}`);
    toast('Entry deleted', 'success');
    renderOpeningStock();
  } catch(e) { toast(e.message, 'error'); }
}

// Close portals on outside click
document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('.prod-search-wrap') && !e.target.closest('.prod-dropdown-portal')) {
    document.querySelectorAll('.prod-dropdown-portal').forEach(p => p.style.display = 'none');
  }
});