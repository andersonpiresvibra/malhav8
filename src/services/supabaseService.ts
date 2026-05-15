import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Vehicle, OperatorProfile, AircraftType, FlightData, FlightStatus, MeshFlight } from '../types';
import { getLocalTodayDateStr } from '../utils/shiftUtils';

const checkConfig = () => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não configurado. Por favor, adicione suas credenciais reais (URL e Anon Key) em Settings -> Environment Variables. Os valores não podem conter "<project-ref>".');
  }
};

export interface AuditLogEntry {
  entity_type: string;
  entity_id?: string;
  action_type: string;
  flight_number?: string;
  flight_date?: string;
  registration?: string;
  field_changed?: string;
  old_value?: string;
  new_value?: string;
  user_name?: string;
  user_role?: string;
  metadata?: any;
}

export const insertAuditLog = async (logData: AuditLogEntry): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  try {
    let safeEntityId = null;
    if (logData.entity_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(logData.entity_id)) {
      safeEntityId = logData.entity_id;
    }
    
    const metadata = logData.metadata || {};
    if (logData.entity_id && !safeEntityId) {
        metadata.frontend_id = logData.entity_id;
    }

    const payload = { ...logData, entity_id: safeEntityId, metadata };

    const { error } = await supabase.from('audit_logs').insert([payload]);
    if (error) console.error('[Audit Log] Failed to insert log:', error.message);
  } catch (err) {
    console.error('[Audit Log] Exception inserting log:', err);
  }
};

export const getAuditLogs = async (limitCount: number = 1000): Promise<AuditLogEntry[]> => {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limitCount);
      
    if (error) {
      console.error('[Audit Log] Failed to fetch logs:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[Audit Log] Exception fetching logs:', err);
    return [];
  }
};

let operatorsCache: { id: string; warName: string }[] = [];
let vehiclesCache: { id: string; fleetNumber: string }[] = [];

export const getVehicles = async (): Promise<Vehicle[]> => {
  checkConfig();
  const { data, error } = await supabase.from('vehicles').select('*');
  if (error) throw error;
  
            const mapped = data.map((v: any) => ({
              id: v.fleet_number?.toString() || v.id?.toString(),
              type: v.type?.toString().toUpperCase() === 'CTA' ? 'CTA' : 'SERVIDOR',
              manufacturer: v.manufacturer,
              status: v.status,
              maxFlowRate: v.max_flow_rate || 1000,
              hasPlatform: v.has_platform,
              capacity: v.capacity,
              counterInitial: v.counter_initial,
              counterFinal: v.counter_final,
              isActive: v.status !== 'INATIVO',
              observations: v.observations,
              operatorId: v.operator_id
            })) as Vehicle[];
            vehiclesCache = data.map((v: any) => ({
              id: v.id,
              fleetNumber: v.fleet_number?.toString()
            }));
            return mapped;
};

export const updateVehicleOperator = async (vehicleFleetNumber: string | null, operatorId: string | null) => {
  checkConfig();
  
  // Se for null, vamos desvincular o operador do veículo dele atual
  if (vehicleFleetNumber === null && operatorId) {
    const { error } = await supabase
      .from('vehicles')
      .update({ operator_id: null })
      .eq('operator_id', operatorId);
    if (error) console.error("Error unlinking vehicle from operator:", error);
    return;
  }
  
  if (vehicleFleetNumber && operatorId) {
    // 1. Remove qualquer outro veículo que esse operador possa ter
    await supabase.from('vehicles').update({ operator_id: null }).eq('operator_id', operatorId);
    
    // 2. Vincula o novo
    const cleanVehicleId = vehicleFleetNumber.replace('SRV-', '').replace('CTA-', '');
    const vehicle = vehiclesCache.find(v => v.fleetNumber === cleanVehicleId || v.id === vehicleFleetNumber);
    if (!vehicle) return;
    
    // Desvincula quem estava com este veículo
    await supabase.from('vehicles').update({ operator_id: operatorId }).eq('id', vehicle.id);
  }
};

