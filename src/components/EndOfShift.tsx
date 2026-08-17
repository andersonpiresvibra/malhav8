// JETFUEL-SIM — Tela de Encerramento de Turno (score + rating)
// Cores semânticas do DESIGN_SYSTEM. z-index padrão de modal.
import React from 'react';
import { Star, Trophy } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { finalizeShift } from '../services/scoreEngine';

export const EndOfShift: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { flightsFinalized, flightsDelayed, incidents } = useGameStore();
  const s = useGameStore((st) => st.scoreState);
  const result = finalizeShift({
    flightsFinalized,
    flightsDelayed,
    tabAvgSeconds: s.tabAvgSeconds,
    tabGoalSeconds: s.tabGoalSeconds,
    adversityResponded: s.adversityResponded,
    adversityTotal: s.adversityTotal,
    incidents,
    designationEfficiencySeconds: s.designationEfficiencySeconds,
  });

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 text-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="text-amber-400" />
          <h2 className="text-xl font-bold">Encerramento de Turno</h2>
        </div>

        <div className="text-center mb-4">
          <div className="text-5xl font-mono font-bold text-emerald-400">{result.score}</div>
          <div className="text-sm text-slate-400 mt-1">Pontuação Final</div>
        </div>

        <div className="flex justify-center gap-1 mb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              size={28}
              className={i <= result.stars ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}
            />
          ))}
        </div>

        <div className="text-center text-sm text-emerald-300 font-semibold mb-4">
          {result.rating}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <Metric label="Voos Finalizados" value={result.flightsFinalized} />
          <Metric label="Voos Atrasados" value={result.flightsDelayed} />
          <Metric label="Adversidades" value={`${result.adversitiesResponded}/${result.adversitiesTotal}`} />
          <Metric label="Incidentes" value={result.incidents} />
          <Metric label="TAB Médio" value={`${Math.round(result.breakdown.tabAvgSeconds)}s`} />
          <Metric
            label="Resp. Advers."
            value={`${Math.round(result.breakdown.adversityResponseRatio * 100)}%`}
          />
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-slate-800 rounded p-2">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-lg font-mono font-bold">{value}</div>
    </div>
  );
}
