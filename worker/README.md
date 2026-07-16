# lufactory-api — Cloudflare Worker

Backend pro košík: skutečné ceny a slevové kódy z D1 databáze (`lufactory-orders`),
ukládání objednávek a e-mailové potvrzení přes Resend. Postavené stejně jako
`flammel-api` u flammel.cz.

Dokud tenhle worker není nasazený, web funguje úplně normálně dál — jen
objednávka jde přes mailto (otevře se e-mailový klient), tak jak je to nastavené
teď. Po nasazení stačí vyplnit `API_BASE` v `assets/js/cart.js` a web
automaticky přejde na živé objednávky přes tenhle worker.

## Co je potřeba předem

- Nainstalovaný Node.js
- Cloudflare účet (stejný, na kterém běží flammel-api)
- V [Resend](https://resend.com) buď ověřená doména `lufactory.cz` pro odesílání
  e-mailů, nebo dočasně jinou adresu v `wrangler.toml` (`MAIL_FROM`), dokud
  doménu neověříš

## Nasazení

```bash
cd worker
npx wrangler login          # přihlášení k Cloudflare účtu (otevře prohlížeč)
npx wrangler secret put RESEND_API_KEY   # vloží se tvůj Resend API klíč
npx wrangler deploy
```

Po doběhnutí `wrangler deploy` se vypíše URL workeru, něco jako:

```
https://lufactory-api.<tvuj-subdomain>.workers.dev
```

## Propojení s webem

Otevři `assets/js/cart.js`, úplně nahoře najdi:

```js
var API_BASE = '';
```

a vlož tam tu URL z předchozího kroku, např.:

```js
var API_BASE = 'https://lufactory-api.<tvuj-subdomain>.workers.dev';
```

Ulož, commitni a pushni — od teď košík posílá objednávky přes worker (skutečné
ceny z databáze, uložení do D1, potvrzovací e-mail tobě i zákazníkovi). Pokud by
worker z nějakého důvodu nebyl dostupný, web se sám přepne zpátky na mailto, takže
se nic nikdy „nerozbije".

## Databáze

Tabulky v `lufactory-orders`:

- `products` — `product_id`, `title`, `price`, `stock_qty` (zdroj pravdy pro
  ceny a dostupnost při objednávce, web si je stejně zobrazuje ze statického
  HTML)
- `discount_codes` — `code`, `type` (`percent`/`fixed`), `value`, `active`
- `orders` — uložené objednávky včetně fakturační adresy (`customer_name`,
  `customer_street`, `customer_zip`, `customer_city`, `customer_email`,
  `customer_phone`)
- `order_items` — položky jednotlivých objednávek

### Nastavení skladu (důležité!)

Všech 6 produktů má `stock_qty` výchozí 0, takže na webu je zatím u všech
„Není skladem" a tlačítko „Přidat do košíku" je neaktivní — dokud nenastavíš
skutečné počty kusů, nejde nic objednat (schválně, ať se nic neobjedná dřív,
než budeš mít reálné zásoby). Jakmile budeš mít houbičky připravené k prodeji:

```bash
npx wrangler d1 execute lufactory-orders --remote --command \
  "UPDATE products SET stock_qty = 12 WHERE product_id = 'houbicka-mala'"
```

Tohle funguje ale jen po nasazení workeru (viz výše) — teprve pak web čte
sklad přes `GET /api/products`. Při každé objednávce se sklad automaticky
sníží o objednané množství; když někdo objedná víc, než je skladem, worker
objednávku odmítne (`insufficient_stock`).

### Přidání/úprava slevového kódu

```bash
npx wrangler d1 execute lufactory-orders --remote --command \
  "INSERT INTO discount_codes (code, type, value, active) VALUES ('ZIMA50', 'fixed', 50, 1)"
```

Zrušení kódu (bez mazání historie):

```bash
npx wrangler d1 execute lufactory-orders --remote --command \
  "UPDATE discount_codes SET active = 0 WHERE code = 'LETO10'"
```

### Úprava ceny produktu

```bash
npx wrangler d1 execute lufactory-orders --remote --command \
  "UPDATE products SET price = 130 WHERE product_id = 'houbicka-mala'"
```

Cenu je pak potřeba ručně upravit i v HTML (`produkty.html`, `index.html`) a v
`assets/js/cart.js`, protože zobrazení produktů zatím čte z hodnot v HTML, ne
z databáze — databáze slouží jako pojistka, že se při objednávce vždy použije
skutečná aktuální cena, ne ta, kterou by šlo upravit v prohlížeči.

## Zobrazení objednávek

```bash
npx wrangler d1 execute lufactory-orders --remote --command \
  "SELECT order_number, status, customer_name, total, created_at FROM orders ORDER BY created_at DESC LIMIT 20"
```
