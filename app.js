const defaultPrices = { hourly: 3, daily: 15, weekly: 70, monthly: 200 };

function getPrices(){
  try { return JSON.parse(localStorage.getItem("blueWatersPrices")) || defaultPrices; }
  catch(e){ return defaultPrices; }
}

function loadPrices(){
  const p = getPrices();
  const map = {hourlyPrice:p.hourly,dailyPrice:p.daily,weeklyPrice:p.weekly,monthlyPrice:p.monthly};
  Object.keys(map).forEach(id => { const el=document.getElementById(id); if(el) el.textContent=map[id]; });
  ["hourly","daily","weekly","monthly"].forEach(k => { const el=document.getElementById(k); if(el) el.value=p[k]; });
}

function savePrices(){
  const updated = {
    hourly: document.getElementById("hourly").value || 0,
    daily: document.getElementById("daily").value || 0,
    weekly: document.getElementById("weekly").value || 0,
    monthly: document.getElementById("monthly").value || 0
  };
  localStorage.setItem("blueWatersPrices", JSON.stringify(updated));
  document.getElementById("status").innerText = "Saved. Open the website page to see updated prices."; if(typeof updateMxnPrices === "function") updateMxnPrices();
}

function resetPrices(){ localStorage.removeItem("blueWatersPrices"); location.reload(); }

function getReservations(){
  try { return JSON.parse(localStorage.getItem("blueWatersReservations")) || []; }
  catch(e){ return []; }
}

function saveReservation(r){
  const records = getReservations();
  records.unshift(r);
  localStorage.setItem("blueWatersReservations", JSON.stringify(records));
}

const form = document.getElementById("reservationForm");
if(form){
  form.addEventListener("submit", function(){
    const r = {
      created: new Date().toLocaleString(),
      name: document.getElementById("customerName").value,
      phone: document.getElementById("customerPhone").value,
      email: document.getElementById("customerEmail").value,
      vehicle: document.getElementById("vehicle").value,
      plan: document.getElementById("plan").value,
      checkin: document.getElementById("checkin").value,
      checkout: document.getElementById("checkout").value,
      status: document.getElementById("paymentStatus").value,
      amount: Number(document.getElementById("amount").value || 0).toFixed(2)
    };
    saveReservation(r);
  });
}

function renderDashboard(){
  const tbody = document.getElementById("reservationsTable");
  if(!tbody) return;
  const records = getReservations();
  tbody.innerHTML = records.map(r => `
    <tr>
      <td>${r.created}</td><td>${r.name}</td><td>${r.phone}</td><td>${r.email || ""}</td><td>${r.vehicle}</td>
      <td>${r.plan}</td><td>${r.checkin}</td><td>${r.checkout}</td><td>${r.status}</td><td>$${r.amount}</td>
    </tr>`).join("");
  const paid = records.filter(r => r.status === "Paid");
  const pending = records.filter(r => r.status !== "Paid");
  const revenue = paid.reduce((sum,r) => sum + Number(r.amount || 0), 0);
  document.getElementById("totalReservations").textContent = records.length;
  document.getElementById("paidPayments").textContent = paid.length;
  document.getElementById("pendingPayments").textContent = pending.length;
  document.getElementById("totalRevenue").textContent = "$" + revenue.toFixed(2);
}

function exportReservations(){
  const records = getReservations();
  const header = ["Date Created","Name","Phone","Email","Vehicle","Plan","Check-in","Check-out","Status","Amount"];
  const rows = records.map(r => [r.created,r.name,r.phone,r.email || "",r.vehicle,r.plan,r.checkin,r.checkout,r.status,r.amount]);
  const csv = [header, ...rows].map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "blue-waters-reservations.csv";
  a.click();
}

function clearReservations(){
  if(confirm("Clear all demo reservations and payments?")){
    localStorage.removeItem("blueWatersReservations");
    location.reload();
  }
}

