import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Vehicle, OperatorProfile, AircraftType, FlightData, FlightStatus, MeshFlight } from '../types';
import { getLocalTodayDateStr } from '../utils/shiftUtils';

export const safeLocalStorageSetItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (error: any) {
    const isQuotaError = error.name === 'QuotaExceededError' || 
                         error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
                         (error.message && error.message.includes('exceeded the quota'));
    if (isQuotaError) {
      console.warn(`[localStorage] Cota esgotada ao gravar no cache para a chave '${key}'. Limpando caches antigos...`);
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('supabase_cache_flights_') || k.startsWith('supabase_cache_basemesh_flights_'))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        localStorage.setItem(key, value);
        console.log(`[localStorage] Chave '${key}' gravada com sucesso após limpeza de cota.`);
      } catch (retryError) {
        console.warn(`[localStorage] Ainda sem espaço após limpar caches de voos para a chave '${key}'. Ignorando silenciosamente.`, retryError);
      }
    } else {
      console.warn(`[localStorage] Falha não relacionada a cota ao gravar chave '${key}':`, error);
    }
  }
};

if (typeof window !== 'undefined') {
  (window as any).missingTablesDetected = (window as any).missingTablesDetected || [];
}

export const registerMissingTable = (tableName: string) => {
  if (typeof window !== 'undefined') {
    const list = (window as any).missingTablesDetected as string[];
    if (!list.includes(tableName)) {
      list.push(tableName);
      window.dispatchEvent(new CustomEvent('supabase-missing-tables', { detail: list }));
    }
  }
};

export const checkAndRegisterError = (errorMessage: string, tableName: string): boolean => {
  if (!errorMessage) return false;
  const isMissing = errorMessage.includes('Could not find the table') || 
                    errorMessage.includes('relation') && errorMessage.includes('does not exist') ||
                    errorMessage.includes('42P01') || 
                    errorMessage.includes('PGRST116');
  if (isMissing) {
    registerMissingTable(tableName);
    return true;
  }
  return false;
};

const ensureValidUuid = (idStr: string | undefined): string => {
  if (!idStr) {
    return '00000000-0000-4000-a000-000000000000'.replace(/[0a]/g, () => Math.floor(Math.random() * 16).toString(16));
  }
  
  // Strip client-side transient flags or prefixes
  const cleanId = idStr.replace(/^mesh-\d+-/i, '').replace(/^temp-/i, '').replace(/^mesh-/i, '');
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(cleanId)) {
    return cleanId.toLowerCase();
  }
  
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) {
    hash = (hash << 5) - hash + idStr.charCodeAt(i);
    hash |= 0;
  }
  
  let fullHash = '';
  for (let block = 0; block < 4; block++) {
    let subHash = 1717;
    for (let i = 0; i < idStr.length; i++) {
       subHash = (subHash * 33) ^ idStr.charCodeAt(i) ^ (block * 997);
    }
    fullHash += Math.abs(subHash).toString(16).padEnd(8, '0');
  }
  
  const safeHex = fullHash.toLowerCase().replace(/[^0-9a-f]/g, 'f').substring(0, 32).padEnd(32, 'a');
  
  const part1 = safeHex.substring(0, 8);
  const part2 = safeHex.substring(8, 12);
  const part3 = '4' + safeHex.substring(13, 16); 
  const part4 = 'a' + safeHex.substring(17, 20); 
  const part5 = safeHex.substring(20, 32);
  
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
};

// Autoadaptação de schemas para tabelas no Supabase (conflito de colunas locais vs produção)
const knownMissingColumns = new Set<string>();

export const filterPayloadForExistingColumns = (payload: any): any => {
  if (!payload) return payload;
  if (Array.isArray(payload)) {
    return payload.map(item => filterPayloadForExistingColumns(item));
  }
  const filtered = { ...payload };
  for (const col of knownMissingColumns) {
    delete filtered[col];
  }
  return filtered;
};

export const detectAndRegisterMissingColumn = (errorMessage: string): boolean => {
  if (!errorMessage) return false;
  // Captura erros de coluna não encontrada em POSTGREST / Postgres (com aspas simples ou duplas)
  const missingColumnMatch = errorMessage.match(/Could not find the ['"]([^'"]+)['"] column/) || 
                             errorMessage.match(/column ['"]([^'"]+)['"] does not exist/) ||
                             errorMessage.match(/column ['"]([^'"]+)['"] of relation/);
  
  if (missingColumnMatch && missingColumnMatch[1]) {
    const colName = missingColumnMatch[1];
    if (!knownMissingColumns.has(colName)) {
      console.warn(`[Supabase Enterprise] Detectada coluna ausente na tabela no banco: '${colName}'. Descartando-a temporariamente do payload...`);
      knownMissingColumns.add(colName);
    }
    return true; // Retorna sempre true para incentivar o loop de re-tentativa a aplicar o novo filtro de colunas
  }
  return false;
};

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

export const getFallbackVehicles = (): Vehicle[] => {
  return [
    { id: '2104', type: 'SERVIDOR', manufacturer: 'FORD', status: 'DISPONÍVEL', maxFlowRate: 1000, hasPlatform: false, capacity: 5000, currentVolume: 0, currentPosition: '', lastPosition: '', isActive: true },
    { id: '2108', type: 'SERVIDOR', manufacturer: 'FORD', status: 'DISPONÍVEL', maxFlowRate: 1000, hasPlatform: false, capacity: 5000, currentVolume: 0, currentPosition: '', lastPosition: '', isActive: true },
    { id: '2111', type: 'SERVIDOR', manufacturer: 'FORD', status: 'DISPONÍVEL', maxFlowRate: 1000, hasPlatform: false, capacity: 5000, currentVolume: 0, currentPosition: '', lastPosition: '', isActive: true },
    { id: '2113', type: 'SERVIDOR', manufacturer: 'FORD', status: 'DISPONÍVEL', maxFlowRate: 1000, hasPlatform: false, capacity: 5000, currentVolume: 0, currentPosition: '', lastPosition: '', isActive: true },
    { id: '2122', type: 'SERVIDOR', manufacturer: 'MERCEDES-BENZ', status: 'DISPONÍVEL', maxFlowRate: 2000, hasPlatform: true, capacity: 8000, currentVolume: 0, currentPosition: '', lastPosition: '', isActive: true },
    { id: '2123', type: 'SERVIDOR', manufacturer: 'MERCEDES-BENZ', status: 'OCUPADO', maxFlowRate: 2000, hasPlatform: true, capacity: 8000, currentVolume: 0, currentPosition: 'REM 211', lastPosition: '', isActive: true, operatorId: 'op-002' },
    { id: '2124', type: 'SERVIDOR', manufacturer: 'MERCEDES-BENZ', status: 'DISPONÍVEL', maxFlowRate: 2000, hasPlatform: true, capacity: 8000, currentVolume: 0, currentPosition: '', lastPosition: '', isActive: true },
    { id: '2125', type: 'SERVIDOR', manufacturer: 'MERCEDES-BENZ', status: 'DISPONÍVEL', maxFlowRate: 2000, hasPlatform: true, capacity: 8000, currentVolume: 0, currentPosition: '', lastPosition: '', isActive: true },
    { id: '1405', type: 'CTA', manufacturer: 'MISTER-CTA', status: 'DISPONÍVEL', maxFlowRate: 1500, hasPlatform: false, capacity: 15000, currentVolume: 12000, currentPosition: '', lastPosition: '', isActive: true },
    { id: '1425', type: 'CTA', manufacturer: 'MISTER-CTA', status: 'DISPONÍVEL', maxFlowRate: 2000, hasPlatform: false, capacity: 20000, currentVolume: 18000, currentPosition: '', lastPosition: '', isActive: true },
    { id: '1426', type: 'CTA', manufacturer: 'MISTER-CTA', status: 'DISPONÍVEL', maxFlowRate: 2000, hasPlatform: false, capacity: 20000, currentVolume: 15000, currentPosition: '', lastPosition: '', isActive: true }
  ];
};

