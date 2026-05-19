# Architecture and Database Specs (SCHEMA)
## Sistema MALHA

### 1. Visão Arquitetural

#### 1.1 Stack Tecnológica Principal
- **Frontend / Cliente:** React 19+. Funcionalidades empacotadas via Vite SSR/SPA toolchains usando TypeScript rigoroso e Tailwind CSS nativo (v4 beta / postcss).
- **Componentização & UI Elements:** Lucide-react (Icons). Elementos estilizados semânticamente (`z-index` altamente regulados).
- **Backend-as-a-Service (BaaS) / Database / Sec:** Supabase. Banco relacional servindo o App via `supabase-js`, protegendo registros com Row Level Policies.

#### 1.2 Camadas Lógicas de Interface
- `App.tsx`: Controlador Root. Gerencia a barra lateral, views parciais e orquestra a máquina de estado principal e o fetch primário dos pools vitais.
- `supabaseService.ts`: Gateway Isolado. Responsável exclusivo pelos requests RPC/Realtime/Rest contra o banco, sanitizando payloads do Typescript.
- **Modais / Portais:** Renderizam estritamente fora do fluxo flex padrão via "Portal Target" injetado no DOM, evadiendo recortes de colunas `overflow-hidden`. Z-Index começa em `z-[60]` para cabeçalhos (e.g. `subheader-portal-target`) até `z-[9990]` para modais de override.

### 2. Supabase Models (PostgreSQL DDL)

*Esses mapeamentos definem os payloads e o contrato que o React envia para a REST API do Supabase.*

#### Tabelas de Infraestrutura e HR:
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
- `shift_cycle` / `shift_start` / `shift_end`: Lógicas de Turno e Horários

**`vehicles`** (Equipamentos de Rampa Móveis / Camiões de Resíduo e Abastecimento)
- `id`: UUID (PK)
- `prefix`: VARCHAR (Identidade de chamada rádio do veículo, Ex: "TRK-05")
- `type`: VARCHAR ("CTA" | "SRV")
- `status`: VARCHAR 

**`companhias` (airlines)** (Entidades das Companhias Aéreas)
- `id`: UUID (PK)
- `legal_name`, `airline` (Nome Fantasia)
- `airline_code` (IATA/ICAO 2 Letters/3 Letters, ex: 'JJ', 'G3')
- `logo_url`: TEXT

**`aircrafts`** (Aeronaves por companhia aérea)
- `id`: UUID (PK)
- `model`: VARCHAR
- `prefix`: VARCHAR (Registro da aeronave)
- `companhia_id`: UUID (FK -> companhias)
- *Flags de integridade operacional:* `missing_cap`, `defective_door`, `no_autocut`

#### Malha de Voos:
**`flights`** (Eventos Isolados Diários da Malha Real)
- Reflete PKs de `operators`, `vehicles`, `aircrafts` e `companhias` sobre a malha aeroviária atuando como Source of Truth dos serviços ativos em campo. Status de Máquina: "CHEGADA", "FILA", "DESIGNADO", "ABASTECENDO", "FINALIZADO".

**`mesh_flights`** (Templates Base da Malha Raiz do Aeródromo)
- Utilizados como base ou blueprints cíclicos para popular o banco de dados caso conexões HOT do aeroporto não surtam efeito.

---

### 3. Diretrizes de Segurança e Auditoria (RLS)
- O sistema rodará sob sessões de colaboradores logados. 
- Auditoria via Triggers ou Tabelas Log de eventos (Ex: Caixa Preta/Report Input) para rastrear tempos de início, delays e calço.
