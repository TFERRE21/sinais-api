const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// Rota principal (teste)
app.get("/", (req, res) => {
  res.send("🚀 API de Sinais funcionando!");
});

// Rota de sinais
app.get("/sinais", async (req, res) => {
  try {
    const response = await axios.get(
      "https://api.binance.com/api/v3/ticker/24hr"
    );

    const moedas = response.data
      .filter((m) => m.symbol.endsWith("USDT"))
      .sort(
        (a, b) =>
          parseFloat(b.priceChangePercent) -
          parseFloat(a.priceChangePercent)
      )
      .slice(0, 10)
      .map((m) => ({
        symbol: m.symbol,
        price: m.lastPrice,
        priceChangePercent: m.priceChangePercent,
      }));

    res.json(moedas);
  } catch (error) {
    console.error("Erro ao buscar dados:", error.message);
    res.status(500).json({
      error: "Erro ao buscar dados da Binance",
    });
  }
});

// Porta para Render (obrigatório)
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});