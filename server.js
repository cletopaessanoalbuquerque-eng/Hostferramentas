import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { MercadoPagoConfig, Preference } from "mercadopago";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set("trust proxy", 1);
app.use(express.json());

// O Access Token fica SÓ aqui no servidor, via variável de ambiente
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// Preços definidos no servidor (o cliente nunca manda o valor)
const CATALOGO = {
  cpagin: { nome: "C.Pagin", mensal: 1200, semanal: 315 },
  pd:     { nome: "PD",      mensal: 190,  semanal: 50 },
  ed:     { nome: "ED",      mensal: 2500, semanal: 700 },
  kremoto:{ nome: "K Remoto",mensal: 3000, semanal: 800 },
  cc:     { nome: "C.C",     mensal: 800,  semanal: 210 },
};

// Serve só a página do site (nenhum outro arquivo fica exposto)
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.post("/criar-pagamento", async (req, res) => {
  try {
    const { ferramenta, plano } = req.body; // plano: "mensal" | "semanal"
    const item = CATALOGO[ferramenta];
    if (!item || !["mensal", "semanal"].includes(plano)) {
      return res.status(400).json({ erro: "Ferramenta ou plano inválido" });
    }
    const site = process.env.SITE_URL || `${req.protocol}://${req.get("host")}`;
    const result = await new Preference(client).create({
      body: {
        items: [{
          id: `${ferramenta}-${plano}`,
          title: `${item.nome} - plano ${plano}`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: item[plano],
        }],
        back_urls: {
          success: `${site}/?pagamento=sucesso`,
          failure: `${site}/?pagamento=falhou`,
          pending: `${site}/?pagamento=pendente`,
        },
        // auto_return só funciona com URL pública https
        ...(site.startsWith("https") ? { auto_return: "approved" } : {}),
      },
    });
    res.json({ url: result.init_point });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: "Falha ao criar pagamento" });
  }
});

app.listen(process.env.PORT || 3000, () => console.log("Servidor rodando"));
