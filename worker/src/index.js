const SITE_URL = 'https://www.lufactory.cz';

const BANK_ACCOUNT = '211573669/0300';
// IBAN spočítaný z BANK_ACCOUNT — musí zůstat stejné jako BANK_IBAN v
// assets/js/cart.js. Mění se jen když se změní číslo účtu.
const BANK_IBAN = 'CZ6503000000000211573669';

const SELLER = {
  name: 'Ing. Nikola Drnková',
  ico: '09999035',
  address: 'Na Homoli 484, Nová Ves, 250 63'
};

const CF_ACCOUNT_ID = '452377670fd13e08b76846017d811e7e';

// Worker URL musí zůstat stejné jako API_BASE v assets/js/cart.js a admin.html
// — potřeba pro absolutní adresy fotek vracené z /api/products.
const WORKER_BASE = 'https://lufactory-api.gabriela-janyskova.workers.dev';

// Musí zůstat stejné jako SHIPPING v assets/js/cart.js — tady se cena dopravy
// ověřuje server-side (nikdy se nevěří ceně poslané klientem).
const SHIPPING = {
  pickup: { label: 'Osobní odběr (Nová Ves u Prahy / Praha 8, Čimice)', price: 0 },
  'zasilkovna-pickup': { label: 'Zásilkovna – výdejní místo', price: 89 },
  'zasilkovna-address': { label: 'Zásilkovna – doručení na adresu', price: 129 },
  'ppl-pickup': { label: 'PPL – výdejní místo', price: 76 },
  'ppl-address': { label: 'PPL – doručení na adresu', price: 106 }
};

// Musí zůstat stejné jako STATIC_PRODUCT_IDS v assets/js/main.js — šest
// původních produktů má vlastní stránku, zbytek generickou šablonu.
const STATIC_PRODUCT_IDS = ['houbicka-mala', 'houbicka-stredni', 'houbicka-velka', 'houbicka-mix', 'peeling', 'cela-lufa'];