export const getOperators = async (): Promise<OperatorProfile[]> => {
  checkConfig();
  const { data, error } = await supabase.from('operators').select('*, operator_work_days(work_date, day_type)');
  if (error) throw error;
  
  operatorsCache = data.map((o: any) => ({ id: o.id, warName: o.war_name }));

  return data.map((o: any) => ({
    id: o.id,
    fullName: o.full_name,
    warName: o.war_name,
    companyId: o.company_id || '',
    gruId: o.gru_id || '',
    vestNumber: o.vest_number || '',
    photoUrl: o.photo_url || '',
    email: o.email || '',
    isLT: o.is_lt || 'NÃO',
    patio: o.patio || '',
    tmfLogin: o.tmf_login || '',
    bloodType: o.blood_type || '',
    role: o.role || '',
    status: o.status,
    category: o.category,
    lastPosition: '',
    fleetCapability: o.fleet_capability,
    shift: {
      cycle: o.shift_cycle,
      start: o.shift_start || '',
      end: o.shift_end || ''
    },
    airlines: ['G3'],
    ratings: { speed: 4.5, safety: 5.0, airlineSpecific: {} },
    expertise: { servidor: 80, cta: 50 },
    stats: { flightsWeekly: 0, flightsMonthly: 0, volumeWeekly: 0, volumeMonthly: 0 },
    workDays: o.operator_work_days?.map((wd: any) => ({
      date: wd.work_date,
      type: wd.day_type || 'TRABALHO'
    })) || []
  })) as OperatorProfile[];
};

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export const updateOperatorWorkDays = async (operatorId: string, workDays: Array<{ date: string; type: string }>): Promise<void> => {
  checkConfig();
  console.log('[updateOperatorWorkDays] Iniciando salvamento...', { operatorId, workDaysCount: workDays.length });
  
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Timeout de comunicação com o Supabase.')), 10000)
  );

  const saveOperation = async () => {
    const { error: deleteError } = await supabase
      .from('operator_work_days')
      .delete()
      .eq('operator_id', operatorId);
      
    console.log('[updateOperatorWorkDays] Delete result:', deleteError);
    if (deleteError) throw deleteError;
    
    if (workDays.length === 0) return;
    
    const insertPayload = workDays.map(wd => ({
      operator_id: operatorId,
      work_date: wd.date,
      day_type: wd.type
    }));
    
    console.log('[updateOperatorWorkDays] Insert payload preview:', insertPayload.slice(0, 2));

    const { error: insertError, data: insertData } = await supabase
      .from('operator_work_days')
      .insert(insertPayload)
      .select();
      
    console.log('[updateOperatorWorkDays] Insert result:', { error: insertError, dataCount: insertData?.length });
    if (insertError) throw insertError;
  };

  try {
    await Promise.race([saveOperation(), timeoutPromise]);
  } catch (err: any) {
    console.error('[updateOperatorWorkDays] Catch error:', err);
    throw err;
  }
};

export const getAircrafts = async (): Promise<AircraftType[]> => {
  checkConfig();
  const { data, error } = await supabase.from('aircrafts').select('*');
  if (error) throw error;
  return data as any[];
};

export const getFlights = async (dateRef: string): Promise<FlightData[]> => {
  checkConfig();
  const { data, error } = await supabase
    .from('flights')
    .select('*, operators(war_name), vehicles(fleet_number)')
    .eq('date_ref', dateRef);
    
  if (error) {
    console.error('[Supabase] Error fetching flights:', error.message);
    throw error;
  }
  
  return (data || []).map((f: any) => ({
    id: f.id,
    date: f.date_ref,
    flightNumber: f.flight_number,
    departureFlightNumber: f.departure_flight_number,
    airline: f.airline,
    airlineCode: f.airline_code,
    model: f.model,
    registration: f.registration,
    origin: f.origin,
    destination: f.destination,
    eta: f.eta || '',
    etd: f.etd || '',
    actualArrivalTime: f.actual_arrival_time,
    positionId: f.position_id,
    positionType: f.position_type as any,
    pitId: f.pit_id,
    fuelStatus: f.fuel_status || 0,
    status: f.status as FlightStatus,
    operator: f.operators?.war_name || undefined,
    operatorId: f.operator_id || undefined,
    fleet: f.vehicles?.fleet_number || undefined,
    vehicleId: f.vehicle_id || undefined,
    vehicleType: f.vehicle_type as any,
    volume: f.volume,
    isOnGround: f.is_on_ground,
    delayJustification: f.delay_justification,
    designationTime: f.designation_time ? new Date(f.designation_time) : undefined,
    startTime: f.start_time ? new Date(f.start_time) : undefined,
    endTime: f.end_time ? new Date(f.end_time) : undefined,
    assignmentTime: f.assignment_time ? new Date(f.assignment_time) : undefined,
    assignedByLt: f.assigned_by_lt,
    logs: [], // Fetch logs separately or use a sub-query?
    report: f.report || {}
  })) as FlightData[];
};

