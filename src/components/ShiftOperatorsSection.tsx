import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../contexts/ThemeContext';
import { 
    Search, ArrowLeft, Plane, MapPin, 
    Activity, Radar, User, ChevronRight, Droplet, Users, BusFront, Zap
} from 'lucide-react';
import { OperatorProfile, ShiftCycle, OperatorCategory, FlightData, Vehicle } from '../types';
import { getCurrentShift } from '../utils/shiftUtils';

import { SelectVehicleModal } from './modals/SelectVehicleModal';

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

const OperatorAvatar: React.FC<{ op: OperatorProfile, isActive: boolean, isDarkMode: boolean }> = ({ op, isActive, isDarkMode }) => {
    const [error, setError] = useState(false);
    return (
        <div className={`w-[48px] shrink-0 border-r overflow-hidden relative flex items-end justify-center ${isDarkMode ? 'border-slate-950/10 bg-slate-950/10' : 'border-slate-300/50 bg-slate-200'}`}>
            {op.photoUrl && !error ? (
                <img 
                    src={op.photoUrl} 
                    alt={op.warName} 
                    referrerPolicy="no-referrer"
                    className={`w-full h-full object-cover transition-all ${isActive ? '' : 'grayscale'}`} 
                    onError={() => setError(true)}
                />
            ) : (
                <User size={32} className={`mb-1 ${isActive ? (isDarkMode ? 'text-slate-950/25' : 'text-slate-400') : 'text-slate-400/25'}`} />
            )}
        </div>
    );
};

