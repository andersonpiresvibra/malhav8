import React, { useState, useMemo } from 'react';
import { 
    Search, ArrowLeft, Plane, MapPin, 
    Activity, Radar, User, ChevronRight, Droplet, Users, BusFront, Zap
} from 'lucide-react';
import { OperatorProfile, ShiftCycle, OperatorCategory, FlightData, Vehicle } from '../types';

interface ShiftOperatorsSectionProps {
    onClose: () => void;
    operators: OperatorProfile[];
    onUpdateOperators: (operators: OperatorProfile[]) => void;
    onOpenCreateModal?: () => void;
    onOpenImportModal?: () => void;
    flights?: FlightData[];
    onUpdateFlights?: (flights: FlightData[]) => void;
    vehicles?: Vehicle[];
}

const OperatorAvatar: React.FC<{ op: OperatorProfile, isActive: boolean }> = ({ op, isActive }) => {
    const [error, setError] = useState(false);
    return (
        <div className="w-[67px] shrink-0 border-r border-slate-950/10 overflow-hidden relative flex items-end justify-center bg-slate-950/10">
            {op.photoUrl && !error ? (
                <img 
                    src={op.photoUrl} 
                    alt={op.warName} 
                    className={`w-full h-full object-cover transition-all ${isActive ? '' : 'grayscale'}`} 
                    onError={() => setError(true)}
                />
            ) : (
                <User size={48} className={`mb-2 ${isActive ? 'text-slate-950/25' : 'text-slate-400/25'}`} />
            )}
        </div>
    );
};

