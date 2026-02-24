const express = require("express");
const axios = require("axios");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { RSI, EMA } = require("technicalindicators");

const app = express();
app.use(cors());
app.use(express.json());

const SECRET = "sinais_pro_secret";

// Simulação banco de dados
let usuarios = [];

// ================== LOGIN ==================

app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  const userExist = usuarios.find((u) => u.email === email);
  if (userExist)
    return res.status(400).json({ error: "Usuário já existe" });

  const hash = await bcrypt.hash(password, 10);

  usuarios.push({
    email,
    password: hash,
    vip: true,
  });

  res.json({ message: "Usuário criado com sucesso" });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = usuarios.find((u) => u.email === email);
  if (!user)
    return res.status(400).json({ error: "Usuário não encontrado" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid)
    return res.status(400).json({ error: "Senha inválida" });

  const token = jwt.sign(
    { email: user.email, vip: user.vip },
    SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token });
});

// ================== MIDDLEWARE ==================

function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header)
    return res.status(401).json({ error: "Token ausente" });

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// ================== INDICADORES ==================

async function calcularIndicadores(symbol) {
  try {
    const response = await axios.get(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=100`
    );

    const closes = response.data.map((c) => parseFloat(c[4]));

    const rsi = RSI.calculate({ values: closes, period: 14 });
    const ema9 = EMA.calculate({ values: closes, period: 9 });
    const ema21 = EMA.calculate({ values: closes, period: 21 });

    const ultimoRSI = rsi[rsi.length - 1];
    const ultimaEMA9 = ema9[ema9.length - 1];
    const ultimaEMA21 = ema21[ema21.length - 1];

    let sinal = "NEUTRO";
    if (ultimoRSI < 30) sinal = "COMPRA";
    if (ultimoRSI > 70) sinal = "VENDA";

    let tendencia = "LATERAL";
    if (ultimaEMA9 > ultimaEMA21) tendencia = "ALTA";
    if (ultimaEMA9 < ultimaEMA21) tendencia = "BAIXA";

    return {
      symbol,
      rsi: ultimoRSI.toFixed(2),
      sinal,
      tendencia,
    };
  } catch {
    return null;
  }
}

// ================== FREE ==================

app.get("/free", async (req, res) => {
  const response = await axios.get(
    "https://api.binance.com/api/v3/ticker/24hr"
  );

  const moedas = response.data
    .filter((m) => m.symbol.endsWith("USDT"))
    .slice(0, 30);

  const resultados = await Promise.all(
    moedas.map((m) => calcularIndicadores(m.symbol))
  );

  res.json(resultados.filter(Boolean));
});

// ================== VIP PROTEGIDO ==================

app.get("/vip", auth, async (req, res) => {
  if (!req.user.vip)
    return res.status(403).json({ error: "Acesso VIP necessário" });

  const response = await axios.get(
    "https://api.binance.com/api/v3/ticker/24hr"
  );

  const moedas = response.data
    .filter((m) => m.symbol.endsWith("USDT"))
    .slice(0, 100);

  const resultados = await Promise.all(
    moedas.map((m) => calcularIndicadores(m.symbol))
  );

  res.json(resultados.filter(Boolean));
});

app.listen(3000, () => {
  console.log("Servidor rodando com login 🚀");
});