import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FlightData, FlightStatus } from '../types';
import { OperatorCell } from './OperatorCell';
import { 
  Search, LayoutGrid, Power, Anchor, Ban, BusFront
} from 'lucide-react';

import { OperatorProfile } from '../types';

interface AerodromoProps {
    operators?: OperatorProfile[];
    flights?: FlightData[];
}

// === CONFIGURAÇÃO DE POSIÇÕES REAIS (SBGR HARDCODED) ===
const POSITIONS_BY_PATIO: Record<string, string[]> = {
    '1': ['101L', '101', '101R', '102', '103L', '103R', '104', '105L', '105R', '106', '107L', '107R', '108L', '108R', '109', '110', '111', '112L', '112', '112R', '113', '113L', '113R', '114', '115'],
    '2': ['201', '202', '202L', '202R', '203', '204L', '204', '204R', '205', '206', '207', '208', '209', '210', '211L', '211', '211R', '212L', '212R'],
    '3': ['301', '302L', '302R', '303L', '303R', '304', '305', '306', '307', '308', '309', '310', '311', '312'],
    '4': ['401', '402L', '402', '402R', '403', '404', '405', '406', '407', '408', '409', '410L', '410R', '411', '411L', '411R', '412'],
    '5': ['501L', '502', '502R', '503', '504L', '504', '504R', '505', '505R', '506', '507L', '507', '507R', '508L', '508R', '509L', '509', '509R', '510L', '510R', '510', '511L', '511', '511R', '512', '513'],
    '6': ['601L', '601R', '602L', '602R', '603L', '603R', '604L', '604R', '605L', '605R', '606L', '606', '606R', '607L', '607R', '608L', '608R', '609L', '609R', '610L', '610R', '611L', '611R', '612L', '612R'],
    '7': ['701L', '701R', '702L', '702R', '703L', '703R', '713L', '713R', '714L', '714R', '715L', '715R'],
    'VIP': ['V1', 'V2', 'V3']
};

const PATIO_LABELS = [
    { id: '1', label: 'P1' }, { id: '2', label: 'P2' }, { id: '3', label: 'P3' },
    { id: '4', label: 'P4' }, { id: '5', label: 'P5' }, { id: '6', label: 'P6' }, { id: '7', label: 'P7' }, { id: 'VIP', label: 'PVIP' }
];

