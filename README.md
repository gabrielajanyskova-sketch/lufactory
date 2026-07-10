# lufactory.cz — statický web

Landing page pro lufactory (ručně vyráběné houbičky z lufy), postavená stejně
jako flammel.cz — čisté HTML/CSS/JS bez frameworku, nasazované na Cloudflare
Pages přímo z tohoto repozitáře.

## Struktura

```
index.html              landing page
assets/css/style.css    veškeré styly (design tokeny v :root)
assets/js/main.js       mobilní menu
assets/img/             obrázky (zatím jen texturové placeholdery, viz níže)
robots.txt, sitemap.xml, llms.txt   SEO/AI crawler soubory
```

## Co je zatím jen placeholder

Obsah vychází ze screenshotů současného webu na Webnode (velikosti houbiček,
texty o výrobě, kontaktní e-mail info@lufactory.cz). Skutečné fotky produktů
zatím nejsou k dispozici, takže `.img-placeholder` a `.hero` používají
generovanou texturu (`assets/img/loofah-texture.svg`) místo reálných fotek —
až budou fotky k dispozici, stačí je nahrát do `assets/img/` a nahradit
`background`/`src` v `index.html` a `style.css`.

## Nasazení

Stejně jako u flammel.cz: repo se připojí na Cloudflare Pages (dashboard →
Workers & Pages → Create → Pages → Connect to Git), build command prázdný,
output directory `/` (kořen repa) — je to čistě statický web, žádný build
krok není potřeba.

## Další kroky (až budeme řešit plnohodnotný eshop)

Tahle fáze řeší jen landing page. Až budeme přidávat produkty, košík a
objednávky, navážeme na stejný vzor jako u flammel.cz:

- `produkty.html` / `produkt/*.html` — katalog a detail produktů
- `assets/js/cart.js` — košík na `localStorage`
- `worker/` — Cloudflare Worker + D1 pro uložení objednávek, e-mailové
  potvrzení přes Resend a živý stav skladu
- platby řešit přes platební bránu (GoPay/Comgate) nebo zatím jen ruční
  vyřízení objednávky e-mailem, podle toho, co bude potřeba
