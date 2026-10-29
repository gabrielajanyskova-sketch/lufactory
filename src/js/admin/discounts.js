// Záložka Slevové kódy — kódy a doprava zdarma.
import { API_BASE, adminFetch, adminJson } from './api.js';
import { escapeHtml } from '../util.js';

const $ = (id) => document.getElementById(id);

function setStatus(el, ok, text) {
  el.textContent = text;
  el.className = ok ? 'status-msg ok' : 'status-msg err';
}

export function loadDiscounts() {
  adminFetch('/api/admin/discounts')
    .then((r) => r.json())
    .then((data) => {
      const tbody = $('discounts-tbody');
      tbody.innerHTML = '';
      (data.codes || []).forEach((d) => {
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + escapeHtml(d.code) + '</td>' +
          '<td>' + (d.type === 'percent' ? 'Procenta' : 'Pevná částka') + '</td>' +
          '<td>' + d.value + (d.type === 'percent' ? ' %' : ' Kč') + '</td>' +
          '<td><input type="checkbox" data-field="active" ' + (d.active ? 'checked' : '') + '></td>' +
          '<td><button type="button" class="cart-remove" data-delete-discount title="Smazat kód">✕</button></td>';
        tbody.appendChild(tr);

        const path = '/api/admin/discounts/' + encodeURIComponent(d.code);
        tr.querySelector('input[data-field="active"]').addEventListener('change', (e) => {
          adminFetch(path, { method: 'PATCH', body: { active: e.target.checked } });
        });
        tr.querySelector('button[data-delete-discount]').addEventListener('click', () => {
          if (!confirm('Smazat tenhle slevový kód?')) return;
          adminFetch(path, { method: 'DELETE' }).then(() => { loadDiscounts(); });
        });
      });
    });
}

export function loadShippingSettings() {
  fetch(API_BASE + '/api/shipping-settings')
    .then((r) => r.json())
    .then((settings) => {
      $('free-shipping-active').checked = !!settings.active;
      $('free-shipping-threshold').value = settings.threshold || 0;
    });
}

export function initDiscounts() {
  $('add-discount-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = $('add-discount-msg');
    adminJson('/api/admin/discounts', {
      method: 'POST',
      body: {
        code: $('new-discount-code').value.trim(),
        type: $('new-discount-type').value,
        value: Number($('new-discount-value').value)
      }
    }).then((res) => {
      if (res.ok) {
        setStatus(msg, true, 'Kód přidán.');
        $('add-discount-form').reset();
        loadDiscounts();
      } else {
        setStatus(msg, false, 'Nepodařilo se přidat kód (' + (res.data.error || 'chyba') + ').');
      }
    });
  });

  $('save-shipping-settings').addEventListener('click', () => {
    adminFetch('/api/admin/shipping-settings', {
      method: 'PATCH',
      body: {
        active: $('free-shipping-active').checked,
        threshold: Number($('free-shipping-threshold').value) || 0
      }
    })
      .then((r) => r.ok)
      .catch(() => false)
      .then((ok) => {
        setStatus($('shipping-settings-msg'), ok, ok ? 'Uloženo.' : 'Uložení se nepovedlo, zkuste to prosím znovu.');
        if (ok) loadShippingSettings();
      });
  });
}
