# lufactory.cz — statický web

Eshop pro lufactory (ručně vyráběné houbičky z lufy), postavený stejně jako
flammel.cz — čisté HTML/CSS/JS bez frameworku, nasazované na Cloudflare Pages
přímo z tohoto repozitáře.

## Struktura

```
index.html              hlavní stránka (hero, produkty, o mně, o houbičkách, kontakt)
produkty.html            plný katalog všech 6 produktů
kosik.html               košík, doprava, platba, fakturační údaje, odeslání
assets/css/style.css    veškeré styly (design tokeny v :root)
assets/js/main.js       mobilní menu + odesílání kontaktního formuláře (mailto)
assets/js/cart.js       košík na localStorage, checkout, volitelně napojený
                         na worker/ (viz worker/README.md); bez něj vše dál
                         funguje na mailto
assets/img/             obrázky — logo.webp, hero.webp, luffa-plant.webp jsou
                         reálné fotky, .img-placeholder bloky jsou zatím
                         texturové placeholdery (viz níže)
worker/                 Cloudflare Worker + D1 pro produkty, slevové kódy
                         a objednávky — viz worker/README.md pro nasazení
robots.txt, sitemap.xml, llms.txt   SEO/AI crawler soubory
```

## Co je zatím jen placeholder

Fotky vlastní výroby (sekce „O mně") zatím nejsou k dispozici, takže tam
`.img-placeholder` používá generovanou texturu (`assets/img/loofah-texture.svg`)
místo reálné fotky — až bude fotka k dispozici, stačí ji nahrát do
`assets/img/` a nahradit `.img-placeholder` `<img>` tagem stejně jako u
ostatních fotek.

## Košík a objednávka

`assets/js/cart.js` drží obsah košíku v `localStorage` (přežije reload i
zavření prohlížeče). Tlačítko „Přidat do košíku" u produktu otevře postranní
panel s mezisoučtem; „Pokračovat do košíku" vede na `kosik.html`, kde se vybírá
doprava (osobní odběr / Zásilkovna), platba (převod / hotově při odběru),
vyplní fakturační údaje a uplatní slevový kód — cena se přepočítává živě.

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

- Nasadit `worker/` podle `worker/README.md` (pár příkazů ve wrangleru) a
  vyplnit `API_BASE` v `assets/js/cart.js`
- Fotka pro „velká" houbičku na `produkty.html` zatím chybí (texturový
  placeholder)
- Platby zatím řešené ručně (převod / hotově) — platební bránu (GoPay/Comgate)
  napojit později, až bude potřeba

