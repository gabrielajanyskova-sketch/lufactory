// Přihlašovací token a volání admin API.
import { API_BASE } from '../config.js';

export { API_BASE };

const TOKEN_KEY = 'lufactory_admin_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders() {
  return { Authorization: 'Bearer ' + getToken(), 'Content-Type': 'application/json' };
}

// Admin API s tokenem; tělo se posílá jako JSON.
export function adminFetch(path, { method = 'GET', body } = {}) {
  return fetch(API_BASE + path, {
    method,
    headers: authHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

export function adminJson(path, options) {
  return adminFetch(path, options).then((r) => r.json().then((data) => ({ ok: r.ok, data })));
}

// Přihlášení má reálné vypršení (viz worker) — ať se 401 stane kdekoliv na
// stránce, znamená to vždycky totéž: token vypršel nebo je neplatný.
export function onUnauthorized(handler) {
  const realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    return realFetch(input, init).then((r) => {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (r.status === 401 && url.indexOf('/api/admin/') !== -1 && url.indexOf('/api/admin/login') === -1) {
        handler();
      }
      return r;
    });
  };
}

// Stažení souboru (CSV, faktura, štítek) — s tokenem, takže ne obyčejný odkaz.
export function fetchBlobUrl(path) {
  return adminFetch(path).then((r) => r.blob()).then((blob) => URL.createObjectURL(blob));
}
