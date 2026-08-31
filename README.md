# lufactory.cz — e-shop

Ručně vyráběné houbičky z lufy — statický web (HTML/CSS/JS, bez frameworku)
nasazovaný na Cloudflare Pages přímo z tohoto repozitáře, s Cloudflare
Workerem (`worker/`) jako backendem pro objednávky, sklad a administraci.

Doména `lufactory.cz` běží přes Cloudflare (nameservery, DNS, Pages i
Worker na stejném účtu).

## Struktura

```
index.html                    hlavní stránka (hero, produkty, o mně, o houbičkách, kontakt)
produkty.html                  plný katalog — 6 ručně napsaných produktů + cokoliv přidané v adminu
produkty/*.html                vlastní stránka pro každý z 6 původních produktů
produkty/produkt.html          generická stránka pro produkty přidané přes admin (?id=...)
kosik.html                     košík, doprava, platba, fakturační údaje, odeslání
recenze.html                   hodnocení objednávky zákazníkem (odkaz z e-mailu, ?token=...)
admin.html                     administrace — objednávky, produkty/sklad/fotky, slevové kódy, recenze
obchodni-podminky.html         obchodní podmínky, formulář pro odstoupení od smlouvy
ochrana-osobnich-udaju.html    zásady zpracování osobních údajů (GDPR)
assets/css/style.css           zdroj pravdy pro styly (design tokeny v :root) — do
                                HTML stránek se vkládá přímo (viz "Úprava CSS" níže)
assets/js/main.js              mobilní menu, kontaktní formulář, lightbox pro galerie
assets/js/cart.js              košík, checkout, živý sklad, napojení na worker/api
assets/js/qrcode.js            knihovna třetí strany pro QR platbu v košíku
assets/img/                    fotky produktů a webu
worker/                        Cloudflare Worker + D1 + KV — objednávky, sklad, admin API
scripts/inline-css.py          viz "Úprava CSS" níže
robots.txt, sitemap.xml, llms.txt   SEO/AI crawler soubory
```

## Úprava CSS

Kvůli rychlosti načítání (žádný samostatný požadavek na CSS navíc) je obsah
`assets/css/style.css` vložený přímo do `<style>` v každé HTML stránce, ne
jen odkazovaný přes `<link>`. `style.css` zůstává zdroj pravdy — po každé
úpravě spusť:

```bash
python3 scripts/inline-css.py
```

To přepíše `<style>` blok ve všech HTML stránkách podle aktuálního obsahu
`style.css`. Bez spuštění skriptu se úprava CSS v HTML stránkách neprojeví.

## Sklad, ceny, produkty, slevy, objednávky

Všechno se spravuje přes **`/admin.html`** (zaheslované, heslo je secret
`ADMIN_PASSWORD` na workeru) — žádné ruční SQL příkazy nejsou potřeba pro
běžný provoz:

- **Objednávky** — přehled, změna stavu (posílá e-mail zákazníkovi, u
  "Odesláno" i fakturu), smazání, export do CSV, odkaz na fakturu
- **Produkty a sklad** — cena, počet kusů, popis, fotka (hlavní i galerie),
  přidání nového produktu
- **Slevové kódy** — přidání, aktivace/deaktivace, smazání

Nový produkt přidaný v adminu se automaticky objeví v `produkty.html` a
dostane vlastní stránku (`produkty/produkt.html?id=...`) — beze změny kódu.
Šest původních produktů má svou vlastní ručně psanou stránku s galerií a
zůstává tak i nadále (bohatší obsah, než umí generická šablona).

Dokud u produktu není žádný kus skladem, tlačítko „Přidat do košíku" je
neaktivní a zobrazuje se „Není skladem" — bezpečný výchozí stav.

## Košík a objednávka

`assets/js/cart.js` drží obsah košíku v `localStorage`. Při checkoutu se
sklad ověřuje živě proti API — pokud mezitím někdo koupí poslední kus, košík
to zahlásí a neumožní odeslání, dokud se množství neopraví. Objednávka jde
přes `worker/` (skutečné ceny, sklad a slevy ověřené server-side, uložení do
D1, e-mailové potvrzení přes Resend) — pokud by worker byl nedostupný, web se
sám přepne na mailto, takže se nic nikdy „nerozbije".

## Nasazení

- **Web (Pages):** repo je připojené na Cloudflare Pages (Workers & Pages →
  lufactory), nasazuje se automaticky při každém pushi do `main`
- **Worker:** nasazuje se ručně, viz `worker/README.md` — `wrangler deploy`
  z tohohle prostředí nejde (síťové omezení), takže se kód vkládá přímo do
  Cloudflare dashboardu

## Další kroky / nápady

- Platby zatím řešené ručně (bankovní převod s QR kódem / hotově) —
  platební bránu (Comgate/GoPay) napojit později, až bude potřeba
- Sledování objednávky pro zákazníka (zadá číslo objednávky + e-mail, uvidí
  stav) — ať nemusí psát „kde je moje objednávka"
- Automatický export/záloha databáze objednávek
