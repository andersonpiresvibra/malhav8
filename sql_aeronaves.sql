-- Remover a tabela se ela já existir para evitar erro "relation already exists"
DROP TABLE IF EXISTS public.aircrafts;

-- Criação da tabela de aeronaves (aircrafts)
CREATE TABLE public.aircrafts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    manufacturer TEXT DEFAULT '--'::text NOT NULL,
    model TEXT DEFAULT '--'::text NOT NULL,
    prefix TEXT NOT NULL UNIQUE,
    airline TEXT NOT NULL,
    missing_cap BOOLEAN DEFAULT false,
    defective_door BOOLEAN DEFAULT false,
    defective_panel BOOLEAN DEFAULT false,
    no_autocut BOOLEAN DEFAULT false,
    observations TEXT
);

-- Ativar Row Level Security (RLS)
ALTER TABLE public.aircrafts ENABLE ROW LEVEL SECURITY;

-- Políticas para acesso anônimo (caso o app não exija login no momento)
CREATE POLICY "Enable all access for anon users" 
ON public.aircrafts 
AS PERMISSIVE 
FOR ALL 
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Criação de um índice para busca mais rápida pelo prefixo
CREATE INDEX idx_aircrafts_prefix ON public.aircrafts(prefix);
CREATE INDEX idx_aircrafts_airline ON public.aircrafts(airline);
