import React, { useState, useMemo } from 'react';
import { 
    Truck, Search, Droplet, MousePointer2, 
    User, Layers, ShieldCheck, ShieldAlert, Wrench,
    LayoutGrid, List, ChevronUp, ChevronDown, Power
} from 'lucide-react';
import { Vehicle, VehicleType, VehicleStatus, OperatorProfile, FlightData } from '../types';
import { VehicleActionModal } from './VehicleActionModal';
import { OperatorCell } from './OperatorCell';

interface OperatorManagerProps {
  density: number;
  vehicles: Vehicle[];
  onUpdateVehicles: (vehicles: Vehicle[]) => void;
  operators: OperatorProfile[];
  flights: FlightData[];
}

export const OperatorManager: React.FC<OperatorManagerProps> = ({ density, vehicles, onUpdateVehicles, operators, flights }) => {
  const [activeTab, setActiveTab] = useState<VehicleType>('SERVIDOR');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');
  
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'ALL'>('ALL');
  const [manufacturerFilter, setManufacturerFilter] = useState<string | 'ALL'>('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Vehicle | string; direction: 'ascending' | 'descending' } | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isStatusModalOnly, setIsStatusModalOnly] = useState(false);

  const manufacturers = useMemo(() => {
    const set = new Set(vehicles.map(v => v.manufacturer));
    return Array.from(set);
  }, [vehicles]);

  const syncedVehicles = useMemo(() => {
      return vehicles.map(v => {
          const activeFlight = flights.find(f => f.fleet === v.id && f.status !== 'FINALIZADO' && f.status !== 'CANCELADO');
          if (activeFlight) {
              return {
                  ...v,
                  status: activeFlight.status === 'ABASTECENDO' ? 'ENCHIMENTO' : 'OCUPADO',
                  operatorName: activeFlight.operator || v.operatorName,
                  currentPosition: activeFlight.positionId || v.currentPosition
              } as Vehicle;
          }
          if (v.status === 'OCUPADO' || v.status === 'ENCHIMENTO') {
               return { ...v, status: 'DISPONÍVEL' } as Vehicle;
          }
          return v;
      });
  }, [vehicles, flights]);

  const filteredVehicles = useMemo(() => {
    return syncedVehicles.filter(v => {
      const matchesTab = v.type === activeTab;
      const lowerSearchTerm = searchTerm.toLowerCase();
      const matchesSearch = 
        v.id.toLowerCase().includes(lowerSearchTerm) || 
        v.manufacturer.toLowerCase().includes(lowerSearchTerm) ||
        (v.operatorName || '').toLowerCase().includes(lowerSearchTerm) ||
        (v.currentPosition || '').toLowerCase().includes(lowerSearchTerm) ||
        v.status.toLowerCase().includes(lowerSearchTerm);

      const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
      const matchesManufacturer = manufacturerFilter === 'ALL' || v.manufacturer === manufacturerFilter;
      
      return matchesTab && matchesSearch && matchesStatus && matchesManufacturer;
    });
  }, [vehicles, activeTab, searchTerm, statusFilter, manufacturerFilter]);

  const sortedVehicles = useMemo(() => {
    let sortableItems = [...filteredVehicles];
    if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
            const aValue = a[sortConfig.key as keyof Vehicle];
            const bValue = b[sortConfig.key as keyof Vehicle];
            if (aValue === undefined || bValue === undefined) return 0;

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortConfig.direction === 'ascending' 
                    ? aValue.localeCompare(bValue) 
                    : bValue.localeCompare(aValue);
            } else if (typeof aValue === 'number' && typeof bValue === 'number') {
                 return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
            }
            return 0;
        });
    }
    return sortableItems;
  }, [filteredVehicles, sortConfig]);

  const requestSort = (key: keyof Vehicle | string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleUpdateVehicle = (updatedVehicle: Vehicle) => {
    onUpdateVehicles(vehicles.map(v => v.id === updatedVehicle.id ? updatedVehicle : v));
  };

  const getStatusColor = (status: VehicleStatus) => {
    switch (status) {
      case 'DISPONÍVEL': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'OCUPADO': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'INATIVO': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'ENCHIMENTO': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
    }
  };

  const getCtaPosition = (vehicle: Vehicle) => {
    switch (vehicle.status) {
      case 'DISPONÍVEL': return vehicle.lastPosition || 'N/D';
      case 'ENCHIMENTO': return 'ILHA';
      case 'OCUPADO': return vehicle.currentPosition || 'N/D';
      case 'INATIVO': return vehicle.observations || 'MANUTENÇÃO';
      default: return 'N/D';
    }
  };

  const renderTankLevel = (vehicle: Vehicle) => {
    const current = vehicle.currentVolume || 0;
    const capacity = vehicle.capacity || 20000;
    const percentage = (current / capacity) * 100;
    const deadVolume = 300;
    const deadVolumePct = (deadVolume / capacity) * 100;
    
    let colorClass = 'bg-emerald-500';
    let isFlashing = false;

    if (current > capacity) {
        colorClass = 'bg-red-600';
        isFlashing = true;
    } else if (current <= 5000) {
        colorClass = 'bg-red-600';
        isFlashing = current <= deadVolume;
    } else if (percentage >= 75) {
        colorClass = 'bg-emerald-500';
    } else if (percentage >= 50) {
        colorClass = 'bg-blue-500';
    } else {
        colorClass = 'bg-amber-500';
    }

    return (
      <div className="relative w-16 h-full min-h-[12rem] bg-slate-900 rounded-lg border-2 border-slate-700 flex items-end overflow-hidden mx-auto">
        <div style={{ height: `${Math.min(percentage, 100)}%` }} className={`w-full ${colorClass} transition-all duration-700 z-0 ${isFlashing ? 'animate-pulse' : ''}`} />
        <div className={`absolute bottom-0 left-0 right-0 border-t-2 border-dashed z-10 transition-all ${current <= deadVolume ? 'bg-red-600/80 border-red-500' : 'bg-red-900/20 border-red-500/30'}`} style={{ height: `${Math.max(deadVolumePct, 2)}%` }}>
           {current <= deadVolume && (
               <div className="absolute -top-5 left-0 right-0 flex justify-center">
                 <span className="text-[7px] font-black uppercase tracking-widest px-1 rounded backdrop-blur-sm text-white bg-red-600 animate-pulse">V. Morto</span>
               </div>
           )}
        </div>
        {current > capacity && <div className="absolute inset-0 flex items-center justify-center z-20"><ShieldAlert className="w-8 h-8 text-red-500 animate-ping" /></div>}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <span className="text-white font-black text-xl" style={{ writingMode: 'vertical-rl', textShadow: '0 0 5px black' }}>{Math.min(percentage, 100).toFixed(0)}%</span>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 overflow-hidden relative">
      <VehicleActionModal 
        vehicle={selectedVehicle}
        onClose={() => { setSelectedVehicle(null); setIsStatusModalOnly(false); }}
        onUpdateVehicle={handleUpdateVehicle}
        density={density}
        operators={operators}
        showStatusOnly={isStatusModalOnly}
      />
      <header className="px-8 py-3 border-b border-slate-800/60 bg-slate-900/40 shrink-0">
        <div className="flex items-center justify-between gap-6 mb-4">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2"><Truck className="text-amber-500" size={24} /> MONITOR FROTAS</h2>
            <div className="flex items-center gap-1 bg-slate-950/50 p-1 rounded-md border border-slate-800/50">
              <button onClick={() => setActiveTab('SERVIDOR')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'SERVIDOR' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-500 hover:text-slate-300'}`}>SERVIDORES</button>
              <button onClick={() => setActiveTab('CTA')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'CTA' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-500 hover:text-slate-300'}`}>CTAs</button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-md border border-slate-800 mr-2">
              <button onClick={() => setViewMode('GRID')} className={`p-2 rounded-lg transition-all ${viewMode === 'GRID' ? 'bg-slate-800 text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}><LayoutGrid size={16} /></button>
              <button onClick={() => setViewMode('TABLE')} className={`p-2 rounded-lg transition-all ${viewMode === 'TABLE' ? 'bg-slate-800 text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}><List size={16} /></button>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input type="text" placeholder="Localizar frota..." className="w-40 bg-slate-950 border border-slate-800 rounded-md pl-10 pr-4 py-2 text-[11px] text-white outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 pt-2 border-t border-slate-800/30">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Status:</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="bg-transparent text-[10px] font-bold text-slate-400 outline-none">
              <option value="ALL">TODOS</option>
              <option value="DISPONÍVEL">DISPONÍVEL</option>
              <option value="OCUPADO">OCUPADO</option>
              <option value="INATIVO">INATIVO</option>
              <option value="ENCHIMENTO">ENCHIMENTO</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Fabricante:</span>
            <select value={manufacturerFilter} onChange={(e) => setManufacturerFilter(e.target.value)} className="bg-transparent text-[10px] font-bold text-slate-400 outline-none">
              <option value="ALL">TODOS</option>
              {manufacturers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </header>

      <div className={`flex-1 overflow-y-auto ${viewMode === 'GRID' ? 'p-8' : 'px-8'}`}>
        {viewMode === 'GRID' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {sortedVehicles.map((vehicle) => {
              if (activeTab === 'CTA') {
                return (
                  <div key={vehicle.id} onClick={() => setSelectedVehicle(vehicle)} className="bg-[#0a0f1d] border border-slate-800 rounded-md p-4 flex flex-col justify-between hover:border-amber-500/30 cursor-pointer shadow-xl">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-3xl font-black text-white font-mono tracking-tighter leading-none">{vehicle.id}</span>
                        <p className="text-xs font-bold text-blue-400 font-mono mt-1">{getCtaPosition(vehicle)}</p>
                      </div>
                      <div className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider ${getStatusColor(vehicle.status)}`}>{vehicle.status}</div>
                    </div>

                    <div className="flex-1 flex items-stretch justify-center my-4">
                        <div className="flex gap-4 w-full items-stretch">
                            <div className="shrink-0">{renderTankLevel(vehicle)}</div>
                            <div className="flex-1 flex flex-col justify-between gap-2">
                                <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-800/60">
                                    <div className="text-[9px] font-black text-slate-400 uppercase mb-1 text-center font-mono">LITROS</div>
                                    <div className="flex justify-between text-xs">
                                        <div className="flex flex-col"><span className="text-[7px] text-slate-500 uppercase font-black">Contável</span><span className="font-mono text-white">{(vehicle.currentVolume || 0).toLocaleString()}</span></div>
                                        <div className="flex flex-col text-right"><span className="text-[7px] text-slate-500 uppercase font-black">Real</span><span className="font-mono text-emerald-400">{(Math.max(0, (vehicle.currentVolume || 0) - 300)).toLocaleString()}</span></div>
                                    </div>
                                </div>
                                <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-800/60">
                                    <div className="text-[9px] font-black text-slate-400 uppercase mb-1 text-center font-mono">KILOS</div>
                                    <div className="flex justify-between text-xs">
                                        <div className="flex flex-col"><span className="text-[7px] text-slate-500 uppercase font-black">Contável</span><span className="font-mono text-amber-500">{((vehicle.currentVolume || 0) * density).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                                        <div className="flex flex-col text-right"><span className="text-[7px] text-slate-500 uppercase font-black">Real</span><span className="font-mono text-amber-400">{(Math.max(0, (vehicle.currentVolume || 0) - 300) * density).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                      <OperatorCell operatorName={vehicle.operatorName} />
                      <button className={`p-2 rounded-md ${vehicle.isActive === false ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}><Power size={14} /></button>
                    </div>
                  </div>
                )
              } else {
                return (
                  <div key={vehicle.id} onClick={() => { setSelectedVehicle(vehicle); setIsStatusModalOnly(false); }} className="bg-[#0a0f1d] border border-slate-800 rounded-md flex flex-col justify-between hover:border-amber-500/30 cursor-pointer shadow-xl">
                    <div className="flex justify-between items-start p-4">
                      <div>
                        <span className="text-3xl font-black text-amber-500 font-mono tracking-tighter leading-none">{vehicle.id}</span>
                        <p className="text-xs font-bold text-slate-500 font-sans mt-1">{vehicle.manufacturer}</p>
                      </div>
                      <div className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider ${getStatusColor(vehicle.status)}`}>{vehicle.status}</div>
                    </div>

                    <div className="border-y border-dashed border-slate-800 px-4 py-2 flex items-center justify-center min-h-[60px]">
                      {vehicle.status === 'INATIVO' ? (
                        <div className="text-center">
                           <Wrench size={16} className="text-red-500 mx-auto mb-1"/><span className="text-[10px] font-black text-red-500">MANUTENÇÃO</span>
                        </div>
                      ) : vehicle.operatorName ? (
                        <div className="flex items-center gap-3 w-full justify-start">
                            <OperatorCell operatorName={vehicle.operatorName} />
                            <span className="text-[10px] font-mono text-blue-400">| {vehicle.currentPosition || 'PÁTIO'}</span>
                        </div>
                      ) : (
                        <div className="text-center">
                          <MousePointer2 size={16} className="text-slate-600 mx-auto mb-1"/><span className="text-[10px] font-black text-slate-600">AGUARDANDO</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2">
                      <div className="p-3 text-center"><span className="text-[10px] font-bold text-slate-500 uppercase">Vazão Máx</span><p className="text-white font-mono font-bold text-lg">{vehicle.maxFlowRate} <span className="text-xs text-slate-400">L/min</span></p></div>
                      <div className="p-3 text-center border-l border-slate-800"><span className="text-[10px] font-bold text-slate-500 uppercase">Plataforma</span><p className={`font-bold text-sm ${vehicle.hasPlatform ? 'text-emerald-500' : 'text-red-500'}`}>{vehicle.hasPlatform ? 'OPERANTE' : 'INOP'}</p></div>
                    </div>
                  </div>
                )
              }
            })}
          </div>
        ) : (
          <div className="overflow-auto flex-1 bg-[#020617] rounded-xl border border-slate-900">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-[#0a0f1d] border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-mono text-slate-500 font-bold uppercase cursor-pointer" onClick={() => requestSort('id')}>Frota</th>
                  <th className="px-4 py-3 text-slate-500 font-bold uppercase cursor-pointer" onClick={() => requestSort('manufacturer')}>Fabricante</th>
                  <th className="px-4 py-3 text-slate-500 font-bold uppercase cursor-pointer" onClick={() => requestSort('operatorName')}>Operador</th>
                  <th className="px-4 py-3 text-slate-500 font-bold uppercase cursor-pointer" onClick={() => requestSort('currentPosition')}>Posição</th>
                  {activeTab === 'CTA' && <th className="px-4 py-3 text-slate-500 font-bold uppercase text-right">V. Atual (L)</th>}
                  {activeTab === 'CTA' && <th className="px-4 py-3 text-slate-500 font-bold uppercase text-right">V. Real (L)</th>}
                  <th className="px-4 py-3 text-slate-500 font-bold text-right">Vazão Máxima</th>
                  <th className="px-4 py-3 text-slate-500 font-bold text-center">Status</th>
                  <th className="px-4 py-3 text-slate-500 font-bold text-center">Ação</th>
                </tr>
              </thead>
              <tbody>
                {sortedVehicles.map((v) => (
                  <tr key={v.id} onClick={() => { setSelectedVehicle(v); setIsStatusModalOnly(false); }} className="border-b border-slate-800/40 hover:bg-slate-800/20 cursor-pointer">
                    <td className="px-4 py-3 font-mono font-black text-white text-sm">{v.id}</td>
                    <td className="px-4 py-3 text-slate-400 font-bold">{v.manufacturer}</td>
                    <td className="px-4 py-3"><OperatorCell operatorName={v.operatorName} /></td>
                    <td className="px-4 py-3 font-mono text-blue-400 font-bold">{v.currentPosition || '--'}</td>
                    {activeTab === 'CTA' && <td className="px-4 py-3 font-mono text-right text-white">{v.currentVolume?.toLocaleString()}</td>}
                    {activeTab === 'CTA' && <td className="px-4 py-3 font-mono text-right text-emerald-400 font-bold">{(Math.max(0, (v.currentVolume || 0) - 300)).toLocaleString()}</td>}
                    <td className="px-4 py-3 font-mono text-right text-slate-300 font-bold">{v.maxFlowRate} L/min</td>
                    <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${getStatusColor(v.status)}`}>{v.status}</span></td>
                    <td className="px-4 py-3 text-center"><button onClick={(e) => { e.stopPropagation(); setSelectedVehicle(v); setIsStatusModalOnly(true); }} className="p-1 px-2 text-[10px] bg-slate-800 font-bold rounded-md hover:bg-slate-700 text-slate-350"><Power size={12}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
