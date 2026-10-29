// Sestaví web ze src/ do dist/: vloží sdílené bloky (partials), vygeneruje
// stránky produktů a karty z src/data/products.json, sitemapu a zkopíruje
// statické soubory. Spuštění: npm run build
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { createSchemas } from './schema.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');
const site = JSON.parse(read('data/site.json'));
const SITE_URL = site.url;
const products = JSON.parse(read('data/products.json'));
const productsById = Object.fromEntries(products.map((p) => [p.id, p]));

function productUrl(p) {
  return `/produkty/${p.id}`;
}

const schemas = createSchemas(site, productUrl);

function productById(id) {
  const p = productsById[id];
  if (!p) throw new Error(`Neznámý produkt: ${id}`);
  return p;
}

// {{name}} a {{a.b}} — hodnoty z dat jsou HTML (důvěryhodný obsah z repozitáře).
function fill(template, vars) {
  return template.replace(/\{\{([\w.]+)\}\}/g, (m, key) => {
    const value = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), vars);
    if (value === undefined) throw new Error(`Chybí hodnota pro ${m}`);
    return String(value);
  });
}

// Řádek začínající {{#flag}} zůstane jen tehdy, když je flag zapnutý.
function applyLineFlags(text, flags) {
  return text.replace(/^\{\{#(\w+)\}\}(.*\n?)/gm, (m, flag, rest) => (flags[flag] ? rest : ''));
}

function indent(text, prefix) {
  return text.split('\n').map((line) => (line ? prefix + line : line)).join('\n');
}

function partial(name, flags = {}) {
  const raw = read(`partials/${name}.html`).replace(/\n$/, '');
  return applyLineFlags(raw, flags).replaceAll('{{navBase}}', flags.home ? '' : '/');
}

function card(id, featured) {
  const p = productById(id);
  return fill(partial('product-card'), {
    ...p,
    url: productUrl(p),
    cardTitle: p.card.title || p.h1,
    featuredClass: featured ? ' product-card--featured' : ''
  });
}

const DIRECTIVE = /^( *)<!-- @(\w[\w-]*) ?(.*?) -->$/gm;

// Direktivy na samostatném řádku; odsazení direktivy se přenese na vložený blok.
// FAQ schema se skládá z hotové stránky, proto až ve druhém průchodu.
function render(html) {
  const firstPass = html.replace(DIRECTIVE, (m, pad, directive, args) => {
    const [name, ...rest] = args.split(/\s+/).filter(Boolean);
    let out;
    if (directive === 'include') {
      out = partial(name, Object.fromEntries(rest.map((f) => [f, true])));
    } else if (directive === 'inline-css') {
      out = `<style>\n${read(`css/${name}`).trim()}\n</style>`;
    } else if (directive === 'card') {
      out = card(name, rest.includes('featured'));
    } else if (directive === 'schema' && name === 'faq') {
      return m;
    } else if (directive === 'schema') {
      out = schemaBlock(name, rest[0]);
    } else {
      throw new Error(`Neznámá direktiva: ${m}`);
    }
    return indent(out, pad);
  });
  return firstPass.replace(DIRECTIVE, (m, pad) => indent(schemas.faq(firstPass), pad));
}

function schemaBlock(name, id) {
  if (name === 'organization') return schemas.organization();
  if (name === 'product-list') return schemas.productList(products);
  if (name === 'product') return schemas.product(productById(id));
  if (name === 'breadcrumbs') return schemas.breadcrumbs(productById(id));
  throw new Error(`Neznámé schema: ${name}`);
}

function renderProductPage(p) {
  const html = fill(read('templates/product.html'), {
    ...p,
    absUrl: SITE_URL + productUrl(p),
    absImage: SITE_URL + p.image,
    descriptionParagraphs: indent(p.description.join('\n'), '          '),
    galleryImages: indent(p.gallery.map((g) =>
      `<img src="${g.src}"${g.full ? ` data-full="${g.full}"` : ''} alt="${g.alt}" width="${g.width}" height="${g.height}" loading="lazy">`
    ).join('\n'), '        '),
    relatedCards: p.related.map((id) => `        <!-- @card ${id} -->`).join('\n\n')
  });
  return render(html);
}

// Indexovatelné stránky v pořadí, v jakém mají být v sitemapě.
function sitemap() {
  const urls = ['/', '/produkty', ...products.map(productUrl), '/obchodni-podminky', '/ochrana-osobnich-udaju'];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map((u) => `  <url>\n    <loc>${SITE_URL}${u}</loc>\n  </url>\n`).join('')
    + '</urlset>\n';
}

function write(rel, content) {
  const target = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync(path.join(SRC, 'public'), DIST, { recursive: true });

// JavaScript (moduly → jeden soubor na stránku) a samostatné CSS adminu.
const common = { bundle: true, minify: true, target: 'es2018', logLevel: 'warning' };
await esbuild.build({
  ...common,
  entryPoints: { site: 'src/js/site.js', admin: 'src/js/admin/index.js' },
  outdir: path.join(DIST, 'assets/js'),
  format: 'iife',
  absWorkingDir: ROOT
});
// Knihovna třetí strany s globální funkcí qrcode() — jen minifikace.
await esbuild.build({ ...common, bundle: false, entryPoints: ['src/js/vendor/qrcode.js'], outfile: path.join(DIST, 'assets/js/qrcode.js'), absWorkingDir: ROOT });
await esbuild.build({ ...common, entryPoints: ['src/css/admin.css'], outfile: path.join(DIST, 'assets/css/admin.css'), absWorkingDir: ROOT });

const pagesDir = path.join(SRC, 'pages');
for (const file of walk(pagesDir)) {
  write(path.relative(pagesDir, file), render(fs.readFileSync(file, 'utf8')));
}
for (const p of products) {
  write(`produkty/${p.id}.html`, renderProductPage(p));
}
write('sitemap.xml', sitemap());

console.log(`dist/ sestaveno: ${walk(DIST).length} souborů`);
