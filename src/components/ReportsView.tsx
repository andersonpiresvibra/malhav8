import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../contexts/ThemeContext';
import { FlightStatus, FlightData, OperatorProfile } from '../types';
import { getAuditLogs, AuditLogEntry } from '../services/supabaseService';
import { OperatorCell } from './OperatorCell';
import { AirlineLogo } from './AirlineLogo';
import { formatAirlineName } from '../utils/airlineUtils';
import { 
  FileText, CheckCircle, Clock, AlertTriangle, XCircle, 
  Printer, Download, ChevronLeft, Calendar, FileBarChart,
  User, MapPin, Hash, Truck, History, MessageSquare, Headphones, Search, TimerOff,
  ArrowUp, ArrowDown
} from 'lucide-react';

interface ReportsViewProps {
    flights: FlightData[];
    initialFlight?: FlightData | null;
    operators?: OperatorProfile[];
}

type MainTab = 'OPERACOES' | 'AUDITORIA';
type OperationTab = 'GERAL' | 'SUCESSO' | 'ATRASADOS' | 'TROCADOS' | 'CANCELADOS';
type ShiftTab = 'GERAL' | 'MANHÃ' | 'TARDE' | 'NOITE';

// Helper para identificar o turno
const getShift = (date: Date | undefined): ShiftTab => {
    if (!date) return 'GERAL';
    const hours = date.getHours();
    if (hours >= 6 && hours < 14) return 'MANHÃ';
    if (hours >= 14 && hours < 22) return 'TARDE';
    return 'NOITE';
};

// Densidade média Jet A-1 para conversão aproximada
const AVG_DENSITY = 0.803; 
// Fator de conversão Litros para Galões (US)
const L_TO_GAL = 0.264172;

// Helper de simulação de atraso
const isDelayed = (flight: FlightData) => {
    if (!flight.endTime || !flight.etd) return false;
    const [h, m] = flight.etd.split(':').map(Number); 
    const etdDate = new Date(flight.endTime); 
    etdDate.setHours(h, m, 0, 0);
    return new Date(flight.endTime).getTime() > etdDate.getTime();
};

// Helper para ordenação
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

