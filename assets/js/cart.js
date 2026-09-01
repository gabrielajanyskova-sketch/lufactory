(function () {
  var STORAGE_KEY = 'lufactory_cart';
  var DISCOUNT_KEY = 'lufactory_discount';

  // Výrazná bublina nahoře na obrazovce pro změny skladu — na rozdíl od
  // tichého textu v souhrnu objednávky si jí zákazník všimne, ať je na
  // stránce kdekoliv.
  var stockToastTimer = null;
  function showStockToast(message) {
    var toast = document.getElementById('stock-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'stock-toast';
      toast.className = 'stock-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(stockToastTimer);
    stockToastTimer = setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 6000);
  }

  // Vyplň adresou nasazeného workeru (worker/README.md), např.
  // 'https://lufactory-api.<tvuj-subdomain>.workers.dev' — dokud je prázdné,
  // web dál funguje na mailto přesně jako dosud.
  var API_BASE = 'https://lufactory-api.gabriela-janyskova.workers.dev';

  // Musí zůstat stejné jako SHIPPING ve worker/src/index.js — worker cenu dopravy
  // znovu ověřuje server-side, tohle je jen zobrazovací kopie pro klienta.
  var SHIPPING = {
    pickup: { label: 'Osobní odběr (Nová Ves u Prahy / Praha 8, Čimice)', price: 0 },
    'zasilkovna-pickup': { label: 'Zásilkovna – výdejní místo', price: 89 },
    'zasilkovna-address': { label: 'Zásilkovna – doručení na adresu', price: 129 },
    'ppl-pickup': { label: 'PPL – výdejní místo', price: 76 },
    'ppl-address': { label: 'PPL – doručení na adresu', price: 106 }
  };

  // Volby dopravy, u kterých se ptáme na název výdejního místa (na rozdíl od
  // doručení na adresu, kde stačí fakturační adresa už vyplněná výše).
  var PICKUP_POINT_SHIPPING = { 'zasilkovna-pickup': true, 'ppl-pickup': true };

  // Veřejný API klíč pro widget výdejních míst Zásilkovny (client.packeta.com
  // → Klientská podpora) — jen pro výběr pobočky, ne pro podávání zásilek.
  var PACKETA_API_KEY = '284305c314c8d873';

  // Účet pro QR platbu na stránce "Objednávka odeslána" — IBAN spočítaný
  // z 211573669/0300. Když se změní číslo účtu, přepočti IBAN znovu.
  var BANK_IBAN = 'CZ6503000000000211573669';

  // Slevové kódy — přidávej/uprav podle potřeby. Když je API_BASE vyplněné,
  // kódy z D1 databáze mají přednost, tohle slouží jako fallback bez workeru.
  // type "percent": value je procento z mezisoučtu. type "fixed": value je sleva v Kč.
  var DISCOUNT_CODES = {};

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
    var newQty = (item ? item.qty : 0) + qty;

    var available = availableStock(id);
    var capped = available != null && newQty > available;
    if (capped) newQty = available;

    if (newQty <= 0) {
      cart = cart.filter(function (i) { return i.id !== id; });
    } else if (item) {
      item.qty = newQty;
    } else {
      cart.push({ id: id, name: name, price: price, qty: newQty });
    }
    saveCart(cart);
    openCart();

    if (capped) {
      showStockToast('V košíku může být nejvýš ' + available + ' ks — ' + name + '.');
    }
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
      var stepper = document.querySelector('[data-qty-for="' + id + '"]');
      var qtyInput = stepper ? stepper.querySelector('[data-qty-input]') : null;
      var notifyBox = document.querySelector('[data-stock-notify="' + id + '"]');
      if (qty > 0) {
        el.textContent = 'Skladem: ' + qty + ' ks';
        el.className = 'stock-badge stock-badge--in';
        if (addBtn) addBtn.disabled = false;
        if (qtyInput) {
          qtyInput.disabled = false;
          qtyInput.setAttribute('max', qty);
        }
        if (stepper) {
          stepper.querySelectorAll('[data-action]').forEach(function (btn) {
            btn.disabled = false;
          });
        }
        if (notifyBox) notifyBox.hidden = true;
      } else if (notifyBox) {
        notifyBox.hidden = false;
      }
    });
  }

  // Produkty přidané v adminu (ne napevno v HTML) se sem doplní jako další
  // karty, aby se objevily v přehledu bez nutnosti upravovat kód webu.
  function renderDynamicProducts(stockMap) {
    if (!stockMap) return;
    // Jen skutečný přehled všech produktů (produkty.html) — .product-grid se
    // používá i pro "Mohlo by se vám líbit" výřezy na jiných stránkách, kde
    // bychom jinak omylem duplikovali produkty, co tam záměrně chybí.
    var grid = document.getElementById('full-catalog-grid');
    if (!grid) return;
    var known = {};
    document.querySelectorAll('[data-stock-badge]').forEach(function (el) {
      known[el.getAttribute('data-stock-badge')] = true;
    });
    Object.keys(stockMap).forEach(function (id) {
      if (known[id]) return;
      grid.appendChild(buildDynamicProductCard(id, stockMap[id]));
    });
  }

  function buildDynamicProductCard(id, data) {
    var article = document.createElement('article');
    article.className = 'product-card';
    var detailUrl = '/produkty/produkt.html?id=' + encodeURIComponent(id);
    var imgHtml = data.imageUrl
      ? '<img src="' + data.imageUrl + '" alt="' + data.title.replace(/"/g, '&quot;') + '" loading="lazy">'
      : '<div class="img-placeholder"></div>';
    article.innerHTML =
      '<a href="' + detailUrl + '" class="product-img">' + imgHtml + '</a>' +
      '<div class="product-body">' +
        '<h3><a href="' + detailUrl + '">' + data.title + '</a></h3>' +
        (data.teaser ? '<p>' + data.teaser + '</p>' : '') +
        '<span class="product-price">' + data.price + ' Kč</span>' +
        '<span class="stock-badge stock-badge--out" data-stock-badge="' + id + '">Není skladem</span>' +
        '<div class="add-to-cart-row">' +
          '<div class="qty-stepper" data-qty-for="' + id + '">' +
            '<button type="button" data-action="dec" aria-label="Ubrat kus" disabled>−</button>' +
            '<input type="number" value="1" min="1" data-qty-input aria-label="Počet kusů" disabled>' +
            '<button type="button" data-action="inc" aria-label="Přidat kus" disabled>+</button>' +
          '</div>' +
          '<button type="button" class="btn btn--outline" data-add-to-cart data-id="' + id + '" data-name="' + data.title.replace(/"/g, '&quot;') + '" data-price="' + data.price + '" disabled>Přidat do košíku</button>' +
        '</div>' +
      '</div>';
    wireQtyStepper(article.querySelector('.qty-stepper'));
    wireAddToCartBtn(article.querySelector('[data-add-to-cart]'));
    return article;
  }

  var lastStockMap = null;
  var shippingSettings = { active: false, threshold: 0 };

  function loadShippingSettings() {
    if (!API_BASE) return;
    fetch(API_BASE + '/api/shipping-settings')
      .then(function (r) { return r.json(); })
      .then(function (settings) {
        shippingSettings = settings;
        renderCartPage();
      })
      .catch(function () {});
  }

  function updateFreeShippingUi(subtotal, freeShippingApplies) {
    document.querySelectorAll('#shipping-options .option-card').forEach(function (card) {
      var input = card.querySelector('input[name="shipping"]');
      var priceEl = card.querySelector('.option-price');
      var info = input && SHIPPING[input.value];
      if (!info || info.price === 0 || !priceEl) return;
      priceEl.textContent = freeShippingApplies ? 'Zdarma' : formatPrice(info.price);
    });

    var note = document.getElementById('free-shipping-note');
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

  function loadStock() {
    if (!API_BASE) return;
    fetch(API_BASE + '/api/products')
      .then(function (r) { return r.json(); })
      .then(function (stockMap) {
        lastStockMap = stockMap;
        renderDynamicProducts(stockMap);
        applyStock(stockMap);
        renderCart();
        renderCartPage();
      })
      .catch(function () {});
  }

  function wireQtyStepper(stepper) {
    var input = stepper && stepper.querySelector('[data-qty-input]');
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
  }

  function wireAddToCartBtn(btn) {
    if (!btn) return;
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-id');
      var qtyInput = document.querySelector('[data-qty-for="' + id + '"] [data-qty-input]');
      var qty = qtyInput ? qtyInput.value : 1;
      addToCart(id, btn.getAttribute('data-name'), parseFloat(btn.getAttribute('data-price')), qty);
      if (qtyInput) qtyInput.value = 1;
    });
  }

  function wireQtySteppers() {
    document.querySelectorAll('.qty-stepper').forEach(wireQtyStepper);
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
      var available = availableStock(item.id);
      if (available != null && item.qty + 1 > available) {
        showStockToast('V košíku může být nejvýš ' + available + ' ks — ' + item.name + '.');
        return;
      }
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
    reconcileCartWithStock();
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
    reconcileCartWithStock();
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
    var freeShippingApplies = shippingSettings.active && shippingSettings.threshold > 0 && subtotal >= shippingSettings.threshold;
    var shippingPrice = freeShippingApplies ? 0 : shipping.price;
    var total = Math.max(0, subtotal - discount) + shippingPrice;
    updateFreeShippingUi(subtotal, freeShippingApplies);

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
    setText('summary-shipping', shippingPrice === 0 ? 'Zdarma' : formatPrice(shippingPrice));
    setText('summary-total', formatPrice(total));

    // Hotově při odběru dává smysl jen u osobního odběru.
    var cashOption = document.getElementById('payment-cash-option');
    if (cashOption) {
      var cashRadio = cashOption.querySelector('input[name="payment"]');
      if (shippingKey !== 'pickup') {
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
    if (addressFields) {
      addressFields.hidden = !PICKUP_POINT_SHIPPING[shippingKey];
      if (PICKUP_POINT_SHIPPING[shippingKey]) {
        var selectedRadio = document.querySelector('input[name="shipping"][value="' + shippingKey + '"]');
        var optionCard = selectedRadio && selectedRadio.closest('.option-card');
        if (optionCard) optionCard.insertAdjacentElement('afterend', addressFields);
      }
    }

    var pickBranchBtn = document.getElementById('pick-branch-btn');
    if (pickBranchBtn) pickBranchBtn.hidden = shippingKey !== 'zasilkovna-pickup';
  }

  function availableStock(id) {
    if (!lastStockMap) return null;
    var entry = lastStockMap[id];
    return entry ? entry.stockQty : 0;
  }

  // Košík si nic neblokuje na skladě (nic se "nerezervuje"), takže se
  // množství vždy porovnává proti aktuálnímu stavu — pokud mezitím někdo
  // koupí poslední kus (nebo si zákazník sám naklikal víc, než je skladem),
  // množství se rovnou upraví dolů a zobrazí se, co přesně se změnilo.
  function reconcileCartWithStock() {
    if (!lastStockMap) return;
    var cart = getCart();
    var changes = [];
    var next = [];

    cart.forEach(function (item) {
      var available = availableStock(item.id);
      if (available == null || item.qty <= available) {
        next.push(item);
      } else if (available > 0) {
        changes.push(item.name + ' — skladem už jen ' + available + ' ks');
        next.push(Object.assign({}, item, { qty: available }));
      } else {
        changes.push(item.name + ' — už není skladem');
      }
    });

    if (changes.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      showStockToast('Stav skladu se změnil: ' + changes.join('; ') + '.');
    }
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
    if (PICKUP_POINT_SHIPPING[shippingKey] && address) lines.push('Výdejní místo: ' + address);
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
    loadShippingSettings();

    document.querySelectorAll('[data-add-to-cart]').forEach(wireAddToCartBtn);

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

    var pickBranchBtn = document.getElementById('pick-branch-btn');
    if (pickBranchBtn && typeof Packeta !== 'undefined') {
      pickBranchBtn.addEventListener('click', function () {
        Packeta.Widget.pick(PACKETA_API_KEY, function (point) {
          if (!point) return;
          var addressInput = document.getElementById('c-address');
          if (addressInput) addressInput.value = point.name + ', ' + point.street + ', ' + point.city;
        }, { country: 'cz', language: 'cs' });
      });
    }

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
          .then(function (res) {
            if (res.ok) {
              showOrderSuccess(res.data);
            } else if (res.data && res.data.error === 'insufficient_stock') {
              // Mezitím někdo koupil poslední kus — neposílat přes mailto
              // (to by vypadalo jako objednávka, co ve skutečnosti nejde
              // splnit), místo toho jasně říct, co se změnilo, a dotáhnout
              // čerstvý stav skladu (loadStock → reconcileCartWithStock
              // množství rovnou opraví).
              showStockToast('Mezitím došel sklad u některé položky v košíku — množství jsme upravili.');
              loadStock();
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
        return r.json().then(function (data) { return { ok: r.ok, data: data }; });
      })
      .then(function (res) {
        if (res.ok) {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(DISCOUNT_KEY);
        }
        return res;
      })
      .catch(function () { return { ok: false, data: null }; });
  }

  // SPD (Short Payment Descriptor) — český standard pro QR platby, podporovaný
  // všemi tuzemskými bankovními aplikacemi. Naskenováním se vyplní částka,
  // účet i variabilní symbol, klient nic neopisuje ručně.
  function buildPaymentQrSvg(amount, variableSymbol) {
    var spd = 'SPD*1.0*ACC:' + BANK_IBAN + '*AM:' + amount.toFixed(2) + '*CC:CZK*X-VS:' + variableSymbol + '*MSG:Lufactory';
    var qr = qrcode(0, 'M');
    qr.addData(spd);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, alt: 'QR platba' });
  }

  function showOrderSuccess(result) {
    var content = document.getElementById('cart-page-content');
    if (!content) return;
    renderCart();

    var qrBlock = '';
    if (result.paymentMethod === 'transfer' && typeof qrcode === 'function') {
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

  // Pro stránky, co si obsah produktu vykreslují samy až po načtení dat
  // (viz produkty/produkt.html) — potřebují dodatečně zapojit tlačítka a
  // znovu ověřit sklad, protože DOMContentLoaded už proběhlo dřív.
  window.lufactoryCart = {
    wireQtyStepper: wireQtyStepper,
    wireAddToCartBtn: wireAddToCartBtn,
    refreshStock: loadStock
  };
})();
