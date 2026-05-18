-- 1. Adicionar colunas `companhia_id` nas tabelas principais
ALTER TABLE aeronaves ADD COLUMN IF NOT EXISTS companhia_id UUID REFERENCES companhias(id) ON DELETE SET NULL;
ALTER TABLE malha_raiz ADD COLUMN IF NOT EXISTS companhia_id UUID REFERENCES companhias(id) ON DELETE SET NULL;
ALTER TABLE malha_dia ADD COLUMN IF NOT EXISTS companhia_id UUID REFERENCES companhias(id) ON DELETE SET NULL;

-- 2. Migrar os dados existentes de `aeronaves`
UPDATE aeronaves a
SET companhia_id = c.id
FROM companhias c
WHERE upper(trim(a.airline)) = upper(trim(c.airline_code)) 
   OR upper(trim(a.airline)) = upper(trim(c.airline));

-- 3. Migrar os dados de `malha_raiz`
UPDATE malha_raiz m
SET companhia_id = c.id
FROM companhias c
WHERE upper(trim(m.airline_code)) = upper(trim(c.airline_code))
   OR upper(trim(m.airline)) = upper(trim(c.airline));

-- 4. Migrar os dados de `malha_dia`
UPDATE malha_dia d
SET companhia_id = c.id
FROM companhias c
WHERE upper(trim(d.airline_code)) = upper(trim(c.airline_code))
   OR upper(trim(d.airline)) = upper(trim(c.airline));

-- OPCIONAL: Para garantir a integridade da UI no futuro, podemos criar um índice:
CREATE INDEX IF NOT EXISTS idx_aeronaves_companhia_id ON aeronaves(companhia_id);
CREATE INDEX IF NOT EXISTS idx_malharaiz_companhia_id ON malha_raiz(companhia_id);
CREATE INDEX IF NOT EXISTS idx_malhadia_companhia_id ON malha_dia(companhia_id);
