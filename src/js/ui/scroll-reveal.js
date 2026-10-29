// Jemné zobrazení sekcí při scrollování dolů — hero (nad ohybem) zůstává bez
// animace, aby se hned při načtení nic neschovávalo. Respektuje
// prefers-reduced-motion a bez IntersectionObserver se prostě přeskočí.
export function initScrollReveal() {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const sections = document.querySelectorAll('main > section:not(.hero)');
  if (!sections.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

  sections.forEach((section) => {
    section.classList.add('fade-in-section');
    observer.observe(section);
  });
}
