(function () {
  var STORAGE_KEY = 'lufactory_cart';
  var DISCOUNT_KEY = 'lufactory_discount';

  var SHIPPING = {
    pickup: { label: 'Osobní odběr (Nová Ves u Prahy / Praha 8, Čimice)', price: 0 },
    zasilkovna: { label: 'Zásilkovna', price: 79 }
  };

  // Slevové kódy — přidávej/uprav podle potřeby.
  // type "percent": value je procento z mezisoučtu. type "fixed": value je sleva v Kč.
  var DISCOUNT_CODES = {
    LETO10: { type: 'percent', value: 10 }
  };

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

  function addToCart(id, name, price) {
    var cart = getCart();
    var item = cart.find(function (i) { return i.id === id; });
    if (item) {
      item.qty += 1;
    } else {
      cart.push({ id: id, name: name, price: price, qty: 1 });
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

  function discountAmount(subtotal) {
    var entry = DISCOUNT_CODES[getDiscountCode()];
    if (!entry) return 0;
    if (entry.type === 'percent') return Math.round(subtotal * entry.value / 100);
    return Math.min(entry.value, subtotal);
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

    itemsEl.innerHTML = '';

    if (cart.length === 0) {
      if (emptyEl) emptyEl.hidden = false;
      if (footerEl) footerEl.hidden = true;
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (footerEl) footerEl.hidden = false;

    cart.forEach(function (item) {
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
      itemsEl.appendChild(li);
    });

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
    if (itemsEl) {
      itemsEl.innerHTML = '';
      cart.forEach(function (item) {
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
        itemsEl.appendChild(li);
      });
    }

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
      if (code && DISCOUNT_CODES[code]) {
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

    var name = valueOf('c-name');
    var email = valueOf('c-email');
    var phone = valueOf('c-phone');
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
    lines.push('Jméno: ' + name);
    lines.push('E-mail: ' + email);
    if (phone) lines.push('Telefon: ' + phone);
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

  document.addEventListener('DOMContentLoaded', function () {
    renderCart();
    renderCartPage();

    document.querySelectorAll('[data-add-to-cart]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        addToCart(
          btn.getAttribute('data-id'),
          btn.getAttribute('data-name'),
          parseFloat(btn.getAttribute('data-price'))
        );
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
        setDiscountCode(valueOf('discount-code'));
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
        window.location.href = buildOrderMailto();
      });
    }
  });
})();
