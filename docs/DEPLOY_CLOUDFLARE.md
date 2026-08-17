# DEPLOY CLOUDFLARE — JETFUEL-SIM (MALHA)

> Domínio alvo: **mlh.bobsimcom.br**
> Arquitetura: Frontend em **Pages** (static dist) + Backend IA em **Worker** (substitui server.ts).

## 1. Pré-requisitos
- Conta Cloudflare com o domínio `bobsimcom.br` gerenciado.
- `wrangler` instalado: `npm i -g wrangler` (ou `npx wrangler`).
- Login: `wrangler login`.

## 2. Variáveis de ambiente (Build do frontend)
O `vite.config.ts` injeta em build time:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` → definir em **Pages → Settings → Build & deployments → Environment variables**.
- `GEMINI_API_KEY` → usado só no Worker (secret).

## 3. Deploy do FRONTEND (Pages)
```bash
npm install
npm run build          # gera dist/
wrangler pages deploy dist --project-name malha
```
- O `public/_routes.json` garante SPA fallback (`/*`) e deixa `/api/*` fora do Pages.
- **Custom domain:** Pages → Custom domains → add `mlh.bobsimcom.br`.

## 4. Deploy do BACKEND IA (Worker)
```bash
cd worker
wrangler secret put GEMINI_API_KEY    # cole a chave do Gemini
wrangler deploy
```
- Endpoint: `https://malha-api.<subdomain>.workers.dev` (ou rota custom `api.mlh.bobsimcom.br`).
- Reproduz `/api/health` e `/api/ai-insights`.

## 5. Conectar frontend → Worker
No frontend, ajustar a chamada de IA para a URL do Worker:
`const AI_ENDPOINT = import.meta.env.VITE_AI_API_URL || '/api/ai-insights'`
(definir `VITE_AI_API_URL` nas env do Pages apontando para o Worker).

## 6. Observações
- `server.ts` (Express) fica **obsoleto** no Cloudflare; mantido só p/ dev local.
- `metadata.json` indica `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` — confirmar no painel do AI Studio se há binding automático; se sim, o Worker pode não ser necessário (mas é a forma portável).
- RLS do Supabase deve permitir a anon key do cliente (já configurado em ARCHITECTURE_DECISIONS.md).
