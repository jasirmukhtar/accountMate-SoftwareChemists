async function renderProducts() {
  const el = document.getElementById('page-products');
  el.innerHTML = loading();
  try {
    const products = await api.get('/products');
    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">PRODUCTS</div>
          <div class="page-subtitle">Product master list</div>
        </div>
        <button class="btn btn-primary" onclick="showAddProduct()">+ Add Product</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>#</th><th>PRODUCT NAME</th><th>UNIT</th><th>HSN CODE</th><th>GST %</th><th>ACTION</th>
          </tr></thead>
          <tbody>
            ${products.length === 0 ? `<tr><td colspan="6">${emptyState('No products')}</td></tr>` :
              products.map((p, i) => `
                <tr>
                  <td class="mono text-muted">${p.product_id}</td>
                  <td><b>${p.name}</b></td>
                  <td><span class="badge badge-blue">${p.unit}</span></td>
                  <td class="mono">${p.hsn_code || '-'}</td>
                  <td class="mono">${p.gst_percent}%</td>
                  <td>
                    <button class="btn btn-ghost btn-sm" onclick="showEditProduct(${p.product_id},'${p.name.replace(/'/g,"\\'")}','${p.unit}','${p.hsn_code||''}',${p.gst_percent})">Edit</button>
                  </td>
                </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch(e) { el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

function showAddProduct() {
  showModal(`
    <div class="section-title">ADD PRODUCT</div>
    <div class="form-grid form-grid-2" style="gap:14px">
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">PRODUCT NAME *</label>
        <input id="prod-name" class="form-control" placeholder="e.g. Paracetamol 500mg Strip">
      </div>
      <div class="form-group">
        <label class="form-label">UNIT</label>
        <select id="prod-unit" class="form-control">
          <option>STRIPS</option><option>BOTTLES</option><option>PKTS</option>
          <option>PCS</option><option>VIALS</option><option>TUBES</option><option>BOXES</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">HSN CODE</label>
        <input id="prod-hsn" class="form-control" placeholder="e.g. 30049099">
      </div>
      <div class="form-group">
        <label class="form-label">GST %</label>
        <select id="prod-gst" class="form-control">
          <option value="0">0%</option>
          <option value="5">5%</option>
          <option value="12" selected>12%</option>
          <option value="18">18%</option>
          <option value="28">28%</option>
        </select>
      </div>
    </div>
    <div class="divider"></div>
    <div class="flex gap-8" style="justify-content:flex-end">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveProduct()">Add Product</button>
    </div>
  `, '500px');
}

async function saveProduct() {
  const name = document.getElementById('prod-name').value.trim();
  if (!name) { toast('Product name required', 'error'); return; }
  try {
    await api.post('/products', {
      name,
      unit:       document.getElementById('prod-unit').value,
      hsn_code:   document.getElementById('prod-hsn').value,
      gst_percent: parseFloat(document.getElementById('prod-gst').value)
    });
    toast('Product added!', 'success');
    closeModal();
    renderProducts();
  } catch(e) { toast(e.message, 'error'); }
}

function showEditProduct(id, name, unit, hsn, gst) {
  showModal(`
    <div class="section-title">EDIT PRODUCT #${id}</div>
    <div class="form-grid form-grid-2" style="gap:14px">
      <div class="form-group" style="grid-column:span 2">
        <label class="form-label">PRODUCT NAME *</label>
        <input id="edit-prod-name" class="form-control" value="${name}">
      </div>
      <div class="form-group">
        <label class="form-label">UNIT</label>
        <select id="edit-prod-unit" class="form-control">
          ${['STRIPS','BOTTLES','PKTS','PCS','VIALS','TUBES','BOXES'].map(u =>
            `<option ${u===unit?'selected':''}>${u}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">HSN CODE</label>
        <input id="edit-prod-hsn" class="form-control" value="${hsn}">
      </div>
      <div class="form-group">
        <label class="form-label">GST %</label>
        <select id="edit-prod-gst" class="form-control">
          ${[0,5,12,18,28].map(g =>
            `<option value="${g}" ${g==gst?'selected':''}>${g}%</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="divider"></div>
    <div class="flex gap-8" style="justify-content:flex-end">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="updateProduct(${id})">Update</button>
    </div>
  `, '500px');
}

async function updateProduct(id) {
  try {
    await api.put(`/products/${id}`, {
      name:        document.getElementById('edit-prod-name').value.trim(),
      unit:        document.getElementById('edit-prod-unit').value,
      hsn_code:    document.getElementById('edit-prod-hsn').value,
      gst_percent: parseFloat(document.getElementById('edit-prod-gst').value)
    });
    toast('Product updated!', 'success');
    closeModal();
    renderProducts();
  } catch(e) { toast(e.message, 'error'); }
}
