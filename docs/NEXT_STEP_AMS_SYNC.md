# PRÓXIMO PASSO — Integração AMS-GRU → App (Fase 2 exec + Cron)

> Objetivo do Anderson: abrir o app em `mlh.bobsimcom.br` e ver os **voos reais do AMS-GRU** refletidos, podendo gerenciá-los como jogo.

## Pipeline desejado
```
AMS-GRU (real) → n8n (Consultar_Voos_AMS_GRU) → Supabase kznh (tabela flights)
              → app JETFUEL-SIM (lê flights, aplica Motor de Adversidades simulado)
```

## Passos (a executar com serviço do Anderson)
1. **Habilitar Supabase Auth** no projeto kznh (email/senha).
2. **Executar migração `010_jetfuel_game_layer.sql`** com service_role:
   - Cria `flights`, `mesh_flights`, `shifts`, `adversity_logs`, `player_profiles`.
   - Aplica RLS por `auth.uid()` (substitui RLS aberto atual — CRÍTICO).
   - Remove coluna `password` de `operadores_geral` (usar Auth).
3. **Configurar n8n** para gravar voos reais na tabela `flights` do kznh:
   - Mapear `aircraft_active_tracking` (ams-gru) → `flights` (kznh).
   - Campos: flight_number, airline, model, registration, eta/etd, position_id, status, is_simulated=true.
4. **Cron de sincronização** (a cada 2 min, como o ams-gru original):
   - Pode ser n8n schedule ou Hermes cronjob que chama a Edge Function/Supabase.
5. **App**: ajustar `supabaseService.ts` para ler `flights` (já tem fallback se tabela faltar).
6. **Domínio**: apontar `mlh.bobsimcom.br` no painel Cloudflare (Pages → Custom domains).

## Bloqueios
- Sem service_role do kznh → não rodo a migração 010.
- Sem credencial do ams-gru/n8n → não configuro o ETL.
- Anderson pediu para ver "mais tarde" — execução fica agendada, não feita agora.
