import React, { useState, useEffect, useMemo } from 'react';
import { OperatorProfile, FlightData, Vehicle } from '../types';
import { UserPlus, X, Check, User, AlertTriangle, Truck } from 'lucide-react';
import { POSITIONS_METADATA } from '../constants/aerodromoConfig';

interface DesigOprProps {
    isOpen: boolean;
    onClose: () => void;
    flight?: FlightData | null;
    vehicle?: Vehicle | null;
    operators: OperatorProfile[];
    onConfirm: (operatorId: string) => void;
}

type Tab = 'SRV' | 'CTA';

export const DesigOpr: React.FC<DesigOprProps> = ({ isOpen, onClose, flight, vehicle, operators, onConfirm }) => {
    const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('SRV');

    const isCtaMandatory = useMemo(() => {
        if (!flight) return false;
        const posId = flight.positionId || flight.parkingPosition;
        const posType = posId ? POSITIONS_METADATA[posId]?.type : null;
        return flight.vehicleType === 'CTA' || 
               flight.fleetType === 'CTA' || 
               flight.positionType === 'CTA' || 
               posType === 'REMOTA';
    }, [flight]);

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

    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

    // Se o modal for aberto, escolhe a aba correta baseado na necessidade do voo/viatura
    useEffect(() => {
        if (isOpen) {
            const posId = flight?.positionId || flight?.parkingPosition;
            const posType = posId ? POSITIONS_METADATA[posId]?.type : null;
            const isCTA = flight?.vehicleType === 'CTA' || 
                          flight?.fleetType === 'CTA' ||
                          flight?.positionType === 'CTA' ||
                          posType === 'REMOTA' ||
                          vehicle?.type === 'CTA' || 
                          (vehicle && !vehicle.type?.includes('SERVIDOR'));
            setActiveTab(isCTA ? 'CTA' : 'SRV');
            setSelectedOperatorId(null);
        }
    }, [isOpen, flight, vehicle]);

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

    // Filtragem e classificação rigorosa de operadores livres e disponíveis
    const availableOperators = useMemo(() => {
        return operators.filter(op => {
            // Exigência absoluta: Apenas operadores que possuem frota (veículo) associada
            if (!op.assignedVehicle) return false;

            // Verificar se está de folga ou não escalado hoje
            const dayEntry = op.workDays?.find(wd => wd.date === todayStr);
            const isNotWorking = dayEntry && ['FOLGA', 'AT', 'AF', 'FÉRIAS', 'AFAST.', 'FOLG.'].includes(dayEntry.type);
            if (isNotWorking) return false;

            // Verificar se está em pausa, inativo ou offline
            const isInactive = ['INATIVO', 'INTERVALO', 'DESCONECTADO', 'FOLGA'].includes(op.status?.toUpperCase() || '');
            if (isInactive) return false;

            // Verificar se está ocupado com outro voo ativo (se a missão for ocupada)
            const isOccupied = op.status === 'OCUPADO' || op.status === 'DESIGNADO' || op.status === 'ABASTECENDO';
            if (isOccupied) return false;

            return true;
        });
    }, [operators, todayStr]);

    const categorizedOperators = useMemo(() => {
        const srvList = availableOperators.filter(op => {
            if (op.assignedVehicle) {
                return op.assignedVehicle.toUpperCase().includes('SRV');
            }
            return op.fleetCapability === 'SRV' || op.fleetCapability === 'BOTH';
        });

        const ctaList = availableOperators.filter(op => {
            if (op.assignedVehicle) {
                return op.assignedVehicle.toUpperCase().includes('CTA');
            }
            return op.fleetCapability === 'CTA' || op.fleetCapability === 'BOTH';
        });

        return {
            SRV: srvList,
            CTA: ctaList
        };
    }, [availableOperators]);

    const currentList = categorizedOperators[activeTab];

    if (!isOpen || (!flight && !vehicle)) return null;

    const title = "Alocação Direta de Motorista / Operador";
    const subtitle = flight 
        ? `Voo ${flight.flightNumber} • REQ: ${flight.vehicleType}` 
        : `Ativo de Pista: ${vehicle?.id} • ${vehicle?.type}`;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={handleClose}>
            <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                            <UserPlus size={16} />
                        </div>
                        <div>
                            <h3 className="text-xs font-black text-white uppercase tracking-tight leading-none">{title}</h3>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1 font-mono">{subtitle}</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="text-slate-500 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs (SRV / CTA) */}
                <div className="flex border-b border-slate-800 bg-slate-900/50">
                    {(['SRV', 'CTA'] as Tab[]).map(tab => {
                        const list = categorizedOperators[tab];
                        const count = list.length;
                        const isActive = activeTab === tab;
                        const isSrvIncompatible = tab === 'SRV' && isCtaMandatory;
                        
                        let tabColor = tab === 'SRV' ? 'text-indigo-400 border-indigo-500' : 'text-amber-500 border-amber-500';

                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-2 ${
                                    isActive 
                                        ? `bg-slate-900 ${tabColor}` 
                                        : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                                }`}
                            >
                                {tab === 'SRV' ? 'SERVIDORES (SRV)' : 'CAMINHÕES (CTA)'}
                                {isSrvIncompatible ? (
                                    <span className="text-[7.5px] font-black font-mono uppercase bg-red-500/15 text-red-500 px-1.5 py-0.5 rounded border border-red-500/20 leading-none animate-pulse">
                                        INCOMPATÍVEL
                                    </span>
                                ) : (
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-mono leading-none ${isActive ? (tab === 'SRV' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-amber-500/20 text-amber-400') : 'bg-slate-800 text-slate-500'}`}>{count}</span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Operator List */}
                <div className="flex-1 p-4 min-h-[140px] max-h-[320px] overflow-y-auto bg-slate-900 space-y-2 relative">
                    {activeTab === 'SRV' && isCtaMandatory && (
                        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 z-30 animate-in fade-in duration-200">
                            <div className="w-12 h-12 rounded-full bg-red-500/15 border-2 border-red-500/30 flex items-center justify-center text-red-500 mb-3 animate-pulse">
                                <AlertTriangle size={24} />
                            </div>
                            <h4 className="text-sm font-black text-red-500 uppercase tracking-widest mb-1 font-mono">
                                COMPATIBILIDADE CTA ADVERTIDA
                            </h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide max-w-[280px] leading-relaxed mb-4">
                                Esta posição ou tipo de voo requer tanque específico (CTA). Servidores (SRV) estão indisponíveis para designação nesta missão.
                            </p>
                            <button
                                onClick={() => setActiveTab('CTA')}
                                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] uppercase tracking-widest rounded-lg transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-amber-500/15"
                            >
                                <Truck size={14} /> IR PARA ABA CTA
                            </button>
                        </div>
                    )}

                    {currentList.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2">
                            {currentList.map(op => {
                                const isSelected = selectedOperatorId === op.id;
                                const isCta = op.assignedVehicle?.includes('CTA-');
                                const isOpIncompatible = activeTab === 'SRV' && isCtaMandatory;
                                
                                return (
                                    <button 
                                        key={op.id} 
                                        disabled={isOpIncompatible}
                                        onClick={() => !isOpIncompatible && setSelectedOperatorId(op.id)} 
                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all relative overflow-hidden ${
                                            isOpIncompatible 
                                                ? 'bg-slate-950/10 border-slate-900/40 cursor-not-allowed select-none' 
                                                : isSelected 
                                                    ? 'bg-indigo-600/90 border-indigo-500 shadow-lg' 
                                                    : 'bg-slate-950/40 border-slate-850 hover:border-slate-700 hover:bg-slate-950/70'
                                        }`}
                                    >
                                        <div className={`flex items-center gap-3 relative z-10 w-full ${isOpIncompatible ? 'blur-[1.5px] opacity-30 select-none pointer-events-none' : ''}`}>
                                            {/* Photo/Avatar */}
                                            <div className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex items-end justify-center shrink-0 shadow-inner relative">
                                                {op.photoUrl ? (
                                                    <img src={op.photoUrl} alt={op.warName} className="w-full h-full object-cover" />
                                                ) : (
                                                    <User size={18} className="text-slate-650 mb-1" />
                                                )}
                                            </div>

                                            {/* Operator Details */}
                                            <div className="text-left flex-1 min-w-0">
                                                <div className={`text-xs font-black uppercase tracking-tight truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                                                    {op.warName}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className="text-[8px] font-black font-mono uppercase bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded border border-emerald-500/10 leading-none">
                                                        Livre / Disp.
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Assigned Vehicle Badge */}
                                            <div className="shrink-0 text-right">
                                                {op.assignedVehicle ? (
                                                    <span className={`inline-flex items-center justify-center font-mono font-black rounded px-2 py-1 border text-xs min-w-[50px] uppercase text-center ${
                                                        isCta 
                                                            ? 'border-amber-500/20 bg-amber-500/10 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.05)]' 
                                                            : 'border-indigo-500/20 bg-indigo-500/10 text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.05)]'
                                                    }`}>
                                                        {op.assignedVehicle}
                                                    </span>
                                                ) : (
                                                    <span className="text-[8px] font-black font-mono uppercase bg-slate-800 text-slate-500 border border-slate-700/50 px-1.5 py-1 rounded">
                                                        SEM VIATURA
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {isOpIncompatible && (
                                            <div className="absolute inset-0 flex items-center justify-center z-20">
                                                <span className="bg-red-950/90 text-red-500 border border-red-500/40 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest font-mono shadow-2xl animate-pulse">
                                                    INCOMPATÍVEL
                                                </span>
                                            </div>
                                        )}

                                        {isSelected && !isOpIncompatible && (
                                            <div className="absolute right-2 top-2 w-5 h-5 rounded-full bg-white text-indigo-600 flex items-center justify-center shadow-md animate-in zoom-in-50 duration-100">
                                                <Check size={12} strokeWidth={4} />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-650 gap-3 py-10">
                            <User size={32} className="opacity-10" />
                            <span className="text-[9px] font-black uppercase tracking-widest font-mono text-center">Nenhum Operador Livre nesta Categoria</span>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-slate-800 bg-slate-950 flex gap-3">
                    <button 
                        onClick={handleClose} 
                        className="flex-1 py-3 rounded-lg border border-slate-750 text-slate-400 font-bold text-[10px] hover:bg-slate-800 hover:text-white transition-all uppercase font-mono"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleConfirm} 
                        disabled={!selectedOperatorId || (activeTab === 'SRV' && isCtaMandatory)} 
                        className="flex-1 py-3 rounded-lg bg-indigo-600 text-white font-black text-[10px] hover:bg-indigo-550 transition-all uppercase shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Confirmar Designação
                    </button>
                </div>
            </div>
        </div>
    );
};
