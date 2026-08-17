# DECISÕES DE ARQUITETURA — JETFUEL-SIM (a confirmar no deploy)

## A. Segurança & Auth (BLOQUEIA jogo público)
- **Problema**: RLS atual = `FOR ALL TO public USING (true)` em todas as tabelas.
  Isso expõe leitura/escrita/apagamento a qualquer um com a anon key (no bundle do cliente).
- `operadores_geral` tem coluna **`password`** (plaintext convidada) + flags
  `is_usuario/is_administrador/is_master` → escalada de privilégio trivial.
- **Decisão recomendada**:
  1. Habilitar **Supabase Auth** (email/senha + JWT).
  2. Remover coluna `password` própria; usar `auth.users`.
  3. RLS por `auth.uid()` em todas as tabelas de jogo.
  4. Tabelas de catálogo (companhias, aeronaves, posições) podem ser `SELECT public`.
  5. Rotacionar a anon key após o ajuste.

## B. Dois projetos Supabase (decisão de dados)
- **kznh…** = Jetfuel (operação/frota/operadores) — vai receber a camada de jogo.
- **ams-gru** (`awhpsclazkyqwdoziwdf`) = voos reais do GRU (`aircraft_active_tracking`).
- **Opções**:
  - (1) **Cross-project read** via Edge Function (kznh lê ams-gru) — mantém separado.
  - (2) **Consolidar** tudo no kznh (ETL periódico dos voos reais) — mais simples p/ jogo.
  - (3) **Sync n8n** (já existe node Consultar_Voos_AMS_GRU) → grava em kznh.
- **Recomendado**: (3) n8n já funciona, apenas apontar destino para kznh e criar
  tabela `flights` + `mesh_flights` no kznh.

## C. Cloudflare × server.ts
- `server.ts` (Express + Vite) **não roda** em Workers. Plano:
  - **Frontend** → Cloudflare Pages (build Vite `dist`).
  - **IA / simulação server-side** → Cloudflare Worker (ou Function) reproduzindo `/api/ai-insights`.
  - **Scrapers/ETL** → continuam em VPS/n8n (Python), escrevem no Supabase.
- Domínio **mlh.bobsimcom.br** → CNAME para Pages/Worker.

## D. Modelo de "bots BOB-*"
- Implementados como **skills curadas + persona** (leve, citável, sem infra extra).
- Instanciados via `delegate_task` quando o Anderson pede "chama o BOB-UX".
- Alternativa pesada (canais separados) fica como opção futura.

## E. Fonte de verdade de voos (tycoon)
- Voos reais do GRU alimentam o jogo; **situações são simuladas** (Motor de Adversidades).
- `flights` no kznh = snapshot dos voos reais + estado de jogo do LT.
