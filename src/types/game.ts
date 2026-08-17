// JETFUEL-SIM — Tipos da camada de jogo (Tycoon)
// Código em inglês; UI em PT-BR (ver DESIGN_SYSTEM.md).

export type AdversityCategory =
  | 'METEOROLOGIA'
  | 'VOO'
  | 'EQUIPAMENTO'
  | 'OPERADOR'
  | 'REGULATORIO';

export type DifficultyLevel = 'TREINAMENTO' | 'OPERACIONAL' | 'PICO' | 'EXTREMO';

export interface AdversityEvent {
  id: string;
  category: AdversityCategory;
  title: string;
  description: string;
  timerSeconds: number; // 0 = decisão imediata
  startedAt: number; // epoch ms
  actions: AdversityAction[];
  scoreImpactOnIgnore: number;
}

export interface AdversityAction {
  id: string;
  label: string; // PT-BR
  scoreImpact: number; // + correto, - parcial
  consequence: string; // PT-BR
}

export interface ActiveAdversity extends AdversityEvent {
  remainingSeconds: number;
  resolved: boolean;
  resolution?: 'CORRECT' | 'PARTIAL' | 'IGNORED';
}

export interface ScoreBreakdown {
  tabAvgSeconds: number;
  zeroDelayRatio: number; // 0..1
  adversityResponseRatio: number; // 0..1
  zeroOccurrence: boolean;
  designationEfficiencySeconds: number;
}

export interface ShiftResult {
  score: number;
  rating: string;
  stars: number;
  breakdown: ScoreBreakdown;
  adversitiesResponded: number;
  adversitiesTotal: number;
  incidents: number;
  flightsFinalized: number;
  flightsDelayed: number;
}

export interface PlayerState {
  warName: string;
  patente: string;
  totalScore: number;
  turnsPlayed: number;
}
