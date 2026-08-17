-- =====================================================================
-- JETFUEL-SIM — Camada de Jogo (Tycoon) + RLS seguro
-- APLICAR COM service_role APENAS. Requer Supabase Auth habilitado.
-- =====================================================================

-- 1. TABELA FLIGHTS (core do tycoon) — voos reais do GRU + estado de jogo
CREATE TABLE IF NOT EXISTS public.flights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    date_ref DATE NOT NULL,
    flight_number TEXT NOT NULL,
    departure_flight_number TEXT,
    airline TEXT,
    airline_code TEXT,
    model TEXT,
    registration TEXT,
    origin TEXT,
    destination TEXT,
    eta TIMESTAMP WITH TIME ZONE,
    etd TIMESTAMP WITH TIME ZONE,
    actual_arrival_time TIMESTAMP WITH TIME ZONE,
    position_id TEXT,
    position_type TEXT,
    pit_id TEXT,
    fuel_status INTEGER DEFAULT 0,
    status TEXT DEFAULT 'CHEGADA', -- CHEGADA, FILA, DESIGNADO, AGUARDANDO, ABASTECENDO, FINALIZADO, CANCELADO
    operator_id UUID REFERENCES public.operadores_geral(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES public.frotas(id) ON DELETE SET NULL,
    volume INTEGER,
    is_on_ground BOOLEAN DEFAULT false,
    delay_justification TEXT,
    -- CAMADA DE JOGO
    game_session_id UUID,
    is_simulated BOOLEAN DEFAULT true, -- situações do Motor de Adversidades
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. MESH_FLIGHTS (templates base da malha raiz)
CREATE TABLE IF NOT EXISTS public.mesh_flights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    flight_number TEXT NOT NULL,
    airline TEXT,
    airline_code TEXT,
    model TEXT,
    origin TEXT,
    destination TEXT,
    eta TIME,
    etd TIME,
    position_id TEXT,
    pit_id TEXT,
    is_active BOOLEAN DEFAULT true
);

-- 3. TABELA DE TURNOS / SCORE (persistência do LT)
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
    end_time TIMESTAMP WITH TIME ZONE,
    score INTEGER DEFAULT 0,
    rating TEXT,
    tab_avg_seconds INTEGER,
    adversities_responded INTEGER DEFAULT 0,
    incidents INTEGER DEFAULT 0
);

-- 4. LOG DE ADVERSIDADES (caixa preta do turno)
CREATE TABLE IF NOT EXISTS public.adversity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    shift_id UUID REFERENCES public.shifts(id) ON DELETE CASCADE,
    category TEXT,
    event_type TEXT,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    response_action TEXT,
    score_impact INTEGER DEFAULT 0
);

-- 5. PERFIL DO JOGADOR
CREATE TABLE IF NOT EXISTS public.player_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    war_name TEXT,
    patente TEXT DEFAULT 'LT EM TREINAMENTO',
    total_score BIGINT DEFAULT 0,
    turns_played INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================================
-- RLS — SEGURO (substitui o RLS aberto atual)
-- =====================================================================

-- Habilitar RLS em todas as novas
ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mesh_flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adversity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;

-- Leitura pública de catálogo (voos/meh são cenário, não PII)
CREATE POLICY "Leitura pública flights" ON public.flights FOR SELECT TO public USING (true);
CREATE POLICY "Leitura pública mesh" ON public.mesh_flights FOR SELECT TO public USING (true);

-- Shifts/adversity/profile: só o dono (auth.uid)
CREATE POLICY "Shifts do usuário" ON public.shifts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Profile do usuário" ON public.player_profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Adversity visível ao dono do turno" ON public.adversity_logs FOR SELECT TO authenticated USING (
  shift_id IN (SELECT id FROM public.shifts WHERE user_id = auth.uid())
);

-- REMOVER POLICIES ABERTAS DAS TABELAS EXISTENTES (executar manualmente após revisão):
-- DROP POLICY IF EXISTS "Permitir escrita para todos" ON public.operadores_geral;
-- DROP POLICY IF EXISTS "Permitir escrita para todos" ON public.frotas;
-- DROP POLICY IF EXISTS "Permitir escrita para todos" ON public.aeronaves;
-- DROP POLICY IF EXISTS "Permitir escrita para todos" ON public.companhias;
-- DROP POLICY IF EXISTS "Permitir escrita para todos" ON public.oper_do_dia;
