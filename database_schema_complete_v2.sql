-- =====================================================================
-- JETFUEL / MALHA - SCHEMA COMPLETO DO SUPABASE (ENTIDADE-RELACIONAMENTO)
-- SISTEMA DE MONITORAMENTO OPERACIONAL DE COMBUSTÍVEL DE AVIAÇÃO
-- AEROPORTO INTERNACIONAL DE GUARULHOS (SBGR) - VIBRA / BR AVIATION
-- ARQUITETO RESPONSÁVEL: BOB
-- =====================================================================

-- Habilitar a extensão padrão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- 1. TABELA DE COMPANHIAS AÉREAS (SOCIAS PARCEIRAS DO AERÓDROMO)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.companhias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    legal_name TEXT NOT NULL,
    airline TEXT NOT NULL, -- Nome fantasia (Ex: 'GOL', 'LATAM')
    airline_code TEXT UNIQUE NOT NULL, -- Código IATA/ICAO (Ex: 'RG', 'LA', 'AD')
    logo_url TEXT,
    country TEXT,
    category TEXT DEFAULT 'NACIONAL', -- 'NACIONAL', 'INTERNACIONAL', 'EXECUTIVA'
    is_active BOOLEAN DEFAULT true NOT NULL
);

-- Habilitar RLS e criar políticas públicas
ALTER TABLE public.companhias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura para todos" ON public.companhias FOR SELECT TO public USING (true);
CREATE POLICY "Permitir escrita para todos" ON public.companhias FOR ALL TO public USING (true) WITH CHECK (true);