export const upsertFlight = async (flight: FlightData): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  
  const payload: any = {
    date_ref: flight.date || getLocalTodayDateStr(),
    flight_number: flight.flightNumber,
    departure_flight_number: flight.departureFlightNumber,
    airline: flight.airline,
    airline_code: flight.airlineCode,
    model: flight.model,
    registration: flight.registration,
    origin: flight.origin,
    destination: flight.destination,
    eta: cleanTime(flight.eta),
    etd: cleanTime(flight.etd),
    actual_arrival_time: cleanTime(flight.actualArrivalTime),
    position_id: flight.positionId,
    position_type: flight.positionType || null,
    pit_id: flight.pitId || null,
    fuel_status: flight.fuelStatus,
    status: flight.status,
    operator_id: flight.operatorId || operatorsCache.find(o => o.warName === flight.operator)?.id || null,
    vehicle_id: flight.vehicleId || vehiclesCache.find(v => v.fleetNumber === flight.fleet)?.id || null,
    volume: flight.volume || 0,
    is_on_ground: flight.isOnGround || false,
    delay_justification: flight.delayJustification || null,
    designation_time: flight.designationTime?.toISOString() || null,
    start_time: flight.startTime?.toISOString() || null,
    end_time: flight.endTime?.toISOString() || null,
    assignment_time: flight.assignmentTime?.toISOString() || null,
    assigned_by_lt: flight.assignedByLt || null,
    report: flight.report || {},
    updated_at: new Date().toISOString()
  };

  if (flight.id) {
     payload.id = flight.id;
  }

  const { data, error } = await supabase.from('flights').upsert([payload]).select('id');
  if (!error && data && data.length === 0) {
      console.warn("[Supabase] Upsert returned empty data. RLS might be silently blocking.");
      throw new Error("A inserção na malha operacional falhou silenciosamente no Supabase. Verifique se as políticas de segurança (RLS) da tabela 'flights' permitem INSERT/UPDATE.");
  }
  
  if (error) {
    if (error.message.includes("Could not find the table")) {
        throw new Error(`ESTRUTURA DA TABELA INVÁLIDA!\nVá ao SQL Editor no Supabase e rode: CREATE TABLE flights ( id UUID DEFAULT gen_random_uuid() PRIMARY KEY, date_ref text, flight_number text, airline text, airline_code text, model text, registration text, departure_flight_number text, origin text, destination text, eta text, etd text, actual_arrival_time text, position_id text, position_type text, pit_id text, fuel_status text, status text, designation_time timestamp, start_time timestamp, end_time timestamp, assignment_time timestamp, assigned_by_lt text, report jsonb, updated_at timestamp );\n\nErro original: ${error.message}`);
    } else if (error.message.includes('Could not find') || error.message.includes('does not exist')) {
        throw new Error(`ESTRUTURA DA TABELA INVÁLIDA (flights)!\nVá ao SQL Editor no Supabase e rode: ALTER TABLE flights ADD COLUMN IF NOT EXISTS date_ref text, ADD COLUMN IF NOT EXISTS airline text, ADD COLUMN IF NOT EXISTS airline_code text, ADD COLUMN IF NOT EXISTS model text, ADD COLUMN IF NOT EXISTS registration text, ADD COLUMN IF NOT EXISTS departure_flight_number text, ADD COLUMN IF NOT EXISTS origin text, ADD COLUMN IF NOT EXISTS eta text, ADD COLUMN IF NOT EXISTS etd text, ADD COLUMN IF NOT EXISTS actual_arrival_time text, ADD COLUMN IF NOT EXISTS designation_time timestamp, ADD COLUMN IF NOT EXISTS start_time timestamp, ADD COLUMN IF NOT EXISTS end_time timestamp, ADD COLUMN IF NOT EXISTS assignment_time timestamp, ADD COLUMN IF NOT EXISTS assigned_by_lt text, ADD COLUMN IF NOT EXISTS report jsonb, ADD COLUMN IF NOT EXISTS updated_at timestamp;\n\nErro original: ${error.message}`);
    }
    console.error('[Supabase] Error upserting flight:', error.message);
    throw error;
  }
};

