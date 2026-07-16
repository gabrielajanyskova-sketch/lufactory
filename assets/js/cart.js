(function () {
  var STORAGE_KEY = 'lufactory_cart';
  var DISCOUNT_KEY = 'lufactory_discount';

  // Vyplň adresou nasazeného workeru (worker/README.md), např.
  // 'https://lufactory-api.<tvuj-subdomain>.workers.dev' — dokud je prázdné,
  // web dál funguje na mailto přesně jako dosud.
  var API_BASE = '';

  // Musí zůstat stejné jako SHIPPING ve worker/src/index.js — worker cenu dopravy
  // znovu ověřuje server-side, tohle je jen zobrazovací kopie pro klienta.
  var SHIPPING = {
    pickup: { label: 'Osobní odběr (Nová Ves u Prahy / Praha 8, Čimice)', price: 0 },
    zasilkovna: { label: 'Zásilkovna', price: 79 }
  };

  // Slevové kódy — přidávej/uprav podle potřeby. Když je API_BASE vyplněné,
  // kódy z D1 databáze mají přednost, tohle slouží jako fallback bez workeru.
  // type "percent": value je procento z mezisoučtu. type "fixed": value je sleva v Kč.
  var DISCOUNT_CODES = {
    LETO10: { type: 'percent', value: 10 }
  };

  // Kódy ověřené přes API v této návštěvě (viz wireDiscountForm).
  var remoteDiscounts = {};

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    renderCart();
    renderCartPage();
  }

  function addToCart(id, name, price, qty) {
    qty = Math.max(1, parseInt(qty, 10) || 1);
    var cart = getCart();
    var item = cart.find(function (i) { return i.id === id; });
    if (item) {
      item.qty += qty;
    } else {
      cart.push({ id: id, name: name, price: price, qty: qty });
    }
    saveCart(cart);
    openCart();
  }

  function removeFromCart(id) {
    saveCart(getCart().filter(function (i) { return i.id !== id; }));
  }

  function setQty(id, qty) {
    var cart = getCart();
    var item = cart.find(function (i) { return i.id === id; });
    if (!item) return;
    if (qty < 1) {
      removeFromCart(id);
      return;
    }
    item.qty = qty;
    saveCart(cart);
  }

  function cartCount(cart) {
    return cart.reduce(function (sum, i) { return sum + i.qty; }, 0);
  }

  function cartSubtotal(cart) {
    return cart.reduce(function (sum, i) { return sum + i.qty * i.price; }, 0);
  }

  function formatPrice(n) {
    return n.toLocaleString('cs-CZ') + ' Kč';
  }

  function getDiscountCode() {
    return (localStorage.getItem(DISCOUNT_KEY) || '').toUpperCase();
  }

  function setDiscountCode(code) {
    if (code) {
      localStorage.setItem(DISCOUNT_KEY, code.toUpperCase());
    } else {
      localStorage.removeItem(DISCOUNT_KEY);
    }
    renderCartPage();
  }

  function discountEntry(code) {
    return remoteDiscounts[code] || DISCOUNT_CODES[code];
  }

  function discountAmount(subtotal) {
    var entry = discountEntry(getDiscountCode());
    if (!entry) return 0;
    if (entry.type === 'percent') return Math.round(subtotal * entry.value / 100);
    return Math.min(entry.value, subtotal);
  }

  // ---------- stock ----------
  // Dokud API nepotvrdí skutečný počet kusů, zůstává vše "Není skladem"
  // (viz disabled tlačítka a text rovnou v HTML) — bezpečný výchozí stav.
  function applyStock(stockMap) {
    if (!stockMap) return;
    document.querySelectorAll('[data-stock-badge]').forEach(function (el) {
      var id = el.getAttribute('data-stock-badge');
      var entry = stockMap[id];
      var qty = entry ? entry.stockQty : 0;
      var addBtn = document.querySelector('[data-add-to-cart][data-id="' + id + '"]');
      var qtyInput = document.querySelector('[data-qty-for="' + id + '"] [data-qty-input]');
      if (qty > 0) {
        el.textContent = 'Skladem: ' + qty + ' ks';
        el.className = 'stock-badge stock-badge--in';
        if (addBtn) addBtn.disabled = false;
        if (qtyInput) {
          qtyInput.disabled = false;
          qtyInput.setAttribute('max', qty);
        }
      }
    });
  }

  function loadStock() {
    if (!API_BASE) return;
    fetch(API_BASE + '/api/products')
      .then(function (r) { return r.json(); })
      .then(applyStock)
      .catch(function () {});
  }

  function wireQtySteppers() {
    document.querySelectorAll('.qty-stepper').forEach(function (stepper) {
      var input = stepper.querySelector('[data-qty-input]');
      if (!input) return;
      stepper.querySelectorAll('[data-action]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var val = parseInt(input.value, 10) || 1;
          var max = parseInt(input.getAttribute('max'), 10);
          if (btn.getAttribute('data-action') === 'inc') {
            val = max ? Math.min(max, val + 1) : val + 1;
          } else {
            val = Math.max(1, val - 1);
          }
          input.value = val;
        });
      });
    });
  }

  // Shared by the header cart drawer and the full /kosik.html item list —
  // builds one <li class="cart-item"> with its qty +/− and remove handlers.
  function buildCartItemEl(item) {
    var li = document.createElement('li');
    li.className = 'cart-item';
    li.innerHTML =
      '<div class="cart-item-info">' +
        '<span class="cart-item-name">' + item.name + '</span>' +
        '<span class="cart-item-price">' + formatPrice(item.price) + ' / ks</span>' +
      '</div>' +
      '<div class="cart-item-controls">' +
        '<button type="button" class="qty-btn" data-action="dec" aria-label="Ubrat kus">−</button>' +
        '<span class="qty-value">' + item.qty + '</span>' +
        '<button type="button" class="qty-btn" data-action="inc" aria-label="Přidat kus">+</button>' +
        '<button type="button" class="cart-remove" aria-label="Odebrat z košíku">×</button>' +
      '</div>';
    li.querySelector('[data-action="dec"]').addEventListener('click', function () {
      setQty(item.id, item.qty - 1);
    });
    li.querySelector('[data-action="inc"]').addEventListener('click', function () {
      setQty(item.id, item.qty + 1);
    });
    li.querySelector('.cart-remove').addEventListener('click', function () {
      removeFromCart(item.id);
    });
    return li;
  }

  function renderCartItems(listEl, cart) {
    listEl.innerHTML = '';
    cart.forEach(function (item) {
      listEl.appendChild(buildCartItemEl(item));
    });
  }

  // ---------- cart drawer (header flyout) ----------
  function renderCart() {
    var cart = getCart();

    var countEl = document.querySelector('.cart-count');
    if (countEl) {
      var count = cartCount(cart);
      countEl.textContent = count;
      countEl.hidden = count === 0;
    }

    var itemsEl = document.querySelector('.cart-items');
    if (!itemsEl) return;
    var emptyEl = document.querySelector('.cart-empty');
    var footerEl = document.querySelector('.cart-footer');
    var totalEl = document.querySelector('.cart-total-value');

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

  function openCart() {
    document.body.classList.add('cart-open');
  }

  function closeCart() {
    document.body.classList.remove('cart-open');
  }

  // ---------- full cart page (/kosik.html) ----------
  function selectedShippingKey() {
    var checked = document.querySelector('input[name="shipping"]:checked');
    return checked ? checked.value : 'pickup';
  }

  function selectedPaymentKey() {
    var checked = document.querySelector('input[name="payment"]:checked');
    return checked ? checked.value : 'transfer';
  }

  function renderCartPage() {
    var pageRoot = document.getElementById('cart-page');
    if (!pageRoot) return;

    var cart = getCart();
    var empty = document.getElementById('cart-page-empty');
    var content = document.getElementById('cart-page-content');

    if (cart.length === 0) {
      if (empty) empty.hidden = false;
      if (content) content.hidden = true;
      return;
    }
    if (empty) empty.hidden = true;
    if (content) content.hidden = false;

    var itemsEl = document.getElementById('cart-page-items');
    if (itemsEl) renderCartItems(itemsEl, cart);

    var subtotal = cartSubtotal(cart);
    var discount = discountAmount(subtotal);
    var shippingKey = selectedShippingKey();
    var shipping = SHIPPING[shippingKey] || SHIPPING.pickup;
    var total = Math.max(0, subtotal - discount) + shipping.price;

    var discountInput = document.getElementById('discount-code');
    var discountMsg = document.getElementById('discount-message');
    var code = getDiscountCode();
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
    var discountRow = document.getElementById('summary-discount-row');
    if (discountRow) discountRow.hidden = discount === 0;
    setText('summary-discount', '−' + formatPrice(discount));
    setText('summary-shipping', shipping.price === 0 ? 'Zdarma' : formatPrice(shipping.price));
    setText('summary-total', formatPrice(total));

    // Hotově při odběru dává smysl jen u osobního odběru.
    var cashOption = document.getElementById('payment-cash-option');
    if (cashOption) {
      var cashRadio = cashOption.querySelector('input[name="payment"]');
      if (shippingKey === 'zasilkovna') {
        cashOption.hidden = true;
        if (cashRadio && cashRadio.checked) {
          var transferRadio = document.querySelector('input[name="payment"][value="transfer"]');
          if (transferRadio) transferRadio.checked = true;
        }
      } else {
        cashOption.hidden = false;
      }
    }

    var addressFields = document.getElementById('address-fields');
    if (addressFields) addressFields.hidden = shippingKey !== 'zasilkovna';
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function buildOrderMailto() {
    var cart = getCart();
    var subtotal = cartSubtotal(cart);
    var discount = discountAmount(subtotal);
    var shippingKey = selectedShippingKey();
    var shipping = SHIPPING[shippingKey] || SHIPPING.pickup;
    var paymentKey = selectedPaymentKey();
    var paymentLabel = paymentKey === 'cash' ? 'Hotově při osobním odběru' : 'Bankovním převodem';
    var total = Math.max(0, subtotal - discount) + shipping.price;

    var customer = billingDetails();
    var address = valueOf('c-address');
    var note = valueOf('c-note');

    var lines = cart.map(function (i) {
      return '- ' + i.name + ' — ' + i.qty + ' ks × ' + formatPrice(i.price);
    });
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
    if (shippingKey === 'zasilkovna' && address) lines.push('Výdejní místo Zásilkovny: ' + address);
    if (note) lines.push('Poznámka: ' + note);

    return 'mailto:info@lufactory.cz'
      + '?subject=' + encodeURIComponent('Objednávka z webu')
      + '&body=' + encodeURIComponent(lines.join('\n'));
  }

  function valueOf(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  // Fakturační údaje z /kosik.html — sdíleno mezi mailto fallbackem a API.
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

  document.addEventListener('DOMContentLoaded', function () {
    renderCart();
    renderCartPage();
    wireQtySteppers();
    loadStock();

    document.querySelectorAll('[data-add-to-cart]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var qtyInput = document.querySelector('[data-qty-for="' + id + '"] [data-qty-input]');
        var qty = qtyInput ? qtyInput.value : 1;
        addToCart(id, btn.getAttribute('data-name'), parseFloat(btn.getAttribute('data-price')), qty);
        if (qtyInput) qtyInput.value = 1;
      });
    });

    var cartToggle = document.querySelector('.cart-toggle');
    if (cartToggle) cartToggle.addEventListener('click', openCart);

    var cartClose = document.querySelector('.cart-close');
    if (cartClose) cartClose.addEventListener('click', closeCart);

    var overlay = document.querySelector('.cart-overlay');
    if (overlay) overlay.addEventListener('click', closeCart);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeCart();
    });

    // ---------- /kosik.html only ----------
    var discountForm = document.getElementById('discount-form');
    if (discountForm) {
      discountForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var code = valueOf('discount-code').toUpperCase();
        if (!code || !API_BASE) {
          setDiscountCode(code);
          return;
        }
        fetch(API_BASE + '/api/discount/' + encodeURIComponent(code))
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.valid) remoteDiscounts[code] = { type: data.type, value: data.value };
            setDiscountCode(code);
          })
          .catch(function () { setDiscountCode(code); });
      });
    }

    document.querySelectorAll('input[name="shipping"], input[name="payment"]').forEach(function (input) {
      input.addEventListener('change', renderCartPage);
    });

    var submitOrderBtn = document.getElementById('submit-order');
    if (submitOrderBtn) {
      submitOrderBtn.addEventListener('click', function () {
        var form = document.getElementById('checkout-form');
        if (form && !form.reportValidity()) return;

        if (!API_BASE) {
          window.location.href = buildOrderMailto();
          return;
        }

        submitOrderBtn.disabled = true;
        submitOrderBtn.textContent = 'Odesílám…';
        submitOrderViaApi()
          .then(function (result) {
            if (result) {
              showOrderSuccess(result);
            } else {
              window.location.href = buildOrderMailto();
            }
          })
          .then(function () {
            submitOrderBtn.disabled = false;
            submitOrderBtn.textContent = 'Odeslat objednávku';
          });
      });
    }
  });

  function submitOrderViaApi() {
    var cart = getCart();
    var payload = {
      items: cart.map(function (i) { return { productId: i.id, qty: i.qty }; }),
      discountCode: getDiscountCode() || undefined,
      delivery: { method: selectedShippingKey(), detail: valueOf('c-address') },
      payment: { method: selectedPaymentKey() },
      customer: billingDetails(),
      note: valueOf('c-note')
    };
    return fetch(API_BASE + '/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        if (!r.ok) throw new Error('order_failed');
        return r.json();
      })
      .then(function (data) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(DISCOUNT_KEY);
        return data;
      })
      .catch(function () { return null; });
  }

  function showOrderSuccess(result) {
    var content = document.getElementById('cart-page-content');
    if (!content) return;
    renderCart();
    content.innerHTML =
      '<div class="section-head">' +
        '<span class="eyebrow">Děkujeme</span>' +
        '<h2>Objednávka odeslána</h2>' +
        '<p>Číslo objednávky <strong>' + result.orderNumber + '</strong>. Potvrzení jsme poslali na váš e-mail, brzy se ozveme s dalšími informacemi.</p>' +
        '<a href="/produkty.html" class="btn">Zpět na produkty</a>' +
      '</div>';
  }
})();