export const ShiftOperatorsSection: React.FC<ShiftOperatorsSectionProps> = ({ 
    onClose, operators, flights = [] 
}) => {

  const [activeShift, setActiveShift] = useState<ShiftCycle>('MANHÃ');
  const [activeCategory, setActiveCategory] = useState<OperatorCategory>('AERODROMO');
  const [searchTerm, setSearchTerm] = useState('');

  const getActiveMission = (warName: string): FlightData | undefined => {
    if (!flights) return undefined;
    return flights.find(f => f.operator?.toLowerCase() === warName.toLowerCase() && f.status !== 'FINALIZADO' && f.status !== 'CANCELADO');
  };

  const getCurrentShiftCycle = (): ShiftCycle => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 14) return 'MANHÃ';
    if (hour >= 14 && hour < 22) return 'TARDE';
    return 'NOITE';
  };

  const teamMembers = useMemo(() => {
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();

    return operators.map(p => {
      let isActive = false;
      
      if (p.shift && p.shift.start && p.shift.end) {
          const [sH, sM] = p.shift.start.split(':').map(Number);
          const [eH, eM] = p.shift.end.split(':').map(Number);
          
          const nowMins = currentHour * 60 + currentMinute;
          const startMins = sH * 60 + sM;
          const endMins = eH * 60 + eM;

          if (startMins < endMins) {
              isActive = nowMins >= startMins && nowMins <= endMins;
          } else {
              // Overnight shift
              isActive = nowMins >= startMins || nowMins <= endMins;
          }
      } else {
          // Fallback if there's no shift mapped in the operator object
          isActive = true; 
      }

      // Override status se inativo
      let finalStatus = isActive ? p.status : 'INATIVO';

      const mission = getActiveMission(p.warName);
      if (isActive) {
          if (mission) {
              finalStatus = mission.status === 'ABASTECENDO' ? 'ENCHIMENTO' : 'OCUPADO';
          } else {
              if (finalStatus === 'OCUPADO' || finalStatus === 'ENCHIMENTO') {
                  finalStatus = 'DISPONÍVEL';
              }
          }
      }

      return {
        ...p,
        status: finalStatus,
        assignedVehicle: p.assignedVehicle, // Mantendo o vínculo real
      };
    });
  }, [flights, operators]);

  // Cálculo de estatísticas globais do turno para o HUD
  const teamStats = useMemo(() => {
    const shiftOperators = activeShift === 'GERAL' 
      ? teamMembers 
      : teamMembers.filter(op => op.shift && op.shift.cycle === activeShift);
    
    return {
      patio: shiftOperators.filter(op => op.category === 'AERODROMO' || op.category === 'PLENO' || op.category === 'JUNIOR' || op.category === 'SENIOR').length,
      vip: shiftOperators.filter(op => op.category === 'VIP').length,
      ilha: shiftOperators.filter(op => op.category === 'ILHA').length,
      disponivel: shiftOperators.filter(op => op.status === 'DISPONÍVEL' && !getActiveMission(op.warName)).length,
      enchendo: shiftOperators.filter(op => op.status === 'ENCHIMENTO').length,
      designado: shiftOperators.filter(op => !!getActiveMission(op.warName) || op.status === 'OCUPADO').length,
      total: shiftOperators.length
    };
  }, [teamMembers, activeShift]);

  const filteredTeam = useMemo(() => {
    const baseList = teamMembers.filter(op => 
      (activeShift === 'GERAL' || (op.shift && op.shift.cycle === activeShift)) &&
      (op.category === activeCategory || (activeCategory === 'AERODROMO')) && // Relax strict match purely for AERODROMO meaning anything else if they are PLENO/JUNIOR
      (op.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.warName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return [...baseList].sort((a, b) => {
      const missionA = getActiveMission(a.warName);
      const missionB = getActiveMission(b.warName);
      const isAvailA = a.status === 'DISPONÍVEL' && !missionA;
      const isAvailB = b.status === 'DISPONÍVEL' && !missionB;

      if (isAvailA && !isAvailB) return -1;
      if (!isAvailA && isAvailB) return 1;
      return 0;
    });
  }, [teamMembers, activeShift, activeCategory, searchTerm]);

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 overflow-hidden font-sans">
        
        {/* TOP HUD NAV */}
        <div className="h-16 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-8 shrink-0 z-30">
            <div className="flex items-center gap-6">
                <button
                    onClick={onClose}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 font-bold uppercase tracking-wider text-xs transition-colors bg-slate-900 hover:bg-slate-800 text-slate-300"
                >
                    <ArrowLeft size={16} />
                    Voltar
                </button>
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-md border border-slate-800 shadow-inner">
                    {['AERODROMO', 'VIP', 'ILHA'].map((cat) => (
                        <button 
                            key={cat} 
                            onClick={() => setActiveCategory(cat as OperatorCategory)} 
                            className={`px-5 py-2 rounded-md text-[10px] font-black tracking-widest uppercase transition-all duration-300 ${
                                activeCategory === cat ? 'bg-emerald-500 text-slate-950 shadow-neon' : 'text-slate-600 hover:text-slate-400'
                            }`}
                        >
                            {cat === 'AERODROMO' ? 'PÁTIO' : cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-700" />
                    <input 
                        type="text" 
                        placeholder="PESQUISAR..." 
                        className="bg-slate-950 border border-slate-800 rounded-md pl-9 pr-4 py-2 text-[11px] text-white outline-none focus:border-emerald-500/50 w-56 font-bold tracking-widest transition-all" 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                    />
                </div>
                <div className="flex bg-slate-950 p-1 rounded-md border border-slate-800 gap-1 shadow-sm">
                    {(['GERAL', 'MANHÃ', 'TARDE', 'NOITE'] as ShiftCycle[]).map(cycle => (
                        <button 
                            key={cycle} 
                            onClick={() => setActiveShift(cycle)} 
                            className={`px-4 py-2 rounded-md text-[9px] font-black tracking-widest transition-all ${
                                activeShift === cycle ? 'bg-slate-800 text-emerald-400 border border-emerald-500/10' : 'text-slate-700 hover:text-slate-500'
                            }`}
                        >
                            {cycle}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        {/* TEAM TELEMETRY BAR */}
        <div className="h-16 bg-slate-950 border-b border-slate-800/40 px-8 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-10">
                {/* Localização */}
                <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Pátio</span>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-white font-mono">{teamStats.patio}</span>
                            <div className="w-1 h-1 rounded-full bg-slate-700"></div>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Vip</span>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-white font-mono">{teamStats.vip}</span>
                            <div className="w-1 h-1 rounded-full bg-slate-700"></div>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Ilha</span>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-white font-mono">{teamStats.ilha}</span>
                        </div>
                    </div>
                </div>

                <div className="h-8 w-px bg-slate-800"></div>

                {/* Status Operacional */}
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3 bg-emerald-500/5 px-4 py-1.5 rounded-md border border-emerald-500/10">
                        <div className="text-center">
                            <span className="text-[8px] font-black text-emerald-500/60 uppercase tracking-widest block mb-0.5">Disponíveis</span>
                            <span className="text-lg font-black text-emerald-500 font-mono leading-none">{teamStats.disponivel}</span>
                        </div>
                        <Users size={16} className="text-emerald-500 opacity-30" />
                    </div>
                    <div className="flex items-center gap-3 bg-yellow-500/5 px-4 py-1.5 rounded-md border border-yellow-500/10">
                        <div className="text-center">
                            <span className="text-[8px] font-black text-yellow-500/60 uppercase tracking-widest block mb-0.5">Ocupados</span>
                            <span className="text-lg font-black text-yellow-500 font-mono leading-none">{teamStats.enchendo + teamStats.designado}</span>
                        </div>
                        <Droplet size={16} className="text-yellow-500 opacity-30" />
                    </div>
                    <div className="flex items-center gap-3 bg-blue-500/5 px-4 py-1.5 rounded-md border border-blue-500/10">
                        <div className="text-center">
                            <span className="text-[8px] font-black text-blue-400/60 uppercase tracking-widest block mb-0.5">Designados</span>
                            <span className="text-lg font-black text-blue-400 font-mono leading-none">{teamStats.designado}</span>
                        </div>
                        <BusFront size={16} className="text-blue-400 opacity-30" />
                    </div>
                </div>
            </div>

            <div className="flex flex-col items-end">
                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Turno Ativo</span>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-400 font-mono">{activeShift}</span>
                    <Zap size={12} className="text-emerald-500 animate-pulse" />
                </div>
            </div>
        </div>

        {/* OPERATIONAL GRID - DISPONÍVEIS NO TOPO */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {filteredTeam.map(op => {
                        const mission = getActiveMission(op.warName);
                        // @ts-ignore
                        const flightsToday = op.stats ? Math.floor((op.stats.flightsWeekly || 0) / 6) + (mission ? 1 : 0) : 0;
                        
                        // LÓGICA DE CORES
                        const isAvailable = op.status === 'DISPONÍVEL' && !mission;
                        const isDesignated = mission && mission.status === 'DESIGNADO';
                        const isHandsOn = (mission && mission.status === 'ABASTECENDO') || op.status === 'ENCHIMENTO' || op.status === 'OCUPADO';
                        
                        let cardStyle = 'bg-slate-900 text-slate-500 border-slate-800 opacity-60'; // Inativo/Default
                        let badgeStyle = 'bg-slate-800 text-slate-500 border-slate-800';
                        let statusLabel = op.status;

                        if (isAvailable) {
                            cardStyle = 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-[0_10px_25px_rgba(16,185,129,0.2)]';
                            badgeStyle = 'bg-slate-950 text-emerald-400 border-slate-950/5';
                            statusLabel = 'DISPONÍVEL';
                        } else if (isDesignated) {
                            cardStyle = 'bg-blue-500 text-slate-950 border-blue-400 shadow-[0_10px_25px_rgba(59,130,246,0.3)]';
                            badgeStyle = 'bg-slate-950 text-blue-400 border-slate-950/5';
                            statusLabel = 'DESIGNADO';
                        } else if (isHandsOn) {
                            cardStyle = 'bg-yellow-400 text-slate-950 border-yellow-500 shadow-[0_10px_25px_rgba(250,204,21,0.3)]';
                            badgeStyle = 'bg-slate-950 text-yellow-400 border-slate-950/5';
                            statusLabel = op.status === 'ENCHIMENTO' ? 'ENCHIMENTO' : 'OCUPADO';
                        }
                        
                        return (
                            <div 
                                key={op.id}
                                className={`group relative flex items-stretch h-[90px] rounded-md border-2 transition-all duration-300 shadow-2xl overflow-hidden ${cardStyle}`}
                            >
                                {/* Foto/Ícone do Operador */}
                                <OperatorAvatar op={op} isActive={isAvailable || !!isDesignated || isHandsOn} />

                                {/* Conteúdo */}
                                <div className="flex-1 flex flex-col justify-center p-3 pl-4 min-w-0 text-left relative">
                                    
                                    {/* HUD SUPERIOR DIREITO: FROTA + CONTADOR */}
                                    <div className="absolute top-2 right-2 flex items-center gap-2">
                                        {op.assignedVehicle && (
                                            <span className={`text-xl font-mono font-black ${isAvailable || isDesignated || isHandsOn ? 'text-slate-950/60' : 'text-slate-600'}`}>
                                                {op.assignedVehicle.replace('SRV-', '').replace('CTA-', '')}
                                            </span>
                                        )}
                                        <div className={`flex items-center justify-center w-7 h-7 rounded-md font-mono font-black text-sm border shadow-sm ${
                                            isAvailable || isDesignated || isHandsOn
                                                ? 'bg-slate-950 text-white border-slate-900' 
                                                : 'bg-slate-900 text-slate-600 border-slate-800'
                                        }`}>
                                            {flightsToday}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-start mb-1 pr-16">
                                        <h3 className="font-black tracking-tighter uppercase leading-none truncate w-full text-xl">
                                            {op.warName}
                                        </h3>
                                        <span className={`text-[7px] font-black uppercase tracking-[0.3em] opacity-40 mt-1 ${isAvailable || isDesignated || isHandsOn ? 'text-slate-950' : 'text-slate-500'}`}>
                                            {op.category}
                                        </span>
                                    </div>

                                    {/* Telemetria de Solo */}
                                    <div className="flex flex-col gap-0.5">
                                        {mission ? (
                                            <div className="flex items-center gap-1.5 font-mono text-base font-black tracking-tighter truncate">
                                                <span className="opacity-70">{mission.destination}</span>
                                                <span className="opacity-20">/</span>
                                                <span>{mission.registration}</span>
                                                <span className="opacity-20">/</span>
                                                <span className="bg-slate-950/10 px-1.5 rounded-md">{mission.positionId}</span>
                                            </div>
                                        ) : (
                                            <div className={`flex items-center gap-1.5 font-mono font-black tracking-tight ${isAvailable || isHandsOn ? 'text-sm' : 'text-xs'}`}>
                                                {isHandsOn ? (
                                                    <Droplet size={14} className="shrink-0 opacity-60 animate-pulse" />
                                                ) : (
                                                    <MapPin size={isAvailable ? 12 : 10} className="shrink-0 opacity-40" />
                                                )}
                                                
                                                <span className="truncate uppercase opacity-60">
                                                    {(() => {
                                                        const currentRealShift = getCurrentShiftCycle();
                                                        const isSameShift = op.shift && op.shift.cycle === currentRealShift;
                                                        const isCurrentlyActive = op.status !== 'INATIVO';

                                                        if (!isSameShift) return op.shift ? `TURNO ${op.shift.cycle}` : 'SEM TURNO';
                                                        if (!isCurrentlyActive) return 'FOLGA';
                                                        if (op.status === 'INTERVALO') return 'INTERVALO';
                                                        return op.lastPosition || 'PÁTIO';
                                                    })()}
                                                </span>

                                                <span className={`px-1.5 rounded-[4px] font-black uppercase border text-[10px] ${badgeStyle}`}>
                                                    {(() => {
                                                        const currentRealShift = getCurrentShiftCycle();
                                                        const isSameShift = op.shift && op.shift.cycle === currentRealShift;
                                                        const isCurrentlyActive = op.status !== 'INATIVO';

                                                        if (!isSameShift) return op.shift ? op.shift.cycle : 'N/A';
                                                        if (!isCurrentlyActive) return 'FOLGA';
                                                        return statusLabel;
                                                    })()}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Decorativo Dinâmico de Avião */}
                                {mission && (
                                    <div className="absolute bottom-[-15px] right-[-15px] opacity-10 pointer-events-none rotate-12 scale-75">
                                        <Plane size={80} className="text-slate-950" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
        </div>
    </div>
  );
};