export const getFallbackOperators = (): OperatorProfile[] => {
  return [
    {
      id: 'op-001',
      fullName: 'João Silva',
      warName: 'SILVA',
      companyId: 'VIBRA',
      gruId: 'GRU-001',
      vestNumber: '001',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60',
      email: 'silva@vibra.com.br',
      isLT: 'NÃO',
      isUsuario: false,
      isAdministrador: false,
      isMaster: false,
      patio: 'AERODROMO',
      tmfLogin: 'SILVA1',
      bloodType: 'O+',
      role: 'Op. Pleno',
      status: 'DISPONÍVEL',
      category: 'AERODROMO',
      lastPosition: '',
      fleetCapability: 'SRV',
      shift: { cycle: 'MANHÃ', start: '06:00', end: '14:00' },
      airlines: ['G3', 'LA'],
      ratings: { speed: 4.5, safety: 5.0, airlineSpecific: {} },
      expertise: { servidor: 80, cta: 50 },
      stats: { flightsWeekly: 14, flightsMonthly: 58, volumeWeekly: 120000, volumeMonthly: 500000 },
      workDays: []
    },
    {
      id: 'op-002',
      fullName: 'Anderson Souza',
      warName: 'SOUZA',
      companyId: 'VIBRA',
      gruId: 'GRU-002',
      vestNumber: '002',
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=60',
      email: 'souza@vibra.com.br',
      isLT: 'NÃO',
      isUsuario: false,
      isAdministrador: false,
      isMaster: false,
      patio: 'ILHA',
      tmfLogin: 'SOUZA2',
      bloodType: 'A+',
      role: 'Op. Pleno',
      status: 'OCUPADO',
      category: 'ILHA',
      lastPosition: '',
      fleetCapability: 'BOTH',
      shift: { cycle: 'MANHÃ', start: '06:00', end: '14:00' },
      airlines: ['LA'],
      ratings: { speed: 4.8, safety: 4.9, airlineSpecific: {} },
      expertise: { servidor: 90, cta: 85 },
      stats: { flightsWeekly: 18, flightsMonthly: 72, volumeWeekly: 160000, volumeMonthly: 640000 },
      workDays: []
    },
    {
      id: 'op-003',
      fullName: 'Pedro Cabral',
      warName: 'CABRAL',
      companyId: 'VIBRA',
      gruId: 'GRU-003',
      vestNumber: '003',
      photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=60',
      email: 'cabral@vibra.com.br',
      isLT: 'NÃO',
      isUsuario: false,
      isAdministrador: false,
      isMaster: false,
      patio: 'AERODROMO',
      tmfLogin: 'CABRAL3',
      bloodType: 'AB-',
      role: 'Op. Sênior',
      status: 'DISPONÍVEL',
      category: 'AERODROMO',
      lastPosition: '',
      fleetCapability: 'BOTH',
      shift: { cycle: 'MANHÃ', start: '06:00', end: '14:00' },
      airlines: ['G3', 'LA', 'AD'],
      ratings: { speed: 4.9, safety: 5.0, airlineSpecific: {} },
      expertise: { servidor: 95, cta: 95 },
      stats: { flightsWeekly: 20, flightsMonthly: 85, volumeWeekly: 220000, volumeMonthly: 900000 },
      workDays: []
    },
    {
      id: 'op-004',
      fullName: 'Ricardo Barbosa',
      warName: 'BARBOSA',
      companyId: 'VIBRA',
      gruId: 'GRU-004',
      vestNumber: '004',
      photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=60',
      email: 'barbosa@vibra.com.br',
      isLT: 'SIM',
      isUsuario: true,
      isAdministrador: true,
      isMaster: false,
      patio: 'AMBOS',
      tmfLogin: 'BARBOSA4',
      bloodType: 'B+',
      role: 'Op. LT',
      status: 'DISPONÍVEL',
      category: 'AMBOS',
      lastPosition: '',
      fleetCapability: 'SRV',
      shift: { cycle: 'MANHÃ', start: '06:00', end: '14:00' },
      airlines: ['G3', 'LA'],
      ratings: { speed: 4.2, safety: 4.8, airlineSpecific: {} },
      expertise: { servidor: 75, cta: 10 },
      stats: { flightsWeekly: 10, flightsMonthly: 40, volumeWeekly: 80000, volumeMonthly: 320000 },
      workDays: []
    }
  ];
};

export const getFallbackDestinos = (): any[] => {
  return [
    { flightNumber: 'LA1234', departureFlightNumber: 'LA1235', airlineCode: 'LA', airline: 'LATAM', destination: 'SBGL', city: 'Rio de Janeiro (GIG)' },
    { flightNumber: 'AD2098', departureFlightNumber: 'AD2099', airlineCode: 'AD', airline: 'Azul', destination: 'SBSP', city: 'São Paulo (CGH)' },
    { flightNumber: 'G34012', departureFlightNumber: 'G34013', airlineCode: 'G3', airline: 'Gol', destination: 'SBBR', city: 'Brasília (BSB)' }
  ];
};

export const getDestinos = async (): Promise<any[]> => {
  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] Não configurado. Retornando destinos de contingência.');
    return getFallbackDestinos();
  }
  
  try {
    // 1. Pega tabela de destinos estáticos (ICAO -> Cidade)
    const { data: destData, error: destError } = await supabase.from('destinos').select('*');
    if (destError) console.warn('[Supabase] Erro ao buscar destinos, usando cache/fallback:', destError.message);
    let destinosBase = destData || [];
    
    // 2. Tenta puxar inteligência de voos passados da malha operacional para ajudar no auto-complete (limita aos ultimos 500 para ser rapido mas util)
    const { data: voosData, error: voosError } = await supabase
      .from('malha_operacional')
      .select('flight_number, departure_flight_number, destination, airline_code, airline')
      .limit(1000)
      .order('created_at', { ascending: false });
      
    if (voosError) console.warn('[Supabase] Erro ao buscar malha operacional em getDestinos:', voosError.message);
      
    let allDestinos: any[] = [];
    
    // Array para mapeamento rapido de ICAO -> City
    const mapIcaoToCity = (icao: string) => {
       const match = destinosBase.find(d => d.icao === icao);
       return match ? match.city : '';
    };

    if (destinosBase.length > 0) {
        allDestinos = destinosBase.map((d: any) => ({
            ...d,
            flightNumber: d.flightNumber || d.flight_number || d.voo || d.prefixo || d.voo_chegada || d.voo_saida,
            departureFlightNumber: d.departureFlightNumber || d.voo_saida || d.departure_flight_number,
            airlineCode: d.airlineCode || d.airline_code || d.cia_cod || d.codigo_cia,
            airline: d.airline || d.cia || d.airline_name || d.companhia || d.empresa,
            destination: d.destination || d.destino || d.dest || d.cidade || d.city || d.icao
        }));
    }
    
    if (voosData && voosData.length > 0) {
        // Remover duplicatas
        const unicos = new Map();
        voosData.forEach(v => {
            if (v.departure_flight_number && !unicos.has(v.departure_flight_number)) {
                unicos.set(v.departure_flight_number, {
                    flightNumber: v.flight_number,
                    departureFlightNumber: v.departure_flight_number,
                    airlineCode: v.airline_code,
                    airline: v.airline,
                    destination: v.destination,
                    city: mapIcaoToCity(v.destination)
                });
            }
        });
        allDestinos = [...allDestinos, ...Array.from(unicos.values())];
    }
    
    return allDestinos.length > 0 ? allDestinos : getFallbackDestinos();
  } catch (err) {
    console.warn('[Supabase] Falha ao carregar destinos, aplicando contingência offline:', err);
    return getFallbackDestinos();
  }
};

