function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span> ${msg}`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

function showModal(html, maxW = '700px') {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-box').style.maxWidth = maxW;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-content').innerHTML = '';
}

function fmtCurrency(v) {
  return '₹ ' + parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d) {
  if (!d) return '-';
  return d.substring(0, 10);
}
function todayISO() {
  return new Date().toISOString().split('T')[0];
}
function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

function emptyState(msg = 'No records found') {
  return `<div class="empty-state"><div class="empty-icon">◈</div>${msg}</div>`;
}
function loading() {
  return `<div class="loading">LOADING...</div>`;
}

function confirmDel(msg = 'Delete this record?') {
  return confirm(msg);
}
