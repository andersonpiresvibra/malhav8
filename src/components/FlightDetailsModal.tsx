import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, useDragControls } from 'motion/react';
import { FlightData, FlightLog, OperatorProfile, Vehicle, FlightStatus } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { 
  Plane, X, MapPin, Clock, Hash, BusFront, Droplet, 
  UserPlus, RefreshCw, Pen, Anchor, Calendar, Tag, Activity, Users, AlertCircle, Globe, GripHorizontal,
  MessageCircle, UserCheck, Plus, FileText, History, PlaneTakeoff, CheckCircle, ChevronRight
} from 'lucide-react';

const ICAO_CITIES: Record<string, string> = {
  'SBGL': 'GALEÃO',
  'SBGR': 'GUARULHOS',
  'SBSP': 'CONGONHAS',
  'SBRJ': 'ST. DUMONT',
  'SBKP': 'VIRACOPOS',
  'SBNT': 'NATAL',
  'SBSV': 'SALVADOR',
  'SBPA': 'PTO ALEGRE',
  'SBCT': 'CURITIBA',
  'LPPT': 'LISBOA',
  'EDDF': 'FRANKFURT',
  'LIRF': 'FIUMICINO',
  'KMIA': 'MIAMI',
  'KATL': 'ATLANTA',
  'MPTO': 'TOCUMEN',
  'SCEL': 'SANTIAGO',
  'SUMU': 'MONTEVIDÉU',
  'SAEZ': 'EZEIZA',
};

interface FlightDetailsModalProps {
  flight: FlightData;
  onClose: () => void;
  onUpdate: (updatedFlight: FlightData) => void;
  vehicles: Vehicle[];
  operators: OperatorProfile[];
  onOpenAssignSupport?: (flight: FlightData) => void;
  initialTab?: 'DADOS' | 'RELATÓRIO';
}