export const deleteFlight = async (flightId: string): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.from('flights').delete().eq('id', flightId);
  if (error) {
    console.error('[Supabase] Error deleting flight:', error.message);
    throw error;
  }
};

export const getRootMesh = async (): Promise<MeshFlight[]> => {
  checkConfig();
  const { data, error } = await supabase
    .from('root_mesh')
    .select('*')
    .order('etd');
    
  if (error) {
    if (error.message.includes("Could not find the table")) {
        throw new Error(`ESTRUTURA DA TABELA INVÁLIDA!\nVá ao SQL Editor no Supabase e rode: CREATE TABLE root_mesh ( id UUID DEFAULT gen_random_uuid() PRIMARY KEY, date text, airline text, cia text, airline_code text, flight_number text, departure_flight_number text, destination text, destination_icao text, etd text, registration text, eta text, position_id text, actual_arrival_time text, model text, is_disabled boolean, updated_at timestamp );\n\nErro original: ${error.message}`);
    }
    console.error('[Supabase] Error fetching root mesh:', error.message);
    throw error;
  }
  
  return (data || []).map((f: any) => ({
    id: f.id,
    airline: f.airline,
    airlineCode: f.airline_code,
    flightNumber: f.flight_number,
    departureFlightNumber: f.departure_flight_number,
    destination: f.destination,
    etd: f.etd,
    registration: f.registration,
    eta: f.eta,
    positionId: f.position_id,
    actualArrivalTime: f.actual_arrival_time,
    model: f.model,
    disabled: f.is_disabled
  })) as MeshFlight[];
};

export const upsertRootMesh = async (flights: MeshFlight[]): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  
  let payload = flights.map(f => {
    const obj: any = {
      airline: f.airline,
      cia: f.airline,
      airline_code: f.airlineCode,
      flight_number: f.flightNumber,
      departure_flight_number: f.departureFlightNumber,
      destination: f.destination,
      destination_icao: f.destination,
      etd: cleanTime(f.etd),
      registration: f.registration,
      eta: cleanTime(f.eta),
      position_id: f.positionId,
      actual_arrival_time: cleanTime(f.actualArrivalTime),
      model: f.model,
      is_disabled: f.disabled || false,
      updated_at: new Date().toISOString()
    };
    if (f.id) {
       obj.id = f.id;
    }
    return obj;
  });

  let maxAttempts = 10;
  while (maxAttempts > 0) {
    const { error } = await supabase.from('root_mesh').upsert(payload);
    
    if (!error) return;

    const notFoundMatch = error.message.match(/Could not find the '([^']+)' column/);
    const doesNotExistMatch = error.message.match(/column\s+([^\s]+)\s+of relation/i) 
      || error.message.match(/column\s+([^\s]+)\s+does not exist/i);
    
    let missingCol = '';
    if (notFoundMatch && notFoundMatch[1]) {
       missingCol = notFoundMatch[1];
    } else if (doesNotExistMatch && doesNotExistMatch[1]) {
       missingCol = doesNotExistMatch[1].replace(/^.*\.([^.]+)$/, '$1').replace(/"/g, '');
    }

    if (missingCol) {
       console.warn(`[Supabase] column '${missingCol}' does not exist in root_mesh, retrying without it...`);
       payload = payload.map(p => {
           const newP = { ...p } as any;
           delete newP[missingCol];
           return newP;
       });
       maxAttempts--;
       continue;
    }

    console.error('[Supabase] Error upserting root mesh:', error.message);
    if (error.message.includes("Could not find the table")) {
        throw new Error(`ESTRUTURA DA TABELA INVÁLIDA!\nVá ao SQL Editor no Supabase e rode: CREATE TABLE root_mesh ( id UUID DEFAULT gen_random_uuid() PRIMARY KEY, date text, airline text, cia text, airline_code text, flight_number text, departure_flight_number text, destination text, destination_icao text, etd text, registration text, eta text, position_id text, actual_arrival_time text, model text, is_disabled boolean, updated_at timestamp );\n\nErro original: ${error.message}`);
    } else if (error.message.includes('Could not find') || error.message.includes('does not exist')) {
       throw new Error(`ESTRUTURA DA TABELA INVÁLIDA (root_mesh)!\nVá ao SQL Editor no Supabase e rode: ALTER TABLE root_mesh ADD COLUMN IF NOT EXISTS airline text, ADD COLUMN IF NOT EXISTS airline_code text, ADD COLUMN IF NOT EXISTS flight_number text, ADD COLUMN IF NOT EXISTS departure_flight_number text, ADD COLUMN IF NOT EXISTS destination text, ADD COLUMN IF NOT EXISTS etd text, ADD COLUMN IF NOT EXISTS registration text, ADD COLUMN IF NOT EXISTS eta text, ADD COLUMN IF NOT EXISTS position_id text, ADD COLUMN IF NOT EXISTS actual_arrival_time text, ADD COLUMN IF NOT EXISTS model text, ADD COLUMN IF NOT EXISTS is_disabled boolean, ADD COLUMN IF NOT EXISTS updated_at timestamp;\n\nErro original: ${error.message}`);
    }
    throw error;
  }
};