export const getVehicles = async (): Promise<Vehicle[]> => {
  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] Não configurado. Retornando frota de contingência.');
    return getFallbackVehicles();
  }
  try {
    const { data, error } = await supabase.from('frotas').select('*');
    if (error) {
      console.error('[Supabase] Error fetching vehicles:', error.message);
      checkAndRegisterError(error.message, 'frotas');
      const cached = localStorage.getItem('supabase_cache_vehicles');
      if (cached) {
        console.warn('[Supabase] Returning cached vehicles list');
        window.dispatchEvent(new CustomEvent('supabase-network-state', { detail: { offline: true } }));
        return JSON.parse(cached);
      }
      return getFallbackVehicles();
    }
    
    const mapped = data.map((v: any) => ({
      id: v.fleet_number?.toString() || v.id?.toString(),
      type: v.type?.toString().toUpperCase() === 'CTA' ? 'CTA' : 'SERVIDOR',
      manufacturer: v.manufacturer,
      status: v.status,
      maxFlowRate: v.max_flow_rate || 1000,
      hasPlatform: v.has_platform,
      capacity: v.capacity,
      currentVolume: v.current_volume !== undefined ? v.current_volume : 0,
      currentPosition: v.current_position || '',
      lastPosition: v.last_position || '',
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

    safeLocalStorageSetItem('supabase_cache_vehicles', JSON.stringify(mapped));
    return mapped;
  } catch (err: any) {
    console.warn('[Supabase] Exception in getVehicles, aplicando contingência offline:', err);
    const cached = localStorage.getItem('supabase_cache_vehicles');
    if (cached) {
      window.dispatchEvent(new CustomEvent('supabase-network-state', { detail: { offline: true } }));
      return JSON.parse(cached);
    }
    return getFallbackVehicles();
  }
};

export const updateVehicleOperator = async (vehicleFleetNumber: string | null, operatorId: string | null) => {
  if (!isSupabaseConfigured()) return;
  
  // Se for null, vamos desvincular o operador do veículo dele atual
  if (vehicleFleetNumber === null && operatorId) {
    const { error } = await supabase
      .from('frotas')
      .update({ operator_id: null })
      .eq('operator_id', operatorId);
    if (error) console.error("Error unlinking vehicle from operator:", error);
    return;
  }
  
  // Desvincula o veículo informado de qualquer operador se operatorId for nulo e vehicleFleetNumber for informado.
  if (vehicleFleetNumber && operatorId === null) {
      const cleanVehicleId = vehicleFleetNumber.replace('SRV-', '').replace('CTA-', '');
      const vehicle = vehiclesCache.find(v => v.fleetNumber === cleanVehicleId || v.id === vehicleFleetNumber);
      if (vehicle) {
        await supabase.from('frotas').update({ operator_id: null }).eq('id', vehicle.id);
      } else {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(vehicleFleetNumber);
        if (isUuid) {
          await supabase.from('frotas').update({ operator_id: null }).eq('id', vehicleFleetNumber);
        } else {
          await supabase.from('frotas').update({ operator_id: null }).eq('fleet_number', cleanVehicleId);
        }
      }
      return;
  }
  
  if (vehicleFleetNumber && operatorId) {
    // 1. Remove qualquer outro veículo que esse operador possa ter
    await supabase.from('frotas').update({ operator_id: null }).eq('operator_id', operatorId);
    
    // 2. Vincula o novo
    const cleanVehicleId = vehicleFleetNumber.replace('SRV-', '').replace('CTA-', '');
    const vehicle = vehiclesCache.find(v => v.fleetNumber === cleanVehicleId || v.id === vehicleFleetNumber);
    
    if (vehicle) {
      // Vincula usando o id do veículo do DB
      await supabase.from('frotas').update({ operator_id: operatorId }).eq('id', vehicle.id);
    } else {
      // Fallback
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(vehicleFleetNumber);
      if (isUuid) {
        await supabase.from('frotas').update({ operator_id: operatorId }).eq('id', vehicleFleetNumber);
      } else {
        await supabase.from('frotas').update({ operator_id: operatorId }).eq('fleet_number', cleanVehicleId);
      }
    }
  }
};

export const updateVehicle = async (vehicleId: string, updates: any) => {
  if (!isSupabaseConfigured()) return;
  
  // Extrai o ID limpo se vier no formato SRV-XXX ou CTA-XXX
  const cleanVehicleId = vehicleId.replace('SRV-', '').replace('CTA-', '');
  let idToUpdate = vehicleId;

  if (vehiclesCache && vehiclesCache.length > 0) {
     const vehicle = vehiclesCache.find(v => v.fleetNumber === cleanVehicleId || v.id === vehicleId);
     if (vehicle) idToUpdate = vehicle.id;
  }

  // Prepara os campos para a tabela do DB:
  const dbUpdates: any = {};
  if ('isActive' in updates) dbUpdates.status = updates.isActive ? 'DISPONÍVEL' : 'INATIVO';
  if ('status' in updates) dbUpdates.status = updates.status;
  if ('observations' in updates) dbUpdates.observations = updates.observations;
  if ('currentVolume' in updates) dbUpdates.current_volume = updates.currentVolume;
  if ('currentPosition' in updates) dbUpdates.current_position = updates.currentPosition;
  if ('lastPosition' in updates) dbUpdates.last_position = updates.lastPosition;
  
  if ('operatorId' in updates) {
    dbUpdates.operator_id = (updates.operatorId === null || updates.operatorId === undefined || updates.operatorId === '') ? null : updates.operatorId;
  } else if ('operatorName' in updates) {
    if (updates.operatorName === null || updates.operatorName === undefined || updates.operatorName === '') {
      dbUpdates.operator_id = null;
    } else {
      const match = operatorsCache.find(o => o.warName === updates.operatorName || o.id === updates.operatorName);
      if (match) {
        dbUpdates.operator_id = match.id;
      }
    }
  }
  
  let query = supabase.from('frotas').update(dbUpdates);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idToUpdate);
  if (isUuid) {
    query = query.eq('id', idToUpdate);
  } else {
    query = query.eq('fleet_number', cleanVehicleId);
  }
  
  const { error } = await query;
  if (error) console.error("Error updating vehicle in db:", error);
};

export const getOperators = async (): Promise<OperatorProfile[]> => {
  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] Não configurado. Retornando operadores de contingência.');
    return getFallbackOperators();
  }
  try {
    const { data, error } = await supabase.from('operadores_geral').select('*, oper_do_dia(work_date, day_type)');
    if (error) {
      console.error('[Supabase] Error fetching operators:', error.message);
      const cached = localStorage.getItem('supabase_cache_operators');
      if (cached) {
        console.warn('[Supabase] Returning cached operators list');
        window.dispatchEvent(new CustomEvent('supabase-network-state', { detail: { offline: true } }));
        return JSON.parse(cached);
      }
      return getFallbackOperators();
    }
    
    operatorsCache = data.map((o: any) => ({ id: o.id, warName: o.war_name }));

    const mapped = data.map((o: any) => ({
      id: o.id,
      fullName: o.full_name,
      warName: o.war_name,
      companyId: o.company_id || '',
      gruId: o.gru_id || '',
      vestNumber: o.vest_number || '',
      photoUrl: o.photo_url || '',
      email: o.email || '',
      isLT: o.is_lt || 'NÃO',
      isUsuario: 'is_usuario' in o ? !!o.is_usuario : (o.is_lt === 'SIM'),
      isAdministrador: !!o.is_administrador,
      isMaster: !!o.is_master,
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

    safeLocalStorageSetItem('supabase_cache_operators', JSON.stringify(mapped));
    return mapped;
  } catch (err: any) {
    console.warn('[Supabase] Exception in getOperators, aplicando contingência offline:', err);
    const cached = localStorage.getItem('supabase_cache_operators');
    if (cached) {
      window.dispatchEvent(new CustomEvent('supabase-network-state', { detail: { offline: true } }));
      return JSON.parse(cached);
    }
    return getFallbackOperators();
  }
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
  if (!isSupabaseConfigured()) return;
  
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Timeout de comunicação com o Supabase.')), 10000)
  );

  const saveOperation = async () => {
    const { error: deleteError } = await supabase
      .from('oper_do_dia')
      .delete()
      .eq('operator_id', operatorId);
      
    if (deleteError) throw deleteError;
    
    if (workDays.length === 0) return;
    
    const insertPayload = workDays.map(wd => ({
      operator_id: operatorId,
      work_date: wd.date,
      day_type: wd.type
    }));
    

    const { error: insertError, data: insertData } = await supabase
      .from('oper_do_dia')
      .insert(insertPayload)
      .select();
      
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
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase.from('aeronaves').select('*');
    if (error) {
      console.error('[Supabase] Error fetching aircrafts:', error.message);
      const cached = localStorage.getItem('supabase_cache_aircrafts');
      if (cached) {
        console.warn('[Supabase] Returning cached aircrafts list');
        return JSON.parse(cached);
      }
      throw error;
    }
    const mapped = (data || []).map((a: any) => ({
      ...a,
      model: a.model || a.modelo || a.modelo_id || '--'
    }));
    safeLocalStorageSetItem('supabase_cache_aircrafts', JSON.stringify(mapped));
    return mapped as any[];
  } catch (err: any) {
    console.error('[Supabase] Exception in getAircrafts:', err);
    const cached = localStorage.getItem('supabase_cache_aircrafts');
    if (cached) {
      console.warn('[Supabase] Returning cached aircrafts after exception');
      try {
        const parsed = JSON.parse(cached);
        return parsed.map((a: any) => ({
          ...a,
          model: a.model || a.modelo || a.modelo_id || '--'
        }));
      } catch (ex) {
        return [];
      }
    }
    throw err;
  }
};

const generateDateSpecificUuid = (meshId: string, dateStr: string): string => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let baseUuid = meshId || '';
  
  if (!uuidRegex.test(baseUuid)) {
    let hash = 0;
    for (let i = 0; i < baseUuid.length; i++) {
      hash = (hash << 5) - hash + baseUuid.charCodeAt(i);
      hash |= 0;
    }
    const hexHash = Math.abs(hash).toString(16).padEnd(12, 'f').substring(0, 12);
    baseUuid = `e0000000-0000-4000-a000-${hexHash}`;
  }

  const parts = dateStr.split('-');
  const yearStr = parts[0] ? parts[0] : '2026';
  const monthStr = parts[1] ? parts[1] : '06';
  const dayStr = parts[2] ? parts[2] : '01';

  const dateSegment = `${dayStr}${monthStr}${yearStr}`;
  const paddedDateSegment = dateSegment.substring(0, 8).padEnd(8, '0');
  return `${paddedDateSegment}-${baseUuid.substring(9)}`;
};

