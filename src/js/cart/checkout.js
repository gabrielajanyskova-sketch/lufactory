// Stránka /kosik.html — doprava, platba, slevový kód, fakturační údaje,
// výběr výdejního místa a odeslání objednávky přes worker (s mailto zálohou).
import { API_BASE, SHIPPING, PICKUP_POINT_SHIPPING, PACKETA_API_KEY, BANK_IBAN } from '../config.js';
import { formatPrice } from '../util.js';
import {
  getCart, cartSubtotal, discountAmount, discountEntry, getDiscountCode, setDiscountCode,
  rememberDiscount, clearCart, onCartChange
} from './store.js';
import { loadStock, reconcileCartWithStock } from './stock.js';
import { renderCart, renderCartItems } from './drawer.js';
import { showStockToast } from './toast.js';

let shippingSettings = { active: false, threshold: 0 };

// KM kód vybrané PPL výdejny (z widgetu) — posílá se s objednávkou, aby
// worker věděl, kam přesně má zásilku poslat.
let selectedPickupPointId = null;

function valueOf(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function selectedShippingKey() {
  const checked = document.querySelector('input[name="shipping"]:checked');
  return checked ? checked.value : 'pickup';
}

function selectedPaymentKey() {
  const checked = document.querySelector('input[name="payment"]:checked');
  return checked ? checked.value : 'transfer';
}

function loadShippingSettings() {
  fetch(API_BASE + '/api/shipping-settings')
    .then((r) => r.json())
    .then((settings) => {
      shippingSettings = settings;
      renderCartPage();
    })
    .catch(() => {});
}

function updateFreeShippingUi(subtotal, freeShippingApplies) {
  document.querySelectorAll('#shipping-options .option-card').forEach((card) => {
    const input = card.querySelector('input[name="shipping"]');
    const priceEl = card.querySelector('.option-price');
    const info = input && SHIPPING[input.value];
    if (!info || info.price === 0 || !priceEl) return;
    priceEl.textContent = freeShippingApplies ? 'Zdarma' : formatPrice(info.price);
  });

  const note = document.getElementById('free-shipping-note');
  if (!note) return;
  if (!shippingSettings.active || shippingSettings.threshold <= 0) {
    note.hidden = true;
  } else if (freeShippingApplies) {
    note.hidden = false;
    note.textContent = 'Máte nárok na dopravu zdarma!';
    note.className = 'free-shipping-note free-shipping-note--ok';
  } else {
    note.hidden = false;
    note.textContent = 'Ještě ' + formatPrice(shippingSettings.threshold - subtotal) + ' a doprava je zdarma.';
    note.className = 'free-shipping-note';
  }
}

function renderCartPage() {
  reconcileCartWithStock();
  const cart = getCart();
  const empty = document.getElementById('cart-page-empty');
  const content = document.getElementById('cart-page-content');

  if (cart.length === 0) {
    if (empty) empty.hidden = false;
    if (content) content.hidden = true;
    return;
  }
  if (empty) empty.hidden = true;
  if (content) content.hidden = false;

  const itemsEl = document.getElementById('cart-page-items');
  if (itemsEl) renderCartItems(itemsEl, cart);

  const subtotal = cartSubtotal(cart);
  const discount = discountAmount(subtotal);
  const shippingKey = selectedShippingKey();
  const shipping = SHIPPING[shippingKey] || SHIPPING.pickup;
  const freeShippingApplies = shippingSettings.active && shippingSettings.threshold > 0 && subtotal >= shippingSettings.threshold;
  const shippingPrice = freeShippingApplies ? 0 : shipping.price;
  const total = Math.max(0, subtotal - discount) + shippingPrice;
  updateFreeShippingUi(subtotal, freeShippingApplies);

  const discountInput = document.getElementById('discount-code');
  const discountMsg = document.getElementById('discount-message');
  const code = getDiscountCode();
  if (discountInput && !discountInput.value) discountInput.value = code;
  if (discountMsg) {
    if (code && discountEntry(code)) {
      discountMsg.hidden = false;
      discountMsg.textContent = 'Kód ' + code + ' uplatněn.';
      discountMsg.className = 'discount-message discount-message--ok';
    } else if (code) {
      discountMsg.hidden = false;
      discountMsg.textContent = 'Kód „' + code + '" neplatí.';
      discountMsg.className = 'discount-message discount-message--error';
    } else {
      discountMsg.hidden = true;
    }
  }

  setText('summary-subtotal', formatPrice(subtotal));
  const discountRow = document.getElementById('summary-discount-row');
  if (discountRow) discountRow.hidden = discount === 0;
  setText('summary-discount', '−' + formatPrice(discount));
  setText('summary-shipping', shippingPrice === 0 ? 'Zdarma' : formatPrice(shippingPrice));
  setText('summary-total', formatPrice(total));

  // Hotově při odběru dává smysl jen u osobního odběru.
  const cashOption = document.getElementById('payment-cash-option');
  if (cashOption) {
    const cashRadio = cashOption.querySelector('input[name="payment"]');
    if (shippingKey !== 'pickup') {
      cashOption.hidden = true;
      if (cashRadio && cashRadio.checked) {
        const transferRadio = document.querySelector('input[name="payment"][value="transfer"]');
        if (transferRadio) transferRadio.checked = true;
      }
    } else {
      cashOption.hidden = false;
    }
  }

  const addressFields = document.getElementById('address-fields');
  if (addressFields) {
    addressFields.hidden = !PICKUP_POINT_SHIPPING[shippingKey];
    if (PICKUP_POINT_SHIPPING[shippingKey]) {
      const selectedRadio = document.querySelector('input[name="shipping"][value="' + shippingKey + '"]');
      const optionCard = selectedRadio && selectedRadio.closest('.option-card');
      if (optionCard) optionCard.insertAdjacentElement('afterend', addressFields);
    }
  }

  const pickBranchBtn = document.getElementById('pick-branch-btn');
  if (pickBranchBtn) pickBranchBtn.hidden = !PICKUP_POINT_SHIPPING[shippingKey];
}

// Fakturační údaje — sdíleno mezi mailto zálohou a API.
function billingDetails() {
  return {
    name: (valueOf('c-first-name') + ' ' + valueOf('c-last-name')).trim(),
    street: valueOf('c-street'),
    zip: valueOf('c-zip'),
    city: valueOf('c-city'),
    email: valueOf('c-email'),
    phone: valueOf('c-phone')
  };
}

function buildOrderMailto() {
  const cart = getCart();
  const subtotal = cartSubtotal(cart);
  const discount = discountAmount(subtotal);
  const shippingKey = selectedShippingKey();
  const shipping = SHIPPING[shippingKey] || SHIPPING.pickup;
  const paymentLabel = selectedPaymentKey() === 'cash' ? 'Hotově při osobním odběru' : 'Bankovním převodem';
  const total = Math.max(0, subtotal - discount) + shipping.price;

  const customer = billingDetails();
  const address = valueOf('c-address');
  const note = valueOf('c-note');

  const lines = cart.map((i) => '- ' + i.name + ' — ' + i.qty + ' ks × ' + formatPrice(i.price));
  lines.push('');
  lines.push('Mezisoučet: ' + formatPrice(subtotal));
  if (discount > 0) lines.push('Sleva (' + getDiscountCode() + '): −' + formatPrice(discount));
  lines.push('Doprava (' + shipping.label + '): ' + (shipping.price === 0 ? 'zdarma' : formatPrice(shipping.price)));
  lines.push('Celkem: ' + formatPrice(total));
  lines.push('');
  lines.push('Platba: ' + paymentLabel);
  lines.push('');
  lines.push('Jméno: ' + customer.name);
  lines.push('Adresa: ' + customer.street + ', ' + customer.zip + ' ' + customer.city);
  lines.push('E-mail: ' + customer.email);
  if (customer.phone) lines.push('Telefon: ' + customer.phone);
  if (PICKUP_POINT_SHIPPING[shippingKey] && address) lines.push('Výdejní místo: ' + address);
  if (note) lines.push('Poznámka: ' + note);

  return 'mailto:info@lufactory.cz'
    + '?subject=' + encodeURIComponent('Objednávka z webu')
    + '&body=' + encodeURIComponent(lines.join('\n'));
}

function submitOrderViaApi() {
  const payload = {
    items: getCart().map((i) => ({ productId: i.id, qty: i.qty })),
    discountCode: getDiscountCode() || undefined,
    delivery: { method: selectedShippingKey(), detail: valueOf('c-address'), pickupPointId: selectedPickupPointId || undefined },
    payment: { method: selectedPaymentKey() },
    customer: billingDetails(),
    note: valueOf('c-note')
  };
  return fetch(API_BASE + '/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
    .then((res) => {
      if (res.ok) clearCart();
      return res;
    })
    .catch(() => ({ ok: false, data: null }));
}

// SPD (Short Payment Descriptor) — český standard pro QR platby, podporovaný
// všemi tuzemskými bankovními aplikacemi. Naskenováním se vyplní částka,
// účet i variabilní symbol, klient nic neopisuje ručně. Knihovna qrcode se
// načítá jen na /kosik.html (assets/js/qrcode.js).
function buildPaymentQrSvg(amount, variableSymbol) {
  const spd = 'SPD*1.0*ACC:' + BANK_IBAN + '*AM:' + amount.toFixed(2) + '*CC:CZK*X-VS:' + variableSymbol + '*MSG:Lufactory';
  const qr = window.qrcode(0, 'M');
  qr.addData(spd);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, alt: 'QR platba' });
}