export const deleteRootMeshFlight = async (flightId: string): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.from('root_mesh').delete().eq('id', flightId);
  if (error) {
    console.error('[Supabase] Error deleting root mesh flight:', error.message);
    throw error;
  }
};

export const clearRootMesh = async (): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  // This is a workaround to delete all since we don't have a truncate RPC usually
  const { error } = await supabase.from('root_mesh').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) {
    console.error('[Supabase] Error clearing root mesh:', error.message);
    throw error;
  }
};

export const getBaseMeshFlights = async (dateRef: string): Promise<MeshFlight[]> => {
  checkConfig();
  
  // Find the date column name dynamically if it exists
  let dateCol = 'date';
  
  let { data, error } = await supabase
    .from('base_mesh_flights')
    .select('*')
    .eq('date', dateRef)
    .order('etd');
    
  if (error && error.message.includes("Could not find the table")) {
     throw new Error(`ESTRUTURA DA TABELA INVÁLIDA!\nVá ao SQL Editor no Supabase e rode: CREATE TABLE base_mesh_flights ( id UUID DEFAULT gen_random_uuid() PRIMARY KEY, date text, airline text, cia text, airline_code text, flight_number text, departure_flight_number text, destination text, destination_icao text, etd text, registration text, eta text, position_id text, actual_arrival_time text, model text, is_disabled boolean, updated_at timestamp );`);
  } else if (error && error.message.includes("does not exist")) {
     console.warn("[Supabase] column 'date' does not exist, falling back to fetching everything...");
     const fallback = await supabase.from('base_mesh_flights').select('*');
     data = fallback.data;
     const fallbackError = fallback.error;
     if (fallbackError) {
         if (fallbackError.message.includes("Could not find the table")) {
             throw new Error(`ESTRUTURA DA TABELA INVÁLIDA!\nVá ao SQL Editor no Supabase e rode: CREATE TABLE base_mesh_flights ( id UUID DEFAULT gen_random_uuid() PRIMARY KEY, date text, airline text, cia text, airline_code text, flight_number text, departure_flight_number text, destination text, destination_icao text, etd text, registration text, eta text, position_id text, actual_arrival_time text, model text, is_disabled boolean, updated_at timestamp );`);
         }
         throw fallbackError;
     }
  } else if (error) {
    console.error(`[Supabase] Error fetching base mesh for ${dateRef}:`, error.message);
    throw error;
  }
  
  if (!data) return [];
  
  return data.map(dbFlight => ({
    id: dbFlight.id,
    date: dbFlight.date || dateRef, // Fallback to requested date if no date column
    airline: dbFlight.airline || '',
    airlineCode: dbFlight.airline_code || dbFlight.airline?.substring(0,3) || '',
    flightNumber: dbFlight.flight_number || '',
    departureFlightNumber: dbFlight.departure_flight_number || dbFlight.flight_number || '', // Backup
    destination: dbFlight.destination || '',
    etd: dbFlight.etd || '00:00',
    registration: dbFlight.registration || '',
    eta: dbFlight.eta || dbFlight.etd || '00:00',
    positionId: dbFlight.position_id || '',
    actualArrivalTime: dbFlight.actual_arrival_time || '',
    model: dbFlight.model || '',
    disabled: dbFlight.is_disabled || false
  }));
};

