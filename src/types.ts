
export enum FlightStatus {
  CHEGADA = 'CHEGADA',         // Monitoramento (ETA > 1h ou recém pousado)
  FILA = 'FILA',               // Prioridade (ETD < 1h, Sem Operador)
  DESIGNADO = 'DESIGNADO',     // Operador atribuído
  PRÉ = 'PRÉ',                 // Pré-abastecimento (Hangar/Manutenção)
  AGUARDANDO = 'AGUARDANDO',   // Aguardando liberação/calço
  ABASTECENDO = 'ABASTECENDO', // Fluxo ativo
  FINALIZADO = 'FINALIZADO',   // Concluído
  CANCELADO = 'CANCELADO'      // Voo cancelado ou não abastecido
}

export type OperatorStatus = 'DISPONÍVEL' | 'OCUPADO' | 'INTERVALO' | 'DESCONECTADO' | 'ENCHIMENTO' | 'DESIGNADO' | 'ATIVO' | 'FOLG.' | 'FÉRIAS' | 'AFAST.' | string;
export type VehicleType = 'SERVIDOR' | 'CTA';
export type VehicleStatus = 'DISPONÍVEL' | 'OCUPADO' | 'INATIVO' | 'ENCHIMENTO';

export interface Vehicle {
  id: string; // Número do frota
  type: VehicleType;
  manufacturer: string;
  status: VehicleStatus;
  maxFlowRate: number; // L/min
  hasPlatform: boolean;
  operatorName?: string;
  currentPosition?: string;
  lastPosition?: string;
  capacity?: number; // Litros (relevante para CTA)
  currentVolume?: number; // Volume Atual em Litros
  counterInitial?: number; // Contador Inicial (9 dígitos)
    counterFinal?: number; // Contador Final (9 dígitos)
  isActive?: boolean;
  observations?: string;
}

export interface PitData {
  id: string;
  isActive: boolean;
  lastMaintenance?: Date;
  notes?: string;
}

export interface Operator {
  id: string;
  name: string;
  status: OperatorStatus;
  vehicleId?: string;
  vehicleType?: VehicleType;
  shiftStart?: Date;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: Date;
  isManager: boolean;
}

export type ShiftCycle = 'MANHÃ' | 'TARDE' | 'NOITE' | 'GERAL';
export type OperatorCategory = 'AERODROMO' | 'VIP' | 'ILHA';

export interface OperatorProfile {
  id: string;
  fullName: string;
  warName: string;
  companyId: string; // Matr. VB
  gruId: string; // Matr. Gru
  vestNumber: string; // ISO
  tmfLogin?: string; // Log. TMF (4 digits)
  bloodType?: string; // TS (e.g. O+)
  isLT?: 'SIM' | 'NÃO'; // LT
  patio?: 'AERODROMO' | 'VIP' | 'AMBOS' | string; // Pátio
  role?: 'Op. Jr.' | 'Op. Pl' | 'Op. Sr.' | string; // Função
  photoUrl: string;
  status: OperatorStatus;
  category: string; // Changed to string to support JUNIOR/PLENO/SENIOR without complaining
  lastPosition: string;
  fleetCapability?: 'CTA' | 'SRV' | 'BOTH';
  lastFlightEnd?: Date;
  assignedVehicle?: string; // Propriedade adicionada para o HUD de equipe
  pausedAt?: string; // Hora em que entrou em pausa (HH:mm)
  resumedAt?: string; // Hora em que retornou da pausa (HH:mm)
  shift: {
    cycle: ShiftCycle | string; // Turno - Lista - Manhã Tarde e Noite
    start: string; // Horá de entrada
    end: string; // Hora de saída
  };
  airlines: string[];
  ratings: {
    speed: number;
    safety: number;
    airlineSpecific: Record<string, number>;
  };
  expertise: {
    servidor: number;
    cta: number;
  };
  stats: {
    flightsWeekly: number;
    flightsMonthly: number;
    volumeWeekly: number;
    volumeMonthly: number;
  };
  workDays?: Array<{ date: string; type: 'TRABALHO' | 'CIPA' | 'EXAME' | 'BRIGADA' | 'B_HORAS' | 'CT' | 'AT' | 'AF' }>;
}

export interface TankData {
  id: string;
  capacity: number;
  currentLevel: number;
  temperature: number;
  density: number;
  status: 'ATIVO' | 'ISOLADO' | 'RECEBENDO' | 'DRENAGEM';
}

