// 3 nejnovější schválené recenze napříč všemi produkty, zobrazené na hlavní
// stránce jako sociální důkaz.
import { API_BASE, productUrl } from '../config.js';
import { escapeHtml } from '../util.js';
import { reviewCardHtml } from './product-reviews.js';

export function initHomepageReviews() {
  const section = document.getElementById('homepage-reviews-section');
  const container = document.getElementById('homepage-reviews');
  if (!section || !container) return;

  fetch(API_BASE + '/api/reviews/latest')
    .then((r) => r.json())
    .then((data) => {
      const reviews = data.reviews || [];
      if (!reviews.length) return;

      container.innerHTML = reviews.map((r) => reviewCardHtml(r,
        r.product_title ? ' — <a href="' + productUrl(r.product_id) + '">' + escapeHtml(r.product_title) + '</a>' : ''
      )).join('');
      section.hidden = false;
    })
    .catch(() => {});
}