const cleanTime = (timeStr: string | null | undefined): string | null => {
  if (!timeStr) return '00:00';
  const t = timeStr.trim().toUpperCase();
  if (t === '?' || t === 'PRÉ' || t === '' || !t.match(/^[0-9]{1,2}:[0-9]{2}/)) {
    return '00:00';
  }
  return t;
};

export const upsertBaseMeshFlights = async (flights: MeshFlight[]): Promise<void> => {
  if (!isSupabaseConfigured() || !flights.length) return;
  
  let payload = flights.map(f => {
    const obj: any = {
      date: f.date,
      airline: f.airline,
      cia: f.airline,
      airline_code: f.airlineCode,
      flight_number: f.flightNumber,
      departure_flight_number: f.departureFlightNumber,
      destination: f.destination,
      destination_icao: f.destination,
      etd: cleanTime(f.etd),
      registration: f.registration,
      eta: cleanTime(f.eta),
      position_id: f.positionId,
      actual_arrival_time: cleanTime(f.actualArrivalTime),
      model: f.model,
      is_disabled: f.disabled || false,
      updated_at: new Date().toISOString()
    };
    if (f.id) {
       obj.id = f.id;
    }
    return obj;
  });

  let maxAttempts = 10;
  while (maxAttempts > 0) {
    const { data, error } = await supabase.from('base_mesh_flights').upsert(payload).select('id');
    
    if (!error) {
       if (data && data.length === 0 && payload.length > 0) {
           throw new Error("A inserção falhou silenciosamente no Supabase. Verifique se as políticas de segurança (RLS) do banco de dados permitem (ou desabilite o RLS da tabela 'base_mesh_flights').");
       }
       return;
    }

    const notFoundMatch = error.message.match(/Could not find the '([^']+)' column/);
    const doesNotExistMatch = error.message.match(/column\s+([^\s]+)\s+of relation/i) 
      || error.message.match(/column\s+([^\s]+)\s+does not exist/i);
    
    let missingCol = '';
    if (notFoundMatch && notFoundMatch[1]) {
       missingCol = notFoundMatch[1];
    } else if (doesNotExistMatch && doesNotExistMatch[1]) {
       missingCol = doesNotExistMatch[1].replace(/^.*\.([^.]+)$/, '$1').replace(/"/g, '');
    }

    if (missingCol) {
       console.warn(`[Supabase] column '${missingCol}' does not exist in base_mesh_flights, retrying without it...`);
       payload = payload.map(p => {
           const newP = { ...p } as any;
           delete newP[missingCol];
           return newP;
       });
       maxAttempts--;
       if (maxAttempts === 0) {
           throw new Error(`O banco de dados 'base_mesh_flights' está faltando muitas colunas essenciais. Vá ao SQL Editor no Supabase e crie as colunas correspondentes ou altere o schema. Erro original: ${error.message}`);
       }
       continue;
    }

    if (error.message.includes("Could not find the table")) {
        throw new Error(`ESTRUTURA DA TABELA INVÁLIDA!\nVá ao SQL Editor no Supabase e rode EXATAMENTE este código:\n\nCREATE TABLE base_mesh_flights (\n  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n  date text,\n  airline text,\n  cia text,\n  airline_code text,\n  flight_number text,\n  departure_flight_number text,\n  destination text,\n  destination_icao text,\n  etd text,\n  registration text,\n  eta text,\n  position_id text,\n  actual_arrival_time text,\n  model text,\n  is_disabled boolean,\n  updated_at timestamp\n);\n\nErro original: ${error.message}`);
    } else if (error.message.includes('Could not find') || error.message.includes('does not exist')) {
       throw new Error(`ESTRUTURA DA TABELA INVÁLIDA!\nVá ao SQL Editor no Supabase e rode EXATAMENTE este código:\n\nALTER TABLE base_mesh_flights\nADD COLUMN IF NOT EXISTS date text,\nADD COLUMN IF NOT EXISTS airline text,\nADD COLUMN IF NOT EXISTS airline_code text,\nADD COLUMN IF NOT EXISTS flight_number text,\nADD COLUMN IF NOT EXISTS departure_flight_number text,\nADD COLUMN IF NOT EXISTS destination text,\nADD COLUMN IF NOT EXISTS etd text,\nADD COLUMN IF NOT EXISTS registration text,\nADD COLUMN IF NOT EXISTS eta text,\nADD COLUMN IF NOT EXISTS position_id text,\nADD COLUMN IF NOT EXISTS actual_arrival_time text,\nADD COLUMN IF NOT EXISTS model text,\nADD COLUMN IF NOT EXISTS is_disabled boolean,\nADD COLUMN IF NOT EXISTS updated_at timestamp;\n\nErro original: ${error.message}`);
    }
    throw new Error(`Erro ao inserir na base_mesh_flights: ${error.message}`);
  }
};

