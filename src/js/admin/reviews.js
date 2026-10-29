// Záložka Recenze — schvalování a mazání. Recenze přichází od zákazníků
// přes veřejný formulář — nikdy jim nevěřit a vždy je escapovat.
import { adminFetch } from './api.js';
import { escapeHtml } from '../util.js';

const STATUSES = [['pending', 'Čeká'], ['approved', 'Schváleno'], ['hidden', 'Skryto']];

export function loadReviews() {
  adminFetch('/api/admin/reviews')
    .then((r) => r.json())
    .then((data) => {
      const reviews = data.reviews || [];
      const tbody = document.getElementById('reviews-tbody');
      tbody.innerHTML = '';
      document.getElementById('reviews-empty').hidden = reviews.length > 0;

      reviews.forEach((r) => {
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + escapeHtml(r.product_title || r.product_id) + '</td>' +
          '<td>' + escapeHtml(r.customer_name) + '</td>' +
          '<td>' + '★'.repeat(r.rating) + '<span class="admin-stars-empty">' + '★'.repeat(5 - r.rating) + '</span></td>' +
          '<td>' + (r.comment ? escapeHtml(r.comment) : '—') + '</td>' +
          '<td><select data-review-status>' +
            STATUSES.map((s) => '<option value="' + s[0] + '"' + (r.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>').join('') +
          '</select></td>' +
          '<td><button type="button" class="icon-btn-delete" data-delete-review title="Smazat recenzi">✕</button></td>';
        tbody.appendChild(tr);

        const path = '/api/admin/reviews/' + r.id;
        tr.querySelector('[data-review-status]').addEventListener('change', (e) => {
          adminFetch(path, { method: 'PATCH', body: { status: e.target.value } });
        });
        tr.querySelector('[data-delete-review]').addEventListener('click', () => {
          if (!confirm('Smazat tuhle recenzi?')) return;
          adminFetch(path, { method: 'DELETE' }).then(() => { loadReviews(); });
        });
      });
    });
}
