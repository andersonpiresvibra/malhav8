import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { FlightData, FlightStatus } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { 
  X, FileText, UserCheck, Users, CheckCircle, AlertCircle, MessageCircle, Save
} from 'lucide-react';

interface FlightReportInputModalProps {
  flight: FlightData;
  onClose: () => void;
  onUpdate: (updatedFlight: FlightData) => void;
}

export const FlightReportInputModal: React.FC<FlightReportInputModalProps> = ({ flight, onClose, onUpdate }) => {
  const { isDarkMode } = useTheme();
  const [localFlight, setLocalFlight] = useState<FlightData>(flight);

  // Drag logic
  const [position, setPosition] = useState(() => {
    if (typeof window !== 'undefined') {
        return { 
            x: Math.max(0, window.innerWidth / 2 - 200),
            y: Math.max(20, window.innerHeight / 2 - 250)
        };
    }
    return { x: 0, y: 0 };
  });

  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      setPosition({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y
      });
  };

  const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleSave = () => {
      onUpdate(localFlight);
      onClose();
  };

  return createPortal(
    <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{ left: position.x, top: position.y }}
        className={`fixed z-[9991] w-full max-w-[400px] flex flex-col rounded-[8px] shadow-2xl border-[0.5px] ${isDarkMode ? 'border-amber-500/30 bg-slate-900/95' : 'border-slate-200 bg-white/95'} backdrop-blur-xl overflow-hidden`}
    >
        <div 
            onMouseDown={handleMouseDown}
            className={`${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-[#F59E0B] border-transparent'} p-3 flex justify-between items-center cursor-move select-none border-b`}
        >
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center shrink-0 bg-white/20 rounded shadow-inner">
                    <FileText size={16} className={`${isDarkMode ? 'text-amber-400' : 'text-white'}`} />
                </div>
                <div className="flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest leading-none mb-1">
                        RELATÓRIO DE VOO
                    </span>
                    <h2 className="text-xl font-black text-white font-mono tracking-tighter leading-none">
                        {localFlight.flightNumber}
                    </h2>
                </div>
            </div>

            <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white transition-all"
            >
                <X size={18} className="border border-white/50 rounded-[5px]" />
            </button>
        </div>

        <div className="p-4 bg-white space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <FileText size={10} className="text-slate-300" /> Fuel Order
                    </label>
                    <input 
                        type="time"
                        value={localFlight.report?.fuelOrderTime || ''}
                        onChange={e => setLocalFlight({ ...localFlight, report: { ...localFlight.report, fuelOrderTime: e.target.value } })}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs px-2 py-1.5 rounded"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <UserCheck size={10} className="text-slate-300" /> Mecânico
                    </label>
                    <input 
                        type="time"
                        value={localFlight.report?.mechanicTime || ''}
                        onChange={e => setLocalFlight({ ...localFlight, report: { ...localFlight.report, mechanicTime: e.target.value } })}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs px-2 py-1.5 rounded"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Users size={10} className="text-slate-300" /> Tripulação
                    </label>
                    <input 
                        type="time"
                        value={localFlight.report?.crewTime || ''}
                        onChange={e => setLocalFlight({ ...localFlight, report: { ...localFlight.report, crewTime: e.target.value } })}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs px-2 py-1.5 rounded"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <CheckCircle size={10} className="text-slate-300" /> Autorização
                    </label>
                    <input 
                        type="time"
                        value={localFlight.report?.authorizationTime || ''}
                        onChange={e => setLocalFlight({ ...localFlight, report: { ...localFlight.report, authorizationTime: e.target.value } })}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs px-2 py-1.5 rounded"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                 <div className="space-y-1">
                    <label className="text-[8px] font-bold text-orange-500 uppercase tracking-widest flex items-center gap-1.5">
                        <AlertCircle size={10} /> Área Obstruída
                    </label>
                    <input 
                        type="time"
                        value={localFlight.report?.obstructedAreaTime || ''}
                        onChange={e => setLocalFlight({ ...localFlight, report: { ...localFlight.report, obstructedAreaTime: e.target.value } })}
                        className="w-full bg-orange-50 border border-orange-200 text-orange-800 text-xs px-2 py-1.5 rounded focus:ring-2 focus:ring-orange-500/20 outline-none"
                    />
                </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                        type="checkbox" 
                        checked={localFlight.report?.dispensed || false}
                        onChange={e => {
                            const newReport = { ...localFlight.report, dispensed: e.target.checked };
                            if (!e.target.checked) {
                                newReport.dispensedBy = '';
                                newReport.dispensedBadge = '';
                            }
                            setLocalFlight({ ...localFlight, report: newReport });
                        }}
                        className="w-3.5 h-3.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                    />
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-600 group-hover:text-slate-800">Dispensa de Abastecimento</span>
                </label>

                {localFlight.report?.dispensed && (
                     <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2 rounded border border-slate-200">
                         <div className="space-y-1">
                            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Resp. (Nome)</label>
                            <input 
                                type="text"
                                value={localFlight.report?.dispensedBy || ''}
                                placeholder="Nome"
                                onChange={e => setLocalFlight({ ...localFlight, report: { ...localFlight.report, dispensedBy: e.target.value } })}
                                className="w-full bg-white border border-slate-200 text-slate-700 text-xs px-2 py-1.5 rounded uppercase"
                            />
                         </div>
                         <div className="space-y-1">
                            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Colete</label>
                            <input 
                                type="text"
                                value={localFlight.report?.dispensedBadge || ''}
                                placeholder="Ex: 1234"
                                maxLength={4}
                                onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setLocalFlight({ ...localFlight, report: { ...localFlight.report, dispensedBadge: val } });
                                }}
                                className="w-full bg-white border border-slate-200 text-slate-700 text-xs px-2 py-1.5 rounded font-mono"
                            />
                         </div>
                     </div>
                )}
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-1">
                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <MessageCircle size={10} className="text-slate-300" /> Observações Gerais
                </label>
                <textarea 
                    rows={2}
                    value={localFlight.report?.observations || ''}
                    onChange={e => setLocalFlight({ ...localFlight, report: { ...localFlight.report, observations: e.target.value } })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-[11px] px-2 py-1.5 rounded resize-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                    placeholder="Adicione justificativas..."
                />
            </div>
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button 
                onClick={handleSave}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
            >
                <Save size={14} /> 
                Salvar Relatório
            </button>
        </div>
    </motion.div>, document.body
  );
};
