// Výsuvný košík v záhlaví a sdílené vykreslení položek (i pro /kosik.html).
import { escapeHtml, formatPrice } from '../util.js';
import { getCart, setQty, removeFromCart, cartCount, cartSubtotal, onCartChange } from './store.js';
import { availableStock, reconcileCartWithStock } from './stock.js';
import { showStockToast } from './toast.js';

// Jeden <li class="cart-item"> s ovládáním množství a odebráním.
function buildCartItemEl(item) {
  const li = document.createElement('li');
  li.className = 'cart-item';
  li.innerHTML =
    '<div class="cart-item-info">' +
      '<span class="cart-item-name">' + escapeHtml(item.name) + '</span>' +
      '<span class="cart-item-price">' + formatPrice(item.price) + ' / ks</span>' +
    '</div>' +
    '<div class="cart-item-controls">' +
      '<button type="button" class="qty-btn" data-action="dec" aria-label="Ubrat kus">−</button>' +
      '<span class="qty-value">' + item.qty + '</span>' +
      '<button type="button" class="qty-btn" data-action="inc" aria-label="Přidat kus">+</button>' +
      '<button type="button" class="cart-remove" aria-label="Odebrat z košíku">×</button>' +
    '</div>';
  li.querySelector('[data-action="dec"]').addEventListener('click', () => {
    setQty(item.id, item.qty - 1);
  });
  li.querySelector('[data-action="inc"]').addEventListener('click', () => {
    const available = availableStock(item.id);
    if (available != null && item.qty + 1 > available) {
      showStockToast('Víc už jich v košíku být nemůže — ' + item.name + '.');
      return;
    }
    setQty(item.id, item.qty + 1);
  });
  li.querySelector('.cart-remove').addEventListener('click', () => {
    removeFromCart(item.id);
  });
  return li;
}

export function renderCartItems(listEl, cart) {
  listEl.innerHTML = '';
  cart.forEach((item) => {
    listEl.appendChild(buildCartItemEl(item));
  });
}

export function renderCart() {
  reconcileCartWithStock();
  const cart = getCart();

  const countEl = document.querySelector('.cart-count');
  if (countEl) {
    const count = cartCount(cart);
    countEl.textContent = count;
    countEl.hidden = count === 0;
  }

  const itemsEl = document.querySelector('.cart-items');
  if (!itemsEl) return;
  const emptyEl = document.querySelector('.cart-empty');
  const footerEl = document.querySelector('.cart-footer');
  const totalEl = document.querySelector('.cart-total-value');

  if (cart.length === 0) {
    itemsEl.innerHTML = '';
    if (emptyEl) emptyEl.hidden = false;
    if (footerEl) footerEl.hidden = true;
    return;
  }

  if (emptyEl) emptyEl.hidden = true;
  if (footerEl) footerEl.hidden = false;
  renderCartItems(itemsEl, cart);

  if (totalEl) totalEl.textContent = formatPrice(cartSubtotal(cart));
}

// Zbytek stránky je při otevřeném košíku neaktivní (inert), aby fokus
// klávesnicí zůstal uvnitř panelu; po zavření se vrátí, kde byl.
let returnFocusTo = null;

export function setBackgroundInert(inert) {
  document.querySelectorAll('body > header, body > main, body > footer, body > .skip-link').forEach((el) => {
    el.inert = inert;
  });
}

export function openCart() {
  const panel = document.getElementById('cart-panel');
  if (!panel || document.body.classList.contains('cart-open')) return;
  returnFocusTo = document.activeElement;
  document.body.classList.add('cart-open');
  panel.inert = false;
  setBackgroundInert(true);
  const toggle = document.querySelector('.cart-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'true');
  const closeBtn = panel.querySelector('.cart-close');
  if (closeBtn) closeBtn.focus({ preventScroll: true });
}

export function closeCart() {
  const panel = document.getElementById('cart-panel');
  if (!panel || !document.body.classList.contains('cart-open')) return;
  document.body.classList.remove('cart-open');
  panel.inert = true;
  setBackgroundInert(false);
  const toggle = document.querySelector('.cart-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
  if (returnFocusTo && document.contains(returnFocusTo)) returnFocusTo.focus({ preventScroll: true });
  returnFocusTo = null;
}

export function initDrawer() {
  onCartChange(renderCart);
  renderCart();

  const cartToggle = document.querySelector('.cart-toggle');
  if (cartToggle) cartToggle.addEventListener('click', openCart);

  const cartClose = document.querySelector('.cart-close');
  if (cartClose) cartClose.addEventListener('click', closeCart);

  const overlay = document.querySelector('.cart-overlay');
  if (overlay) overlay.addEventListener('click', closeCart);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCart();
  });
}
