# Blue Waters Cancun — Stripe + Email + SMS/WhatsApp Confirmations

This version adds automatic confirmations after a successful Stripe payment.

## What was added

- Customer email receipt after payment succeeds
- Business email notification to Bluewaterscancun@gmail.com
- SMS confirmation to customer
- WhatsApp confirmation to customer
- Stripe webhook endpoint: `/stripe/webhook`
- Reservation/payment details stored in Stripe metadata

Stripe webhooks are the correct way to trigger confirmations after a real payment succeeds, because Stripe sends `payment_intent.succeeded` events to your server. Twilio is used for SMS and WhatsApp confirmations.

## Setup

1. Run:

```bash
npm install
```

2. Copy `.env.example` to `.env`.

3. Add your Stripe keys:

```env
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
```

4. Add a Stripe webhook endpoint in Stripe Dashboard:

```text
https://YOUR-LIVE-DOMAIN.com/stripe/webhook
```

Listen for this event:

```text
payment_intent.succeeded
```

Then copy the webhook signing secret into:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

5. Add email settings. For Gmail, create a Gmail App Password and use it as `SMTP_PASS`.

```env
SMTP_USER=Bluewaterscancun@gmail.com
SMTP_PASS=YOUR_GMAIL_APP_PASSWORD
BUSINESS_NOTIFICATION_EMAIL=Bluewaterscancun@gmail.com
```

6. Add Twilio settings:

```env
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_SMS_FROM=+1...
TWILIO_WHATSAPP_FROM=+14155238886
```

For production WhatsApp, you need a WhatsApp-enabled Twilio sender.

7. Start locally:

```bash
npm start
```

Open:

```text
http://localhost:4242
```

## Notes

- The Stripe secret key, webhook secret, Gmail app password, and Twilio token must stay private.
- Do not paste those secrets into `index.html`.
- Deploy this on a Node.js host such as Render, Railway, Heroku, Fly.io, or a VPS.
