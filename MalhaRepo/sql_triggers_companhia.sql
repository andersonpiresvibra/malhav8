-- Função mais segura para acessar chaves sem gerar erros de coluna faltante usando jsonb
CREATE OR REPLACE FUNCTION auto_associate_companhia_id()
RETURNS TRIGGER AS $$
DECLARE
   _airline text;
   _airline_code text;
BEGIN
   IF NEW.companhia_id IS NULL THEN
      -- Captura através de jsonb garantindo que não vai quebrar independente da estrutura exata da tabela
      _airline_code := (to_jsonb(NEW) ->> 'airline_code');
      _airline := (to_jsonb(NEW) ->> 'airline');

      IF _airline_code IS NOT NULL AND trim(_airline_code) <> '' THEN
         SELECT id INTO NEW.companhia_id FROM companhias WHERE upper(trim(airline_code)) = upper(trim(_airline_code)) LIMIT 1;
      END IF;
      
      IF NEW.companhia_id IS NULL AND _airline IS NOT NULL AND trim(_airline) <> '' THEN
         SELECT id INTO NEW.companhia_id FROM companhias WHERE upper(trim(airline)) = upper(trim(_airline)) LIMIT 1;
      END IF;
   END IF;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;