loadPrices();
renderDashboard();


// Rotating main page hero pictures
const heroImages = [
  "https://images.unsplash.com/photo-1588450130710-c4ac9fbd7a14?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1510097467424-192d713fd8b2?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1552074284-5e88ef1aef18?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1570737543098-0983d88f796d?auto=format&fit=crop&w=1600&q=80"
];

let heroImageIndex = 0;

function changeHeroImage(){
  const hero = document.querySelector(".hero");
  if(!hero) return;
  hero.style.backgroundImage =
    `linear-gradient(rgba(0,44,84,.65), rgba(0,44,84,.65)), url('${heroImages[heroImageIndex]}')`;
  heroImageIndex = (heroImageIndex + 1) % heroImages.length;
}

changeHeroImage();
setInterval(changeHeroImage, 5000);




// Fast live USD→MXN exchange-rate pricing with caching, timeout, and fallback
const fallbackUsdToMxnRate = 19.00;
const exchangeCacheKey = "blueWatersUsdMxnRateCache";
const exchangeCacheMaxAgeMs = 12 * 60 * 60 * 1000; // 12 hours
let currentUsdToMxnRate = fallbackUsdToMxnRate;

function readCachedExchangeRate(){
  try {
    const cached = JSON.parse(localStorage.getItem(exchangeCacheKey));
    if(cached && cached.rate && (Date.now() - cached.savedAt) < exchangeCacheMaxAgeMs){
      currentUsdToMxnRate = Number(cached.rate);
      return true;
    }
  } catch(e) {}
  return false;
}

function saveCachedExchangeRate(rate){
  try {
    localStorage.setItem(exchangeCacheKey, JSON.stringify({
      rate: Number(rate),
      savedAt: Date.now()
    }));
  } catch(e) {}
}

async function fetchWithTimeout(url, timeoutMs = 3500){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchUsdToMxnRate(){
  const hadCachedRate = readCachedExchangeRate();
  updateMxnPrices(hadCachedRate ? "cached" : "fallback");

  try {
    const response = await fetchWithTimeout("https://api.frankfurter.dev/v2/rates?base=USD&quotes=MXN");
    if(!response.ok) throw new Error("Exchange-rate request failed");
    const data = await response.json();
    const liveRate = data.rates?.MXN;
    if(liveRate){
      currentUsdToMxnRate = Number(liveRate);
      saveCachedExchangeRate(currentUsdToMxnRate);
      updateMxnPrices("live");
    }
  } catch(error) {
    console.warn("Exchange rate unavailable; using cached/fallback rate.", error);
    updateMxnPrices(hadCachedRate ? "cached" : "fallback");
  }
}

function updateMxnPrices(rateSource = "live"){
  const p = getPrices();
  const mxnMap = {
    hourlyMxn: p.hourly,
    dailyMxn: p.daily,
    weeklyMxn: p.weekly,
    monthlyMxn: p.monthly
  };

  Object.keys(mxnMap).forEach(id => {
    const el = document.getElementById(id);
    if(el) {
      const converted = Number(mxnMap[id] || 0) * currentUsdToMxnRate;
      el.textContent = "$" + converted.toFixed(2);
    }
  });

  const note = document.querySelector(".rate-note");
  if(note) {
    const label = rateSource === "live" ? "live" : rateSource === "cached" ? "recent cached" : "backup";
    note.textContent = "MXN prices use the " + label + " USD→MXN exchange rate. Current rate: 1 USD ≈ " + currentUsdToMxnRate.toFixed(2) + " MXN.";
  }
}

// Preload rotating hero images after first page load so image changes stay smooth
function preloadHeroImages(){
  if(!Array.isArray(heroImages)) return;
  heroImages.forEach(src => {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  });
}

window.addEventListener("load", preloadHeroImages, { once: true });
fetchUsdToMxnRate();


// Stripe direct on-site checkout
// Replace pk_test_... in .env / server with your real publishable key from Stripe.
let stripe;
let elements;
let paymentReservationData = null;

async function loadStripeConfig(){
  const response = await fetch("/config");
  const config = await response.json();
  stripe = Stripe(config.publishableKey);
}

function collectReservationData(){
  return {
    customerName: document.getElementById("customerName")?.value || "",
    customerPhone: document.getElementById("customerPhone")?.value || "",
    customerEmail: document.getElementById("customerEmail")?.value || "",
    vehicle: document.getElementById("vehicle")?.value || "",
    plan: document.getElementById("plan")?.value || "",
    checkin: document.getElementById("checkin")?.value || "",
    checkout: document.getElementById("checkout")?.value || "",
    tagNumber: document.getElementById("tagNumber")?.value || document.getElementById("vehicle")?.value || "",
    amount: Number(document.getElementById("amount")?.value || 0)
  };
}

async function initializeStripePayment(){
  const message = document.getElementById("payment-message");
  const form = document.getElementById("payment-form");
  const button = document.getElementById("startPaymentButton");

  paymentReservationData = collectReservationData();

  if(!paymentReservationData.amount || paymentReservationData.amount <= 0){
    message.textContent = "Please enter a valid amount before starting payment.";
    message.className = "payment-message error";
    return;
  }

  button.classList.add("loading");
  message.textContent = "Loading secure payment form...";
  message.className = "payment-message";

  try {
    if(!stripe) await loadStripeConfig();

    const response = await fetch("/create-payment-intent", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(paymentReservationData)
    });

    const data = await response.json();
    if(data.error) throw new Error(data.error);

    elements = stripe.elements({
      clientSecret: data.clientSecret,
      appearance: {
        theme: "stripe",
        variables: { borderRadius: "8px" }
      }
    });

    const paymentElement = elements.create("payment");
    paymentElement.mount("#payment-element");

    form.classList.remove("hidden");
    message.textContent = "";
  } catch(error) {
    message.textContent = error.message || "Payment form could not load.";
    message.className = "payment-message error";
  } finally {
    button.classList.remove("loading");
  }
}