export const clearBaseMeshFlights = async (dateRef: string): Promise<void> => {
   if (!isSupabaseConfigured()) return;
   const { error } = await supabase.from('base_mesh_flights').delete().eq('date', dateRef);
   if (error) {
      if (error.message.includes("does not exist") && error.message.includes('date')) {
          console.warn("[Supabase] column 'date' does not exist, clearing all from base_mesh_flights instead");
          // If the table doesn't have a date column, just clear the whole thing or do nothing.
          // Let's call clearAllBaseMeshFlights
          await clearAllBaseMeshFlights();
          return;
      }
      console.error(`[Supabase] Error clearing base mesh for ${dateRef}:`, error.message);
      throw error;
   }
};

export const clearAllBaseMeshFlights = async (): Promise<void> => {
   if (!isSupabaseConfigured()) return;
   const { error } = await supabase.from('base_mesh_flights').delete().neq('id', '00000000-0000-0000-0000-000000000000');
   if (error) {
      console.error('[Supabase] Error clearing all base mesh flights:', error.message);
      throw error;
   }
};

export const bulkInsertFlights = async (flights: FlightData[]): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  
  const payload = flights.map(flight => {
    const obj: any = {
      date_ref: flight.date || getLocalTodayDateStr(),
      flight_number: flight.flightNumber,
      departure_flight_number: flight.departureFlightNumber,
      airline: flight.airline,
      airline_code: flight.airlineCode,
      model: flight.model,
      registration: flight.registration,
      origin: flight.origin,
      destination: flight.destination,
      eta: cleanTime(flight.eta),
      etd: cleanTime(flight.etd),
      actual_arrival_time: cleanTime(flight.actualArrivalTime),
      position_id: flight.positionId,
      position_type: flight.positionType || null,
      pit_id: flight.pitId || null,
      fuel_status: flight.fuelStatus,
      status: flight.status,
      operator_id: flight.operatorId || operatorsCache.find(o => o.warName === flight.operator)?.id || null,
      vehicle_id: flight.vehicleId || vehiclesCache.find(v => v.fleetNumber === flight.fleet)?.id || null,
      volume: flight.volume || 0,
      is_on_ground: flight.isOnGround || false,
      delay_justification: flight.delayJustification || null,
      designation_time: flight.designationTime?.toISOString() || null,
      start_time: flight.startTime?.toISOString() || null,
      end_time: flight.endTime?.toISOString() || null,
      assignment_time: flight.assignmentTime?.toISOString() || null,
      assigned_by_lt: flight.assignedByLt || null,
      report: flight.report || {},
      updated_at: new Date().toISOString()
    };
    if (flight.id) {
       obj.id = flight.id;
    }
    return obj;
  });

  const chunkSize = 100;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    const { data, error } = await supabase.from('flights').upsert(chunk).select('id');
    
    if (!error) {
       if (data && data.length === 0 && chunk.length > 0) {
           console.warn("[Supabase] Bulk Upsert returned empty data. This might be due to RLS policies silently blocking.");
           throw new Error("A inserção na malha operacional falhou silenciosamente no Supabase. Verifique se as políticas de segurança (RLS - Row Level Security) do banco de dados (tabela 'flights') permitem as permissões de INSERT/UPDATE.");
       }
    }

    if (error) {
        console.error('[Supabase] Error bulk inserting flights chunk:', error.message);
        if (error.message.includes("Could not find the table")) {
            throw new Error(`ESTRUTURA DA TABELA INVÁLIDA!\nVá ao SQL Editor no Supabase e rode: CREATE TABLE flights ( id UUID DEFAULT gen_random_uuid() PRIMARY KEY, date_ref text, flight_number text, airline text, airline_code text, model text, registration text, departure_flight_number text, origin text, destination text, eta text, etd text, actual_arrival_time text, position_id text, position_type text, pit_id text, fuel_status text, status text, designation_time timestamp, start_time timestamp, end_time timestamp, assignment_time timestamp, assigned_by_lt text, report jsonb, updated_at timestamp );\n\nErro original: ${error.message}`);
        } else if (error.message.includes('Could not find') || error.message.includes('does not exist')) {
            throw new Error(`ESTRUTURA DA TABELA INVÁLIDA (flights)!\nVá ao SQL Editor no Supabase e rode: ALTER TABLE flights ADD COLUMN IF NOT EXISTS date_ref text, ADD COLUMN IF NOT EXISTS airline text, ADD COLUMN IF NOT EXISTS airline_code text, ADD COLUMN IF NOT EXISTS model text, ADD COLUMN IF NOT EXISTS registration text, ADD COLUMN IF NOT EXISTS departure_flight_number text, ADD COLUMN IF NOT EXISTS origin text, ADD COLUMN IF NOT EXISTS eta text, ADD COLUMN IF NOT EXISTS etd text, ADD COLUMN IF NOT EXISTS actual_arrival_time text, ADD COLUMN IF NOT EXISTS designation_time timestamp, ADD COLUMN IF NOT EXISTS start_time timestamp, ADD COLUMN IF NOT EXISTS end_time timestamp, ADD COLUMN IF NOT EXISTS assignment_time timestamp, ADD COLUMN IF NOT EXISTS assigned_by_lt text, ADD COLUMN IF NOT EXISTS report jsonb, ADD COLUMN IF NOT EXISTS updated_at timestamp;\n\nErro original: ${error.message}`);
        }
        throw new Error(`Erro ao inserir na malha operacional: ${error.message}`);
    }
  }
};

