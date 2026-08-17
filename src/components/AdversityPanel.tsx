// JETFUEL-SIM — Painel de Adversidades (cards flutuantes, canto sup. direito)
// Z-index: z-[9000] (acima de modais padrão). Cores semânticas do DESIGN_SYSTEM.
import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { ADVERSITY_CATEGORY_ICON } from '../services/adversityEngine';
import { ActiveAdversity } from '../types/game';

function TimerBar({ seconds, total }: { seconds: number; total: number }) {
  const pct = total === 0 ? 100 : Math.max(0, Math.min(100, (seconds / total) * 100));
  const color = pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="h-1.5 w-full bg-slate-700 rounded overflow-hidden mt-2">
      <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Card({ a, onResolve }: { a: ActiveAdversity; onResolve: (id: string, actionId: string, impact: number) => void }) {
  return (
    <div className="w-80 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl p-3 text-slate-100">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{ADVERSITY_CATEGORY_ICON[a.category]}</span>
          <span className="font-semibold text-sm">{a.title}</span>
        </div>
        <AlertTriangle className="text-amber-400" size={16} />
      </div>
      <p className="text-xs text-slate-300 mt-1 leading-snug">{a.description}</p>
      {a.timerSeconds > 0 && <TimerBar seconds={a.remainingSeconds} total={a.timerSeconds} />}
      <div className="mt-2 flex flex-wrap gap-1">
        {a.actions.map((act) => (
          <button
            key={act.id}
            onClick={() => onResolve(a.id, act.id, act.scoreImpact)}
            className={`text-xs px-2 py-1 rounded border ${
              act.id === 'ignore'
                ? 'border-red-500/40 text-red-300 hover:bg-red-500/10'
                : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
            }`}
          >
            {act.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export const AdversityPanel: React.FC = () => {
  const active = useGameStore((s) => s.active);
  const resolve = useGameStore((s) => s.resolve);
  const tick = useGameStore((s) => s.tick);

  useEffect(() => {
    const t = setInterval(() => tick(), 1000);
    return () => clearInterval(t);
  }, [tick]);

  if (active.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9000] flex flex-col gap-2 pointer-events-none">
      {active.map((a) => (
        <div key={a.id} className="pointer-events-auto">
          <Card
            a={a}
            onResolve={(id, actionId, impact) =>
              resolve(
                id,
                actionId,
                impact,
                actionId === 'ignore' ? 'IGNORED' : impact >= 15 ? 'CORRECT' : 'PARTIAL'
              )
            }
          />
        </div>
      ))}
    </div>
  );
};
