import React from 'react';
import { AlertTriangle, CalendarDays, Undo2, Ban } from 'lucide-react';

interface BulkNextDayModalProps {
  count: number;
  isDarkMode: boolean;
  onMoveToNextDay: () => void;
  onEditToday: () => void;
  onCancel: () => void;
}

export const BulkNextDayModal: React.FC<BulkNextDayModalProps> = ({
  count,
  isDarkMode,
  onMoveToNextDay,
  onEditToday,
  onCancel
}) => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border ${isDarkMode ? 'bg-slate-900 border-amber-900/50' : 'bg-white border-amber-200'}`}>
        <div className={`p-6 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'} flex items-center gap-4`}>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
             <AlertTriangle size={24} className="text-amber-500" />
          </div>
          <div>
            <h3 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'} uppercase tracking-tight`}>Alerta de Data</h3>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-medium mt-1`}>
              Detectamos que <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>{count} voo(s)</strong> no arquivo possuem horário (ETD) aparentando cruzar para o dia seguinte (após 23h59).
            </p>
          </div>
        </div>

        <div className="p-6 space-y-3">
            <button
              onClick={onMoveToNextDay}
              className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all group ${isDarkMode ? 'border-slate-700 bg-slate-800 hover:border-blue-500 hover:bg-slate-800/80' : 'border-slate-200 bg-slate-50 hover:border-blue-500 hover:bg-slate-100'}`}
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <CalendarDays size={20} className="text-blue-500" />
              </div>
              <div className="text-left flex-1">
                <p className={`font-black text-[13px] uppercase tracking-wide ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>Mover ao Próximo Dia</p>
                <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-medium`}>Inserir esses voos na malha de operação de amanhã.</p>
              </div>
            </button>

            <button
              onClick={onEditToday}
              className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all group ${isDarkMode ? 'border-slate-700 bg-slate-800 hover:border-amber-500 hover:bg-slate-800/80' : 'border-slate-200 bg-slate-50 hover:border-amber-500 hover:bg-slate-100'}`}
            >
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Undo2 size={20} className="text-amber-500" />
              </div>
              <div className="text-left flex-1">
                <p className={`font-black text-[13px] uppercase tracking-wide ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>Manter Neste Dia p/ Reeditar</p>
                <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-medium`}>Importar na malha atual para correção manual.</p>
              </div>
            </button>

            <button
              onClick={onCancel}
              className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all group ${isDarkMode ? 'border-slate-700 bg-slate-800 hover:border-red-500 hover:bg-slate-700' : 'border-slate-200 bg-white hover:border-red-300 hover:bg-red-50'}`}
            >
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Ban size={20} className="text-red-500" />
              </div>
              <div className="text-left flex-1">
                <p className={`font-black text-[13px] uppercase tracking-wide ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>Cancelar Importação</p>
                <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-medium`}>Sair sem carregar nenhum voo.</p>
              </div>
            </button>
        </div>
      </div>
    </div>
  );
};
