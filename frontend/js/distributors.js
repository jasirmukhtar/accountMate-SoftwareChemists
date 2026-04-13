async function renderDistributors() {
  const el = document.getElementById('page-distributors');
  el.innerHTML = loading();
  try {
    const dists = await api.get('/distributors');
    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">DISTRIBUTORS</div>
          <div class="page-subtitle">Registered supplier / distributor list</div>
        </div>
        <button class="btn btn-primary" onclick="showAddDistributor()">+ Add Distributor</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>#</th><th>DISTRIBUTOR NAME</th><th>CONTACT</th><th>GST NO</th><th>ADDRESS</th>
          </tr></thead>
          <tbody>
            ${dists.length === 0 ? `<tr><td colspan="5">${emptyState('No distributors added')}</td></tr>` :
              dists.map(d => `
                <tr>
                  <td class="mono text-muted">${d.distributor_id}</td>
                  <td><b>${d.name}</b></td>
                  <td class="mono">${d.contact || '-'}</td>
                  <td class="mono">${d.gst_no || '-'}</td>
                  <td style="color:var(--text-secondary);font-size:12px">${d.address || '-'}</td>
                </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch(e) { el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

function showAddDistributor() {
  showModal(`
    <div class="section-title">ADD DISTRIBUTOR</div>
    <div class="form-grid" style="gap:14px">
      <div class="form-group">
        <label class="form-label">DISTRIBUTOR NAME *</label>
        <input id="dist-name" class="form-control" placeholder="Company / firm name">
      </div>
      <div class="form-group">
        <label class="form-label">CONTACT NUMBER</label>
        <input id="dist-contact" class="form-control" placeholder="+91-XXXXXXXXXX">
      </div>
      <div class="form-group">
        <label class="form-label">GST NUMBER</label>
        <input id="dist-gst" class="form-control" placeholder="15-digit GST No">
      </div>
      <div class="form-group">
        <label class="form-label">ADDRESS</label>
        <input id="dist-addr" class="form-control" placeholder="Full address">
      </div>
    </div>
    <div class="divider"></div>
    <div class="flex gap-8" style="justify-content:flex-end">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveDistributor()">Add Distributor</button>
    </div>
  `, '520px');
}

async function saveDistributor() {
  const name = document.getElementById('dist-name').value.trim();
  if (!name) { toast('Distributor name required', 'error'); return; }
  try {
    await api.post('/distributors', {
      name,
      contact: document.getElementById('dist-contact').value,
      gst_no:  document.getElementById('dist-gst').value,
      address: document.getElementById('dist-addr').value
    });
    toast('Distributor added!', 'success');
    closeModal();
    renderDistributors();
  } catch(e) { toast(e.message, 'error'); }
}
