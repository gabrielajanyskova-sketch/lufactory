// Kontrola sestaveného webu v dist/ (spouští se po `npm run build`).
// Hlídá meta údaje, nadpisy, JSON-LD, odkazy a soubory, duplicitní id,
// inline JS/styly, sitemapu, hlavičky a shodu údajů mezi webem a workerem.
// Při chybě skončí s kódem 1. Spuštění: npm run check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHIPPING, BANK_IBAN, STATIC_PRODUCT_IDS, API_BASE } from '../src/js/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/site.json'), 'utf8'));
const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/products.json'), 'utf8'));

// Stránky, jejichž H1 vykresluje až JavaScript z dat API.
const H1_FROM_JS = ['produkty/produkt.html'];

const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

if (!fs.existsSync(DIST)) {
  console.error('dist/ neexistuje — nejdřív spusť npm run build');
  process.exit(1);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

const htmlFiles = walk(DIST).filter((f) => f.endsWith('.html')).map((f) => path.relative(DIST, f));
const pages = Object.fromEntries(htmlFiles.map((f) => [f, fs.readFileSync(path.join(DIST, f), 'utf8')]));

// URL → soubor v dist/ stejně jako Cloudflare Pages (/x → x.html, / → index.html).
function resolveUrl(url) {
  const clean = decodeURIComponent(url.split('#')[0].split('?')[0]);
  if (clean.endsWith('/')) return path.join(clean, 'index.html').slice(1);
  const rel = clean.slice(1);
  if (fs.existsSync(path.join(DIST, rel)) && fs.statSync(path.join(DIST, rel)).isFile()) return rel;
  if (fs.existsSync(path.join(DIST, rel + '.html'))) return rel + '.html';
  return null;
}

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : null;
};
const metaContent = (html, key) => {
  const tag = html.match(new RegExp(`<meta (?:name|property)="${key}" content="[^"]*">`));
  return tag ? attr(tag[0], 'content') : null;
};
const isNoindex = (html) => /<meta name="robots" content="[^"]*noindex/.test(html);
const ids = (html) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

const titles = {};
const descriptions = {};
const canonicals = new Set();

