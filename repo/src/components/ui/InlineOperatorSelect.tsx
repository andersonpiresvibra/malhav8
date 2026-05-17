import React, { useRef, useEffect } from 'react';
import { OperatorProfile } from '../../types';
import useOnClickOutside from '../../hooks/useOnClickOutside';

interface InlineOperatorSelectProps {
  flightId: string;
  currentOperatorName?: string;
  operators: OperatorProfile[];
  onSelect: (operatorId: string) => void;
  onClose: () => void;
  isDarkMode: boolean;
}

export const InlineOperatorSelect: React.FC<InlineOperatorSelectProps> = ({
  currentOperatorName,
  operators,
  onSelect,
  onClose,
  isDarkMode
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useOnClickOutside(ref, onClose);

  return (
    <div 
      ref={ref}
      className={`absolute top-full left-0 mt-1 min-w-[200px] z-[9999] rounded-lg shadow-xl border overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${
        isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
      }`}
    >
      <div className={`px-2 py-1.5 border-b text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'border-slate-800 text-slate-500' : 'border-slate-100 text-slate-400'}`}>
        Selecione o Operador
      </div>
      <div className="max-h-48 overflow-y-auto py-1">
        {operators.length > 0 ? (
          operators.map(op => {
            const isSelected = currentOperatorName === op.warName;
            return (
              <button
                key={op.id}
                onClick={() => onSelect(op.id)}
                className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors cursor-pointer ${
                  isSelected 
                    ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600') 
                    : (isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-50 text-slate-700')
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold tracking-wide uppercase">{op.warName}</span>
                  <span className="text-[9px] font-mono opacity-60">
                    {op.assignedVehicle || 'Sem veículo'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${op.status === 'LIVRE' || op.status === 'DISPONIVEL' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                </div>
              </button>
            );
          })
        ) : (
          <div className="px-3 py-3 text-[10px] text-center text-slate-500 italic">
            Nenhum operador disponível
          </div>
        )}
      </div>
    </div>
  );
};
