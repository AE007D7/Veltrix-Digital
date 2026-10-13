# Veltrix Digital

Multilingual storefront with English, French, Arabic (RTL), and Spanish. Secure Stripe Checkout is available for selected US-region gift cards once the Vercel production environment has a live Stripe secret key and `STRIPE_LIVE_CHECKOUT=true`. Other products remain enquiries.

Checkout prices are enforced server-side in `api/checkout.js`; provider-only and unreleased products are excluded. Never commit Stripe keys or other secrets.