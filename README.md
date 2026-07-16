# lufactory.cz — statický web

Eshop pro lufactory (ručně vyráběné houbičky z lufy), postavený stejně jako
flammel.cz — čisté HTML/CSS/JS bez frameworku, nasazované na Cloudflare Pages
přímo z tohoto repozitáře.

## Struktura

```
index.html              hlavní stránka (hero, produkty, o mně, o houbičkách, kontakt)
produkty.html            plný katalog všech 6 produktů
produkty/*.html          detail každého produktu (vlastní URL, vlastní popis)
kosik.html               košík, doprava, platba, fakturační údaje, odeslání
obchodni-podminky.html   obchodní podmínky
ochrana-osobnich-udaju.html   zásady zpracování osobních údajů (GDPR)
assets/css/style.css    veškeré styly (design tokeny v :root)
assets/js/main.js       mobilní menu + odesílání kontaktního formuláře (mailto)
assets/js/cart.js       košík na localStorage, checkout, sklad, volitelně
                         napojený na worker/ (viz worker/README.md); bez něj
                         vše dál funguje na mailto a "Není skladem"
assets/img/             obrázky — většina jsou reálné fotky; houbička "velká"
                         zatím nemá fotku, používá texturový placeholder
worker/                 Cloudflare Worker + D1 pro produkty, sklad, slevové
                         kódy a objednávky — viz worker/README.md pro nasazení
robots.txt, sitemap.xml, llms.txt   SEO/AI crawler soubory
```

## Sklad

Tlačítko „Přidat do košíku" je u všech produktů schválně needaktivní a
zobrazuje se „Není skladem", dokud v D1 databázi nenastavíš skutečný počet
kusů (`worker/README.md` → „Nastavení skladu") — a to funguje až po nasazení
workeru. Bez workeru web zůstává v tomhle bezpečném výchozím stavu natrvalo.

## Košík a objednávka

`assets/js/cart.js` drží obsah košíku v `localStorage` (přežije reload i
zavření prohlížeče). Tlačítko „Přidat do košíku" u produktu otevře postranní
panel s mezisoučtem; „Pokračovat do košíku" vede na `kosik.html`, kde se vybírá
doprava (osobní odběr / Zásilkovna), platba (převod / hotově při odběru),
vyplní fakturační údaje a uplatní slevový kód — cena se přepočítává živě.
Odeslání objednávky je podmíněné odsouhlasením obchodních podmínek
(zaškrtávátko u tlačítka „Odeslat objednávku").

Bez nasazeného workeru (`worker/`) se objednávka odešle přes mailto, stejně
jako dosud. Po nasazení (`worker/README.md`) a vyplnění `API_BASE` v
`cart.js` se objednávky ukládají do D1, ceny a slevové kódy se ověřují
server-side a zákazníkovi i tobě přijde e-mailové potvrzení přes Resend — a
pokud by worker někdy nebyl dostupný, web se sám přepne zpátky na mailto.

## Nasazení

Stejně jako u flammel.cz: repo se připojí na Cloudflare Pages (dashboard →
Workers & Pages → Create → Pages → Connect to Git), build command prázdný,
output directory `/` (kořen repa) — je to čistě statický web, žádný build
krok není potřeba.

## Další kroky

- Nasadit `worker/` podle `worker/README.md` (pár příkazů ve wrangleru),
  vyplnit `API_BASE` v `assets/js/cart.js` a nastavit skutečné počty kusů
  na skladě — bez toho nejde nic objednat
- Fotka pro „velká" houbičku zatím chybí (texturový placeholder na
  `produkty.html` i na `produkty/houbicka-velka.html`)
- Platby zatím řešené ručně (převod / hotově) — platební bránu (GoPay/Comgate)
  napojit později, až bude potřeba