export const getAerodromoConfig = async (): Promise<any> => {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase.from('aerodromo_config').select('*').limit(1).single();
  if (error && error.code !== 'PGRST116') {
     console.error('[Supabase] Error fetching aerodromo config:', error);
     return null;
  }
  return data;
};

export const updateAerodromoConfig = async (configPayload: any): Promise<void> => {
   if (!isSupabaseConfigured()) return;
   
   // Check if exists
   const { data } = await supabase.from('aerodromo_config').select('id').limit(1).single();
   
   if (data) {
      await supabase.from('aerodromo_config').update({ ...configPayload, updated_at: new Date().toISOString() }).eq('id', data.id);
   } else {
      await supabase.from('aerodromo_config').insert([configPayload]);
   }
};

export const clearFlightPosition = async (flightId: string): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase
    .from('flights')
    .update({ position_id: null, pit_id: null, position_type: null })
    .eq('id', flightId);

  if (error) {
    console.error(`[Supabase] Error clearing flight position for ${flightId}:`, error.message);
    throw error;
  }
};

export const clearAllFlightAssignments = async (): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  
  // First get all flights that have a position
  const { data: flightsToClear, error: fetchError } = await supabase
    .from('flights')
    .select('id')
    .not('position_id', 'is', null);

  if (fetchError) {
     console.error('[Supabase] Error finding flights to clear:', fetchError.message);
     throw fetchError;
  }

  if (flightsToClear && flightsToClear.length > 0) {
    const flightIds = flightsToClear.map(f => f.id);
    
    const { error: updateError } = await supabase
      .from('flights')
      .update({ position_id: null, pit_id: null, position_type: null })
      .in('id', flightIds);
      
    if (updateError) {
      console.error('[Supabase] Error clearing flight assignments:', updateError.message);
      throw updateError;
    }
  }
};
