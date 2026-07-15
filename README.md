# lufactory.cz — statický web

Eshop pro lufactory (ručně vyráběné houbičky z lufy), postavený stejně jako
flammel.cz — čisté HTML/CSS/JS bez frameworku, nasazované na Cloudflare Pages
přímo z tohoto repozitáře.

## Struktura

```
index.html              hlavní stránka (hero, produkty, o mně, o houbičkách, kontakt)
assets/css/style.css    veškeré styly (design tokeny v :root)
assets/js/main.js       mobilní menu + odesílání kontaktního formuláře (mailto)
assets/js/cart.js       košík na localStorage + panel s objednávkou (mailto)
assets/img/             obrázky — logo.webp, hero.webp, luffa-plant.webp jsou
                         reálné fotky, .img-placeholder bloky jsou zatím
                         texturové placeholdery (viz níže)
robots.txt, sitemap.xml, llms.txt   SEO/AI crawler soubory
```

## Co je zatím jen placeholder

Fotky vlastní výroby (sekce „O mně") zatím nejsou k dispozici, takže tam
`.img-placeholder` používá generovanou texturu (`assets/img/loofah-texture.svg`)
místo reálné fotky — až bude fotka k dispozici, stačí ji nahrát do
`assets/img/` a nahradit `.img-placeholder` `<img>` tagem stejně jako u
ostatních fotek.

## Košík

`assets/js/cart.js` drží obsah košíku v `localStorage` (přežije reload i
zavření prohlížeče). Tlačítko „Přidat do košíku" u produktu otevře postranní
panel; tam jde měnit množství, mazat položky a vidět mezisoučet. Tlačítko
„Odeslat objednávku e-mailem" zatím otevře e-mailového klienta s vypsanou
objednávkou — platba a potvrzení se řeší ručně, dokud nebude napojený backend.

## Nasazení

Stejně jako u flammel.cz: repo se připojí na Cloudflare Pages (dashboard →
Workers & Pages → Create → Pages → Connect to Git), build command prázdný,
output directory `/` (kořen repa) — je to čistě statický web, žádný build
krok není potřeba.

## Další kroky (backend pro objednávky)

Až budeme napojovat D1, navážeme na stejný vzor jako u flammel.cz:

- `worker/` — Cloudflare Worker + D1 pro uložení objednávek ze košíku,
  e-mailové potvrzení přes Resend a živý stav skladu
- `assets/js/cart.js` přepnout z mailto na `fetch` na worker endpoint při
  odeslání objednávky
- platby řešit přes platební bránu (GoPay/Comgate) nebo zatím jen ruční
  vyřízení objednávky, podle toho, co bude potřeba
