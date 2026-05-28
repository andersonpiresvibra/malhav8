import React, { useState, useEffect, useMemo } from 'react';
import { OperatorProfile, FlightData, Vehicle } from '../types';
import { UserPlus, X, Check, User, Clock, Briefcase } from 'lucide-react';

interface DesigOprProps {
    isOpen: boolean;
    onClose: () => void;
    flight?: FlightData | null;
    vehicle?: Vehicle | null;
    operators: OperatorProfile[];
    onConfirm: (operatorId: string) => void;
}

type Tab = 'DISPONIVEIS' | 'DESIGNADOS' | 'OCUPADOS';

export const DesigOpr: React.FC<DesigOprProps> = ({ isOpen, onClose, flight, vehicle, operators, onConfirm }) => {
    const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('DISPONIVEIS');

    const handleConfirm = () => {
        if (selectedOperatorId) {
            onConfirm(selectedOperatorId);
            setSelectedOperatorId(null);
        }
    };

    const handleClose = () => {
        setSelectedOperatorId(null);
        onClose();
    };

    useEffect(() => {
        if (isOpen) {
            setActiveTab('DISPONIVEIS');
            setSelectedOperatorId(null);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter' && isOpen && selectedOperatorId) {
                handleConfirm();
            }
            if (e.key === 'Escape' && isOpen) {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, selectedOperatorId]);

    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

    const processedOperators = useMemo(() => {
        return operators
            .map(p => {
                const dayEntry = p.workDays?.find(wd => wd.date === todayStr);
                const isNotWorking = dayEntry && ['FOLGA', 'AT', 'AF', 'FÉRIAS', 'AFAST.', 'FOLG.'].includes(dayEntry.type);
                const isOnSchedule = !isNotWorking;

                // Only show scheduled working operators for today ("operadores do dia")
                if (!dayEntry || !isOnSchedule) {
                    return null;
                }

                let finalStatus = p.status || 'DISPONÍVEL';
                if (finalStatus === 'ATIVO' || finalStatus === 'FOLGA' || finalStatus === 'DESCONECTADO') {
                    finalStatus = 'DISPONÍVEL';
                }

                return {
                    ...p,
                    status: finalStatus
                };
            })
            .filter(Boolean) as OperatorProfile[];
    }, [operators, todayStr]);

    const categorizedOperators = useMemo(() => {
        return {
            DISPONIVEIS: processedOperators.filter(op => op.status === 'DISPONÍVEL'),
            DESIGNADOS: processedOperators.filter(op => op.status === 'DESIGNADO' || (op.status as any) === 'ALOCADO'),
            OCUPADOS: processedOperators.filter(op => op.status === 'OCUPADO' || op.status === 'ENCHIMENTO'),
        };
    }, [processedOperators]);

    const currentList = categorizedOperators[activeTab];

    if (!isOpen || (!flight && !vehicle)) return null;

    const title = "Alocação Direta de Motorista / Operador";
    const subtitle = flight 
        ? `Voo ${flight.flightNumber} • REQ: ${flight.vehicleType}` 
        : `Ativo de Pista: ${vehicle?.id} • ${vehicle?.type}`;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={handleClose}>
            <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
                
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20"><UserPlus size={16} /></div>
                        <div>
                            <h3 className="text-xs font-black text-white uppercase tracking-tight leading-none">{title}</h3>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1 font-mono">{subtitle}</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="text-slate-500 hover:text-white p-1 rounded-md hover:bg-slate-800"><X size={18} /></button>
                </div>

                <div className="flex border-b border-slate-800 bg-slate-900/50">
                    {(['DISPONIVEIS', 'DESIGNADOS', 'OCUPADOS'] as Tab[]).map(tab => {
                        const count = categorizedOperators[tab].length;
                        const isActive = activeTab === tab;
                        let activeColor = tab === 'DISPONIVEIS' ? 'text-emerald-500 border-emerald-500' : tab === 'DESIGNADOS' ? 'text-blue-500 border-blue-500' : 'text-amber-500 border-amber-500';

                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-2 ${isActive ? `bg-slate-900 ${activeColor}` : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                            >
                                {tab}
                                <span className={`px-1.5 py-0.5 rounded text-[8px] bg-slate-800 ${isActive ? 'text-white' : 'text-slate-500'}`}>{count}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex-1 p-4 min-h-[140px] max-h-[260px] overflow-y-auto bg-slate-900">
                    {currentList.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2">
                            {currentList.map(op => {
                                const isSelected = selectedOperatorId === op.id;
                                return (
                                    <button key={op.id} onClick={() => setSelectedOperatorId(op.id)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all relative overflow-hidden ${isSelected ? 'bg-indigo-600 border-indigo-500 shadow-lg' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}>
                                        <div className="flex items-center gap-4 relative z-10">
                                            <div className="w-8 h-10 bg-slate-950 border border-slate-800 overflow-hidden flex items-end justify-center">
                                                {op.photoUrl ? <img src={op.photoUrl} alt={op.warName} className="w-full h-full object-cover" /> : <User size={16} className="text-slate-650" />}
                                            </div>
                                            <div className="text-left">
                                                <div className={`text-xs font-black uppercase ${isSelected ? 'text-white' : 'text-slate-200'}`}>{op.warName}</div>
                                                <div className="text-[9px] font-mono text-slate-500 uppercase mt-0.5">Status: <span className="text-slate-300">{op.status}</span></div>
                                            </div>
                                        </div>
                                        {isSelected && <div className="w-5 h-5 rounded-full bg-white text-indigo-600 flex items-center justify-center"><Check size={12} strokeWidth={4} /></div>}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-650 gap-3 py-10">
                            <User size={32} className="opacity-10" />
                            <span className="text-[9px] font-black uppercase tracking-widest font-mono">Estação Vazia nesta Categoria</span>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-800 bg-slate-950 flex gap-3">
                    <button onClick={handleClose} className="flex-1 py-3 rounded-lg border border-slate-750 text-slate-400 font-bold text-[10px] hover:bg-slate-800 transition-all uppercase font-mono">Cancelar</button>
                    <button onClick={handleConfirm} disabled={!selectedOperatorId} className="flex-1 py-3 rounded-lg bg-indigo-600 text-white font-black text-[10px] hover:bg-indigo-550 transition-all uppercase shadow-lg disabled:opacity-40">Confirmar Designação</button>
                </div>
            </div>
        </div>
    );
};
