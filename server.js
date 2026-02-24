require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const Stripe = require("stripe");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.json());

const SECRET = "SUA_CHAVE_SUPER_SECRETA";

// 🔥 Banco temporário (vamos trocar depois por Mongo)
let users = [];

/* ======================== */
/* REGISTRO */
/* ======================== */
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (users.find((u) => u.email === email)) {
    return res.status(400).json({ error: "Usuário já existe" });
  }

  const hash = await bcrypt.hash(password, 10);

  users.push({
    id: users.length + 1,
    email,
    password: hash,
    vip: false,
    stripeCustomerId: null,
  });

  res.json({ message: "Usuário criado" });
});

/* ======================== */
/* LOGIN */
/* ======================== */
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = users.find((u) => u.email === email);
  if (!user) return res.status(400).json({ error: "Usuário não encontrado" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: "Senha inválida" });

  const token = jwt.sign(user, SECRET, { expiresIn: "7d" });

  res.json({ token });
});

/* ======================== */
/* AUTH */
/* ======================== */
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token ausente" });

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

/* ======================== */
/* VIP */
/* ======================== */
app.get("/vip", auth, (req, res) => {
  if (!req.user.vip) {
    return res.status(403).json({ error: "Acesso VIP necessário" });
  }

  res.json([{ symbol: "BTCUSDT", rsi: 30, sinal: "COMPRA" }]);
});

/* ======================== */
/* CHECKOUT */
/* ======================== */
app.post("/create-checkout-session", auth, async (req, res) => {
  const user = users.find((u) => u.id === req.user.id);

  const customer = await stripe.customers.create({
    email: user.email,
  });

  user.stripeCustomerId = customer.id;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    customer: customer.id,
    line_items: [
      {
        price_data: {
          currency: "brl",
          product_data: {
            name: "Assinatura VIP Cripto",
          },
          recurring: { interval: "month" },
          unit_amount: 4900,
        },
        quantity: 1,
      },
    ],
    success_url: "https://google.com",
    cancel_url: "https://google.com",
  });

  res.json({ url: session.url });
});

/* ======================== */
/* WEBHOOK STRIPE */
/* ======================== */
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const user = users.find(
      (u) => u.stripeCustomerId === session.customer
    );

    if (user) {
      user.vip = true;
      console.log("VIP ativado automaticamente 💎");
    }
  }

  res.json({ received: true });
});

app.listen(3000, () => {
  console.log("Servidor Stripe com Webhook rodando 💰");
});