function showOrderSuccess(result) {
  const content = document.getElementById('cart-page-content');
  if (!content) return;
  renderCart();

  let qrBlock = '';
  if (result.paymentMethod === 'transfer' && typeof window.qrcode === 'function') {
    qrBlock =
      '<div class="qr-payment">' +
        '<p class="qr-payment-title">Zaplatit rovnou QR platbou</p>' +
        buildPaymentQrSvg(result.total, result.variableSymbol) +
        '<p class="qr-payment-note">Naskenujte v mobilní bankovní aplikaci — částka i variabilní symbol (' + result.variableSymbol + ') se vyplní automaticky.</p>' +
      '</div>';
  }

  content.innerHTML =
    '<div class="section-head">' +
      '<span class="eyebrow">Děkujeme</span>' +
      '<h2>Objednávka odeslána</h2>' +
      '<p>Číslo objednávky <strong>' + result.orderNumber + '</strong>. Potvrzení jsme poslali na váš e-mail, brzy se ozveme s dalšími informacemi.</p>' +
      qrBlock +
      '<a href="/produkty.html" class="btn">Zpět na produkty</a>' +
    '</div>';
}

function wireDiscountForm() {
  const discountForm = document.getElementById('discount-form');
  if (!discountForm) return;
  discountForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = valueOf('discount-code').toUpperCase();
    if (!code) {
      setDiscountCode(code);
      return;
    }
    fetch(API_BASE + '/api/discount/' + encodeURIComponent(code))
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) rememberDiscount(code, { type: data.type, value: data.value });
        setDiscountCode(code);
      })
      .catch(() => { setDiscountCode(code); });
  });
}

