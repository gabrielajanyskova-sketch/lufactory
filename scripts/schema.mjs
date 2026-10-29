// Strukturovaná data (schema.org JSON-LD) generovaná z dat webu, aby se
// nemohla rozejít s viditelným obsahem. Používá scripts/build.mjs.
import { SHIPPING } from '../src/js/config.js';

const ldScript = (data, attrs = '') =>
  `<script type="application/ld+json"${attrs}>\n${JSON.stringify(data, null, 2)}\n</script>`;

export function createSchemas(site, productUrl) {
  const ORG_ID = `${site.url}/#organization`;
  const WEBSITE_ID = `${site.url}/#website`;
  const abs = (path) => site.url + path;

  function organization() {
    const s = site.seller;
    return ldScript({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'OnlineStore',
          '@id': ORG_ID,
          name: site.name,
          legalName: s.name,
          url: `${site.url}/`,
          email: site.email,
          logo: abs(site.logo),
          description: site.description,
          sameAs: site.sameAs,
          identifier: { '@type': 'PropertyValue', propertyID: 'IČO', value: s.ico },
          address: {
            '@type': 'PostalAddress',
            streetAddress: s.streetAddress,
            addressLocality: s.addressLocality,
            postalCode: s.postalCode,
            addressCountry: s.addressCountry
          }
        },
        {
          '@type': 'WebSite',
          '@id': WEBSITE_ID,
          url: `${site.url}/`,
          name: site.name,
          inLanguage: 'cs',
          publisher: { '@id': ORG_ID }
        }
      ]
    });
  }

  // Placené způsoby dopravy z src/js/config.js (osobní odběr není doprava).
  const shippingDetails = Object.values(SHIPPING)
    .filter((s) => s.price > 0)
    .map((s) => ({
      '@type': 'OfferShippingDetails',
      shippingLabel: s.label,
      shippingRate: { '@type': 'MonetaryAmount', value: s.price, currency: 'CZK' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'CZ' }
    }));

  const returnPolicy = {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'CZ',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: site.returnDays,
    returnMethod: 'https://schema.org/ReturnByMail'
  };

  function product(p) {
    const url = abs(productUrl(p));
    return ldScript({
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': `${url}#product`,
      name: p.name,
      description: p.schemaDescription,
      image: abs(p.image),
      sku: p.id,
      brand: { '@type': 'Brand', name: site.name },
      offers: {
        '@type': 'Offer',
        url,
        priceCurrency: 'CZK',
        price: String(p.price),
        // Výchozí stav pro roboty bez JavaScriptu; cart/stock.js ho přepíše podle živého skladu.
        availability: 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
        seller: { '@id': ORG_ID },
        shippingDetails,
        hasMerchantReturnPolicy: returnPolicy
      }
    }, ` data-product-schema="${p.id}"`);
  }

  // Odpovídá viditelné cestě "← Zpět na produkty".
  function breadcrumbs(p) {
    return ldScript({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Domů', item: `${site.url}/` },
        { '@type': 'ListItem', position: 2, name: 'Produkty', item: abs('/produkty') },
        { '@type': 'ListItem', position: 3, name: p.h1, item: abs(productUrl(p)) }
      ]
    });
  }

  function productList(products) {
    return ldScript({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: products.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: abs(productUrl(p)),
        name: p.name
      }))
    });
  }

  // FAQ přímo z viditelných otázek (.faq-item s <h3> a <p>) ve stejné stránce.
  function faq(html) {
    const text = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const items = [...html.matchAll(/<div class="faq-item">\s*<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/g)];
    if (!items.length) throw new Error('@schema faq: na stránce nejsou žádné .faq-item');
    return ldScript({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map(([, q, a]) => ({
        '@type': 'Question',
        name: text(q),
        acceptedAnswer: { '@type': 'Answer', text: text(a) }
      }))
    });
  }

  return { organization, product, breadcrumbs, productList, faq };
}
