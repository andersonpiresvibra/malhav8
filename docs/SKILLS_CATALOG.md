# CATÁLOGO DE SKILLS VERIFICADAS — JETFUEL-SIM

> Curadoria por disciplina (agentes BOB-*). Status: ✅ já no repo · 🔍 recomendada (verificar fonte) · ⛔ não usar sem revisão.

## Banco de Dados (BOB-DB)
- ✅ `supabase/agent-skills` → `supabase` (skills-lock.json)
- ✅ `supabase/agent-skills` → `supabase-postgres-best-practices`
- 🔍 `Prisma` docs oficiais (prisma.io) — schema tipado, migrações
- 🔍 `postgres` official samples (github.com/postgres)

## Frontend / JS (BOB-JS, BOB-UX)
- ✅ `anthropics/skills` → `frontend-design` (design system, a11y)
- 🔍 `Tailwind CSS v4` docs oficiais
- 🔍 `react` official patterns (react.dev)
- ⛔ skills de "ui magic" de fontes obscuras

## Python (BOB-Python)
- ✅ `anthropics/skills` → `python-expert` (verificar nome exato)
- 🔍 `FastAPI` official `tiangolo` samples
- 🔍 `BeautifulSoup`/`httpx` oficiais para scrapers

## GIS / ADS-B / RTLS (BOB-GIS)
- 🔍 `openSky` API official (ADS-B)
- 🔍 `leaflet`/`mapbox-gl` docs oficiais
- 🔍 `deck.gl` (geo dataviz) oficial

## Automação (BOB-Auto)
- ✅ n8n (já em uso: node Consultar_Voos_AMS_GRU)
- 🔍 `zapier` official, `supabase Edge Functions` docs

## Unity / Unreal (BOB-Unity, BOB-Unreal)
- 🔍 `Unity` learn oficial / `unreal-engine` docs
- ⛔ assets de "free game kit" de fórum sem verificação de licença

## Segurança / Revisão (todos)
- ✅ `requesting-code-review` (já no Hermes)
- ✅ `systematic-debugging` (já no Hermes)

## Próximo passo
Verificar hashes e fontes das 🔍 via web_search, aplicar SECURITY_REVIEW.md,
adicionar ao skills-lock.json. Nenhuma skill externa instalada nesta fase sem OK do Anderson.
