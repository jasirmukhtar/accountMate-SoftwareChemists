async function renderDashboard() {
  const el = document.getElementById('page-dashboard');
  el.innerHTML = loading();
  try {
    const [summary, daywise] = await Promise.all([
      api.get('/analytics/summary'),
      api.get('/analytics/daywise?days=14')
    ]);
    const s = summary;
    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">DASHBOARD</div>
          <div class="page-subtitle">${new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">TODAY'S SALE</div>
          <div class="stat-value text-accent">${fmtCurrency(s.today_sale.total)}</div>
          <div class="stat-sub">${s.today_sale.count} invoices</div>
        </div>
        <div class="stat-card green">
          <div class="stat-label">MONTH SALE</div>
          <div class="stat-value text-green">${fmtCurrency(s.month_sale.total)}</div>
          <div class="stat-sub">${s.month_sale.count} invoices</div>
        </div>
        <div class="stat-card blue">
          <div class="stat-label">TODAY PURCHASE</div>
          <div class="stat-value">${fmtCurrency(s.today_purchase.total)}</div>
          <div class="stat-sub">${s.today_purchase.count} purchases</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">STOCK VALUE</div>
          <div class="stat-value">${fmtCurrency(s.stock_value)}</div>
          <div class="stat-sub">at purchase rate</div>
        </div>
        <div class="stat-card red">
          <div class="stat-label">LOW STOCK</div>
          <div class="stat-value text-red">${s.low_stock}</div>
          <div class="stat-sub">products &lt; 10 units</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-label">EXPIRY ALERTS</div>
          <div class="stat-value" style="color:var(--purple)">${s.expiry_alert}</div>
          <div class="stat-sub">within 90 days</div>
        </div>
      </div>

      <div class="chart-container mb-24">
        <div class="card-title">SALES — LAST 14 DAYS</div>
        <canvas id="chart-daywise" height="80"></canvas>
      </div>

      <div class="flex gap-16">
        <div class="flex-1">
          <div class="card">
            <div class="card-title">QUICK ACTIONS</div>
            <div class="flex gap-8" style="flex-wrap:wrap">
              <button class="btn btn-primary" onclick="navigate('purchase')">+ New Purchase</button>
              <button class="btn btn-secondary" onclick="navigate('sales')">+ New Sale</button>
              <button class="btn btn-secondary" onclick="navigate('analytics')">View Analytics</button>
              <button class="btn btn-secondary" onclick="navigate('expiry')">Expiry Alerts</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Draw chart
    drawDaywiseChart('chart-daywise', daywise);
  } catch (e) {
    el.innerHTML = `<div class="empty-state">Error loading dashboard: ${e.message}</div>`;
  }
}

function drawDaywiseChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.parentElement.offsetWidth - 40;
  const H = 160;
  canvas.width = W; canvas.height = H;

  if (!data.length) {
    ctx.fillStyle = '#4a4f6a';
    ctx.font = '13px IBM Plex Mono';
    ctx.fillText('No sales data', W/2 - 50, H/2);
    return;
  }

  const maxVal = Math.max(...data.map(d => parseFloat(d.total_sale)));
  const barW = Math.floor((W - 40) / data.length) - 4;
  const pad = 30;

  ctx.clearRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = '#252733';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad + (H - pad - pad) * (1 - i/4);
    ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(W, y); ctx.stroke();
  }

  data.forEach((d, i) => {
    const val = parseFloat(d.total_sale);
    const barH = maxVal > 0 ? ((val / maxVal) * (H - pad - pad)) : 0;
    const x = 40 + i * (barW + 4);
    const y = H - pad - barH;

    // Bar
    ctx.fillStyle = '#f59e0b44';
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(x, y, barW, 2);

    // Date label
    ctx.fillStyle = '#4a4f6a';
    ctx.font = '9px IBM Plex Mono';
    ctx.textAlign = 'center';
    const label = d.sale_date ? d.sale_date.substring(5) : '';
    ctx.fillText(label, x + barW/2, H - 8);
  });
}
