// recenze.html?token=... — hodnocení objednávky zákazníkem (odkaz z e-mailu).
import { API_BASE } from '../config.js';
import { escapeHtml } from '../util.js';

const STAR_WORDS = { 1: 'hvězdička', 2: 'hvězdičky', 3: 'hvězdičky', 4: 'hvězdičky', 5: 'hvězdiček' };

function starsHtml(productId, title) {
  let html = '<div class="star-rating" role="radiogroup" aria-label="Hodnocení: ' + escapeHtml(title) + '">';
  for (let v = 5; v >= 1; v--) {
    const id = 'star-' + productId + '-' + v;
    html += '<input type="radio" name="rating-' + productId + '" id="' + id + '" value="' + v + '" aria-label="' + v + ' ' + STAR_WORDS[v] + ' z 5">' +
            '<label for="' + id + '">★</label>';
  }
  return html + '</div>';
}

function renderForm(root, token, invite) {
  let html = '<p class="review-intro">Díky za objednávku č. ' + escapeHtml(invite.orderNumber) + '! Ohodnoťte prosím, jak se vám jednotlivé produkty líbí.</p>' +
    '<form id="review-form">';
  invite.items.forEach((item) => {
    const productId = escapeHtml(item.product_id);
    html += '<div class="review-item" data-product-id="' + productId + '">' +
      '<h3>' + escapeHtml(item.title) + '</h3>' +
      starsHtml(productId, item.title) +
      '<textarea data-comment maxlength="500" placeholder="Pár slov k produktu (nepovinné)" aria-label="Komentář k produktu ' + escapeHtml(item.title) + ' (nepovinné)"></textarea>' +
    '</div>';
  });
  html += '<button type="submit" class="btn">Odeslat hodnocení</button>' +
    '<p class="review-error" id="review-error" hidden>Vyberte prosím alespoň jedno hodnocení hvězdičkami.</p>' +
    '</form>';
  root.innerHTML = html;

  document.getElementById('review-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const reviews = [];
    document.querySelectorAll('.review-item').forEach((el) => {
      const checked = el.querySelector('input[type="radio"]:checked');
      if (!checked) return;
      reviews.push({
        productId: el.getAttribute('data-product-id'),
        rating: Number(checked.value),
        comment: el.querySelector('[data-comment]').value.trim()
      });
    });
    const errorEl = document.getElementById('review-error');
    if (reviews.length === 0) {
      errorEl.hidden = false;
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Odesílám…';

    fetch(API_BASE + '/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, reviews })
    })
      .then((r) => r.ok)
      .then((ok) => {
        if (ok) {
          root.innerHTML = '<p class="review-success">Díky moc za hodnocení!</p>';
        } else {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Odeslat hodnocení';
          errorEl.hidden = false;
          errorEl.textContent = 'Odeslání se nepovedlo, zkuste to prosím znovu.';
        }
      });
  });
}

export function initReviewPage() {
  const root = document.getElementById('review-root');
  if (!root) return;
  const token = new URLSearchParams(window.location.search).get('token');

  if (!token) {
    root.innerHTML = '<p>Chybí odkaz na objednávku. Otevřete prosím odkaz z e-mailu.</p>';
    return;
  }

  fetch(API_BASE + '/api/reviews/invite/' + encodeURIComponent(token))
    .then((r) => {
      if (!r.ok) throw new Error('invalid');
      return r.json();
    })
    .then((invite) => {
      if (invite.alreadySubmitted) {
        root.innerHTML = '<p class="review-success">Hodnocení k objednávce č. ' + escapeHtml(invite.orderNumber) + ' už jsme od vás dostali — díky!</p>';
        return;
      }
      renderForm(root, token, invite);
    })
    .catch(() => {
      root.innerHTML = '<p>Tenhle odkaz na hodnocení už bohužel neplatí.</p>';
    });
}