function wirePickupPoints() {
  const addressInput = document.getElementById('c-address');

  function openPickupPicker(shippingKey) {
    if (shippingKey === 'ppl-pickup') {
      const pplWidget = document.getElementById('ppl-widget');
      if (pplWidget && typeof pplWidget.open === 'function') pplWidget.open();
      return;
    }
    if (shippingKey === 'zasilkovna-pickup' && typeof window.Packeta !== 'undefined') {
      window.Packeta.Widget.pick(PACKETA_API_KEY, (point) => {
        if (!point) return;
        if (addressInput) addressInput.value = point.name + ', ' + point.street + ', ' + point.city;
      }, { country: 'cz', language: 'cs' });
    }
  }

  document.querySelectorAll('input[name="shipping"], input[name="payment"]').forEach((input) => {
    input.addEventListener('change', () => {
      selectedPickupPointId = null;
      renderCartPage();
      // Rovnou otevřít výběr pobočky, ať zákazník nemusí hledat samostatné
      // tlačítko — jen při prvním výběru dopravy, ne při každé změně.
      if (input.name === 'shipping' && PICKUP_POINT_SHIPPING[input.value]) {
        openPickupPicker(input.value);
      }
    });
  });

  if (addressInput) {
    addressInput.addEventListener('input', () => { selectedPickupPointId = null; });
  }

  const pickBranchBtn = document.getElementById('pick-branch-btn');
  if (pickBranchBtn) {
    pickBranchBtn.addEventListener('click', () => {
      openPickupPicker(selectedShippingKey());
    });
  }

  const pplWidgetEl = document.getElementById('ppl-widget');
  if (pplWidgetEl) {
    pplWidgetEl.addEventListener('ppl-accesspointwidget-select', (e) => {
      const ap = e.detail;
      if (!ap) return;
      selectedPickupPointId = ap.code;
      if (addressInput) {
        const parts = [ap.name];
        if (ap.address && ap.address.street) parts.push(ap.address.street);
        if (ap.address && ap.address.city) parts.push(ap.address.city);
        addressInput.value = parts.join(', ');
      }
    });
    // Widget sám hlásí chybu (např. doména v klíči nesedí) — ať se
    // nerozbije potichu, alespoň do konzole, dokud se neudělá hezčí UI.
    pplWidgetEl.addEventListener('ppl-accesspointwidget-error', (e) => {
      console.error('PPL widget error:', e.detail && e.detail.code, e.detail && e.detail.message);
    });
  }
}

function wireSubmit() {
  const submitOrderBtn = document.getElementById('submit-order');
  if (!submitOrderBtn) return;
  submitOrderBtn.addEventListener('click', () => {
    const form = document.getElementById('checkout-form');
    if (form && !form.reportValidity()) return;

    submitOrderBtn.disabled = true;
    submitOrderBtn.textContent = 'Odesílám…';
    submitOrderViaApi()
      .then((res) => {
        if (res.ok) {
          showOrderSuccess(res.data);
        } else if (res.data && res.data.error === 'insufficient_stock') {
          // Mezitím někdo koupil poslední kus — neposílat přes mailto
          // (to by vypadalo jako objednávka, co ve skutečnosti nejde
          // splnit), místo toho jasně říct, co se změnilo, a dotáhnout
          // čerstvý stav skladu (loadStock → reconcileCartWithStock
          // množství rovnou opraví).
          const changedItem = getCart().find((i) => i.id === res.data.productId);
          const changedName = changedItem ? changedItem.name : 'položka v košíku';
          showStockToast('Mezitím došlo zboží — ' + changedName + '. Množství jsme upravili podle skladu.');
          loadStock();
        } else {
          window.location.href = buildOrderMailto();
        }
      })
      .then(() => {
        submitOrderBtn.disabled = false;
        submitOrderBtn.textContent = 'Odeslat objednávku';
      });
  });
}

export function initCheckout() {
  if (!document.getElementById('cart-page')) return;
  onCartChange(renderCartPage);
  renderCartPage();
  loadShippingSettings();
  wireDiscountForm();
  wirePickupPoints();
  wireSubmit();
}
