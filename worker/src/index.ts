// Cloudflare Worker — Backend do JETFUEL-SIM
// Substitui server.ts (Express) que NÃO roda em Workers.
// Reproduz: GET /api/health, POST /api/ai-insights (Gemini)

import { GoogleGenAI } from "@google/genai";

export interface Env {
  GEMINI_API_KEY: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function handleAiInsights(req: Request, env: Env): Promise<Response> {
  if (!env.GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: "API key missing" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const { prompt, context } = body;
  if (!prompt) {
    return new Response(JSON.stringify({ error: "Prompt required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Você é o BOB, Engenheiro de Software Sênior e Arquiteto Técnico do sistema MALHA para Guarulhos (SBGR).
O usuário (Líder de Turno ou Diretor da BR Aviation/Vibra) está nos consultando com a seguinte pergunta: "${prompt}".

Abaixo estão as estatísticas agregadas de pátio simuladas dos últimos 30 dias de voo do aeródromo:
${JSON.stringify(context, null, 2)}

Sua resposta em Português do Brasil deve ter um tom de amigo técnico de pátio ríspido, porém prestativo, altamente especializado (Ground Handling). Use formato Markdown (sub-títulos h4 '###' ou '####', e asteriscos para listas).`,
    });

    return new Response(JSON.stringify({ text: response.text }), {
      status: 200,
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: CORS_HEADERS });
    }

    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    if (url.pathname === "/api/ai-insights" && req.method === "POST") {
      return handleAiInsights(req, env);
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  },
};
