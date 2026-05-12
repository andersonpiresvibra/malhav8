# Architecture and Database Specs (SCHEMA)
## Sistema MALHA

### 1. Visão Arquitetural

#### 1.1 Stack Tecnológica Principal
- **Frontend / Cliente:** React 18+. Funcionalidades empacotadas via Vite SSR/SPA toolchains usando TypeScript rigoroso e Tailwind CSS nativo (v4 beta / postcss).
- **Componentização & UI Elements:** Lucide-react (Icons). Elementos estilizados semânticamente (`z-index` altamente regulados).
- **Backend-as-a-Service (BaaS) / Database / Sec:** Supabase. Banco relacional servindo o App via `supabase-js`, protegendo registros com Row Level Policies.

#### 1.2 Camadas Lógicas de Interface
- `App.tsx`: Controlador Root. Gerencia a barra lateral, views parciais e orquestra a máquina de estado principal e o fetch primário dos pools vitais (Frota, Operadores e Malha Base).
- `supabaseService.ts`: Gateway Isolado. Responsável exclusivo pelos requests HTTPs ou Sockets contra o banco, sanitizando os "camelCases" para "snake_cases". 
- **Modais / Portais:** Renderizam estritamente fora do fluxo flex padrão via "Portal Target" injetado no DOM, evadiendo recortes de colunas `overflow-hidden`. Z-Index começa em `z-[60]` para cabeçalhos até `z-[9999]` para overrides.

### 2. Supabase Models (PostgreSQL DDL)

*Esses mapeamentos definem os payloads e o contrato que o React envia para a REST API do Supabase.*

#### Tabelas de Infraestrutura:
**`operators`** (Entidade do trabalhador físico)
- `id`: UUID (PK)
- `full_name`: VARCHAR
- `war_name`: VARCHAR 
- `status`: VARCHAR ('ATIVO', 'FOLGA', 'FÉRIAS', 'AFASTADO')
- `role` / `category`: VARCHAR (Plano de carreira/senioridade)
- `is_lt`: VARCHAR (Flag para Liderança de Turno)
- `company_id`: VARCHAR (Matrícula Vibra)
- `gru_id`: VARCHAR (Matrícula GRU Airport)
- `vest_number`: VARCHAR (Coleta/ISO)
- `tmf_login`: VARCHAR (Sistemas internos)
- `email`: VARCHAR (Chave única de credenciais corporativas)
- `patio`: VARCHAR (Limites físicos operacionais locais)
- `shift_cycle`: VARCHAR (Turno predominante do Operador)
- `shift_start`, `shift_end`: VARCHAR/TIME (Horários previstos contratuais)

**`vehicles`** (Equipamentos de Rampa Móveis / Camiões de Resíduo e Abastecimento)
- `id`: UUID (PK)
- `prefix`: VARCHAR (Identidade de chamada rádio do veículo, Ex: "TRK-05")
- `type`: VARCHAR (Tipo de implemento e vazão por minuto)
- `status`: VARCHAR 

**`flights` / `flight_assignments`**
- Intercepta tráfego aéreo e associa *quem*, atende *qual voo*, *quando* e *onde*, juntando as PKs de opererators e vehicles sobre a malha de vôos provisionada pelo aeroporto ou coordenação manual.

---

### 3. Diretrizes de Segurança (Auth & Row Level Security)
- O sistema rodará sob sessões de colaboradores logados. 
- Componentes sensíveis exportam funções assíncronas que tratam explicitamente lógicas em falhas de inserção de banco de dados (`error.message`). No Frontend, trata-se o estado pessimista alertando o operador.