type SortDirection = 'asc' | 'desc' | null;
interface SortConfig {
  key: keyof FlightData | null;
  direction: SortDirection;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ flights, initialFlight, operators = [] }) => {
  const { isDarkMode } = useTheme();
  const [mainTab, setMainTab] = useState<MainTab>('OPERACOES');
  const [opsTab, setOpsTab] = useState<OperationTab>('GERAL');
  const [activeShift, setActiveShift] = useState<ShiftTab>('GERAL');
  const [selectedFlight, setSelectedFlight] = useState<FlightData | null>(initialFlight || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null });
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isOpsExpanded, setIsOpsExpanded] = useState(false);
  const [isShiftsExpanded, setIsShiftsExpanded] = useState(false);

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.getElementById('subheader-portal-target'));
    const loadLogs = async () => {
      const logs = await getAuditLogs();
      setAuditLogs(logs);
    };
    loadLogs();
  }, []);

  const shiftCounts = useMemo(() => {
      let categoryFiltered = flights.filter(f => f.status === FlightStatus.FINALIZADO || f.status === FlightStatus.CANCELADO);
      
      return {
          GERAL: categoryFiltered.length,
          MANHÃ: categoryFiltered.filter(f => getShift(f.endTime || f.startTime) === 'MANHÃ').length,
          TARDE: categoryFiltered.filter(f => getShift(f.endTime || f.startTime) === 'TARDE').length,
          NOITE: categoryFiltered.filter(f => getShift(f.endTime || f.startTime) === 'NOITE').length,
      };
  }, [flights, mainTab, opsTab]);

  const historicalData = useMemo(() => {
      const base = flights.filter(f => f.status === FlightStatus.FINALIZADO || f.status === FlightStatus.CANCELADO);
      
      // Filtrar por turno se não for GERAL
      const shiftFiltered = activeShift === 'GERAL' 
        ? base 
        : base.filter(f => getShift(f.endTime || f.startTime) === activeShift);

      return {
          finalizados: shiftFiltered,
          sucesso: shiftFiltered.filter(f => f.status === FlightStatus.FINALIZADO && !isDelayed(f) && !f.logs.some(l => l.message.toLowerCase().includes('troca'))),
          atrasados: shiftFiltered.filter(f => f.status === FlightStatus.FINALIZADO && isDelayed(f)),
          trocados: shiftFiltered.filter(f => f.status === FlightStatus.FINALIZADO && f.logs.some(l => l.message.toLowerCase().includes('troca'))), 
          cancelados: shiftFiltered.filter(f => f.status === FlightStatus.CANCELADO),
      };
  }, [flights, activeShift]);

  const currentList = useMemo(() => {
      let list: FlightData[] = [];
      if (mainTab === 'OPERACOES') {
          switch(opsTab) {
              case 'GERAL': list = historicalData.finalizados; break;
              case 'SUCESSO': list = historicalData.sucesso; break;
              case 'ATRASADOS': list = historicalData.atrasados; break;
              case 'TROCADOS': list = historicalData.trocados; break;
              case 'CANCELADOS': list = historicalData.cancelados; break;
          }
      }

      if (!searchTerm) return list;

      const lowerTerm = searchTerm.toLowerCase().replace(/[^a-z0-9]/g, '');
      return list.filter(f => {
          const flightNum = f.flightNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
          const reg = f.registration.toLowerCase().replace(/[^a-z0-9]/g, '');
          const pos = f.positionId.toLowerCase().replace(/[^a-z0-9]/g, '');
          const airline = f.airline.toLowerCase().replace(/[^a-z0-9]/g, '');
          const operator = (f.operator || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          
          return flightNum.includes(lowerTerm) || 
                 reg.includes(lowerTerm) || 
                 pos.includes(lowerTerm) || 
                 airline.includes(lowerTerm) || 
                 operator.includes(lowerTerm);
      });
  }, [mainTab, opsTab, historicalData, searchTerm]);

  const handleSort = (key: keyof FlightData) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    else if (sortConfig.key === key && sortConfig.direction === 'desc') direction = null;
    setSortConfig({ key: direction ? key : null, direction });
  };

  const sortedData = useMemo(() => {
    let data = [...currentList];
    if (!sortConfig.key || !sortConfig.direction) return data;
    return data.sort((a, b) => {
      const aValue = (a[sortConfig.key!] ?? '').toString();
      const bValue = (b[sortConfig.key!] ?? '').toString();
      return sortConfig.direction === 'asc' 
        ? aValue.localeCompare(bValue) 
        : bValue.localeCompare(aValue);
    });
  }, [currentList, sortConfig]);

  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const handleExportPDF = async () => {
    const element = document.getElementById('printable-report-container');
    if (!element) return;
    
    setIsExportingPDF(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      
      // Converte o container inteiro em um canvas com escala 2 para alta nitidez comercial
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }
      
      const flightNum = selectedFlight?.flightNumber || 'SBGR';
      pdf.save(`Relatorio_Operacional_Voo_${flightNum}.pdf`);
    } catch (err) {
      console.error("Erro gerando PDF operacional:", err);
      alert("Houve um problema ao compilar o PDF do relatório. Use a exportação do navegador pelo botão de impressão convencional.");
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handlePrint = () => {
      window.print();
  };

  const SortableHeader = ({ label, columnKey, className = "" }: { label: string, columnKey: keyof FlightData, className?: string }) => {
    const isActive = sortConfig.key === columnKey;
    return (
      <th 
        className={`px-3 py-4 border-b border-r ${isDarkMode ? 'border-slate-700 bg-slate-900 hover:bg-slate-800' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'} sticky top-0 cursor-pointer select-none transition-all group z-20 ${className}`}
        onClick={() => handleSort(columnKey)}
      >
        <div className={`flex items-center gap-1.5 ${className.includes('text-center') ? 'justify-center' : 'justify-start'}`}>
          <span className={`font-black text-[9px] uppercase tracking-wider transition-colors ${isActive ? 'text-emerald-400' : isDarkMode ? 'text-slate-400 group-hover:text-white' : 'text-slate-500 group-hover:text-slate-900'}`}>
            {label}
          </span>
          <div className="flex items-center justify-center transition-all">
            {isActive ? (
                sortConfig.direction === 'asc' ? <ArrowUp size={10} className="text-emerald-500" /> : <ArrowDown size={10} className="text-emerald-500" />
            ) : <div className="w-2.5 h-2.5"></div>}
          </div>
        </div>
      </th>
    );
  };

  const mainTabs: { id: MainTab; label: string; icon: React.ElementType; color: string; count: number }[] = [
      { id: 'OPERACOES', label: 'Operações Consolidadas', icon: CheckCircle, color: 'text-emerald-500', count: historicalData.finalizados.length },
      { id: 'AUDITORIA', label: 'CAI (Caixa Preta)', icon: History, color: 'text-blue-500', count: auditLogs.length },
  ];

  const opsTabs: { id: OperationTab; label: string; icon: React.ElementType; color: string; count: number }[] = [
      { id: 'GERAL', label: 'Todos', icon: CheckCircle, color: 'text-slate-400', count: historicalData.finalizados.length },
      { id: 'SUCESSO', label: 'Sucesso', icon: CheckCircle, color: 'text-emerald-500', count: historicalData.sucesso.length },
      { id: 'ATRASADOS', label: 'Atrasados', icon: Clock, color: 'text-amber-500', count: historicalData.atrasados.length },
      { id: 'TROCADOS', label: 'Trocados', icon: AlertTriangle, color: 'text-purple-500', count: historicalData.trocados.length },
      { id: 'CANCELADOS', label: 'Cancelados', icon: XCircle, color: 'text-red-500', count: historicalData.cancelados.length },
  ];

  const shiftTabs: { id: ShiftTab; label: string }[] = [
      { id: 'GERAL', label: 'Todos' },
      { id: 'MANHÃ', label: 'MANHÃ (06-14H)' },
      { id: 'TARDE', label: 'TARDE (14-22H)' },
      { id: 'NOITE', label: 'NOITE (22-06H)' },
  ];

  const getStatusBadge = (flight: FlightData) => {
      if (flight.status === FlightStatus.CANCELADO) {
          return { 
              label: 'CANCELADO', 
              color: isDarkMode ? 'text-red-400 bg-red-500/10 border-red-500/30' : 'text-red-600 bg-red-50 border-red-200' 
          };
      }
      
      const hasSwap = flight.logs.some(l => l.message.toLowerCase().includes('troca'));
      if (hasSwap) {
          return { 
              label: 'COM TROCA', 
              color: isDarkMode ? 'text-purple-400 bg-purple-500/10 border-purple-500/30' : 'text-purple-600 bg-purple-50 border-purple-200' 
          };
      }

      if (isDelayed(flight) || flight.delayJustification) {
          return { 
              label: 'COM ATRASO', 
              color: isDarkMode ? 'text-amber-500 bg-amber-500/10 border-amber-500/30' : 'text-amber-600 bg-amber-50 border-amber-200' 
          };
      }

      return { 
          label: 'COM SUCESSO', 
          color: isDarkMode ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-emerald-600 bg-emerald-50 border-emerald-200' 
      };
  };

  const getReportIconStyle = (flight: FlightData) => {
      const isDelay = isDelayed(flight) || !!flight.delayJustification;
      const hasSwap = flight.logs.some(l => l.message.toLowerCase().includes('troca'));
      const hasLogs = flight.logs.length > 0; // Assumindo >0 pois sempre tem logs de sistema

      if (isDelay || hasSwap) {
          return 'text-amber-500 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20'; // Alerta
      }
      
      // Se tiver logs manuais (filtrando os de sistema para saber se é "curiosidade")
      const manualLogs = flight.logs.filter(l => l.type === 'MANUAL' || l.type === 'OBSERVACAO');
      if (manualLogs.length > 0) {
          return 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20'; // Curiosidade
      }

      return 'text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10'; // Padrão Sucesso
  };

  return (
    <div className={`w-full h-full flex flex-col ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'} overflow-hidden`}>
        
        {portalTarget && createPortal(
    <div className={`px-4 md:px-6 h-16 shrink-0 flex items-center justify-between border-b ${isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-[#E2E8F0] border-transparent text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.5)]"} z-20 w-full`}>
                {selectedFlight ? (
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => setSelectedFlight(null)}
                                    className={`flex items-center gap-2 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-700 hover:text-slate-900'} transition-all font-black text-[10px] uppercase tracking-widest bg-white/10 px-3 py-1.5 rounded border border-white/20`}
                                >
                                    <ChevronLeft size={16} /> Voltar para lista
                                </button>
                                <div className="h-6 w-px bg-slate-300 dark:bg-slate-700" />
                                <div>
                                    <h2 className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'} uppercase tracking-tighter leading-none`}>
                                        Relatório {selectedFlight.flightNumber}
                                    </h2>
                                    <p className={`text-[9px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'} font-bold uppercase tracking-tight mt-1`}>
                                        ID: {selectedFlight.id.toUpperCase()} • {selectedFlight.airline}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button 
                                    onClick={handleExportPDF}
                                    disabled={isExportingPDF}
                                    className={`flex items-center gap-2 ${isExportingPDF ? 'bg-indigo-800 opacity-60' : 'bg-indigo-600 hover:bg-indigo-550'} text-white px-4 py-1.5 rounded text-[9px] font-black uppercase tracking-widest shadow-md shadow-indigo-600/20 transition-all`}
                                >
                                    {isExportingPDF ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Gerando...
                                        </>
                                    ) : (
                                        <>
                                            <FileText size={14} /> DOWNLOAD PDF
                                        </>
                                    )}
                                </button>
                                <button 
                                    onClick={handlePrint}
                                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded text-[9px] font-black uppercase tracking-widest shadow-md shadow-emerald-600/20"
                                >
                                    <Printer size={14} /> Imprimir
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-4 flex-1">
                                <div className="shrink-0 flex items-center gap-3 pr-4 border-r border-slate-300 dark:border-slate-800">
                                    <div className="p-1.5 bg-emerald-500 rounded-md">
                                        <FileBarChart className="text-white" size={18} />
                                    </div>
                                    <div className="flex flex-col">
                                        <h1 className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'} uppercase tracking-tight leading-none`}>
                                            Relatórios
                                        </h1>
                                        <span className={`text-[8px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'} font-black uppercase tracking-tighter mt-1`}>Operações Finalizadas</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* OPERAÇÕES TAB */}
                                    <div className={`flex ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-300'} p-0.5 rounded border gap-0.5 shrink-0`}>
                                        {!isOpsExpanded ? (
                                            <button
                                                onClick={() => {
                                                    setIsOpsExpanded(true);
                                                    setIsShiftsExpanded(false);
                                                    setMainTab('OPERACOES');
                                                }}
                                                className={`
                                                    flex items-center gap-2 px-3 py-1.5 rounded-[3px] text-[9px] font-black uppercase tracking-widest transition-all
                                                    ${mainTab === 'OPERACOES' 
                                                        ? isDarkMode ? 'bg-slate-800 text-white shadow-lg border-slate-700' : 'bg-[#004D24] text-white shadow-sm' 
                                                        : isDarkMode ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}
                                                `}
                                            >
                                                <CheckCircle size={11} className={mainTab === 'OPERACOES' ? isDarkMode ? 'text-emerald-500' : 'text-white' : 'opacity-50'} />
                                                Op: {opsTabs.find(t => t.id === opsTab)?.label}
                                                <span className={`ml-1 px-1 py-0.5 rounded-[2px] text-[8px] ${mainTab === 'OPERACOES' ? isDarkMode ? 'bg-slate-950 text-white' : 'bg-[#00381a] text-white' : isDarkMode ? 'bg-slate-900 text-slate-600' : 'bg-slate-100 text-slate-400'}`}>
                                                    {opsTabs.find(t => t.id === opsTab)?.count}
                                                </span>
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-0.5">
                                                {opsTabs.map(tab => (
                                                    <button
                                                        key={tab.id}
                                                        onClick={() => {
                                                            setOpsTab(tab.id as OperationTab);
                                                            setMainTab('OPERACOES');
                                                            setIsOpsExpanded(false);
                                                        }}
                                                        className={`
                                                            flex items-center gap-1.5 px-2 py-1.5 rounded-[3px] text-[8px] font-black uppercase tracking-widest transition-all
                                                            ${opsTab === tab.id 
                                                                ? isDarkMode ? 'bg-slate-800 text-white shadow-lg' : 'bg-[#004D24] text-white shadow-sm' 
                                                                : isDarkMode ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}
                                                        `}
                                                    >
                                                        <tab.icon size={10} className={opsTab === tab.id ? isDarkMode ? tab.color : 'text-white' : 'opacity-50'} />
                                                        {tab.label}
                                                        <span className={`ml-1 px-1 py-0.5 rounded-[2px] text-[7px] ${opsTab === tab.id ? isDarkMode ? 'bg-slate-950 text-white' : 'bg-[#00381a] text-white' : isDarkMode ? 'bg-slate-900 text-slate-600' : 'bg-slate-100 text-slate-400'}`}>
                                                            {tab.count}
                                                        </span>
                                                    </button>
                                                ))}
                                                <button 
                                                onClick={() => setIsOpsExpanded(false)} 
                                                className={`p-1 mt-[1px] mb-[1px] ml-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white transition-all`}
                                                >
                                                    <ChevronLeft size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* TURNOS TAB */}
                                    <div className={`flex ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-300'} p-0.5 rounded border gap-0.5 shrink-0`}>
                                        {!isShiftsExpanded ? (
                                            <button
                                                onClick={() => {
                                                    setIsShiftsExpanded(true);
                                                    setIsOpsExpanded(false);
                                                }}
                                                className={`
                                                    flex items-center gap-2 px-3 py-1.5 rounded-[3px] text-[9px] font-black uppercase tracking-widest transition-all
                                                    ${isDarkMode ? 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}
                                                `}
                                            >
                                                <Clock size={11} className="opacity-50 text-emerald-600 dark:text-emerald-500" />
                                                Turno: {shiftTabs.find(t => t.id === activeShift)?.label}
                                                <span className={`ml-1 px-1 py-0.5 rounded-[2px] text-[8px] ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-500'}`}>
                                                    {shiftCounts[activeShift]}
                                                </span>
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-0.5">
                                                {shiftTabs.map(shift => (
                                                    <button
                                                        key={shift.id}
                                                        onClick={() => {
                                                            setActiveShift(shift.id);
                                                            setIsShiftsExpanded(false);
                                                        }}
                                                        className={`
                                                            flex items-center gap-2 px-2.5 py-1.5 rounded-[3px] text-[8px] font-black uppercase tracking-widest transition-all
                                                            ${activeShift === shift.id 
                                                                ? isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-900'
                                                                : isDarkMode ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}
                                                        `}
                                                    >
                                                        {shift.label}
                                                        <span className={`ml-1 px-1 py-0.5 rounded-[2px] text-[7px] ${activeShift === shift.id ? isDarkMode ? 'bg-slate-950 text-slate-300' : 'bg-white text-slate-700' : isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                                                            {shiftCounts[shift.id]}
                                                        </span>
                                                    </button>
                                                ))}
                                                <button 
                                                onClick={() => setIsShiftsExpanded(false)} 
                                                className={`p-1 mt-[1px] mb-[1px] ml-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white transition-all`}
                                                >
                                                    <ChevronLeft size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* AUDITORIA TAB (CAI) */}
                                    <div className={`flex ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-300'} p-0.5 rounded border gap-0.5 shrink-0`}>
                                        <button
                                            onClick={() => {
                                                setMainTab('AUDITORIA');
                                                setIsOpsExpanded(false);
                                            }}
                                            className={`
                                                flex items-center gap-2 px-3 py-1.5 rounded-[3px] text-[9px] font-black uppercase tracking-widest transition-all
                                                ${mainTab === 'AUDITORIA' 
                                                    ? isDarkMode ? 'bg-slate-800 text-blue-400 shadow-lg border-slate-700' : 'bg-[#00104D] text-white shadow-sm' 
                                                    : isDarkMode ? 'text-slate-500 hover:text-blue-400 hover:bg-slate-900' : 'text-slate-500 hover:text-blue-800 hover:bg-slate-100'}
                                            `}
                                        >
                                            <History size={11} className={mainTab === 'AUDITORIA' ? isDarkMode ? 'text-blue-400' : 'text-white' : 'opacity-50'} />
                                            CAI (Caixa Preta)
                                            <span className={`ml-1 px-1 py-0.5 rounded-[2px] text-[8px] ${mainTab === 'AUDITORIA' ? isDarkMode ? 'bg-slate-950 text-blue-400' : 'bg-blue-800 text-white' : isDarkMode ? 'bg-slate-900 text-slate-600' : 'bg-slate-100 text-slate-400'}`}>
                                                {auditLogs.length}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="relative w-56 h-8">
                                <div className={`absolute inset-0 ${isDarkMode ? 'bg-slate-950 border-slate-800 focus-within:border-emerald-500/50' : 'bg-white border-slate-300 focus-within:border-[#004D24]'} border rounded-[3px] flex items-center transition-all shadow-inner`}>
                                    <Search size={12} className="shrink-0 text-slate-400 ml-2.5" />
                                    <input 
                                        type="text" 
                                        placeholder="BUSCAR VOO..." 
                                        className={`bg-transparent border-none outline-none text-[10px] ${isDarkMode ? 'text-white' : 'text-slate-900'} font-mono uppercase w-full px-2 transition-all h-full`}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>,
            portalTarget
        )}
        
        {selectedFlight ? (
            // === VISUALIZAÇÃO DE RELATÓRIO TÉCNICO ===
            <div className={`flex-1 flex flex-col items-center overflow-y-auto ${isDarkMode ? 'bg-slate-900/90' : 'bg-slate-100/90'} backdrop-blur-sm p-8 animate-in fade-in zoom-in-95 duration-300 relative z-50`}>
                
                {/* A4 SHEET SIMULATION - ID usado pelo CSS @media print */}
                <div id="printable-report-container" className="print-report w-[210mm] min-h-[297mm] bg-white text-slate-950 p-12 shadow-2xl rounded-sm flex flex-col font-sans">
                    {/* CABEÇALHO DO DOCUMENTO EMPRESARIAL */}
                    <div className="flex justify-between items-end border-b-4 border-slate-900 pb-4 mb-6">
                        <div>
                            <h1 className="text-[18px] text-[#4e4e4e] font-black uppercase tracking-tighter flex items-center gap-3">
                                <FileBarChart size={28} className="text-slate-900" />
                                SISTEMA DE CONTROLE NOC
                            </h1>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mt-1">
                                BR Aviation • JETFUEL-SIM / Sistema de Controle NOC
                            </p>
                        </div>
                        <div className="text-right flex flex-col items-end">
                             <div className="font-mono text-[10px] text-slate-500 mb-1 tracking-widest">DOC. REF: {selectedFlight.id.split('-')[0]}-{selectedFlight.id.split('-')[1]?.substring(0,4).toUpperCase()}</div>
                             <div className="bg-[#617B7B] text-white px-3 py-1 font-mono text-xl font-black rounded-sm inline-block">
                                {selectedFlight.flightNumber}
                             </div>
                        </div>
                    </div>

                    {/* DADOS CADASTRAIS (GRID TABULAR FECHADO) */}
                    <div className="mb-6 border border-[#617B7B] bg-[#617B7B] rounded-sm overflow-hidden">
                        <div className="bg-[#617B7B] text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest flex justify-between">
                            <span>1.0 / Informações da Missão</span>
                            <span>DATA DE REFERÊNCIA: {selectedFlight.date}</span>
                        </div>
                        <div className="grid grid-cols-4 divide-x divide-y divide-slate-300 bg-white text-sm">
                            <div className="p-2">
                                <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider">COMPANHIA</span>
                                <span className="font-black text-[#626262] uppercase truncate block">{selectedFlight.airline} ({selectedFlight.airlineCode})</span>
                            </div>
                            <div className="p-2">
                                <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider">AERONAVE / REG.</span>
                                <span className="font-black text-slate-900 font-mono truncate block">{selectedFlight.registration}</span>
                            </div>
                            <div className="p-2">
                                <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider">MODELO ICAO</span>
                                <span className="font-black text-[#626262] truncate block">{selectedFlight.model}</span>
                            </div>
                            <div className="p-2">
                                <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider">ICAO / CIDADE</span>
                                <span className="font-black text-[#626262] truncate block">{selectedFlight.origin || 'N/A'} / {selectedFlight.destination}</span>
                            </div>
                            <div className="p-2">
                                <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider">POSIÇÃO (PÁTIO)</span>
                                <span className="font-black text-slate-900 font-mono truncate block">{selectedFlight.positionId}</span>
                            </div>
                            <div className="p-2">
                                <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider">ETD (SAÍDA PRESUMIDA)</span>
                                <span className="font-black text-slate-900 font-mono truncate block">{selectedFlight.etd}</span>
                            </div>
                            <div className="p-2">
                                <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider">FROTA / OPERAÇÃO</span>
                                <span className="font-black text-[#626262] uppercase truncate block">{selectedFlight.fleet ? `CTA-${selectedFlight.fleet}` : 'REDE HIDRANTE'}</span>
                            </div>
                            <div className="p-2">
                                <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider">EQP. / VEÍCULO</span>
                                <span className="font-black text-[#626262] uppercase truncate block">{selectedFlight.vehicleType || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    {/* EXECUÇÃO E VOLUMETRIA EM DUAS COLUNAS */}
                    <div className="flex gap-4 mb-6">
                        {/* LEFT: TIMELINE DE OPERAÇÃO */}
                        <div className="flex-1 border border-[#617B7B] rounded-sm overflow-hidden flex flex-col">
                            <div className="bg-[#617B7B] text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest">
                                2.0 / Linha de Tempos Oficiais
                            </div>
                            <table className="w-full text-left bg-white text-sm">
                                <tbody className="divide-y divide-slate-200">
                                    <tr>
                                        <td className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase w-1/2">Hora Confirmação</td>
                                        <td className="px-3 py-1.5 text-right font-mono font-black text-slate-900">
                                            {selectedFlight.designationTime ? new Date(selectedFlight.designationTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase w-1/2">Início Bombeamento</td>
                                        <td className="px-3 py-1.5 text-right font-mono font-black text-slate-900">
                                            {selectedFlight.startTime ? new Date(selectedFlight.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase w-1/2">Término Real</td>
                                        <td className="px-3 py-1.5 text-right font-mono font-black text-slate-900">
                                            {selectedFlight.endTime ? new Date(selectedFlight.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase w-1/2 bg-slate-50 border-0">Operador NOC</td>
                                        <td className="px-3 py-1.5 text-right bg-slate-50 border-0">
                                            <span className="font-bold text-slate-900 text-[10px] px-2 py-0.5 bg-slate-200 rounded-sm inline-block">
                                                {selectedFlight.operator || 'NÃO DESIGNADO'}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* RIGHT: VOLUMETRIA */}
                        <div className="flex-1 border border-[#617B7B] rounded-sm overflow-hidden flex flex-col">
                            <div className="bg-[#617B7B] text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest">
                                3.0 / Fechamento Volumétrico
                            </div>
                            <table className="w-full text-left bg-white text-sm h-full">
                                <tbody className="divide-y divide-slate-200">
                                    <tr>
                                        <td className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase w-1/2">Volume (Litros Totais)</td>
                                        <td className="px-3 py-1.5 text-right font-mono text-lg font-black text-slate-900">
                                            {selectedFlight.volume?.toLocaleString() || 0} <span className="text-[10px] text-slate-500 font-bold ml-1">L</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase w-1/2">Conversão (US GAL)</td>
                                        <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-900 text-xs">
                                            {selectedFlight.volume ? Math.round(selectedFlight.volume * 0.264172).toLocaleString() : 0} GAL
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase w-1/2">Massa Estimada (KG)<br/><span className="text-[7px] text-slate-400">@ 0.803 DENS</span></td>
                                        <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-900 text-xs">
                                            {selectedFlight.volume ? Math.round(selectedFlight.volume * 0.803).toLocaleString() : 0} KG
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ALERTA DE ATRASO OBRIGATÓRIO */}
                    {selectedFlight.delayJustification && (
                        <div className="mb-6 border-2 border-[#617B7B] rounded-sm overflow-hidden flex flex-col relative print-avoid-break">
                            <div className="absolute top-0 left-0 bottom-0 w-2.5 bg-[#617B7B]"></div>
                            <div className="bg-slate-100 border-b border-slate-300 pl-4 py-1.5 px-3">
                                <div className="text-[10px] font-black uppercase tracking-widest text-[#696969] flex items-center gap-2">
                                    <AlertTriangle size={12} className="text-[#696969]" />
                                    JUSTIFICATIVA DE QUEBRA DE SLA (ATRASO DETECTADO)
                                </div>
                            </div>
                            <div className="bg-white pl-4 p-3 text-slate-800 text-xs font-mono border-l-2 border-transparent">
                                <b>PARECER TÉCNICO:</b> "{selectedFlight.delayJustification}"
                            </div>
                        </div>
                    )}

                    {/* OBSERVAÇÕES DE PÁTIO */}
                    {selectedFlight.report && Object.values(selectedFlight.report).some(v => v) && (
                        <div className="mb-6 border border-[#617B7B] rounded-sm overflow-hidden print-avoid-break">
                            <div className="bg-[#617B7B] text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest">
                                4.0 / Anotações de Pátio e Assinaturas
                            </div>
                            <div className="p-3 bg-white grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between border-b border-slate-100 border-dashed pb-1">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">FUEL ORDER COLETADA</span>
                                        <span className="font-mono font-bold text-slate-900">{selectedFlight.report.fuelOrderTime || '--:--'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-100 border-dashed pb-1">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">APRESENTAÇÃO MECÂNICA</span>
                                        <span className="font-mono font-bold text-slate-900">{selectedFlight.report.mechanicTime || '--:--'}</span>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between border-b border-slate-100 border-dashed pb-1">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">CHEGADA DA TRIPULAÇÃO</span>
                                        <span className="font-mono font-bold text-slate-900">{selectedFlight.report.crewTime || '--:--'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-100 border-dashed pb-1">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">TÉRMINO (ÁREA DESOBSTR.)</span>
                                        <span className="font-mono font-bold text-slate-900">{selectedFlight.report.obstructedAreaTime || '--:--'}</span>
                                    </div>
                                </div>
                            </div>
                            
                            {selectedFlight.report.dispensed && (
                                <div className="border-t border-slate-300 bg-slate-100 p-2 text-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">
                                        *** DISPENSA FORMALIZADA PELO RESPONSÁVEL DO VOO ***
                                    </span>
                                </div>
                            )}
                            
                            {(selectedFlight.report.observations || selectedFlight.report.dispensed) && (
                                <div className="border-t border-slate-300 p-3 bg-white text-xs">
                                    <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">OBSERVAÇÕES DO OPERADOR:</span>
                                    <p className="font-mono bg-slate-50 border border-slate-300 shadow-inner p-2 rounded-sm italic">
                                        {selectedFlight.report.dispensed && !selectedFlight.report.observations 
                                            ? `Voo sem abastecimento solicitado por: ${selectedFlight.report.dispensedBy} (Colete ${selectedFlight.report.dispensedBadge})`
                                            : selectedFlight.report.observations}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* CAIXA PRETA / AUDITORIA */}
                    <div className="mb-6 flex-1 print-avoid-break">
                        <div className="pb-1 mb-3 flex items-center gap-2 border-solid border-0 text-[#939393]">
                            <History size={14} className="text-slate-900" />
                            <h2 className="text-[11px] font-black uppercase tracking-wider text-[#696969]">
                                5.0 / Trilha de Auditoria do Sistema (Caixa Preta)
                            </h2>
                        </div>
                        <div className="bg-white border-2 border-[#cfcfcf] rounded-sm overflow-hidden">
                           <table className="w-full text-left text-[9px] border-collapse">
                               <thead className="text-white font-black uppercase tracking-wider">
                                    <tr>
                                        <th className="px-2 py-1.5 w-[15%] bg-[#617B7B]">Timestamp</th>
                                        <th className="px-2 py-1.5 w-[15%] bg-[#617B7B]">Ação Oficial</th>
                                        <th className="px-2 py-1.5 w-[20%] bg-[#617B7B]">Autor / Matrícula</th>
                                        <th className="px-2 py-1.5 w-[50%] border-l border-slate-700 bg-[#617B7B]">Descrição/Contexto Operacional</th>
                                    </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-300 font-mono font-bold text-[8px]">
                                    {selectedFlight.logs && selectedFlight.logs.length > 0 ? (
                                        selectedFlight.logs.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((log, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="px-2 py-2 text-slate-600">{new Date(log.timestamp).toLocaleString()}</td>
                                                <td className="px-2 py-2">
                                                    <span className={`${log.type === 'ALERTA' || log.type === 'ATRASO' ? 'bg-slate-900 text-white px-1.5 py-0.5 rounded-sm' : 'text-slate-900'}`}>
                                                        {log.type}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-2 truncate max-w-[120px] text-slate-900">{log.author}</td>
                                                <td className="px-2 py-2 text-slate-900 break-words border-l border-slate-200">{log.message}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="px-2 py-4 text-center text-slate-400 italic font-sans font-bold">
                                                NÃO ASSINALADO - NENHUM EVENTO REGISTRADO
                                            </td>
                                        </tr>
                                    )}
                               </tbody>
                           </table>
                        </div>
                    </div>



                </div>
            </div>
        ) : (
            // === LISTA DE RELATÓRIOS (DASHBOARD) ===
            <>
                <div className={`flex-1 overflow-hidden relative ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
                    <div className="w-full h-full overflow-auto custom-scrollbar">
                        {mainTab === 'AUDITORIA' ? (
                            <table className="w-full text-left border-collapse min-w-max">
                                <thead className="z-40">
                                    <tr className={`h-12 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
                                        <th className={`px-4 border-b border-r ${isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'} sticky top-0 text-left z-20 text-[9px] uppercase font-black tracking-wider`}>DATA/HORA</th>
                                        <th className={`px-4 border-b border-r ${isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'} sticky top-0 text-left z-20 text-[9px] uppercase font-black tracking-wider`}>AÇÃO (CAI)</th>
                                        <th className={`px-4 border-b border-r ${isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'} sticky top-0 text-left z-20 text-[9px] uppercase font-black tracking-wider`}>VOO / PRF</th>
                                        <th className={`px-4 border-b border-r ${isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'} sticky top-0 text-left z-20 text-[9px] uppercase font-black tracking-wider`}>MUDANÇA</th>
                                        <th className={`px-4 border-b border-r ${isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'} sticky top-0 text-left z-20 text-[9px] uppercase font-black tracking-wider`}>USUÁRIO</th>
                                        <th className={`px-4 border-b ${isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'} sticky top-0 text-left z-20 text-[9px] uppercase font-black tracking-wider`}>METADADOS</th>
                                    </tr>
                                </thead>
                                <tbody className="text-[11px] font-bold">
                                    {auditLogs.length > 0 ? (
                                        auditLogs.map((log, idx) => (
                                            <tr key={idx} className={`h-12 border-b ${isDarkMode ? 'border-slate-800/30 hover:bg-slate-900' : 'border-slate-200/50 hover:bg-slate-50'} transition-colors`}>
                                                <td className={`px-4 border-r ${isDarkMode ? 'border-slate-800/50 text-slate-400' : 'border-slate-200/50 text-slate-600'} font-mono`}>
                                                    {log.created_at ? new Date(log.created_at).toLocaleString() : '--'}
                                                </td>
                                                <td className={`px-4 border-r ${isDarkMode ? 'border-slate-800/50' : 'border-slate-200/50'}`}>
                                                    <span className={`px-2 py-1 rounded text-[9px] uppercase ${isDarkMode ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                                                        {log.action_type}
                                                    </span>
                                                </td>
                                                <td className={`px-4 border-r ${isDarkMode ? 'border-slate-800/50 text-white' : 'border-slate-200/50 text-slate-900'} font-mono`}>
                                                    {log.flight_number || '--'} {log.registration ? `(${log.registration})` : ''}
                                                </td>
                                                <td className={`px-4 border-r ${isDarkMode ? 'border-slate-800/50 text-slate-300' : 'border-slate-200/50 text-slate-700'}`}>
                                                    {log.field_changed ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] uppercase tracking-wider text-slate-500">{log.field_changed}:</span>
                                                            <span className="line-through text-red-500">{log.old_value || 'VAZIO'}</span>
                                                            <span>&rarr;</span>
                                                            <span className="text-emerald-500">{log.new_value || 'VAZIO'}</span>
                                                        </div>
                                                    ) : '--'}
                                                </td>
                                                <td className={`px-4 border-r ${isDarkMode ? 'border-slate-800/50 text-slate-300' : 'border-slate-200/50 text-slate-700'}`}>
                                                    <div className="flex flex-col">
                                                        <span>{log.user_name}</span>
                                                        <span className="text-[9px] text-slate-500">{log.user_role}</span>
                                                    </div>
                                                </td>
                                                <td className={`px-4 truncate max-w-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} font-mono text-[9px]`}>
                                                    {log.metadata ? JSON.stringify(log.metadata) : '{}'}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="py-20 text-center">
                                                <div className="flex flex-col items-center opacity-30">
                                                    <History size={48} className="mb-4 text-slate-500" />
                                                    <span className="text-sm font-black text-slate-500 uppercase tracking-widest">A Caixa Preta está vazia</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full text-left border-collapse min-w-max">
                                <thead className="z-40">
                                    <tr className={`h-12 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
                                    <SortableHeader label="CIA" columnKey="airlineCode" className="w-24 text-center" />
                                    <SortableHeader label="V.SAÍDA" columnKey="flightNumber" className="w-20 text-center" />
                                    <SortableHeader label="PREFIXO" columnKey="registration" className="w-24 text-center" />
                                    <SortableHeader label="DESTINO" columnKey="destination" className="w-24 text-center" />
                                    <SortableHeader label="POS" columnKey="positionId" className="w-16 text-center" />
                                    <SortableHeader label="INÍCIO" columnKey="startTime" className="w-24 text-center" />
                                    <SortableHeader label="FIM" columnKey="endTime" className="w-24 text-center" />
                                    <th className={`w-16 px-3 border-b border-r ${isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'} sticky top-0 text-center z-20 text-[9px] uppercase font-black tracking-wider`}>TAB</th>
                                    <th className={`w-24 px-3 border-b border-r ${isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'} sticky top-0 text-center z-20 text-[9px] uppercase font-black tracking-wider`}>TURNOS</th>
                                    <SortableHeader label="OPERADOR" columnKey="operator" className="w-48 text-center" />
                                    <SortableHeader label="VOLUME (L)" columnKey="volume" className="w-24 text-center border-r-0" />
                                    <th className={`w-48 px-3 border-b ${isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'} sticky top-0 text-center z-20 text-[9px] uppercase font-black tracking-wider`}>STATUS FINAL</th>
                                </tr>
                            </thead>
                            <tbody className="text-[11px] font-bold">
                                {sortedData.length > 0 ? (
                                    sortedData.map(flight => {
                                        const badge = getStatusBadge(flight);
                                        const tabMinutes = flight.startTime && flight.endTime 
                                            ? Math.floor((new Date(flight.endTime).getTime() - new Date(flight.startTime).getTime()) / 60000)
                                            : null;
                                        
                                        const flightShift = getShift(flight.endTime || flight.startTime);
                                        const operatorProfile = operators.find(p => p.warName === flight.operator);

                                        // Dynamic font color for "Histórico Geral" based on status
                                        const isGeneralHistory = opsTab === 'GERAL';
                                        const statusColorClass = isGeneralHistory ? badge.color.split(' ')[0] : isDarkMode ? 'text-slate-400' : 'text-slate-500';
                                        const whiteColorClass = isGeneralHistory ? badge.color.split(' ')[0] : isDarkMode ? 'text-white' : 'text-slate-900';
                                        const emeraldColorClass = isGeneralHistory ? badge.color.split(' ')[0] : 'text-emerald-500';

                                        return (
                                        <tr 
                                            key={flight.id}
                                            onClick={() => setSelectedFlight(flight)}
                                            className={`h-14 border-b ${isDarkMode ? 'border-slate-800/30 hover:bg-slate-900' : 'border-slate-200/50 hover:bg-slate-50'} cursor-pointer transition-colors group`}
                                        >
                                            <td className={`px-2 border-r ${isDarkMode ? 'border-slate-800/50' : 'border-slate-200/50'} text-center font-extrabold uppercase text-[11px] truncate max-w-[80px]`}>
                                                {formatAirlineName(flight.airline || flight.airlineCode || '')}
                                            </td>
                                            <td className={`px-2 border-r ${isDarkMode ? 'border-slate-800/50' : 'border-slate-200/50'} text-center ${whiteColorClass} font-mono tracking-tighter`}>{flight.flightNumber}</td>
                                            <td className={`px-2 border-r ${isDarkMode ? 'border-slate-800/50' : 'border-slate-200/50'} text-center font-mono ${emeraldColorClass} tracking-tighter uppercase`}>{flight.registration}</td>
                                            <td className={`px-2 border-r ${isDarkMode ? 'border-slate-800/50' : 'border-slate-200/50'} text-center font-mono ${statusColorClass}`}>{ICAO_CITIES[flight.destination] || flight.destination}</td>
                                            <td className={`px-2 border-r ${isDarkMode ? 'border-slate-800/50' : 'border-slate-200/50'} text-center`}>
                                                <span className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'} border ${statusColorClass} px-2 py-1 font-mono text-[10px] rounded`}>{flight.positionId}</span>
                                            </td>
                                            <td className={`px-2 border-r ${isDarkMode ? 'border-slate-800/50' : 'border-slate-200/50'} text-center font-mono ${statusColorClass}`}>{flight.startTime ? flight.startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</td>
                                            <td className={`px-2 border-r ${isDarkMode ? 'border-slate-800/50' : 'border-slate-200/50'} text-center font-mono ${statusColorClass}`}>{flight.endTime ? flight.endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</td>
                                            <td className={`px-2 border-r ${isDarkMode ? 'border-slate-800/50' : 'border-slate-200/50'} text-center font-mono ${whiteColorClass}`}>{tabMinutes !== null ? `${tabMinutes}'` : '--'}</td>
                                            <td className={`px-2 border-r ${isDarkMode ? 'border-slate-800/50' : 'border-slate-200/50'} text-center font-mono ${statusColorClass} uppercase`}>{flightShift}</td>
                                            <td className={`px-2 border-r ${isDarkMode ? 'border-slate-800/50' : 'border-slate-200/50'}`}>
                                                <div className="flex justify-start pl-8">
                                                    <OperatorCell operatorName={flight.operator} operators={operators} />
                                                </div>
                                            </td>
                                            <td className={`px-2 border-r ${isDarkMode ? 'border-slate-800/50' : 'border-slate-200/50'} text-center font-mono ${whiteColorClass}`}>{flight.volume?.toLocaleString() || 0}</td>
                                            <td className="px-3 text-center">
                                                <div className="flex justify-center items-center">
                                                    <div className={`w-[90%] py-1 rounded border text-[9px] font-black uppercase tracking-wider ${badge.color}`}>
                                                        {badge.label}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )})
                        ) : (
                            <tr>
                                <td colSpan={12} className="py-20 text-center">
                                    <div className="flex flex-col items-center opacity-30">
                                        <FileBarChart size={48} className="mb-4 text-slate-500" />
                                        <span className="text-sm font-black text-slate-500 uppercase tracking-widest">Nenhum registro encontrado nesta categoria</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                        </tbody>
                        </table>
                        )}
                    </div>
                </div>
            </>
        )}
    </div>
  );
};
