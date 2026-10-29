// Produkty přidané v adminu (ne v src/data/products.json) se do přehledu
// doplní jako další karty, aby se objevily bez úpravy kódu webu.
import { onStockLoaded } from './stock.js';
import { initAddToCart } from './add-to-cart.js';

function buildDynamicProductCard(id, data) {
  const article = document.createElement('article');
  article.className = 'product-card';
  const detailUrl = '/produkty/produkt.html?id=' + encodeURIComponent(id);
  const imgHtml = data.imageUrl
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
  initAddToCart(article);
  return article;
}

export function initCatalog() {
  // Jen skutečný přehled všech produktů (produkty.html) — .product-grid se
  // používá i pro "Mohlo by se vám líbit" výřezy na jiných stránkách, kde
  // bychom jinak omylem duplikovali produkty, co tam záměrně chybí.
  const grid = document.getElementById('full-catalog-grid');
  if (!grid) return;
  onStockLoaded((stockMap) => {
    const known = {};
    document.querySelectorAll('[data-stock-badge]').forEach((el) => {
      known[el.getAttribute('data-stock-badge')] = true;
    });
    Object.keys(stockMap).forEach((id) => {
      if (known[id]) return;
      grid.appendChild(buildDynamicProductCard(id, stockMap[id]));
    });
  });
}
