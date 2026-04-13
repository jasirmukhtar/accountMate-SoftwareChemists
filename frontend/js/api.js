const API_BASE = 'http://localhost:3737/api';

const api = {
  async get(path) {
    const r = await fetch(`${API_BASE}${path}`);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Error');
    return data;
  },
  async put(path, body) {
    const r = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Error');
    return data;
  },
  async delete(path) {
    const r = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  pdfUrl(invoiceId) {
    return `${API_BASE}/sales/${invoiceId}/pdf`;
  }
};
