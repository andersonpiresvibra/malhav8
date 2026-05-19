import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { TimerOff, Clock } from 'lucide-react';
import { FlightData } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';

interface DelayJustificationModalProps {
    flightId?: string;
    flights?: FlightData[];
    delayReasonCode: string;
    setDelayReasonCode: (code: string) => void;
    delayReasonDetail: string;
    setDelayReasonDetail: (detail: string) => void;
    onClose: () => void;
    onSubmit: (finalCode?: string, finalDetail?: string) => void;
}

const DELAY_REASONS = [
    "Não houve atraso",
    "Autorização",
    "Calço",
    "DOC/DOT",
    "Mecânico",
    "Manut. Aeronave - Liberado",
    "Area Obstruída",
    "Imprev. Trajeto",
    "Equipe de Rampa",
    "Restr. Meteorologica",
    "Hidrante/Pit",
    "Frota",
    "Outros"
];

const REQUIRES_TIME = [
    "Autorização",
    "Calço",
    "DOC/DOT",
    "Mecânico",
    "Manut. Aeronave - Liberado",
    "Area Obstruída"
];

export const DelayJustificationModal: React.FC<DelayJustificationModalProps> = ({
    flightId,
    flights,
    delayReasonCode,
    setDelayReasonCode,
    delayReasonDetail,
    setDelayReasonDetail,
    onClose,
    onSubmit
}) => {
    const { isDarkMode } = useTheme();
    const [timeInput, setTimeInput] = useState('');

    const needsTime = REQUIRES_TIME.includes(delayReasonCode);

    const handleConfirm = () => {
        let finalCode = delayReasonCode;
        if (needsTime && timeInput) {
            finalCode = `${delayReasonCode} (${timeInput})`;
        }
        onSubmit(finalCode, delayReasonDetail);
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in p-4">
            <div className={`${isDarkMode ? 'bg-slate-900 border-emerald-500/30' : 'bg-white border-slate-200'} border-[0.5px] rounded-[8px] w-[500px] shadow-[0_0_50px_rgba(245,158,11,0.2)] animate-in zoom-in-95 overflow-hidden`}>
                <div className={`flex items-center gap-4 p-8 border-b ${isDarkMode ? 'border-slate-800 bg-slate-950' : 'border-[#004D24] bg-[#004D24]'}`}>
                    <div className="w-12 h-12 rounded-md bg-amber-500/10 flex items-center justify-center border border-amber-500/30 text-amber-500">
                        <TimerOff size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-wider">Atraso Detectado</h3>
                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Justificativa Operacional</p>
                    </div>
                </div>

                <div className="p-8 space-y-4">
                    <div>
                        <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Causa Primária</label>
                        <select 
                            className={`w-full border rounded-md px-4 py-3 text-sm outline-none focus:border-amber-500 ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                            value={delayReasonCode}
                            onChange={(e) => {
                                setDelayReasonCode(e.target.value);
                                setTimeInput('');
                            }}
                        >
                            <option value="">-- SELECIONE O MOTIVO --</option>
                            {DELAY_REASONS.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>

                    {needsTime && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <label className={`text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                <Clock size={12} className="text-amber-500" />
                                Horário da Ocorrência
                            </label>
                            <input 
                                type="time"
                                className={`w-full border rounded-md px-4 py-3 text-sm outline-none focus:border-amber-500 ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                                value={timeInput}
                                onChange={(e) => setTimeInput(e.target.value)}
                            />
                        </div>
                    )}
                    
                    <div>
                        <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Observações (Opcional)</label>
                        <textarea 
                            className={`w-full border rounded-md px-4 py-3 text-sm outline-none focus:border-amber-500 resize-none h-24 ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                            placeholder="Detalhes adicionais sobre o ocorrido..."
                            value={delayReasonDetail}
                            onChange={(e) => setDelayReasonDetail(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 p-8 pt-0">
                    <button 
                        onClick={onClose}
                        className={`py-3 rounded-lg border font-bold uppercase text-[10px] tracking-widest transition-all active:scale-95 ${isDarkMode ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleConfirm}
                        disabled={!delayReasonCode || (needsTime && !timeInput)}
                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg shadow-lg shadow-indigo-600/20 transition-all active:scale-95 btn-confirm-delay disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="text-[10px] font-black uppercase tracking-widest">Confirmar e Finalizar</span>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
