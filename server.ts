import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import https from "https";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Custom CORS middleware
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: "5mb" }));

  // API Route FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Lazy initialize GoogleGenAI
  let aiClient: GoogleGenAI | null = null;
  function getAIClient() {
    if (!aiClient) {
      const key = process.env.GEMINI_API_KEY;
      if (!key) {
        throw new Error("GEMINI_API_KEY is missing");
      }
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    }
    return aiClient;
  }

  app.post("/api/ai-insights", async (req: express.Request, res: express.Response) => {
    try {
      const { prompt, context } = req.body;
      const key = process.env.GEMINI_API_KEY;
      if (!key) {
        // Return 404 to let front-end use its robust custom fallback
        return res.status(404).json({ error: "API key missing" });
      }

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `Você é o BOB, Engenheiro de Software Sênior e Arquiteto Técnico do sistema MALHA para Guarulhos (SBGR).
O usuário (Líder de Turno ou Diretor da BR Aviation/Vibra) está nos consultando com a seguinte pergunta: "${prompt}".

Abaixo estão as estatísticas agregadas de pátio simuladas dos últimos 30 dias de voo do aeródromo:
${JSON.stringify(context, null, 2)}

Sua resposta em Português do Brasil deve ter um tom de amigo técnico de pátio ríspido, porém prestativo, altamente especializado (Ground Handling), mantendo rigidez contra a exclusão do histórico de 7 dias proposto pela TI da empresa, provando por A + B que a persistência de 30 dias é vital para este modelo. Use formato Markdown (sempre use sub-títulos h4 '###' ou '####' em vez de h1/h2 ou h3, para não estourar a estrutura, e use asteriscos para listas).`
      });

      res.json({ text: response.text });
    } catch (e: any) {
      console.error("[Gemini Server Error]", e);
      res.status(500).json({ error: e.message || "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[MALHA SSoT ENGINE] Servidor operacional na porta ${PORT}`);
  });
}

startServer();