const mergeWithBaseMesh = async (opFlights: FlightData[], dateRef: string): Promise<FlightData[]> => {
  let baseMesh: MeshFlight[] = [];
  try {
    baseMesh = await getBaseMeshFlights(dateRef);
  } catch (e) {
    console.warn('[Supabase] Falha ao carregar malha base para a unificação:', e);
    return opFlights;
  }

  const finalMergedFlights: FlightData[] = [];
  const opFlightsMap = new Map<string, FlightData>();
  
  opFlights.forEach(f => {
    opFlightsMap.set(f.id, f);
  });

  // 1. Processa cada voo da Malha Base
  baseMesh.forEach(baseF => {
    if (baseF.disabled) return; // Ignora voos desabilitados na malha base

    // Gera o ID virtual exclusivo para o dia atual baseado no contrato original
    const dateSpecificId = generateDateSpecificUuid(baseF.id, dateRef);

    const opF = opFlightsMap.get(dateSpecificId);

    if (!opF) {
      // Voo virtual da Malha Base que ainda não está criado fisicamente na tabela operacional
      const virtualFlight: FlightData = {
        id: dateSpecificId,
        date: dateRef,
        flightNumber: baseF.flightNumber || '',
        departureFlightNumber: baseF.departureFlightNumber || '',
        airline: baseF.airline || '',
        airlineCode: baseF.airlineCode || '',
        model: baseF.model || '',
        registration: baseF.registration || '',
        origin: 'SBGR',
        destination: baseF.destination || '',
        eta: baseF.eta || '00:00',
        etd: baseF.etd || '00:00',
        actualArrivalTime: baseF.actualArrivalTime || '',
        positionId: baseF.positionId || '',
        fuelStatus: 0,
        status: 'CHEGADA' as FlightStatus,
        logs: [{
          id: 'system-init',
          timestamp: new Date(),
          type: 'SISTEMA',
          message: 'Voo operacional herdeiro gerado automaticamente a partir da Malha Base.',
          author: 'SISTEMA'
        }],
        report: {}
      };
      finalMergedFlights.push(virtualFlight);
    } else {
      // Voo operacional cadastrado no banco de dados para esse dia
      if (opF.report?.isDeletedLocal) {
        return; // Ignora se o operador o marcou como deletado localmente
      }

      const inheritedFields = ["flightNumber", "departureFlightNumber", "airline", "airlineCode", "destination", "model", "registration", "eta", "etd"];
      const mergedFlight = { ...opF };
      mergedFlight.id = dateSpecificId; // Garante que o voo unificado siga com o ID específico do dia
      const overriddenObj = opF.report?.overriddenFields || {};

      inheritedFields.forEach(field => {
        const isOverridden = overriddenObj[field] === true;
        if (!isOverridden) {
          const baseValue = (baseF as any)[field];
          if (baseValue !== undefined && baseValue !== "") {
            (mergedFlight as any)[field] = baseValue;
          }
        }
      });

      finalMergedFlights.push(mergedFlight);
    }
  });

  // 2. Adiciona voos criados localmente na operacional do dia que não derivam da Malha Base
  opFlights.forEach(opF => {
    const existsInBase = baseMesh.some(baseF => {
      const dateSpecificId = generateDateSpecificUuid(baseF.id, dateRef);
      return dateSpecificId === opF.id;
    });
    if (!existsInBase) {
      if (!opF.report?.isDeletedLocal) {
        finalMergedFlights.push(opF);
      }
    }
  });

  // 3. Garantir unicidade contratual absoluta de IDs para mitigar avisos de chaves duplicadas no React
  const seenIds = new Set<string>();
  const uniqueFlights: FlightData[] = [];
  finalMergedFlights.forEach(f => {
    if (f.id && !seenIds.has(f.id)) {
      seenIds.add(f.id);
      uniqueFlights.push(f);
    }
  });

  return uniqueFlights;
};

