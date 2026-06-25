require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const Stripe = require("stripe");
const nodemailer = require("nodemailer");
const twilio = require("twilio");

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_missing");

app.post("/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["stripe-signature"];
  let event;
  try {
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch (error) {
    console.error("Webhook error:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    try { await sendConfirmations(event.data.object); } catch (error) { console.error("Confirmation error:", error); }
  }

  res.json({ received: true });
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get("/health", (req, res) => res.send("OK"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/config", (req, res) => {
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "" });
});

app.post("/create-payment-intent", async (req, res) => {
  try {
    const { amount, customerName, customerPhone, customerEmail, tagNumber, duration, checkin } = req.body;
    const amountNumber = Number(amount);
    if (!amountNumber || amountNumber <= 0) return res.status(400).json({ error: "Invalid amount." });

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amountNumber * 100),
      currency: "usd",
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      receipt_email: customerEmail || undefined,
      metadata: {
        business: "Blue Waters Cancun Parking",
        customerName: customerName || "",
        customerPhone: customerPhone || "",
        customerEmail: customerEmail || "",
        tagNumber: tagNumber || "",
        duration: duration || "",
        checkin: checkin || ""
      }
    });

    res.json({ clientSecret: intent.client_secret });
  } catch (error) {
    console.error("PaymentIntent error:", error);
    res.status(500).json({ error: "Payment could not be created. Check Stripe keys." });
  }
});

function amountText(paymentIntent) {
  return `$${(paymentIntent.amount_received / 100).toFixed(2)} ${paymentIntent.currency.toUpperCase()}`;
}

function confirmationText(paymentIntent) {
  const m = paymentIntent.metadata || {};
  return `Blue Waters Cancun Parking Confirmation

Name: ${m.customerName || "Customer"}
Duration: ${m.duration || "Parking"}
Check-in Date: ${m.checkin || "N/A"}
Tag Number: ${m.tagNumber || "N/A"}
Amount Paid: ${amountText(paymentIntent)}
Payment ID: ${paymentIntent.id}

Thank you for choosing Blue Waters Cancun Parking.
Phone: 786-588-3514`;
}

async function sendConfirmations(paymentIntent) {
  const m = paymentIntent.metadata || {};
  const text = confirmationText(paymentIntent);
  await Promise.allSettled([
    m.customerEmail ? sendEmail(m.customerEmail, "Blue Waters Cancun Parking Receipt", text) : Promise.resolve(),
    process.env.BUSINESS_NOTIFICATION_EMAIL ? sendEmail(process.env.BUSINESS_NOTIFICATION_EMAIL, "Paid Booking - Blue Waters Cancun", text) : Promise.resolve(),
    m.customerPhone ? sendSms(normalizePhone(m.customerPhone), text) : Promise.resolve(),
    m.customerPhone ? sendWhatsApp(normalizePhone(m.customerPhone), text) : Promise.resolve()
  ]);
}

function mailer() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

async function sendEmail(to, subject, text) {
  const transport = mailer();
  if (!transport) return console.log("Email not configured.");
  await transport.sendMail({ from: process.env.EMAIL_FROM || process.env.SMTP_USER, to, subject, text });
}

function twilioClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function normalizePhone(phone) {
  let clean = String(phone || "").replace(/[^\d+]/g, "");
  if (!clean.startsWith("+")) {
    if (clean.length === 10) clean = "+1" + clean;
    else if (clean.length > 10) clean = "+" + clean;
  }
  return clean;
}

async function sendSms(to, body) {
  const client = twilioClient();
  if (!client || !process.env.TWILIO_SMS_FROM || !to) return console.log("SMS not configured.");
  await client.messages.create({ body, from: process.env.TWILIO_SMS_FROM, to });
}

async function sendWhatsApp(to, body) {
  const client = twilioClient();
  if (!client || !process.env.TWILIO_WHATSAPP_FROM || !to) return console.log("WhatsApp not configured.");
  await client.messages.create({
    body,
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
    to: `whatsapp:${to}`
  });
}

const port = process.env.PORT || 4242;
app.listen(port, () => console.log(`Blue Waters Cancun running on port ${port}`));
