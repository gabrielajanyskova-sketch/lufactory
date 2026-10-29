// Jediné místo pro nastavení, které sdílí celý web. Worker má vlastní kopii
// SHIPPING, BANK_IBAN a STATIC_PRODUCT_IDS (nasazuje se zvlášť) — shodu
// hlídá `npm run check`.

// Adresa nasazeného workeru (worker/README.md).
export const API_BASE = 'https://lufactory-api.gabriela-janyskova.workers.dev';

// Zobrazovací kopie cen dopravy — worker cenu znovu ověřuje server-side.
export const SHIPPING = {
  pickup: { label: 'Osobní odběr (Nová Ves u Prahy / Praha 8, Čimice)', price: 0 },
  'zasilkovna-pickup': { label: 'Zásilkovna – výdejní místo', price: 89 },
  'zasilkovna-address': { label: 'Zásilkovna – doručení na adresu', price: 129 },
  'ppl-pickup': { label: 'PPL – výdejní místo', price: 76 },
  'ppl-address': { label: 'PPL – doručení na adresu', price: 106 }
};

// Volby dopravy, u kterých se ptáme na název výdejního místa (na rozdíl od
// doručení na adresu, kde stačí fakturační adresa už vyplněná výše).
export const PICKUP_POINT_SHIPPING = { 'zasilkovna-pickup': true, 'ppl-pickup': true };

// Veřejný API klíč pro widget výdejních míst Zásilkovny (client.packeta.com
// → Informace o uživateli → Odesílatelé) — jen pro výběr pobočky, ne pro
// podávání zásilek.
export const PACKETA_API_KEY = 'd82f0286ea33546e';

// Účet pro QR platbu na stránce "Objednávka odeslána" — IBAN spočítaný
// z 211573669/0300. Když se změní číslo účtu, přepočti IBAN znovu.
export const BANK_IBAN = 'CZ6503000000000211573669';

// Šest původních produktů má vlastní stránku generovanou ze
// src/data/products.json, zbytek žije jen v databázi a používá generickou
// šablonu — viz worker/README.md.
export const STATIC_PRODUCT_IDS = ['houbicka-mala', 'houbicka-stredni', 'houbicka-velka', 'houbicka-mix', 'peeling', 'cela-lufa'];

export function productUrl(productId) {
  return STATIC_PRODUCT_IDS.indexOf(productId) !== -1
    ? '/produkty/' + productId
    : '/produkty/produkt?id=' + encodeURIComponent(productId);
}
