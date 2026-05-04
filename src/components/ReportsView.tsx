import React, { useState, useMemo } from 'react';
import { FlightStatus, FlightData } from '../types';
import { MOCK_TEAM_PROFILES } from '../data/mockData';
import { OperatorCell } from './OperatorCell';
import { AirlineLogo } from './AirlineLogo';
import { 
  FileText, CheckCircle, Clock, AlertTriangle, XCircle, 
  Printer, Download, ChevronLeft, Calendar, FileBarChart,
  User, MapPin, Hash, Truck, History, MessageSquare, Headphones, Search, TimerOff,
  ArrowUp, ArrowDown
} from 'lucide-react';

interface ReportsViewProps {
    flights: FlightData[];
    initialFlight?: FlightData | null;
}

type ReportTab = 'FINALIZADOS' | 'SUCESSO' | 'ATRASADOS' | 'TROCADOS' | 'CANCELADOS';
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
    return flight.endTime.getTime() > etdDate.getTime();
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

export const ReportsView: React.FC<ReportsViewProps> = ({ flights, initialFlight }) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('FINALIZADOS');
  const [activeShift, setActiveShift] = useState<ShiftTab>('GERAL');
  const [selectedFlight, setSelectedFlight] = useState<FlightData | null>(initialFlight || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null });

  const shiftCounts = useMemo(() => {
      const base = flights.filter(f => f.status === FlightStatus.FINALIZADO || f.status === FlightStatus.CANCELADO);
      
      // Filter by active tab category
      let categoryFiltered = base;
      switch(activeTab) {
          case 'SUCESSO': categoryFiltered = base.filter(f => f.status === FlightStatus.FINALIZADO && !isDelayed(f) && !f.logs.some(l => l.message.toLowerCase().includes('troca'))); break;
          case 'ATRASADOS': categoryFiltered = base.filter(f => f.status === FlightStatus.FINALIZADO && isDelayed(f)); break;
          case 'TROCADOS': categoryFiltered = base.filter(f => f.status === FlightStatus.FINALIZADO && f.logs.some(l => l.message.toLowerCase().includes('troca'))); break;
          case 'CANCELADOS': categoryFiltered = base.filter(f => f.status === FlightStatus.CANCELADO); break;
      }

      return {
          GERAL: categoryFiltered.length,
          MANHÃ: categoryFiltered.filter(f => getShift(f.endTime || f.startTime) === 'MANHÃ').length,
          TARDE: categoryFiltered.filter(f => getShift(f.endTime || f.startTime) === 'TARDE').length,
          NOITE: categoryFiltered.filter(f => getShift(f.endTime || f.startTime) === 'NOITE').length,
      };
  }, [flights, activeTab]);

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
      switch(activeTab) {
          case 'FINALIZADOS': list = historicalData.finalizados; break;
          case 'SUCESSO': list = historicalData.sucesso; break;
          case 'ATRASADOS': list = historicalData.atrasados; break;
          case 'TROCADOS': list = historicalData.trocados; break;
          case 'CANCELADOS': list = historicalData.cancelados; break;
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
  }, [activeTab, historicalData, searchTerm]);

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

  const handlePrint = () => {
      window.print();
  };

  const SortableHeader = ({ label, columnKey, className = "" }: { label: string, columnKey: keyof FlightData, className?: string }) => {
    const isActive = sortConfig.key === columnKey;
    return (
      <th 
        className={`px-3 py-4 border-b border-r border-slate-700 bg-slate-900 sticky top-0 cursor-pointer select-none hover:bg-slate-800 transition-all group z-20 ${className}`}
        onClick={() => handleSort(columnKey)}
      >
        <div className={`flex items-center gap-1.5 ${className.includes('text-center') ? 'justify-center' : 'justify-start'}`}>
          <span className={`font-black text-[9px] uppercase tracking-wider transition-colors ${isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-white'}`}>
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

  const tabs: { id: ReportTab; label: string; icon: React.ElementType; color: string; count: number }[] = [
      { id: 'FINALIZADOS', label: 'Geral', icon: CheckCircle, color: 'text-slate-400', count: historicalData.finalizados.length },
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
          return { label: 'CANCELADO', color: 'text-red-400 bg-red-500/10 border-red-500/30' };
      }
      
      const hasSwap = flight.logs.some(l => l.message.toLowerCase().includes('troca'));
      if (hasSwap) {
          return { label: 'COM TROCA', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' };
      }

      if (isDelayed(flight) || flight.delayJustification) {
          return { label: 'COM ATRASO', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' };
      }

      return { label: 'COM SUCESSO', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
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
    <div className="w-full h-full flex flex-col bg-slate-950 overflow-hidden">
        
        {selectedFlight ? (
            // === VISUALIZAÇÃO DE RELATÓRIO TÉCNICO ===
            <div className="flex-1 flex flex-col items-center overflow-y-auto bg-slate-900/90 backdrop-blur-sm p-8 animate-in fade-in zoom-in-95 duration-300 relative z-50">
                
                {/* ACTIONS BAR (Classe no-print oculta isso na impressão) */}
                <div className="w-full max-w-[210mm] flex justify-between items-center mb-6 text-white no-print">
                    <button 
                        onClick={() => setSelectedFlight(null)}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <ChevronLeft size={20} /> Voltar
                    </button>
                    <div className="flex gap-3">
                        <button 
                            onClick={handlePrint}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md transition-all text-sm font-medium shadow-lg shadow-emerald-600/20"
                        >
                            <Printer size={16} /> Imprimir
                        </button>
                    </div>
                </div>

                {/* A4 SHEET SIMULATION - ID usado pelo CSS @media print */}
                <div id="printable-report-container" className="print-report w-[210mm] min-h-[297mm] bg-white text-slate-950 p-12 shadow-2xl rounded-sm flex flex-col font-sans">
                    
                    {/* CABEÇALHO */}
                    <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-tight mb-1 flex items-center gap-2">
                                <FileBarChart size={24} className="text-slate-900" />
                                Relatório de Operações
                            </h1>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                Registro Operacional • ID: {selectedFlight.id.toUpperCase()}
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="block text-3xl font-mono font-black text-slate-900">{selectedFlight.flightNumber}</span>
                            <span className="block text-xs font-bold uppercase text-slate-500 mt-1">
                                {new Date().toLocaleDateString()} • {new Date().toLocaleTimeString()}
                            </span>
                        </div>
                    </div>

                    {/* ALERT DE ATRASO SE HOUVER */}
                    {selectedFlight.delayJustification && (
                        <div className="mb-8 border border-amber-500/50 bg-amber-50 rounded-md p-4 flex gap-4 items-start">
                            <div className="text-amber-600 shrink-0 mt-1">
                                <TimerOff size={24} />
                            </div>
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-widest text-amber-700 mb-1">
                                    Análise de Discrepância de Horário (Atraso)
                                </h3>
                                <p className="text-xs font-medium text-slate-800 leading-relaxed">
                                    <span className="font-bold">ETD Previsto:</span> {selectedFlight.etd} • <span className="font-bold">Finalização Real:</span> {selectedFlight.endTime?.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                </p>
                                <div className="mt-2 text-xs text-slate-900 border-l-2 border-amber-500 pl-3 italic">
                                    "{selectedFlight.delayJustification}"
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DADOS DO VOO (GRID SIMPLES) */}
                    <div className="mb-8">
                        <h2 className="text-xs font-black uppercase tracking-widest border-b border-slate-300 pb-1 mb-3 text-slate-600">
                            Dados da Missão
                        </h2>
                        <div className="grid grid-cols-4 gap-y-4 gap-x-8 text-sm">
                            <div>
                                <span className="block text-[10px] font-bold text-slate-500 uppercase">Companhia</span>
                                <span className="font-bold text-slate-900">{selectedFlight.airline} ({selectedFlight.airlineCode})</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold text-slate-500 uppercase">Aeronave</span>
                                <span className="font-bold text-slate-900 font-mono">{selectedFlight.registration}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold text-slate-500 uppercase">Modelo</span>
                                <span className="font-bold text-slate-900">{selectedFlight.model}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold text-slate-500 uppercase">Rota</span>
                                <span className="font-bold text-slate-900">{selectedFlight.origin} / {selectedFlight.destination}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold text-slate-500 uppercase">Posição</span>
                                <span className="font-bold text-slate-900">{selectedFlight.positionId}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold text-slate-500 uppercase">ETD (Saída)</span>
                                <span className="font-bold text-slate-900 font-mono">{selectedFlight.etd}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold text-slate-500 uppercase">Frota Utilizada</span>
                                <span className="font-bold text-slate-900 uppercase">{selectedFlight.fleet ? `CTA-${selectedFlight.fleet}` : 'REDE HIDRANTE'}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold text-slate-500 uppercase">Tipo Eqp.</span>
                                <span className="font-bold text-slate-900 uppercase">{selectedFlight.vehicleType}</span>
                            </div>
                        </div>
                    </div>

                    {/* DADOS OPERACIONAIS E VOLUMETRIA */}
                    <div className="mb-8">
                        <h2 className="text-xs font-black uppercase tracking-widest border-b border-slate-300 pb-1 mb-3 text-slate-600">
                            Execução e Volumetria
                        </h2>
                        
                        {/* Linha de Tempos */}
                        <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 rounded border border-slate-200">
                            <div>
                                <span className="block text-[10px] font-bold text-slate-500 uppercase">Hora Designação</span>
                                <span className="font-mono font-bold text-slate-900">
                                    {selectedFlight.designationTime ? selectedFlight.designationTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                                </span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold text-slate-500 uppercase">Início Abastecimento</span>
                                <span className="font-mono font-bold text-slate-900">
                                    {selectedFlight.startTime ? selectedFlight.startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                                </span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold text-slate-500 uppercase">Término Abastecimento</span>
                                <span className="font-mono font-bold text-slate-900">
                                    {selectedFlight.endTime ? selectedFlight.endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                                </span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold text-slate-500 uppercase">Operador Responsável</span>
                                <div className="mt-1">
                                    <OperatorCell operatorName={selectedFlight.operator} />
                                </div>
                            </div>
                        </div>

                        {/* Tabela de Volumes */}
                        <div className="border border-slate-300 rounded overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                    <tr>
                                        <th className="px-4 py-2 border-r border-slate-300">Unidade</th>
                                        <th className="px-4 py-2 text-right">Quantidade Fornecida</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 text-slate-900 font-mono font-bold">
                                    <tr>
                                        <td className="px-4 py-2 border-r border-slate-200 text-xs uppercase">Litros (L)</td>
                                        <td className="px-4 py-2 text-right">{selectedFlight.volume?.toLocaleString() || 0}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-2 border-r border-slate-200 text-xs uppercase">Quilogramas (KG) <span className="text-[9px] text-slate-400 font-normal">@0.803</span></td>
                                        <td className="px-4 py-2 text-right">
                                            {selectedFlight.volume ? Math.round(selectedFlight.volume * AVG_DENSITY).toLocaleString() : 0}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-2 border-r border-slate-200 text-xs uppercase">Galões (US GAL)</td>
                                        <td className="px-4 py-2 text-right">
                                            {selectedFlight.volume ? Math.round(selectedFlight.volume * L_TO_GAL).toLocaleString() : 0}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* CAIXA PRETA - LOG DE EVENTOS */}
                    <div className="mb-8">
                        <h2 className="text-xs font-black uppercase tracking-widest border-b border-slate-300 pb-1 mb-4 text-slate-600 flex items-center gap-2">
                            <History size={14} /> Log de Eventos (Caixa Preta)
                        </h2>
                        
                        <div className="border-l-2 border-slate-200 ml-2 space-y-3 py-1">
                            {selectedFlight.logs && selectedFlight.logs.length > 0 ? (
                                selectedFlight.logs.sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime()).map((log, idx) => (
                                    <div key={idx} className="relative pl-6">
                                        <div className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                            log.type === 'SISTEMA' ? 'bg-slate-400' : 
                                            log.type === 'MANUAL' ? 'bg-blue-500' :
                                            log.type === 'ATRASO' ? 'bg-amber-500' :
                                            log.type === 'OBSERVACAO' ? 'bg-amber-500' : 'bg-red-500'
                                        }`}></div>
                                        <div className="flex flex-col">
                                            <div className="flex items-baseline gap-2 text-[10px] uppercase font-bold text-slate-500">
                                                <span className="font-mono text-slate-800">{log.timestamp.toLocaleTimeString()}</span>
                                                <span>•</span>
                                                <span>{log.type}</span>
                                                <span>•</span>
                                                <span className="text-slate-700">{log.author}</span>
                                            </div>
                                            <p className="text-xs text-slate-800 mt-0.5 font-medium leading-relaxed">
                                                {log.message}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="pl-6 text-xs text-slate-400 italic">Nenhum evento registrado.</div>
                            )}
                        </div>
                    </div>

                    {/* RELATÓRIO DO CAMPO */}
                    {selectedFlight.report && Object.values(selectedFlight.report).some(v => v) && (
                        <div className="mb-8">
                            <h2 className="text-xs font-black uppercase tracking-widest border-b border-slate-300 pb-1 mb-4 text-slate-600 flex items-center gap-2">
                                <FileText size={14} /> Relatório de Campo Adicional
                            </h2>
                            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                {selectedFlight.report.fuelOrderTime && (
                                    <div><span className="block text-[10px] font-bold text-slate-500 uppercase">Fuel Order</span><span className="font-mono">{selectedFlight.report.fuelOrderTime}</span></div>
                                )}
                                {selectedFlight.report.mechanicTime && (
                                    <div><span className="block text-[10px] font-bold text-slate-500 uppercase">Mecânico</span><span className="font-mono">{selectedFlight.report.mechanicTime}</span></div>
                                )}
                                {selectedFlight.report.crewTime && (
                                    <div><span className="block text-[10px] font-bold text-slate-500 uppercase">Tripulação</span><span className="font-mono">{selectedFlight.report.crewTime}</span></div>
                                )}
                                {selectedFlight.report.authorizationTime && (
                                    <div><span className="block text-[10px] font-bold text-slate-500 uppercase">Autorização</span><span className="font-mono">{selectedFlight.report.authorizationTime}</span></div>
                                )}
                                {selectedFlight.report.obstructedAreaTime && (
                                    <div className="text-red-600"><span className="block text-[10px] font-bold uppercase">Área Desobstruída</span><span className="font-mono">{selectedFlight.report.obstructedAreaTime}</span></div>
                                )}
                            </div>
                            
                            {selectedFlight.report.dispensed && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm mb-4">
                                    <h4 className="font-bold text-[10px] uppercase tracking-wider mb-1">Dispensa de Abastecimento</h4>
                                    <p>Resp: <span className="font-bold">{selectedFlight.report.dispensedBy}</span> | Colete: <span className="font-mono font-bold">{selectedFlight.report.dispensedBadge}</span></p>
                                </div>
                            )}

                            {selectedFlight.report.observations && (
                                <div className="text-sm">
                                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Observações Gerais</span>
                                    <p className="p-3 bg-slate-50 border border-slate-200 mt-1 italic text-slate-700">{selectedFlight.report.observations}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* RODAPÉ DO SISTEMA */}
                    <div className="mt-auto pt-6 border-t border-slate-200 text-[9px] font-mono text-slate-400 text-center uppercase tracking-widest">
                        JETFUEL-SIM Audit System • Documento Gerado Eletronicamente • Não Requer Assinatura
                    </div>

                </div>
            </div>
        ) : (
            // === LISTA DE RELATÓRIOS (DASHBOARD) ===
            <>
                <div className="min-h-[160px] py-6 bg-slate-900 border-b border-slate-800 flex flex-col justify-center px-8 shrink-0 gap-6">
                    <div className="flex items-center gap-8">
                        <div className="shrink-0">
                            <h1 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3 whitespace-nowrap">
                                <FileBarChart className="text-emerald-500" size={28} />
                                Relatórios de Operações
                            </h1>
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mt-1 block">A caixa preta dos abastecimentos!</span>
                        </div>
                        
                        <div className="flex bg-slate-950 p-1 rounded-md border border-slate-800 gap-1 shrink-0 ml-auto">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        flex items-center gap-2 px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all
                                        ${activeTab === tab.id 
                                            ? 'bg-slate-800 text-white shadow-lg border border-slate-700' 
                                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}
                                    `}
                                >
                                    <tab.icon size={14} className={activeTab === tab.id ? tab.color : 'opacity-50'} />
                                    {tab.label}
                                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] ${activeTab === tab.id ? 'bg-slate-950 text-white' : 'bg-slate-900 text-slate-600'}`}>
                                        {tab.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mr-2">Filtrar por Turno:</span>
                            <div className="flex gap-2">
                                {shiftTabs.map(shift => (
                                    <button
                                        key={shift.id}
                                        onClick={() => setActiveShift(shift.id)}
                                        className={`
                                            flex items-center gap-2 px-5 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all border
                                            ${activeShift === shift.id 
                                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                                                : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-700'}
                                        `}
                                    >
                                        {shift.label}
                                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] ${activeShift === shift.id ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
                                            {shiftCounts[shift.id]}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="relative w-72 h-10">
                            <div className="absolute inset-0 bg-slate-950 border border-slate-800 rounded-md flex items-center transition-all focus-within:border-emerald-500/50">
                                <Search size={14} className="shrink-0 text-slate-500 ml-3" />
                                <input 
                                    type="text" 
                                    placeholder="BUSCAR POR VOO, PREFIXO, POSIÇÃO..." 
                                    className="bg-transparent border-none outline-none text-[10px] text-white font-mono uppercase w-full px-3 transition-all h-full"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden relative bg-slate-950">
                    <div className="w-full h-full overflow-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-max">
                            <thead className="z-40">
                                <tr className="h-12 bg-slate-900">
                                    <SortableHeader label="COMP." columnKey="airlineCode" className="w-24 text-center" />
                                    <SortableHeader label="V.SAÍDA" columnKey="flightNumber" className="w-20 text-center" />
                                    <SortableHeader label="PREFIXO" columnKey="registration" className="w-24 text-center" />
                                    <SortableHeader label="DESTINO" columnKey="destination" className="w-24 text-center" />
                                    <SortableHeader label="POS" columnKey="positionId" className="w-16 text-center" />
                                    <SortableHeader label="INÍCIO" columnKey="startTime" className="w-24 text-center" />
                                    <SortableHeader label="FIM" columnKey="endTime" className="w-24 text-center" />
                                    <th className="w-16 px-3 border-b border-r border-slate-700 bg-slate-900 sticky top-0 text-center z-20 text-[9px] text-slate-400 uppercase font-black tracking-wider">TAB</th>
                                    <th className="w-24 px-3 border-b border-r border-slate-700 bg-slate-900 sticky top-0 text-center z-20 text-[9px] text-slate-400 uppercase font-black tracking-wider">TURNOS</th>
                                    <SortableHeader label="OPERADOR" columnKey="operator" className="w-48 text-center" />
                                    <SortableHeader label="VOLUME (L)" columnKey="volume" className="w-24 text-center border-r-0" />
                                    <th className="w-48 px-3 border-b border-slate-700 bg-slate-900 sticky top-0 text-center z-20 text-[9px] text-slate-400 uppercase font-black tracking-wider">STATUS FINAL</th>
                                </tr>
                            </thead>
                            <tbody className="text-[11px] font-bold">
                                {sortedData.length > 0 ? (
                                    sortedData.map(flight => {
                                        const badge = getStatusBadge(flight);
                                        const tabMinutes = flight.startTime && flight.endTime 
                                            ? Math.floor((flight.endTime.getTime() - flight.startTime.getTime()) / 60000)
                                            : null;
                                        
                                        const flightShift = getShift(flight.endTime || flight.startTime);
                                        const operatorProfile = MOCK_TEAM_PROFILES.find(p => p.warName === flight.operator);

                                        // Dynamic font color for "Histórico Geral" based on status
                                        const isGeneralHistory = activeTab === 'FINALIZADOS';
                                        const statusColorClass = isGeneralHistory ? badge.color.split(' ')[0] : 'text-slate-400';
                                        const whiteColorClass = isGeneralHistory ? badge.color.split(' ')[0] : 'text-white';
                                        const emeraldColorClass = isGeneralHistory ? badge.color.split(' ')[0] : 'text-emerald-500';

                                        return (
                                        <tr 
                                            key={flight.id}
                                            onClick={() => setSelectedFlight(flight)}
                                            className="h-14 border-b border-slate-800/30 cursor-pointer transition-colors hover:bg-slate-900 group"
                                        >
                                            <td className="px-2 border-r border-slate-800/50 text-left">
                                                <AirlineLogo airlineCode={flight.airlineCode} className={statusColorClass} />
                                            </td>
                                            <td className={`px-2 border-r border-slate-800/50 text-center ${whiteColorClass} font-mono tracking-tighter`}>{flight.flightNumber}</td>
                                            <td className={`px-2 border-r border-slate-800/50 text-center font-mono ${emeraldColorClass} tracking-tighter uppercase`}>{flight.registration}</td>
                                            <td className={`px-2 border-r border-slate-800/50 text-center font-mono ${statusColorClass}`}>{ICAO_CITIES[flight.destination] || flight.destination}</td>
                                            <td className="px-2 border-r border-slate-800/50 text-center">
                                                <span className={`bg-slate-900 border border-slate-800 ${statusColorClass} px-2 py-1 font-mono text-[10px] rounded`}>{flight.positionId}</span>
                                            </td>
                                            <td className={`px-2 border-r border-slate-800/50 text-center font-mono ${statusColorClass}`}>{flight.startTime ? flight.startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</td>
                                            <td className={`px-2 border-r border-slate-800/50 text-center font-mono ${statusColorClass}`}>{flight.endTime ? flight.endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</td>
                                            <td className={`px-2 border-r border-slate-800/50 text-center font-mono ${whiteColorClass}`}>{tabMinutes !== null ? `${tabMinutes}'` : '--'}</td>
                                            <td className={`px-2 border-r border-slate-800/50 text-center font-mono ${statusColorClass} uppercase`}>{flightShift}</td>
                                            <td className="px-2 border-r border-slate-800/50">
                                                <div className="flex justify-start pl-8">
                                                    <OperatorCell operatorName={flight.operator} />
                                                </div>
                                            </td>
                                            <td className={`px-2 border-r border-slate-800/50 text-center font-mono ${whiteColorClass}`}>{flight.volume?.toLocaleString() || 0}</td>
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
                    </div>
                </div>
            </>
        )}
    </div>
  );
};
