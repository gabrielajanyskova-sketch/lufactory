// Formulář pro odstoupení od smlouvy (obchodni-podminky.html) — sestaví
// zákonné prohlášení z vyplněných údajů, místo aby ho zákazník psal sám.
import { API_BASE } from '../config.js';
import { postJson, honeypot } from '../util.js';

export function initWithdrawalForm() {
  const form = document.getElementById('withdrawal-form');
  if (!form) return;

  const val = (id) => document.getElementById(id).value.trim();

  function buildWithdrawalMailto() {
    const lines = [
      'Oznamuji, že tímto odstupuji od smlouvy o nákupu tohoto zboží: ' + val('w-goods'),
      '',
      'Jméno a příjmení: ' + val('w-name'),
      'Adresa: ' + val('w-address'),
      'E-mail: ' + val('w-email')
    ];
    const order = val('w-order');
    if (order) lines.push('Číslo objednávky: ' + order);
    const received = val('w-received');
    if (received) lines.push('Datum obdržení zboží: ' + received);
    lines.push('', 'Datum: ' + new Date().toLocaleDateString('cs-CZ'));

    return 'mailto:info@lufactory.cz'
      + '?subject=' + encodeURIComponent('Odstoupení od smlouvy')
      + '&body=' + encodeURIComponent(lines.join('\n'));
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    const submitBtn = form.querySelector('.legal-form-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Odesílám…';

    postJson(API_BASE + '/api/withdrawal', {
      name: val('w-name'),
      email: val('w-email'),
      address: val('w-address'),
      orderNumber: val('w-order'),
      receivedDate: val('w-received'),
      goods: val('w-goods'),
      hp: honeypot(form)
    }).then((ok) => {
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
