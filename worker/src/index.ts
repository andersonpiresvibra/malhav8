// Cloudflare Worker — Backend do JETFUEL-SIM
// Substitui server.ts (Express). Reproduz: GET /api/health, POST /api/ai-insights.
// LLM gratuito via Cloudflare Workers AI (sem chave externa; free tier da conta).

export interface Env {
  // Binding de Workers AI (configurado em wrangler.toml como [ai])
  AI: Ai;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function handleAiInsights(req: Request, env: Env): Promise<Response> {
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

  const system = `Você é o BOB, Engenheiro de Software Sênior e Arquiteto Técnico do sistema JETFUEL-SIM (antes MALHA) para Guarulhos (SBGR).
O usuário (Líder de Turno ou Diretor da BR Aviation/Vibra) está nos consultando: "${prompt}".

Estatísticas de pátio (simuladas, últimos 30 dias):
${JSON.stringify(context, null, 2)}

Responda em Português do Brasil, tom de amigo técnico de pátio ríspido porém prestativo, altamente especializado (Ground Handling). Use Markdown (sub-títulos '###' e listas com asteriscos).`;

  try {
    const result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    });

    const text =
      (result as any)?.response ||
      (result as any)?.text ||
      JSON.stringify(result);

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: (e as Error)?.message || "Internal server error" }),
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