function productPageUrl(productId) {
  return STATIC_PRODUCT_IDS.includes(productId)
    ? `${SITE_URL}/produkty/${productId}.html`
    : `${SITE_URL}/produkty/produkt.html?id=${encodeURIComponent(productId)}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders();

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    try {
      if (url.pathname === '/api/health' && request.method === 'GET') {
        return json({
          hasResendKey: !!env.RESEND_API_KEY,
          hasMailFrom: !!env.MAIL_FROM,
          hasNotificationEmail: !!env.SHOP_NOTIFICATION_EMAIL,
          hasDb: !!env.DB
        }, 200, cors);
      }
      if (url.pathname === '/api/products' && request.method === 'GET') {
        return await getProducts(env, cors);
      }
      const discountMatch = url.pathname.match(/^\/api\/discount\/([^/]+)$/);
      if (discountMatch && request.method === 'GET') {
        return await getDiscount(env, cors, decodeURIComponent(discountMatch[1]));
      }
      if (url.pathname === '/api/shipping-settings' && request.method === 'GET') {
        return await getShippingSettingsRoute(env, cors);
      }
      if (url.pathname === '/api/admin/shipping-settings' && request.method === 'PATCH') {
        if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401, cors);
        return await updateShippingSettings(request, env, cors);
      }
      if (url.pathname === '/api/orders' && request.method === 'POST') {
        return await createOrder(request, env, cors);
      }
      if (url.pathname === '/api/withdrawal' && request.method === 'POST') {
        return await submitWithdrawal(request, env, cors);
      }
      if (url.pathname === '/api/stock-notify' && request.method === 'POST') {
        return await submitStockNotify(request, env, cors);
      }

      const reviewInviteMatch = url.pathname.match(/^\/api\/reviews\/invite\/([^/]+)$/);
      if (reviewInviteMatch && request.method === 'GET') {
        return await getReviewInvite(env, cors, reviewInviteMatch[1]);
      }
      if (url.pathname === '/api/reviews' && request.method === 'POST') {
        return await submitReviews(request, env, cors);
      }
      if (url.pathname === '/api/reviews/latest' && request.method === 'GET') {
        return await getLatestReviews(env, cors);
      }
      const productReviewsMatch = url.pathname.match(/^\/api\/products\/([^/]+)\/reviews$/);
      if (productReviewsMatch && request.method === 'GET') {
        return await getProductReviews(env, cors, decodeURIComponent(productReviewsMatch[1]));
      }
      if (url.pathname === '/api/admin/reviews' && request.method === 'GET') {
        if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401, cors);
        return await listAdminReviews(env, cors);
      }
      const reviewAdminMatch = url.pathname.match(/^\/api\/admin\/reviews\/(\d+)$/);
      if (reviewAdminMatch && request.method === 'PATCH') {
        if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401, cors);
        return await updateReviewStatus(request, env, cors, Number(reviewAdminMatch[1]));
      }
      if (reviewAdminMatch && request.method === 'DELETE') {
        if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401, cors);
        return await deleteReview(env, cors, Number(reviewAdminMatch[1]));
      }

      if (url.pathname === '/api/admin/login' && request.method === 'POST') {
        const body = await request.json();
        const ok = !!env.ADMIN_PASSWORD && body.password === env.ADMIN_PASSWORD;
        return json({ ok }, ok ? 200 : 401, cors);
      }
      if (url.pathname === '/api/admin/orders' && request.method === 'GET') {
        if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401, cors);
        return await listOrders(env, cors);
      }
      if (url.pathname === '/api/admin/orders-export.csv' && request.method === 'GET') {
        if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401, cors);
        return await exportOrdersCsv(env, cors);
      }
      const orderInvoiceMatch = url.pathname.match(/^\/api\/admin\/orders\/(\d+)\/invoice$/);
      if (orderInvoiceMatch && request.method === 'GET') {
        if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401, cors);
        return await getOrderInvoice(env, cors, Number(orderInvoiceMatch[1]));
      }
      const orderStatusMatch = url.pathname.match(/^\/api\/admin\/orders\/(\d+)$/);
      if (orderStatusMatch && request.method === 'PATCH') {
        if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401, cors);
        return await updateOrderStatus(request, env, cors, Number(orderStatusMatch[1]));
      }
      if (orderStatusMatch && request.method === 'DELETE') {
        if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401, cors);
        return await deleteOrder(env, cors, Number(orderStatusMatch[1]));
      }
      if (url.pathname === '/api/admin/products' && request.method === 'POST') {
        if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401, cors);
        return await createProduct(request, env, cors);
      }
      const productMatch = url.pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
      if (productMatch && request.method === 'PATCH') {
        if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401, cors);
        return await updateProduct(request, env, cors, decodeURIComponent(productMatch[1]));
      }
      if (productMatch && request.method === 'DELETE') {
        if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401, cors);
        return await deleteProduct(env, cors, decodeURIComponent(productMatch[1]));
      }
      const imageUploadMatch = url.pathname.match(/^\/api\/admin\/products\/([^/]+)\/image$/);
      if (imageUploadMatch && request.method === 'POST') {
        if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401, cors);
        return await uploadProductImage(request, env, cors, decodeURIComponent(imageUploadMatch[1]));
      }
      const imageServeMatch = url.pathname.match(/^\/api\/images\/(.+)$/);
      if (imageServeMatch && request.method === 'GET') {
        return await serveImage(env, cors, imageServeMatch[1]);
      }

      if (url.pathname === '/api/admin/discounts' && request.method === 'GET') {
        if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401, cors);
        return await listDiscountCodes(env, cors);
      }
      if (url.pathname === '/api/admin/discounts' && request.method === 'POST') {
        if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401, cors);
        return await createDiscountCode(request, env, cors);
      }
      const discountAdminMatch = url.pathname.match(/^\/api\/admin\/discounts\/([^/]+)$/);
      if (discountAdminMatch && request.method === 'PATCH') {
        if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401, cors);
        return await updateDiscountCode(request, env, cors, decodeURIComponent(discountAdminMatch[1]));
      }
      if (discountAdminMatch && request.method === 'DELETE') {
        if (!isAdmin(request, env)) return json({ error: 'unauthorized' }, 401, cors);
        return await deleteDiscountCode(env, cors, decodeURIComponent(discountAdminMatch[1]));
      }

      return json({ error: 'not_found' }, 404, cors);
    } catch (err) {
      return json({ error: 'server_error', message: String((err && err.message) || err) }, 500, cors);
    }
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
  });
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ---------- products ----------

// image_url je buď statická cesta webu (/assets/img/...), plná URL, nebo
// holý klíč nahraný přes admin do KV — ten jediný potřebuje prefix.
function resolveImageUrl(imageUrl) {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('http') || imageUrl.startsWith('/')) return imageUrl;
  return WORKER_BASE + '/api/images/' + imageUrl;
}

function parseGalleryUrls(raw) {
  try {
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

async function getProducts(env, cors) {
  const { results } = await env.DB.prepare(
    'SELECT product_id, title, price, stock_qty, description, teaser, image_url, gallery_urls FROM products'
  ).all();
  const products = {};
  for (const row of results) {
    products[row.product_id] = {
      title: row.title,
      price: row.price,
      stockQty: row.stock_qty,
      description: row.description || '',
      teaser: row.teaser || '',
      imageUrl: resolveImageUrl(row.image_url),
      galleryUrls: parseGalleryUrls(row.gallery_urls).map(resolveImageUrl)
    };
  }
  return json(products, 200, cors);
}

// ---------- discount codes ----------

async function getDiscount(env, cors, code) {
  const row = await env.DB.prepare(
    'SELECT code, type, value FROM discount_codes WHERE code = ? AND active = 1'
  ).bind(code.toUpperCase()).first();
  if (!row) return json({ valid: false }, 200, cors);
  return json({ valid: true, code: row.code, type: row.type, value: row.value }, 200, cors);
}

async function discountAmount(env, code, subtotal) {
  if (!code) return 0;
  const row = await env.DB.prepare(
    'SELECT type, value FROM discount_codes WHERE code = ? AND active = 1'
  ).bind(code.toUpperCase()).first();
  if (!row) return 0;
  if (row.type === 'percent') return Math.round(subtotal * row.value / 100);
  return Math.min(row.value, subtotal);
}

// ---------- doprava zdarma nad částku ----------

async function getShippingSettings(env) {
  const row = await env.DB.prepare('SELECT active, threshold FROM shipping_settings WHERE id = 1').first();
  return row ? { active: !!row.active, threshold: row.threshold } : { active: false, threshold: 0 };
}

async function getShippingSettingsRoute(env, cors) {
  return json(await getShippingSettings(env), 200, cors);
}

async function updateShippingSettings(request, env, cors) {
  const body = await request.json();
  await env.DB.prepare('UPDATE shipping_settings SET active = ?, threshold = ? WHERE id = 1')
    .bind(body.active ? 1 : 0, Math.max(0, Number(body.threshold) || 0)).run();
  return json({ ok: true }, 200, cors);
}

// ---------- orders ----------

// Variabilní symbol musí být čistě číselný a max 10 číslic, takže z čísla
// objednávky (LF-20260831-4952) vezmeme jen datum ve zkráceném tvaru (26 08
// 31) a čtyřmístný kód — dá se tak na první pohled spárovat s objednávkou.
function generateOrderNumber() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const yy = String(d.getFullYear()).slice(-2);
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const rand = Math.floor(1000 + Math.random() * 9000);
  return {
    orderNumber: 'LF-' + d.getFullYear() + mm + dd + '-' + rand,
    variableSymbol: yy + mm + dd + rand
  };
}

async function createOrder(request, env, cors) {
  const body = await request.json();

  if (!body.customer || !body.customer.name || !body.customer.email
    || !body.customer.street || !body.customer.zip || !body.customer.city) {
    return json({ error: 'missing_customer_fields' }, 400, cors);
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return json({ error: 'empty_cart' }, 400, cors);
  }
  if (!body.delivery || !SHIPPING[body.delivery.method]) {
    return json({ error: 'invalid_delivery_method' }, 400, cors);
  }
  if (!body.payment || !body.payment.method) {
    return json({ error: 'missing_payment_method' }, 400, cors);
  }

  // Look up real prices/titles/stock server-side — never trust client-supplied prices.
  const items = [];
  for (const line of body.items) {
    const product = await env.DB.prepare(
      'SELECT product_id, title, price, stock_qty FROM products WHERE product_id = ?'
    ).bind(line.productId).first();
    if (!product) return json({ error: 'unknown_product', productId: line.productId }, 400, cors);
    const qty = Math.max(1, parseInt(line.qty, 10) || 1);
    if (product.stock_qty < qty) {
      return json({ error: 'insufficient_stock', productId: line.productId, available: product.stock_qty }, 409, cors);
    }
    items.push({
      productId: product.product_id,
      title: product.title,
      price: product.price,
      qty,
      remainingStock: product.stock_qty - qty
    });
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const discount = await discountAmount(env, body.discountCode, subtotal);
  const shippingInfo = SHIPPING[body.delivery.method];
  const freeShipping = await getShippingSettings(env);
  const shippingPrice = (freeShipping.active && subtotal >= freeShipping.threshold) ? 0 : shippingInfo.price;
  const shipping = { label: shippingInfo.label, price: shippingPrice };
  const total = Math.max(0, subtotal - discount) + shipping.price;
  const { orderNumber, variableSymbol } = generateOrderNumber();

  const insert = await env.DB.prepare(
    `INSERT INTO orders (order_number, variable_symbol, status, customer_name, customer_email, customer_phone,
       customer_street, customer_zip, customer_city,
       delivery_method, delivery_detail, payment_method, discount_code, note,
       subtotal, discount_amount, shipping_price, total)
     VALUES (?, ?, 'nova', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    orderNumber,
    variableSymbol,
    body.customer.name,
    body.customer.email,
    body.customer.phone || '',
    body.customer.street || '',
    body.customer.zip || '',
    body.customer.city || '',
    body.delivery.method,
    body.delivery.detail || '',
    body.payment.method,
    (body.discountCode || '').toUpperCase() || null,
    body.note || '',
    subtotal,
    discount,
    shipping.price,
    total
  ).run();

  const orderId = insert.meta.last_row_id;
  const itemStmts = items.map((item) =>
    env.DB.prepare(
      'INSERT INTO order_items (order_id, product_id, title, price, qty) VALUES (?, ?, ?, ?, ?)'
    ).bind(orderId, item.productId, item.title, item.price, item.qty)
  );
  const stockStmts = items.map((item) =>
    env.DB.prepare(
      'UPDATE products SET stock_qty = stock_qty - ? WHERE product_id = ? AND stock_qty >= ?'
    ).bind(item.qty, item.productId, item.qty)
  );
  await env.DB.batch(itemStmts.concat(stockStmts));

  if (env.RESEND_API_KEY) {
    // E-mail je jen doprovodný krok — objednávka a sklad jsou už uložené,
    // takže selhání Resendu nesmí shodit odpověď na chybu (klient by pak
    // objednávku zbytečně odeslal znovu přes mailto).
    try {
      await sendOrderEmails(env, { orderNumber, variableSymbol, body, items, subtotal, discount, shipping, total });
    } catch (err) {
      console.error('sendOrderEmails failed', err);
    }

    const lowStockItems = items.filter((item) => item.remainingStock <= LOW_STOCK_THRESHOLD);
    if (lowStockItems.length > 0) {
      try {
        await sendLowStockAlert(env, lowStockItems);
      } catch (err) {
        console.error('sendLowStockAlert failed', err);
      }
    }
  }

  return json({ orderNumber, status: 'nova', subtotal, discountAmount: discount, shippingPrice: shipping.price, total, variableSymbol, paymentMethod: body.payment.method }, 200, cors);
}

