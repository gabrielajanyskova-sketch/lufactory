// Bezpečné pro text i pro hodnoty atributů v uvozovkách.
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

export function formatPrice(n) {
  return n.toLocaleString('cs-CZ') + ' Kč';
}

// Hodnota skrytého pole proti robotům (.hp-field) — worker požadavek s vyplněným polem zahodí.
export function honeypot(form) {
  const input = form && form.querySelector('input[name="lf_hp"]');
  return input ? input.value : '';
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
