CREATE TABLE IF NOT EXISTS aerodromo_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patio_positions JSONB NOT NULL DEFAULT '{}',
    positions_metadata JSONB NOT NULL DEFAULT '{}',
    position_restrictions JSONB NOT NULL DEFAULT '{}',
    disabled_positions JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Opcional, mas recomendado)
ALTER TABLE aerodromo_config ENABLE ROW LEVEL SECURITY;

-- Como é um painel administrativo, vamos permitir acesso total para simplificar neste estágio:
CREATE POLICY "Enable all for aerodromo_config" ON aerodromo_config
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Inserir um registro inicial padrão caso a tabela esteja vazia
INSERT INTO aerodromo_config (patio_positions, positions_metadata, position_restrictions, disabled_positions)
SELECT '{}', '{}', '{}', '[]'
WHERE NOT EXISTS (SELECT 1 FROM aerodromo_config);
