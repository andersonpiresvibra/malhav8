// JETFUEL-SIM — Score Engine (Sistema de Pontuação do LT)
// Calcula score em tempo real e rating ao fim do turno.
// Fonte: JETFUEL_PLANO_MESTRE.pdf §4.

import { ScoreBreakdown, ShiftResult } from '../types/game';

const WEIGHTS = {
  tabAvg: 0.30,
  zeroDelay: 0.25,
  adversity: 0.25,
  zeroOccurrence: 0.15,
  designation: 0.05,
};

export interface LiveScoreInput {
  flightsFinalized: number;
  flightsDelayed: number;
  tabAvgSeconds: number; // meta: < 1200s (20 min)
  tabGoalSeconds: number;
  adversityResponded: number;
  adversityTotal: number;
  incidents: number;
  designationEfficiencySeconds: number; // tempo FILA→operador
}

export interface LiveScore {
  base: number; // 0..1000 de métricas
  bonuses: number;
  penalties: number;
  total: number;
}

// Pontuação por ação (Plano Mestre §4.2)
export const ACTION_POINTS = {
  adversityCorrect: 20,
  adversityPartial: 8,
  adversityIgnoredMin: -15,
  adversityIgnoredMax: -30,
  flightOnTime: 10,
  flightDelaySmall: 3, // < 5 min
  flightDelayBig: -5, // > 5 min
  flightDelayHuge: -15, // > 15 min sem justificativa
  incident: -25,
  turnNoIncident: 50,
  tabBelowGoal: 15,
  certNotRemoved: -30,
};

export function computeLiveScore(input: LiveScoreInput): LiveScore {
  const tabRatio = Math.min(1, input.tabGoalSeconds / Math.max(1, input.tabAvgSeconds));
  const zeroDelayRatio =
    input.flightsFinalized === 0
      ? 1
      : input.flightsFinalized / (input.flightsFinalized + input.flightsDelayed);
  const adversityRatio =
    input.adversityTotal === 0 ? 1 : input.adversityResponded / input.adversityTotal;

  const breakdown: ScoreBreakdown = {
    tabAvgSeconds: input.tabAvgSeconds,
    zeroDelayRatio,
    adversityResponseRatio: adversityRatio,
    zeroOccurrence: input.incidents === 0,
    designationEfficiencySeconds: input.designationEfficiencySeconds,
  };

  const base =
    1000 *
    (WEIGHTS.tabAvg * tabRatio +
      WEIGHTS.zeroDelay * zeroDelayRatio +
      WEIGHTS.adversity * adversityRatio +
      WEIGHTS.zeroOccurrence * (input.incidents === 0 ? 1 : 0) +
      WEIGHTS.designation * Math.min(1, 600 / Math.max(1, input.designationEfficiencySeconds)));

  const bonuses =
    (input.incidents === 0 ? ACTION_POINTS.turnNoIncident : 0) +
    (input.tabAvgSeconds <= input.tabGoalSeconds ? ACTION_POINTS.tabBelowGoal : 0);

  const penalties = input.incidents * ACTION_POINTS.incident;

  return {
    base: Math.round(base),
    bonuses,
    penalties,
    total: Math.round(base + bonuses + penalties),
  };
}

export function rateShift(total: number): { rating: string; stars: number } {
  if (total >= 900) return { rating: 'LT de Excelência — Elite', stars: 5 };
  if (total >= 750) return { rating: 'LT Sênior — Acima da Meta', stars: 4 };
  if (total >= 600) return { rating: 'LT Operacional — Na Meta', stars: 3 };
  if (total >= 400) return { rating: 'LT em Desenvolvimento', stars: 2 };
  return { rating: 'LT em Treinamento Corretivo', stars: 1 };
}

export function finalizeShift(input: LiveScoreInput): ShiftResult {
  const live = computeLiveScore(input);
  const { rating, stars } = rateShift(live.total);
  return {
    score: live.total,
    rating,
    stars,
    breakdown: {
      tabAvgSeconds: input.tabAvgSeconds,
      zeroDelayRatio:
        input.flightsFinalized / Math.max(1, input.flightsFinalized + input.flightsDelayed),
      adversityResponseRatio:
        input.adversityTotal === 0 ? 1 : input.adversityResponded / input.adversityTotal,
      zeroOccurrence: input.incidents === 0,
      designationEfficiencySeconds: input.designationEfficiencySeconds,
    },
    adversitiesResponded: input.adversityResponded,
    adversitiesTotal: input.adversityTotal,
    incidents: input.incidents,
    flightsFinalized: input.flightsFinalized,
    flightsDelayed: input.flightsDelayed,
  };
}