export const getFlights = async (dateRef: string): Promise<FlightData[]> => {
  if (!isSupabaseConfigured()) return [];
  
  try {
    // Carrega a lista de aeronaves para o cruzamento de modelos
    let aircraftsList: any[] = [];
    try {
      aircraftsList = await getAircrafts();
    } catch (e) {
      console.warn('[Supabase] Falha ao carregar aeronaves para preenchimento de modelos:', e);
    }

    let query = supabase.from('malha_operacional').select('*, operadores_geral(war_name), frotas(fleet_number)').eq('date_ref', dateRef);
    let { data, error } = await query;
      
    // Se falhar devido a problemas de relacionamento no banco/schema cache, executa o fallback robusto
    if (error && (
      error.message.includes('relationship') || 
      error.message.includes('operadores_geral') || 
      error.message.includes('frotas') ||
      error.message.includes('Could not find') ||
      error.message.includes('column') ||
      error.message.includes('not exist')
    )) {
      console.warn('[Supabase] Relacionamento ausente ou erro de colunas detectado no cache de esquemas. Executando fallback em memória...', error.message);
      
      const rawRes = await supabase.from('malha_operacional').select('*').eq('date_ref', dateRef);
      if (rawRes.error) {
        throw rawRes.error;
      }
      
      // Auto-detecta colunas ausentes na tabela se houver dados retornados para prevenir erros de inserção futuros
      if (rawRes.data && rawRes.data.length > 0) {
        const firstRow = rawRes.data[0];
        const expectedCols = [
          'operator_id', 'support_operator_id', 'vehicle_id', 'wing_side', 
          'vehicle_type', 'support_operator', 'volume', 'is_on_ground', 
          'delay_justification', 'is_excluded_from_queue'
        ];
        for (const col of expectedCols) {
          if (!(col in firstRow)) {
            knownMissingColumns.add(col);
          }
        }
      }
      
      // Popula operadoresCache se estiver vazio
      if (operatorsCache.length === 0) {
        try {
          const opsRes = await supabase.from('operadores_geral').select('id, war_name');
          if (opsRes.data) {
            operatorsCache = opsRes.data.map((o: any) => ({ id: o.id, warName: o.war_name }));
          }
        } catch (e) {
          console.error('[Supabase] Erro ao carregar operadoresCache para fallback:', e);
        }
      }
      
      // Popula frotas/veículos se estiver vazio
      if (vehiclesCache.length === 0) {
        try {
          const vehsRes = await supabase.from('frotas').select('id, fleet_number');
          if (vehsRes.data) {
            vehiclesCache = vehsRes.data.map((v: any) => ({ id: v.id, fleetNumber: v.fleet_number }));
          }
        } catch (e) {
          console.error('[Supabase] Erro ao carregar vehiclesCache para fallback:', e);
        }
      }
      
      const fallbackMapped = (rawRes.data || []).map((f: any) => {
        const opName = operatorsCache.find(o => o.id === f.operator_id)?.warName || f.operator || '';
        const supportOpName = operatorsCache.find(o => o.id === f.support_operator_id)?.warName || f.support_operator || '';
        const fleetNum = vehiclesCache.find(v => v.id === f.vehicle_id)?.fleetNumber || undefined;
        
        // Auto-fill do modelo baseado no prefixo se estiver em branco ou '--'
        const reg = f.registration || '';
        let modelVal = f.model || '';
        if ((!modelVal || modelVal === '--') && reg) {
          const cleanReg = reg.replace(/[^A-Z0-9]/ig, '').toUpperCase();
          const found = aircraftsList.find(a => {
            const cleanAeroPrefix = String(a.prefix || '').replace(/[^A-Z0-9]/ig, '').toUpperCase();
            return cleanAeroPrefix === cleanReg || cleanAeroPrefix.endsWith(cleanReg);
          });
          if (found && found.model && found.model !== '--') {
            modelVal = found.model;
          }
        }

        return {
          id: f.id,
          date: f.date_ref,
          flightNumber: f.flight_number,
          departureFlightNumber: f.departure_flight_number,
          airline: f.airline,
          airlineCode: f.airline_code,
          model: modelVal,
          registration: f.registration,
          origin: f.origin,
          destination: f.destination,
          eta: f.eta || '',
          etd: f.etd || '',
          actualArrivalTime: f.actual_arrival_time,
          positionId: f.position_id,
          positionType: f.position_type as any,
          pitId: f.pit_id,
          wingSide: f.wing_side as any,
          fuelStatus: f.fuel_status || 0,
          status: f.status as FlightStatus,
          operator: opName,
          operatorId: f.operator_id || undefined,
          supportOperator: supportOpName,
          supportOperatorId: f.support_operator_id || undefined,
          fleet: fleetNum,
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
          isExcludedFromQueue: f.is_excluded_from_queue,
          logs: f.logs || [],
          report: f.report || {}
        };
      }) as FlightData[];
      
      const mergedFallback = await mergeWithBaseMesh(fallbackMapped, dateRef);
      safeLocalStorageSetItem(`supabase_cache_flights_${dateRef}`, JSON.stringify(mergedFallback));
      window.dispatchEvent(new CustomEvent('supabase-network-state', { detail: { offline: false } }));
      return mergedFallback;
    }
      
    if (error) {
      console.error('[Supabase] Error fetching flights:', error.message);
      checkAndRegisterError(error.message, 'malha_operacional');
      const cached = localStorage.getItem(`supabase_cache_flights_${dateRef}`);
      if (cached) {
        console.warn('[Supabase] Returning cached flights for date:', dateRef);
        window.dispatchEvent(new CustomEvent('supabase-network-state', { detail: { offline: true } }));
        return JSON.parse(cached);
      }
      if (checkAndRegisterError(error.message, 'malha_operacional')) {
        return [];
      }
      throw error;
    }
    
    const mapped = (data || []).map((f: any) => {
      // Auto-fill do modelo baseado no prefixo se estiver em branco ou '--'
      const reg = f.registration || '';
      let modelVal = f.model || '';
      if ((!modelVal || modelVal === '--') && reg) {
        const cleanReg = reg.replace(/[^A-Z0-9]/ig, '').toUpperCase();
        const found = aircraftsList.find(a => {
          const cleanAeroPrefix = String(a.prefix || '').replace(/[^A-Z0-9]/ig, '').toUpperCase();
          return cleanAeroPrefix === cleanReg || cleanAeroPrefix.endsWith(cleanReg);
        });
        if (found && found.model && found.model !== '--') {
          modelVal = found.model;
        }
      }

      return {
        id: f.id,
        date: f.date_ref,
        flightNumber: f.flight_number,
        departureFlightNumber: f.departure_flight_number,
        airline: f.airline,
        airlineCode: f.airline_code,
        model: modelVal,
        registration: f.registration,
        origin: f.origin,
        destination: f.destination,
        eta: f.eta || '',
        etd: f.etd || '',
        actualArrivalTime: f.actual_arrival_time,
        positionId: f.position_id,
        positionType: f.position_type as any,
        pitId: f.pit_id,
        wingSide: f.wing_side as any,
        fuelStatus: f.fuel_status || 0,
        status: f.status as FlightStatus,
        operator: f.operadores_geral?.war_name || f.operator, // Fallback for backwards comp
        operatorId: f.operator_id || undefined,
        supportOperator: f.support_operator || undefined,
        supportOperatorId: f.support_operator_id || undefined,
        fleet: f.frotas?.fleet_number || undefined,
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
        isExcludedFromQueue: f.is_excluded_from_queue,
        logs: f.logs || [],
        report: f.report || {}
      };
    }) as FlightData[];

    const mergedNormal = await mergeWithBaseMesh(mapped, dateRef);
    safeLocalStorageSetItem(`supabase_cache_flights_${dateRef}`, JSON.stringify(mergedNormal));
    window.dispatchEvent(new CustomEvent('supabase-network-state', { detail: { offline: false } }));
    return mergedNormal;
  } catch (err: any) {
    console.error('[Supabase] Exception in getFlights:', err);
    if (checkAndRegisterError(err.message || '', 'malha_operacional')) {
      const cached = localStorage.getItem(`supabase_cache_flights_${dateRef}`);
      if (cached) return JSON.parse(cached);
      return [];
    }
    const cached = localStorage.getItem(`supabase_cache_flights_${dateRef}`);
    if (cached) {
      console.warn('[Supabase] Returning cached flights after exception for date:', dateRef);
      window.dispatchEvent(new CustomEvent('supabase-network-state', { detail: { offline: true } }));
      return JSON.parse(cached);
    }
    throw err;
  }
};

export const deleteAllFlightsByDate = async (dateRef: string): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase
    .from('malha_operacional')
    .delete()
    .eq('date_ref', dateRef);
    
  if (error) {
    console.error('[Supabase] Error deleting flights:', error.message);
    throw error;
  }
};