export const ShiftOperatorsSection: React.FC<ShiftOperatorsSectionProps> = ({ 
    onClose, operators, onUpdateOperators, flights = [], vehicles = [], onUpdateFlights
}) => {
  const { isDarkMode } = useTheme();

  const [activeShift, setActiveShift] = useState<ShiftCycle>(getCurrentShift(true) as ShiftCycle);
  const [activeCategory, setActiveCategory] = useState<OperatorCategory>('AERODROMO');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');

  const [selectedOpForVehicle, setSelectedOpForVehicle] = useState<OperatorProfile | null>(null);

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
     setPortalTarget(document.getElementById('subheader-portal-target'));
  }, []);

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

    const todayStr = new Date().toISOString().split('T')[0];

    return operators.map(p => {
      const dayEntry = p.workDays?.find(wd => wd.date === todayStr);
      const isNotWorking = dayEntry && ['FOLGA', 'AT', 'AF'].includes(dayEntry.type);
      const isOnSchedule = !isNotWorking;

      let isActive = false;
      
      if (isOnSchedule && p.shift && p.shift.start && p.shift.end && p.shift.start.includes(':') && p.shift.end.includes(':')) {
          const [sH, sM] = p.shift.start.split(':').map(Number);
          const [eH, eM] = p.shift.end.split(':').map(Number);
          
          if (!isNaN(sH) && !isNaN(sM) && !isNaN(eH) && !isNaN(eM)) {
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
              isActive = true;
          }
      } else {
          // Fallback if there's no shift mapped in the operator object
          isActive = true; 
      }

      // Preserve intentional inactive statuses even if inside shift hours
      let finalStatus = p.status;
      const inactiveStatuses = ['INATIVO', 'FOLGA', 'FÉRIAS', 'AFAST.', 'DESCONECTADO', 'FOLG.'];
      if (!isActive) {
          finalStatus = 'INATIVO';
      } else if (inactiveStatuses.includes(p.status || '')) {
          finalStatus = p.status;
          isActive = false;
      }

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
      patio: shiftOperators.filter(op => !op.patio || op.patio === 'AERODROMO' || op.patio === 'AMBOS').length,
      vip: shiftOperators.filter(op => op.patio === 'VIP' || op.patio === 'AMBOS').length,
      ilha: shiftOperators.filter(op => op.patio === 'ILHA' || op.patio === 'AMBOS').length,
      disponivel: shiftOperators.filter(op => op.status === 'DISPONÍVEL' && !getActiveMission(op.warName)).length,
      enchendo: shiftOperators.filter(op => op.status === 'ENCHIMENTO').length,
      designado: shiftOperators.filter(op => !!getActiveMission(op.warName) || op.status === 'OCUPADO').length,
      total: shiftOperators.length
    };
  }, [teamMembers, activeShift]);

  const filteredTeam = useMemo(() => {
    const baseList = teamMembers.filter(op => 
      (activeShift === 'GERAL' || (op.shift && op.shift.cycle === activeShift)) &&
      (!activeCategory || activeCategory === 'AERODROMO' || op.patio === activeCategory || op.patio === 'AMBOS') &&
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

  const handleAssignVehicle = (operatorId: string, vehicleId: string) => {
    let selectedWarName = '';
    let unassignedWarName = '';

    const updatedOps = operators.map(op => {
        if (op.id === operatorId) {
            selectedWarName = op.warName;
            return { ...op, assignedVehicle: vehicleId };
        }
        // If another operator had this vehicle, unassign it to avoid conflicts
        if (vehicleId !== '' && op.assignedVehicle === vehicleId) {
            unassignedWarName = op.warName;
            return { ...op, assignedVehicle: undefined };
        }
        return op;
    });
    
    onUpdateOperators(updatedOps);

    // Sync flights
    if (onUpdateFlights && flights) {
        let changed = false;
        const newFlights = flights.map(f => {
            if (selectedWarName && f.operator === selectedWarName) {
                changed = true;
                return { 
                    ...f, 
                    fleet: vehicleId,
                    fleetType: vehicleId?.startsWith('CTA') ? 'CTA' : vehicleId?.startsWith('SRV') ? 'SRV' : undefined
                };
            }
            if (unassignedWarName && f.operator === unassignedWarName) {
                changed = true;
                return { 
                    ...f, 
                    fleet: undefined,
                    fleetType: undefined
                };
            }
            return f;
        });
        if (changed) {
            onUpdateFlights(newFlights);
        }
    }
  };

  const headers = (
    <div className="w-full shrink-0 flex flex-col font-sans">
        {/* Line 2: TOP HUD NAV - FULLWIDTH */}
        <div className={`h-16 border-b flex items-center justify-between px-8 z-30 ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'bg-[#3CA317] border-[#29824a] text-white shadow-sm'}`}>
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onClose}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-bold uppercase tracking-wider text-xs transition-colors ${
                            isDarkMode ? 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300' : 'border-white/20 bg-black/10 hover:bg-black/20 text-white'
                        }`}
                    >
                        <ArrowLeft size={16} />
                        Voltar
                    </button>
                    
                    <button
                        onClick={() => setViewMode(viewMode === 'CARDS' ? 'TABLE' : 'CARDS')}
                        className={`px-3 py-1.5 rounded-lg border font-bold uppercase tracking-wider text-xs transition-all duration-300 ${
                            isDarkMode 
                                ? 'border-slate-700 bg-slate-900 hover:bg-slate-800 text-emerald-400' 
                                : 'border-white/20 bg-black/10 hover:bg-black/20 text-white'
                        } ${viewMode === 'TABLE' ? 'bg-emerald-500/10 border-emerald-500/30' : ''}`}
                    >
                        {viewMode === 'CARDS' ? 'Ver Tabela' : 'Ver Cards'}
                    </button>
                </div>
                <div className={`flex items-center gap-1.5 p-1 rounded-md border shadow-inner ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-black/10 border-white/10'}`}>
                    {['AERODROMO', 'VIP', 'ILHA'].map((cat) => (
                        <button 
                            key={cat} 
                            onClick={() => setActiveCategory(cat as OperatorCategory)} 
                            className={`px-5 py-2 rounded-md text-[10px] font-black tracking-widest uppercase transition-all duration-300 ${
                                activeCategory === cat 
                                    ? (isDarkMode ? 'bg-emerald-500 text-slate-950 shadow-neon' : 'bg-white text-[#2D8E48] shadow-md') 
                                    : (isDarkMode ? 'text-slate-600 hover:text-slate-400' : 'text-white/60 hover:text-white')
                            }`}
                        >
                            {cat === 'AERODROMO' ? 'PÁTIO' : cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative group">
                    <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-white/40 group-focus-within:text-white' : 'text-slate-400 group-focus-within:text-emerald-700'} transition-colors`} />
                    <input 
                        type="text" 
                        placeholder="PESQUISAR..." 
                        className={`border rounded-lg pl-9 pr-4 h-9 text-[10px] outline-none w-56 font-extrabold tracking-widest transition-all ${
                            isDarkMode ? 'bg-black/20 border-white/10 text-white placeholder:text-white/20 focus:ring-1 focus:border-emerald-500/50' : 'bg-white border-transparent text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 shadow-inner'
                        }`} 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                    />
                </div>
                <div className={`flex p-1 rounded-md border gap-1 shadow-sm ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-black/10 border-white/10'}`}>
                    {(['GERAL', 'MANHÃ', 'TARDE', 'NOITE'] as ShiftCycle[]).map(cycle => (
                        <button 
                            key={cycle} 
                            onClick={() => setActiveShift(cycle)} 
                            className={`px-4 py-2 rounded-md text-[9px] font-black tracking-widest transition-all ${
                                activeShift === cycle 
                                    ? (isDarkMode ? 'bg-slate-800 text-emerald-400 border border-emerald-500/10' : 'bg-white text-[#2D8E48] border-transparent shadow-sm') 
                                    : (isDarkMode ? 'text-slate-700 hover:text-slate-500' : 'text-white/60 hover:text-white')
                            }`}
                        >
                            {cycle}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );

  const telemetryBar = (
    <div className={`h-16 shrink-0 border-b px-8 flex items-center justify-between z-30 ${isDarkMode ? "bg-slate-950 border-slate-800/40 text-slate-200" : "bg-[#2D8E48] border-[#206a34] text-white shadow-sm"} w-full`}>
        <div className="flex items-center gap-10">
            {/* Localização */}
            <div className="flex items-center gap-6">
                <div className="flex flex-col">
                    <span className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-600' : 'text-white/60'}`}>Pátio</span>
                    <div className="flex items-center gap-2">
                        <span className={`text-xl font-black font-mono ${isDarkMode ? 'text-white' : 'text-white'}`}>{teamStats.patio}</span>
                        <div className={`w-1 h-1 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-white/30'}`}></div>
                    </div>
                </div>
                <div className="flex flex-col">
                    <span className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-600' : 'text-white/60'}`}>Vip</span>
                    <div className="flex items-center gap-2">
                        <span className={`text-xl font-black font-mono ${isDarkMode ? 'text-white' : 'text-white'}`}>{teamStats.vip}</span>
                        <div className={`w-1 h-1 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-white/30'}`}></div>
                    </div>
                </div>
                <div className="flex flex-col">
                    <span className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-600' : 'text-white/60'}`}>Ilha</span>
                    <div className="flex items-center gap-2">
                        <span className={`text-xl font-black font-mono ${isDarkMode ? 'text-white' : 'text-white'}`}>{teamStats.ilha}</span>
                    </div>
                </div>
            </div>

            <div className={`h-8 w-px ${isDarkMode ? 'bg-slate-800' : 'bg-white/20'}`}></div>

            {/* Status Operacional */}
            <div className="flex items-center gap-8">
                <div className={`flex items-center gap-3 px-4 py-1.5 rounded-md border ${isDarkMode ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-white/10 border-white/20'}`}>
                    <div className="text-center">
                        <span className={`text-[8px] font-black uppercase tracking-widest block mb-0.5 ${isDarkMode ? 'text-emerald-500/60' : 'text-emerald-100'}`}>Disponíveis</span>
                        <span className={`text-lg font-black font-mono leading-none ${isDarkMode ? 'text-emerald-500' : 'text-emerald-300'}`}>{teamStats.disponivel}</span>
                    </div>
                    <Users size={16} className={`${isDarkMode ? 'text-emerald-500 opacity-30' : 'text-white opacity-60'}`} />
                </div>
                <div className={`flex items-center gap-3 px-4 py-1.5 rounded-md border ${isDarkMode ? 'bg-yellow-500/5 border-yellow-500/10' : 'bg-white/10 border-white/20'}`}>
                    <div className="text-center">
                        <span className={`text-[8px] font-black uppercase tracking-widest block mb-0.5 ${isDarkMode ? 'text-yellow-500/60' : 'text-yellow-100'}`}>Ocupados</span>
                        <span className={`text-lg font-black font-mono leading-none ${isDarkMode ? 'text-yellow-500' : 'text-yellow-300'}`}>{teamStats.enchendo + teamStats.designado}</span>
                    </div>
                    <Droplet size={16} className={`${isDarkMode ? 'text-yellow-500 opacity-30' : 'text-white opacity-60'}`} />
                </div>
                <div className={`flex items-center gap-3 px-4 py-1.5 rounded-md border ${isDarkMode ? 'bg-blue-500/5 border-blue-500/10' : 'bg-white/10 border-white/20'}`}>
                    <div className="text-center">
                        <span className={`text-[8px] font-black uppercase tracking-widest block mb-0.5 ${isDarkMode ? 'text-blue-400/60' : 'text-blue-100'}`}>Designados</span>
                        <span className={`text-lg font-black font-mono leading-none ${isDarkMode ? 'text-blue-400' : 'text-blue-300'}`}>{teamStats.designado}</span>
                    </div>
                    <BusFront size={16} className={`${isDarkMode ? 'text-blue-400 opacity-30' : 'text-white opacity-60'}`} />
                </div>
            </div>
        </div>

        <div className="flex flex-col items-end">
            <span className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-600' : 'text-white/60'}`}>Turno Ativo</span>
            <div className="flex items-center gap-2">
                <span className={`text-xs font-black font-mono ${isDarkMode ? 'text-slate-400' : 'text-white'}`}>{activeShift}</span>
            </div>
        </div>
    </div>
  );

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden font-sans ${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-200 text-slate-800'}`}>
        {portalTarget ? createPortal(headers, portalTarget) : headers}
        
        {telemetryBar}

        {/* OPERATIONAL GRID - DISPONÍVEIS NO TOPO */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
            {viewMode === 'CARDS' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {filteredTeam.map(op => {
                            const mission = getActiveMission(op.warName);
                            // @ts-ignore
                            const flightsToday = op.stats ? Math.floor((op.stats.flightsWeekly || 0) / 6) + (mission ? 1 : 0) : 0;
                            
                            // LÓGICA DE CORES
                            const isAvailable = op.status === 'DISPONÍVEL' && !mission;
                            const isDesignated = mission && mission.status === 'DESIGNADO';
                            const isHandsOn = (mission && mission.status === 'ABASTECENDO') || op.status === 'ENCHIMENTO' || op.status === 'OCUPADO';
                            
                            let cardStyle = isDarkMode ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-white text-slate-700 border-slate-300 shadow-sm'; // Inativo/Default
                            let badgeStyle = isDarkMode ? 'bg-slate-900 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200';
                            let statusLabel = op.status;

                            if (isAvailable) {
                                cardStyle = isDarkMode ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-[0_10px_25px_rgba(16,185,129,0.2)]' : 'bg-emerald-600 text-white border-emerald-600 shadow-md';
                                badgeStyle = isDarkMode ? 'bg-slate-950 text-emerald-400 border-slate-950/5' : 'bg-emerald-800 text-white border-transparent';
                                statusLabel = 'DISPONÍVEL';
                            } else if (isDesignated) {
                                cardStyle = isDarkMode ? 'bg-blue-500 text-slate-950 border-blue-400 shadow-[0_10px_25px_rgba(59,130,246,0.3)]' : 'bg-blue-700 text-white border-blue-700 shadow-md';
                                badgeStyle = isDarkMode ? 'bg-slate-950 text-blue-400 border-slate-950/5' : 'bg-blue-900 text-white border-transparent';
                                statusLabel = 'DESIGNADO';
                            } else if (isHandsOn) {
                                cardStyle = isDarkMode ? 'bg-yellow-400 text-slate-950 border-yellow-500 shadow-[0_10px_25px_rgba(250,204,21,0.3)]' : 'bg-amber-500 text-slate-900 border-amber-600 shadow-md';
                                badgeStyle = isDarkMode ? 'bg-slate-950 text-yellow-500 border-slate-950/5' : 'bg-amber-700 text-white border-transparent';
                                statusLabel = op.status === 'ENCHIMENTO' ? 'ENCHIMENTO' : 'OCUPADO';
                            }
                            
                            // Determinar se o operador está em algum estado inativo para aplicar uma opacidade condicional no card inteiro (se desejado, ou não colocar para evitar que fique 'opaco')
                            const isInactive = ['INATIVO', 'FOLGA', 'INTERVALO', 'FÉRIAS', 'AFAST.', 'DESCONECTADO', 'FOLG.'].includes(op.status || '');

                            return (
                                <div 
                                    key={op.id}
                                    className={`group relative flex items-stretch h-[68px] rounded-md border transition-all duration-300 overflow-hidden ${cardStyle} ${isInactive ? 'opacity-70 grayscale-[30%]' : ''}`}
                                >
                                    {/* Foto/Ícone do Operador */}
                                    <OperatorAvatar op={op} isActive={!isInactive} isDarkMode={isDarkMode} />

                                    {/* Conteúdo */}
                                    <div className="flex-1 flex flex-col justify-center px-2 min-w-0 text-left relative">
                                        
                                        {/* HUD SUPERIOR DIREITO: FROTA + CONTADOR */}
                                        <div className="absolute top-1.5 right-1.5 flex items-center gap-1.5">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setSelectedOpForVehicle(op); }}
                                                className={`flex items-center justify-center font-mono font-black transition-colors rounded px-1.5 py-0.5 border ${
                                                    op.assignedVehicle
                                                        ? isAvailable || isDesignated || isHandsOn
                                                            ? isDarkMode ? 'bg-slate-950/20 text-slate-950/80 border-slate-950/20 hover:bg-slate-950/40' : 'bg-white/20 text-white border-white/20 hover:bg-white/40'
                                                            : isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                                        : isAvailable || isDesignated || isHandsOn
                                                            ? isDarkMode ? 'bg-slate-950/10 text-slate-950/50 border-slate-950/20 hover:bg-slate-950/30 text-[9px]' : 'bg-white/10 text-white/60 border-white/20 hover:bg-white/30 text-[9px]'
                                                            : isDarkMode ? 'bg-slate-900 text-slate-600 border-slate-800 hover:bg-slate-800 hover:text-slate-400 text-[9px]' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600 text-[9px]'
                                                } ${op.assignedVehicle ? 'text-sm min-w-[32px]' : 'text-[9px] uppercase min-w-[32px]'}`}
                                            >
                                                {op.assignedVehicle ? op.assignedVehicle.replace('SRV-', '').replace('CTA-', '') : '+'}
                                            </button>
                                            <div className={`flex items-center justify-center w-5 h-5 rounded-sm font-mono font-black text-[10px] border shadow-sm ${
                                                isAvailable || isDesignated || isHandsOn
                                                    ? (isDarkMode ? 'bg-slate-950 text-white border-slate-900' : 'bg-white/20 text-white border-white/10')
                                                    : (isDarkMode ? 'bg-slate-900 text-slate-600 border-slate-800' : 'bg-white text-slate-400 border-slate-200')
                                            }`}>
                                                {flightsToday}
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-start pr-[38px] mt-0.5">
                                            <h3 className={`font-black tracking-tighter uppercase leading-none truncate w-full text-base ${!isAvailable && !isDesignated && !isHandsOn && !isDarkMode ? 'text-slate-800' : ''}`}>
                                                {op.warName}
                                            </h3>
                                            <span className={`text-[8px] font-black uppercase tracking-[0.1em] opacity-70 mt-1 ${isAvailable || isDesignated || isHandsOn ? (isDarkMode ? 'text-slate-950' : 'text-white') : (isDarkMode ? 'text-slate-500' : 'text-slate-500')}`}>
                                                {op.role || op.category}
                                            </span>
                                        </div>

                                        {/* Telemetria de Solo */}
                                        <div className={`flex flex-col mt-0.5 ${!isAvailable && !isDesignated && !isHandsOn && !isDarkMode ? 'text-slate-600' : ''}`}>
                                            {mission ? (
                                                <div className="flex items-center gap-1 font-mono text-xs font-black tracking-tighter truncate">
                                                    <span className="opacity-90">{mission.destination}</span>
                                                    <span className="opacity-40">•</span>
                                                    <span className="opacity-90">{mission.registration}</span>
                                                    <span className="opacity-40">•</span>
                                                    <span className={`px-1 rounded ${isDarkMode ? 'bg-slate-950/20' : 'bg-black/10'}`}>{mission.positionId}</span>
                                                </div>
                                            ) : (
                                                <div className={`flex items-center gap-1 font-mono font-black tracking-tight ${isAvailable || isHandsOn ? 'text-[11px]' : 'text-[9px]'}`}>
                                                    {isHandsOn ? (
                                                        <Droplet size={12} className="shrink-0 opacity-80 animate-pulse" />
                                                    ) : (
                                                        <MapPin size={isAvailable ? 10 : 8} className="shrink-0 opacity-60" />
                                                    )}
                                                    
                                                    <span className="truncate uppercase opacity-60">
                                                        {(() => {
                                                            if (op.status === 'INATIVO') return 'FORA';
                                                            if (op.status === 'INTERVALO') return 'PAUSA';
                                                            return op.lastPosition || 'PÁTIO';
                                                        })()}
                                                    </span>

                                                    <span className={`px-1 rounded-sm font-black uppercase border text-[8px] whitespace-nowrap ${badgeStyle}`}>
                                                        {(() => {
                                                            if (op.status === 'INATIVO') return op.shift?.cycle || 'N/A';
                                                            return statusLabel;
                                                        })()}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Decorativo Dinâmico de Avião */}
                                    {mission && (
                                        <div className={`absolute bottom-[-10px] right-[-10px] opacity-10 pointer-events-none rotate-12 scale-50 ${isDarkMode ? 'text-slate-950' : 'text-white'}`}>
                                            < Plane size={60} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
            ) : (
                <div className={`w-full overflow-hidden rounded-lg border animate-in fade-in zoom-in-95 duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className={`${isDarkMode ? 'bg-slate-950 text-slate-500' : 'bg-slate-50 text-slate-500'} border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Operador</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Guerra</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Categoria</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Frota</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Status</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest">Missão Atual</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-right">Voos Hoje</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {filteredTeam.map(op => {
                                const mission = getActiveMission(op.warName);
                                // @ts-ignore
                                const flightsToday = op.stats ? Math.floor((op.stats.flightsWeekly || 0) / 6) + (mission ? 1 : 0) : 0;
                                const isInactive = ['INATIVO', 'FOLGA', 'INTERVALO', 'FÉRIAS', 'AFAST.', 'DESCONECTADO', 'FOLG.'].includes(op.status || '');
                                
                                return (
                                    <tr 
                                        key={op.id} 
                                        className={`hover:bg-slate-500/5 transition-colors ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} ${isInactive ? 'opacity-60' : ''}`}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 border dark:border-slate-700 flex items-center justify-center">
                                                    {op.photoUrl ? (
                                                        <img src={op.photoUrl} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <User size={16} className="opacity-30" />
                                                    )}
                                                </div>
                                                <span className="text-xs font-bold uppercase tracking-tight">{op.fullName}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm font-black uppercase tracking-tighter text-emerald-500">{op.warName}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border dark:border-slate-700">
                                                {op.role || op.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-mono font-black">
                                            <button 
                                                onClick={() => setSelectedOpForVehicle(op)}
                                                className={`flex items-center justify-center min-w-[36px] px-2 py-1 rounded border transition-colors uppercase ${
                                                    op.assignedVehicle 
                                                        ? isDarkMode 
                                                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20' 
                                                            : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                                                        : isDarkMode 
                                                            ? 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700 hover:text-slate-300 text-[10px]' 
                                                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 hover:text-slate-700 text-[10px]'
                                                }`}
                                            >
                                                {op.assignedVehicle ? op.assignedVehicle.replace('SRV-', '').replace('CTA-', '') : 'Vincular'}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${
                                                    op.status === 'DISPONÍVEL' && !mission ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                                                    mission ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' :
                                                    'bg-slate-400'
                                                }`} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">
                                                    {mission ? (mission.status === 'ABASTECENDO' ? 'ENCHIMENTO' : 'DESIGNADO') : op.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {mission ? (
                                                <div className="flex items-center gap-2 font-mono text-[11px] font-black bg-blue-500/10 text-blue-500 px-3 py-1 rounded border border-blue-500/20">
                                                    <Plane size={12} />
                                                    {mission.departureFlightNumber} • {mission.registration} • {mission.positionId}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">---</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-mono font-black text-emerald-500">
                                            {flightsToday}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>

        <SelectVehicleModal
            isOpen={selectedOpForVehicle !== null}
            onClose={() => setSelectedOpForVehicle(null)}
            operator={selectedOpForVehicle}
            vehicles={vehicles}
            operators={operators}
            onAssignVehicle={handleAssignVehicle}
        />
    </div>
  );
};