export const FlightDetailsModal: React.FC<FlightDetailsModalProps> = ({ 
  flight, 
  onClose, 
  onUpdate, 
  vehicles, 
  operators, 
  onOpenAssignSupport, 
  initialTab 
}) => {
  const { isDarkMode } = useTheme();
  const [localFlight, setLocalFlight] = useState<FlightData>(flight);
  
  // Tabs: 'DADOS' | 'TIMELINE'
  const [activeTab, setActiveTab] = useState<'DADOS' | 'TIMELINE'>(
    initialTab === 'RELATÓRIO' ? 'TIMELINE' : 'DADOS'
  );

  // Framer Motion Drag Control
  const dragControls = useDragControls();
  const modalRef = useRef<HTMLDivElement>(null);

  // Editing States
  const [isEditingDest, setIsEditingDest] = useState(false);
  const [destInput, setDestInput] = useState(flight.destination);

  const [isEditingReg, setIsEditingReg] = useState(false);
  const [regInput, setRegInput] = useState(flight.registration);

  const [isEditingPos, setIsEditingPos] = useState(false);
  const [posInput, setPosInput] = useState(flight.positionId);
  
  const [isEditingEtd, setIsEditingEtd] = useState(false);
  const [etdInput, setEtdInput] = useState(flight.etd); 

  const [isEditingDepFlight, setIsEditingDepFlight] = useState(false);
  const [depFlightInput, setDepFlightInput] = useState(flight.departureFlightNumber || '');

  const [isEditingChock, setIsEditingChock] = useState(false);
  const [chockInput, setChockInput] = useState(flight.actualArrivalTime || ''); 

  // Reactive Countdown Time remaining & delay
  const [timeRemaining, setTimeRemaining] = useState<string>('--m');
  const [timeDelay, setTimeDelay] = useState<string>('--m');

  useEffect(() => {
    const updateTime = () => {
      if (!localFlight.etd) {
        setTimeRemaining('--m');
        setTimeDelay('--m');
        return;
      }
      
      const now = new Date();
      const [h, m] = localFlight.etd.split(':').map(Number);
      const target = new Date();
      target.setHours(h, m, 0, 0);
      
      let diffMs = target.getTime() - now.getTime();
      
      // Handle overnight wrap around dynamically
      if (diffMs < -12 * 60 * 60 * 1000) {
        diffMs += 24 * 60 * 60 * 1000;
      } else if (diffMs > 12 * 60 * 60 * 1000) {
        diffMs -= 24 * 60 * 60 * 1000;
      }

      const diffMinsTotal = Math.floor(diffMs / 60000);
      
      if (diffMinsTotal >= 0) {
        const hours = Math.floor(diffMinsTotal / 60);
        const mins = diffMinsTotal % 60;
        if (hours > 0) {
          setTimeRemaining(`${hours}h${mins.toString().padStart(2, '0')}m`);
        } else {
          setTimeRemaining(`${mins}m`);
        }
        setTimeDelay('--m');
      } else {
        setTimeRemaining('0m');
        const absMins = Math.abs(diffMinsTotal);
        const hours = Math.floor(absMins / 60);
        const mins = absMins % 60;
        if (hours > 0) {
          setTimeDelay(`${hours}h${mins.toString().padStart(2, '0')}m`);
        } else {
          setTimeDelay(`${mins}m`);
        }
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, [localFlight.etd]);

  // Synchronize internal state with parent prop changes
  useEffect(() => {
    setLocalFlight(flight);
    setDestInput(flight.destination);
    setRegInput(flight.registration);
    setPosInput(flight.positionId);
    setEtdInput(flight.etd);
    setDepFlightInput(flight.departureFlightNumber || '');
    setChockInput(flight.actualArrivalTime || '');
  }, [flight]);

  // Handle global Enter to quickly save and complete work
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Enter') {
        if (document.activeElement?.tagName === 'INPUT') return;
        onUpdate(localFlight);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [localFlight, onUpdate, onClose]);

  // Audit Logs Generator
  const generateAuditLog = (field: string, oldValue: string | number | undefined, newValue: string | number | undefined): FlightLog => ({
    id: Date.now().toString(),
    timestamp: new Date(),
    type: 'MANUAL',
    message: `${field} alterado: ${oldValue || '--'} > ${newValue || '--'}`,
    author: 'GESTOR_MESA'
  });

  const handleSaveDest = () => {
    const formatted = destInput.toUpperCase().slice(0, 4);
    if (formatted === localFlight.destination) { setIsEditingDest(false); return; }

    const newLog = generateAuditLog('Destino', localFlight.destination, formatted);
    const updated = { 
      ...localFlight, 
      destination: formatted,
      logs: [...(localFlight.logs || []), newLog]
    };
    
    setLocalFlight(updated);
    onUpdate(updated);
    setIsEditingDest(false);
  };

  const handleSaveDepFlight = () => {
    const formatted = depFlightInput.toUpperCase();
    if (formatted === localFlight.departureFlightNumber) { setIsEditingDepFlight(false); return; }

    const newLog = generateAuditLog('Nº Voo (Saída)', localFlight.departureFlightNumber || '--', formatted);
    const updated = { 
      ...localFlight, 
      departureFlightNumber: formatted,
      logs: [...(localFlight.logs || []), newLog]
    };
    
    setLocalFlight(updated);
    onUpdate(updated);
    setIsEditingDepFlight(false);
  };

  const handleSaveReg = () => {
    if (regInput === localFlight.registration) { setIsEditingReg(false); return; }

    const newLog = generateAuditLog('Prefixo', localFlight.registration, regInput);
    const updated = { 
      ...localFlight, 
      registration: regInput,
      logs: [...(localFlight.logs || []), newLog]
    };

    setLocalFlight(updated);
    onUpdate(updated);
    setIsEditingReg(false);
  };

  const handleSavePos = () => {
    if (posInput === localFlight.positionId) { setIsEditingPos(false); return; }

    const newLog = generateAuditLog('Posição', localFlight.positionId, posInput);
    const updated = {
      ...localFlight,
      positionId: posInput,
      logs: [...(localFlight.logs || []), newLog]
    };

    setLocalFlight(updated);
    onUpdate(updated);
    setIsEditingPos(false);
  };

  const handleSaveEtd = () => {
    if (etdInput === localFlight.etd) { setIsEditingEtd(false); return; }

    const newLog = generateAuditLog('ETD', localFlight.etd, etdInput);
    const updated = { 
      ...localFlight, 
      etd: etdInput,
      logs: [...(localFlight.logs || []), newLog]
    };

    setLocalFlight(updated);
    onUpdate(updated);
    setIsEditingEtd(false);
  };

  const handleSaveChock = () => {
    if (chockInput === localFlight.actualArrivalTime) { setIsEditingChock(false); return; }

    const newLog = generateAuditLog('Calço', localFlight.actualArrivalTime || '--', chockInput);
    const updated = { 
      ...localFlight, 
      actualArrivalTime: chockInput,
      logs: [...(localFlight.logs || []), newLog]
    };

    setLocalFlight(updated);
    onUpdate(updated);
    setIsEditingChock(false);
  };

  const isFinished = localFlight.status === FlightStatus.FINALIZADO || localFlight.status === FlightStatus.CANCELADO;

  const getLogIcon = (log: FlightLog) => {
    const msg = log.message.toLowerCase();
    if (msg.includes('abastecendo') || msg.includes('iniciado')) return <Droplet size={10} />;
    if (msg.includes('designado') || msg.includes('operador')) return <UserPlus size={10} />;
    if (msg.includes('finalizado') || msg.includes('sucesso') || msg.includes('concluido')) return <CheckCircle size={10} />;
    if (log.type === 'ALERTA' || log.type === 'ATRASO') return <AlertCircle size={10} />;
    if (log.type === 'OBSERVACAO' || msg.includes('obs')) return <MessageCircle size={10} />;
    if (msg.includes('fila') || msg.includes('prioridade')) return <Clock size={10} />;
    if (msg.includes('calço')) return <Anchor size={10} />;
    return <Activity size={10} />;
  };

  const getLogColor = (log: FlightLog, isFirst: boolean) => {
    const msg = log.message.toLowerCase();
    if (log.type === 'ATRASO' || log.type === 'ALERTA' || msg.includes('cancelado')) {
      return isFirst ? 'bg-rose-500 text-white' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20';
    }
    if (msg.includes('finalizado') || msg.includes('sucesso') || msg.includes('concluído')) {
      return isFirst ? 'bg-emerald-500 text-white shadow-neon' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
    }
    if (msg.includes('abastecendo') || msg.includes('iniciado')) {
      return isFirst ? 'bg-blue-500 text-white' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
    }
    if (msg.includes('designado') || msg.includes('operador')) {
      return isFirst ? 'bg-indigo-500 text-white' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
    }
    if (msg.includes('fila') || msg.includes('aguardando')) {
      return isFirst ? 'bg-amber-500 text-slate-950' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
    }
    return isFirst 
      ? (isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700') 
      : (isDarkMode ? 'bg-slate-800/40 text-slate-400 border border-slate-800' : 'bg-slate-100 text-slate-500 border border-slate-200');
  };

  type AugmentedLog = FlightLog & {
    progress?: number;
    timelineType?: 'A_CAMINHO' | 'ACOPLANDO' | 'ACOPLADO';
  };

  const computeTimelineLogs = (): AugmentedLog[] => {
    let logs: AugmentedLog[] = [...(localFlight.logs || [])];
    
    if (localFlight.designationTime && localFlight.operator) {
      const desigTime = new Date(localFlight.designationTime).getTime();
      const now = Date.now();
      const elapsedMin = (now - desigTime) / 60000;
      
      const hasPosition = localFlight.positionId && localFlight.positionId !== '?' && localFlight.positionId.trim() !== '';
      
      if (hasPosition) {
        const isFinishedOrAbast = localFlight.status === FlightStatus.FINALIZADO || localFlight.status === FlightStatus.CANCELADO || localFlight.status === 'ABASTECENDO';
        
        // A CAMINHO
        let aCaminhoProgress = 100;
        if (!isFinishedOrAbast && elapsedMin < 5) aCaminhoProgress = Math.max(5, (elapsedMin / 5) * 100);
        
        if (!logs.some(l => l.id === 'synth-a-caminho')) {
          logs.push({
            id: 'synth-a-caminho',
            timestamp: localFlight.designationTime ? new Date(localFlight.designationTime) : new Date(),
            message: `Operador a caminho da posição ${localFlight.positionId} (ETA 5m)`,
            type: 'SISTEMA',
            author: 'SISTEMA',
            progress: aCaminhoProgress,
            timelineType: 'A_CAMINHO'
          });
        }

        // ACOPLANDO
        if (elapsedMin >= 5 || isFinishedOrAbast) {
          let acoplandoProgress = 100;
          if (!isFinishedOrAbast && elapsedMin >= 5 && elapsedMin < 10) acoplandoProgress = Math.max(5, ((elapsedMin - 5) / 5) * 100);
          
          const tsAcoplando = localFlight.designationTime 
            ? new Date(new Date(localFlight.designationTime).getTime() + 5 * 60000)
            : new Date();

          if (!logs.some(l => l.id === 'synth-acoplando')) {
            logs.push({
              id: 'synth-acoplando',
              timestamp: tsAcoplando,
              message: `Acoplando equipamentos e aterramento`,
              type: 'SISTEMA',
              author: 'SISTEMA',
              progress: acoplandoProgress,
              timelineType: 'ACOPLANDO'
            });
          }
        }

        // ACOPLADO
        if (elapsedMin >= 10 || isFinishedOrAbast) {
          const tsAcoplado = localFlight.designationTime 
            ? new Date(new Date(localFlight.designationTime).getTime() + 10 * 60000)
            : new Date();

          if (!logs.some(l => l.id === 'synth-acoplado')) {
            logs.push({
              id: 'synth-acoplado',
              timestamp: tsAcoplado,
              message: `Equipamento acoplado e pronto`,
              type: 'SISTEMA',
              author: 'SISTEMA',
              progress: 100,
              timelineType: 'ACOPLADO'
            });
          }
        }
      }
    }
    
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const timelineLogs = computeTimelineLogs();

  return createPortal(
    <div className="fixed inset-0 pointer-events-none z-[9990] flex items-center justify-center">
      <motion.div 
        ref={modalRef}
        drag
        dragListener={false}
        dragControls={dragControls}
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`pointer-events-auto w-[420px] rounded-xl overflow-hidden flex flex-col shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] border ${
          isDarkMode 
            ? 'bg-slate-950/95 border-emerald-500/30' 
            : 'bg-white/95 border-slate-200'
        } backdrop-blur-xl select-none`}
      >
        {/* HEADER FLUTUANTE & DRAGGABLE */}
        <div 
          onPointerDown={(e) => dragControls.start(e)}
          className={`px-4 py-3 cursor-grab active:cursor-grabbing flex justify-between items-center border-b transition-colors select-none ${
            isDarkMode 
              ? 'bg-slate-950/60 border-slate-800' 
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {/* Grip handle indicator */}
            <GripHorizontal size={14} className={`${isDarkMode ? 'text-slate-600' : 'text-slate-400'} shrink-0`} />
            
            <div className="w-9 h-9 flex items-center justify-center bg-white rounded-md shadow-inner p-1">
              <img 
                src={
                  (localFlight.airlineCode === 'RG' || localFlight.airlineCode === 'G3') 
                  ? 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Gol_Linhas_A%C3%A9reas_logo.svg/320px-Gol_Linhas_A%C3%A9reas_logo.svg.png'
                  : `https://images.kiwi.com/airlines/64/${localFlight.airlineCode || 'G3'}.png`
                }
                alt={localFlight.airline}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
                referrerPolicy="no-referrer"
              />
            </div>
            
            <div className="flex flex-col justify-center">
              <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${isDarkMode ? 'text-emerald-500/80' : 'text-slate-500'}`}>
                {localFlight.airline}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-lg font-black font-mono leading-none tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {localFlight.flightNumber}
                </span>
                <span className={`text-[10px] font-bold font-mono px-1 py-0.2 rounded border ${
                  isDarkMode 
                    ? 'bg-slate-900 border-slate-800 text-slate-400' 
                    : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}>
                  GOL/RG ICAO
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-sm font-black text-emerald-500 font-mono tracking-wider leading-none">
                {localFlight.registration || '--'}
              </span>
              <span className={`text-[7px] font-black uppercase tracking-widest mt-1 leading-none ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                PREFIXO
              </span>
            </div>
            
            <button 
              onClick={onClose}
              className={`w-7 h-7 flex items-center justify-center rounded-full transition-all ${
                isDarkMode ? 'bg-slate-900/40 hover:bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-200/50 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS COMPACT */}
        <div className={`flex border-b text-center pointer-events-auto ${
          isDarkMode ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-50/50 border-slate-200'
        }`}>
          <button 
            type="button"
            onClick={() => setActiveTab('DADOS')}
            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'DADOS' 
                ? (isDarkMode ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-900/30' : 'text-emerald-600 border-b-2 border-emerald-500 bg-white') 
                : (isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')
            }`}
          >
            Informações
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('TIMELINE')}
            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'TIMELINE' 
                ? (isDarkMode ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-900/30' : 'text-emerald-600 border-b-2 border-emerald-500 bg-white') 
                : (isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')
            }`}
          >
            Rastreio / Logs
          </button>
        </div>

        {/* CONTAINER CORPO */}
        <div className={`p-4 max-h-[480px] overflow-y-auto ${isDarkMode ? 'bg-slate-950/20' : 'bg-white'}`}>
          {activeTab === 'DADOS' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className={`text-[8px] font-black uppercase tracking-widest ${isDarkMode ? 'text-emerald-500/80' : 'text-emerald-700'}`}>
                  DADOS OPERACIONAIS DO FLUXO
                </h3>
                <div className={`h-px flex-1 ${isDarkMode ? 'bg-slate-850' : 'bg-slate-100'}`} />
              </div>

              {/* GRID MULTICOLUNAS DE OPERAÇÕES */}
              <div className="grid grid-cols-3 gap-x-3 gap-y-3.5">
                {/* Nº Voo (Saída) */}
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <PlaneTakeoff size={10} className="opacity-70" /> VOO SAÍDA
                  </span>
                  
                  {isEditingDepFlight ? (
                    <div className="flex items-center gap-1">
                      <input 
                        value={depFlightInput}
                        onChange={(e) => setDepFlightInput(e.target.value)}
                        onBlur={handleSaveDepFlight}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDepFlight(); if (e.key === 'Escape') setIsEditingDepFlight(false); }}
                        className="w-full font-mono bg-slate-100 dark:bg-slate-900 border border-emerald-500 text-slate-900 dark:text-slate-100 font-bold px-1.5 py-0.5 rounded text-xs text-center outline-none"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div 
                      onClick={() => { setDepFlightInput(localFlight.departureFlightNumber || ''); setIsEditingDepFlight(true); }}
                      className="cursor-pointer font-mono bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all font-bold px-2 py-0.5 rounded text-xs text-center shadow-sm"
                    >
                      {localFlight.departureFlightNumber || '--'}
                    </div>
                  )}
                </div>

                {/* DESTINO */}
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Globe size={10} className="opacity-70" /> DESTINO
                  </span>
                  
                  {isEditingDest ? (
                    <div className="flex items-center gap-1">
                      <input 
                        value={destInput} 
                        onChange={(e) => setDestInput(e.target.value)} 
                        onBlur={handleSaveDest}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDest(); if (e.key === 'Escape') setIsEditingDest(false); }}
                        className="w-full font-mono bg-slate-100 dark:bg-slate-900 border border-emerald-500 text-slate-900 dark:text-slate-100 font-bold px-1.5 py-0.5 rounded text-xs text-center outline-none"
                        maxLength={4}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div 
                      onClick={() => { setDestInput(localFlight.destination); setIsEditingDest(true); }}
                      className="cursor-pointer font-mono bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all font-bold px-2 py-0.5 rounded text-xs text-center shadow-sm"
                    >
                      {localFlight.destination || '--'}
                    </div>
                  )}
                </div>

                {/* CIDADE */}
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <MapPin size={10} className="opacity-70" /> CIDADE
                  </span>
                  <div className="font-mono bg-slate-100/40 dark:bg-slate-900/20 border border-slate-200/50 dark:border-slate-800/50 text-slate-500 dark:text-slate-400 font-bold px-2 py-0.5 rounded text-xs text-center shadow-none uppercase truncate">
                    {localFlight.destination ? (ICAO_CITIES[localFlight.destination] || 'EXTERIOR') : '--'}
                  </div>
                </div>

                {/* PREFIXO */}
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Hash size={10} className="opacity-70" /> PREFIXO
                  </span>
                  
                  {isEditingReg ? (
                    <div className="flex items-center gap-1">
                      <input 
                        value={regInput} 
                        onChange={(e) => setRegInput(e.target.value)} 
                        onBlur={handleSaveReg}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveReg(); if (e.key === 'Escape') setIsEditingReg(false); }}
                        className="w-full font-mono bg-slate-100 dark:bg-slate-900 border border-emerald-500 text-slate-900 dark:text-slate-100 font-bold px-1.5 py-0.5 rounded text-xs text-center outline-none"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div 
                      onClick={() => { setRegInput(localFlight.registration); setIsEditingReg(true); }}
                      className="cursor-pointer font-mono bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all font-bold px-2 py-0.5 rounded text-xs text-center shadow-sm"
                    >
                      {localFlight.registration || '--'}
                    </div>
                  )}
                </div>

                {/* POSIÇÃO */}
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <MapPin size={10} className="opacity-70" /> POSIÇÃO
                  </span>
                  
                  {isEditingPos ? (
                    <div className="flex items-center gap-1">
                      <input 
                        value={posInput} 
                        onChange={(e) => setPosInput(e.target.value)} 
                        onBlur={handleSavePos}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSavePos(); if (e.key === 'Escape') setIsEditingPos(false); }}
                        className="w-full font-mono bg-slate-100 dark:bg-slate-900 border border-emerald-500 text-slate-900 dark:text-slate-100 font-bold px-1.5 py-0.5 rounded text-xs text-center outline-none"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div 
                      onClick={() => { setPosInput(localFlight.positionId); setIsEditingPos(true); }}
                      className={`cursor-pointer font-mono border hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all font-bold px-2 py-0.5 rounded text-xs text-center shadow-sm ${
                        localFlight.positionType === 'CTA' 
                          ? 'bg-amber-500/10 border-amber-550/30 text-amber-500 dark:text-amber-400' 
                          : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {localFlight.positionId || '--'}
                    </div>
                  )}
                </div>

                {/* ETD */}
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Clock size={10} className="opacity-70" /> ETD
                  </span>
                  
                  {isEditingEtd ? (
                    <div className="flex items-center gap-1">
                      <input 
                        value={etdInput} 
                        onChange={(e) => setEtdInput(e.target.value)} 
                        onBlur={handleSaveEtd}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEtd(); if (e.key === 'Escape') setIsEditingEtd(false); }}
                        className="w-full font-mono bg-slate-100 dark:bg-slate-900 border border-emerald-500 text-slate-900 dark:text-slate-100 font-bold px-1.5 py-0.5 rounded text-xs text-center outline-none"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div 
                      onClick={() => { setEtdInput(localFlight.etd); setIsEditingEtd(true); }}
                      className="cursor-pointer font-mono bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all font-bold px-2 py-0.5 rounded text-xs text-center shadow-sm"
                    >
                      {localFlight.etd || '--:--'}
                    </div>
                  )}
                </div>

                {/* CALÇO ARRIVAL */}
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Anchor size={10} className="opacity-70" /> HORÁRIO CALÇO
                  </span>
                  
                  {isEditingChock ? (
                    <div className="flex items-center gap-1">
                      <input 
                        value={chockInput} 
                        onChange={(e) => setChockInput(e.target.value)} 
                        onBlur={handleSaveChock}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveChock(); if (e.key === 'Escape') setIsEditingChock(false); }}
                        className="w-full font-mono bg-slate-100 dark:bg-slate-900 border border-emerald-500 text-slate-900 dark:text-slate-100 font-bold px-1.5 py-0.5 rounded text-xs text-center outline-none"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div 
                      onClick={() => { setChockInput(localFlight.actualArrivalTime || ''); setIsEditingChock(true); }}
                      className="cursor-pointer font-mono bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all font-bold px-2 py-0.5 rounded text-xs text-center shadow-sm"
                    >
                      {localFlight.actualArrivalTime || '--:--'}
                    </div>
                  )}
                </div>

                {/* LIVE COUNTDOWN TIME REMAINING */}
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Clock size={10} className="text-blue-500 animate-pulse" /> TEMP. REST
                  </span>
                  <div className="font-mono bg-blue-500/10 border border-blue-500/20 text-blue-500 dark:text-blue-400 font-bold px-2 py-0.5 rounded text-xs text-center shadow-sm uppercase">
                    {timeRemaining}
                  </div>
                </div>

                {/* DELAY METRICS */}
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <AlertCircle size={10} className="text-rose-500 font-bold" /> REATR./ATR.
                  </span>
                  <div className={`font-mono border font-bold px-2 py-0.5 rounded text-xs text-center shadow-sm uppercase ${
                    timeDelay !== '--m' 
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' 
                      : 'bg-slate-150/40 dark:bg-slate-900/20 border-slate-200/50 dark:border-slate-800/50 text-slate-400'
                  }`}>
                    {timeDelay}
                  </div>
                </div>
              </div>

              {/* OUTRAS OBS DA EQUIPE TÁTICA */}
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/40">
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={11} className={`${isDarkMode ? 'text-emerald-500/70' : 'text-slate-400'}`} />
                  <span className={`text-[8px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Observações Internas (Nota de Voo)
                  </span>
                </div>
                <div className={`p-2.5 rounded-lg text-xs leading-relaxed font-normal border ${
                  isDarkMode 
                    ? 'bg-slate-900/30 border-slate-800 text-slate-300' 
                    : 'bg-slate-50 border-slate-150 text-slate-600'
                }`}>
                  {localFlight.notes || 'Nenhuma observação de despacho ativa para este prefixo.'}
                </div>
              </div>
            </div>
          ) : (
            /* LINHA DO TEMPO (AUDIT TRACKER) */
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className={`text-[8px] font-black uppercase tracking-widest ${isDarkMode ? 'text-emerald-500/80' : 'text-emerald-700'}`}>
                  REGISTROS DO SISTEMA E AUDITORIA
                </h3>
                <div className={`h-px flex-1 ${isDarkMode ? 'bg-slate-850' : 'bg-slate-100'}`} />
              </div>

              <div className={`relative border-l ml-4 space-y-4 pb-2 pt-1 ${
                isDarkMode ? 'border-slate-800' : 'border-slate-200'
              }`}>
                {timelineLogs && timelineLogs.length > 0 ? (
                  timelineLogs.map((log, idx) => {
                    const isFirst = idx === 0;
                    const badgeStyles = getLogColor(log, isFirst);
                    
                    return (
                      <div key={log.id} className="relative pl-6 group">
                        {/* Bullet da fase */}
                        <div className={`absolute -left-[10px] top-1 w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black z-15 ${badgeStyles}`}>
                          {getLogIcon(log)}
                        </div>

                        <div className="flex flex-col">
                          {/* Data/Hora de auditoria */}
                          <span className={`text-[8px] font-mono font-bold uppercase tracking-widest mb-1 ${
                            isFirst 
                              ? (isDarkMode ? 'text-slate-300' : 'text-slate-600') 
                              : (isDarkMode ? 'text-slate-550' : 'text-slate-400')
                          }`}>
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(log.timestamp).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                          </span>

                          {/* Mensagem principal */}
                          <div className={`p-2.5 rounded-xl border leading-relaxed text-xs font-normal transition-all ${
                            isFirst 
                              ? (isDarkMode ? 'bg-slate-900/90 border-emerald-500/30 text-white' : 'bg-white border-slate-300 shadow-md text-slate-800') 
                              : (isDarkMode ? 'bg-slate-900/20 border-slate-800/40 text-slate-400' : 'bg-slate-50 border-slate-200/50 text-slate-500')
                          }`}>
                            <p>{log.message}</p>
                            
                            {/* Progresso artificial para despacho assistido */}
                            {log.progress !== undefined && log.progress < 100 && (
                              <div className={`mt-2 h-1 w-full rounded relative overflow-visible ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                <div 
                                  className="h-full bg-emerald-500 rounded transition-all duration-1000"
                                  style={{ width: `${log.progress}%` }}
                                />
                              </div>
                            )}

                            {log.author && (
                              <div className="mt-2.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/30 flex justify-between items-center text-[8px] font-bold">
                                <span className={`px-1 rounded-sm uppercase tracking-wider ${isDarkMode ? 'bg-slate-800/80 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                  {log.type}
                                </span>
                                <span className={`font-mono text-[8px] flex items-center gap-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                  <UserCheck size={8} /> {log.author}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 opacity-40">
                    <History size={20} className="mx-auto mb-1" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Sem logs de auditoria</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER: EQUIPE DESIGNADA & VEHICLES */}
        <div className={`p-4 border-t ${
          isDarkMode ? 'bg-slate-950/80 border-slate-900' : 'bg-slate-50/80 border-slate-150'
        }`}>
          {!isFinished && (
            <div className="grid grid-cols-2 gap-3 mb-3.5">
              {/* LÍDER DESIGNADO */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <UserPlus size={10} className="text-indigo-400" /> OPERADOR LÍDER
                </span>
                
                {localFlight.operator ? (
                  <div className={`flex items-center gap-2 rounded-lg border p-2 ${
                    isDarkMode ? 'bg-slate-900/60 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                  }`}>
                    <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-black bg-indigo-500/15 text-indigo-400 font-mono">
                      {localFlight.operator.charAt(0)}
                    </div>
                    <div className="truncate flex flex-col justify-center">
                      <span className="text-[10px] uppercase font-black tracking-tight">{localFlight.operator}</span>
                      <span className="text-[7px] font-mono font-bold tracking-widest opacity-60">
                        {localFlight.fleet ? `FLUXO ${localFlight.fleet}` : 'S/ TRATOR'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={`h-11 border border-dashed rounded-lg flex items-center justify-center text-[8px] font-black uppercase tracking-widest ${
                    isDarkMode ? 'bg-slate-900/20 border-slate-800 text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    Sem designação
                  </div>
                )}
              </div>

              {/* AUXILIAR DE APOIO */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Users size={10} className="text-emerald-500" /> APOIO AUXILIAR
                </span>

                {localFlight.operator ? (
                  localFlight.supportOperator ? (
                    <div className={`flex items-center gap-2 rounded-lg border p-2 ${
                      isDarkMode ? 'bg-slate-900/60 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                    }`}>
                      <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-black bg-emerald-500/15 text-emerald-400 font-mono">
                        {localFlight.supportOperator.charAt(0)}
                      </div>
                      <div className="truncate flex flex-col justify-center">
                        <span className="text-[10px] uppercase font-black tracking-tight">{localFlight.supportOperator}</span>
                        <span className="text-[7px] font-mono font-bold tracking-widest opacity-60">CO-PILOTO</span>
                      </div>
                    </div>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => onOpenAssignSupport && onOpenAssignSupport(localFlight)}
                      className={`h-11 border border-dashed rounded-lg flex flex-col items-center justify-center hover:bg-emerald-500/5 hover:border-emerald-500/30 transition-all select-none cursor-pointer ${
                        isDarkMode ? 'bg-slate-900/20 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-250 text-slate-600'
                      }`}
                    >
                      <Plus size={12} className="text-emerald-500 mb-0.5" />
                      <span className="text-[7px] font-black tracking-widest uppercase">Vincular Apoio</span>
                    </button>
                  )
                ) : (
                  <div className={`h-11 border border-dashed rounded-lg flex items-center justify-center text-[8px] font-black uppercase tracking-widest ${
                    isDarkMode ? 'bg-slate-900/20 border-slate-800 text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    Aguardando Líder
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BOTÕES DE CONFIRMAÇÃO DO MODAL */}
          <div className="flex gap-2.5">
            <button 
              type="button"
              onClick={() => {
                if (isFinished) {
                  const newLog: FlightLog = {
                    id: Date.now().toString(),
                    timestamp: new Date(),
                    type: 'MANUAL',
                    message: 'Voo arquivado da visão geral pelo gestor.',
                    author: 'GESTOR_MESA'
                  };
                  const updatedFlight = {
                    ...localFlight,
                    isHiddenFromGrid: true,
                    logs: [...(localFlight.logs || []), newLog]
                  };
                  onUpdate(updatedFlight);
                }
                onClose();
              }}
              className={`flex-1 py-2 rounded text-[9px] font-black uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-95 text-center ${
                isDarkMode 
                  ? 'bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {isFinished ? 'Limpar da Fila' : 'Cancelar'}
            </button>
            <button 
              type="button"
              onClick={() => {
                onUpdate(localFlight);
                onClose();
              }}
              className="flex-1 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-[9px] transition-all hover:scale-[1.01] active:scale-95 shadow-[0_4px_12px_rgba(16,185,129,0.2)] text-center flex items-center justify-center gap-1"
            >
              <CheckCircle size={11} />
              Confirmar
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};
