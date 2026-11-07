'use strict';

// Stripe event receiver. Payment fulfillment is intentionally not automated.
const crypto = require('node:crypto');

const EVENTS = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed'
]);

async function rawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');
  // Standalone Vercel Node.js functions generally expose an async request stream.
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !secret.startsWith('whsec_')) return res.status(503).json({ error: 'Webhook not configured' });
  const header = req.headers['stripe-signature'];
  if (typeof header !== 'string') return res.status(400).json({ error: 'Missing signature' });
  let payload;
  try { payload = await rawBody(req); }
  catch (_) { return res.status(400).json({ error: 'Invalid body' }); }

  const params = new URLSearchParams(header.replace(/,/g, '&'));
  const timestamp = params.get('t');
  const signatures = params.getAll('v1');
  if (!timestamp || !/^\d+$/.test(timestamp) || !signatures.length
      || Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300)
    return res.status(400).json({ error: 'Invalid signature timestamp' });

  const signedPayload = Buffer.concat([Buffer.from(timestamp + '.', 'utf8'), payload]);
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  const valid = signatures.some(value => /^[a-f0-9]{64}$/i.test(value)
    && crypto.timingSafeEqual(Buffer.from(value, 'hex'), Buffer.from(expected, 'hex')));
  if (!valid) return res.status(400).json({ error: 'Invalid signature' });

  let event;
  try { event = JSON.parse(payload.toString('utf8')); }
  catch (_) { return res.status(400).json({ error: 'Invalid JSON' }); }
  if (!event || !event.livemode || !EVENTS.has(event.type))
    return res.status(200).json({ received: true });

  const session = event.data && event.data.object;
  // Record only minimal identifiers; this must not trigger fulfillment.
  console.info('Veltrix Stripe webhook', {
    event: event.id, type: event.type, session: session && session.id,
    paymentStatus: session && session.payment_status
  });
  return res.status(200).json({ received: true });
};

// Preserve exact raw bytes for Stripe signature verification.
module.exports.config = { api: { bodyParser: false } };
