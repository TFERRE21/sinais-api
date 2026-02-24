require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Stripe = require("stripe");
const fs = require("fs");

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SECRET = "SUA_CHAVE_SECRETA_JWT";

/* ===================================
   BANCO SIMPLES JSON
=================================== */

const readUsers = () => {
  if (!fs.existsSync("users.json")) {
    fs.writeFileSync("users.json", JSON.stringify([]));
  }
  const data = fs.readFileSync("users.json");
  return JSON.parse(data);
};

const saveUsers = (users) => {
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));
};

/* ===================================
   REGISTRO
=================================== */

app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  let users = readUsers();

  if (users.find((u) => u.email === email)) {
    return res.status(400).json({ error: "Usuário já existe" });
  }

  const hash = await bcrypt.hash(password, 10);

  users.push({
    email,
    password: hash,
    isVip: false,
  });

  saveUsers(users);

  res.json({ message: "Usuário criado com sucesso" });
});

/* ===================================
   LOGIN
=================================== */

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  let users = readUsers();
  const user = users.find((u) => u.email === email);

  if (!user) return res.status(400).json({ error: "Usuário não encontrado" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: "Senha inválida" });

  const token = jwt.sign(
    { email: user.email, isVip: user.isVip },
    SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token });
});

/* ===================================
   MIDDLEWARE AUTH
=================================== */

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

/* ===================================
   ROTA VIP PROTEGIDA
=================================== */

app.get("/vip", auth, (req, res) => {
  if (!req.user.isVip) {
    return res.status(403).json({ error: "Acesso VIP necessário" });
  }

  res.json([
    { symbol: "BTCUSDT", rsi: 28.4, sinal: "COMPRA" },
    { symbol: "ETHUSDT", rsi: 60.1, sinal: "NEUTRO" },
  ]);
});

/* ===================================
   CRIAR CHECKOUT STRIPE
=================================== */

app.post("/create-checkout-session", auth, async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],

      // 🔥 MUITO IMPORTANTE
      customer_email: req.user.email,

      mode: "payment",

      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: "Acesso VIP - Sinais Cripto",
            },
            unit_amount: 1990, // R$19,90
          },
          quantity: 1,
        },
      ],

      success_url: "https://google.com",
      cancel_url: "https://google.com",
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar sessão" });
  }
});

/* ===================================
   WEBHOOK STRIPE
=================================== */

app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log("Erro webhook:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email = session.customer_email;

    console.log("🔥 Pagamento confirmado para:", email);

    let users = readUsers();

    const userIndex = users.findIndex((u) => u.email === email);

    if (userIndex !== -1) {
      users[userIndex].isVip = true;
      console.log("💎 Usuário virou VIP:", email);
      saveUsers(users);
    }
  }

  res.json({ received: true });
});

/* ===================================
   SERVER
=================================== */

app.listen(PORT, () => {
  console.log("Servidor Stripe com VIP automático rodando 🚀");
});