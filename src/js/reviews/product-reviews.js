// Schválené recenze produktu pod detailem a jejich průměr ve schema.org.
import { API_BASE } from '../config.js';
import { escapeHtml } from '../util.js';

export function reviewCardHtml(r, authorSuffix = '') {
  return '<div class="review-card">' +
    '<div class="review-card-stars">' + '★'.repeat(r.rating) + '<span class="review-card-empty">' + '★'.repeat(5 - r.rating) + '</span></div>' +
    (r.comment ? '<p>' + escapeHtml(r.comment) + '</p>' : '') +
    '<p class="review-card-author">' + escapeHtml(r.customer_name) + authorSuffix + '</p>' +
  '</div>';
}

// Na statických stránkách bez argumentu (ID se najde podle tlačítka
// "Přidat do košíku" v .product-detail-body), na produkty/produkt.html
// s explicitním ID, protože obsah se tam vykresluje až po načtení dat.
export function initProductReviews(productId) {
  const section = document.getElementById('product-reviews-section');
  const container = document.getElementById('product-reviews');
  if (!section || !container) return;

  if (!productId) {
    const btn = document.querySelector('.product-detail-body [data-add-to-cart]');
    productId = btn && btn.getAttribute('data-id');
  }
  if (!productId) return;

  fetch(API_BASE + '/api/products/' + encodeURIComponent(productId) + '/reviews')
    .then((r) => r.json())
    .then((data) => {
      if (!data.count) return;

      let html = '<h2>Recenze zákazníků</h2>' +
        '<p class="reviews-summary">' + data.average.toFixed(1).replace('.', ',') + ' ★ &middot; ' + data.count + ' hodnocení</p>';
      data.reviews.forEach((r) => { html += reviewCardHtml(r); });
      container.innerHTML = html;
      section.hidden = false;

      // Doplnit hodnocení do existujícího schema.org Product JSON-LD, aby
      // se hvězdičky mohly zobrazit i ve výsledcích vyhledávání.
      const ld = document.querySelector('script[type="application/ld+json"]');
      if (ld) {
        try {
          const parsed = JSON.parse(ld.textContent);
          if (parsed['@type'] === 'Product') {
            parsed.aggregateRating = { '@type': 'AggregateRating', ratingValue: data.average, reviewCount: data.count };
            ld.textContent = JSON.stringify(parsed);
          }
        } catch (e) { /* schema chybí nebo je v jiném tvaru — recenze se přesto zobrazí */ }
      }
    })
    .catch(() => {});
}
