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

    const { error } = await supabase.from('caixa_preta').insert([payload]);
    if (error) console.error('[Audit Log] Failed to insert log:', error.message);
  } catch (err) {
    console.error('[Audit Log] Exception inserting log:', err);
  }
};

export const getAuditLogs = async (limitCount: number = 1000): Promise<AuditLogEntry[]> => {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from('caixa_preta')
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

export const getDestinos = async (): Promise<any[]> => {
  checkConfig();
  const { data, error } = await supabase.from('destinos').select('*');
  if (error) throw error;
  
  if (data && data.length > 0) {
      return data.map((d: any) => ({
          ...d,
          flightNumber: d.flightNumber || d.flight_number || d.voo || d.prefixo || d.voo_chegada || d.voo_saida,
          departureFlightNumber: d.departureFlightNumber || d.voo_saida || d.departure_flight_number,
          airlineCode: d.airlineCode || d.airline_code || d.cia_cod || d.codigo_cia,
          airline: d.airline || d.cia || d.airline_name || d.companhia || d.empresa,
          destination: d.destination || d.destino || d.dest || d.cidade || d.city
      }));
  }
  
  return [];
};

export const getVehicles = async (): Promise<Vehicle[]> => {
  checkConfig();
  const { data, error } = await supabase.from('frotas').select('*');
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
      .from('frotas')
      .update({ operator_id: null })
      .eq('operator_id', operatorId);
    if (error) console.error("Error unlinking vehicle from operator:", error);
    return;
  }
  
  if (vehicleFleetNumber && operatorId) {
    // 1. Remove qualquer outro veículo que esse operador possa ter
    await supabase.from('frotas').update({ operator_id: null }).eq('operator_id', operatorId);
    
    // 2. Vincula o novo
    const cleanVehicleId = vehicleFleetNumber.replace('SRV-', '').replace('CTA-', '');
    const vehicle = vehiclesCache.find(v => v.fleetNumber === cleanVehicleId || v.id === vehicleFleetNumber);
    if (!vehicle) return;
    
    // Desvincula quem estava com este veículo
    await supabase.from('frotas').update({ operator_id: operatorId }).eq('id', vehicle.id);
  }
};

export const getOperators = async (): Promise<OperatorProfile[]> => {
  checkConfig();
  const { data, error } = await supabase.from('operadores_geral').select('*, oper_do_dia(work_date, day_type)');
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
    workDays: o.oper_do_dia?.map((wd: any) => ({
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
      .from('oper_do_dia')
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
      .from('oper_do_dia')
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
  const { data, error } = await supabase.from('aeronaves').select('*');
  if (error) throw error;
  return data as any[];
};

export const getFlights = async (dateRef: string): Promise<FlightData[]> => {
  checkConfig();
  
  let query = supabase.from('flights').select('*, operadores_geral(war_name), frotas(fleet_number)').eq('date_ref', dateRef);
  let { data, error } = await query;
    
  // SMART RETRY: Se o cache de esquema estiver sujo e não encontrar a coluna 'logs' (ou outra), tentamos colunas seguras
  if (error && (error.message.includes('Could not find') || error.message.includes('does not exist') || error.message.includes('logs'))) {
      console.warn('[Supabase] Stale schema cache detected in getFlights, retrying with explicit safe column list...');
      const safeColumns = 'id, date_ref, flight_number, departure_flight_number, airline, airline_code, model, registration, origin, destination, eta, etd, actual_arrival_time, position_id, position_type, pit_id, fuel_status, status, operator_id, vehicle_id, vehicle_type, volume, is_on_ground, delay_justification, designation_time, start_time, end_time, assignment_time, assigned_by_lt, report, operadores_geral(war_name), frotas(fleet_number)';
      const retry = await supabase.from('flights').select(safeColumns).eq('date_ref', dateRef);
      data = retry.data;
      error = retry.error;
  }
  
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
    logs: f.logs || [],
    report: f.report || {}
  })) as FlightData[];
};

export const deleteAllFlightsByDate = async (dateRef: string): Promise<void> => {
  checkConfig();
  const { error } = await supabase
    .from('flights')
    .delete()
    .eq('date_ref', dateRef);
    
  if (error) {
    console.error('[Supabase] Error deleting flights:', error.message);
    throw error;
  }
};

