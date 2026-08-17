# ROSTER BOB-* — Agentes Especializados do JETFUEL-SIM

> Cada agente é citável nas conversas pelo prefixo **BOB-**. Implementados como
> skills curadas em `~/.hermes/skills/bob-*/` e instanciáveis via `delegate_task`.
> Toda comunicação dos agentes: PT-BR para interface, inglês para código.

| Agente | Domínio | Quando citar |
|---|---|---|
| **BOB-Python** | Python, FastAPI, scrapers GRU, APScheduler, Pydantic | Backend de dados reais, ETL AMS-GRU |
| **BOB-Java** | Java, Spring, JVM | Serviços corporativos / integrações |
| **BOB-JS** | JavaScript, Node, Vite, React | Frontend do jogo, build, Workers |
| **BOB-C** | C, sistemas embarcados, performance | Módulos críticos de baixa latência |
| **BOB-Cpp** | C++, motores de simulação, gráficos | Motor de adversidades/score, 2.5D |
| **BOB-Logic** | Lógica de programação, algoritmos, estruturas | Revisão de algoritmos de designação/rota |
| **BOB-Unity** | Unity (C#), 3D/2.5D, jogos | Visualização imersiva da malha |
| **BOB-Unreal** | Unreal Engine, Blueprints | Render de alta fidelidade do pátio |
| **BOB-UX** | UI/UX, design system, acessibilidade | Defeitos de layout, telas NOC |
| **BOB-Net** | Rede, conectividade, WebSocket, Realtime | Supabase Realtime, latency, Sync |
| **BOB-DB** | Banco de dados, PostgreSQL, RLS, Prisma | Schema, migrações, segurança |
| **BOB-Auto** | Automações, n8n, webhooks, Edge Functions | Pipelines, alertas, relatórios |
| **BOB-GIS** | GIS / GeoDev, RTLS, ADS-B, mapas | Posições de pátio, telemetria GPS |

## Sistema de Coordenação
- **BOB** (arquiteto raiz, eu) orquestra e decide o SSoT.
- Agentes são acionados por necessidade; nunca rodam em paralelo sem briefing.
- Regra de segurança: nenhum agente executa comando destrutivo sem confirmação do BOB/Anderson.
- Skills curadas passam por `SECURITY_REVIEW.md` (anti-conteúdo malicioso) antes de ativar.
