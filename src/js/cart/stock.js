import { API_BASE } from '../config.js';
import { getCart, storeCart, notifyCartChange } from './store.js';
import { showStockToast } from './toast.js';

let lastStockMap = null;
const stockListeners = [];

// Volá se po každém načtení skladu (např. pro doplnění karet produktů z adminu).
export function onStockLoaded(fn) {
  stockListeners.push(fn);
}

export function availableStock(id) {
  if (!lastStockMap) return null;
  const entry = lastStockMap[id];
  return entry ? entry.stockQty : 0;
}

export function loadStock() {
  fetch(API_BASE + '/api/products')
    .then((r) => r.json())
    .then((stockMap) => {
      lastStockMap = stockMap;
      stockListeners.forEach((fn) => fn(stockMap));
      applyStock(stockMap);
      notifyCartChange();
    })
    .catch(() => {});
}

// Nastavuje se oběma směry — badge, tlačítka i formulář na upozornění se
// vždy přepočítají podle živých dat, i kdyby stránka měla v HTML natvrdo
// napsaný opačný stav (např. původně skladem, mezitím vyprodáno).
function applyStock(stockMap) {
  document.querySelectorAll('[data-stock-badge]').forEach((el) => {
    const id = el.getAttribute('data-stock-badge');
    const entry = stockMap[id];
    const qty = entry ? entry.stockQty : 0;
    const inStock = qty > 0;
    const addBtn = document.querySelector('[data-add-to-cart][data-id="' + id + '"]');
    const stepper = document.querySelector('[data-qty-for="' + id + '"]');
    const qtyInput = stepper ? stepper.querySelector('[data-qty-input]') : null;
    const notifyBox = document.querySelector('[data-stock-notify="' + id + '"]');

    el.textContent = inStock ? 'Skladem' : 'Není skladem';
    el.className = 'stock-badge ' + (inStock ? 'stock-badge--in' : 'stock-badge--out');
    if (addBtn) addBtn.disabled = !inStock;
    if (qtyInput) {
      qtyInput.disabled = !inStock;
      if (inStock) qtyInput.setAttribute('max', qty);
    }
    if (stepper) {
      stepper.querySelectorAll('[data-action]').forEach((btn) => {
        btn.disabled = !inStock;
      });
    }
    if (notifyBox) notifyBox.hidden = inStock;
    updateProductSchemaAvailability(id, inStock);
  });
}

// Statické stránky produktů mají schema.org Product/Offer natvrdo jako
// "InStock" — bez tohohle by Google mohl ukazovat "skladem" i u
// vyprodaného produktu, i když viditelný štítek už správně píše opak.
function updateProductSchemaAvailability(id, inStock) {
  const script = document.querySelector('script[data-product-schema="' + id + '"]');
  if (!script) return;
  try {
    const data = JSON.parse(script.textContent);
    if (data.offers) {
      data.offers.availability = inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
      script.textContent = JSON.stringify(data);
    }
  } catch (e) {
    // poškozené schema.org data by neměly shodit zbytek stránky
  }
}

// Košík si nic neblokuje na skladě (nic se "nerezervuje"), takže se
// množství vždy porovnává proti aktuálnímu stavu — pokud mezitím někdo
// koupí poslední kus (nebo si zákazník sám naklikal víc, než je skladem),
// množství se rovnou upraví dolů a zobrazí se, co přesně se změnilo.
export function reconcileCartWithStock() {
  if (!lastStockMap) return;
  const changes = [];
  const next = [];

  getCart().forEach((item) => {
    const available = availableStock(item.id);
    if (available == null || item.qty <= available) {
      next.push(item);
    } else if (available > 0) {
      changes.push(item.name + ' — snížené množství podle skladu');
      next.push(Object.assign({}, item, { qty: available }));
    } else {
      changes.push(item.name + ' — už není skladem');
    }
  });

  if (changes.length > 0) {
    storeCart(next);
    showStockToast('Stav skladu se změnil: ' + changes.join('; ') + '.');
  }
}
