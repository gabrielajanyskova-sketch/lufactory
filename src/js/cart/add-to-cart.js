// Tlačítka "Přidat do košíku" a krokování množství u produktů.
import { getCart, saveCart } from './store.js';
import { availableStock } from './stock.js';
import { openCart } from './drawer.js';
import { showStockToast } from './toast.js';

function addToCart(id, name, price, qty) {
  qty = Math.max(1, parseInt(qty, 10) || 1);
  let cart = getCart();
  const item = cart.find((i) => i.id === id);
  let newQty = (item ? item.qty : 0) + qty;

  const available = availableStock(id);
  const capped = available != null && newQty > available;
  if (capped) newQty = available;

  if (newQty <= 0) {
    cart = cart.filter((i) => i.id !== id);
  } else if (item) {
    item.qty = newQty;
  } else {
    cart.push({ id, name, price, qty: newQty });
  }
  saveCart(cart);
  openCart();

  if (capped) {
    showStockToast('Množství jsme upravili na dostupný sklad — ' + name + '.');
  }
}

export function wireQtyStepper(stepper) {
  const input = stepper && stepper.querySelector('[data-qty-input]');
  if (!input) return;
  stepper.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      let val = parseInt(input.value, 10) || 1;
      const max = parseInt(input.getAttribute('max'), 10);
      if (btn.getAttribute('data-action') === 'inc') {
        val = max ? Math.min(max, val + 1) : val + 1;
      } else {
        val = Math.max(1, val - 1);
      }
      input.value = val;
    });
  });
}

export function wireAddToCartBtn(btn) {
  if (!btn) return;
  btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-id');
    const qtyInput = document.querySelector('[data-qty-for="' + id + '"] [data-qty-input]');
    const qty = qtyInput ? qtyInput.value : 1;
    addToCart(id, btn.getAttribute('data-name'), parseFloat(btn.getAttribute('data-price')), qty);
    if (qtyInput) qtyInput.value = 1;
  });
}

export function initAddToCart(root = document) {
  root.querySelectorAll('.qty-stepper').forEach(wireQtyStepper);
  root.querySelectorAll('[data-add-to-cart]').forEach(wireAddToCartBtn);
}
