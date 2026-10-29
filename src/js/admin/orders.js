// Záložka Objednávky — přehled, stav, faktura, PPL, smazání, export CSV.
import { adminFetch, adminJson, fetchBlobUrl } from './api.js';
import { showLogin } from './auth.js';
import { escapeHtml, formatPrice } from '../util.js';

// Musí zůstat stejné jako ORDER_STATUS_LABELS ve worker/src/index.js —
// klíč "hotovo" navíc spouští na workeru odeslání odkazu na recenzi.
const ORDER_STATUSES = [
  ['nova', 'Nová'],
  ['zaplaceno', 'Zaplaceno'],
  ['odeslano', 'Odesláno'],
  ['hotovo', 'Vyřízeno'],
  ['zruseno', 'Zrušeno']
];

const SHIPPING_LABELS = {
  pickup: 'Osobní odběr',
  'zasilkovna-pickup': 'Zásilkovna – výdejní místo',
  'zasilkovna-address': 'Zásilkovna – doručení na adresu',
  'ppl-pickup': 'PPL – výdejní místo',
  'ppl-address': 'PPL – doručení na adresu'
};

function orderRowHtml(order) {
  const itemsHtml = '<div class="order-items-list">' + order.items.map((i) =>
    '<div class="order-item-row"><span class="nowrap-cell">' + escapeHtml(i.title) + '</span><span class="order-item-qty">' + i.qty + ' ks</span></div>'
  ).join('') + '</div>';

  const statusOptions = ORDER_STATUSES.map((s) =>
    '<option value="' + s[0] + '"' + (s[0] === order.status ? ' selected' : '') + '>' + s[1] + '</option>'
  ).join('');

  const shippingLabel = SHIPPING_LABELS[order.delivery_method] || escapeHtml(order.delivery_method);
  const isPpl = order.delivery_method === 'ppl-address' || order.delivery_method === 'ppl-pickup';

  return '<td class="nowrap-cell">' + escapeHtml(order.order_number) + '</td>' +
    '<td class="nowrap-cell">' + escapeHtml(order.variable_symbol || '') + '</td>' +
    '<td class="nowrap-cell">' + escapeHtml((order.created_at || '').replace('T', ' ').slice(0, 16)) + '</td>' +
    '<td>' + escapeHtml(order.customer_name) + '<br><small>' +
      escapeHtml(order.customer_street) + ', ' + escapeHtml(order.customer_zip) + ' ' + escapeHtml(order.customer_city) + '<br>' +
      escapeHtml(order.customer_email) + '<br>' + escapeHtml(order.customer_phone || '') + '</small></td>' +
    '<td>' + itemsHtml + '</td>' +
    '<td>' + shippingLabel + (order.delivery_detail ? '<br><small>' + escapeHtml(order.delivery_detail) + '</small>' : '') + '</td>' +
    '<td>' + formatPrice(order.total) + '</td>' +
    '<td><select data-order-id="' + order.id + '">' + statusOptions + '</select></td>' +
    '<td><div class="order-actions">' +
      '<button type="button" class="btn btn--outline save-btn" data-invoice-order="' + order.id + '">Faktura</button>' +
      (order.ppl_shipment_number
        ? '<button type="button" class="btn btn--outline save-btn" data-ppl-label-order="' + order.id + '">Štítek PPL</button>'
        : (isPpl ? '<button type="button" class="btn btn--outline save-btn" data-ppl-shipment-order="' + order.id + '">Vytvořit zásilku PPL</button>' : '')) +
      '<button type="button" class="icon-btn-delete" data-delete-order="' + order.id + '" title="Smazat objednávku">✕</button>' +
    '</div>' +
    (order.ppl_error
      ? '<p class="shipping-error-note" title="' + escapeHtml(order.ppl_error) + '">PPL: ' + escapeHtml(order.ppl_error) + '</p>'
      : '') +
    '</td>';
}

// Tlačítko, které otevře soubor (fakturu, štítek) v nové záložce.
function wireOpenFile(btn, path, label) {
  btn.addEventListener('click', () => {
    btn.textContent = 'Načítám…';
    fetchBlobUrl(path)
      .then((url) => { window.open(url, '_blank'); })
      .finally(() => { btn.textContent = label; });
  });
}

export function loadOrders() {
  adminFetch('/api/admin/orders')
    .then((r) => {
      if (r.status === 401) { showLogin('Heslo už neplatí, přihlaste se znovu.'); throw new Error('unauthorized'); }
      return r.json();
    })
    .then((data) => {
      const tbody = document.getElementById('orders-tbody');
      const empty = document.getElementById('orders-empty');
      tbody.innerHTML = '';
      if (!data.orders || data.orders.length === 0) {
        empty.hidden = false;
        return;
      }
      empty.hidden = true;
      data.orders.forEach((order) => {
        const tr = document.createElement('tr');
        tr.innerHTML = orderRowHtml(order);
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('button[data-invoice-order]').forEach((btn) => {
        wireOpenFile(btn, '/api/admin/orders/' + btn.dataset.invoiceOrder + '/invoice', 'Faktura');
      });

      tbody.querySelectorAll('button[data-ppl-label-order]').forEach((btn) => {
        wireOpenFile(btn, '/api/admin/orders/' + btn.dataset.pplLabelOrder + '/ppl-label', 'Štítek PPL');
      });

      tbody.querySelectorAll('button[data-ppl-shipment-order]').forEach((btn) => {
        btn.addEventListener('click', () => {
          btn.textContent = 'Vytvářím…';
          btn.disabled = true;
          adminJson('/api/admin/orders/' + btn.dataset.pplShipmentOrder + '/ppl-shipment', { method: 'POST' })
            .then((res) => {
              if (!res.ok) alert('Vytvoření zásilky PPL se nepovedlo: ' + (res.data && res.data.error || 'neznámá chyba'));
              loadOrders();
            })
            .catch(() => {
              alert('Vytvoření zásilky PPL se nepovedlo.');
              btn.textContent = 'Vytvořit zásilku PPL';
              btn.disabled = false;
            });
        });
      });

      tbody.querySelectorAll('button[data-delete-order]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (!confirm('Opravdu smazat tuhle objednávku? Nejde vrátit zpět.')) return;
          adminFetch('/api/admin/orders/' + btn.dataset.deleteOrder, { method: 'DELETE' }).then(() => { loadOrders(); });
        });
      });

      tbody.querySelectorAll('select[data-order-id]').forEach((select) => {
        select.addEventListener('change', () => {
          adminFetch('/api/admin/orders/' + select.dataset.orderId, { method: 'PATCH', body: { status: select.value } });
        });
      });
    })
    .catch(() => {});
}

export function initOrders() {
  const button = document.getElementById('export-orders-csv');
  button.addEventListener('click', () => {
    button.textContent = 'Připravuji…';
    fetchBlobUrl('/api/admin/orders-export.csv')
      .then((url) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = 'objednavky.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .finally(() => { button.textContent = 'Export do CSV'; });
  });
}