export interface PumpData {
  id: string;
  status: 'RUNNING' | 'STANDBY' | 'MAINTENANCE' | 'OFFLINE';
  rpm: number;
  pressure: number;
  flow: number;
}

export type LogType = 'SISTEMA' | 'MANUAL' | 'OBSERVACAO' | 'ALERTA' | 'ATRASO';

export interface FlightLog {
  id: string;
  timestamp: Date;
  type: LogType;
  message: string;
  author: string; // 'SISTEMA' ou Nome do Gestor
}

export interface FlightReport {
  fuelOrderTime?: string;
  mechanicTime?: string;
  crewTime?: string;
  authorizationTime?: string;
  obstructedAreaTime?: string;
  dispensed?: boolean;
  dispensedBy?: string;
  dispensedBadge?: string;
  observations?: string;
}

export interface FlightData {
  id: string;
  date?: string; // Format: YYYY-MM-DD
  flightNumber: string; // V. Cheg
  departureFlightNumber?: string; // V. Saida
  airline: string;
  airlineCode: string;
  model: string;
  registration: string;
  origin: string;
  destination: string;
  eta: string;
  etd: string;
  actualArrivalTime?: string; // Horário de Calço (ATA)
  positionId: string;
  positionType?: 'SRV' | 'CTA';
  pitId?: string;
  wingSide?: 'LEFT' | 'RIGHT';
  fuelStatus: number;
  status: FlightStatus;
  operator?: string;
  supportOperator?: string;
  fleet?: string;
  fleetType?: 'SRV' | 'CTA';
  vehicleType?: VehicleType;
  volume?: number;
  messages?: ChatMessage[];
  isExcludedFromQueue?: boolean; // Para quando for excluído apenas da fila
  
  // Novos campos de controle lógico
  isOnGround?: boolean; // Se já pousou (Status SOLO)
  isStandby?: boolean; // Se está em espera (Manutenção, etc)
  standbyReason?: string; // Motivo da espera
  designationTime?: Date; // Hora que foi designado (para calcular "A Caminho")
  startTime?: Date; // Hora que iniciou abastecimento
  endTime?: Date; // Hora que finalizou abastecimento (Para TAB)
  maxFlowRate?: number; // Vazão máxima registrada (L/min)
  currentFlowRate?: number; // Vazão atual (L/min)
  
  // Caixa Preta e Justificativas
  insertionTime?: Date; // Hora real em que o voo foi inserido na malha
  logs: FlightLog[]; 
  observations?: string; // Mantido para compatibilidade, mas idealmente derivado de logs
  delayJustification?: string; // Justificativa de atraso se ETD estourado
  isPinned?: boolean; // Se o voo está fixado no topo
  isHiddenFromGrid?: boolean; // Se foi limpo do grid mas deve permanecer no relatório
  isMeshFlight?: boolean; // Se é um voo da malha base não ativado
  assignmentTime?: Date; // Hr.D (Hora de designação)
  assignedByLt?: string; // LT (Líder que designou)
  report?: FlightReport; // Report for presence and delays
}

export type ViewState = 'GRID_OPS' | 'SHIFT_OPERATORS' | 'OPERATIONAL_MESH' | 'REPORTS' | 'FLEET' | 'ROOT_MESH' | 'OPERATORS_ADMIN' | 'MANAGEMENT';

export interface AircraftType {
  id: string;
  manufacturer: string;
  model: string;
  prefix: string;
  airline: string;
}

export interface StaticFlight {
  id: string;
  airline: string;
  flightNumber: string;
  destination: string;
  city: string;
}

export type DetailedVehicleStatus = 'OPERACIONAL' | 'EM MANUTENÇÃO' | 'INATIVO';

export interface MaintenanceRecord {
  id: string;
  date: Date;
  type: string;
  description: string;
  technician: string;
}

export interface DetailedVehicle {
  id: string;
  manufacturer: string;
  model: string;
  type: VehicleType;
  plate: string;
  fleetNumber: string;
  atve: string;
  atveExpiry: Date;
  inspectionWeekly: Date;
  inspectionMonthly: Date;
  inspectionSemiannual: Date;
  inspectionAnnual: Date;
  status: DetailedVehicleStatus;
  maxFlowRate: number;
  hasPlatform: boolean;
  counterInitial: number;
  counterFinal: number;
  maintenanceHistory: MaintenanceRecord[];
  nextMaintenance: Date;
  mileage: number;
  engineHours: number;
  fuelLevel: number;
  tirePressure: number;
  batteryLevel: number;
  observations?: string;
}
