// JETFUEL-SIM — Store de jogo (Zustand)
// Estado global do tycoon: turno, adversidades ativas, score ao vivo.
import { create } from 'zustand';
import { ActiveAdversity, AdversityEvent, DifficultyLevel, ShiftResult } from '../types/game';
import {
  drawAdversity,
  maxConcurrent,
} from '../services/adversityEngine';
import { computeLiveScore, LiveScoreInput, LiveScore } from '../services/scoreEngine';

interface GameState {
  running: boolean;
  difficulty: DifficultyLevel;
  active: ActiveAdversity[];
  scoreState: LiveScoreInput;
  live: LiveScore;
  flightsFinalized: number;
  flightsDelayed: number;
  incidents: number;
  designationSum: number;
  designationCount: number;
  tabSum: number;
  start: (level: DifficultyLevel) => void;
  stop: () => void;
  spawn: () => void;
  resolve: (id: string, actionId: string, impact: number, resolution: 'CORRECT' | 'PARTIAL' | 'IGNORED') => void;
  tick: () => void;
  registerFlight: (finalized: boolean, delayed: boolean, tabSeconds: number, designationSeconds: number) => void;
  reset: () => void;
}

const initialScore: LiveScoreInput = {
  flightsFinalized: 0,
  flightsDelayed: 0,
  tabAvgSeconds: 0,
  tabGoalSeconds: 1200,
  adversityResponded: 0,
  adversityTotal: 0,
  incidents: 0,
  designationEfficiencySeconds: 600,
};

export const useGameStore = create<GameState>((set, get) => ({
  running: false,
  difficulty: 'OPERACIONAL',
  active: [],
  scoreState: initialScore,
  live: { base: 0, bonuses: 0, penalties: 0, total: 0 },
  flightsFinalized: 0,
  flightsDelayed: 0,
  incidents: 0,
  designationSum: 0,
  designationCount: 0,
  tabSum: 0,

  start: (level) =>
    set({
      running: true,
      difficulty: level,
      active: [],
      scoreState: { ...initialScore },
      live: { base: 0, bonuses: 0, penalties: 0, total: 0 },
      flightsFinalized: 0,
      flightsDelayed: 0,
      incidents: 0,
      designationSum: 0,
      designationCount: 0,
      tabSum: 0,
    }),

  stop: () => set({ running: false }),
  reset: () =>
    set({
      running: false,
      active: [],
      scoreState: { ...initialScore },
      live: { base: 0, bonuses: 0, penalties: 0, total: 0 },
    }),

  spawn: () => {
    const { active, difficulty, running } = get();
    if (!running) return;
    if (active.length >= maxConcurrent(difficulty)) return;
    const ev = drawAdversity(difficulty) as AdversityEvent;
    const a: ActiveAdversity = {
      ...ev,
      remainingSeconds: ev.timerSeconds,
      resolved: false,
    };
    const score = get().scoreState;
    set({
      active: [...active, a],
      scoreState: { ...score, adversityTotal: score.adversityTotal + 1 },
    });
  },

  resolve: (id, _actionId, impact, resolution) => {
    const { active, scoreState, incidents } = get();
    const updated = active.map((a) =>
      a.id === id ? { ...a, resolved: true, resolution } : a
    );
    const responded = resolution !== 'IGNORED';
    const newIncidents = incidents + (resolution === 'IGNORED' && impact <= -25 ? 1 : 0);
    set({
      active: updated.filter((a) => a.id !== id),
      scoreState: {
        ...scoreState,
        adversityResponded: scoreState.adversityResponded + (responded ? 1 : 0),
        incidents: newIncidents,
      },
      incidents: newIncidents,
    });
    recompute(set, get);
  },

  tick: () => {
    const { active, running } = get();
    if (!running) return;
    const now = Date.now();
    const next = active
      .map((a) => {
        if (a.resolved) return a;
        const elapsed = Math.floor((now - a.startedAt) / 1000);
        const rem = a.timerSeconds === 0 ? 0 : Math.max(0, a.timerSeconds - elapsed);
        return { ...a, remainingSeconds: rem };
      })
      // evento com timer expirado sem resposta => ignorado (consequência)
      .filter((a) => !(a.timerSeconds > 0 && a.remainingSeconds === 0 && !a.resolved));

    // Aplica penalidade de ignore por expiração
    const expired = active.filter(
      (a) => a.timerSeconds > 0 && !a.resolved && Math.floor((now - a.startedAt) / 1000) >= a.timerSeconds
    );
    if (expired.length > 0) {
      const st = get().scoreState;
      set({
        active: next,
        scoreState: { ...st, incidents: st.incidents + expired.filter((e) => e.scoreImpactOnIgnore <= -25).length },
        incidents: get().incidents + expired.filter((e) => e.scoreImpactOnIgnore <= -25).length,
      });
      expired.forEach((e) => get().resolve(e.id, 'ignore', e.scoreImpactOnIgnore, 'IGNORED'));
      return;
    }
    set({ active: next });
  },

  registerFlight: (finalized, delayed, tabSeconds, designationSeconds) => {
    const s = get();
    set({
      flightsFinalized: s.flightsFinalized + (finalized ? 1 : 0),
      flightsDelayed: s.flightsDelayed + (delayed ? 1 : 0),
      tabSum: s.tabSum + tabSeconds,
      designationSum: s.designationSum + designationSeconds,
      designationCount: s.designationCount + 1,
      scoreState: {
        ...s.scoreState,
        flightsFinalized: s.scoreState.flightsFinalized + (finalized ? 1 : 0),
        flightsDelayed: s.scoreState.flightsDelayed + (delayed ? 1 : 0),
        tabAvgSeconds: (s.tabSum + tabSeconds) / (s.flightsFinalized + s.flightsDelayed + 1),
        designationEfficiencySeconds:
          (s.designationSum + designationSeconds) / (s.designationCount + 1),
      },
    });
    recompute(set, get);
  },
}));

function recompute(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState
) {
  const s = get().scoreState;
  set({ live: computeLiveScore(s) });
}
