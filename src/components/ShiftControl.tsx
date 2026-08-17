// JETFUEL-SIM — Controle de Turno (iniciar/parar + score ao vivo + encerrar)
import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, Trophy } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { DifficultyLevel } from '../types/game';
import { nextInterval } from '../services/adversityEngine';
import { EndOfShift } from './EndOfShift';

const LEVELS: DifficultyLevel[] = ['TREINAMENTO', 'OPERACIONAL', 'PICO', 'EXTREMO'];

export const ShiftControl: React.FC = () => {
  const { running, difficulty, start, stop, spawn, live } = useGameStore();
  const [showEnd, setShowEnd] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const schedule = () => {
      const iv = nextInterval(useGameStore.getState().difficulty);
      timerRef.current = window.setTimeout(() => {
        if (cancelled) return;
        useGameStore.getState().spawn();
        schedule();
      }, iv);
    };
    schedule();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [running]);

  return (
    <>
      <div className="fixed bottom-4 left-4 z-[9000] bg-slate-800/95 border border-slate-600 rounded-lg p-3 flex items-center gap-3 shadow-2xl">
        {!running ? (
          <>
            <select
              value={difficulty}
              onChange={(e) => useGameStore.getState().start(e.target.value as DifficultyLevel)}
              className="bg-slate-900 text-slate-100 text-xs rounded px-2 py-1 border border-slate-600"
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <button
              onClick={() => start(difficulty)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1"
            >
              <Play size={14} /> Iniciar Turno
            </button>
          </>
        ) : (
          <>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase">Score</div>
              <div className="text-lg font-mono font-bold text-emerald-400">{live.total}</div>
            </div>
            <button
              onClick={() => setShowEnd(true)}
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1"
            >
              <Trophy size={14} /> Encerrar
            </button>
            <button
              onClick={() => { stop(); setShowEnd(true); }}
              className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-1"
            >
              <Square size={14} /> Parar
            </button>
          </>
        )}
      </div>
      {showEnd && <EndOfShift onClose={() => setShowEnd(false)} />}
    </>
  );
};