export const deleteInactiveFlightsByDate = async (dateRef: string): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  
  let q = supabase
    .from('malha_operacional')
    .delete()
    .eq('date_ref', dateRef)
    .in('status', ['CHEGADA', 'FILA']);
    
  if (!knownMissingColumns.has('operator_id')) {
    q = q.is('operator_id', null);
  }
  
  const { error } = await q;
    
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
    wing_side: flight.wingSide || null,
    fuel_status: flight.fuelStatus,
    status: flight.status,
    operator_id: (
      flight.operatorId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(flight.operatorId)
        ? flight.operatorId
        : (flight.operator ? operatorsCache.find(o => o.warName === flight.operator)?.id : null)
    ) || null,
    support_operator_id: (
      flight.supportOperatorId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(flight.supportOperatorId)
        ? flight.supportOperatorId
        : (flight.supportOperator ? operatorsCache.find(o => o.warName === flight.supportOperator)?.id : null)
    ) || null,
    support_operator: flight.supportOperator || null,
    vehicle_id: (
      flight.vehicleId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(flight.vehicleId)
        ? flight.vehicleId
        : (flight.vehicleId ? vehiclesCache.find(v => v.fleetNumber === String(flight.vehicleId))?.id : null)
    ) || (
      flight.fleet
        ? vehiclesCache.find(v => v.fleetNumber === String(flight.fleet).replace('SRV-', '').replace('CTA-', ''))?.id
        : null
    ) || null,
    vehicle_type: flight.vehicleType || null,
    volume: flight.volume || 0,
    is_on_ground: flight.isOnGround || false,
    delay_justification: flight.delayJustification || null,
    designation_time: flight.designationTime?.toISOString() || null,
    start_time: flight.startTime?.toISOString() || null,
    end_time: flight.endTime?.toISOString() || null,
    assignment_time: flight.assignmentTime?.toISOString() || null,
    assigned_by_lt: flight.assignedByLt || null,
    is_excluded_from_queue: flight.isExcludedFromQueue || false,
    report: flight.report || {},
    logs: flight.logs || [],
    updated_at: new Date().toISOString()
  };

  if (flight.id) {
     payload.id = ensureValidUuid(flight.id);
  }

  let attempts = 0;
  const maxAttempts = 12;
  let currentPayload = { ...payload };
  let errorToThrow: any = null;

  while (attempts < maxAttempts) {
    const filteredPayload = filterPayloadForExistingColumns(currentPayload);
    let { data, error } = await supabase.from('malha_operacional').upsert([filteredPayload]).select('id');
    
    if (!error) {
      if (data && data.length === 0) {
        console.warn("[Supabase] Upsert returned empty data. RLS might be silently blocking.");
        throw new Error("A inserção na malha operacional falhou silenciosamente no Supabase. Verifique se as políticas de segurança (RLS) da tabela 'malha_operacional' permitem INSERT/UPDATE.");
      }
      return; // Succeeded!
    }
    
    const registered = detectAndRegisterMissingColumn(error.message);
    if (registered) {
      attempts++;
      console.log(`[Supabase] Erro detectado no salvamento de voo, retentando sem coluna ausente (Ref: '${error.message}')`);
      continue;
    }
    
    errorToThrow = error;
    break;
  }

  if (errorToThrow) {
    if (errorToThrow.message.includes("Could not find the table") || errorToThrow.message.includes("relation") && errorToThrow.message.includes("does not exist")) {
        throw new Error(`ESTRUTURA DA TABELA INVÁLIDA!\nVá ao SQL Editor no Supabase e rode o script abaixo para criar a tabela:\n\n` +
          `CREATE TABLE IF NOT EXISTS malha_operacional (\n` +
          `  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n` +
          `  date_ref TEXT NOT NULL,\n` +
          `  flight_number TEXT NOT NULL,\n` +
          `  departure_flight_number TEXT,\n` +
          `  airline TEXT,\n` +
          `  airline_code TEXT,\n` +
          `  model TEXT,\n` +
          `  registration TEXT,\n` +
          `  origin TEXT,\n` +
          `  destination TEXT,\n` +
          `  eta TEXT,\n` +
          `  etd TEXT,\n` +
          `  actual_arrival_time TEXT,\n` +
          `  position_id TEXT,\n` +
          `  position_type TEXT,\n` +
          `  pit_id TEXT,\n` +
          `  wing_side TEXT,\n` +
          `  fuel_status INTEGER DEFAULT 0,\n` +
          `  status TEXT DEFAULT 'CHEGADA', \n` +
          `  volume INTEGER DEFAULT 0,\n` +
          `  is_on_ground BOOLEAN DEFAULT false,\n` +
          `  delay_justification TEXT,\n` +
          `  designation_time TIMESTAMP WITH TIME ZONE,\n` +
          `  start_time TIMESTAMP WITH TIME ZONE,\n` +
          `  end_time TIMESTAMP WITH TIME ZONE,\n` +
          `  assignment_time TIMESTAMP WITH TIME ZONE,\n` +
          `  assigned_by_lt TEXT,\n` +
          `  is_excluded_from_queue BOOLEAN DEFAULT false,\n` +
          `  report JSONB DEFAULT '{}'::jsonb,\n` +
          `  logs JSONB DEFAULT '[]'::jsonb,\n` +
          `  operator_id UUID,\n` +
          `  support_operator_id UUID,\n` +
          `  support_operator TEXT,\n` +
          `  vehicle_id UUID,\n` +
          `  vehicle_type TEXT,\n` +
          `  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,\n` +
          `  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL\n` +
          `);\n\nErro original: ${errorToThrow.message}`);
    } else {
        const ddlScript = `ALTER TABLE malha_operacional \n` +
          `  ADD COLUMN IF NOT EXISTS date_ref text, \n` +
          `  ADD COLUMN IF NOT EXISTS airline text, \n` +
          `  ADD COLUMN IF NOT EXISTS airline_code text, \n` +
          `  ADD COLUMN IF NOT EXISTS model text, \n` +
          `  ADD COLUMN IF NOT EXISTS registration text, \n` +
          `  ADD COLUMN IF NOT EXISTS departure_flight_number text, \n` +
          `  ADD COLUMN IF NOT EXISTS origin text, \n` +
          `  ADD COLUMN IF NOT EXISTS destination text, \n` +
          `  ADD COLUMN IF NOT EXISTS eta text, \n` +
          `  ADD COLUMN IF NOT EXISTS etd text, \n` +
          `  ADD COLUMN IF NOT EXISTS actual_arrival_time text, \n` +
          `  ADD COLUMN IF NOT EXISTS designation_time timestamp with time zone, \n` +
          `  ADD COLUMN IF NOT EXISTS start_time timestamp with time zone, \n` +
          `  ADD COLUMN IF NOT EXISTS end_time timestamp with time zone, \n` +
          `  ADD COLUMN IF NOT EXISTS assignment_time timestamp with time zone, \n` +
          `  ADD COLUMN IF NOT EXISTS assigned_by_lt text, \n` +
          `  ADD COLUMN IF NOT EXISTS report jsonb, \n` +
          `  ADD COLUMN IF NOT EXISTS logs jsonb, \n` +
          `  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone, \n` +
          `  ADD COLUMN IF NOT EXISTS position_id text, \n` +
          `  ADD COLUMN IF NOT EXISTS position_type text, \n` +
          `  ADD COLUMN IF NOT EXISTS pit_id text, \n` +
          `  ADD COLUMN IF NOT EXISTS wing_side text, \n` +
          `  ADD COLUMN IF NOT EXISTS fuel_status integer DEFAULT 0, \n` +
          `  ADD COLUMN IF NOT EXISTS status text DEFAULT 'CHEGADA', \n` +
          `  ADD COLUMN IF NOT EXISTS operator_id uuid, \n` +
          `  ADD COLUMN IF NOT EXISTS support_operator_id uuid, \n` +
          `  ADD COLUMN IF NOT EXISTS support_operator text, \n` +
          `  ADD COLUMN IF NOT EXISTS vehicle_id uuid, \n` +
          `  ADD COLUMN IF NOT EXISTS vehicle_type text, \n` +
          `  ADD COLUMN IF NOT EXISTS volume integer DEFAULT 0, \n` +
          `  ADD COLUMN IF NOT EXISTS is_on_ground boolean DEFAULT false, \n` +
          `  ADD COLUMN IF NOT EXISTS delay_justification text, \n` +
          `  ADD COLUMN IF NOT EXISTS is_excluded_from_queue boolean DEFAULT false;`;
          
        throw new Error(`ESTRUTURA DA TABELA INVÁLIDA (malha_operacional)!\nVá ao SQL Editor no Supabase e rode:\n\n${ddlScript}\n\nErro original: ${errorToThrow.message}`);
    }
  }
};

export const deleteFlight = async (flightId: string): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.from('malha_operacional').delete().eq('id', flightId);
  if (error) {
    console.error('[Supabase] Error deleting flight:', error.message);
    throw error;
  }
};


