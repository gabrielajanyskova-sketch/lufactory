// Musí zůstat stejné jako API_BASE v assets/js/cart.js, admin.html a
// produkty/produkt.html — viz worker/README.md.
var API_BASE = 'https://lufactory-api.gabriela-janyskova.workers.dev';

document.addEventListener('DOMContentLoaded', function () {
  wireNavToggle();
  wireContactForm();
  wireWithdrawalForm();
  wireGalleryLightbox();
  if (document.getElementById('product-reviews-section')) wireProductReviews();
});

function wireNavToggle() {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', function () {
    var isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  nav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

function wireContactForm() {
  var form = document.querySelector('.contact-form');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = form.name.value.trim();
    var email = form.email.value.trim();
    var message = form.message.value.trim();

    var bodyLines = ['Jméno: ' + name, 'E-mail: ' + email, '', message];

    var mailto = 'mailto:info@lufactory.cz'
      + '?subject=' + encodeURIComponent('Dotaz z webu')
      + '&body=' + encodeURIComponent(bodyLines.join('\n'));

    window.location.href = mailto;
  });
}

// Real online fields for the withdrawal-from-contract form (obchodni-podminky.html) —
// composes the legally required declaration from what the customer typed, rather than
// making them write it themselves inside their e-mail client.
function wireWithdrawalForm() {
  var form = document.getElementById('withdrawal-form');
  if (!form) return;

  var val = function (id) { return document.getElementById(id).value.trim(); };

  function buildWithdrawalMailto() {
    var lines = [
      'Oznamuji, že tímto odstupuji od smlouvy o nákupu tohoto zboží: ' + val('w-goods'),
      '',
      'Jméno a příjmení: ' + val('w-name'),
      'Adresa: ' + val('w-address'),
      'E-mail: ' + val('w-email')
    ];
    var order = val('w-order');
    if (order) lines.push('Číslo objednávky: ' + order);
    var received = val('w-received');
    if (received) lines.push('Datum obdržení zboží: ' + received);
    lines.push('', 'Datum: ' + new Date().toLocaleDateString('cs-CZ'));

    return 'mailto:info@lufactory.cz'
      + '?subject=' + encodeURIComponent('Odstoupení od smlouvy')
      + '&body=' + encodeURIComponent(lines.join('\n'));
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;

    if (!API_BASE) {
      window.location.href = buildWithdrawalMailto();
      return;
    }

    var submitBtn = form.querySelector('.legal-form-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Odesílám…';

    fetch(API_BASE + '/api/withdrawal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: val('w-name'),
        email: val('w-email'),
        address: val('w-address'),
        orderNumber: val('w-order'),
        receivedDate: val('w-received'),
        goods: val('w-goods')
      })
    })
      .then(function (r) { return r.ok; })
      .catch(function () { return false; })
      .then(function (ok) {
        if (ok) {
          form.hidden = true;
          document.getElementById('withdrawal-success').hidden = false;
        } else {
          window.location.href = buildWithdrawalMailto();
          submitBtn.disabled = false;
          submitBtn.textContent = 'Odeslat odstoupení od smlouvy';
        }
      });
  });
}

// Načte schválené recenze produktu a zobrazí je pod detailem — na statických
// stránkách bez argumentu (ID se najde podle vlastního tlačítka "Přidat do
// košíku" v .product-detail-body), na produkty/produkt.html s explicitním ID
// (v okamžiku volání DOMContentLoaded ještě obsah stránky nebyl vykreslený).
function wireProductReviews(productId) {
  var section = document.getElementById('product-reviews-section');
  var container = document.getElementById('product-reviews');
  if (!section || !container || !API_BASE) return;

  if (!productId) {
    var btn = document.querySelector('.product-detail-body [data-add-to-cart]');
    productId = btn && btn.getAttribute('data-id');
  }
  if (!productId) return;

  fetch(API_BASE + '/api/products/' + encodeURIComponent(productId) + '/reviews')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.count) return;

      var html = '<h2>Recenze zákazníků</h2>' +
        '<p class="reviews-summary">' + data.average.toFixed(1).replace('.', ',') + ' ★ &middot; ' + data.count + ' hodnocení</p>';
      data.reviews.forEach(function (r) {
        html += '<div class="review-card">' +
          '<div class="review-card-stars">' + '★'.repeat(r.rating) + '<span class="review-card-empty">' + '★'.repeat(5 - r.rating) + '</span></div>' +
          (r.comment ? '<p>' + escapeHtmlClient(r.comment) + '</p>' : '') +
          '<p class="review-card-author">' + escapeHtmlClient(r.customer_name) + '</p>' +
        '</div>';
      });
      container.innerHTML = html;
      section.hidden = false;

      // Doplnit hodnocení do existujícího schema.org Product JSON-LD, aby
      // se hvězdičky mohly zobrazit i ve výsledcích vyhledávání.
      var ld = document.querySelector('script[type="application/ld+json"]');
      if (ld) {
        try {
          var parsed = JSON.parse(ld.textContent);
          if (parsed['@type'] === 'Product') {
            parsed.aggregateRating = { '@type': 'AggregateRating', ratingValue: data.average, reviewCount: data.count };
            ld.textContent = JSON.stringify(parsed);
          }
        } catch (e) { /* schema chybí nebo je v jiném tvaru — recenze se přesto zobrazí */ }
      }
    })
    .catch(function () {});
}

function escapeHtmlClient(value) {
  var div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

// Click-to-enlarge for .gallery images, with prev/next between the images in the
// same gallery. Each page has at most one .gallery, so a single lightbox instance
// covers it.
function wireGalleryLightbox() {
  var images = Array.prototype.slice.call(document.querySelectorAll('.gallery img'));
  if (!images.length) return;

  var lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.innerHTML =
    '<button type="button" class="lightbox-close" aria-label="Zavřít">×</button>' +
    '<button type="button" class="lightbox-prev" aria-label="Předchozí fotka">‹</button>' +
    '<img class="lightbox-img" src="" alt="">' +
    '<button type="button" class="lightbox-next" aria-label="Další fotka">›</button>';
  document.body.appendChild(lightbox);

  var imgEl = lightbox.querySelector('.lightbox-img');
  var currentIndex = 0;

  function show(index) {
    currentIndex = (index + images.length) % images.length;
    var source = images[currentIndex];
    imgEl.src = source.getAttribute('data-full') || source.currentSrc || source.src;
    imgEl.alt = source.alt || '';
  }

  function open(index) {
    show(index);
    lightbox.classList.add('is-open');
    document.body.classList.add('lightbox-open');
  }

  function close() {
    lightbox.classList.remove('is-open');
    document.body.classList.remove('lightbox-open');
  }

  images.forEach(function (img, i) {
    img.addEventListener('click', function () { open(i); });
  });

  lightbox.querySelector('.lightbox-close').addEventListener('click', close);
  lightbox.querySelector('.lightbox-prev').addEventListener('click', function () { show(currentIndex - 1); });
  lightbox.querySelector('.lightbox-next').addEventListener('click', function () { show(currentIndex + 1); });
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) close();
  });

  document.addEventListener('keydown', function (e) {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(currentIndex - 1);
    if (e.key === 'ArrowRight') show(currentIndex + 1);
  });
}
