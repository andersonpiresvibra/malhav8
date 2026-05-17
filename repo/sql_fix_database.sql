
-- 1. Tabela para a Malha Raiz (Template de voos recorrentes)
CREATE TABLE IF NOT EXISTS root_mesh (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    airline VARCHAR(100),
    airline_code VARCHAR(10),
    flight_number VARCHAR(20),
    departure_flight_number VARCHAR(20),
    destination VARCHAR(50),
    etd VARCHAR(10), -- Formato HH:MM ou 'PRÉ'
    registration VARCHAR(20),
    eta VARCHAR(10),
    position_id VARCHAR(20),
    actual_arrival_time VARCHAR(10),
    model VARCHAR(50),
    is_disabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela para Escalas de Operadores (Work Days)
CREATE TABLE IF NOT EXISTS operator_work_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operator_id UUID REFERENCES operators(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    day_type VARCHAR(20) DEFAULT 'TRABALHO', -- 'TRABALHO', 'FOLGA', 'FÉRIAS', 'AFASTADO'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(operator_id, work_date)
);

-- 3. Adicionar coluna faltante na auditoria ou outras tabelas se necessário
-- (Baseado na análise do checkpoint, a coluna 'day_type' era a principal suspeita de erro)

-- 4. Habilitar RLS para as novas tabelas (Padrão permissivo para o app atual)
ALTER TABLE root_mesh ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON root_mesh FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON root_mesh FOR ALL USING (true);

ALTER TABLE operator_work_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON operator_work_days FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON operator_work_days FOR ALL USING (true);
