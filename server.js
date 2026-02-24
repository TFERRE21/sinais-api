require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const SECRET = "SUA_CHAVE_SUPER_SECRETA";

// Banco fake em memória (depois podemos usar Mongo)
let users = [];

/* ============================= */
/* REGISTRO */
/* ============================= */
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  const userExist = users.find((u) => u.email === email);
  if (userExist) {
    return res.status(400).json({ error: "Usuário já existe" });
  }

  const hash = await bcrypt.hash(password, 10);

  const newUser = {
    id: users.length + 1,
    email,
    password: hash,
    vip: false, // 🔥 começa sem VIP
  };

  users.push(newUser);

  res.json({ message: "Usuário criado com sucesso" });
});

/* ============================= */
/* LOGIN */
/* ============================= */
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = users.find((u) => u.email === email);
  if (!user) return res.status(400).json({ error: "Usuário não encontrado" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: "Senha inválida" });

  const token = jwt.sign(
    { id: user.id, email: user.email, vip: user.vip },
    SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token });
});

/* ============================= */
/* MIDDLEWARE AUTENTICAÇÃO */
/* ============================= */
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Token ausente" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

/* ============================= */
/* ROTA VIP PROTEGIDA */
/* ============================= */
app.get("/vip", auth, (req, res) => {
  if (!req.user.vip) {
    return res.status(403).json({ error: "Acesso apenas para VIP" });
  }

  const moedas = [
    { symbol: "BTCUSDT", rsi: 25.3, tendencia: "BAIXA", sinal: "COMPRA" },
    { symbol: "ETHUSDT", rsi: 40.2, tendencia: "ALTA", sinal: "NEUTRO" },
  ];

  res.json(moedas);
});

/* ============================= */
/* ATIVAR VIP (SIMULA PAGAMENTO) */
/* ============================= */
app.post("/ativar-vip", auth, (req, res) => {
  const user = users.find((u) => u.id === req.user.id);

  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

  user.vip = true;

  res.json({ message: "VIP ativado com sucesso" });
});

app.listen(3000, () => {
  console.log("Servidor rodando com sistema VIP 💎");
});