// ---------- e-mail ----------

function emailLayout(innerHtml) {
  return `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#faf6ef;font-family:Georgia,'Times New Roman',serif;color:#4a4038;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6ef;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border:1px solid #e6dcc8;border-radius:12px;overflow:hidden;">
        <tr><td align="center" style="background:#faf6ef;padding:24px;border-bottom:1px solid #e6dcc8;">
          <img src="${SITE_URL}/assets/img/logo.webp" width="160" height="67" alt="lufactory" style="display:block;margin:0 auto;">
        </td></tr>
        <tr><td style="padding:28px 24px;font-size:15px;line-height:1.6;">
          ${innerHtml}
        </td></tr>
        <tr><td style="padding:16px 24px;background:#faf6ef;border-top:1px solid #e6dcc8;text-align:center;font-size:12px;color:#786b58;">
          lufactory.cz &middot; <a href="mailto:info@lufactory.cz" style="color:#81665b;">info@lufactory.cz</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// Stejný SPD (Short Payment Descriptor) formát jako buildPaymentQrSvg v
// assets/js/cart.js, jen vykreslený přes veřejné qrserver.com API místo
// místní JS knihovny — e-mail neumí spustit JavaScript, potřebuje hotový obrázek.
function paymentQrImageUrl(amount, variableSymbol) {
  const spd = 'SPD*1.0*ACC:' + BANK_IBAN + '*AM:' + amount.toFixed(2) + '*CC:CZK*X-VS:' + variableSymbol + '*MSG:Lufactory';
  return 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + encodeURIComponent(spd);
}

function itemRowsHtml(items) {
  return items.map((i) => `<tr>
      <td style="padding:6px 0;border-bottom:1px solid #e6dcc8;">${escapeHtml(i.title)} &times; ${i.qty}</td>
      <td style="padding:6px 0;border-bottom:1px solid #e6dcc8;text-align:right;white-space:nowrap;">${i.price * i.qty} Kč</td>
    </tr>`).join('');
}

function totalsRowsHtml(rows) {
  return rows.map(([label, value]) => `<tr><td style="padding:3px 0;">${label}</td><td style="padding:3px 0;text-align:right;">${value}</td></tr>`).join('');
}

const LOW_STOCK_THRESHOLD = 2;

async function sendLowStockAlert(env, lowStockItems) {
  const rows = lowStockItems.map((item) => [
    escapeHtml(item.title),
    item.remainingStock > 0 ? `zbývá ${item.remainingStock} ks` : 'vyprodáno'
  ]);
  const html = emailLayout(`
    <p style="margin:0 0 16px;font-size:17px;color:#2e2419;">Dochází sklad</p>
    <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;">${totalsRowsHtml(rows)}</table>
  `);
  await sendResendEmail(env, {
    to: env.SHOP_NOTIFICATION_EMAIL,
    subject: 'Dochází sklad u ' + lowStockItems.length + ' produktu' + (lowStockItems.length > 1 ? 'ů' : ''),
    html
  });
}

async function sendOrderEmails(env, { orderNumber, variableSymbol, body, items, subtotal, discount, shipping, total }) {
  const totalsRows = [['Mezisoučet', `${subtotal} Kč`]];
  if (discount > 0) totalsRows.push([`Sleva (${(body.discountCode || '').toUpperCase()})`, `−${discount} Kč`]);
  totalsRows.push(['Doprava', shipping.price === 0 ? 'zdarma' : `${shipping.price} Kč`]);

  const isCash = body.payment.method === 'cash';
  const paymentHtml = isCash
    ? `<p style="margin:20px 0 0;">Platba: hotově při odběru.</p>`
    : `
    <p style="margin:20px 0 0;">Platba: bankovním převodem na účet níže.</p>
    <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:10px;background:#faf6ef;border-radius:8px;font-size:14px;">
      ${totalsRowsHtml([
        ['Číslo účtu', BANK_ACCOUNT],
        ['Variabilní symbol', variableSymbol],
        ['Částka', `${total} Kč`]
      ])}
    </table>
    <img src="${paymentQrImageUrl(total, variableSymbol)}" width="180" height="180" alt="QR platba" style="display:block;margin:16px auto 0;">
    <p style="margin:6px 0 0;font-size:13px;color:#786b58;text-align:center;">Naskenujte v bankovní appce — účet, částka i variabilní symbol se vyplní sami.</p>`;

  const customerHtml = emailLayout(`
    <p style="margin:0 0 16px;font-size:17px;color:#2e2419;">Děkujeme za objednávku č. <strong>${escapeHtml(orderNumber)}</strong>!</p>
    <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;">${itemRowsHtml(items)}</table>
    <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;margin-top:12px;">${totalsRowsHtml(totalsRows)}</table>
    <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:10px;background:#faf6ef;border-radius:8px;">
      <tr><td style="padding:10px 14px;font-weight:bold;color:#2e2419;">Celkem</td><td style="padding:10px 14px;text-align:right;font-weight:bold;color:#81665b;font-size:17px;">${total} Kč</td></tr>
    </table>
    ${paymentHtml}
    <p style="margin:8px 0 0;">Brzy se vám ozveme s dalšími informacemi.</p>
  `);

  await sendResendEmail(env, {
    to: body.customer.email,
    subject: `Potvrzení objednávky ${orderNumber} – lufactory.cz`,
    html: customerHtml
  });

  const shopHtml = emailLayout(`
    <p style="margin:0 0 16px;font-size:17px;color:#2e2419;">Nová objednávka <strong>${escapeHtml(orderNumber)}</strong></p>
    <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;margin-bottom:16px;">
      ${totalsRowsHtml([
        ['Jméno', escapeHtml(body.customer.name)],
        ['Adresa', escapeHtml(`${body.customer.street}, ${body.customer.zip} ${body.customer.city}`)],
        ['E-mail', escapeHtml(body.customer.email)],
        ['Telefon', escapeHtml(body.customer.phone || '-')],
        ['Doprava', `${escapeHtml(shipping.label)}${body.delivery.detail ? ' — ' + escapeHtml(body.delivery.detail) : ''}`],
        ['Platba', escapeHtml(body.payment.method)],
        ['Poznámka', escapeHtml(body.note || '-')]
      ])}
    </table>
    <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;">${itemRowsHtml(items)}</table>
    <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:10px;background:#faf6ef;border-radius:8px;">
      <tr><td style="padding:10px 14px;font-weight:bold;color:#2e2419;">Celkem</td><td style="padding:10px 14px;text-align:right;font-weight:bold;color:#81665b;font-size:17px;">${total} Kč</td></tr>
    </table>
  `);

  await sendResendEmail(env, {
    to: env.SHOP_NOTIFICATION_EMAIL,
    subject: `Nová objednávka ${orderNumber}`,
    html: shopHtml
  });
}

// ---------- odstoupení od smlouvy ----------

async function submitWithdrawal(request, env, cors) {
  const body = await request.json();
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const address = String(body.address || '').trim();
  const goods = String(body.goods || '').trim();
  const orderNumber = String(body.orderNumber || '').trim();
  const receivedDate = String(body.receivedDate || '').trim();

  if (!name || !email || !address || !goods) {
    return json({ error: 'missing_fields' }, 400, cors);
  }

  // Uložit vždy, i kdyby e-mail selhal — jde o právně důležité oznámení,
  // nesmí zmizet jen proto, že Resend zrovna nejde.
  await env.DB.prepare(
    `INSERT INTO withdrawal_requests (customer_name, customer_email, customer_address, order_number, received_date, goods)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(name, email, address, orderNumber || null, receivedDate || null, goods).run();

  if (env.RESEND_API_KEY) {
    try {
      await sendWithdrawalEmails(env, { name, email, address, orderNumber, receivedDate, goods });
    } catch (err) {
      console.error('withdrawal email failed', err);
    }
  }

  return json({ ok: true }, 200, cors);
}

