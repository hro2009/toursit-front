export async function api(path, options = {}) {
  const response = await fetch(window.hayqApiUrl(`/api${path}`), {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    credentials: 'include'
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Request failed (${response.status}).`);
  return payload.data;
}

export const state = { tours: [], addons: [], services: [], settings: {}, currency: 'AMD', language: 'en' };
export const assetUrl = path => window.hayqApiUrl(path);
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const byId = id => document.getElementById(id);
export const money = value => state.currency === 'AMD'
  ? `${Number(value).toLocaleString('en-US')} ֏`
  : `$${Math.round(Number(value) / Number(state.settings.usd_rate || 390)).toLocaleString('en-US')}`;
