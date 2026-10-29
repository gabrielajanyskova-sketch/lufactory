# lufactory.cz — e-shop

Ručně vyráběné houbičky z lufy — statický web sestavovaný jednoduchým buildem
(Node + esbuild, bez frameworku) a nasazovaný na Cloudflare Pages, s Cloudflare
Workerem (`worker/`) jako backendem pro objednávky, sklad a administraci.

## Rychlý start

```bash
npm ci            # jednou po naklonování
npm run build     # sestaví web ze src/ do dist/
npm run check     # zkontroluje dist/ (meta údaje, odkazy, JSON-LD, HTML, …)
npm run serve     # náhled dist/ na http://localhost:8080 (chová se jako Pages)
```

`dist/` je generovaný výstup — needituje se a není v gitu.

## Struktura

```
src/
  pages/              stránky (index, produkty, kosik, obchodni-podminky, …, produkty/produkt)
  templates/product.html   šablona stránky produktu (generuje se pro každý produkt z dat)
  partials/           opakované bloky: head, header, footer, cart-panel, product-card
  data/products.json  6 produktů: názvy, ceny, popisy, fotky, karty, „mohlo by se líbit“
  data/site.json      údaje o firmě (název, IČO, adresa) pro schema.org
  css/style.css       styly webu (vkládají se do každé stránky jako <style>)
  css/admin.css       styly jen pro administraci
  js/                 JavaScript po modulech (cart/, forms/, ui/, reviews/, pages/, admin/)
  js/config.js        jediné místo pro adresu API, ceny dopravy, IBAN, ID produktů
  public/             kopíruje se beze změny: obrázky, písma, robots.txt, llms.txt, _headers
scripts/
  build.mjs           sestavení (partials, generované stránky, sitemap, schema, bundly)
  schema.mjs          strukturovaná data (OnlineStore, Product, FAQPage, BreadcrumbList, …)
  check.mjs           kontrola výstupu
  serve.mjs           lokální náhled
worker/               Cloudflare Worker + D1 + KV — objednávky, sklad, admin API
.github/workflows/    automatický build + kontrola při každém pushi
```

### Jak to skládá build

Ve stránkách jsou direktivy na samostatném řádku:

| Direktiva | Co udělá |
|---|---|
| `<!-- @include header -->` | vloží `src/partials/header.html` (`header home` = varianta pro hlavní stránku) |
| `<!-- @inline-css style.css -->` | vloží `src/css/style.css` jako `<style>` |
| `<!-- @card peeling featured -->` | karta produktu z `products.json` (`featured` = zvýrazněná) |
| `<!-- @schema organization -->` | JSON-LD (`organization`, `faq`, `product-list`, `product ID`, `breadcrumbs ID`) |

FAQ schema se skládá z viditelných otázek (`.faq-item`) na stránce, takže se
nemůže rozejít s textem. Odkazy na `/assets/js/*.js` a `/assets/css/*.css` build
přepíše na verze s hashem v názvu (dlouhá cache v prohlížeči).

## Běžné úpravy

- **Text nebo layout stránky** — `src/pages/<stránka>.html`.
- **Hlavička, patička, menu, košík** — `src/partials/`, změna platí pro všechny stránky.
- **Produkt (text, fotky, cena na stránce)** — `src/data/products.json`; stránka
  `produkty/<id>`, karty i sitemapa se vygenerují samy. Nový statický produkt
  přidej i do `STATIC_PRODUCT_IDS` v `src/js/config.js` a ve workeru (kontrola to hlídá).
- **Nová stránka** — nový soubor v `src/pages/` (vzor: `obchodni-podminky.html`);
  indexovatelné stránky doplň do `sitemap()` v `scripts/build.mjs`.
- **Styly** — `src/css/style.css`.
- **Cena dopravy** — `src/js/config.js` **i** `SHIPPING` ve `worker/src/index.js`.
- **Sklad, ceny, slevy, objednávky, recenze, nové produkty** — přes `/admin`
  (zaheslované), viz `worker/README.md`. Produkty přidané v adminu dostanou
  stránku `produkty/produkt?id=...` bez úpravy kódu.

Před commitem: `npm run build && npm run check`. Totéž běží automaticky na
GitHubu (Actions) u každého pushe.

## Nasazení

- **Web (Cloudflare Pages)** — připojené na tento repozitář, nasazuje se při
  pushi do `main`. Nastavení projektu (Workers & Pages → lufactory → Settings →
  Builds): **Build command `npm run build`, Build output directory `dist`**.
- **Worker** — nasazuje se ručně vložením `worker/src/index.js` v dashboardu,
  viz `worker/README.md`.

### Hlavičky a CSP (`src/public/_headers`)

HSTS, X-Frame-Options, Permissions-Policy a Content-Security-Policy (skripty jen
z vlastní domény). Na `/kosik` je plná politika zatím jen `Report-Only`, protože
widgety Zásilkovny a PPL načítají vlastní zdroje: po ověření výběru pobočky
v provozu (konzole prohlížeče bez hlášek „Content-Security-Policy“) lze řádek
`Content-Security-Policy-Report-Only` přejmenovat na `Content-Security-Policy`.
Při přidání nové externí služby (analytika, video, …) je potřeba ji v CSP povolit.

## Košík a objednávka

Košík je v `localStorage`; zboží není rezervované, množství se vždy porovnává
s aktuálním skladem z API. Objednávka jde přes worker (ceny, sklad a slevy
ověřené server-side, D1, e-mail přes Resend); při nedostupnosti workeru web
nabídne odeslání e-mailem (mailto).

## Soukromí

Písma jsou hostovaná na vlastní doméně, mapa Google se načte až po kliknutí,
web nepoužívá cookies ani analytiku — cookie lišta proto není potřeba.

## Další kroky / nápady

- Platební brána (Comgate/GoPay) — zatím převod s QR kódem / hotově
- Sledování objednávky pro zákazníka
- Automatická záloha databáze objednávek
