ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS operator_id UUID REFERENCES operators(id);
