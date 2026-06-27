require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const Stripe = require("stripe");

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || "");

function requireAdmin(req, res, next) {
  const user = process.env.ADMIN_USERNAME || "admin";
  const pass = process.env.ADMIN_PASSWORD || "change-this-password";
  const header = req.headers.authorization || "";
  const token = header.split(" ")[1] || "";
  const decoded = Buffer.from(token, "base64").toString();
  const [username, password] = decoded.split(":");
  if (username === user && password === pass) return next();
  res.set("WWW-Authenticate", 'Basic realm="Blue Waters Admin"');
  return res.status(401).send("Admin password required.");
}

app.post("/stripe/webhook", express.raw({ type: "application/json" }), (req, res) => {
  let event;
  try {
    event = process.env.STRIPE_WEBHOOK_SECRET
      ? stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET)
      : JSON.parse(req.body.toString());
  } catch (e) {
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }
  res.json({ received: true });
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/account", (req, res) => res.sendFile(path.join(__dirname, "account.html")));
app.get("/dashboard", requireAdmin, (req, res) => res.sendFile(path.join(__dirname, "dashboard.html")));
app.get("/dashboard.html", requireAdmin, (req, res) => res.sendFile(path.join(__dirname, "dashboard.html")));
app.get("/config", (req, res) => res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "" }));

app.post("/create-payment-intent", async (req, res) => {
  try {
    const { customerName, customerPhone, customerEmail, tagNumber, duration, userId } = req.body;
    const allowed = { "1 Hour": 3, "3 Hours": 7, "24 Hours": 20 };
    const amountNumber = allowed[duration] || 20;

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amountNumber * 100),
      currency: "usd",
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      receipt_email: customerEmail || undefined,
      metadata: { business:"Blue Waters Cancun Parking", customerName:customerName||"", customerPhone:customerPhone||"", customerEmail:customerEmail||"", tagNumber:tagNumber||"", duration:duration||"", userId:userId||"" }
    });

    res.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Payment could not be created. Check Stripe keys." });
  }
});

app.listen(process.env.PORT || 4242, () => console.log("Blue Waters Cancun Parking live"));
