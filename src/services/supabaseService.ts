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

export const getVehicles = async (): Promise<Vehicle[]> => {
  checkConfig();
  const { data, error } = await supabase.from('vehicles').select('*');
  if (error) throw error;
  
            return data.map((v: any) => ({
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
              observations: v.observations
            })) as Vehicle[];
};

export const getOperators = async (): Promise<OperatorProfile[]> => {
  checkConfig();
  const { data, error } = await supabase.from('operators').select('*, operator_work_days(work_date, day_type)');
  if (error) throw error;
  
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
    .select('*')
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
    operator: f.operator_id, // Map ID to string for now or fetch joined?
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
  
  const payload = {
    id: flight.id,
    date_ref: flight.date || getLocalTodayDateStr(),
    flight_number: flight.flightNumber,
    departure_flight_number: flight.departureFlightNumber,
    airline: flight.airline,
    airline_code: flight.airlineCode,
    model: flight.model,
    registration: flight.registration,
    origin: flight.origin,
    destination: flight.destination,
    eta: flight.eta || null,
    etd: flight.etd || null,
    actual_arrival_time: flight.actualArrivalTime || null,
    position_id: flight.positionId,
    position_type: flight.positionType || null,
    pit_id: flight.pitId || null,
    fuel_status: flight.fuelStatus,
    status: flight.status,
    operator_id: flight.operator || null,
    vehicle_id: flight.fleet || null,
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

  const { error } = await supabase.from('flights').upsert([payload]);
  if (error) {
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
  
  const payload = flights.map(f => ({
    id: (f.id.startsWith('new-') || f.id.startsWith('imp-')) ? undefined : f.id,
    airline: f.airline,
    airline_code: f.airlineCode,
    flight_number: f.flightNumber,
    departure_flight_number: f.departureFlightNumber,
    destination: f.destination,
    etd: f.etd,
    registration: f.registration,
    eta: f.eta,
    position_id: f.positionId,
    actual_arrival_time: f.actualArrivalTime,
    model: f.model,
    is_disabled: f.disabled || false,
    updated_at: new Date().toISOString()
  }));

  const { error } = await supabase.from('root_mesh').upsert(payload);
  if (error) {
    console.error('[Supabase] Error upserting root mesh:', error.message);
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

export const bulkInsertFlights = async (flights: FlightData[]): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  
  const payload = flights.map(flight => ({
    id: flight.id,
    date_ref: flight.date || getLocalTodayDateStr(),
    flight_number: flight.flightNumber,
    departure_flight_number: flight.departureFlightNumber,
    airline: flight.airline,
    airline_code: flight.airlineCode,
    model: flight.model,
    registration: flight.registration,
    origin: flight.origin,
    destination: flight.destination,
    eta: flight.eta || null,
    etd: flight.etd || null,
    actual_arrival_time: flight.actualArrivalTime || null,
    position_id: flight.positionId,
    position_type: flight.positionType || null,
    pit_id: flight.pitId || null,
    fuel_status: flight.fuelStatus,
    status: flight.status,
    operator_id: flight.operator || null,
    vehicle_id: flight.fleet || null,
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
  }));

  const chunkSize = 100;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    const { error } = await supabase.from('flights').upsert(chunk);
    if (error) {
        console.error('[Supabase] Error bulk inserting flights chunk:', error.message);
        throw error;
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
