// Vstupní bod administrace (assets/js/admin.js).
import { initAuth } from './auth.js';
import { initOrders, loadOrders } from './orders.js';
import { initProducts, loadProducts } from './products.js';
import { initDiscounts, loadDiscounts, loadShippingSettings } from './discounts.js';
import { loadReviews } from './reviews.js';

const TABS = ['orders', 'products', 'discounts', 'reviews'];

function initTabs() {
  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach((t) => { t.classList.remove('active'); });
      tab.classList.add('active');
      TABS.forEach((name) => {
        document.getElementById('tab-' + name).hidden = tab.dataset.tab !== name;
      });
      if (tab.dataset.tab === 'discounts') { loadDiscounts(); loadShippingSettings(); }
      if (tab.dataset.tab === 'reviews') loadReviews();
    });
  });
}

initTabs();
initOrders();
initProducts();
initDiscounts();
initAuth(() => {
  loadOrders();
  loadProducts();
});
