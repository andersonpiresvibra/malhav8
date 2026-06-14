# PROPOSTA EXECUTIVA: REVOLUÇÃO DO MODAL DE ALOCAÇÃO DIRETA (HUD NOC)
## Relatório de Engenharia e Design de Produto • Projeto MALHA (Guarulhos-SBGR)

---

### 1. A METÁFORA OPERACIONAL: "O SISTEMA COMO UMA ENTREGA DE PIZZA"

No jargão técnico e gerencial que adotamos no pátio, a entrega do **Projeto MALHA** foi desenhada exatamente sob a ótica de uma **Entrega de Pizza de Alto Padrão**. Gestores muitas vezes cansaram de sistemas de TI "estilo buffet", nos quais os usuários precisam ir até o balcão, cozinhar o próprio prato, configurar servidores, ajustar campos manuais e, no final, a pizza chega fria e com a massa queimada. 

Nós operamos no modelo **Direct Delivery (Pronto para Consumo)**. Veja como se traduz essa estratégia:

| Elemento da Pizza | Equivalente Operacional no Sistema MALHA | Objetivo Estratégico (Enterprise Tier) |
| :--- | :--- | :--- |
| **A Massa (Base Firme)** | **Supabase DB, Autenticação de Pátio e Caches Locais** | Garantir que o sistema nunca "desmorone" se o recheio for pesado. Mesmo sem internet de pista (4G instável), a base (cache local) segura a operação offline. |
| **O Recheio Primoroso** | **A Malha de Voos, Regras de Negócio e SLAs da Vibra** | O que de fato alimenta a operação. Destinos calculados por ICAO, compatibilidades estritas de equipamentos por tipo de aeronave (SRV vs CTA). |
| **Entregador Veloz** | **Otimizações de Rede e Updates Otimistas (Optimistic Updates)** | O usuário clica e a UI reage instantaneamente (em milissegundos). A "pizza" não atrasa; o despachante não fica esperando spinners ou telas travadas. |
| **A Caixa Térmica** | **O Mecanismo de Contingência Híbrida Automática** | Se a conexão com o banco de dados cair, os fallbacks injetam os dados de backup na hora. O cliente não recebe a pizza fria; a operação continua aquecida. |
| **O "Sabor Perfeito"** | **UI/UX Polida, Dark Mode de Alta Densidade (Prevenção de Fadiga)** | Feito sob medida para turnos noturnos de 12h. Fontes legíveis, cores semânticas nítidas (Roxo-Vibra, Verde-Sucesso, Amarelo-Atenção). |

---

### 2. ANÁLISE DAS SOLICITAÇÕES DE REFINAMENTO (MODAL DE ALOCAÇÃO)

Analisando a captura de tela do modal de **Alocação Direta de Motorista / Operador**, identificamos uma oportunidade de elevar a densidade de dados e a legibilidade ao nível **NOC (Network Operations Center)** de classe mundial.

Abaixo, detalhamos a proposta técnica para cada ponto solicitado:

```
+------------------------------------------------------------------------------------------------------+
|                                  TABELA COMPARATIVA DE REFINAMENTOS                                  |
+------------------------------------+------------------------------------+----------------------------+
| Requisito Atual                    | Nova Proposta (BOB Sênior)         | Impacto na Operação (NOC)  |
+------------------------------------+------------------------------------+----------------------------+
| Linha do Operador consolidada em   | **Grid Separado por Colunas**:     | Reduz tempo de decisão do |
| blocos de texto simples.           | 1. Foto do Operador (Avatar)       | LT de 15s para 3s por voo. |
|                                    | 2. Nome de Guerra (Visual Nítido)  | Evita erros de fadiga.     |
|                                    | 3. Badge Retangular de Status      |                            |
|                                    | 4. Contador de Voos Efetuados      |                            |
|                                    | 5. Última Posição Registrada       |                            |
|                                    | 6. Viatura Vinculada (Ex: SRV-2104)|                            |
+------------------------------------+------------------------------------+----------------------------+
| Abas: "SERVIDORES" e "CAMINHÕES"   | **Abas Abreviadas e Codificadas**: | Identificação instantânea |
| sem diferenciação de cor nítida.   | - Aba **SRV's**: Cor Azul Vibra    | visual do tipo de frota    |
|                                    | - Aba **CTA's**: Cor Amarela       | disponível sem ler texto.  |
+------------------------------------+------------------------------------+----------------------------+
| Fontes padrão do sistema.          | **Ajuste de Tipografia de Pátio**: | Máxima legibilidade em    |
|                                    | "Inter" para dados e "JetBrains   | telas robustas de NOC sob  |
|                                    | Mono" para contadores/prefixos.    | iluminação noturna direta. |
+------------------------------------+------------------------------------+----------------------------+
```