export const deleteInactiveFlightsByDate = async (dateRef: string): Promise<void> => {
  checkConfig();
  const { error } = await supabase
    .from('flights')
    .delete()
    .eq('date_ref', dateRef)
    .is('operator_id', null)
    .in('status', ['CHEGADA', 'FILA']);
    
  if (error) {
    console.error('[Supabase] Error deleting inactive flights:', error.message);
    throw error;
  }
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
    logs: flight.logs || [],
    updated_at: new Date().toISOString()
  };

  if (flight.id) {
     payload.id = flight.id;
  }

  let { data, error } = await supabase.from('flights').upsert([payload]).select('id');
  
  // SMART RETRY: Se faltar alguma coluna no banco, removemos e tentamos de novo
  if (error && (error.message.includes('Could not find') || error.message.includes('does not exist'))) {
      const missingMatch = error.message.match(/column "(.*?)"/);
      const missingCol = missingMatch ? missingMatch[1] : null;
      
      if (missingCol) {
          console.warn(`[Supabase] Coluna '${missingCol}' ausente em 'flights', tentando salvar sem ela...`);
          const cleanedPayload = { ...payload };
          delete cleanedPayload[missingCol];
          const retry = await supabase.from('flights').upsert([cleanedPayload]).select('id');
          data = retry.data;
          error = retry.error;
      }
  }

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
    .from('malha_raiz')
    .select('*')
    .order('etd');
    
  if (error) {
    if (error.message.includes("Could not find the table")) {
        throw new Error(`ESTRUTURA DA TABELA INVÁLIDA!\nVá ao SQL Editor no Supabase e rode: CREATE TABLE malha_raiz ( id UUID DEFAULT gen_random_uuid() PRIMARY KEY, date text, airline text, cia text, airline_code text, flight_number text, departure_flight_number text, destination text, destination_icao text, etd text, registration text, eta text, position_id text, actual_arrival_time text, model text, is_disabled boolean, updated_at timestamp );\n\nErro original: ${error.message}`);
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
    const { error } = await supabase.from('malha_raiz').upsert(payload);
    
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
       console.warn(`[Supabase] column '${missingCol}' does not exist in malha_raiz, retrying without it...`);
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
        throw new Error(`ESTRUTURA DA TABELA INVÁLIDA!\nVá ao SQL Editor no Supabase e rode: CREATE TABLE malha_raiz ( id UUID DEFAULT gen_random_uuid() PRIMARY KEY, date text, airline text, cia text, airline_code text, flight_number text, departure_flight_number text, destination text, destination_icao text, etd text, registration text, eta text, position_id text, actual_arrival_time text, model text, is_disabled boolean, updated_at timestamp );\n\nErro original: ${error.message}`);
    } else if (error.message.includes('Could not find') || error.message.includes('does not exist')) {
       throw new Error(`ESTRUTURA DA TABELA INVÁLIDA (malha_raiz)!\nVá ao SQL Editor no Supabase e rode: ALTER TABLE malha_raiz ADD COLUMN IF NOT EXISTS airline text, ADD COLUMN IF NOT EXISTS airline_code text, ADD COLUMN IF NOT EXISTS flight_number text, ADD COLUMN IF NOT EXISTS departure_flight_number text, ADD COLUMN IF NOT EXISTS destination text, ADD COLUMN IF NOT EXISTS etd text, ADD COLUMN IF NOT EXISTS registration text, ADD COLUMN IF NOT EXISTS eta text, ADD COLUMN IF NOT EXISTS position_id text, ADD COLUMN IF NOT EXISTS actual_arrival_time text, ADD COLUMN IF NOT EXISTS model text, ADD COLUMN IF NOT EXISTS is_disabled boolean, ADD COLUMN IF NOT EXISTS updated_at timestamp;\n\nErro original: ${error.message}`);
    }
    throw error;
  }
};

export const deleteRootMeshFlight = async (flightId: string): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.from('malha_raiz').delete().eq('id', flightId);
  if (error) {
    console.error('[Supabase] Error deleting root mesh flight:', error.message);
    throw error;
  }
};

export const clearRootMesh = async (): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  // This is a workaround to delete all since we don't have a truncate RPC usually
  const { error } = await supabase.from('malha_raiz').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) {
    console.error('[Supabase] Error clearing root mesh:', error.message);
    throw error;
  }
};

