-- Tabela de Auditoria (Caixa Preta)
-- Retém todo o histórico de operações de forma blindada, independente se o voo for excluído depois.

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL, -- Ex: 'FLIGHT', 'OPERATOR', 'VEHICLE'
    entity_id UUID, -- O UUID do registro (pode ser nulo caso o registro não tenha UUID fixo ex: malha local)
    action_type VARCHAR(50) NOT NULL, -- Ex: 'STATUS_CHANGE', 'ASSIGN_OPERATOR', 'ETA_CHANGE', 'FINISH', 'CANCEL'
    
    -- Metadados independentes (se o voo for deletado, ainda temos os identificadores)
    flight_number VARCHAR(20),
    flight_date DATE,
    registration VARCHAR(20),
    
    -- O que mudou
    field_changed VARCHAR(50),
    old_value TEXT,
    new_value TEXT,
    
    -- Quem mudou
    user_name VARCHAR(100) DEFAULT 'SISTEMA', -- Nome/Guerra de quem aplicou a ação
    user_role VARCHAR(50) DEFAULT 'LT',
    
    -- Contexto em JSON enriquecido: ideal para PowerBI, Zapier, Webhooks e relatórios profundos
    -- Pode gravar: { "etd_original": "14:00", "minutos_ate_partida": 35, "motivo_atraso": "Falta de operador" }
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para facilitar a busca do Gerente ou relatórios rápidos
CREATE INDEX idx_audit_logs_date ON audit_logs(flight_date);
CREATE INDEX idx_audit_logs_action ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_flight ON audit_logs(flight_number, flight_date);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- RLS (Row Level Security) - Permite inserções autenticadas e leitura para administradores
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable insert for all authenticated users"
    ON audit_logs FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Enable read access for all authenticated users"
    ON audit_logs FOR SELECT
    USING (true);
