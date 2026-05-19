# Product Requirements Document (PRD)
## Smart Ops Hub - Gestão de Malha (MALHA)

### 1. Visão Geral
O **MALHA** é um sistema SaaS de gestão de operações de abastecimento de aviação de alta performance e fidelidade. Desenvolvido para atuar na operação real do Aeroporto Internacional de Guarulhos (SBGR - Vibra/BR Aviation), o sistema automatiza e orquestra a complexa relação entre:
- Voos (chegadas e partidas).
- Veículos de Abastecimento (Unidades Abastecedoras - UA, e Servidores - SRV).
- Operadores e Escalas de Trabalho.

### 2. Público-Alvo e Personas
- **Coordenador do CCO (Centro de Controle Operacional):** Despacha os veículos e gerencia os incidentes. Opera via Telas do NOC (Network Operations Center). Precisa de visões focadas em *Dark Mode* para redução de fadiga visual, leitura de dados densos e alertas visuais de conflitos (voos atrasados, falta de contingente, ou gargalos em pátios específicos).
- **Líder de Turno (LT):** Avalia e remaneja presenças, ausências urgentes e alocações de última hora durante as janelas de pico (Peak Times).
- **Despachantes Administrativos:** Gerenciam o cadastro vitalício de funcionários, controle de escalas, conformidade técnica dos veículos (CTAs/SRVs) e parâmetros das Companhias Aéreas.

### 3. Escopo Funcional (Core Features)

#### 3.1. Visão Tática Completa (GridOps e MalhaAérea)
- **Dashboard Operacional:** Visualização unificada do status do aeroporto, controle por pátios e lista inteligente de voos.
- **Sincronização Bidirecional (Realtime):** Integração via WebSocket (Supabase Realtime) onde operadores e coordenadores vêem o estado exato dos calços, abastecimentos ativos e trocas de estágio (Máquina de Estados: Chegada -> Fila -> Designado -> Abastecendo -> Finalizado).

#### 3.2. Visões Administrativas e Cadastrais (Painéis Admin)
- **Operadores Admin:** Gestão de cadastro de RH, atribuições de lote, turnos e pausas da equipe.
- **Frota Admin:** Abstração do inventário físico; Caminhões Servidores e Caminhões Tanques.
- **Malha Raiz & Companhias:** Edição dos horários dos voos programados em malha e configuração de logotipos e SLAs das Cias aéreas.
- **Auditoria / Relatórios Técnicos:** Caixa-preta sistêmica. Logs invioláveis que retêm quem assinalou qual operador em que momento de evento tático. 

### 4. Escopo Não-Funcional (NFRs)
- **Single Source of Truth (SSoT):** Supabase (PostgreSQL). Toda iteração reflete na ponta via queries atômicas garantindo sincronização total.
- **Event-Driven & Optimistic Updates:** Respostas otimistas de UI, permitindo designações contínuas e hotkeys. Modais editam células em lote. Zero UI-Blocking para o controlador de pátio.
- **Dark Mode Enterprise UI:** Interface projetada densamente (Tailwind Slate, Emerald e Amber) priorizando cores semânticas restritas, reduzindo o tempo de reflexo e a percepção de ofuscamento visual noturno.

