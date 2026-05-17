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
- **Despachantes Administrativos:** Gerenciam o cadastro vitalício de funcionários, controle de escalas longas, conformidade de cursos, IPEM/DER (dos caminhões) e manutenções agendadas.

### 3. Escopo Funcional (Core Features)

#### 3.1. Visão Tática Completa (GridOps)
- **Dashboard Operacional:** Visualização unificada do status do aeroporto, controle por pátios e lista inteligente de voos.
- **Filtros Avançados Inteligentes:** Ao buscar um operador/voo/veículo, a UI deve reagir não só deselecionando estados anteriores focando o fluxo do tráfego.

#### 3.2. Gerenciamento Cadastral e de Força de Trabalho (Operators Admin)
- Cadastro de Dados da Força: Foto, Nome de Guerra, Matrículas Corporativas (VB/GRU), Lotação e Turno.
- Escalas Bidimensionais: Calendários que acusam faltas, atestados e presenças. 

#### 3.3. Gerenciamento de Frota (Fleets Admin)
- Abstração do inventário físico dos pátios.
- Capacidades Nominais e de Resíduo de galões dos Veículos.

#### 3.4. Motor de "Virada de Dia" (End of Day Routine)
- Lógica temporal sofisticada para processamento de rotinas à 00h00, convertendo eventos do dia, zerando estados não-críticos de malha temporal, e populando logs diários passados para análise de performance de entrega de combustíveis.

### 4. Escopo Não-Funcional (NFRs)
- **Single Source of Truth (SSoT):** Supabase (PostgreSQL). Dados não sobrevivem localmente caso modifiquem relatórios ou estruturas. É um ambiente multi-inquilino/multi-client.
- **Event-Driven UI:** Modais com hotkeys seguras (e.g. `Esc`), edições otimizadas baseadas na familiaridade que CCOs têm com Microsoft Excel (edita células em lote on-the-fly, atalhos de Tab e Enter rápidos).
- **Zero UI-Blocking:** O usuário jamais pode ser travado de interagir na malha enquanto o banco salva. Implementação obrigatória de "Optimistic Updates". 
- **Dark Mode Enterprise UI:** Interface tailwind "slate" e densidade informacional de altíssimo calibre priorizando cores semânticas restritas: Esmeralda para Acordos e Sucessos, Alertas vermelhos para quebra de SLAs em tempos de calço.