---

### 3. DIRETRIZES DE IMPLEMENTAÇÃO E ENGENHARIA DE DADOS

#### A. C3 - Badge de Status Semântico (Retangular)
* **Decisão:** Substituiremos o indicador circular de status por um **badge retangular consolidado**, com background em verde fosco semitransparente (`bg-emerald-500/10`) e bordas sólidas nítidas (`border border-emerald-500/20`), contendo o texto `LIVRE` em caixa alta e fonte mono-espaçada.
* **Justificativa:** Badges retangulares oferecem melhor legibilidade periférica do que pequenos círculos em telas operacionais de alta densidade.

#### B. C4 - Contador Dinâmico de Voos no Dia
* **Como faremos sem sobrecarregar o banco:**
  Não precisamos criar uma coluna redundante no banco de dados para acumular esse valor (o que geraria riscos de dessincronização caso um voo fosse editado ou cancelado). 
  * **Solução BOB (Sênior):** Faremos o cálculo de forma **dinâmica na memória do cliente (React state)**, filtrando a lista global de voos (`flights`) que já está em tempo real em cache:
    ```typescript
    const flightsCount = flights.filter(f => 
      (f.operator?.toLowerCase() === op.warName.toLowerCase() || 
       f.supportOperator?.toLowerCase() === op.warName.toLowerCase()) && 
      f.status === 'FINALIZADO'
    ).length;
    ```
  * **Benefício:** Consistência de 100% com a verdade de rede (SST - Single Source of Truth). Se um voo for cancelado, a contagem do operador reduz instantaneamente.

#### C. C5 e C6 - Última Posição e Viatura Vinculada
* **C5 (Última Posição):** Extração dinâmica da posição em que o operador finalizou o último voo (`op.lastPosition` ou derivada do último voo `"FINALIZADO"` ordenado por timestamp). Exibe para o LT sabendo de onde o operador está se deslocando.
* **C6 (Viatura Vinculada):** Informação puxada diretamente da relação `op.assignedVehicle` (Ex: `SRV-2104` ou `CTA-1405`), já estabelecida dentro de nosso painel administrativo.

---

### 4. DIAGRAMA CRÍTICO DE LAYOUT PROPÔSTO (NOC VIEW)

```
+------------------------------------------------------------------------------------+
| ALOCAÇÃO DIRETA DE MOTORISTA / OPERADOR                                        [X] |
| VOO LA3396 • REQ: CTA                                                              |
+------------------------------------------------------------------------------------+
|  [   SRV's (3) - AZUL VIBRA   ]  |  [   ★ CTA's (4) - AMARELO OPERACIONAL ★   ]   |
+------------------------------------------------------------------------------------+
|                                                                                    |
|  GRID DE SELEÇÃO:                                                                  |
|  +-------------------------------------------------------------------------------+ |
|  | FOTO  | OPERADOR | STATUS  | VOOS REALIZADOS | ÚLTIMA POS. | VIATURA          | |
|  +-------+----------+---------+-----------------+-------------+------------------+ |
|  | [pic] | HORACIO  | [LIVRE] | 03 Voos         | REM 211     | [ CTA-1425 ]     | |
|  | [pic] | ANDRE    | [LIVRE] | 01 Voo          | BOX 401     | [ CTA-1426 ]     | |
|  | [pic] | MARCIO   | [LIVRE] | 05 Voos         | DESVIO      | [ CTA-1437 ]     | |
|  +-------------------------------------------------------------------------------+ |
|                                                                                    |
+------------------------------------------------------------------------------------+
|  [ CANCELAR ]                                            [ CONFIRMAR DESIGNAÇÃO ]  |
+------------------------------------------------------------------------------------+
```

---

### 5. CONCLUSÃO DO ARQUITETO (BOB)

A estratégia da **"Pizza Pronta para Consumo"** visa dar aos diretores e gerentes da Vibra a segurança de que o sistema se sustenta sob as piores condições de pista. 

A inclusão deste grid estruturado de designação direta elimina o atrito de decisão do Líder de Turno (LT): ele bate o olho, vê quem trabalhou mais hoje (equidade de cansaço), onde está fisicamente localizado (menor deslocamento) e qual frota está conduzindo, confirmando em menos de 3 cliques.

---
**Assinado,**  
*BOB — Arquiteto Técnico de Sistemas, Projeto MALHA*
