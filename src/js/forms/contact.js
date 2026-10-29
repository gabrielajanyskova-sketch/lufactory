// Kontaktní formulář na hlavní stránce — odeslání přes worker, při chybě
// záloha na mailto.
import { API_BASE } from '../config.js';
import { postJson, honeypot } from '../util.js';

export function initContactForm() {
  const form = document.querySelector('.contact-form');
  if (!form) return;

  function buildContactMailto() {
    const bodyLines = ['Jméno: ' + form.name.value.trim(), 'E-mail: ' + form.email.value.trim(), '', form.message.value.trim()];
    return 'mailto:info@lufactory.cz'
      + '?subject=' + encodeURIComponent('Dotaz z webu')
      + '&body=' + encodeURIComponent(bodyLines.join('\n'));
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Odesílám…';

    postJson(API_BASE + '/api/contact', {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      message: form.message.value.trim(),
      hp: honeypot(form)
    }).then((ok) => {
      if (ok) {
        form.hidden = true;
        document.getElementById('contact-success').hidden = false;
      } else {
        window.location.href = buildContactMailto();
        submitBtn.disabled = false;
        submitBtn.textContent = 'Odeslat dotaz';
      }
    });
  });
}