for (const [file, html] of Object.entries(pages)) {
  // ---------- základ a meta údaje ----------
  if (!/<html lang="cs">/.test(html)) fail(file, 'chybí <html lang="cs">');
  if (!/<meta name="viewport"/.test(html)) fail(file, 'chybí meta viewport');
  const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1];
  if (!title) fail(file, 'chybí <title>');

  const h1Count = (html.match(/<h1[\s>]/g) || []).length;
  if (!H1_FROM_JS.includes(file) && h1Count !== 1) fail(file, `má ${h1Count}× <h1> (má být právě jeden)`);

  if (!isNoindex(html)) {
    const description = metaContent(html, 'description');
    const canonical = (html.match(/<link rel="canonical" href="([^"]+)">/) || [])[1];
    if (!description) fail(file, 'chybí meta description');
    if (!canonical) fail(file, 'chybí canonical');
    for (const key of ['og:title', 'og:description', 'og:url', 'og:image', 'twitter:card']) {
      if (!metaContent(html, key)) fail(file, `chybí ${key}`);
    }
    if (canonical) {
      if (/\.html$/.test(canonical)) fail(file, `canonical s .html (${canonical}) — Pages ho přesměrovává`);
      if (metaContent(html, 'og:url') !== canonical) fail(file, 'og:url se liší od canonical');
      canonicals.add(canonical);
    }
    (titles[title] = titles[title] || []).push(file);
    (descriptions[description] = descriptions[description] || []).push(file);
  }

  // ---------- duplicitní id ----------
  const seen = new Set();
  for (const id of ids(html)) {
    if (seen.has(id)) fail(file, `duplicitní id="${id}"`);
    seen.add(id);
  }

  // ---------- inline JS a styly ----------
  for (const tag of html.match(/<script\b[^>]*>/g) || []) {
    if (!attr(tag, 'src') && attr(tag, 'type') !== 'application/ld+json') fail(file, `inline <script>: ${tag}`);
  }
  for (const m of html.matchAll(/<[a-z][^>]*\son[a-z]+="/gi)) fail(file, `inline obsluha události: ${m[0].slice(0, 60)}…`);
  for (const m of html.matchAll(/<[a-z][^>]*\sstyle="/gi)) fail(file, `atribut style="": ${m[0].slice(0, 60)}…`);
  if ((html.match(/<style>/g) || []).length > 1) fail(file, 'víc než jeden <style> blok (CSS patří do src/css)');

  // ---------- obrázky ----------
  for (const tag of html.match(/<img\b[^>]*>/g) || []) {
    if (attr(tag, 'alt') === null) fail(file, `<img> bez alt: ${tag.slice(0, 80)}`);
    // Obrázky bez src plní až JavaScript (náhled v adminu) — rozměry nemají.
    if (attr(tag, 'src') && !attr(tag, 'src').startsWith('data:') && (!attr(tag, 'width') || !attr(tag, 'height'))) fail(file, `<img> bez width/height: ${tag.slice(0, 80)}`);
  }

  // ---------- JSON-LD ----------
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch (e) {
      fail(file, `neplatné JSON-LD: ${e.message}`);
      continue;
    }
    if (data['@context'] !== 'https://schema.org') fail(file, 'JSON-LD bez @context https://schema.org');
    const nodes = data['@graph'] || [data];
    for (const node of nodes) {
      if (!node['@type']) fail(file, 'JSON-LD uzel bez @type');
      if (node['@type'] === 'Product' && !(node.offers && node.offers.price && node.offers.priceCurrency)) {
        fail(file, 'Product bez offers.price/priceCurrency');
      }
      if (node['@type'] === 'FAQPage') {
        // Každá otázka ve schema musí být vidět na stránce.
        for (const q of node.mainEntity || []) {
          if (!html.includes(`<h3>${q.name}</h3>`)) fail(file, `FAQ otázka není na stránce vidět: ${q.name}`);
        }
      }
    }
  }

  // ---------- odkazy a soubory ----------
  const urls = [];
  for (const m of html.matchAll(/\s(?:href|src|data-full|data-map-src)="([^"]+)"/g)) urls.push(m[1]);
  for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) {
    for (const part of m[1].split(',')) urls.push(part.trim().split(/\s+/)[0]);
  }
  for (const url of urls) {
    if (url.startsWith('#')) {
      if (url.length > 1 && !ids(html).includes(url.slice(1))) fail(file, `odkaz na neexistující kotvu ${url}`);
      continue;
    }
    if (!url.startsWith('/') || url.startsWith('//')) continue;
    if (/\.html(?:[?#]|$)/.test(url)) fail(file, `interní odkaz s .html (${url}) — vede přes přesměrování`);
    const target = resolveUrl(url);
    if (!target) {
      fail(file, `rozbitý odkaz/soubor ${url}`);
      continue;
    }
    const hash = url.split('#')[1];
    if (hash && pages[target] && !ids(pages[target]).includes(hash)) fail(file, `odkaz ${url}: kotva #${hash} na cílové stránce není`);
  }
}

for (const [title, files] of Object.entries(titles)) {
  if (files.length > 1) errors.push(`stejný <title> "${title}": ${files.join(', ')}`);
}
for (const [description, files] of Object.entries(descriptions)) {
  if (files.length > 1) errors.push(`stejná meta description: ${files.join(', ')}`);
}

// ---------- sitemap ----------
const sitemap = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const loc of locs) {
  if (!loc.startsWith(site.url + '/')) { errors.push(`sitemap: cizí adresa ${loc}`); continue; }
  const file = resolveUrl(loc.slice(site.url.length));
  if (!file || !pages[file]) errors.push(`sitemap: ${loc} neexistuje`);
  else if (isNoindex(pages[file])) errors.push(`sitemap: ${loc} má noindex`);
}
for (const canonical of canonicals) {
  if (!locs.includes(canonical)) errors.push(`sitemap: chybí indexovatelná stránka ${canonical}`);
}
const robots = fs.readFileSync(path.join(DIST, 'robots.txt'), 'utf8');
if (!robots.includes(`Sitemap: ${site.url}/sitemap.xml`)) errors.push('robots.txt: chybí odkaz na sitemapu');

// ---------- security.txt (RFC 9116) ----------
const securityTxtPath = path.join(DIST, '.well-known/security.txt');
if (!fs.existsSync(securityTxtPath)) {
  errors.push('chybí .well-known/security.txt');
} else {
  const expires = (fs.readFileSync(securityTxtPath, 'utf8').match(/^Expires: (.+)$/m) || [])[1];
  const daysLeft = expires ? (new Date(expires) - Date.now()) / 86400000 : -1;
  if (!(daysLeft > 30)) errors.push('security.txt: Expires chybí nebo vyprší do 30 dnů — prodluž datum v src/public/.well-known/security.txt');
}

// ---------- _headers ----------
const headers = fs.readFileSync(path.join(DIST, '_headers'), 'utf8');
headers.split('\n').forEach((line, i) => {
  if (line.length > 2000) errors.push(`_headers: řádek ${i + 1} je delší než 2000 znaků`);
});
if (!headers.includes(new URL(API_BASE).origin)) errors.push('_headers: CSP connect-src neobsahuje adresu workeru (API_BASE)');

// ---------- shoda web ↔ worker ↔ data ----------
const worker = fs.readFileSync(path.join(ROOT, 'worker/src/index.js'), 'utf8');
const workerConst = (name) => {
  const m = worker.match(new RegExp(`const ${name} = ([\\s\\S]*?);\\n`));
  if (!m) throw new Error(`worker: konstanta ${name} nenalezena`);
  return new Function(`return (${m[1]});`)();
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
if (!same(workerConst('SHIPPING'), SHIPPING)) errors.push('worker: SHIPPING se liší od src/js/config.js');
if (workerConst('BANK_IBAN') !== BANK_IBAN) errors.push('worker: BANK_IBAN se liší od src/js/config.js');
if (!same(workerConst('STATIC_PRODUCT_IDS'), STATIC_PRODUCT_IDS)) errors.push('worker: STATIC_PRODUCT_IDS se liší od src/js/config.js');
if (!same(products.map((p) => p.id), STATIC_PRODUCT_IDS)) errors.push('src/data/products.json: ID produktů se liší od STATIC_PRODUCT_IDS');
if (workerConst('WORKER_BASE') !== API_BASE) errors.push('worker: WORKER_BASE se liší od API_BASE');
if (workerConst('SITE_URL') !== site.url) errors.push('worker: SITE_URL se liší od src/data/site.json');
const seller = workerConst('SELLER');
if (seller.ico !== site.seller.ico) errors.push('worker: IČO se liší od src/data/site.json');

// IČO na stránkách (patička, obchodní podmínky, zásady) musí sedět s daty.
for (const [file, html] of Object.entries(pages)) {
  for (const m of html.matchAll(/IČO:? ?(\d{8})/g)) {
    if (m[1] !== site.seller.ico) fail(file, `IČO ${m[1]} se liší od src/data/site.json (${site.seller.ico})`);
  }
}

// Ceny v llms.txt musí odpovídat products.json.
const llms = fs.readFileSync(path.join(DIST, 'llms.txt'), 'utf8');
for (const p of products) {
  const line = llms.split('\n').find((l) => l.includes(`/produkty/${p.id})`));
  if (!line) errors.push(`llms.txt: chybí produkt ${p.id}`);
  else if (!line.includes(`— ${p.price} Kč`)) errors.push(`llms.txt: cena u ${p.id} nesedí s products.json (${p.price} Kč)`);
}

if (errors.length) {
  console.error(`✗ ${errors.length} problém(ů):\n` + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}
console.log(`✓ Kontrola prošla: ${htmlFiles.length} stránek, ${locs.length} URL v sitemapě.`);
