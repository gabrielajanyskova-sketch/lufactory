const SITE_URL = 'https://www.lufactory.cz';

// Musí zůstat stejné jako SHIPPING v assets/js/cart.js — tady se cena dopravy
// ověřuje server-side (nikdy se nevěří ceně poslané klientem).
const SHIPPING = {
  pickup: { label: 'Osobní odběr (Nová Ves u Prahy / Praha 8, Čimice)', price: 0 },
  zasilkovna: { label: 'Zásilkovna', price: 79 }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders();

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    try {
      if (url.pathname === '/api/products' && request.method === 'GET') {
        return await getProducts(env, cors);
      }
      const discountMatch = url.pathname.match(/^\/api\/discount\/([^/]+)$/);
      if (discountMatch && request.method === 'GET') {
        return await getDiscount(env, cors, decodeURIComponent(discountMatch[1]));
      }
      if (url.pathname === '/api/orders' && request.method === 'POST') {
        return await createOrder(request, env, cors);
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
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

async function getProducts(env, cors) {
  const { results } = await env.DB.prepare('SELECT product_id, title, price, stock_qty FROM products').all();
  const products = {};
  for (const row of results) {
    products[row.product_id] = { title: row.title, price: row.price, stockQty: row.stock_qty };
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

// ---------- orders ----------

function generateOrderNumber() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const datePart = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  const rand = Math.floor(1000 + Math.random() * 9000);
  return 'LF-' + datePart + '-' + rand;
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
    items.push({ productId: product.product_id, title: product.title, price: product.price, qty });
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const discount = await discountAmount(env, body.discountCode, subtotal);
  const shipping = SHIPPING[body.delivery.method];
  const total = Math.max(0, subtotal - discount) + shipping.price;
  const orderNumber = generateOrderNumber();

  const insert = await env.DB.prepare(
    `INSERT INTO orders (order_number, status, customer_name, customer_email, customer_phone,
       customer_street, customer_zip, customer_city,
       delivery_method, delivery_detail, payment_method, discount_code, note,
       subtotal, discount_amount, shipping_price, total)
     VALUES (?, 'nova', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    orderNumber,
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
    await sendOrderEmails(env, { orderNumber, body, items, subtotal, discount, shipping, total });
  }

  return json({ orderNumber, status: 'nova', subtotal, discountAmount: discount, shippingPrice: shipping.price, total }, 200, cors);
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

function itemRowsHtml(items) {
  return items.map((i) => `<tr>
      <td style="padding:6px 0;border-bottom:1px solid #e6dcc8;">${escapeHtml(i.title)} &times; ${i.qty}</td>
      <td style="padding:6px 0;border-bottom:1px solid #e6dcc8;text-align:right;white-space:nowrap;">${i.price * i.qty} Kč</td>
    </tr>`).join('');
}

function totalsRowsHtml(rows) {
  return rows.map(([label, value]) => `<tr><td style="padding:3px 0;">${label}</td><td style="padding:3px 0;text-align:right;">${value}</td></tr>`).join('');
}

async function sendOrderEmails(env, { orderNumber, body, items, subtotal, discount, shipping, total }) {
  const totalsRows = [['Mezisoučet', `${subtotal} Kč`]];
  if (discount > 0) totalsRows.push([`Sleva (${(body.discountCode || '').toUpperCase()})`, `−${discount} Kč`]);
  totalsRows.push(['Doprava', shipping.price === 0 ? 'zdarma' : `${shipping.price} Kč`]);

  const customerHtml = emailLayout(`
    <p style="margin:0 0 16px;font-size:17px;color:#2e2419;">Děkujeme za objedn\xE1vku č. <strong>${escapeHtml(orderNumber)}</strong>!</p>
    <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;">${itemRowsHtml(items)}</table>
    <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;margin-top:12px;">${totalsRowsHtml(totalsRows)}</table>
    <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:10px;background:#faf6ef;border-radius:8px;">
      <tr><td style="padding:10px 14px;font-weight:bold;color:#2e2419;">Celkem</td><td style="padding:10px 14px;text-align:right;font-weight:bold;color:#81665b;font-size:17px;">${total} Kč</td></tr>
    </table>
    <p style="margin:20px 0 0;">Platba: ${body.payment.method === 'cash' ? 'hotově při odběru' : 'bankovn\xEDm převodem — č\xEDslo \xFAčtu a variabiln\xED symbol pos\xEDl\xE1me zvl\xE1šť v n\xE1sleduj\xEDc\xEDm e-mailu'}.</p>
    <p style="margin:8px 0 0;">Brzy se v\xE1m ozveme s dalš\xEDmi informacemi.</p>
  `);

  await sendResendEmail(env, {
    to: body.customer.email,
    subject: `Potvrzen\xED objedn\xE1vky ${orderNumber} – lufactory.cz`,
    html: customerHtml
  });

  const shopHtml = emailLayout(`
    <p style="margin:0 0 16px;font-size:17px;color:#2e2419;">Nov\xE1 objedn\xE1vka <strong>${escapeHtml(orderNumber)}</strong></p>
    <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;margin-bottom:16px;">
      ${totalsRowsHtml([
        ['Jm\xE9no', escapeHtml(body.customer.name)],
        ['Adresa', escapeHtml(`${body.customer.street}, ${body.customer.zip} ${body.customer.city}`)],
        ['E-mail', escapeHtml(body.customer.email)],
        ['Telefon', escapeHtml(body.customer.phone || '-')],
        ['Doprava', `${escapeHtml(body.delivery.method)} — ${escapeHtml(body.delivery.detail || '')}`],
        ['Platba', escapeHtml(body.payment.method)],
        ['Pozn\xE1mka', escapeHtml(body.note || '-')]
      ])}
    </table>
    <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;">${itemRowsHtml(items)}</table>
    <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:10px;background:#faf6ef;border-radius:8px;">
      <tr><td style="padding:10px 14px;font-weight:bold;color:#2e2419;">Celkem</td><td style="padding:10px 14px;text-align:right;font-weight:bold;color:#81665b;font-size:17px;">${total} Kč</td></tr>
    </table>
  `);

  await sendResendEmail(env, {
    to: env.SHOP_NOTIFICATION_EMAIL,
    subject: `Nov\xE1 objedn\xE1vka ${orderNumber}`,
    html: shopHtml
  });
}

async function sendResendEmail(env, { to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, html })
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend error ${res.status}: ${detail}`);
  }
}
