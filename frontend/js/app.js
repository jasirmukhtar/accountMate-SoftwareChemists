// ─── Navigation Router ───────────────────────────────────

// Use lazy lookup so load order of script files doesn't matter
const pageRenderers = {
  'dashboard':      () => renderDashboard(),
  'purchase':       () => renderPurchase(),
  'sales':          () => renderSales(),
  'stock':          () => renderStock(),
  'opening-stock':  () => renderOpeningStock(),
  'products':       () => renderProducts(),
  'distributors':   () => renderDistributors(),
  'analytics':      () => renderAnalytics(),
  'expiry':         () => renderExpiry()
};

let currentPage = null;

function navigate(page) {
  const renderer = pageRenderers[page];
  if (!renderer) {
    console.warn('[navigate] No renderer for page:', page);
    return;
  }

  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Show target
  const target = document.getElementById('page-' + page);
  if (target) {
    target.classList.add('active');
  } else {
    console.warn('[navigate] No DOM element found: #page-' + page);
  }

  // Update nav highlight
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const activeNav = document.querySelector('.nav-item[data-page="' + page + '"]');
  if (activeNav) activeNav.classList.add('active');

  currentPage = page;

  try {
    renderer();
  } catch(e) {
    console.error('[navigate] Error rendering page ' + page + ':', e);
  }
}

// ─── App Boot ─────────────────────────────────────────────
async function bootApp() {
  try {
    const config = await fetch('http://localhost:3737/api/config').then(r => r.json());
    const sidebarShop = document.getElementById('shop-name-sidebar');
    if (sidebarShop && config.shop_name) {
      sidebarShop.textContent = config.shop_name;
      sidebarShop.title = config.shop_name;
    }
    window._shopConfig = config;
  } catch(e) {
    console.warn('[boot] Could not load shop config:', e.message);
  }

  navigate('dashboard');
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(bootApp, 300);
});

// ─── Keyboard shortcuts ───────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.altKey) {
    const map = { '1':'dashboard','2':'purchase','3':'sales','4':'stock','5':'analytics','6':'opening-stock' };
    if (map[e.key]) navigate(map[e.key]);
  }
  if (e.key === 'Escape') closeModal();
});
