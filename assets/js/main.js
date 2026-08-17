document.addEventListener('DOMContentLoaded', function () {
  wireNavToggle();
  wireContactForm();
  wireWithdrawalForm();
  wireGalleryLightbox();
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

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var val = function (id) { return document.getElementById(id).value.trim(); };

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

    var mailto = 'mailto:info@lufactory.cz'
      + '?subject=' + encodeURIComponent('Odstoupení od smlouvy')
      + '&body=' + encodeURIComponent(lines.join('\n'));

    window.location.href = mailto;
  });
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
    imgEl.src = source.currentSrc || source.src;
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
