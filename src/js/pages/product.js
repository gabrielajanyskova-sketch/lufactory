// produkty/produkt.html?id=... — generická stránka pro produkty přidané
// přes admin; obsah se vykreslí z /api/products.
import { API_BASE } from '../config.js';
import { initAddToCart } from '../cart/add-to-cart.js';
import { loadStock } from '../cart/stock.js';
import { initLightbox } from '../ui/lightbox.js';
import { initProductReviews } from '../reviews/product-reviews.js';
import { initStockNotifyForms } from '../forms/stock-notify.js';

const NOT_FOUND = '<p>Produkt nebyl nalezen. <a href="/produkty.html">Zpět na produkty</a></p>';

export function initDynamicProductPage() {
  const root = document.getElementById('product-detail-root');
  if (!root) return;
  const id = new URLSearchParams(window.location.search).get('id');

  if (!id) {
    root.innerHTML = NOT_FOUND;
    return;
  }

  fetch(API_BASE + '/api/products')
    .then((r) => r.json())
    .then((products) => {
      const p = products[id];
      if (!p) {
        root.innerHTML = NOT_FOUND;
        return;
      }

      document.title = p.title + ' | lufactory';

      const imgHtml = p.imageUrl
        ? '<img src="' + p.imageUrl + '" alt="' + p.title.replace(/"/g, '&quot;') + '">'
        : '<div class="img-placeholder"></div>';

      const descriptionHtml = (p.description || '')
        .split(/\n\s*\n/)
        .filter((para) => para.trim())
        .map((para) => '<p>' + para.replace(/\n/g, '<br>') + '</p>')
        .join('');

      const galleryHtml = (p.galleryUrls && p.galleryUrls.length)
        ? '<h2>Další fotky</h2><div class="gallery">' +
            p.galleryUrls.map((url) => '<img src="' + url + '" alt="' + p.title.replace(/"/g, '&quot;') + '" loading="lazy">').join('') +
          '</div>'
        : '';

      root.innerHTML =
        '<div class="product-detail">' +
          '<div class="product-detail-img">' + imgHtml + '</div>' +
          '<div class="product-detail-body">' +
            '<h1>' + p.title + '</h1>' +
            '<p class="product-price-lg">' + p.price + ' Kč</p>' +
            '<span class="stock-badge stock-badge--out" data-stock-badge="' + id + '">Není skladem</span>' +
            descriptionHtml +
            '<div class="add-to-cart-row">' +
              '<div class="qty-stepper" data-qty-for="' + id + '">' +
                '<button type="button" data-action="dec" aria-label="Ubrat kus" disabled>−</button>' +
                '<input type="number" value="1" min="1" data-qty-input aria-label="Počet kusů" disabled>' +
                '<button type="button" data-action="inc" aria-label="Přidat kus" disabled>+</button>' +
              '</div>' +
              '<button type="button" class="btn" data-add-to-cart data-id="' + id + '" data-name="' + p.title.replace(/"/g, '&quot;') + '" data-price="' + p.price + '" disabled>Přidat do košíku</button>' +
            '</div>' +
            '<div class="stock-notify" data-stock-notify="' + id + '" hidden>' +
              '<form class="stock-notify-form">' +
                '<input type="email" placeholder="Váš e-mail" required>' +
                '<button type="submit" class="btn btn--outline">Dej mi vědět, až bude skladem</button>' +
              '</form>' +
              '<p class="stock-notify-success" hidden>Dáme vám vědět, až bude skladem!</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
        galleryHtml;

      // Nově vložený obsah potřebuje vlastní zapojení a znovu ověřit sklad.
      initAddToCart(root);
      loadStock();
      initLightbox();
      initProductReviews(id);
      initStockNotifyForms();
    })
    .catch(() => {
      root.innerHTML = '<p>Produkt se nepodařilo načíst. <a href="/produkty.html">Zpět na produkty</a></p>';
    });
}
