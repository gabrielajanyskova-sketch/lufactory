# lufactory-api — Cloudflare Worker

Backend pro celý e-shop: skutečné ceny/sklad/slevové kódy z D1 databáze
(`lufactory-orders`), ukládání objednávek, e-mailová potvrzení a faktury přes
Resend, fotky produktů ve Workers KV, a admin API pro `/admin.html`.

Dokud tenhle worker neběží (nebo je nedostupný), web funguje dál na mailto —
tlačítko "Odeslat objednávku" otevře e-mailový klient místo živého API, takže
se nic nikdy „nerozbije".

## Nasazení

Tenhle worker se **nedeployuje přes `wrangler deploy`** — nasazuje se ručně
vložením `src/index.js` do Cloudflare dashboardu:

1. **Cloudflare dashboard → Workers & Pages → lufactory-api → Edit code**
2. Označit celý obsah editoru a nahradit obsahem `src/index.js`
3. **Save and deploy**
4. V **Deployments** zkontrolovat, že se nová verze skutečně dostala na
   100 % provozu (přidání proměnné/secretu přes Settings občas jen vytvoří
   novou verzi, aniž by ji nasadilo — je potřeba ji ručně "Deploy")

Bindings a proměnné (Settings → Bindings / Variables and Secrets), viz
`wrangler.toml` pro přesné názvy:

- D1 databáze `lufactory-orders` → binding `DB`
- KV namespace `lufactory-product-images` → binding `IMAGES`
- Text proměnné `MAIL_FROM`, `SHOP_NOTIFICATION_EMAIL`
- Secrety `RESEND_API_KEY`, `ADMIN_PASSWORD`, volitelně `CF_API_TOKEN`
  (PDF faktury — bez něj se posílá faktura jako HTML příloha), volitelně
  `PACKETA_API_PASSWORD` (vytvoření zásilky a štítku na Zásilkovně — bez
  něj se štítky negenerují, nic jiného to neovlivní)

## Propojení s webem

`API_BASE` v `assets/js/cart.js`, `assets/js/main.js`, `admin.html`,
`produkty/produkt.html` a `recenze.html` musí ukazovat na URL tohohle
workeru (`https://lufactory-api.<subdomain>.workers.dev`). Musí sedět na
všech pěti místech současně.

## Databáze (`lufactory-orders`)

- **`products`** — `product_id`, `title`, `price`, `stock_qty`, `description`
  (celý popis na stránce produktu), `teaser` (jedna věta na kartičce v
  přehledu), `image_url` (hlavní fotka), `gallery_urls` (JSON pole dalších
  fotek)
- **`discount_codes`** — `code`, `type` (`percent`/`fixed`), `value`, `active`
- **`shipping_settings`** — jeden řádek (`id = 1`) s `active` a `threshold`:
  doprava zdarma nad danou částkou, nastavuje se v adminu (záložka
  "Slevové kódy")
- **`orders`** — objednávky včetně fakturační adresy a `variable_symbol`;
  `pickup_point_id` je číselné ID pobočky Zásilkovny/PPL z widgetu (na rozdíl
  od `delivery_detail`, což je jen adresa jako text pro zobrazení)
- **`order_items`** — položky jednotlivých objednávek
- **`withdrawal_requests`** — oznámení o odstoupení od smlouvy z formuláře na
  `obchodni-podminky.html` (jméno, e-mail, adresa, zboží, volitelně číslo
  objednávky a datum obdržení) — ukládá se vždy, i kdyby e-mail selhal
- **`reviews`** — hodnocení produktů (`product_id`, `order_id`, jméno,
  `rating` 1–5, `comment`, `status` — `pending`/`approved`/`hidden`)
- `orders.review_token` a `orders.review_submitted_at` — jednorázový token
  pro odkaz na `recenze.html`, vygeneruje se při nastavení stavu objednávky
  na "Vyřízeno" a pošle se zákazníkovi e-mailem
- **`stock_notifications`** — e-maily lidí, kteří chtějí vědět, až bude
  vyprodaný produkt zase skladem (`product_id`, `email`, `notified`) — pošle
  se automaticky, jakmile se v adminu zvýší sklad z 0 na víc

U 6 původních ručně napsaných produktů (houbičky, peeling, celá lufa) zůstává
zdroj pravdy pro vzhled/text jejich **vlastní stránky** v HTML
(`produkty/*.html`) — databáze u nich slouží hlavně pro cenu/sklad/slevy a pro
zobrazení v adminu. Nové produkty přidané přes `/admin.html` žijí čistě v
databázi a dostávají generickou stránku `produkty/produkt.html?id=...`.

## Správa přes `/admin.html`

Veškerá běžná správa (ceny, sklad, fotky, popisky, slevové kódy, stav
objednávek, faktury, export do CSV) se dělá přes `/admin.html`, ne přes ruční
SQL příkazy. Přihlašovací heslo je secret `ADMIN_PASSWORD`.

Přímý SQL zásah do databáze (např. hromadná úprava) jde udělat přes Cloudflare
dashboard → D1 → `lufactory-orders` → Console, nebo `wrangler d1 execute`,
pokud máš wrangler funkční lokálně.

## Nízký sklad a faktury

Když po objednávce klesne sklad produktu na 2 ks nebo míň, přijde e-mail na
`SHOP_NOTIFICATION_EMAIL`. Nastavením stavu objednávky na "Odesláno" v adminu
se zákazníkovi automaticky pošle faktura (PDF, pokud je nastavený
`CF_API_TOKEN`, jinak HTML příloha).

## Zásilkovna — automatický štítek

Když se objednávka s dopravou Zásilkovnou (`zasilkovna-pickup` nebo
`zasilkovna-address`) nastaví v adminu na "Zaplaceno", worker sám vytvoří
zásilku přes Packeta API (`orders.packeta_id`, `orders.packeta_barcode`) —
u výdejního místa se použije `pickup_point_id` uložené z widgetu v košíku,
u doručení na adresu fakturační adresa zákazníka. Zásilka se vytvoří jen
jednou (podle `packeta_id`), i kdyby se stav "Zaplaceno" nastavil vícekrát.

V adminu se pak u objednávky objeví tlačítko **Štítek** — stáhne PDF štítek
přímo od Zásilkovny. Váha balíčku je zatím pevná (`PACKETA_DEFAULT_WEIGHT_KG`
ve `worker/src/index.js`), dá se upravit podle skutečnosti. PPL zásilky se
zatím vytváří ručně, tahle automatizace řeší jen Zásilkovnu.

## Recenze

Nastavením stavu objednávky na "Vyřízeno" se zákazníkovi pošle e-mail s
odkazem na `recenze.html?token=...`, kde může ohodnotit každý koupený
produkt hvězdičkami a napsat komentář. Recenze čekají v adminu (záložka
"Recenze") na schválení, než se zobrazí veřejně na stránce produktu — teprve
schválené se počítají do průměrného hodnocení a do schema.org
`AggregateRating`.
