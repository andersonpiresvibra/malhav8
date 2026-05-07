-- Inserindo Servidores (SRV) - FORD
INSERT INTO vehicles (fleet_number, type, manufacturer, status) VALUES 
('2104', 'SERVIDOR', 'FORD', 'DISPONÍVEL'),
('2108', 'SERVIDOR', 'FORD', 'DISPONÍVEL'),
('2111', 'SERVIDOR', 'FORD', 'DISPONÍVEL'),
('2113', 'SERVIDOR', 'FORD', 'DISPONÍVEL');

-- Inserindo Servidores (SRV) - MERCEDES-BENZ
INSERT INTO vehicles (fleet_number, type, manufacturer, status) VALUES 
('2122', 'SERVIDOR', 'MERCEDES-BENZ', 'DISPONÍVEL'),
('2123', 'SERVIDOR', 'MERCEDES-BENZ', 'DISPONÍVEL'),
('2124', 'SERVIDOR', 'MERCEDES-BENZ', 'DISPONÍVEL'),
('2125', 'SERVIDOR', 'MERCEDES-BENZ', 'DISPONÍVEL'),
('2126', 'SERVIDOR', 'MERCEDES-BENZ', 'DISPONÍVEL'),
('2127', 'SERVIDOR', 'MERCEDES-BENZ', 'DISPONÍVEL'),
('2128', 'SERVIDOR', 'MERCEDES-BENZ', 'DISPONÍVEL'),
('2129', 'SERVIDOR', 'MERCEDES-BENZ', 'DISPONÍVEL'),
('2130', 'SERVIDOR', 'MERCEDES-BENZ', 'DISPONÍVEL'),
('2131', 'SERVIDOR', 'MERCEDES-BENZ', 'DISPONÍVEL'),
('2132', 'SERVIDOR', 'MERCEDES-BENZ', 'DISPONÍVEL'),
('2133', 'SERVIDOR', 'MERCEDES-BENZ', 'DISPONÍVEL'),
('2135', 'SERVIDOR', 'MERCEDES-BENZ', 'DISPONÍVEL'),
('2136', 'SERVIDOR', 'MERCEDES-BENZ', 'DISPONÍVEL'),
('2137', 'SERVIDOR', 'MERCEDES-BENZ', 'DISPONÍVEL');

-- Inserindo Servidores (SRV) - VOLKSWAGEN
INSERT INTO vehicles (fleet_number, type, manufacturer, status) VALUES 
('2140', 'SERVIDOR', 'VOLKSWAGEN', 'DISPONÍVEL'),
('2145', 'SERVIDOR', 'VOLKSWAGEN', 'DISPONÍVEL'),
('2160', 'SERVIDOR', 'VOLKSWAGEN', 'DISPONÍVEL'),
('2161', 'SERVIDOR', 'VOLKSWAGEN', 'DISPONÍVEL'),
('2164', 'SERVIDOR', 'VOLKSWAGEN', 'DISPONÍVEL'),
('2165', 'SERVIDOR', 'VOLKSWAGEN', 'DISPONÍVEL'),
('2174', 'SERVIDOR', 'VOLKSWAGEN', 'DISPONÍVEL'),
('2177', 'SERVIDOR', 'VOLKSWAGEN', 'DISPONÍVEL');

-- Inserindo Caminhões Tanque Abastecedores (CTA)
INSERT INTO vehicles (fleet_number, type, capacity, status) VALUES 
('1405', 'CTA', 15000, 'DISPONÍVEL'),
('1425', 'CTA', 20000, 'DISPONÍVEL'),
('1426', 'CTA', 20000, 'DISPONÍVEL'),
('1428', 'CTA', 20000, 'DISPONÍVEL'),
('1435', 'CTA', 20000, 'DISPONÍVEL'),
('1437', 'CTA', 20000, 'DISPONÍVEL'),
('1439', 'CTA', 20000, 'DISPONÍVEL'),
('1499', 'CTA', 20000, 'DISPONÍVEL'),
('1517', 'CTA', 20000, 'DISPONÍVEL');

-- Inserindo Aeronaves GOL (B737-7)
INSERT INTO aircrafts (manufacturer, model, prefix, airline) VALUES 
('Boeing', 'B737-7', 'PR-GEA', 'Gol Linhas Aéreas'),
('Boeing', 'B737-7', 'PR-GEC', 'Gol Linhas Aéreas'),
('Boeing', 'B737-7', 'PR-GED', 'Gol Linhas Aéreas'),
('Boeing', 'B737-7', 'PR-GEH', 'Gol Linhas Aéreas'),
('Boeing', 'B737-7', 'PR-GEI', 'Gol Linhas Aéreas'),
('Boeing', 'B737-7', 'PR-GEJ', 'Gol Linhas Aéreas'),
('Boeing', 'B737-7', 'PR-GEK', 'Gol Linhas Aéreas'),
('Boeing', 'B737-7', 'PR-GEQ', 'Gol Linhas Aéreas'),
('Boeing', 'B737-7', 'PR-GIH', 'Gol Linhas Aéreas'),
('Boeing', 'B737-7', 'PR-GOQ', 'Gol Linhas Aéreas'),
('Boeing', 'B737-7', 'PR-GOR', 'Gol Linhas Aéreas'),
('Boeing', 'B737-7', 'PR-VBQ', 'Gol Linhas Aéreas');

-- Inserindo Aeronaves GOL (B737-8) - Lote 1
INSERT INTO aircrafts (manufacturer, model, prefix, airline) VALUES 
('Boeing', 'B737-8', 'PR-GGE', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GGF', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GGH', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GGL', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GGM', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GGP', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GGQ', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GGR', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GGX', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GKA', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GKB', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GKC', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GKD', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GKE', 'Gol Linhas Aéreas');

-- Lote 2 B737-8
INSERT INTO aircrafts (manufacturer, model, prefix, airline) VALUES 
('Boeing', 'B737-8', 'PR-GTC', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GTE', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GTG', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GTH', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GTL', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GTM', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GUB', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GUC', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GUE', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GUF', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GUH', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GUI', 'Gol Linhas Aéreas'),
('Boeing', 'B737-8', 'PR-GUJ', 'Gol Linhas Aéreas');

-- Inserindo Alguns Operadores para Teste Inicial
INSERT INTO operators (full_name, war_name, vest_number, status, category, shift_cycle, fleet_capability) VALUES 
('João Silva', 'SILVA', '001', 'DISPONÍVEL', 'AERODROMO', 'MANHÃ', 'SRV'),
('Pedro Santos', 'SANTOS', '002', 'DISPONÍVEL', 'AERODROMO', 'MANHÃ', 'BOTH'),
('Lucas Oliveira', 'OLIVEIRA', '003', 'DISPONÍVEL', 'ILHA', 'TARDE', 'CTA'),
('Carlos Pereira', 'PEREIRA', '004', 'DESCONECTADO', 'AERODROMO', 'NOITE', 'SRV');