export const getBaseMeshFlights = async (dateRef: string): Promise<MeshFlight[]> => {
  if (!isSupabaseConfigured()) return [];
  
  try {
    // Carrega a lista de aeronaves para o cruzamento de modelos
    let aircraftsList: any[] = [];
    try {
      aircraftsList = await getAircrafts();
    } catch (e) {
      console.warn('[Supabase] Falha ao carregar aeronaves para preenchimento de modelos na malha base:', e);
    }

    // Buscamos TODOS os voos de contratos da tabela malha_dia, dispensando o filtro restrito do banco eq('date', dateRef)
    // para que a base de contratos unificada seja universal e reflita em todos os dias da operação.
    let { data, error } = await supabase
      .from('malha_dia')
      .select('*')
      .order('etd');
      
    if (error && error.message.includes("does not exist")) {
       console.warn("[Supabase] fallback para getBaseMesh...", error.message);
       const fallback = await supabase.from('malha_dia').select('*');
       data = fallback.data;
       error = fallback.error;
    }

    if (error) {
      console.error(`[Supabase] Error fetching base mesh:`, error.message);
      checkAndRegisterError(error.message, 'malha_dia');
      const cached = localStorage.getItem(`supabase_cache_basemesh_flights_all`);
      if (cached) {
        console.warn(`[Supabase] Returning cached base mesh flights`);
        return JSON.parse(cached);
      }
      if (checkAndRegisterError(error.message, 'malha_dia')) {
        return [];
      }
      throw error;
    }
    
    if (!data) return [];

    const finalData = data;

    const mapped = finalData.map(dbFlight => {
      const reg = dbFlight.registration || dbFlight.matricula || '';
      let modelVal = dbFlight.model || dbFlight.modelo || dbFlight.equipamento || '';
      
      // Auto-fill do modelo baseado no prefixo se estiver em branco ou '--'
      if ((!modelVal || modelVal === '--') && reg) {
        const cleanReg = reg.replace(/[^A-Z0-9]/ig, '').toUpperCase();
        const found = aircraftsList.find(a => {
          const cleanAeroPrefix = String(a.prefix || '').replace(/[^A-Z0-9]/ig, '').toUpperCase();
          return cleanAeroPrefix === cleanReg || cleanAeroPrefix.endsWith(cleanReg);
        });
        if (found && found.model && found.model !== '--') {
          modelVal = found.model;
        }
      }

      return {
        id: dbFlight.id,
        date: dbFlight.date || dbFlight.date_ref || dbFlight.data || dbFlight.voo_data || dbFlight.flight_date || dateRef,
        airline: dbFlight.airline || dbFlight.cia || '',
        airlineCode: dbFlight.airline_code || dbFlight.cia_cod || dbFlight.airline?.substring(0,3) || '',
        flightNumber: dbFlight.flight_number || dbFlight.voo || dbFlight.voo_chegada || dbFlight.prefixo || '',
        departureFlightNumber: dbFlight.departure_flight_number || dbFlight.voo_saida || dbFlight.flight_number || '', // Backup
        destination: dbFlight.destination || dbFlight.destino || '',
        etd: dbFlight.etd || '00:00',
        registration: reg,
        eta: dbFlight.eta || dbFlight.etd || '00:00',
        positionId: dbFlight.position_id || dbFlight.posicao || '',
        actualArrivalTime: dbFlight.actual_arrival_time || '',
        model: modelVal,
        disabled: dbFlight.is_disabled || dbFlight.desabilitado || false
      };
    });

    // Desduplicação inteligente para garantir que múltiplos voos de contratos históricos ou importações cruzadas
    // apareçam como itens exclusivos e limpos baseados na chave operacional unificada
    const seen = new Set<string>();
    const seenIds = new Set<string>();
    const uniqueMapped: MeshFlight[] = [];

    for (const f of mapped) {
       const key = `${f.airlineCode || f.airline}_${f.flightNumber}_${f.departureFlightNumber}_${f.etd}_${f.destination}`.toUpperCase();
       if (!seen.has(key) && f.id && !seenIds.has(f.id)) {
         seen.add(key);
         seenIds.add(f.id);
         uniqueMapped.push(f);
       }
    }

    safeLocalStorageSetItem(`supabase_cache_basemesh_flights_all`, JSON.stringify(uniqueMapped));
    safeLocalStorageSetItem(`supabase_cache_basemesh_flights_${dateRef}`, JSON.stringify(uniqueMapped));
    return uniqueMapped;
  } catch (err: any) {
    console.error('[Supabase] Exception in getBaseMeshFlights:', err);
    if (checkAndRegisterError(err.message || '', 'malha_dia')) {
      const cached = localStorage.getItem(`supabase_cache_basemesh_flights_all`);
      if (cached) return JSON.parse(cached);
      return [];
    }
    const cached = localStorage.getItem(`supabase_cache_basemesh_flights_all`);
    if (cached) {
      console.warn(`[Supabase] Returning cached base mesh flights after exception`);
      return JSON.parse(cached);
    }
    throw err;
  }
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
      date: f.date,
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
      updated_at: new Date().toISOString()
    };
    if (f.id) {
       obj.id = ensureValidUuid(f.id);
    }
    return obj;
  });

  let maxAttempts = 10;
  let missingCol = '';
  
  while (maxAttempts > 0) {
    let allChunksSuccess = true;
    let chunkError = null;

    const chunkSize = 200;
    for (let i = 0; i < payload.length; i += chunkSize) {
      const chunk = payload.slice(i, i + chunkSize);
      const { data, error } = await supabase.from('malha_dia').upsert(chunk).select('id');
      
      if (error) {
         allChunksSuccess = false;
         chunkError = error;
         break;
      }
      if (data && data.length === 0 && chunk.length > 0) {
          throw new Error("A inserção falhou silenciosamente no Supabase. Verifique se as políticas de segurança (RLS) do banco de dados permitem (ou desabilite o RLS da tabela 'malha_dia').");
      }
    }
    
    if (allChunksSuccess) return;

    const error = chunkError;

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
       console.warn(`[Supabase] column '${missingCol}' does not exist in malha_dia, retrying without it...`);
       payload = payload.map(p => {
           const newP = { ...p } as any;
           delete newP[missingCol];
           return newP;
       });
       maxAttempts--;
       if (maxAttempts === 0) {
           throw new Error(`O banco de dados 'malha_dia' está faltando muitas colunas essenciais. Erro original: ${error.message}`);
       }
       continue;
    }

    throw new Error(`Erro ao inserir na malha_dia (Malha Base): ${error.message}`);
  }
};

export const clearBaseMeshFlights = async (dateRef: string): Promise<void> => {
   if (!isSupabaseConfigured()) return;
   // Como a malha base agora armazena nossos contratos universais sob SSoT,
   // o comando de limpar malha limpa os contratos de forma unificada para reimportação livre.
   const { error } = await supabase.from('malha_dia').delete().neq('id', '00000000-0000-0000-0000-000000000000');
   if (error) {
      console.error(`[Supabase] Error clearing universal base mesh:`, error.message);
      throw error;
   }
};

