(function () {
  var STORAGE_KEY = 'lufactory_cart';

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

  function cartTotal(cart) {
    return cart.reduce(function (sum, i) { return sum + i.qty * i.price; }, 0);
  }

  function formatPrice(n) {
    return n.toLocaleString('cs-CZ') + ' Kč';
  }

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

    if (totalEl) totalEl.textContent = formatPrice(cartTotal(cart));
  }

  function openCart() {
    document.body.classList.add('cart-open');
  }

  function closeCart() {
    document.body.classList.remove('cart-open');
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderCart();

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

    var checkoutBtn = document.querySelector('.cart-checkout');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', function () {
        var cart = getCart();
        if (cart.length === 0) return;
        var lines = cart.map(function (i) {
          return '- ' + i.name + ' — ' + i.qty + ' ks × ' + formatPrice(i.price);
        });
        lines.push('');
        lines.push('Celkem: ' + formatPrice(cartTotal(cart)));
        var mailto = 'mailto:info@lufactory.cz'
          + '?subject=' + encodeURIComponent('Objednávka z webu')
          + '&body=' + encodeURIComponent(lines.join('\n'));
        window.location.href = mailto;
      });
    }
  });
})();
