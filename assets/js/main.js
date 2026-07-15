document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');

  if (toggle && nav) {
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

  var form = document.querySelector('.contact-form');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = form.name.value.trim();
    var email = form.email.value.trim();
    var product = form.product.value;
    var message = form.message.value.trim();

    var subject = 'Poptávka z webu' + (product ? ' – ' + product : '');
    var bodyLines = [
      'Jméno: ' + name,
      'E-mail: ' + email,
      product ? 'Zájem o: ' + product : '',
      '',
      message
    ].filter(function (line) { return line !== ''; });

    var mailto = 'mailto:info@lufactory.cz'
      + '?subject=' + encodeURIComponent(subject)
      + '&body=' + encodeURIComponent(bodyLines.join('\n'));

    window.location.href = mailto;
  });
});