async function sendWithdrawalEmails(env, { name, email, address, orderNumber, receivedDate, goods }) {
  const declarationRows = [['Jméno a příjmení', escapeHtml(name)], ['E-mail', escapeHtml(email)], ['Adresa', escapeHtml(address)]];
  if (orderNumber) declarationRows.push(['Číslo objednávky', escapeHtml(orderNumber)]);
  if (receivedDate) declarationRows.push(['Datum obdržení zboží', escapeHtml(receivedDate)]);
  declarationRows.push(['Datum odeslání', new Date().toLocaleDateString('cs-CZ')]);

  const shopHtml = emailLayout(`
    <p style="margin:0 0 16px;font-size:17px;color:#2e2419;">Odstoupení od smlouvy</p>
    <p style="margin:0 0 16px;">Oznamuji, že tímto odstupuji od smlouvy o nákupu tohoto zboží:</p>
    <p style="margin:0 0 16px;font-weight:bold;">${escapeHtml(goods)}</p>
    <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;">${totalsRowsHtml(declarationRows)}</table>
  `);
  await sendResendEmail(env, {
    to: env.SHOP_NOTIFICATION_EMAIL,
    subject: `Odstoupení od smlouvy — ${name}`,
    html: shopHtml
  });

  const customerHtml = emailLayout(`
    <p style="margin:0 0 16px;font-size:17px;color:#2e2419;">Odstoupení od smlouvy jsme přijali</p>
    <p style="margin:0;">Dobrý den, ${escapeHtml(name)},</p>
    <p style="margin:8px 0 0;">vaše oznámení o odstoupení od smlouvy jsme v pořádku přijali. Brzy se vám ozveme s dalšími kroky ohledně vrácení zboží a peněz.</p>
  `);
  await sendResendEmail(env, {
    to: email,
    subject: 'Odstoupení od smlouvy jsme přijali — lufactory.cz',
    html: customerHtml
  });
}

