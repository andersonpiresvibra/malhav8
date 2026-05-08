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
  const { data, error } = await supabase.from('operators').select('*');
  if (error) throw error;
  
  return data.map((o: any) => ({
    id: o.id,
    fullName: o.full_name,
    warName: o.war_name,
    companyId: o.company_id || '',
    gruId: o.gru_id || '',
    vestNumber: o.vest_number || '',
    photoUrl: o.photo_url || `https://i.pravatar.cc/150?u=${o.id}`,
    status: o.status,
    category: o.category,
    lastPosition: '',
    fleetCapability: o.fleet_capability,
    shift: {
      cycle: o.shift_cycle,
      start: '06:00', // Mock for now if not in DB
      end: '14:00'
    },
    airlines: ['G3'],
    ratings: { speed: 4.5, safety: 5.0, airlineSpecific: {} },
    expertise: { servidor: 80, cta: 50 },
    stats: { flightsWeekly: 0, flightsMonthly: 0, volumeWeekly: 0, volumeMonthly: 0 }
  })) as OperatorProfile[];
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
