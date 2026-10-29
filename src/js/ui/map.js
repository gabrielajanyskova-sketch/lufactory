// Mapa Google se vloží až po kliknutí — do té doby se Googlu nic neposílá.
export function initMap() {
  document.querySelectorAll('[data-map-src]').forEach((placeholder) => {
    const button = placeholder.querySelector('[data-map-load]');
    if (!button) return;
    button.addEventListener('click', () => {
      const iframe = document.createElement('iframe');
      iframe.src = placeholder.getAttribute('data-map-src');
      iframe.title = placeholder.getAttribute('data-map-title') || 'Mapa';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      placeholder.replaceWith(iframe);
      iframe.focus();
    });
  });
}
