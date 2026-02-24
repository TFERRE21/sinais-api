const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { RSI, EMA } = require("technicalindicators");

const app = express();
app.use(cors());
app.use(express.json());

async function calcularIndicadores(symbol) {
  try {
    const response = await axios.get(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=100`
    );

    const closes = response.data.map((c) => parseFloat(c[4]));

    const rsi = RSI.calculate({
      values: closes,
      period: 14,
    });

    const ema9 = EMA.calculate({
      values: closes,
      period: 9,
    });

    const ema21 = EMA.calculate({
      values: closes,
      period: 21,
    });

    const ultimoRSI = rsi[rsi.length - 1];
    const ultimaEMA9 = ema9[ema9.length - 1];
    const ultimaEMA21 = ema21[ema21.length - 1];

    let sinal = "NEUTRO";
    let tendencia = "LATERAL";

    if (ultimoRSI < 30) sinal = "COMPRA";
    if (ultimoRSI > 70) sinal = "VENDA";

    if (ultimaEMA9 > ultimaEMA21) tendencia = "ALTA";
    if (ultimaEMA9 < ultimaEMA21) tendencia = "BAIXA";

    return {
      symbol,
      rsi: ultimoRSI.toFixed(2),
      sinal,
      tendencia,
    };
  } catch (err) {
    return null;
  }
}

// ROTA FREE (30 moedas)
app.get("/free", async (req, res) => {
  try {
    const response = await axios.get(
      "https://api.binance.com/api/v3/ticker/24hr"
    );

    const moedas = response.data
      .filter((m) => m.symbol.endsWith("USDT"))
      .slice(0, 30);

    const resultados = await Promise.all(
      moedas.map((moeda) =>
        calcularIndicadores(moeda.symbol)
      )
    );

    res.json(resultados.filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: "Erro no free" });
  }
});

// ROTA VIP (100 moedas)
app.get("/vip", async (req, res) => {
  try {
    const response = await axios.get(
      "https://api.binance.com/api/v3/ticker/24hr"
    );

    const moedas = response.data
      .filter((m) => m.symbol.endsWith("USDT"))
      .slice(0, 100);

    const resultados = await Promise.all(
      moedas.map((moeda) =>
        calcularIndicadores(moeda.symbol)
      )
    );

    res.json(resultados.filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: "Erro no vip" });
  }
});

app.get("/", (req, res) => {
  res.send("API Sinais PRO funcionando 🚀");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});