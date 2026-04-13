async function renderAnalytics() {
  const el = document.getElementById('page-analytics');
  el.innerHTML = loading();
  try {
    const [daywise30, monthly, topProducts] = await Promise.all([
      api.get('/analytics/daywise?days=30'),
      api.get('/analytics/monthly'),
      api.get('/analytics/top-products')
    ]);

    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">ANALYTICS</div>
          <div class="page-subtitle">Sales trends and performance insights</div>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-secondary btn-sm" onclick="switchDaywiseRange(14)">14D</button>
          <button class="btn btn-primary btn-sm" id="btn-30d" onclick="switchDaywiseRange(30)">30D</button>
          <button class="btn btn-secondary btn-sm" onclick="switchDaywiseRange(90)">90D</button>
        </div>
      </div>

      <!-- Daywise chart -->
      <div class="chart-container mb-24">
        <div class="flex justify-between align-center mb-16">
          <div class="card-title" style="margin:0">DAY-WISE SALES — LAST 30 DAYS</div>
          <div id="daywise-total" class="mono text-accent" style="font-size:13px"></div>
        </div>
        <canvas id="chart-daywise-main" height="100"></canvas>
      </div>

      <div class="flex gap-16 mb-24">
        <!-- Monthly trend -->
        <div class="chart-container flex-1">
          <div class="card-title">MONTHLY TREND (12 MONTHS)</div>
          <canvas id="chart-monthly" height="120"></canvas>
        </div>

        <!-- Top products -->
        <div class="card" style="min-width:300px">
          <div class="card-title">TOP 10 PRODUCTS — LAST 30 DAYS</div>
          <div id="top-products-list"></div>
        </div>
      </div>
    `;

    drawDaywiseMain(daywise30);
    drawMonthlyChart(monthly);
    renderTopProducts(topProducts);

    window._analyticsData = { daywise30, monthly, topProducts };
  } catch(e) { el.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`; }
}

async function switchDaywiseRange(days) {
  try {
    const data = await api.get(`/analytics/daywise?days=${days}`);
    drawDaywiseMain(data);
    document.querySelector('.chart-container .card-title').textContent =
      `DAY-WISE SALES — LAST ${days} DAYS`;
  } catch(e) { toast(e.message, 'error'); }
}

function drawDaywiseMain(data) {
  const canvas = document.getElementById('chart-daywise-main');
  if (!canvas) return;
  const W = canvas.parentElement.offsetWidth - 40;
  const H = 180;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  if (!data.length) {
    ctx.fillStyle = '#4a4f6a';
    ctx.font = '12px IBM Plex Mono';
    ctx.textAlign = 'center';
    ctx.fillText('No data for this range', W/2, H/2);
    return;
  }

  const maxVal = Math.max(...data.map(d => parseFloat(d.total_sale)));
  const padL = 60, padB = 30, padT = 10, padR = 10;
  const chartW = W - padL - padR;
  const chartH = H - padB - padT;
  const barW   = Math.max(4, Math.floor(chartW / data.length) - 3);

  // Y gridlines + labels
  ctx.strokeStyle = '#252733';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + chartH * (1 - i/4);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillStyle = '#4a4f6a';
    ctx.font = '9px IBM Plex Mono';
    ctx.textAlign = 'right';
    const label = maxVal > 0 ? Math.round(maxVal * (i/4) / 1000) + 'k' : '0';
    ctx.fillText(label, padL - 4, y + 3);
  }

  let totalSale = 0;
  data.forEach((d, i) => {
    const val  = parseFloat(d.total_sale);
    totalSale += val;
    const barH = maxVal > 0 ? (val / maxVal) * chartH : 0;
    const x    = padL + i * (barW + 3);
    const y    = padT + chartH - barH;

    // Gradient-style bar
    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, '#f59e0b');
    grad.addColorStop(1, '#92600a44');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, barW, barH);

    // Date label (every nth)
    if (i % Math.ceil(data.length / 15) === 0) {
      ctx.fillStyle = '#4a4f6a';
      ctx.font = '8px IBM Plex Mono';
      ctx.textAlign = 'center';
      const label = d.sale_date ? d.sale_date.substring(5) : '';
      ctx.fillText(label, x + barW/2, H - 8);
    }
  });

  const totalEl = document.getElementById('daywise-total');
  if (totalEl) totalEl.textContent = `Total: ${fmtCurrency(totalSale)}`;
}

function drawMonthlyChart(data) {
  const canvas = document.getElementById('chart-monthly');
  if (!canvas) return;
  const W = canvas.parentElement.offsetWidth - 40;
  const H = 160;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  if (!data.length) return;

  const maxVal = Math.max(...data.map(d => parseFloat(d.total_sale)));
  const padL = 55, padB = 25, padT = 10, padR = 10;
  const chartW = W - padL - padR;
  const chartH = H - padB - padT;
  const step   = chartW / Math.max(data.length - 1, 1);

  // Grid
  ctx.strokeStyle = '#252733'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + chartH * (1 - i/4);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillStyle = '#4a4f6a'; ctx.font = '9px IBM Plex Mono'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal * i/4 / 1000) + 'k', padL - 4, y + 3);
  }

  // Area fill
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = padL + i * step;
    const y = padT + chartH - (maxVal > 0 ? (parseFloat(d.total_sale)/maxVal) * chartH : 0);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(padL + (data.length-1)*step, padT + chartH);
  ctx.lineTo(padL, padT + chartH);
  ctx.closePath();
  ctx.fillStyle = '#3b82f622';
  ctx.fill();

  // Line
  ctx.beginPath(); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2;
  data.forEach((d, i) => {
    const x = padL + i * step;
    const y = padT + chartH - (maxVal > 0 ? (parseFloat(d.total_sale)/maxVal) * chartH : 0);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Dots + labels
  data.forEach((d, i) => {
    const x = padL + i * step;
    const y = padT + chartH - (maxVal > 0 ? (parseFloat(d.total_sale)/maxVal) * chartH : 0);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI*2);
    ctx.fillStyle = '#3b82f6'; ctx.fill();
    ctx.fillStyle = '#4a4f6a'; ctx.font = '8px IBM Plex Mono';
    ctx.textAlign = 'center';
    ctx.fillText(d.month ? d.month.substring(5) : '', x, H - 8);
  });
}

function renderTopProducts(data) {
  const el = document.getElementById('top-products-list');
  if (!el) return;
  if (!data.length) { el.innerHTML = emptyState('No sales data'); return; }
  const max = parseFloat(data[0].total_revenue);
  el.innerHTML = data.map((p, i) => {
    const pct = max > 0 ? (parseFloat(p.total_revenue)/max)*100 : 0;
    return `
      <div style="margin-bottom:10px">
        <div class="flex justify-between align-center" style="margin-bottom:3px">
          <span style="font-size:12px;color:var(--text-primary)">${i+1}. ${p.name}</span>
          <span class="mono text-accent" style="font-size:11px">${fmtCurrency(p.total_revenue)}</span>
        </div>
        <div style="height:4px;background:var(--border);border-radius:2px">
          <div style="height:4px;width:${pct}%;background:var(--accent);border-radius:2px"></div>
        </div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:1px">Qty sold: ${p.total_qty}</div>
      </div>`;
  }).join('');
}
