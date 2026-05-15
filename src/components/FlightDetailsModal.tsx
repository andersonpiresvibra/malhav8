
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { FlightData, FlightLog, OperatorProfile, Vehicle, FlightStatus } from '../types';

import useOnClickOutside from '../hooks/useOnClickOutside';
import { DesigOpr } from './desigopr';
import { useTheme } from '../contexts/ThemeContext';
import { 
  Plane, X, MapPin, Clock, Hash, BusFront, Droplet, 
  UserPlus, RefreshCw, Pen, Anchor, Calendar, Tag, Activity, Users, AlertCircle, Globe, GripHorizontal,
  MessageCircle, UserCheck, Plus, FileText, History, PlaneTakeoff, CheckCircle
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

export const FlightDetailsModal: React.FC<FlightDetailsModalProps> = ({ flight, onClose, onUpdate, vehicles, operators, onOpenAssignSupport, initialTab }) => {
  const { isDarkMode } = useTheme();
  const [localFlight, setLocalFlight] = useState<FlightData>(flight);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  const currentVehicle = useMemo(() => {
    if (!vehicles) return null;
    return vehicles.find(v => v.id === localFlight.fleet) || null;
  }, [vehicles, localFlight.fleet]);

  const vehicleForModal = useMemo(() => {
    if (currentVehicle) return currentVehicle;
    return {
      id: localFlight.fleet || "N/A",
      type: localFlight.vehicleType || 'SERVIDOR',
      status: 'DISPONÍVEL',
      manufacturer: '',
      maxFlowRate: 0,
      hasPlatform: false
    } as Vehicle;
  }, [currentVehicle, localFlight.vehicleType, localFlight.fleet]);

  const handleAssignOperator = (operatorId: string) => {
    const operator = operators.find(op => op.id === operatorId);
    if (!operator) return;
    
    const updatedFlight = {
      ...localFlight,
      operator: operator.warName,
      fleet: operator.assignedVehicle,
      fleetType: operator.fleetCapability as any,
      status: FlightStatus.DESIGNADO,
      designationTime: new Date(),
    };
    
    const newLog: FlightLog = {
      id: Date.now().toString(),
      timestamp: new Date(),
      type: 'MANUAL',
      message: `Operador ${operator.warName} designado via modal.`,
      author: 'GESTOR_MESA'
    };
    updatedFlight.logs = [...(updatedFlight.logs || []), newLog];

    setLocalFlight(updatedFlight);
    onUpdate(updatedFlight);
    setIsAssignModalOpen(false);
  };
  
  // Window Position State for Draggable Popup - Lazy Initialization to prevent jumping
  const [position, setPosition] = useState(() => {
      if (typeof window !== 'undefined') {
          return { 
              x: Math.max(0, window.innerWidth / 2 - 220),
              y: Math.max(20, window.innerHeight / 2 - 180)
          };
      }
      return { x: 0, y: 0 };
  });

  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);
  const designationRef = useRef<HTMLDivElement>(null);

  // Editing States
  const [isEditingDest, setIsEditingDest] = useState(false);
  const [destInput, setDestInput] = useState(flight.destination);

  const [isEditingReg, setIsEditingReg] = useState(false);
  const [regInput, setRegInput] = useState(flight.registration);

  const [isEditingPos, setIsEditingPos] = useState(false);
  const [posInput, setPosInput] = useState(flight.positionId);
  const [posTypeInput, setPosTypeInput] = useState<'SRV' | 'CTA' | undefined>(flight.positionType);
  
  const [isEditingEta, setIsEditingEta] = useState(false);
  const [etaInput, setEtaInput] = useState(flight.eta);

  const [isEditingEtd, setIsEditingEtd] = useState(false);
  const [etdInput, setEtdInput] = useState(flight.etd); 

  const [isEditingDepFlight, setIsEditingDepFlight] = useState(false);
  const [depFlightInput, setDepFlightInput] = useState(flight.departureFlightNumber || '');

  const [isEditingChock, setIsEditingChock] = useState(false);
  const [chockInput, setChockInput] = useState(flight.actualArrivalTime || ''); 

  const [isEditingOperator, setIsEditingOperator] = useState(false);
  const [operatorInput, setOperatorInput] = useState(flight.operator || '');

  const [isEditingSupport, setIsEditingSupport] = useState(false);
  const [supportInput, setSupportInput] = useState(flight.supportOperator || '');
  const [activeTab, setActiveTab] = useState<'DADOS' | 'TIMELINE'>(initialTab === 'RELATÓRIO' ? 'TIMELINE' : 'DADOS');

  // T. Rest logic
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
      
      // Se a diferença for muito negativa, assume que é para o dia seguinte (se o vôo for noturno)
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
    const interval = setInterval(updateTime, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [localFlight.etd]);

  const [showOperatorList, setShowOperatorList] = useState(false);
  const [showSupportOperatorList, setShowSupportOperatorList] = useState(false);

  const availableOperators = useMemo(() => {
    const isRemote = flight.positionId.startsWith('5') || flight.positionId.startsWith('6') || flight.positionId.startsWith('7');

    return operators
      .filter(op => {
        if (op.status !== 'DISPONÍVEL') return false;
        if (isRemote && op.category !== 'ILHA' && op.category !== 'VIP') return false; // Simplificado para ILHA/VIP em remotas
        return true;
      })
      .sort((a, b) => {
        // Lógica de Sorteio: por enquanto, apenas alfabética.
        return a.warName.localeCompare(b.warName);
      });
  }, [flight.positionId]);

  useOnClickOutside(designationRef, () => {
    setShowOperatorList(false);
    setShowSupportOperatorList(false);
  });

  useEffect(() => {
    setLocalFlight(flight);
    setDestInput(flight.destination);
    setRegInput(flight.registration);
    setPosInput(flight.positionId);
    setEtaInput(flight.eta);
    setEtdInput(flight.etd);
    setDepFlightInput(flight.departureFlightNumber || '');
    setChockInput(flight.actualArrivalTime || '');
    setOperatorInput(flight.operator || '');
    setSupportInput(flight.supportOperator || '');
  }, [flight]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        // If an input is focused, let it handle its own Enter
        if (document.activeElement?.tagName === 'INPUT') return;
        onUpdate(localFlight);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [localFlight, onUpdate, onClose]);

  // DRAG LOGIC
  const handleMouseDown = (e: React.MouseEvent) => {
    if (windowRef.current) {
        isDragging.current = true;
        dragOffset.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }
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

  // Helper para gerar log de auditoria
  const generateAuditLog = (field: string, oldValue: string | number | undefined, newValue: string | number | undefined): FlightLog => ({
      id: Date.now().toString(),
      timestamp: new Date(),
      type: 'MANUAL',
      message: `${field} alterado manualmente: ${oldValue || '--'} > ${newValue || '--'}`,
      author: 'GESTOR_MESA'
  });

  const handleSaveDest = () => {
    const formatted = destInput.toUpperCase().slice(0, 4);
    if (formatted === localFlight.destination) { setIsEditingDest(false); return; }

    const newLog = generateAuditLog('Destino', localFlight.destination, formatted);
    const updated = { 
        ...localFlight, 
        destination: formatted,
        logs: [...localFlight.logs, newLog]
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
        logs: [...localFlight.logs, newLog]
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
        logs: [...localFlight.logs, newLog]
    };

    setLocalFlight(updated);
    onUpdate(updated);
    setIsEditingReg(false);
  };

  const handleSaveEta = () => {
      if (etaInput === localFlight.eta) { setIsEditingEta(false); return; }

      const newLog = generateAuditLog('ETA', localFlight.eta, etaInput);
      const updated = { 
          ...localFlight, 
          eta: etaInput,
          logs: [...localFlight.logs, newLog]
      };

      setLocalFlight(updated);
      onUpdate(updated);
      setIsEditingEta(false);
  };

  const handleSaveChock = () => {
      if (chockInput === localFlight.actualArrivalTime) { setIsEditingChock(false); return; }

      const newLog = generateAuditLog('Horário Calço', localFlight.actualArrivalTime || '--', chockInput);
      const updated = { 
          ...localFlight, 
          actualArrivalTime: chockInput,
          logs: [...localFlight.logs, newLog]
      };

      setLocalFlight(updated);
      onUpdate(updated);
      setIsEditingChock(false);
  };

  const handleSaveEtd = () => {
    if (etdInput === localFlight.etd) { setIsEditingEtd(false); return; }

    const newLog = generateAuditLog('ETD', localFlight.etd, etdInput);
    const updated = { 
        ...localFlight, 
        etd: etdInput,
        logs: [...localFlight.logs, newLog]
    };

    setLocalFlight(updated);
    onUpdate(updated);
    setIsEditingEtd(false);
  };

  const handleSaveOperator = () => {
    if (operatorInput === localFlight.operator) { setIsEditingOperator(false); return; }

    const newLog = generateAuditLog('Operador (Líder)', localFlight.operator, operatorInput);
    const updated = { 
        ...localFlight, 
        operator: operatorInput,
        logs: [...localFlight.logs, newLog]
    };

    setLocalFlight(updated);
    onUpdate(updated);
    setIsEditingOperator(false);
  };

  const handleSaveSupport = () => {
    if (supportInput === localFlight.supportOperator) { setIsEditingSupport(false); return; }

    const newLog = generateAuditLog('Apoio Técnico', localFlight.supportOperator, supportInput);
    const updated = { 
        ...localFlight, 
        supportOperator: supportInput,
        logs: [...localFlight.logs, newLog]
    };

    setLocalFlight(updated);
    onUpdate(updated);
    setIsEditingSupport(false);
  };

  const isFinished = localFlight.status === FlightStatus.FINALIZADO || localFlight.status === FlightStatus.CANCELADO;

  const getLogIcon = (log: FlightLog) => {
      const msg = log.message.toLowerCase();
      if (msg.includes('abastecendo')) return <Droplet size={10} />;
      if (msg.includes('designado') || msg.includes('operador')) return <UserPlus size={10} />;
      if (msg.includes('finalizado') || msg.includes('sucesso')) return <CheckCircle size={10} />;
      if (log.type === 'ALERTA' || log.type === 'ATRASO') return <AlertCircle size={10} />;
      if (log.type === 'OBSERVACAO') return <MessageCircle size={10} />;
      if (msg.includes('fila')) return <Clock size={10} />;
      if (msg.includes('calço')) return <Anchor size={10} />;
      return <Activity size={10} />;
  };

  const getLogColor = (log: FlightLog | any, isFirst: boolean) => {
      const msg = log.message.toLowerCase();
      if (log.type === 'ATRASO' || log.type === 'ALERTA' || msg.includes('cancelado')) return isFirst ? 'bg-red-500 border-red-200 text-white' : 'bg-red-100 border-red-200 text-red-500';
      if (msg.includes('finalizado') || msg.includes('sucesso') || msg.includes('concluído') || msg.includes('acoplado e pronto')) return isFirst ? 'bg-emerald-500 border-emerald-200 text-white' : 'bg-emerald-100 border-emerald-200 text-emerald-500';
      if (msg.includes('abastecendo') || msg.includes('iniciado')) return isFirst ? 'bg-blue-500 border-blue-200 text-white' : 'bg-blue-100 border-blue-200 text-blue-500';
      if (msg.includes('designado') || msg.includes('operador') || msg.includes('deslocamento') || msg.includes('acoplando')) return isFirst ? 'bg-indigo-500 border-indigo-200 text-white' : 'bg-indigo-100 border-indigo-200 text-indigo-500';
      if (msg.includes('fila') || msg.includes('aguardando')) return isFirst ? 'bg-amber-500 border-amber-200 text-white' : 'bg-amber-100 border-amber-200 text-amber-500';
      return isFirst ? 'bg-slate-700 border-slate-300 text-white' : 'bg-slate-100 border-slate-200 text-slate-400';
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
    <>
    <motion.div 
        ref={windowRef}
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{ left: position.x, top: position.y }}
        className={`fixed z-[9990] w-full max-w-[400px] flex flex-col rounded-[8px] shadow-2xl border-[0.5px] ${isDarkMode ? 'border-emerald-500/30 bg-slate-900/95' : 'border-slate-200 bg-white/95'} backdrop-blur-xl overflow-hidden`}
    >
        {/* HEADER COMPACT & SOPHISTICATED */}
        <div 
            onMouseDown={handleMouseDown}
            className={`${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-[#004D24] border-transparent'} p-3 flex justify-between items-center cursor-move select-none border-b`}
        >
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center shrink-0 bg-white rounded shadow-inner p-1">
                    <img 
                        src={`https://images.kiwi.com/airlines/64/${localFlight.airlineCode === 'RG' ? 'G3' : localFlight.airlineCode}.png`}
                        alt={localFlight.airline}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                        referrerPolicy="no-referrer"
                    />
                </div>
                <div className="flex flex-col justify-center">
                    <span className="text-[11px] font-bold text-white/70 uppercase tracking-widest leading-none mb-1">
                        {localFlight.airline}
                    </span>
                    <h2 className="text-2xl font-black text-white font-mono tracking-tighter leading-none">
                        {localFlight.flightNumber}
                    </h2>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                    <span className="text-[14px] font-black text-emerald-400 font-mono tracking-widest leading-none">
                        {localFlight.registration || '--'}
                    </span>
                    <span className="text-[7px] text-white/40 uppercase tracking-[0.2em] font-normal mt-1 leading-none">PREFIXO</span>
                </div>
                
                <button 
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white transition-all ml-1"
                >
                    <X size={18} className="border border-white rounded-[5px]" />
                </button>
            </div>
        </div>

        {/* TABS */}
        <div className={`flex border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <button 
                onClick={() => setActiveTab('DADOS')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'DADOS' ? (isDarkMode ? 'text-emerald-500 border-b-2 border-emerald-500 bg-slate-800/50' : 'text-emerald-600 border-b-2 border-emerald-500 bg-white') : (isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}`}
            >
                Informações
            </button>
            <button 
                onClick={() => setActiveTab('TIMELINE')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'TIMELINE' ?  (isDarkMode ? 'text-emerald-500 border-b-2 border-emerald-500 bg-slate-800/50' : 'text-emerald-600 border-b-2 border-emerald-500 bg-white') : (isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}`}
            >
                Rastreio (Timeline)
            </button>
        </div>

        {/* CONTENT: TIGHT GRID */}
        <div className={`p-4 max-h-[60vh] overflow-y-auto ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
            {activeTab === 'DADOS' ? (
                <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded uppercase tracking-[0.2em] border border-emerald-100">
                            DETALHES DA OPERAÇÃO
                        </h3>
                        <div className="h-px flex-1 bg-slate-100" />
                    </div>
                
                <div className="grid grid-cols-3 gap-x-4 gap-y-4">
                    {/* LINHA 1 */}
                    {/* Nº Voo (saída) */}
                    <div className="space-y-1 group">
                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <PlaneTakeoff size={10} className="text-slate-300" /> Nº Voo (Saída)
                        </label>
                        {isEditingDepFlight ? (
                            <input 
                                autoFocus
                                className="w-full bg-slate-50 border-2 border-emerald-500 text-slate-900 text-xs px-2 py-1 rounded-lg font-mono font-black outline-none uppercase focus:ring-4 focus:ring-emerald-500/20 transition-all shadow-sm"
                                value={depFlightInput}
                                onChange={e => setDepFlightInput(e.target.value.toUpperCase())}
                                onBlur={handleSaveDepFlight}
                                onKeyDown={e => e.key === 'Enter' && handleSaveDepFlight()}
                            />
                        ) : (
                            <div onClick={() => setIsEditingDepFlight(true)} className="flex items-center gap-1.5 cursor-pointer group/item">
                                <span className="text-sm font-mono text-emerald-700 bg-emerald-50 border border-emerald-100 font-bold tracking-tight px-1.5 py-0.5 rounded shadow-sm min-w-[50px] inline-block text-center">
                                    {localFlight.departureFlightNumber || '--'}
                                </span>
                                <Pen size={8} className="text-slate-400 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                            </div>
                        )}
                    </div>

                    {/* DESTINO */}
                    <div className="space-y-1 group">
                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Globe size={10} className="text-slate-300" /> Destino
                        </label>
                        {isEditingDest ? (
                            <input 
                                autoFocus
                                className="w-full bg-slate-50 border-2 border-emerald-500 text-slate-900 text-xs px-2 py-1 rounded-lg font-mono font-black outline-none uppercase focus:ring-4 focus:ring-emerald-500/20 transition-all shadow-sm"
                                value={destInput}
                                onChange={e => setDestInput(e.target.value.toUpperCase().slice(0, 4))}
                                onBlur={handleSaveDest}
                                onKeyDown={e => e.key === 'Enter' && handleSaveDest()}
                                maxLength={4}
                            />
                        ) : (
                            <div onClick={() => setIsEditingDest(true)} className="flex items-center gap-1.5 cursor-pointer group/item">
                                <span className="text-sm font-mono text-emerald-700 bg-emerald-50 border border-emerald-100 font-bold tracking-tight px-1.5 py-0.5 rounded shadow-sm min-w-[50px] inline-block text-center">
                                    {localFlight.destination || '--'}
                                </span>
                                <Pen size={8} className="text-slate-400 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                            </div>
                        )}
                    </div>

                    {/* CID (cidade) */}
                    <div className="space-y-1 group">
                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <MapPin size={10} className="text-slate-300" /> Cidade
                        </label>
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm font-mono text-slate-600 bg-slate-50 border border-slate-100 font-bold tracking-tight px-1.5 py-0.5 rounded shadow-sm min-w-[50px] inline-block text-center uppercase">
                                {localFlight.destination ? (ICAO_CITIES[localFlight.destination] || 'EXTERIOR') : '--'}
                            </span>
                        </div>
                    </div>

                    {/* LINHA 2 */}
                    {/* PREFIXO */}
                    <div className="space-y-1 group">
                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Hash size={10} className="text-slate-300" /> Prefixo
                        </label>
                        {isEditingReg ? (
                            <input 
                                autoFocus
                                className="w-full bg-slate-50 border-2 border-emerald-500 text-slate-900 text-xs px-2 py-1 rounded-lg font-mono font-black outline-none uppercase focus:ring-4 focus:ring-emerald-500/20 transition-all shadow-sm"
                                value={regInput}
                                onChange={e => setRegInput(e.target.value.toUpperCase())}
                                onBlur={handleSaveReg}
                                onKeyDown={e => e.key === 'Enter' && handleSaveReg()}
                            />
                        ) : (
                            <div onClick={() => setIsEditingReg(true)} className="flex items-center gap-1.5 cursor-pointer group/item">
                                <span className="text-[14px] leading-[20px] mb-[20px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-100 font-bold tracking-tight px-1.5 py-0.5 rounded shadow-sm min-w-[50px] inline-block text-center">
                                    {localFlight.registration || '--'}
                                </span>
                                <Pen size={8} className="text-slate-400 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                            </div>
                        )}
                    </div>

                    {/* POSIÇÃO */}
                    <div className="space-y-1 group">
                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <MapPin size={10} className="text-slate-300" /> Posição
                        </label>
                        {isEditingPos ? (
                            <input 
                                autoFocus
                                className={`w-full bg-slate-50 border-2 ${localFlight.positionType === 'CTA' ? 'border-yellow-500 focus:ring-yellow-500/20' : 'border-emerald-500 focus:ring-emerald-500/20'} text-slate-900 text-xs px-2 py-1 rounded-lg font-mono font-black outline-none uppercase transition-all shadow-sm`}
                                placeholder="Ex: 101"
                                value={posInput}
                                onChange={e => setPosInput(e.target.value.toUpperCase())}
                                onBlur={() => setIsEditingPos(false)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        const newLog = generateAuditLog('Posição ID', localFlight.positionId, posInput);
                                        const updated = { ...localFlight, positionId: posInput, logs: [...localFlight.logs, newLog] };
                                        setLocalFlight(updated);
                                        onUpdate(updated);
                                        setIsEditingPos(false);
                                    }
                                }}
                            />
                        ) : (
                            <div onClick={() => setIsEditingPos(true)} className="flex items-center gap-1.5 cursor-pointer group/item">
                                <span className={`text-sm font-mono font-bold tracking-tight px-1.5 py-0.5 rounded shadow-sm min-w-[40px] inline-block text-center border ${
                                    localFlight.positionType === 'CTA' 
                                    ? 'bg-yellow-400 border-yellow-500 text-slate-900' 
                                    : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                }`}>
                                    {localFlight.positionId || '--'}
                                </span>
                                <Pen size={8} className="text-slate-400 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                            </div>
                        )}
                    </div>

                    {/* POS TIPO (SRV / CTA) */}
                    <div className="space-y-1 group">
                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Activity size={10} className="text-slate-300" /> Pos Tipo
                        </label>
                        <div className="flex gap-1">
                            {['SRV', 'CTA'].map(type => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => {
                                        const newLog = generateAuditLog('Pos Tipo', localFlight.positionType || 'N/A', type);
                                        const updated = { ...localFlight, positionType: type as 'SRV' | 'CTA', logs: [...localFlight.logs, newLog] };
                                        setLocalFlight(updated);
                                        onUpdate(updated);
                                        setPosTypeInput(type as 'SRV' | 'CTA');
                                    }}
                                    className={`flex-1 py-1 text-[9px] font-bold rounded border transition-all ${
                                        localFlight.positionType === type 
                                        ? (type === 'CTA' 
                                            ? 'bg-yellow-400 border-yellow-500 text-slate-900 shadow-lg shadow-yellow-400/20' 
                                            : 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20')
                                        : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-200 hover:text-emerald-600 shadow-sm'
                                    }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* LINHA 3 */}
                    {/* ETD */}
                    <div className="space-y-1 group">
                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Clock size={10} className="text-slate-300" /> ETD
                        </label>
                        {isEditingEtd ? (
                            <input 
                                autoFocus
                                type="time"
                                className="w-full bg-slate-50 border-2 border-emerald-500 text-slate-900 text-xs px-2 py-1 rounded-lg font-mono font-black outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all shadow-sm"
                                value={etdInput}
                                onChange={e => setEtdInput(e.target.value)}
                                onBlur={handleSaveEtd}
                                onKeyDown={e => e.key === 'Enter' && handleSaveEtd()}
                            />
                        ) : (
                            <div onClick={() => setIsEditingEtd(true)} className="flex items-center gap-1.5 cursor-pointer group/item">
                                <span className="text-sm font-mono text-emerald-700 bg-emerald-50 border border-emerald-100 font-bold tracking-tight px-1.5 py-0.5 rounded shadow-sm min-w-[50px] inline-block text-center">
                                    {localFlight.etd || '--:--'}
                                </span>
                                <Pen size={8} className="text-slate-300 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                            </div>
                        )}
                    </div>

                    {/* CALÇO */}
                    <div className="space-y-1 group">
                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Anchor size={10} className="text-slate-300" /> Calço
                        </label>
                        {isEditingChock ? (
                            <input 
                                autoFocus
                                type="time"
                                className="w-full bg-slate-50 border-2 border-emerald-500 text-slate-900 text-xs px-2 py-1 rounded-lg font-mono font-black outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all shadow-sm"
                                value={chockInput}
                                onChange={e => setChockInput(e.target.value)}
                                onBlur={handleSaveChock}
                                onKeyDown={e => e.key === 'Enter' && handleSaveChock()}
                            />
                        ) : (
                            <div onClick={() => setIsEditingChock(true)} className="flex items-center gap-1.5 cursor-pointer group/item">
                                <span className="text-sm font-mono text-emerald-700 bg-emerald-50 border border-emerald-100 font-bold tracking-tight px-1.5 py-0.5 rounded shadow-sm min-w-[50px] inline-block text-center">
                                    {chockInput || '--:--'}
                                </span>
                                <Pen size={8} className="text-slate-400 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                            </div>
                        )}
                    </div>

                    {/* TEMPOS (RESTANTE / ATRASO) */}
                    <div className="flex gap-2">
                        {/* T. REST. */}
                        <div className="space-y-1 group">
                            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Clock size={10} className="text-slate-300" /> T. Rest.
                            </label>
                            <span className="text-sm font-mono font-bold tracking-tight px-1.5 py-0.5 rounded shadow-sm min-w-[50px] inline-block text-center uppercase border bg-blue-50 border-blue-100 text-blue-700">
                                {timeRemaining}
                            </span>
                        </div>
                        {/* T. ATR. */}
                        <div className="space-y-1 group">
                            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 cursor-help" title="Tempo de Atraso">
                                <AlertCircle size={10} className="text-slate-300" /> T. Atr.
                            </label>
                            <span className={`text-sm font-mono font-bold tracking-tight px-1.5 py-0.5 rounded shadow-sm min-w-[50px] inline-block text-center uppercase border ${
                                timeDelay !== '--m' 
                                ? 'bg-red-50 border-red-100 text-red-600' 
                                : 'bg-slate-50 border-slate-100 text-slate-400'
                            }`}>
                                {timeDelay}
                            </span>
                        </div>
                    </div>
                </div>
            </section>
            ) : (
                <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded uppercase tracking-[0.2em] border border-emerald-100">
                            LINHA DO TEMPO
                        </h3>
                        <div className="h-px flex-1 bg-slate-100" />
                    </div>
                    
                    <div className={`relative border-l-2 ml-[15px] space-y-6 pb-4 pt-2 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                        {timelineLogs && timelineLogs.length > 0 ? (
                            timelineLogs
                                .map((log, idx) => {
                                    const isFirst = idx === 0;
                                    const logColor = getLogColor(log, isFirst);
                                    
                                    return (
                                    <div key={log.id} className="relative pl-6 group">
                                        {/* CIRCLE ICON */}
                                        <div className={`absolute -left-[11px] top-0 w-5 h-5 rounded-full flex items-center justify-center border-2 ${isDarkMode ? 'border-slate-900' : 'border-white'} ${logColor} shadow-sm z-10 transition-transform group-hover:scale-110`}>
                                            {getLogIcon(log)}
                                        </div>
                                        
                                        <div className="flex flex-col -mt-1">
                                            {/* TIMESTAMP & DATE */}
                                            <span className={`text-[9px] font-mono font-bold tracking-widest uppercase mb-1 ${isFirst ? (isDarkMode ? 'text-slate-200' : 'text-slate-600') : (isDarkMode ? 'text-slate-500' : 'text-slate-400')}`}>
                                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(log.timestamp).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                                            </span>
                                            
                                            {/* MESSAGE CARD */}
                                            <div className={`p-2 rounded-lg border shadow-sm transition-all overflow-hidden ${
                                                isFirst 
                                                    ? (isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200')
                                                    : (isDarkMode ? 'bg-slate-900/50 border-slate-800/50' : 'bg-slate-50 border-slate-100')
                                            } group-hover:border-slate-300 dark:group-hover:border-slate-600`}>
                                                <p className={`text-xs font-medium leading-relaxed ${isFirst ? (isDarkMode ? 'text-white' : 'text-slate-800') : (isDarkMode ? 'text-slate-400' : 'text-slate-600')}`}>
                                                    {log.message}
                                                </p>
                                                
                                                {log.progress !== undefined && log.progress < 100 && (
                                                    <div className={`mt-2 h-1 w-full rounded overflow-visible relative ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                                        <div 
                                                            className={`h-full transition-all duration-1000 ease-linear rounded relative flex items-center justify-end ${
                                                                log.timelineType === 'A_CAMINHO' ? 'bg-indigo-500' : 'bg-blue-500'
                                                            }`}
                                                            style={{ width: `${Math.min(100, Math.max(0, log.progress))}%` }}
                                                        >
                                                            <div className={`absolute -right-1 w-2.5 h-2.5 rounded-full shadow-sm ring-1 ${log.timelineType === 'A_CAMINHO' ? (isDarkMode ? 'bg-indigo-400 ring-indigo-900' : 'bg-indigo-500 ring-white') : (isDarkMode ? 'bg-blue-400 ring-blue-900' : 'bg-blue-500 ring-white')}`} />
                                                        </div>
                                                    </div>
                                                )}

                                                {log.author && (
                                                    <div className="mt-2 text-[8px] flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-2">
                                                        <span className={`font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-slate-950 text-slate-500' : 'bg-slate-100 text-slate-500'}`}>
                                                            {log.type}
                                                        </span>
                                                        <span className={`font-mono flex items-center gap-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                                            <UserCheck size={8} /> {log.author}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )})
                        ) : (
                            <div className="text-center py-8 opacity-50">
                                <History size={24} className="mx-auto mb-2 text-slate-400" />
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nenhum registro encontrado</p>
                            </div>
                        )}
                    </div>
                </section>
            )}
        </div>

        {/* FOOTER: ACTION ORIENTED DESIGNATION */}
        <div className={`p-4 border-t ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
            {!isFinished && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                    {/* OPERADOR */}
                    <div className="space-y-1.5">
                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <UserPlus size={10} className="text-indigo-500" /> Operador
                        </label>
                        {localFlight.operator ? (
                            <div className={`flex items-center justify-between border p-2 rounded-lg group transition-all shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
                                <div className="flex items-center gap-2">
                                    <div className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold border ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                                        {localFlight.operator.charAt(0)}
                                    </div>
                                    <div className="overflow-hidden">
                                        <div className={`text-[10px] font-bold uppercase leading-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{localFlight.operator} {localFlight.fleet ? `| ${localFlight.fleet}` : ''}</div>
                                        <div className="text-[7px] text-slate-400 font-bold uppercase tracking-widest">
                                            {localFlight.vehicleType || 'S/ TIPO'}
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsAssignModalOpen(true)}
                                    className={`p-1.5 rounded-lg transition-all ${isDarkMode ? 'text-slate-500 hover:text-indigo-400 hover:bg-slate-800' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                >
                                    <RefreshCw size={10} />
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => setIsAssignModalOpen(true)}
                                className={`w-full h-[36px] border border-dashed rounded-lg text-[9px] font-bold flex items-center justify-center gap-1.5 uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10' : 'bg-white border-slate-300 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/30'}`}
                            >
                                <UserPlus size={14} /> Designar
                            </button>
                        )}
                    </div>

                    {/* OP. APOIO */}
                    <div className="space-y-1.5">
                        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Users size={10} className="text-emerald-500" /> Op. Apoio
                        </label>
                        {localFlight.operator ? (
                            <div className="relative">
                                {localFlight.supportOperator ? (
                                    <div className={`flex items-center justify-between border p-2 rounded-lg group transition-all shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-emerald-500/50' : 'bg-white border-slate-200 hover:border-emerald-300'}`}>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold border ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                                {localFlight.supportOperator.charAt(0)}
                                            </div>
                                            <div className="overflow-hidden">
                                                <div className={`text-[10px] font-bold uppercase leading-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                                    {localFlight.supportOperator} 
                                                    {operators.find(op => op.warName === localFlight.supportOperator)?.assignedVehicle ? ` | ${operators.find(op => op.warName === localFlight.supportOperator)?.assignedVehicle}` : ''}
                                                </div>
                                                <div className="text-[7px] text-slate-400 font-bold uppercase tracking-widest">Auxiliar</div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                const newLog = generateAuditLog('Op. Apoio', localFlight.supportOperator, undefined);
                                                const updated = { ...localFlight, supportOperator: undefined, logs: [...localFlight.logs, newLog] };
                                                setLocalFlight(updated);
                                                onUpdate(updated);
                                            }}
                                            className={`p-1.5 rounded-lg transition-all ${isDarkMode ? 'text-slate-500 hover:text-red-400 hover:bg-slate-800' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => onOpenAssignSupport && onOpenAssignSupport(localFlight)}
                                        className={`w-full h-[36px] border border-dashed rounded-lg text-[9px] font-bold flex items-center justify-center gap-1.5 uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-500 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/10' : 'bg-white border-slate-300 text-slate-400 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50/30'}`}
                                    >
                                        <Plus size={14} /> Adicionar
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className={`w-full h-[36px] border rounded-lg flex items-center justify-center text-[9px] font-bold uppercase tracking-widest ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-600' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                                Aguardando
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Ações (Cancelar / OK) */}
            <div className="flex gap-3">
                <button 
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
                    className="flex-1 px-4 py-2 bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest rounded transition-all active:scale-95"
                >
                    {isFinished ? 'Limpar da Fila' : 'Cancelar'}
                </button>
                <button 
                    onClick={() => {
                        onUpdate(localFlight);
                        onClose();
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded shadow transition-all active:scale-95 btn-confirm-flight"
                >
                    <span className="text-[9px] font-black uppercase tracking-widest">Confirmar</span>
                </button>
            </div>
        </div>
    </motion.div>

    <DesigOpr 
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        flight={localFlight}
        operators={operators}
        onConfirm={handleAssignOperator}
    />
  </>,
  document.body
);
};
