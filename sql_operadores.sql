-- Adicionando Novas Colunas à Tabela operators para suportar a Seção Administrativa
ALTER TABLE public.operators
ADD COLUMN IF NOT EXISTS role VARCHAR(50), -- Função (Op. Jr., Op. Pl, Op. Sr., Op. LT)
ADD COLUMN IF NOT EXISTS is_lt VARCHAR(10) DEFAULT 'NÃO', -- LT Sim ou Não
ADD COLUMN IF NOT EXISTS patio VARCHAR(50), -- Pátio (Aerod., VIP, Ambos)
ADD COLUMN IF NOT EXISTS tmf_login VARCHAR(20), -- Log. TMF (Ex: 3643)
ADD COLUMN IF NOT EXISTS blood_type VARCHAR(10), -- TS / Tipo Sanguíneo (Ex: O+)
ADD COLUMN IF NOT EXISTS shift_start VARCHAR(10), -- Hora de entrada
ADD COLUMN IF NOT EXISTS shift_end VARCHAR(10); -- Hora de saída

-- Alterando os tipos numéricos e textuais de colunas pré-existentes caso necessário
-- Apenas mude para text/varchar caso elas fossem ENUMs rigorosos anteriormente
ALTER TABLE public.operators ALTER COLUMN shift_cycle TYPE VARCHAR(50);
ALTER TABLE public.operators ALTER COLUMN category TYPE VARCHAR(50);
ALTER TABLE public.operators ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.operators ALTER COLUMN status TYPE VARCHAR(50);
