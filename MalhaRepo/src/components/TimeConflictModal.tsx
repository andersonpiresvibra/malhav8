import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Clock, CalendarDays, Undo2 } from 'lucide-react';

interface TimeConflictModalProps {
  timeStr: string;
  isDarkMode: boolean;
  onConfirmToday: () => void;
  onConfirmTomorrow: () => void;
  onCorrect: () => void;
  onDiscard: () => void;
}

export const TimeConflictModal: React.FC<TimeConflictModalProps> = ({
  timeStr,
  isDarkMode,
  onConfirmToday,
  onConfirmTomorrow,
  onCorrect,
  onDiscard
}) => {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border ${isDarkMode ? 'bg-slate-900 border-red-900/50' : 'bg-white border-red-200'}`}>
        <div className={`p-6 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'} flex items-center gap-4`}>
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
             <AlertCircle size={24} className="text-red-500" />
          </div>
          <div>
            <h3 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'} uppercase tracking-tight`}>Aviso: Cruzamento de Dia</h3>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-medium mt-1`}>
              O horário inserido ({timeStr}) aparenta avançar para o dia seguinte (após 23h59).
            </p>
          </div>
        </div>

        <div className="p-6 space-y-3">
            <button
              onClick={onConfirmTomorrow}
              className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all group ${isDarkMode ? 'border-slate-700 bg-slate-800 hover:border-blue-500 hover:bg-slate-800/80' : 'border-slate-200 bg-slate-50 hover:border-blue-500 hover:bg-slate-100'}`}
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <CalendarDays size={20} className="text-blue-500" />
              </div>
              <div className="text-left flex-1">
                <p className={`font-black text-[13px] uppercase tracking-wide ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>É de amanhã (Próximo Dia)</p>
                <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-medium`}>Mover este voo para a malha do dia seguinte.</p>
              </div>
            </button>

            <button
              onClick={onConfirmToday}
              className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all group ${isDarkMode ? 'border-slate-700 bg-slate-800 hover:border-amber-500 hover:bg-slate-800/80' : 'border-slate-200 bg-slate-50 hover:border-amber-500 hover:bg-slate-100'}`}
            >
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Clock size={20} className="text-amber-500" />
              </div>
              <div className="text-left flex-1">
                <p className={`font-black text-[13px] uppercase tracking-wide ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>Manter Hoje (Exceção)</p>
                <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-medium`}>O voo pertence à malha de hoje mesmo sendo esse horário.</p>
              </div>
            </button>

            <button
              onClick={onCorrect}
              className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all group ${isDarkMode ? 'border-slate-700 bg-slate-800 hover:border-slate-500 hover:bg-slate-700' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
            >
              <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Undo2 size={20} className={isDarkMode ? 'text-slate-300' : 'text-slate-600'} />
              </div>
              <div className="text-left flex-1">
                <p className={`font-black text-[13px] uppercase tracking-wide ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Corrigir Digitação</p>
                <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-medium`}>Voltar a editar para corrigir o horário.</p>
              </div>
            </button>

            <button
              onClick={onDiscard}
              className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all group ${isDarkMode ? 'border-slate-700 bg-slate-800 hover:border-red-500 hover:bg-slate-700' : 'border-slate-200 bg-white hover:border-red-300 hover:bg-red-50'}`}
            >
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <AlertCircle size={20} className="text-red-500" />
              </div>
              <div className="text-left flex-1">
                <p className={`font-black text-[13px] uppercase tracking-wide ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>Descartar Alteração</p>
                <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-medium`}>Cancelar e restaurar o horário anterior.</p>
              </div>
            </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
