import { setBackgroundInert } from '../cart/drawer.js';

// Zvětšení fotek z .gallery po kliknutí, s listováním mezi fotkami téže
// galerie. Každá stránka má nejvýš jednu .gallery, takže stačí jeden lightbox.
let lightbox = null;

export function initLightbox() {
  const images = Array.prototype.slice.call(document.querySelectorAll('.gallery img'));
  if (!images.length || lightbox) return;

  lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.setAttribute('aria-label', 'Fotogalerie');
  lightbox.inert = true;
  lightbox.innerHTML =
    '<button type="button" class="lightbox-close" aria-label="Zavřít">×</button>' +
    '<button type="button" class="lightbox-prev" aria-label="Předchozí fotka">‹</button>' +
    '<img class="lightbox-img" src="" alt="">' +
    '<button type="button" class="lightbox-next" aria-label="Další fotka">›</button>';
  document.body.appendChild(lightbox);

  const imgEl = lightbox.querySelector('.lightbox-img');
  let currentIndex = 0;

  function show(index) {
    currentIndex = (index + images.length) % images.length;
    const source = images[currentIndex];
    imgEl.src = source.getAttribute('data-full') || source.currentSrc || source.src;
    imgEl.alt = source.alt || '';
  }

  function open(index) {
    show(index);
    lightbox.classList.add('is-open');
    document.body.classList.add('lightbox-open');
    lightbox.inert = false;
    setBackgroundInert(true);
    lightbox.querySelector('.lightbox-close').focus({ preventScroll: true });
  }

  function close() {
    if (!lightbox.classList.contains('is-open')) return;
    lightbox.classList.remove('is-open');
    document.body.classList.remove('lightbox-open');
    lightbox.inert = true;
    setBackgroundInert(false);
    images[currentIndex].focus({ preventScroll: true });
  }

  // Fotky jdou otevřít i klávesnicí (Tab + Enter/mezerník).
  images.forEach((img, i) => {
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', 'Zvětšit fotku: ' + (img.alt || ''));
    img.addEventListener('click', () => { open(i); });
    img.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(i);
      }
    });
  });

  lightbox.querySelector('.lightbox-close').addEventListener('click', close);
  lightbox.querySelector('.lightbox-prev').addEventListener('click', () => { show(currentIndex - 1); });
  lightbox.querySelector('.lightbox-next').addEventListener('click', () => { show(currentIndex + 1); });
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });

  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(currentIndex - 1);
    if (e.key === 'ArrowRight') show(currentIndex + 1);
  });
}
