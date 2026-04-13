async function renderExpiry() {
  const el = document.getElementById('page-expiry');
  el.innerHTML = loading();
  try {
    const alerts = await api.get('/analytics/expiry-alerts');

    // Group by urgency
    const critical = alerts.filter(a => a.days_left <= 30);
    const warning  = alerts.filter(a => a.days_left > 30 && a.days_left <= 60);
    const caution  = alerts.filter(a => a.days_left > 60);

    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">EXPIRY ALERTS</div>
          <div class="page-subtitle">Stock expiring within 90 days</div>
        </div>
        <div class="flex gap-8">
          <span class="badge badge-red">Critical ≤30d: ${critical.length}</span>
          <span class="badge badge-amber">Warning ≤60d: ${warning.length}</span>
          <span class="badge badge-green">Caution ≤90d: ${caution.length}</span>
        </div>
      </div>

      ${alerts.length === 0
        ? `<div class="card"><div class="empty-state">
            <div class="empty-icon" style="color:var(--green)">✓</div>
            No expiry alerts — all stock is safe beyond 90 days!
           </div></div>`
        : `
        ${critical.length ? `
          <div class="section-title" style="color:var(--red);margin-bottom:8px">⚠ CRITICAL — Expiring within 30 days (${critical.length})</div>
          ${renderExpiryTable(critical)}
          <div class="divider"></div>
        ` : ''}

        ${warning.length ? `
          <div class="section-title" style="color:var(--accent);margin-bottom:8px">⚡ WARNING — Expiring in 31–60 days (${warning.length})</div>
          ${renderExpiryTable(warning)}
          <div class="divider"></div>
        ` : ''}

        ${caution.length ? `
          <div class="section-title" style="color:var(--blue);margin-bottom:8px">ℹ CAUTION — Expiring in 61–90 days (${caution.length})</div>
          ${renderExpiryTable(caution)}
        ` : ''}
      `}
    `;
  } catch(e) { el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

function renderExpiryTable(items) {
  return `
    <div class="table-wrap mb-16">
      <table>
        <thead><tr>
          <th>PRODUCT</th><th>UNIT</th><th>BATCH NO</th>
          <th>EXPIRY DATE</th><th class="text-right">DAYS LEFT</th>
          <th class="text-right">QTY BALANCE</th><th>MRP</th>
        </tr></thead>
        <tbody>
          ${items.map(a => {
            const d = parseInt(a.days_left);
            const cls = d <= 30 ? 'text-red' : d <= 60 ? 'text-accent' : 'text-blue';
            return `<tr>
              <td><b>${a.product_name}</b></td>
              <td>${a.unit}</td>
              <td class="mono">${a.batch_no || '-'}</td>
              <td class="${cls}">${fmtDate(a.expiry_date)}</td>
              <td class="text-right mono ${cls}"><b>${d}</b></td>
              <td class="text-right mono">${a.qty_balance}</td>
              <td class="mono">${fmtCurrency(a.mrp)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}
