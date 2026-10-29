// Obsah košíku a slevový kód v localStorage. Zboží v košíku není nijak
// rezervované — viz cart/stock.js.
const STORAGE_KEY = 'lufactory_cart';
const DISCOUNT_KEY = 'lufactory_discount';

const listeners = [];

// Košík (záhlaví) i stránka /kosik se překreslí po každé změně.
export function onCartChange(fn) {
  listeners.push(fn);
}

export function notifyCartChange() {
  listeners.forEach((fn) => fn());
}

export function getCart() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

// Uloží bez překreslení — pro úpravy uvnitř samotného vykreslování.
export function storeCart(cart) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

export function saveCart(cart) {
  storeCart(cart);
  notifyCartChange();
}

export function clearCart() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(DISCOUNT_KEY);
}

export function removeFromCart(id) {
  saveCart(getCart().filter((i) => i.id !== id));
}

export function setQty(id, qty) {
  const cart = getCart();
  const item = cart.find((i) => i.id === id);
  if (!item) return;
  if (qty < 1) {
    removeFromCart(id);
    return;
  }
  item.qty = qty;
  saveCart(cart);
}

export function cartCount(cart) {
  return cart.reduce((sum, i) => sum + i.qty, 0);
}

export function cartSubtotal(cart) {
  return cart.reduce((sum, i) => sum + i.qty * i.price, 0);
}

// ---------- slevové kódy ----------

// Kódy ověřené přes API v této návštěvě (viz cart/checkout.js).
const remoteDiscounts = {};

export function rememberDiscount(code, entry) {
  remoteDiscounts[code] = entry;
}

export function getDiscountCode() {
  return (localStorage.getItem(DISCOUNT_KEY) || '').toUpperCase();
}

export function setDiscountCode(code) {
  if (code) {
    localStorage.setItem(DISCOUNT_KEY, code.toUpperCase());
  } else {
    localStorage.removeItem(DISCOUNT_KEY);
  }
  notifyCartChange();
}

export function discountEntry(code) {
  return remoteDiscounts[code];
}

// type "percent": value je procento z mezisoučtu. type "fixed": value je sleva v Kč.
export function discountAmount(subtotal) {
  const entry = discountEntry(getDiscountCode());
  if (!entry) return 0;
  if (entry.type === 'percent') return Math.round(subtotal * entry.value / 100);
  return Math.min(entry.value, subtotal);
}
