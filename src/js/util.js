export function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
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