-- =====================================================================
-- 2. TABELA DE OPERADORES GERAIS (RECURSOS HUMANOS EM RAMPA)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.operadores_geral (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    full_name TEXT NOT NULL,
    war_name TEXT NOT NULL, -- Nome de Guerra do Operador
    company_id TEXT, -- Matrícula Interna (Ex: Vibra)
    gru_id TEXT, -- Matrícula GRU Airport
    vest_number TEXT UNIQUE, -- Número do colete/bip associado
    photo_url TEXT,
    status TEXT DEFAULT 'DESCONECTADO' NOT NULL, -- 'DISPONÍVEL', 'OCUPADO', 'INTERVALO', 'DESCONECTADO'
    category TEXT DEFAULT 'AERODROMO', -- 'AERODROMO', 'VIP', 'ILHA'
    shift_cycle TEXT DEFAULT 'MANHÃ', -- 'MANHÃ', 'TARDE', 'NOITE', 'GERAL'
    fleet_capability TEXT, -- 'CTA', 'SRV', ou 'BOTH'
    role TEXT, -- 'Op. Jr.', 'Op. Pl.', 'Op. Sr.', 'Op. LT'
    is_lt TEXT DEFAULT 'NÃO', -- 'SIM' ou 'NÃO' para líderes de turno
    patio TEXT, -- 'Aerod.', 'VIP', 'Ambos'
    tmf_login TEXT, -- Login interno do sistema TMF
    blood_type TEXT, -- Tipo Sanguíneo (Ex: 'O+')
    shift_start TEXT, -- Horário entrada planejado (Ex: '06:00')
    shift_end TEXT, -- Horário saída planejado (Ex: '14:00')
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.operadores_geral ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura para todos" ON public.operadores_geral FOR SELECT TO public USING (true);
CREATE POLICY "Permitir escrita para todos" ON public.operadores_geral FOR ALL TO public USING (true) WITH CHECK (true);

-- =====================================================================
-- 3. TABELA DE DISPONIBILIDADE E ESCALA DO OPERADOR NO DIA (WORK DAYS)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.oper_do_dia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    operator_id UUID NOT NULL REFERENCES public.operadores_geral(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    day_type TEXT DEFAULT 'TRABALHO' NOT NULL, -- 'TRABALHO', 'FOLGA', 'FÉRIAS', 'AFASTADO'
    CONSTRAINT unique_operator_date UNIQUE (operator_id, work_date)
);

ALTER TABLE public.oper_do_dia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura para todos" ON public.oper_do_dia FOR SELECT TO public USING (true);
CREATE POLICY "Permitir escrita para todos" ON public.oper_do_dia FOR ALL TO public USING (true) WITH CHECK (true);

-- =====================================================================
-- 4. TABELA DE VIATURAS / FROTA OPERACIONAL (EQUIPAMENTOS DE ABASTECIMENTO)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.frotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    fleet_number TEXT UNIQUE NOT NULL, -- Número da viatura (Ex: '2104', '1405')
    type TEXT NOT NULL, -- 'CTA' (Caminhão) ou 'SERVIDOR'
    manufacturer TEXT, -- Fabricante (FORD, VW, MB, etc.)
    status TEXT DEFAULT 'INATIVO' NOT NULL, -- 'DISPONÍVEL', 'OCUPADO', 'INATIVO', 'ENCHIMENTO'
    max_flow_rate INTEGER DEFAULT 1000, -- Vazão máxima (litros/min)
    has_platform BOOLEAN DEFAULT false, -- Plataforma elevatória
    capacity INTEGER, -- Capacidade física do CTA em litros (Opcional para SRV)
    counter_initial BIGINT, -- Horímetro/Odômetro inicial
    counter_final BIGINT, -- Horímetro/Odômetro final
    plate TEXT, -- Placa
    atve TEXT, -- Autorização ATVE (GRU Airport)
    atve_expiry DATE, -- Vencimento do ATVE
    observations TEXT,
    operator_id UUID REFERENCES public.operadores_geral(id) ON DELETE SET NULL, -- Operador atual vinculado
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.frotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura para todos" ON public.frotas FOR SELECT TO public USING (true);
CREATE POLICY "Permitir escrita para todos" ON public.frotas FOR ALL TO public USING (true) WITH CHECK (true);

-- =====================================================================
-- 5. TABELA DE AERONAVES (FROTA COMPLETA DE EQUIPAMENTOS AÉREOS)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.aeronaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    model TEXT DEFAULT '--'::text NOT NULL, -- Modelo do avião (Ex: 'B737-8', 'A320')
    prefix TEXT UNIQUE NOT NULL, -- Prefixo de registro (Ex: 'PR-GGE', 'PT-MXA')
    airline TEXT NOT NULL, -- Nome fantasia ou código da cia (Ex: 'LATAM', 'GOL')
    companhia_id UUID REFERENCES public.companhias(id) ON DELETE SET NULL, -- FK da Cia Relacionada
    missing_cap BOOLEAN DEFAULT false, -- Tampa do tanque faltando
    defective_door BOOLEAN DEFAULT false, -- Porta danificada
    defective_panel BOOLEAN DEFAULT false, -- Painel com avaria
    no_autocut BOOLEAN DEFAULT false, -- Sistema de corte automático inativo
    observations TEXT
);

ALTER TABLE public.aeronaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura para todos" ON public.aeronaves FOR SELECT TO public USING (true);
CREATE POLICY "Permitir escrita para todos" ON public.aeronaves FOR ALL TO public USING (true) WITH CHECK (true);

