<div align="center">
  <br />
  <h1 align="center">Smart Ops Hub - Gestão de Malha (MALHA)</h1>
  <p align="center">SaaS de Alta Performance Operacional para Abastecimento Aéreo - SBGR (Vibra/BR Aviation)</p>
</div>

## ✈️ Visão Geral

O projeto **MALHA** é o painel de missão crítica (NOC) desenvolvido para centros de controle operacional interagindo diretamente em pátios aeroportuários massivos. Orquestrando escalas humanas, envio de frotas e cronogramas de voo em tempo real de forma determinística e livre de gargalos cognitivos na interface. 

Desenvolvido para coordenadores CCO, Despachantes e Lideranças de Pátio. Emprega as melhores práticas do dark-mode para baixo stress da retina durante vigilâncias intensivas noturnas.

## 🛠 Arquitetura e Stack
*   **Core UI:** React, TypeScript, Tailwind CSS, Vite.
*   **Backend:** Supabase (Postgres & Realtime Subscriptions).
*   **Ícones e Estática:** Lucide-react.

## 📄 Documentos Relacionados
Nesta raiz, geramos guias definitivos do fluxo arquitetural concebidos pelo líder de infra **BOB**.
*   [`PRD.md`](PRD.md) - Product Requirements Document (Visão do negócio).
*   [`SCHEMA.md`](SCHEMA.md) - Mapeamentos conceituais do Supabase Database, Auth e Integridade de Tabelas.

---
### 🚀 Rotação Local Rápida

1. Instale os repositórios vitais (React Engine via npm):
   ```bash
   npm install
   ```

2. Crie ou ajuste suas credenciais do serviço Supabase (ou fallback em AI Studio local keys, e.g. dev):
   ```bash
   npm run dev
   ```
