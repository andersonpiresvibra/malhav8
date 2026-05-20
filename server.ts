import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import https from "https";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "5mb" }));

  // API Route FIRST: Real scraping endpoint
  app.get("/api/scrape-ams", async (req, res) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500); // 6.5s timeout

      // Attempt to fetch departures from ams.gru.com.br
      const response = await fetch("http://ams.gru.com.br/departure.html", {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
        }
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Falha HTTP ao contatar GRU: Código ${response.status}`);
      }

      const html = await response.text();
      const flightsParsed = parseAmsHtml(html);

      res.json({
        success: true,
        source: "LIVE_SCRAPER_GRU",
        data: flightsParsed,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.warn("[Scraper AMS] Conexão falhou ao acessar o servidor privado da GRU:", err.message);
      res.json({
        success: false,
        source: "OFFLINE_COMPATIBILITY_MODE",
        error: "UNREACHABLE_HOST",
        details: "O domínio ams.gru.com.br é restrito à intranet do aeroporto de Guarulhos e não pôde ser acessado de servidores externos públicos na nuvem (Cloud Run). Requer proxy de rede ou VPN interna.",
        message: err.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // API Route to parse user-provided HTML (solves 100% of firewall limitations)
  app.post("/api/parse-ams-html", (req, res) => {
    const { html } = req.body;
    if (!html) {
      return res.status(400).json({ success: false, error: "Nenhum código HTML fornecido." });
    }

    try {
      const parsed = parseAmsHtml(html);
      res.json({
        success: true,
        source: "USER_PROVIDED_HTML",
        data: parsed,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: "Falha ao processar código HTML.", details: err.message });
    }
  });

  // API Route for OpenSky Live Radar through high-limit registered account proxy
  app.get("/api/opensky-states", async (req, res) => {
    const { lamin, lamax, lomin, lomax } = req.query;
    
    // Fallback to Guarulhos (SBGR) ~150km box if not supplied
    const minLat = lamin || "-24.9356";
    const maxLat = lamax || "-21.9356";
    const minLon = lomin || "-47.9731";
    const maxLon = lomax || "-44.9731";

    const username = process.env.OPENSKY_USERNAME || "andersonpires.vibra@gmail.com-api-client";
    const password = process.env.OPENSKY_PASSWORD || "gRfV7DxFDCdhhoUMWfzFL7sTDaExyNPI";

    const authHeader = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
    
    const url = `https://opensky-network.org/api/states/all?lamin=${minLat}&lamax=${maxLat}&lomin=${minLon}&lomax=${maxLon}`;

    try {
      const data: any = await new Promise((resolve, reject) => {
        const options = {
          headers: {
            "Authorization": authHeader,
            "User-Agent": "MALHA-SaaS-Enterprise-Engine/1.0",
            "Accept": "application/json"
          },
          timeout: 15000 // 15 seconds
        };

        const reqGet = https.get(url, options, (httpRes) => {
          const statusCode = httpRes.statusCode || 0;
          
          if (statusCode === 401) {
            return reject(new Error("Credenciais do OpenSky inválidas ou não autorizadas (erro 401). Certifique-se de que o usuário/senha estão corretos."));
          }
          if (statusCode === 429) {
            return reject(new Error("Limite de requisições excedido na API do OpenSky (erro 429). Aguarde alguns minutos antes de tentar novamente."));
          }
          if (statusCode < 200 || statusCode >= 300) {
            return reject(new Error(`OpenSky API retornou erro HTTP ${statusCode}`));
          }

          let responseBody = "";
          httpRes.on("data", (chunk) => {
            responseBody += chunk;
          });

          httpRes.on("end", () => {
            try {
              const parsed = JSON.parse(responseBody);
              resolve(parsed);
            } catch (e: any) {
              reject(new Error("Falha ao processar resposta JSON do OpenSky: " + e.message));
            }
          });
        });

        reqGet.on("error", (err) => {
          reject(err);
        });

        reqGet.on("timeout", () => {
          reqGet.destroy();
          reject(new Error("TimeoutError"));
        });
      });

      res.json({
        success: true,
        auth_mode: "REGISTERED_USER_MODE",
        states: data.states || [],
        timestamp: new Date().toISOString()
      });

    } catch (err: any) {
      let friendlyMessage = err.message;
      if (err.message === "TimeoutError" || err.code === "ETIMEDOUT") {
        friendlyMessage = "A requisição ao radar OpenSky excedeu o tempo limite seguro de resposta (15s). O servidor do OpenSky Network pode estar temporariamente lento ou saturado. Tente novamente em alguns segundos.";
      } else if (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN") {
        friendlyMessage = "Erro de resolução de rede (DNS) ao tentar conectar ao OpenSky Network. Por favor, verifique se a conexão está estável.";
      } else if (err.message?.includes("fetch failed")) {
        friendlyMessage = "Falha de socket ou handshake SSL de rede com o OpenSky. O sistema de proxy se restabelecerá automaticamente.";
      }
      
      console.error("[OpenSky API Proxy Error]:", friendlyMessage, err);
      res.status(200).json({
        success: false,
        error: "OPENSKY_FETCHER_ERROR",
        message: friendlyMessage,
        timestamp: new Date().toISOString()
      });
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

// Resilient HTML Parser leveraging fast V8 Engine structures
function parseAmsHtml(html: string): any[] {
  const flights: any[] = [];
  
  // Scans for table rows
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  
  let match;
  let isFirstRow = true;
  
  while ((match = trRegex.exec(html)) !== null) {
    const rowHtml = match[1];
    const cells: string[] = [];
    let cellMatch;
    
    while ((cellMatch = tdRegex.exec(rowHtml)) !== null) {
      const val = cellMatch[1].replace(/<[^>]*>/g, "").replace(/&nbsp;/g, "").trim();
      cells.push(val);
    }
    
    if (cells.length >= 7) {
      // Skips headers by checking if cells hold title text
      const isHeader = cells.some(c => c.toLowerCase().includes("voo") || c.toLowerCase().includes("destino") || c.toLowerCase().includes("terminal") || c.toLowerCase().includes("prefixo"));
      if (isHeader) {
        continue;
      }

      // Hour, Destination, Airline, Flight, Codeshare, Terminal, Box, Registration, Model, Estimated
      const hour = cells[0] || "";
      const destination = cells[1] || "";
      const airlineCode = cells[2] || "";
      const flightNum = cells[3] || "";
      const terminal = cells[5] || "";
      const box = cells[6] || "";
      const registration = cells[7] || "";
      const model = cells[8] || "";
      const estimated = cells[9] || "";
      
      if (flightNum || registration) {
        flights.push({
          hour,
          destination,
          airlineCode: airlineCode.toUpperCase().trim(),
          flightNumber: flightNum.toUpperCase().trim(),
          terminal,
          box: box.toUpperCase().trim(),
          registration: registration.toUpperCase().trim(),
          model,
          estimated
        });
      }
    }
  }
  
  return flights;
}

startServer();
