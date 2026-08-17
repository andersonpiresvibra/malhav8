# JETFUEL-SIM — Design System (Padrão de Layout Oficial)

> Fonte: `MANUAL DE JETFUEL-24-05-2025.pdf`, `JETFUEL_PLANO_MESTRE.pdf`,
> `JETFUEL_SYSTEM_INSTRUCTION.md`, `PROPOSTA_MODAL.md`, `SCHEMA.md`.
> Este é o padrão de layout a ser seguido por todos os agentes BOB-* (UI/UX, Frontend).

## 1. Filosofia
- **Dark Mode Enterprise NOC**: turnos noturnos de 12h, baixa carga cognitiva, alta densidade de dados.
- **Zero UI-Blocking**: atualizações otimistas; nunca travar a tela do LT esperando o banco.
- **Cores semânticas restritas** (regra de ouro): verde = sucesso/acordo; vermelho = quebra de SLA/atraso; âmbar = atenção; azul = SRV; amarelo = CTA.

## 2. Paleta
| Token | Cor | Uso |
|---|---|---|
| Base | `slate-900` / `slate-950` | Fundo do cockpit |
| Superfície | `slate-800` | Cards, painéis |
| Sucesso | `emerald-500` | Livre, finalizado, acordo |
| Perigo | `red-500` (pulsante < 300L / crítico) | Atraso, SLA quebrado, vazamento |
| Atenção | `amber-500` | Volume baixo, aviso |
| SRV | `blue-500` | Aba/identidade Servidor de Hidrante |
| CTA | `yellow-500` | Aba/identidade Caminhão Tanque |
| Marca | `Roxo-Vibra` | Acentos de diretoria |

## 3. Tipografia
- **Inter** — textos, dados de rótulo, leitura geral.
- **JetBrains Mono** — contadores, prefixos de voo/viatura, timers, códigos de posição.
- PT-BR obrigatório na interface; código/variáveis/DB em inglês.

## 4. Z-Index (SAGRADO — nunca quebrar camadas)
- Cabeçalhos de aba / portais visuais: `z-[60]`
- Subheaders portais: `z-[62]`
- Notificações de adversidade (cards flutuantes): `z-[9000]`
- Modais de override / designação: `z-[9990]`+

## 5. Componentes-chave
### 5.1 Indicador de Tanque (Veículo)
- Verde: >= 75% · Azul: >= 50% · Âmbar: > 5.000L e < 50% · Vermelho fixo: <= 5.000L (crítico) · Vermelho pulsante + "V. MORTO": <= 300L (volume morto inútil).
### 5.2 Badge de Status (Retangular)
- Fundo `bg-emerald-500/10`, borda `border border-emerald-500/20`, texto caixa-alta mono.
- Substitui círculos (melhor legibilidade periférica em alta densidade).
### 5.3 Grid de Designação Direta
- Colunas: Foto | Operador | Status | Voos Realizados | Última Pos. | Viatura.
- Abas codificadas por cor: `SRV's` (azul Vibra) / `CTA's` (amarelo operacional).
- Decisão do LT em <= 3 cliques.

## 6. Máquina de Estados do Voo
```
CHEGADA → FILA → DESIGNADO → AGUARDANDO → ABASTECENDO → FINALIZADO
                                                      ↘ CANCELADO
```
Status visuais (Manual): Selecione / Preparando / Abastecendo / Finalizando / Concluído / Pênalti!

## 7. Layout da Tela Principal Unificada
- **Centro**: Malha 2D estilizada (pistas, pátios, taxiways, bolsões). Ícones de voo animados (logo cia + nº + status cor/ícone). Caminhões em rota (estilo Waze/Uber).
- **Direita**: Painel Lateral — tabela ordenável de voos (Companhia, Nº, Origem, Destino, Horário, Status, + colunas tycoon: Prioridade, Fuel-Order, Recompensa, Penalidade).
- **Topo**: DashboardHeader com densidade/IR (índice de realização), METAR.
- **Flutuante**: cards de Adversidade (canto sup. direito) com timer verde→âmbar→vermelho.

## 8. Princípios de Ação (UX)
- Atalhos: Click, Edit, Esc cancela, Enter confirma, setas/Tab navegam.
- Filtros reagem limpando seleções travadas.
- Modais via Portal Target fora do fluxo flex (evita `overflow-hidden` cortar).
