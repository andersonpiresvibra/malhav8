-- Migration file to initialize Supabase database for JetFuel

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum for Vehicle Types
CREATE TYPE vehicle_type AS ENUM ('SERVIDOR', 'CTA');

-- Enum for Vehicle Status
CREATE TYPE vehicle_status AS ENUM ('DISPONÍVEL', 'OCUPADO', 'INATIVO', 'ENCHIMENTO');

-- Enum for Operator Status
CREATE TYPE operator_status AS ENUM ('DISPONÍVEL', 'OCUPADO', 'INTERVALO', 'DESCONECTADO', 'ENCHIMENTO', 'DESIGNADO');

-- Enum for Operator Category
CREATE TYPE operator_category AS ENUM ('AERODROMO', 'VIP', 'ILHA');

-- Enum for Shift Cycles
CREATE TYPE shift_cycle AS ENUM ('MANHÃ', 'TARDE', 'NOITE', 'GERAL');

-- Enum for Flight Status
CREATE TYPE flight_status AS ENUM ('CHEGADA', 'FILA', 'DESIGNADO', 'PRÉ', 'AGUARDANDO', 'ABASTECENDO', 'FINALIZADO', 'CANCELADO');

-- 1. VEHICLES TABLE
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fleet_number VARCHAR(50) UNIQUE NOT NULL,
    type vehicle_type NOT NULL,
    manufacturer VARCHAR(100),
    status vehicle_status DEFAULT 'INATIVO',
    max_flow_rate INTEGER,
    has_platform BOOLEAN DEFAULT false,
    capacity INTEGER,
    counter_initial BIGINT,
    counter_final BIGINT,
    plate VARCHAR(20),
    atve VARCHAR(50),
    atve_expiry DATE,
    observations TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. OPERATORS TABLE
CREATE TABLE operators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(150) NOT NULL,
    war_name VARCHAR(50) NOT NULL,
    company_id VARCHAR(50),
    gru_id VARCHAR(50),
    vest_number VARCHAR(20) UNIQUE,
    photo_url TEXT,
    status operator_status DEFAULT 'DESCONECTADO',
    category operator_category DEFAULT 'AERODROMO',
    shift_cycle shift_cycle DEFAULT 'MANHÃ',
    fleet_capability VARCHAR(10), -- 'CTA', 'SRV', or 'BOTH'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. AIRCRAFTS TABLE
CREATE TABLE aircrafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manufacturer VARCHAR(100),
    model VARCHAR(50) NOT NULL,
    prefix VARCHAR(20) UNIQUE NOT NULL,
    airline VARCHAR(100) NOT NULL,
    missing_cap BOOLEAN DEFAULT false,
    defective_door BOOLEAN DEFAULT false,
    defective_panel BOOLEAN DEFAULT false,
    no_autocut BOOLEAN DEFAULT false,
    observations TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. FLIGHTS TABLE (For Operational Mesh)
CREATE TABLE flights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date_ref DATE NOT NULL, -- The reference date (YYYY-MM-DD)
    flight_number VARCHAR(20) NOT NULL,
    departure_flight_number VARCHAR(20),
    airline VARCHAR(100),
    airline_code VARCHAR(10),
    model VARCHAR(50),
    registration VARCHAR(20),
    origin VARCHAR(50),
    destination VARCHAR(50),
    eta TIMESTAMP WITH TIME ZONE,
    etd TIMESTAMP WITH TIME ZONE,
    actual_arrival_time TIMESTAMP WITH TIME ZONE,
    position_id VARCHAR(20),
    position_type VARCHAR(10),
    pit_id VARCHAR(20),
    fuel_status INTEGER DEFAULT 0,
    status flight_status DEFAULT 'CHEGADA',
    operator_id UUID REFERENCES operators(id),
    vehicle_id UUID REFERENCES vehicles(id),
    volume INTEGER,
    is_on_ground BOOLEAN DEFAULT false,
    delay_justification TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. FLIGHT LOGS
CREATE TABLE flight_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flight_id UUID REFERENCES flights(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    log_type VARCHAR(50),
    message TEXT NOT NULL,
    author VARCHAR(100)
);

-- Indices for performance
CREATE INDEX idx_flights_date ON flights(date_ref);
CREATE INDEX idx_flights_status ON flights(status);
CREATE INDEX idx_logs_flight ON flight_logs(flight_id);
