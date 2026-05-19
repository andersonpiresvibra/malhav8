<div align="center">
  <br />
  <h1 align="center">Smart Ops Hub - Gestão de Malha (MALHA)</h1>
  <p align="center">SaaS de Alta Performance Operacional para Abastecimento Aéreo - SBGR (Vibra/BR Aviation)</p>
</div>

## ✈️ Visão Geral

O projeto **MALHA** é o painel de missão crítica (NOC) desenvolvido para centros de controle operacional interagindo diretamente em pátios aeroportuários massivos. Orquestrando escalas humanas, envio de frotas e cronogramas de voo em tempo real de forma determinística e livre de gargalos cognitivos na interface. 

Desenvolvido para coordenadores CCO, Despachantes e Lideranças de Pátio. Emprega as melhores práticas do dark-mode corporativo para baixo stress da retina durante vigilâncias intensivas noturnas.

## 🛠 Arquitetura e Stack
*   **Core UI:** React 19, TypeScript, Tailwind CSS, Vite.
*   **Backend & DB:** Supabase (Postgres, Realtime Subscriptions, e Auth).
*   **Gestão de Estado:** React Context e Atualizações Otimistas, via `supabaseService.ts`.
*   **Ícones e Estática:** Lucide-react.

## 📄 Documentação Técnica e Regras de Negócio
Nesta raiz, geramos guias definitivos do fluxo arquitetural concebidos de acordo com as regras de **BOB** (o Arquiteto do Sistema).
*   [`PRD.md`](PRD.md) - Product Requirements Document (Visão de Produto).
*   [`SCHEMA.md`](SCHEMA.md) - Specs do banco (DDL), tipos do Supabase e Estrutura Lógica.
*   [`MANUAL_DO_USUARIO.md`](MANUAL_DO_USUARIO.md) - Guia final de operação do software.
*   [`JETFUEL_SYSTEM_INSTRUCTION.md`](JETFUEL_SYSTEM_INSTRUCTION.md) - Diretrizes rígidas de arquitetura e desenvolvimento.

---
### 🚀 Setup Local

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Crie ou ajuste suas credenciais do serviço Supabase (em `.env.local` ou via painel dev):
   ```env
   VITE_SUPABASE_URL=seu_url
   VITE_SUPABASE_ANON_KEY=sua_chave
   ```

3. Inicie o servidor frontend:
   ```bash
   npm run dev
   ```
