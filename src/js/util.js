// Bezpečné pro text i pro hodnoty atributů v uvozovkách.
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

export function formatPrice(n) {
  return n.toLocaleString('cs-CZ') + ' Kč';
}

// fetch → { ok, data } bez ohledu na HTTP status; síťová chyba → { ok: false }.
export function fetchJson(url, options) {
  return fetch(url, options)
    .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
    .catch(() => ({ ok: false, data: null }));
}

// fetch → true/false podle r.ok, síťová chyba → false.
export function postJson(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
    .then((r) => r.ok)
    .catch(() => false);
}