export const clearAllBaseMeshFlights = async (): Promise<void> => {
   if (!isSupabaseConfigured()) return;
   const { error } = await supabase.from('malha_dia').delete().neq('id', '00000000-0000-0000-0000-000000000000');
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
      eta: flight.eta,
      etd: flight.etd,
      actual_arrival_time: flight.actualArrivalTime,
      position_id: flight.positionId,
      position_type: flight.positionType || null,
      pit_id: flight.pitId || null,
      wing_side: flight.wingSide || null,
      fuel_status: flight.fuelStatus,
      status: flight.status,
      operator_id: (
        flight.operatorId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(flight.operatorId)
          ? flight.operatorId
          : (flight.operator ? operatorsCache.find(o => o.warName === flight.operator)?.id : null)
      ) || null,
      support_operator_id: (
        flight.supportOperatorId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(flight.supportOperatorId)
          ? flight.supportOperatorId
          : (flight.supportOperator ? operatorsCache.find(o => o.warName === flight.supportOperator)?.id : null)
      ) || null,
      support_operator: flight.supportOperator || null,
      vehicle_id: (
        flight.vehicleId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(flight.vehicleId)
          ? flight.vehicleId
          : (flight.vehicleId ? vehiclesCache.find(v => v.fleetNumber === String(flight.vehicleId))?.id : null)
      ) || (
        flight.fleet
          ? vehiclesCache.find(v => v.fleetNumber === String(flight.fleet).replace('SRV-', '').replace('CTA-', ''))?.id
          : null
      ) || null,
      vehicle_type: flight.vehicleType || null,
      volume: flight.volume || 0,
      is_on_ground: flight.isOnGround || false,
      delay_justification: flight.delayJustification || null,
      designation_time: flight.designationTime?.toISOString() || null,
      start_time: flight.startTime?.toISOString() || null,
      end_time: flight.endTime?.toISOString() || null,
      assignment_time: flight.assignmentTime?.toISOString() || null,
      assigned_by_lt: flight.assignedByLt || null,
      is_excluded_from_queue: flight.isExcludedFromQueue || false,
      report: flight.report || {},
      logs: flight.logs || [],
      updated_at: new Date().toISOString()
    };
    if (flight.id) {
       obj.id = ensureValidUuid(flight.id);
    }
    return obj;
  });

  const chunkSize = 100;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    
    let attempts = 0;
    const maxAttempts = 12;
    let errorToThrow: any = null;
    
    while (attempts < maxAttempts) {
      const filteredChunk = chunk.map(item => filterPayloadForExistingColumns(item));
      let { data, error } = await supabase.from('malha_operacional').upsert(filteredChunk).select('id');
      
      if (!error) {
         if (data && data.length === 0 && filteredChunk.length > 0) {
             console.warn("[Supabase] Bulk Upsert returned empty data. This might be due to RLS policies silently blocking.");
             throw new Error("A inserção na malha operacional falhou silenciosamente no Supabase. Verifique se as políticas de segurança (RLS - Row Level Security) do banco de dados (tabela 'malha_operacional') permitem as permissões de INSERT/UPDATE.");
         }
         break; // Success! Move to next chunk
      }
      
      const registered = detectAndRegisterMissingColumn(error.message);
      if (registered) {
         attempts++;
         console.log(`[Supabase] Erro detectado em lote no lote de inserção, retentando sem coluna ausente (Ref: '${error.message}')`);
         continue;
      }
      
      errorToThrow = error;
      break;
    }

    if (errorToThrow) {
        console.error('[Supabase] Error bulk inserting flights chunk:', errorToThrow.message);
        if (errorToThrow.message.includes("Could not find the table") || errorToThrow.message.includes("relation") && errorToThrow.message.includes("does not exist")) {
            throw new Error(`ESTRUTURA DA TABELA INVÁLIDA!\nVá ao SQL Editor no Supabase e rode o script abaixo para criar a tabela:\n\n` +
              `CREATE TABLE IF NOT EXISTS malha_operacional (\n` +
              `  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n` +
              `  date_ref TEXT NOT NULL,\n` +
              `  flight_number TEXT NOT NULL,\n` +
              `  departure_flight_number TEXT,\n` +
              `  airline TEXT,\n` +
              `  airline_code TEXT,\n` +
              `  model TEXT,\n` +
              `  registration TEXT,\n` +
              `  origin TEXT,\n` +
              `  destination TEXT,\n` +
              `  eta TEXT,\n` +
              `  etd TEXT,\n` +
              `  actual_arrival_time TEXT,\n` +
              `  position_id TEXT,\n` +
              `  position_type TEXT,\n` +
              `  pit_id TEXT,\n` +
              `  wing_side TEXT,\n` +
              `  fuel_status INTEGER DEFAULT 0,\n` +
              `  status TEXT DEFAULT 'CHEGADA', \n` +
              `  volume INTEGER DEFAULT 0,\n` +
              `  is_on_ground BOOLEAN DEFAULT false,\n` +
              `  delay_justification TEXT,\n` +
              `  designation_time TIMESTAMP WITH TIME ZONE,\n` +
              `  start_time TIMESTAMP WITH TIME ZONE,\n` +
              `  end_time TIMESTAMP WITH TIME ZONE,\n` +
              `  assignment_time TIMESTAMP WITH TIME ZONE,\n` +
              `  assigned_by_lt TEXT,\n` +
              `  is_excluded_from_queue BOOLEAN DEFAULT false,\n` +
              `  report JSONB DEFAULT '{}'::jsonb,\n` +
              `  logs JSONB DEFAULT '[]'::jsonb,\n` +
              `  operator_id UUID,\n` +
              `  support_operator_id UUID,\n` +
              `  support_operator TEXT,\n` +
              `  vehicle_id UUID,\n` +
              `  vehicle_type TEXT,\n` +
              `  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,\n` +
              `  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL\n` +
              `);\n\nErro original: ${errorToThrow.message}`);
        } else {
            const ddlScript = `ALTER TABLE malha_operacional \n` +
              `  ADD COLUMN IF NOT EXISTS date_ref text, \n` +
              `  ADD COLUMN IF NOT EXISTS airline text, \n` +
              `  ADD COLUMN IF NOT EXISTS airline_code text, \n` +
              `  ADD COLUMN IF NOT EXISTS model text, \n` +
              `  ADD COLUMN IF NOT EXISTS registration text, \n` +
              `  ADD COLUMN IF NOT EXISTS departure_flight_number text, \n` +
              `  ADD COLUMN IF NOT EXISTS origin text, \n` +
              `  ADD COLUMN IF NOT EXISTS destination text, \n` +
              `  ADD COLUMN IF NOT EXISTS eta text, \n` +
              `  ADD COLUMN IF NOT EXISTS etd text, \n` +
              `  ADD COLUMN IF NOT EXISTS actual_arrival_time text, \n` +
              `  ADD COLUMN IF NOT EXISTS designation_time timestamp with time zone, \n` +
              `  ADD COLUMN IF NOT EXISTS start_time timestamp with time zone, \n` +
              `  ADD COLUMN IF NOT EXISTS end_time timestamp with time zone, \n` +
              `  ADD COLUMN IF NOT EXISTS assignment_time timestamp with time zone, \n` +
              `  ADD COLUMN IF NOT EXISTS assigned_by_lt text, \n` +
              `  ADD COLUMN IF NOT EXISTS report jsonb, \n` +
              `  ADD COLUMN IF NOT EXISTS logs jsonb, \n` +
              `  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone, \n` +
              `  ADD COLUMN IF NOT EXISTS position_id text, \n` +
              `  ADD COLUMN IF NOT EXISTS position_type text, \n` +
              `  ADD COLUMN IF NOT EXISTS pit_id text, \n` +
              `  ADD COLUMN IF NOT EXISTS wing_side text, \n` +
              `  ADD COLUMN IF NOT EXISTS fuel_status integer DEFAULT 0, \n` +
              `  ADD COLUMN IF NOT EXISTS status text DEFAULT 'CHEGADA', \n` +
              `  ADD COLUMN IF NOT EXISTS operator_id uuid, \n` +
              `  ADD COLUMN IF NOT EXISTS support_operator_id uuid, \n` +
              `  ADD COLUMN IF NOT EXISTS support_operator text, \n` +
              `  ADD COLUMN IF NOT EXISTS vehicle_id uuid, \n` +
              `  ADD COLUMN IF NOT EXISTS vehicle_type text, \n` +
              `  ADD COLUMN IF NOT EXISTS volume integer DEFAULT 0, \n` +
              `  ADD COLUMN IF NOT EXISTS is_on_ground boolean DEFAULT false, \n` +
              `  ADD COLUMN IF NOT EXISTS delay_justification text, \n` +
              `  ADD COLUMN IF NOT EXISTS is_excluded_from_queue boolean DEFAULT false;`;
              
            throw new Error(`ESTRUTURA DA TABELA INVÁLIDA (malha_operacional)!\nVá ao SQL Editor no Supabase e rode:\n\n${ddlScript}\n\nErro original: ${errorToThrow.message}`);
        }
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
    .from('malha_operacional')
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
    .from('malha_operacional')
    .select('id')
    .not('position_id', 'is', null);

  if (fetchError) {
     console.error('[Supabase] Error finding flights to clear:', fetchError.message);
     throw fetchError;
  }

  if (flightsToClear && flightsToClear.length > 0) {
    const flightIds = flightsToClear.map(f => f.id);
    
    const { error: updateError } = await supabase
      .from('malha_operacional')
      .update({ position_id: null, pit_id: null, position_type: null })
      .in('id', flightIds);
      
    if (updateError) {
      console.error('[Supabase] Error clearing flight assignments:', updateError.message);
      throw updateError;
    }
  }
};

export interface DbUserPreferences {
  user_id: string;
  visible_columns: Record<string, boolean>;
  visible_tabs: Record<string, boolean>;
  locked_columns: Record<string, boolean>;
  locked_tabs: Record<string, boolean>;
}

export const getUserLayoutPreferences = async (userId: string): Promise<DbUserPreferences | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase
      .from('preferencias_layout_usuario')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (
        error.message.includes("does not exist") || 
        error.code === 'PGRST116' || 
        error.message.includes("relation \"preferencias_layout_usuario\"") ||
        error.message.includes("Could not find the table") ||
        error.message.includes("schema cache")
      ) {
        console.warn("[getUserLayoutPreferences] Tabela preferencias_layout_usuario não existe no Supabase. Usando armazenamento local.");
        return null;
      }
      console.error('[getUserLayoutPreferences] Error fetching preferences:', error.message);
      return null;
    }
    return data as DbUserPreferences;
  } catch (err) {
    console.error('[getUserLayoutPreferences] Exception fetching preferences:', err);
    return null;
  }
};

export const saveUserLayoutPreferences = async (
  userId: string,
  visibleColumns: Record<string, boolean>,
  visibleTabs: Record<string, boolean>,
  lockedColumns: Record<string, boolean>,
  lockedTabs: Record<string, boolean>
): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  try {
    const payload = {
      user_id: userId,
      visible_columns: visibleColumns,
      visible_tabs: visibleTabs,
      locked_columns: lockedColumns,
      locked_tabs: lockedTabs,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('preferencias_layout_usuario')
      .upsert([payload]);

    if (error) {
      if (
        error.message.includes("does not exist") || 
        error.message.includes("relation \"preferencias_layout_usuario\"") ||
        error.message.includes("Could not find the table") ||
        error.message.includes("schema cache")
      ) {
        console.warn(
          `[saveUserLayoutPreferences] A tabela "preferencias_layout_usuario" não existe no Supabase. ` +
          `Instâncias de configuração foram guardadas preferencialmente em cache local (LocalStorage).`
        );
        return;
      }
      throw error;
    }
  } catch (err: any) {
    // Se for um erro já tratado de tabela inexistente, não polui o console como erro crítico
    if (err.message && (
      err.message.includes("preferencias_layout_usuario") ||
      err.message.includes("does not exist") ||
      err.message.includes("schema")
    )) {
      console.warn('[saveUserLayoutPreferences] Salvo em cache local (tabela opcional ausente no Supabase).');
      return;
    }
    console.error('[saveUserLayoutPreferences] Exception saving preferences:', err);
    throw err;
  }
};




