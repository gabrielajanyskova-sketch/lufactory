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

export function openCart() {
  document.body.classList.add('cart-open');
}

export function closeCart() {
  document.body.classList.remove('cart-open');
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
