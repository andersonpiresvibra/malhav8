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
    flights?: FlightData[];
    vehicles?: Vehicle[];
}

type Tab = 'SRV' | 'CTA';

export const DesigOpr: React.FC<DesigOprProps> = ({ 
    isOpen, 
    onClose, 
    flight, 
    vehicle, 
    operators, 
    onConfirm,
    flights = [],
    vehicles = []
}) => {
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

    // Filtragem e classificação de operadores livres e disponíveis
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

            // Verificar se está ocupado com outro voo ativo
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

    // Cálculo dinâmico em memória sincronizado com SSoT (Realtime do Supabase)
    const getOperatorStats = (op: OperatorProfile) => {
        if (!flights || flights.length === 0) {
            return { 
                count: op.stats?.flightsWeekly ? Math.round(op.stats.flightsWeekly / 4) : 0, 
                lastPos: op.lastPosition || 'PÁTIO' 
            };
        }
        
        const warName = op.warName;
        // Filtra voos do operador (titular ou apoio)
        const opFlights = flights.filter(f => 
            (f.operator?.toLowerCase() === warName.toLowerCase() || 
             f.supportOperator?.toLowerCase() === warName.toLowerCase())
        );

        // Apenas voos concluídos no pátio
        const completedFlights = opFlights.filter(f => 
            ['FINALIZADO', 'CONCLUIDO', 'ABASTECIDO', 'CONCLUÍDO', 'CONC'].includes(f.status?.toUpperCase() || '')
        );

        // Última posição registrada do operador no pátio ativo
        let lastPos = op.lastPosition || 'PÁTIO';
        if (opFlights.length > 0) {
            const sorted = [...opFlights].sort((a, b) => {
                const timeA = a.actualEndTime || a.scheduledTime || '';
                const timeB = b.actualEndTime || b.scheduledTime || '';
                return timeB.localeCompare(timeA);
            });
            const latestFlight = sorted[0];
            const flightPos = latestFlight?.positionId || latestFlight?.parkingPosition;
            if (flightPos) {
                lastPos = flightPos;
            }
        }

        return {
            count: completedFlights.length,
            lastPos: lastPos
        };
    };

    if (!isOpen || (!flight && !vehicle)) return null;

    const title = "Alocação Direta de Motorista / Operador";
    const subtitle = flight 
        ? `Voo ${flight.flightNumber} • REQ: ${flight.vehicleType || 'GERAL'}` 
        : `Ativo de Pista: ${vehicle?.id} • ${vehicle?.type}`;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={handleClose}>
            {/* Modal mais compacto de largura max-w-3xl */}
            <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                            <UserPlus size={18} />
                        </div>
                        <div>
                            <h3 className="text-xs font-black text-white uppercase tracking-wider font-sans leading-none">{title}</h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 font-mono">{subtitle}</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 transition-all cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs abreviados (SRV's / CTA's) codificados por cor */}
                <div className="flex border-b border-slate-800 bg-slate-900/50">
                    {(['SRV', 'CTA'] as Tab[]).map(tab => {
                        const list = categorizedOperators[tab];
                        const count = list.length;
                        const isActive = activeTab === tab;
                        const isSrvIncompatible = tab === 'SRV' && isCtaMandatory;
                        
                        // Estilos dinâmicos de alta legibilidade conforme especificações do designer
                        let tabStyle: React.CSSProperties = {};
                        if (isActive) {
                            if (tab === 'SRV') {
                                tabStyle = { backgroundColor: '#3B82F6', color: '#ffffff', borderColor: '#3B82F6' };
                            } else {
                                tabStyle = { backgroundColor: '#E7C800', color: '#000000', borderColor: '#E7C800' };
                            }
                        }

                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                    isActive 
                                        ? '' 
                                        : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                                    }`}
                                style={tabStyle}
                            >
                                {tab === 'SRV' ? "SRV's" : "CTA's"}
                                {isSrvIncompatible ? (
                                    <span className="text-[7.5px] font-black font-mono uppercase bg-red-500/15 text-red-500 px-2 py-0.5 border border-red-500/20 leading-none animate-pulse">
                                        INCOMPATÍVEL
                                    </span>
                                ) : (
                                    <span 
                                        className="px-2 py-0.5 text-[9px] font-mono font-black leading-none rounded-sm transition-all shadow-sm"
                                        style={
                                            isActive 
                                                ? (tab === 'SRV' 
                                                    ? { backgroundColor: '#ffffff', color: '#13336c', fontWeight: '900' } 
                                                    : { backgroundColor: '#ffffff', color: '#E7C800', fontWeight: '900' }) 
                                                : { backgroundColor: '#1e293b', color: '#64748b' }
                                        }
                                    >
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Tabela de Grid de Operadores (Highly Legible / Alta Densidade NOC / Largura compacta) */}
                <div className="flex-1 relative bg-slate-900 overflow-hidden flex flex-col">
                    {activeTab === 'SRV' && isCtaMandatory && (
                        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 z-30 animate-in fade-in duration-200">
                            <div className="w-12 h-12 bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 mb-3 animate-pulse">
                                <AlertTriangle size={24} />
                            </div>
                            <h4 className="text-xs font-black text-red-500 uppercase tracking-widest mb-1 font-mono">
                                COMPATIBILIDADE CTA REQUERIDA
                            </h4>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide max-w-[325px] leading-relaxed mb-4">
                                Esta posição ou tipo de voo requer tanque específico (CTA). Servidores (SRV's) não são compatíveis para esta designação.
                            </p>
                            <button
                                onClick={() => setActiveTab('CTA')}
                                className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2 shadow-lg"
                            >
                                <Truck size={14} /> IR PARA ABA CTA's
                            </button>
                        </div>
                    )}

                    {currentList.length > 0 ? (
                        <div className="overflow-x-auto w-full">
                            {/* Ajuste dinâmico e enxuto das larguras de coluna */}
                            <div className="min-w-[620px] flex flex-col">
                                {/* Header da Tabela mudando conforme a aba (CTA tem colunas de Litros e Peso adicionadas) */}
                                <div className={`grid ${
                                    activeTab === 'CTA' 
                                        ? 'grid-cols-[45px_1fr_75px_80px_85px_80px_80px_90px]' 
                                        : 'grid-cols-[45px_1.4fr_75px_105px_110px_90px]'
                                } gap-2.5 items-center text-[10px] font-black uppercase text-slate-400 tracking-wider px-5 py-2.5 bg-slate-950/50 border-b border-slate-800 font-mono`}>
                                    <span>Foto</span>
                                    <span>Operador</span>
                                    <span>Status</span>
                                    <span>Voo(s) dia</span>
                                    <span>Últ. Pos.</span>
                                    {activeTab === 'CTA' && (
                                        <>
                                            <span>Volume L</span>
                                            <span>Peso Kg</span>
                                        </>
                                    )}
                                    <span className="text-right">Viatura</span>
                                </div>

                                {/* Linhas de Operadores */}
                                <div className="p-3.5 space-y-1.5 min-h-[160px] max-h-[300px] overflow-y-auto">
                                    {currentList.map(op => {
                                        const isSelected = selectedOperatorId === op.id;
                                        const isCta = op.assignedVehicle?.includes('CTA-') || op.assignedVehicle?.includes('CTA');
                                        const isOpIncompatible = activeTab === 'SRV' && isCtaMandatory;
                                        const stats = getOperatorStats(op);

                                        // Buscar dados de volume no pátio para o combustível
                                        const linkedVehicle = vehicles.find(v => {
                                            if (!v.id || !op.assignedVehicle) return false;
                                            const cleanV = v.id.replace(/\D/g, '');
                                            const cleanOp = op.assignedVehicle.replace(/\D/g, '');
                                            return v.id.toLowerCase() === op.assignedVehicle.toLowerCase() || 
                                                   (cleanV && cleanOp && cleanV === cleanOp);
                                        });
                                        const curVol = linkedVehicle?.currentVolume ?? 0;
                                        const curVolReal = linkedVehicle ? Math.max(0, (linkedVehicle.currentVolume ?? 0) - 300) : 0;
                                        const weightKg = Math.round(curVolReal * 0.803);
                                        const totalCapacity = linkedVehicle?.capacity ?? 0;
                                        const totalCapacityKg = Math.round(totalCapacity * 0.803);
                                        
                                        return (
                                            <button 
                                                key={op.id} 
                                                disabled={isOpIncompatible}
                                                onClick={() => !isOpIncompatible && setSelectedOperatorId(op.id)} 
                                                className={`w-full grid ${
                                                    activeTab === 'CTA' 
                                                        ? 'grid-cols-[45px_1fr_75px_80px_85px_80px_80px_90px]' 
                                                        : 'grid-cols-[45px_1.4fr_75px_105px_110px_90px]'
                                                } gap-2.5 items-center px-4 py-2 border transition-all relative overflow-hidden text-left cursor-pointer rounded-sm ${
                                                    isOpIncompatible 
                                                        ? 'bg-slate-950/10 border-slate-900/40 cursor-not-allowed select-none' 
                                                        : isSelected 
                                                            ? 'bg-indigo-950/80 border-indigo-500 border-l-[6px] border-l-indigo-400 text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] shadow-lg scale-[1.01]' 
                                                            : 'bg-slate-950/30 border-slate-850 hover:border-slate-700 hover:bg-slate-950/60'
                                                }`}
                                            >
                                                {/* Foto */}
                                                <div className={`w-8 h-8 bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 relative overflow-hidden select-none z-10 ${isOpIncompatible ? 'opacity-30' : ''}`}>
                                                    {op.photoUrl ? (
                                                        <img src={op.photoUrl} alt={op.warName} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <User size={14} className="text-slate-600" />
                                                    )}
                                                </div>

                                                {/* Nome de Guerra (Esbelto e altíssima legibilidade) */}
                                                <div className={`text-xs font-black uppercase tracking-wider font-sans truncate z-10 ${
                                                    isOpIncompatible ? 'opacity-30 select-none' : isSelected ? 'text-white' : 'text-slate-100'
                                                 }`}>
                                                    {op.warName}
                                                </div>

                                                {/* Status (Badge Retangular com fundo verde nítido) */}
                                                <div className="z-10">
                                                    <span 
                                                        className={`inline-flex items-center justify-center text-[9px] font-black font-mono uppercase px-2 py-0.5 border leading-none rounded-sm ${
                                                            isOpIncompatible 
                                                                ? 'bg-red-500/5 text-red-500/50 border-red-500/10' 
                                                                : isSelected 
                                                                    ? 'bg-emerald-500 text-white border-white/30' 
                                                                    : 'bg-emerald-600 text-white border-emerald-700 shadow-sm shadow-emerald-500/10'
                                                        }`}
                                                        style={
                                                            !isOpIncompatible 
                                                                ? { backgroundColor: '#2acc2a', color: '#ffffff', borderColor: '#2acc2a', fontWeight: '900' } 
                                                                : {}
                                                        }
                                                    >
                                                        LIVRE
                                                    </span>
                                                </div>

                                                {/* Qnt de Voos Realizados (Nome legível e abreviado) */}
                                                <div className={`font-mono text-xs font-bold z-10 ${
                                                    isOpIncompatible ? 'opacity-30' : isSelected ? 'text-indigo-100' : 'text-slate-300'
                                                }`}>
                                                    {String(stats.count).padStart(2, '0')} {stats.count === 1 ? 'Voo' : 'Voos'}
                                                </div>

                                                {/* Última Posição no Pátio */}
                                                <div className={`font-sans text-xs font-bold uppercase tracking-wide truncate z-10 ${
                                                    isOpIncompatible ? 'opacity-30' : isSelected ? 'text-indigo-100' : 'text-slate-200'
                                                }`}>
                                                    {stats.lastPos}
                                                </div>

                                                {/* Coluna de Volume em Litros (Apenas Aba de CTA's) */}
                                                {activeTab === 'CTA' && (
                                                    <>
                                                        <div className={`flex flex-col z-10 min-w-0 ${
                                                            isOpIncompatible ? 'opacity-30' : ''
                                                        }`}>
                                                            <span className={`font-mono text-xs font-black leading-none ${
                                                                isSelected ? 'text-white' : 'text-amber-400'
                                                            }`}>
                                                                {curVolReal.toLocaleString('pt-BR')} L
                                                            </span>
                                                            {totalCapacity > 0 && (
                                                                <span className={`font-mono text-[8px] mt-0.5 ${
                                                                    isSelected ? 'text-indigo-200' : 'text-slate-400'
                                                                }`}>
                                                                    / CAP {totalCapacity.toLocaleString('pt-BR')} L
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Coluna de Peso em Kg (Apenas Aba de CTA's) */}
                                                        <div className={`flex flex-col z-10 min-w-0 ${
                                                            isOpIncompatible ? 'opacity-30' : ''
                                                        }`}>
                                                            <span className={`font-mono text-xs font-black leading-none ${
                                                                isSelected ? 'text-white' : 'text-amber-500'
                                                            }`}>
                                                                {weightKg.toLocaleString('pt-BR')} kg
                                                            </span>
                                                            {totalCapacity > 0 && (
                                                                <span className={`font-mono text-[8px] mt-0.5 ${
                                                                    isSelected ? 'text-indigo-200' : 'text-slate-400'
                                                                }`}>
                                                                    / CAP {totalCapacityKg.toLocaleString('pt-BR')} kg
                                                                </span>
                                                            )}
                                                        </div>
                                                    </>
                                                )}

                                                {/* Viatura Vinculada (Badge) */}
                                                <div className="text-right z-10">
                                                    {op.assignedVehicle ? (
                                                        <span 
                                                            className={`inline-flex items-center justify-center font-mono font-black border text-xs px-2.5 py-0.5 uppercase min-w-[80px] text-center rounded-sm ${
                                                                isCta 
                                                                    ? 'bg-yellow-500 text-black border-yellow-600 shadow-sm shadow-yellow-500/15' 
                                                                    : 'bg-blue-600 text-white border-blue-700 shadow-sm shadow-blue-500/15'
                                                            }`}
                                                            style={
                                                                isCta 
                                                                    ? { backgroundColor: '#E7C800', color: '#000000', borderColor: '#E7C800', fontWeight: '900' } 
                                                                    : { backgroundColor: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8', fontWeight: '900' }
                                                            }
                                                        >
                                                            {op.assignedVehicle}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] font-black font-mono uppercase bg-slate-850 text-slate-500 border border-slate-750 px-2 py-0.5 rounded-sm">
                                                            NENHUM
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Bloqueador de compatibilidade */}
                                                {isOpIncompatible && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 z-20">
                                                        <span className="bg-red-950 text-red-500 border border-red-500/40 px-3 py-1 text-[8px] font-black uppercase tracking-widest font-mono">
                                                            INCOMPATÍVEL
                                                        </span>
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[200px] flex flex-col items-center justify-center text-slate-500 gap-2 py-12">
                            <User size={30} className="opacity-15 animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-widest font-mono text-center">Nenhum operador {activeTab} disponível livre</span>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-slate-800 bg-slate-950 flex gap-3">
                    <button 
                        onClick={handleClose} 
                        className="flex-1 py-2.5 border border-slate-750 text-slate-400 font-bold text-xs hover:bg-slate-800 hover:text-white transition-all uppercase font-mono cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleConfirm} 
                        disabled={!selectedOperatorId || (activeTab === 'SRV' && isCtaMandatory)} 
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-550 text-white font-black text-xs transition-all uppercase shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                        Confirmar Designação
                    </button>
                </div>
            </div>
        </div>
    );
};
