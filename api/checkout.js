'use strict';

const CATALOG = {"playstation":{"name":"PlayStation Store","variants":{"10":{"label":"$10 USD face value · US card","amount":1149},"25":{"label":"$25 USD face value · US card","amount":2749},"50":{"label":"$50 USD face value · US card","amount":5399},"100":{"label":"$100 USD face value · US card","amount":10699}}},"steam":{"name":"Steam Wallet","variants":{"10":{"label":"$10 USD face value · US card","amount":1149},"20":{"label":"$20 USD face value · US card","amount":2249},"50":{"label":"$50 USD face value · US card","amount":5399},"100":{"label":"$100 USD face value · US card","amount":10699}}},"xbox":{"name":"Xbox Gift Card","variants":{"10":{"label":"$10 USD face value · US card","amount":1149},"25":{"label":"$25 USD face value · US card","amount":2749},"50":{"label":"$50 USD face value · US card","amount":5399},"100":{"label":"$100 USD face value · US card","amount":10699}}},"netflix":{"name":"Netflix Gift Card","variants":{"15":{"label":"$15 USD face value · US card","amount":1699},"25":{"label":"$25 USD face value · US card","amount":2749},"50":{"label":"$50 USD face value · US card","amount":5399},"100":{"label":"$100 USD face value · US card","amount":10699}}},"amazon":{"name":"Amazon Gift Card","variants":{"10":{"label":"$10 USD face value · US card","amount":1149},"25":{"label":"$25 USD face value · US card","amount":2749},"50":{"label":"$50 USD face value · US card","amount":5399},"100":{"label":"$100 USD face value · US card","amount":10699}}},"nintendo":{"name":"Nintendo eShop","variants":{"10":{"label":"$10 USD face value · US card","amount":1149},"20":{"label":"$20 USD face value · US card","amount":2249},"35":{"label":"$35 USD face value · US card","amount":3849},"50":{"label":"$50 USD face value · US card","amount":5399}}},"itunes":{"name":"Apple Gift Card / iTunes","variants":{"10":{"label":"$10 USD face value · US card","amount":1149},"25":{"label":"$25 USD face value · US card","amount":2749},"50":{"label":"$50 USD face value · US card","amount":5399},"100":{"label":"$100 USD face value · US card","amount":10699}}}};
const ALLOWED_ORIGINS = new Set([
  'https://veltrixdigi.com',
  'https://www.veltrixdigi.com',
  'https://veltrix-digital-pi.vercel.app'
]);

function liveCheckoutEnabled() {
  return process.env.STRIPE_LIVE_CHECKOUT === 'true'
    && typeof process.env.STRIPE_SECRET_KEY === 'string'
    && (/^sk_live_[A-Za-z0-9]+$/.test(process.env.STRIPE_SECRET_KEY) || /^rk_live_[A-Za-z0-9]+$/.test(process.env.STRIPE_SECRET_KEY));
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function stripeRequest(path, options = {}) {
  const response = await fetch('https://api.stripe.com/v1' + path, {
    ...options,
    headers: {
      Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const sessionId = typeof req.query?.session_id === 'string' ? req.query.session_id : '';
    if (!sessionId) return json(res, 200, { checkoutEnabled: liveCheckoutEnabled() });
    if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId) || !liveCheckoutEnabled()) {
      return json(res, 400, { paymentStatus: 'unknown' });
    }
    try {
      const { response, data } = await stripeRequest('/checkout/sessions/' + encodeURIComponent(sessionId));
      if (!response.ok) return json(res, 502, { paymentStatus: 'unknown' });
      return json(res, 200, { paymentStatus: data.payment_status === 'paid' ? 'paid' : 'unpaid' });
    } catch (_) {
      return json(res, 502, { paymentStatus: 'unknown' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const origin = req.headers.origin;
  if (!ALLOWED_ORIGINS.has(origin)) return json(res, 403, { error: 'Checkout request origin is not allowed.' });
  if (!liveCheckoutEnabled()) return json(res, 503, { error: 'Secure checkout is not configured yet. You can still send an enquiry.' });

  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
  if (rawItems.length < 1 || rawItems.length > 10) {
    return json(res, 400, { error: 'Choose between 1 and 10 checkout items.' });
  }

  const normalized = new Map();
  let totalQuantity = 0;
  for (const item of rawItems) {
    const product = CATALOG[item?.id];
    const variant = product?.variants?.[String(item?.value)];
    const quantity = Number(item?.quantity);
    if (!product || !variant || item?.region !== 'United States'
      || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return json(res, 400, { error: 'One or more selections are not available for secure checkout.' });
    }
    totalQuantity += quantity;
    if (totalQuantity > 20) return json(res, 400, { error: 'Checkout is limited to 20 gift cards per order.' });
    const key = item.id + ':' + String(item.value);
    const prior = normalized.get(key);
    const combined = (prior?.quantity || 0) + quantity;
    if (combined > 10) return json(res, 400, { error: 'A maximum of 10 of each gift card can be ordered.' });
    normalized.set(key, { id: item.id, product, value: String(item.value), variant, quantity: combined });
  }

  const checkoutOrigin = origin;
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', checkoutOrigin + '/?checkout=success&session_id={CHECKOUT_SESSION_ID}');
  form.set('cancel_url', checkoutOrigin + '/?checkout=cancelled');
  form.set('submit_type', 'pay');
  form.set('locale', 'auto');

  let line = 0;
  const summary = [];
  for (const item of normalized.values()) {
    const prefix = 'line_items[' + line + ']';
    form.set(prefix + '[quantity]', String(item.quantity));
    form.set(prefix + '[price_data][currency]', 'usd');
    form.set(prefix + '[price_data][unit_amount]', String(item.variant.amount));
    form.set(prefix + '[price_data][product_data][name]', item.product.name + ' ' + item.variant.label);
    form.set(prefix + '[price_data][product_data][description]', 'United States redemption only. Confirm the platform account region before purchase.');
    summary.push(item.id + ':' + item.value + 'x' + item.quantity);
    line += 1;
  }
  form.set('metadata[veltrix_items]', summary.join(',').slice(0, 500));
  form.set('metadata[fulfillment_region]', 'United States');

  try {
    const { response, data } = await stripeRequest('/checkout/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form
    });
    if (!response.ok || typeof data.url !== 'string') {
      return json(res, 502, { error: 'Stripe could not start checkout. Please try again or send an enquiry.' });
    }
    return json(res, 200, { url: data.url });
  } catch (_) {
    return json(res, 502, { error: 'Secure checkout could not be reached. Please try again or send an enquiry.' });
  }
};
