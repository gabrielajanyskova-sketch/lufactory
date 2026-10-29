// Přihlášení: heslo → jednorázový kód e-mailem → token.
import { API_BASE, getToken, setToken, authHeaders, onUnauthorized } from './api.js';

let pendingLoginId = '';
let onLoggedIn = () => {};

const $ = (id) => document.getElementById(id);

function showPasswordStep() {
  $('login-step-password').hidden = false;
  $('login-step-code').hidden = true;
}

function showCodeStep(loginId) {
  pendingLoginId = loginId;
  $('login-step-password').hidden = true;
  $('login-step-code').hidden = false;
  $('login-error').textContent = '';
  $('admin-code').value = '';
  $('admin-code').focus();
}

function showApp() {
  $('admin-login').hidden = true;
  $('admin-app').hidden = false;
  $('logout-btn').hidden = false;
  onLoggedIn();
}

export function showLogin(message) {
  $('admin-login').hidden = false;
  $('admin-app').hidden = true;
  $('logout-btn').hidden = true;
  $('admin-password').value = '';
  pendingLoginId = '';
  showPasswordStep();
  $('login-error').textContent = message || '';
}

function postJson(path, body) {
  return fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then((r) => r.json().then((data) => ({ ok: r.ok, data })));
}

function submitPassword() {
  const password = $('admin-password').value;
  if (!password) return;
  postJson('/api/admin/login', { password })
    .then((res) => {
      if (res.ok && res.data.ok && res.data.requiresCode) {
        showCodeStep(res.data.loginId);
      } else if (res.data && res.data.error === 'too_many_attempts') {
        showLogin('Příliš mnoho pokusů o přihlášení. Zkuste to znovu za 15 minut.');
      } else {
        showLogin('Nesprávné heslo.');
      }
    })
    .catch(() => { showLogin('Přihlášení se nezdařilo, zkuste to znovu.'); });
}

function submitCode() {
  const code = $('admin-code').value.trim();
  if (!code) return;
  postJson('/api/admin/verify-code', { loginId: pendingLoginId, code })
    .then((res) => {
      if (res.ok && res.data.ok) {
        setToken(res.data.token);
        showApp();
      } else if (res.data && res.data.error === 'code_expired') {
        showLogin('Platnost kódu vypršela, přihlaste se znovu.');
      } else if (res.data && res.data.error === 'too_many_attempts') {
        showLogin('Příliš mnoho pokusů o zadání kódu, přihlaste se znovu.');
      } else {
        $('login-error').textContent = 'Nesprávný kód.';
      }
    })
    .catch(() => { $('login-error').textContent = 'Ověření se nezdařilo, zkuste to znovu.'; });
}

export function initAuth(afterLogin) {
  onLoggedIn = afterLogin;
  onUnauthorized(() => showLogin('Přihlášení vypršelo, přihlaste se znovu.'));

  $('login-btn').addEventListener('click', submitPassword);
  $('admin-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitPassword();
  });
  $('verify-code-btn').addEventListener('click', submitCode);
  $('admin-code').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitCode();
  });
  $('logout-btn').addEventListener('click', () => {
    fetch(API_BASE + '/api/admin/logout', { method: 'POST', headers: authHeaders() }).catch(() => {});
    setToken('');
    showLogin();
  });

  if (getToken()) showApp();
  else showLogin();
}