export const Aerodromo: React.FC<AerodromoProps> = ({ operators = [], flights = [] }) => {
  const [activePatioId, setActivePatioId] = useState('2');
  const [searchTerm, setSearchTerm] = useState('');
  const [disabledPositions, setDisabledPositions] = useState<Set<string>>(new Set(['208', '212L']));
  const [ctaOnlyPositions, setCtaOnlyPositions] = useState<Set<string>>(new Set([]));
  const [calcoInputPos, setCalcoInputPos] = useState<string | null>(null);
  const [calcoRegistration, setCalcoRegistration] = useState('');
  const [localFlights, setLocalFlights] = useState<FlightData[]>(flights);
  
  React.useEffect(() => {
    setLocalFlights(flights);
  }, [flights]);

  const allPositions = useMemo(() => Object.values(POSITIONS_BY_PATIO).flat(), []);

  const currentPositions = useMemo(() => POSITIONS_BY_PATIO[activePatioId] || [], [activePatioId]);

  const positionData = useMemo(() => {
      const map = new Map<string, FlightData>();
      localFlights.forEach(f => {
          if (f.positionId) map.set(f.positionId, f);
      });
      return map;
  }, [localFlights]);

  const displayedPositions = useMemo(() => {
    const listToFilter = searchTerm ? allPositions : currentPositions;
    if (!searchTerm) return listToFilter;

    return listToFilter.filter(posId => {
       if (posId.includes(searchTerm)) return true;
       const flight = positionData.get(posId);
       if (flight) {
           return (
               (flight.flightNumber?.toUpperCase() || '').includes(searchTerm) ||
               (flight.departureFlightNumber?.toUpperCase() || '').includes(searchTerm) ||
               (flight.airline?.toUpperCase() || '').includes(searchTerm) ||
               (flight.registration?.toUpperCase() || '').includes(searchTerm) ||
               (flight.operator?.toUpperCase() || '').includes(searchTerm) ||
               (flight.fleet?.toUpperCase() || '').includes(searchTerm) ||
               (flight.vehicleType?.toUpperCase() || '').includes(searchTerm) ||
               (flight.status?.toUpperCase() || '').includes(searchTerm)
           );
       }
       return false;
    });
  }, [allPositions, currentPositions, searchTerm, positionData]);

  const patioStats = useMemo(() => {
      let occupied = 0, refueling = 0, waiting = 0, inactive = 0;
      currentPositions.forEach(pos => {
          if (disabledPositions.has(pos)) { inactive++; return; }
          const flight = positionData.get(pos);
          if (flight) {
              occupied++;
              if (flight.status === FlightStatus.ABASTECENDO) refueling++;
              if (flight.status === FlightStatus.AGUARDANDO) waiting++;
          }
      });
      return { total: currentPositions.length, occupied, refueling, waiting, inactive };
  }, [currentPositions, positionData, disabledPositions]);

  const toggleDisablePosition = (posId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const flight = positionData.get(posId);
      if (flight && flight.status === FlightStatus.ABASTECENDO) {
          alert('NEGADO: Posição com abastecimento em curso.');
          return;
      }
      const next = new Set(disabledPositions);
      if (next.has(posId)) next.delete(posId); else next.add(posId);
      setDisabledPositions(next);
  };

  const toggleCtaOnlyPosition = (posId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const next = new Set(ctaOnlyPositions);
      if (next.has(posId)) next.delete(posId); else next.add(posId);
      setCtaOnlyPositions(next);
  };

  const getStatusBadge = (status: FlightStatus) => {
      switch (status) {
          case FlightStatus.FINALIZADO: return <span className="bg-emerald-50 text-emerald-600 font-black text-[9px] px-1.5 py-0.5 rounded uppercase border border-emerald-200">FINALIZADO</span>;
          case FlightStatus.ABASTECENDO: return <span className="bg-blue-50 text-blue-600 font-black text-[9px] px-1.5 py-0.5 rounded uppercase border border-blue-200">ABASTECENDO</span>;
          case FlightStatus.DESIGNADO: return <span className="bg-indigo-50 text-indigo-600 font-black text-[9px] px-1.5 py-0.5 rounded uppercase border border-indigo-200">DESIGNADO</span>;
          case FlightStatus.AGUARDANDO: return <span className="bg-amber-50 text-amber-600 font-black text-[9px] px-1.5 py-0.5 rounded uppercase border border-amber-200">AGUARDANDO</span>;
          case FlightStatus.FILA: return <span className="bg-slate-100 text-slate-500 font-black text-[9px] px-1.5 py-0.5 rounded uppercase border border-slate-200">FILA</span>;
          case FlightStatus.CANCELADO: return <span className="bg-red-50 text-red-600 font-black text-[9px] px-1.5 py-0.5 rounded uppercase border border-red-200">CANCELADO</span>;
          default: return <span className="text-[9px] text-slate-500 font-black uppercase background-slate-100 border-slate-200">{status}</span>;
      }
  };

  const submitCalcoReport = (posId: string) => {
      if (!calcoRegistration) { setCalcoInputPos(null); return; }
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const existingFlight = positionData.get(posId);

      if (existingFlight) {
          setLocalFlights(localFlights.map(f => f.id === existingFlight.id ? { ...f, eta: timeString, status: FlightStatus.AGUARDANDO } : f));
      } else {
          const newFlight: FlightData = {
              id: `adhoc-${Date.now()}`, flightNumber: 'AD-HOC', airline: 'GEN', airlineCode: 'GEN', model: '???', registration: calcoRegistration.toUpperCase(), origin: '???', destination: '???', eta: timeString, etd: '--:--', positionId: posId, fuelStatus: 0, status: FlightStatus.DESIGNADO, vehicleType: 'SERVIDOR', logs: []
          };
          setLocalFlights([...localFlights, newFlight]);
      }
      setCalcoInputPos(null);
  };

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
      setPortalTarget(document.getElementById('subheader-portal-target'));
  }, []);

  const subheaderContent = (
      <div className={`px-6 h-16 shrink-0 flex items-center justify-between border-b bg-[#3CA317] border-transparent text-white shadow-[0_2px_8px_rgba(0,0,0,0.5)] z-20 w-full`}>
        <div className="flex items-center gap-6 h-full">
          <div className="flex items-center gap-3">
            <LayoutGrid className="text-white" size={20} />
            <div>
              <h2 className="text-sm font-black text-white tracking-tighter uppercase leading-none">MAPA DO PÁTIO</h2>
              <span className="text-[9px] font-black text-white/70 uppercase tracking-widest">SBGR GROUND LAYOUT</span>
            </div>
          </div>
          <div className="flex items-center ml-2 bg-black/20 p-0.5 rounded border border-white/10 h-8 gap-0.5">
            {PATIO_LABELS.map(patio => (
              <button key={patio.id} onClick={() => setActivePatioId(patio.id)} className={`px-3 py-1 rounded text-[10px] h-full font-black uppercase tracking-widest transition-all ${activePatioId === patio.id ? 'bg-white text-[#3CA317] shadow-sm' : 'text-white hover:bg-white/10'}`}>
                {patio.label}
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
          <input type="text" placeholder="BUSCAR POS..." className="bg-black/20 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-[10px] text-white font-mono uppercase focus:border-white/30 outline-none w-32 focus:w-48 transition-all placeholder-white/50 shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value.toUpperCase())} />
        </div>
      </div>
  );

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 overflow-hidden relative">
      {portalTarget ? createPortal(subheaderContent, portalTarget) : subheaderContent}
      <div className="flex-1 overflow-y-auto p-6 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-24 auto-rows-fr">
          {displayedPositions.map(posId => {
            const flight = positionData.get(posId);
            const isOccupied = !!flight;
            const isDisabled = disabledPositions.has(posId);
            const isCtaOnly = ctaOnlyPositions.has(posId);
            const isReportingCalco = calcoInputPos === posId;
            
            return (
              <div key={posId} className={`relative rounded-xl border-2 flex flex-col p-3 transition-all shadow-sm group min-h-[170px] overflow-hidden ${
                isDisabled ? 'border-red-200' 
                : isOccupied ? (flight.status === FlightStatus.FINALIZADO ? 'border-emerald-200 bg-emerald-50/50' : 'border-blue-200 bg-blue-50/50') 
                : 'border-slate-200 bg-white'
              } ${isCtaOnly && !isDisabled ? 'ring-1 ring-yellow-400/50 border-yellow-300' : ''}`}
              style={isDisabled ? { backgroundImage: 'repeating-linear-gradient(45deg, rgba(248, 250, 252, 1), rgba(248, 250, 252, 1) 10px, rgba(226, 232, 240, 0.4) 10px, rgba(226, 232, 240, 0.4) 20px)' } : {}}
              >
                <div className="flex justify-between items-start mb-2 relative z-10">
                  <span className={`text-xl font-black font-mono ${isDisabled ? 'text-slate-400' : isOccupied ? 'text-slate-800' : 'text-slate-400'} ${isCtaOnly && !isOccupied && !isDisabled ? 'text-yellow-600' : ''}`}>{posId}</span>
                  {isDisabled ? (
                    <span className="text-[10px] font-black uppercase text-red-600 bg-red-100 px-2 py-0.5 rounded border border-red-200 shadow-sm">OFF</span>
                  ) : isOccupied ? (
                    <span className="text-[10px] font-black uppercase text-blue-700 border border-blue-200 bg-blue-50 px-2 py-0.5 rounded shadow-sm">{flight.airline}</span>
                  ) : null}
                </div>
                
                <div className="flex-1 flex flex-col justify-center relative z-10">
                  {isDisabled ? (
                    <div className="flex flex-col items-center gap-2">
                      <Ban className="text-red-400" size={24} strokeWidth={2.5} />
                      <span className="text-[10px] font-black text-red-600 bg-white px-2.5 py-1 rounded shadow-sm border border-red-100">INATIVO</span>
                    </div>
                  ) : isOccupied ? (
                     <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-baseline text-slate-800 font-black text-sm">
                        <span className="truncate mr-2 font-mono">{(flight.flightNumber && flight.flightNumber !== '--') ? flight.flightNumber : (flight.departureFlightNumber || '--')}</span>
                        <span className="text-slate-500 text-xs">{flight.destination || flight.origin || 'SBMO'}</span>
                      </div>
                      
                      <div className="h-px w-full bg-slate-200"></div>
                      
                      <div className="flex justify-between text-[10px] font-mono text-slate-500">
                        <span>CHG: <span className="text-slate-800">{flight.eta || '--:--'}</span></span>
                        <span>ETD: <span className="text-emerald-600">{flight.etd || '--:--'}</span></span>
                      </div>
                      
                      <div className="h-px w-full bg-slate-200"></div>
                      
                      <div className="flex justify-between items-center mt-1">
                        <OperatorCell operatorName={flight.operator} operators={operators} />
                        <span className="text-sm font-black bg-gradient-to-br from-slate-500 to-slate-700 bg-clip-text text-transparent truncate ml-2">{flight.fleet || flight.vehicleType || ''}</span>
                      </div>
                      
                      <div className="flex justify-end items-center mt-1 pb-1">
                         {getStatusBadge(flight.status)}
                      </div>
                    </div>
                  ) : (
                    <div className={`text-center flex flex-col items-center justify-center h-full text-[10px] font-black uppercase tracking-widest ${isCtaOnly ? 'text-yellow-600/50' : 'text-slate-400/50'}`}>
                        {isCtaOnly ? 'P/ CTA' : 'Livre'}
                    </div>
                  )}
                </div>
                
                <div className={`mt-auto pt-3 border-t ${isDisabled ? 'border-transparent' : 'border-slate-200'} flex gap-2 items-center relative z-10`}>
                  {!isDisabled && (
                    <button onClick={() => setCalcoInputPos(posId)} className="text-[9px] font-black text-amber-600 hover:text-amber-700 flex items-center gap-1.5 transition-colors">
                      <Anchor size={12} strokeWidth={2.5} /> CALÇO
                    </button>
                  )}
                  
                  <div className={`flex items-center gap-4 ${!isDisabled ? 'ml-auto' : 'w-full justify-end opacity-0 group-hover:opacity-100 transition-opacity'}`}>
                     <button onClick={(e) => toggleCtaOnlyPosition(posId, e)} className={`${isCtaOnly ? 'text-yellow-500' : 'text-slate-400 hover:text-yellow-600'} transition-colors`} title="Fixar como CTA">
                       <BusFront size={12} strokeWidth={2.5} />
                     </button>
                     
                     <button onClick={(e) => toggleDisablePosition(posId, e)} className={`${isDisabled ? 'text-red-500' : 'text-slate-400 hover:text-red-600'} transition-colors`} title="Desabilitar Posição">
                       <Power size={12} strokeWidth={2.5} />
                     </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
