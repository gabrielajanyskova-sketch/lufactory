// Formulář "Dej mi vědět, až bude skladem" — cart/stock.js odkryje
// .stock-notify box podle aktuálního skladu, tady se jen zapojí odeslání.
// Volatelné znovu po vykreslení obsahu (pages/product.js).
import { API_BASE } from '../config.js';
import { postJson, honeypot } from '../util.js';

export function initStockNotifyForms() {
  document.querySelectorAll('.stock-notify-form').forEach((form) => {
    if (form.dataset.wired) return;
    form.dataset.wired = 'true';

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const box = form.closest('[data-stock-notify]');
      const productId = box && box.getAttribute('data-stock-notify');
      const emailInput = form.querySelector('input[type="email"]');
      if (!productId) return;

      const submitBtn = form.querySelector('button');
      submitBtn.disabled = true;

      postJson(API_BASE + '/api/stock-notify', { productId, email: emailInput.value.trim(), hp: honeypot(form) }).then((ok) => {
        if (ok) {
          form.hidden = true;
          box.querySelector('.stock-notify-success').hidden = false;
        } else {
          submitBtn.disabled = false;
        }
      });
    });
  });
}