export const getBaseMeshFlights = async (dateRef: string): Promise<MeshFlight[]> => {
  checkConfig();
  
  let { data, error } = await supabase
    .from('flights')
    .select('*')
    .eq('date_ref', dateRef)
    .eq('status', 'PRÉ') // Apenas os da Malha Base
    .order('etd');
    
  if (error && error.message.includes("does not exist")) {
     console.warn("[Supabase] fallback para getBaseMesh...", error.message);
     const fallback = await supabase.from('flights').select('*').eq('date_ref', dateRef);
     data = fallback.data;
     error = fallback.error;
  }

  if (error) {
    console.error(`[Supabase] Error fetching base mesh:`, error.message);
    throw error;
  }
  
  if (!data) return [];

  console.log(`[getBaseMeshFlights] Fetched ${data.length} flights from flights. Filtering for date: ${dateRef}`);
  console.log(`[getBaseMeshFlights] Sample row:`, data[0]);
  
  // Try to find the date column dynamically if it's named something else
  const filteredData = data.filter((row: any) => {
    const rowDate = row.date || row.date_ref || row.data || row.voo_data || row.flight_date;
    return rowDate === dateRef;
  });

  console.log(`[getBaseMeshFlights] After filtering: ${filteredData.length} flights match ${dateRef}`);
  
  const finalData = filteredData.length > 0 ? filteredData : data; // Fallback to all if date filter fails or if user just wants to see them

  return finalData.map(dbFlight => ({
    id: dbFlight.id,
    date: dbFlight.date || dbFlight.date_ref || dbFlight.data || dbFlight.voo_data || dbFlight.flight_date || dateRef,
    airline: dbFlight.airline || dbFlight.cia || '',
    airlineCode: dbFlight.airline_code || dbFlight.cia_cod || dbFlight.airline?.substring(0,3) || '',
    flightNumber: dbFlight.flight_number || dbFlight.voo || dbFlight.voo_chegada || dbFlight.prefixo || '',
    departureFlightNumber: dbFlight.departure_flight_number || dbFlight.voo_saida || dbFlight.flight_number || '', // Backup
    destination: dbFlight.destination || dbFlight.destino || '',
    etd: dbFlight.etd || '00:00',
    registration: dbFlight.registration || dbFlight.matricula || '',
    eta: dbFlight.eta || dbFlight.etd || '00:00',
    positionId: dbFlight.position_id || dbFlight.posicao || '',
    actualArrivalTime: dbFlight.actual_arrival_time || '',
    model: dbFlight.model || dbFlight.modelo || dbFlight.equipamento || '',
    disabled: dbFlight.is_disabled || dbFlight.desabilitado || false
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

export const upsertBaseMeshFlights = async (flightsBase: MeshFlight[]): Promise<void> => {
  if (!isSupabaseConfigured() || !flightsBase.length) return;
  
  let payload = flightsBase.map(f => {
    const obj: any = {
      date_ref: f.date,
      airline: f.airline,
      airline_code: f.airlineCode,
      flight_number: f.flightNumber,
      departure_flight_number: f.departureFlightNumber,
      destination: f.destination,
      etd: cleanTime(f.etd),
      registration: f.registration,
      eta: cleanTime(f.eta),
      position_id: f.positionId,
      actual_arrival_time: cleanTime(f.actualArrivalTime),
      model: f.model,
      updated_at: new Date().toISOString(),
      status: 'PRÉ'
    };
    if (f.id && !f.id.toString().startsWith('mesh-')) {
       obj.id = f.id;
    }
    return obj;
  });

  let maxAttempts = 10;
  while (maxAttempts > 0) {
    const { data, error } = await supabase.from('flights').upsert(payload).select('id');
    
    if (!error) {
       if (data && data.length === 0 && payload.length > 0) {
           throw new Error("A inserção falhou silenciosamente no Supabase. Verifique se as políticas de segurança (RLS) do banco de dados permitem (ou desabilite o RLS da tabela 'flights').");
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
       console.warn(`[Supabase] column '${missingCol}' does not exist in flights, retrying without it...`);
       payload = payload.map(p => {
           const newP = { ...p } as any;
           delete newP[missingCol];
           return newP;
       });
       maxAttempts--;
       if (maxAttempts === 0) {
           throw new Error(`O banco de dados 'flights' está faltando muitas colunas essenciais. Erro original: ${error.message}`);
       }
       continue;
    }

    throw new Error(`Erro ao inserir na flights (Malha Base): ${error.message}`);
  }
};

export const clearBaseMeshFlights = async (dateRef: string): Promise<void> => {
   if (!isSupabaseConfigured()) return;
   const { error } = await supabase.from('flights').delete().eq('date_ref', dateRef).eq('status', 'PRÉ');
   if (error) {
      console.error(`[Supabase] Error clearing base mesh for ${dateRef}:`, error.message);
      throw error;
   }
};

export const clearAllBaseMeshFlights = async (): Promise<void> => {
   if (!isSupabaseConfigured()) return;
   const { error } = await supabase.from('flights').delete().eq('status', 'PRÉ');
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
      logs: flight.logs || [],
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
    let { data, error } = await supabase.from('flights').upsert(chunk).select('id');
    
    // SMART RETRY: Se faltar alguma coluna no banco, removemos e tentamos de novo
    if (error && (error.message.includes('Could not find') || error.message.includes('does not exist'))) {
        const missingMatch = error.message.match(/column "(.*?)"/);
        const missingCol = missingMatch ? missingMatch[1] : null;
        
        if (missingCol) {
            console.warn(`[Supabase] Coluna '${missingCol}' ausente em 'flights', tentando salvar sem ela...`);
            const cleanedChunk = chunk.map(item => {
                const newItem = { ...item };
                delete (newItem as any)[missingCol];
                return newItem;
            });
            const retry = await supabase.from('flights').upsert(cleanedChunk).select('id');
            data = retry.data;
            error = retry.error;
        }
    }

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