async function submitStripePayment(event){
  event.preventDefault();

  const message = document.getElementById("payment-message");
  const submitButton = document.getElementById("submitPaymentButton");
  submitButton.classList.add("loading");
  message.textContent = "Processing payment...";
  message.className = "payment-message";

  const {error, paymentIntent} = await stripe.confirmPayment({
    elements,
    redirect: "if_required",
    confirmParams: {
      receipt_email: paymentReservationData?.customerEmail || undefined
    }
  });

  if(error){
    message.textContent = error.message;
    message.className = "payment-message error";
  } else if(paymentIntent && paymentIntent.status === "succeeded"){
    message.textContent = "Payment successful. Reservation marked as paid.";
    message.className = "payment-message success";

    // Save paid reservation in local dashboard demo records
    const r = {
      created: new Date().toLocaleString(),
      name: paymentReservationData.customerName,
      phone: paymentReservationData.customerPhone,
      email: paymentReservationData.customerEmail,
      vehicle: paymentReservationData.vehicle,
      plan: paymentReservationData.plan,
      checkin: paymentReservationData.checkin,
      checkout: paymentReservationData.checkout,
      status: "Paid",
      amount: Number(paymentReservationData.amount || 0).toFixed(2),
      stripePaymentIntent: paymentIntent.id
    };
    saveReservation(r);
  } else {
    message.textContent = "Payment status: " + (paymentIntent?.status || "unknown");
  }

  submitButton.classList.remove("loading");
}

window.addEventListener("DOMContentLoaded", () => {
  const startButton = document.getElementById("startPaymentButton");
  const paymentForm = document.getElementById("payment-form");
  if(startButton) startButton.addEventListener("click", initializeStripePayment);
  if(paymentForm) paymentForm.addEventListener("submit", submitStripePayment);
});