// ---------- recenze ----------

async function getReviewInvite(env, cors, token) {
  const order = await env.DB.prepare(
    'SELECT id, order_number, customer_name, review_submitted_at FROM orders WHERE review_token = ?'
  ).bind(token).first();
  if (!order) return json({ error: 'not_found' }, 404, cors);

  const { results: items } = await env.DB.prepare(
    'SELECT DISTINCT product_id, title FROM order_items WHERE order_id = ?'
  ).bind(order.id).all();

  return json({
    orderNumber: order.order_number,
    customerName: order.customer_name,
    alreadySubmitted: !!order.review_submitted_at,
    items
  }, 200, cors);
}

async function submitReviews(request, env, cors) {
  const body = await request.json();
  const token = String(body.token || '').trim();
  if (!token || !Array.isArray(body.reviews) || body.reviews.length === 0) {
    return json({ error: 'missing_fields' }, 400, cors);
  }

  const order = await env.DB.prepare(
    'SELECT id, customer_name, review_submitted_at FROM orders WHERE review_token = ?'
  ).bind(token).first();
  if (!order) return json({ error: 'invalid_token' }, 404, cors);
  if (order.review_submitted_at) return json({ error: 'already_submitted' }, 409, cors);

  // Nevěřit product_id poslanému klientem — recenzovat jde jen to, co
  // opravdu bylo v téhle objednávce.
  const { results: orderedItems } = await env.DB.prepare(
    'SELECT DISTINCT product_id FROM order_items WHERE order_id = ?'
  ).bind(order.id).all();
  const validIds = new Set(orderedItems.map((i) => i.product_id));

  const stmts = [];
  for (const r of body.reviews) {
    if (!validIds.has(r.productId)) continue;
    const rating = Math.max(1, Math.min(5, parseInt(r.rating, 10) || 0));
    if (!rating) continue;
    stmts.push(env.DB.prepare(
      'INSERT INTO reviews (product_id, order_id, customer_name, rating, comment, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(r.productId, order.id, order.customer_name, rating, String(r.comment || '').trim().slice(0, 500), 'pending'));
  }
  if (stmts.length === 0) return json({ error: 'no_valid_reviews' }, 400, cors);

  stmts.push(env.DB.prepare("UPDATE orders SET review_submitted_at = datetime('now') WHERE id = ?").bind(order.id));
  await env.DB.batch(stmts);

  return json({ ok: true }, 200, cors);
}

async function getProductReviews(env, cors, productId) {
  const { results } = await env.DB.prepare(
    'SELECT customer_name, rating, comment, created_at FROM reviews WHERE product_id = ? AND status = ? ORDER BY created_at DESC'
  ).bind(productId, 'approved').all();
  const count = results.length;
  const average = count ? Math.round((results.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10 : 0;
  return json({ reviews: results, average, count }, 200, cors);
}

async function getLatestReviews(env, cors) {
  const { results } = await env.DB.prepare(
    `SELECT r.product_id, p.title AS product_title, r.customer_name, r.rating, r.comment, r.created_at
     FROM reviews r LEFT JOIN products p ON p.product_id = r.product_id
     WHERE r.status = 'approved'
     ORDER BY r.created_at DESC LIMIT 3`
  ).all();
  return json({ reviews: results }, 200, cors);
}

async function listAdminReviews(env, cors) {
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.product_id, p.title AS product_title, r.customer_name, r.rating, r.comment, r.status, r.created_at
     FROM reviews r LEFT JOIN products p ON p.product_id = r.product_id
     ORDER BY r.created_at DESC LIMIT 200`
  ).all();
  return json({ reviews: results }, 200, cors);
}

async function updateReviewStatus(request, env, cors, id) {
  const body = await request.json();
  if (!['pending', 'approved', 'hidden'].includes(body.status)) {
    return json({ error: 'invalid_status' }, 400, cors);
  }
  await env.DB.prepare('UPDATE reviews SET status = ? WHERE id = ?').bind(body.status, id).run();
  return json({ ok: true }, 200, cors);
}

async function deleteReview(env, cors, id) {
  await env.DB.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run();
  return json({ ok: true }, 200, cors);
}

// ---------- upozornění na naskladnění ----------

async function submitStockNotify(request, env, cors) {
  const body = await request.json();
  const productId = String(body.productId || '').trim();
  const email = String(body.email || '').trim();
  if (!productId || !email) return json({ error: 'missing_fields' }, 400, cors);

  const product = await env.DB.prepare('SELECT product_id FROM products WHERE product_id = ?').bind(productId).first();
  if (!product) return json({ error: 'unknown_product' }, 400, cors);

  const existing = await env.DB.prepare(
    'SELECT id FROM stock_notifications WHERE product_id = ? AND email = ? AND notified = 0'
  ).bind(productId, email).first();
  if (!existing) {
    await env.DB.prepare(
      'INSERT INTO stock_notifications (product_id, email) VALUES (?, ?)'
    ).bind(productId, email).run();
  }

  return json({ ok: true }, 200, cors);
}

async function notifyBackInStock(env, productId) {
  const product = await env.DB.prepare('SELECT title FROM products WHERE product_id = ?').bind(productId).first();
  if (!product) return;
  const { results } = await env.DB.prepare(
    'SELECT id, email FROM stock_notifications WHERE product_id = ? AND notified = 0'
  ).bind(productId).all();
  if (!results.length) return;

  const url = productPageUrl(productId);
  for (const row of results) {
    const html = emailLayout(`
      <p style="margin:0 0 16px;font-size:17px;color:#2e2419;">${escapeHtml(product.title)} je zpět skladem!</p>
      <p style="margin:0;"><a href="${url}" style="display:inline-block;background:#81665b;color:#ffffff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;">Zobrazit produkt</a></p>
    `);
    try {
      await sendResendEmail(env, { to: row.email, subject: `${product.title} je zpět skladem — lufactory.cz`, html });
    } catch (err) {
      console.error('back-in-stock email failed for', row.email, err);
      continue; // jedno selhání nesmí zastavit doručení ostatním
    }
    await env.DB.prepare('UPDATE stock_notifications SET notified = 1 WHERE id = ?').bind(row.id).run();
  }
}

// ---------- admin ----------

function isAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  return !!env.ADMIN_PASSWORD && token === env.ADMIN_PASSWORD;
}

async function listOrders(env, cors) {
  const { results: orders } = await env.DB.prepare(
    `SELECT id, order_number, variable_symbol, status, customer_name, customer_email, customer_phone,
       customer_street, customer_zip, customer_city, delivery_method, delivery_detail,
       payment_method, discount_code, note, subtotal, discount_amount, shipping_price,
       total, created_at
     FROM orders ORDER BY created_at DESC LIMIT 200`
  ).all();
  const { results: items } = await env.DB.prepare(
    'SELECT order_id, product_id, title, price, qty FROM order_items'
  ).all();
  const itemsByOrder = {};
  for (const item of items) {
    (itemsByOrder[item.order_id] = itemsByOrder[item.order_id] || []).push(item);
  }
  const withItems = orders.map((o) => Object.assign({}, o, { items: itemsByOrder[o.id] || [] }));
  return json({ orders: withItems }, 200, cors);
}

// Středník, ne čárka — český Excel s čárkou jako oddělovačem nepočítá a
// naskládá celý řádek do jednoho sloupce.
function csvEscape(value) {
  const str = String(value == null ? '' : value);
  if (/["\n;]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

async function exportOrdersCsv(env, cors) {
  const { results: orders } = await env.DB.prepare(
    `SELECT id, order_number, variable_symbol, status, customer_name, customer_email, customer_phone,
       customer_street, customer_zip, customer_city, delivery_method, delivery_detail,
       payment_method, discount_code, subtotal, discount_amount, shipping_price, total, created_at
     FROM orders ORDER BY created_at DESC`
  ).all();
  const { results: items } = await env.DB.prepare(
    'SELECT order_id, title, qty FROM order_items'
  ).all();
  const itemsByOrder = {};
  for (const item of items) {
    (itemsByOrder[item.order_id] = itemsByOrder[item.order_id] || []).push(item.title + ' x' + item.qty);
  }

  const header = [
    'Číslo objednávky', 'Variabilní symbol', 'Datum', 'Stav', 'Jméno', 'Ulice', 'PSČ', 'Město', 'E-mail', 'Telefon',
    'Doprava', 'Detail dopravy', 'Položky', 'Slevový kód', 'Mezisoučet', 'Sleva', 'Doprava (Kč)', 'Celkem', 'Platba'
  ];
  const rows = orders.map((o) => [
    o.order_number,
    o.variable_symbol || '',
    o.created_at,
    ORDER_STATUS_LABELS[o.status] || o.status,
    o.customer_name,
    o.customer_street,
    o.customer_zip,
    o.customer_city,
    o.customer_email,
    o.customer_phone,
    (SHIPPING[o.delivery_method] && SHIPPING[o.delivery_method].label) || o.delivery_method,
    o.delivery_detail || '',
    (itemsByOrder[o.id] || []).join(' | '),
    o.discount_code || '',
    o.subtotal,
    o.discount_amount,
    o.shipping_price,
    o.total,
    o.payment_method === 'cash' ? 'hotově' : 'převod'
  ]);

  const csv = [header].concat(rows).map((row) => row.map(csvEscape).join(';')).join('\r\n');
  const bom = String.fromCharCode(0xfeff);
  return new Response(bom + csv, {
    headers: Object.assign({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="objednavky.csv"'
    }, cors)
  });
}

async function deleteOrder(env, cors, orderId) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM order_items WHERE order_id = ?').bind(orderId),
    env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(orderId)
  ]);
  return json({ ok: true }, 200, cors);
}

const ORDER_STATUS_LABELS = {
  nova: 'Nová',
  zaplaceno: 'Zaplaceno',
  odeslano: 'Odesláno',
  hotovo: 'Vyřízeno',
  zruseno: 'Zrušeno'
};

async function updateOrderStatus(request, env, cors, orderId) {
  const body = await request.json();
  if (!body.status) return json({ error: 'missing_status' }, 400, cors);
  await env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(body.status, orderId).run();

  if (env.RESEND_API_KEY) {
    // Stejně jako u potvrzení objednávky — selhání e-mailu nesmí shodit
    // samotnou změnu stavu, ta už je v databázi hotová.
    try {
      const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
      if (order) {
        await sendStatusChangeEmail(env, order, body.status);
        if (body.status === 'odeslano') {
          const { results: items } = await env.DB.prepare(
            'SELECT title, price, qty FROM order_items WHERE order_id = ?'
          ).bind(orderId).all();
          await sendInvoiceEmail(env, order, items);
        }
        if (body.status === 'hotovo' && !order.review_token) {
          const token = crypto.randomUUID();
          await env.DB.prepare('UPDATE orders SET review_token = ? WHERE id = ?').bind(token, orderId).run();
          await sendReviewRequestEmail(env, order, token);
        }
      }
    } catch (err) {
      console.error('order status email failed', err);
    }
  }

  return json({ ok: true }, 200, cors);
}

async function sendReviewRequestEmail(env, order, token) {
  const link = `${SITE_URL}/recenze.html?token=${token}`;
  const html = emailLayout(`
    <p style="margin:0 0 16px;font-size:17px;color:#2e2419;">Jak se vám houbičky líbí?</p>
    <p style="margin:0 0 16px;">Doufáme, že jste s objednávkou č. <strong>${escapeHtml(order.order_number)}</strong> spokojeni. Budeme moc rádi, když nám napíšete pár slov hodnocení — pomůže to dalším zákazníkům při výběru.</p>
    <p style="margin:0;"><a href="${link}" style="display:inline-block;background:#81665b;color:#ffffff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;">Napsat hodnocení</a></p>
  `);
  await sendResendEmail(env, {
    to: order.customer_email,
    subject: 'Jak se vám líbí vaše houbičky? — lufactory.cz',
    html
  });
}

async function sendStatusChangeEmail(env, order, status) {
  const label = ORDER_STATUS_LABELS[status] || status;
  const html = emailLayout(`
    <p style="margin:0 0 16px;font-size:17px;color:#2e2419;">Stav objednávky č. <strong>${escapeHtml(order.order_number)}</strong> se změnil.</p>
    <p style="margin:0;">Nový stav: <strong>${escapeHtml(label)}</strong></p>
  `);
  await sendResendEmail(env, {
    to: order.customer_email,
    subject: `Objednávka ${order.order_number} — ${label}`,
    html
  });
}

// Base64 kódování musí umět diakritiku — obyčejné btoa() na ní spadne.
function toBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function buildInvoiceHtml(order, items) {
  const itemRows = items.map((i) => `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e6dcc8;">${escapeHtml(i.title)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e6dcc8;text-align:center;">${i.qty}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e6dcc8;text-align:right;">${i.price} Kč</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e6dcc8;text-align:right;">${i.price * i.qty} Kč</td>
    </tr>`).join('');

  // Datum vystavení = datum objednávky, ne datum kdy se faktura zrovna
  // prohlíží/generuje — created_at je uložené jako UTC bez 'Z', bez toho
  // by ho new Date() v některých enginech vzalo jako lokální čas.
  const orderDate = new Date(order.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('cs-CZ');
  const shippingInfo = SHIPPING[order.delivery_method];
  const shippingLabel = shippingInfo ? shippingInfo.label : order.delivery_method;
  const paymentLabel = order.payment_method === 'cash' ? 'Hotově při odběru' : 'Bankovním převodem';

  return `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><title>Faktura ${escapeHtml(order.order_number)}</title></head>
<body style="font-family:Georgia,'Times New Roman',serif;color:#2e2419;max-width:640px;margin:0 auto;padding:32px;">
  <h1 style="font-size:22px;margin:0 0 4px;">Faktura č. ${escapeHtml(order.order_number)}</h1>
  <p style="color:#786b58;margin:0 0 24px;">Datum vystavení: ${orderDate}</p>

  <table role="presentation" width="100%" style="margin-bottom:24px;">
    <tr>
      <td style="vertical-align:top;width:50%;">
        <strong>Dodavatel</strong><br>
        ${escapeHtml(SELLER.name)}<br>
        IČO: ${escapeHtml(SELLER.ico)}<br>
        ${escapeHtml(SELLER.address)}<br>
        Neplátce DPH<br>
        Číslo účtu: ${escapeHtml(BANK_ACCOUNT)}
      </td>
      <td style="vertical-align:top;width:50%;">
        <strong>Odběratel</strong><br>
        ${escapeHtml(order.customer_name)}<br>
        ${escapeHtml(order.customer_street)}<br>
        ${escapeHtml(order.customer_zip)} ${escapeHtml(order.customer_city)}<br>
        ${escapeHtml(order.customer_email)}${order.customer_phone ? '<br>' + escapeHtml(order.customer_phone) : ''}
      </td>
    </tr>
  </table>

  <table role="presentation" width="100%" style="margin-bottom:24px;font-size:14px;background:#faf6ef;border-radius:8px;">
    <tr>
      <td style="padding:8px 12px;"><strong>Doprava:</strong> ${escapeHtml(shippingLabel)}${order.delivery_detail ? ' — ' + escapeHtml(order.delivery_detail) : ''}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;"><strong>Platba:</strong> ${escapeHtml(paymentLabel)}</td>
    </tr>
  </table>

  <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;">
    <thead>
      <tr style="background:#f1e8d6;">
        <th style="padding:6px 8px;text-align:left;">Položka</th>
        <th style="padding:6px 8px;text-align:center;">Množství</th>
        <th style="padding:6px 8px;text-align:right;">Cena/ks</th>
        <th style="padding:6px 8px;text-align:right;">Celkem</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <table role="presentation" width="100%" style="margin-top:16px;font-size:14px;">
    <tr><td style="padding:3px 8px;">Mezisoučet</td><td style="padding:3px 8px;text-align:right;">${order.subtotal} Kč</td></tr>
    ${order.discount_amount > 0 ? `<tr><td style="padding:3px 8px;">Sleva</td><td style="padding:3px 8px;text-align:right;">−${order.discount_amount} Kč</td></tr>` : ''}
    <tr><td style="padding:3px 8px;">Doprava</td><td style="padding:3px 8px;text-align:right;">${order.shipping_price} Kč</td></tr>
    <tr><td style="padding:6px 8px;font-weight:bold;">Celkem k úhradě</td><td style="padding:6px 8px;text-align:right;font-weight:bold;">${order.total} Kč</td></tr>
  </table>

  <p style="margin-top:24px;font-size:13px;color:#786b58;">Vystaveno automaticky systémem lufactory.cz.</p>
</body></html>`;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

// Cloudflare Browser Rendering vykreslí HTML do skutečného PDF. Vyžaduje
// secret CF_API_TOKEN (API token s oprávněním "Browser Rendering: Edit").
// Bez něj nebo při selhání se pošle HTML příloha jako záloha.
async function htmlToPdf(env, html) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/browser-rendering/pdf`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ html })
    }
  );
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Browser Rendering error ${res.status}: ${detail}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function getOrderInvoice(env, cors, orderId) {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
  if (!order) return json({ error: 'not_found' }, 404, cors);
  const { results: items } = await env.DB.prepare(
    'SELECT title, price, qty FROM order_items WHERE order_id = ?'
  ).bind(orderId).all();

  const html = buildInvoiceHtml(order, items);

  if (env.CF_API_TOKEN) {
    try {
      const pdfBytes = await htmlToPdf(env, html);
      return new Response(pdfBytes, {
        headers: Object.assign({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="faktura-${order.order_number}.pdf"`
        }, cors)
      });
    } catch (err) {
      console.error('htmlToPdf failed, falling back to HTML', err);
    }
  }

  return new Response(html, {
    headers: Object.assign({ 'Content-Type': 'text/html; charset=utf-8' }, cors)
  });
}

async function sendInvoiceEmail(env, order, items) {
  const html = buildInvoiceHtml(order, items);
  let filename = 'faktura-' + order.order_number + '.html';
  let content = toBase64Utf8(html);
  let intro = `V příloze posíláme fakturu k vaší objednávce ${escapeHtml(order.order_number)}. Otevře se v prohlížeči — pokud potřebujete PDF, jde v prohlížeči vytisknout a uložit jako PDF.`;

  if (env.CF_API_TOKEN) {
    try {
      const pdfBytes = await htmlToPdf(env, html);
      filename = 'faktura-' + order.order_number + '.pdf';
      content = bytesToBase64(pdfBytes);
      intro = `V příloze posíláme fakturu k vaší objednávce ${escapeHtml(order.order_number)}.`;
    } catch (err) {
      console.error('htmlToPdf failed, falling back to HTML attachment', err);
    }
  }

  await sendResendEmail(env, {
    to: order.customer_email,
    subject: `Faktura k objednávce ${order.order_number}`,
    html: `<p>${intro}</p>`,
    attachments: [{ filename, content }]
  });
}

async function deleteProduct(env, cors, productId) {
  await env.DB.prepare('DELETE FROM products WHERE product_id = ?').bind(productId).run();
  return json({ ok: true }, 200, cors);
}

const MAX_DESCRIPTION_LENGTH = 1000;

async function createProduct(request, env, cors) {
  const body = await request.json();
  if (!body.productId || !body.title || body.price == null) {
    return json({ error: 'missing_fields' }, 400, cors);
  }
  if ((body.description || '').length > MAX_DESCRIPTION_LENGTH) {
    return json({ error: 'description_too_long' }, 400, cors);
  }
  await env.DB.prepare(
    'INSERT INTO products (product_id, title, price, stock_qty, description, teaser) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(body.productId, body.title, Number(body.price), Number(body.stockQty) || 0, body.description || '', body.teaser || '').run();
  return json({ ok: true }, 200, cors);
}

async function updateProduct(request, env, cors, productId) {
  const body = await request.json();
  if (body.description != null && body.description.length > MAX_DESCRIPTION_LENGTH) {
    return json({ error: 'description_too_long' }, 400, cors);
  }
  const fields = [];
  const values = [];
  if (body.title != null) { fields.push('title = ?'); values.push(body.title); }
  if (body.price != null) { fields.push('price = ?'); values.push(Number(body.price)); }
  if (body.stockQty != null) { fields.push('stock_qty = ?'); values.push(Number(body.stockQty)); }
  if (body.description != null) { fields.push('description = ?'); values.push(body.description); }
  if (body.teaser != null) { fields.push('teaser = ?'); values.push(body.teaser); }
  if (body.imageUrl != null) { fields.push('image_url = ?'); values.push(body.imageUrl); }
  if (body.galleryUrls != null) { fields.push('gallery_urls = ?'); values.push(JSON.stringify(body.galleryUrls)); }
  if (fields.length === 0) return json({ error: 'nothing_to_update' }, 400, cors);
  values.push(productId);

  let wasOutOfStock = false;
  if (body.stockQty != null && Number(body.stockQty) > 0) {
    const before = await env.DB.prepare('SELECT stock_qty FROM products WHERE product_id = ?').bind(productId).first();
    wasOutOfStock = !!before && before.stock_qty <= 0;
  }

  await env.DB.prepare(`UPDATE products SET ${fields.join(', ')} WHERE product_id = ?`).bind(...values).run();

  if (wasOutOfStock && env.RESEND_API_KEY) {
    try {
      await notifyBackInStock(env, productId);
    } catch (err) {
      console.error('notifyBackInStock failed', err);
    }
  }

  return json({ ok: true }, 200, cors);
}

// ---------- fotky produktů (Workers KV) ----------

async function uploadProductImage(request, env, cors, productId) {
  const body = await request.json();
  if (!body.contentBase64 || !body.contentType) {
    return json({ error: 'missing_fields' }, 400, cors);
  }
  const bytes = Uint8Array.from(atob(body.contentBase64), (c) => c.charCodeAt(0));
  const ext = (body.contentType.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const key = productId + '-' + Date.now() + '.' + ext;
  await env.IMAGES.put(key, bytes, { metadata: { contentType: body.contentType } });

  if (body.target === 'gallery') {
    const row = await env.DB.prepare('SELECT gallery_urls FROM products WHERE product_id = ?').bind(productId).first();
    const gallery = parseGalleryUrls(row && row.gallery_urls);
    gallery.push(key);
    await env.DB.prepare('UPDATE products SET gallery_urls = ? WHERE product_id = ?').bind(JSON.stringify(gallery), productId).run();
  } else {
    await env.DB.prepare('UPDATE products SET image_url = ? WHERE product_id = ?').bind(key, productId).run();
  }

  return json({ ok: true, imageUrl: WORKER_BASE + '/api/images/' + key }, 200, cors);
}

async function serveImage(env, cors, key) {
  const obj = await env.IMAGES.getWithMetadata(key, 'arrayBuffer');
  if (!obj || !obj.value) return json({ error: 'not_found' }, 404, cors);
  const contentType = (obj.metadata && obj.metadata.contentType) || 'application/octet-stream';
  return new Response(obj.value, {
    headers: Object.assign(
      { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000' },
      cors
    )
  });
}

// ---------- slevové kódy (admin) ----------

async function listDiscountCodes(env, cors) {
  const { results } = await env.DB.prepare(
    'SELECT code, type, value, active FROM discount_codes ORDER BY code'
  ).all();
  return json({ codes: results }, 200, cors);
}

async function createDiscountCode(request, env, cors) {
  const body = await request.json();
  if (!body.code || !body.type || body.value == null) {
    return json({ error: 'missing_fields' }, 400, cors);
  }
  await env.DB.prepare(
    'INSERT INTO discount_codes (code, type, value, active) VALUES (?, ?, ?, 1)'
  ).bind(body.code.toUpperCase(), body.type, Number(body.value)).run();
  return json({ ok: true }, 200, cors);
}

async function updateDiscountCode(request, env, cors, code) {
  const body = await request.json();
  const fields = [];
  const values = [];
  if (body.type != null) { fields.push('type = ?'); values.push(body.type); }
  if (body.value != null) { fields.push('value = ?'); values.push(Number(body.value)); }
  if (body.active != null) { fields.push('active = ?'); values.push(body.active ? 1 : 0); }
  if (fields.length === 0) return json({ error: 'nothing_to_update' }, 400, cors);
  values.push(code.toUpperCase());
  await env.DB.prepare(`UPDATE discount_codes SET ${fields.join(', ')} WHERE code = ?`).bind(...values).run();
  return json({ ok: true }, 200, cors);
}

async function deleteDiscountCode(env, cors, code) {
  await env.DB.prepare('DELETE FROM discount_codes WHERE code = ?').bind(code.toUpperCase()).run();
  return json({ ok: true }, 200, cors);
}

async function sendResendEmail(env, { to, subject, html, attachments = null }) {
  const payload = { from: env.MAIL_FROM, to: [to], subject, html };
  if (attachments) payload.attachments = attachments;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend error ${res.status}: ${detail}`);
  }
}