-- =====================================================================
-- 6. TABELA DE MALHA OPERACIONAL (DASHBOARD REAL-TIME / GROUND HANDLING)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.malha_operacional (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date_ref TEXT NOT NULL, -- YYYY-MM-DD (Data operacional de controle)
    flight_number TEXT NOT NULL, -- Número do Voo de Chegada (Ex: 'G3-1250')
    departure_flight_number TEXT, -- Número do Voo de Saída
    airline TEXT, -- Cia aérea texto
    airline_code TEXT, -- Cia aérea IATA (Ex: 'RG')
    companhia_id UUID REFERENCES public.companhias(id) ON DELETE SET NULL, -- FK da companhia
    model TEXT, -- Modelo da aeronave
    registration TEXT, -- Prefixo (Ex: 'PR-GGE')
    origin TEXT,
    destination TEXT, -- Destino do voo (Ex: 'SBRJ')
    eta TEXT, -- Horário estimado de chegada (HH:MM)
    etd TEXT, -- Horário estimado de saída (HH:MM)
    actual_arrival_time TEXT, -- ATA / Horário efetivo de calço
    position_id TEXT, -- Posição no pátio (Ex: '312')
    position_type TEXT, -- Tipo de atendimento ('SRV' ou 'CTA')
    pit_id TEXT, -- Hidrante / Pit utilizado
    fuel_status INTEGER DEFAULT 0, -- Código do status de combustível (0 a 8)
    status TEXT DEFAULT 'CHEGADA'::text NOT NULL, -- 'CHEGADA', 'FILA', 'DESIGNADO', 'PRÉ', 'ABASTECENDO', 'FINALIZADO'
    volume INTEGER DEFAULT 0, -- Volume abastecido ou planejado em litros
    is_on_ground BOOLEAN DEFAULT false, -- Se a aeronave já pousou / solo
    delay_justification TEXT, -- Justificativa técnica para atrasos
    designation_time TIMESTAMP WITH TIME ZONE, -- Hora que foi designado
    start_time TIMESTAMP WITH TIME ZONE, -- Hora de início do bombeamento
    end_time TIMESTAMP WITH TIME ZONE, -- Hora de fim do bombeamento
    assignment_time TIMESTAMP WITH TIME ZONE, -- Designação em campo (timestamp)
    assigned_by_lt TEXT, -- Liderança de Turno autorizadora
    is_excluded_from_queue BOOLEAN DEFAULT false, -- Se foi ignorado na lista prioritária
    report JSONB DEFAULT '{}'::jsonb, -- Relatório estatístico avançado integrado
    logs JSONB DEFAULT '[]'::jsonb, -- Auditoria local de eventos históricos integrada
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.malha_operacional ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura para todos" ON public.malha_operacional FOR SELECT TO public USING (true);
CREATE POLICY "Permitir escrita para todos" ON public.malha_operacional FOR ALL TO public USING (true) WITH CHECK (true);

-- =====================================================================
-- 7. TABELA DE MALHA RAIZ (PROGRAMAÇÃO DE RECORRÊNCIA SEMANAL)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.malha_raiz (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flight_number TEXT UNIQUE NOT NULL, -- Chave de voo única (Ex: 'AD-2041')
    airline TEXT,
    airline_code TEXT,
    companhia_id UUID REFERENCES public.companhias(id) ON DELETE SET NULL, -- FK da Cia aérea parceira
    departure_flight_number TEXT,
    destination TEXT,
    etd VARCHAR(10),
    registration TEXT,
    eta VARCHAR(10),
    position_id TEXT,
    actual_arrival_time VARCHAR(10),
    model TEXT,
    is_disabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.malha_raiz ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura para todos" ON public.malha_raiz FOR SELECT TO public USING (true);
CREATE POLICY "Permitir escrita para todos" ON public.malha_raiz FOR ALL TO public USING (true) WITH CHECK (true);

-- =====================================================================
-- 8. TABELA DE MALHA DIÁRIA (DIAS ESPECÍFICOS ALOCADOS DA MALHA RAIZ)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.malha_dia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TEXT NOT NULL, -- YYYY-MM-DD (Data da escala diária)
    airline TEXT,
    airline_code TEXT,
    companhia_id UUID REFERENCES public.companhias(id) ON DELETE SET NULL, -- FK da companhia
    flight_number TEXT,
    departure_flight_number TEXT,
    destination TEXT,
    etd TEXT,
    registration TEXT,
    eta TEXT,
    position_id TEXT,
    actual_arrival_time TEXT,
    model TEXT,
    is_disabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.malha_dia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura para todos" ON public.malha_dia FOR SELECT TO public USING (true);
CREATE POLICY "Permitir escrita para todos" ON public.malha_dia FOR ALL TO public USING (true) WITH CHECK (true);

-- =====================================================================
-- 9. TABELA DE CAIXA PRETA (LOG SÓLIDO DE SEGURANÇA E AUDITORIA OPERACIONAL)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.caixa_preta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL, -- 'FLIGHT', 'OPERATOR', 'VEHICLE'
    entity_id UUID,
    action_type TEXT NOT NULL, -- Ex: 'STATUS_CHANGE', 'ASSIGN_OPERATOR', 'CANCEL_FLIGHT'
    flight_number TEXT,
    flight_date DATE,
    registration TEXT,
    field_changed TEXT,
    old_value TEXT,
    new_value TEXT,
    user_name TEXT DEFAULT 'SISTEMA'::text,
    user_role TEXT DEFAULT 'LT'::text,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.caixa_preta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir inserções para todos" ON public.caixa_preta FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Permitir leitura para todos" ON public.caixa_preta FOR SELECT TO public USING (true);

-- =====================================================================
-- 10. TABELA DE DESTINOS ESTÁTICOS / DICIONÁRIO ICAO -> CIDADE
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.destinos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    icao TEXT UNIQUE NOT NULL, -- Código ICAO do aeroporto (Ex: 'SBGR', 'SBRJ')
    city TEXT NOT NULL, -- Nome legível ou cidade (Ex: 'GUARULHOS', 'RIO DE JANEIRO')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.destinos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura para todos" ON public.destinos FOR SELECT TO public USING (true);
CREATE POLICY "Permitir escrita para todos" ON public.destinos FOR ALL TO public USING (true) WITH CHECK (true);

-- =====================================================================
-- 11. TABELA DE CONFIGURADOS DO AERÓDROMO (PÁTIOS E RESTRIÇÕES MECÂNICAS)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.aerodromo_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patio_positions JSONB NOT NULL DEFAULT '{}'::jsonb,
    positions_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    position_restrictions JSONB NOT NULL DEFAULT '{}'::jsonb,
    disabled_positions JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.aerodromo_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acesso total à configuração do aeródromo" ON public.aerodromo_config FOR ALL TO public USING (true) WITH CHECK (true);

-- =====================================================================
-- 12. TABELA DE PREFERÊNCIAS DE LAYOUT E COLUNAS DO USUÁRIO (CUSTOM BI/NOC)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.preferencias_layout_usuario (
    user_id TEXT PRIMARY KEY NOT NULL, -- Identificador persistente local ou do auth
    visible_columns JSONB DEFAULT '{}'::jsonb,
    visible_tabs JSONB DEFAULT '{}'::jsonb,
    locked_columns JSONB DEFAULT '{}'::jsonb,
    locked_tabs JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.preferencias_layout_usuario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acesso total às preferências" ON public.preferencias_layout_usuario FOR ALL TO public USING (true) WITH CHECK (true);

-- =====================================================================
-- 13. CRIAR ÍNDICES OPERACIONAIS DE ALTA DISPONIBILIDADE
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_malha_operacional_date_ref ON public.malha_operacional(date_ref);
CREATE INDEX IF NOT EXISTS idx_malha_operacional_status ON public.malha_operacional(status);
CREATE INDEX IF NOT EXISTS idx_malha_operacional_registration ON public.malha_operacional(registration);
CREATE INDEX IF NOT EXISTS idx_aeronaves_prefix ON public.aeronaves(prefix);
CREATE INDEX IF NOT EXISTS idx_aeronaves_companhia_id ON public.aeronaves(companhia_id);
CREATE INDEX IF NOT EXISTS idx_frotas_fleet_number ON public.frotas(fleet_number);
CREATE INDEX IF NOT EXISTS idx_caixa_preta_date ON public.caixa_preta(flight_date);
CREATE INDEX IF NOT EXISTS idx_caixa_preta_entity ON public.caixa_preta(entity_type, entity_id);

-- =====================================================================
-- 14. INICIALIZAÇÃO DE DESTINOS PRINCIPAIS SE ESTIVER VAZIA (SEED RAPIDO)
-- =====================================================================
INSERT INTO public.destinos (icao, city) VALUES
('SBGR', 'SÃO PAULO/GUARULHOS_SP'),
('SBSP', 'SÃO PAULO/CONGONHAS_SP'),
('SBKP', 'CAMPINAS/VIRACOPOS_SP'),
('SBRJ', 'RIO DE JANEIRO/SANTOS DUMONT_RJ'),
('SBGL', 'RIO DE JANEIRO/GALEÃO_RJ'),
('SBCF', 'BELO HORIZONTE/CONFINS_MG'),
('SBBR', 'BRASÍLIA/DF'),
('SBPA', 'PORTO ALEGRE/RS'),
('SBCT', 'CURITIBA/AFONSO PENA_PR'),
('SBFL', 'FLORIANÓPOLIS/SC'),
('SBRF', 'RECIFE/PE'),
('SSA', 'SALVADOR/BA'),
('SBSG', 'NATAL/RN'),
('SBFZ', 'FORTALEZA/CE'),
('SBPS', 'PORTO SEGURO/BA'),
('MPTO', 'PANAMÁ/TOCUMEN_PA'),
('SAEZ', 'BUENOS AIRES/EZEIZA_AR')
ON CONFLICT (icao) DO NOTHING;

-- =====================================================================
-- 15. GATILHO PARA VINCULAR COMPANHIA AUTOMATICAMENTE EM AERONAVES / VOOS
-- =====================================================================
CREATE OR REPLACE FUNCTION public.auto_associate_companhia_id()
RETURNS TRIGGER AS $$
DECLARE
   _airline text;
   _airline_code text;
BEGIN
   IF NEW.companhia_id IS NULL THEN
      _airline_code := (to_jsonb(NEW) ->> 'airline_code');
      _airline := (to_jsonb(NEW) ->> 'airline');

      IF _airline_code IS NOT NULL AND trim(_airline_code) <> '' THEN
         SELECT id INTO NEW.companhia_id FROM public.companhias WHERE upper(trim(airline_code)) = upper(trim(_airline_code)) LIMIT 1;
      END IF;
      
      IF NEW.companhia_id IS NULL AND _airline IS NOT NULL AND trim(_airline) <> '' THEN
         SELECT id INTO NEW.companhia_id FROM public.companhias WHERE upper(trim(airline)) = upper(trim(_airline)) LIMIT 1;
      END IF;
   END IF;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ativar os gatilhos automáticos
DROP TRIGGER IF EXISTS trg_aeronaves_companhia ON public.aeronaves;
CREATE TRIGGER trg_aeronaves_companhia
    BEFORE INSERT OR UPDATE ON public.aeronaves
    FOR EACH ROW EXECUTE FUNCTION public.auto_associate_companhia_id();

DROP TRIGGER IF EXISTS trg_malha_operacional_companhia ON public.malha_operacional;
CREATE TRIGGER trg_malha_operacional_companhia
    BEFORE INSERT OR UPDATE ON public.malha_operacional
    FOR EACH ROW EXECUTE FUNCTION public.auto_associate_companhia_id();

DROP TRIGGER IF EXISTS trg_malha_raiz_companhia ON public.malha_raiz;
CREATE TRIGGER trg_malha_raiz_companhia
    BEFORE INSERT OR UPDATE ON public.malha_raiz
    FOR EACH ROW EXECUTE FUNCTION public.auto_associate_companhia_id();

DROP TRIGGER IF EXISTS trg_malha_dia_companhia ON public.malha_dia;
CREATE TRIGGER trg_malha_dia_companhia
    BEFORE INSERT OR UPDATE ON public.malha_dia
    FOR EACH ROW EXECUTE FUNCTION public.auto_associate_companhia_id();
