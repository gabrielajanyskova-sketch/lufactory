// Lokální náhled dist/ se stejným chováním jako Cloudflare Pages:
// /x.html → 308 /x, /x → x.html, neznámá cesta → 404.html, hlavičky z _headers.
// Spuštění: npm run build && npm run serve  (port: PORT=8080)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json'
};

// Zjednodušené čtení _headers: cesty s *, "! Název" hlavičku odebere,
// pravidla s doménou (https://...) se lokálně přeskočí.
function headersFor(urlPath) {
  const file = path.join(ROOT, '_headers');
  if (!fs.existsSync(file)) return {};
  const out = {};
  let matches = false;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      const rule = line.trim();
      const pattern = rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      matches = !/^https?:/.test(rule) && new RegExp('^' + pattern + '$').test(urlPath);
    } else if (matches && line.trim().startsWith('! ')) {
      delete out[line.trim().slice(2).trim()];
    } else if (matches) {
      const i = line.indexOf(':');
      const key = line.slice(0, i).trim();
      const value = line.slice(i + 1).trim();
      out[key] = out[key] ? out[key] + ', ' + value : value;
    }
  }
  return out;
}

const isFile = (f) => fs.existsSync(f) && fs.statSync(f).isFile();

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(url.pathname);
  const redirect = (to) => {
    res.writeHead(308, { Location: to + url.search });
    res.end();
  };

  if (p.endsWith('/index.html')) return redirect(p.slice(0, -'index.html'.length));
  if (p.endsWith('.html')) return redirect(p.slice(0, -'.html'.length));

  let file = path.join(ROOT, p);
  if (p.endsWith('/')) file = path.join(file, 'index.html');
  else if (!isFile(file) && isFile(file + '.html')) file += '.html';

  let status = 200;
  if (!file.startsWith(ROOT) || !isFile(file)) {
    file = path.join(ROOT, '404.html');
    status = 404;
  }
  res.writeHead(status, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', ...headersFor(p) });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`http://localhost:${PORT} (dist/)`));
