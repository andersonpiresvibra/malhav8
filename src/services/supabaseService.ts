import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Vehicle, OperatorProfile, AircraftType, FlightData } from '../types';

const checkConfig = () => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não configurado. Por favor, adicione suas credenciais reais (URL e Anon Key) em Settings -> Environment Variables. Os valores não podem conter "<project-ref>".');
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
    .select('*, operators(*), vehicles(*)')
    .eq('date_ref', dateRef);
  if (error) throw error;
  return data as any[];
};
