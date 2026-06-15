import React, { useState, useMemo } from 'react';
import { 
    Truck, Search, Droplet, MousePointer2, 
    User, Layers, ShieldCheck, ShieldAlert, Wrench,
    LayoutGrid, List, ChevronUp, ChevronDown, Power
} from 'lucide-react';
import { Vehicle, VehicleType, VehicleStatus, OperatorProfile, FlightData } from '../types';
import { VehicleActionModal } from './VehicleActionModal';
import { OperatorCell } from './OperatorCell';
import { updateVehicle } from '../services/supabaseService';

const OperatorHeaderCard: React.FC<{
  operatorName: string;
  status: VehicleStatus;
  operators: OperatorProfile[];
}> = ({ operatorName, status, operators }) => {
  const [imageError, setImageError] = useState(false);
  const profile = operators.find(p => p.warName === operatorName || p.fullName === operatorName || p.id === operatorName);

  return (
    <div className="flex items-center gap-3 select-none">
      <div className="text-right flex flex-col justify-center min-w-0">
        <span className="text-[12.5px] font-black text-slate-100 uppercase tracking-tight leading-none truncate max-w-[120px]">
          {operatorName}
        </span>
        <div className="mt-1.5">
          <span 
            className={`inline-flex items-center justify-center text-[9px] font-black font-mono uppercase px-2 py-0.5 rounded-sm leading-none border ${
              status === 'DISPONÍVEL' 
                ? 'bg-emerald-600 text-white border-emerald-600' 
                : status === 'OCUPADO' 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : status === 'INATIVO' 
                    ? 'bg-red-600 text-white border-red-650' 
                    : 'bg-amber-500 text-slate-950 border-amber-500'
            }`}
            style={status === 'DISPONÍVEL' ? { backgroundColor: '#2acc2a', borderColor: '#2acc2a', color: '#ffffff' } : {}}
          >
            {status === 'DISPONÍVEL' ? 'LIVRE' : status}
          </span>
        </div>
      </div>
      
      <div className="w-[30px] h-[40px] bg-slate-950 border border-slate-700 overflow-hidden shrink-0 flex items-end justify-center rounded shadow-inner">
        {profile?.photoUrl && !imageError ? (
          <img 
            src={profile.photoUrl} 
            alt={operatorName} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
          />
        ) : (
          <User size={18} className="text-slate-500 mb-0.5" />
        )}
      </div>
    </div>
  );
};

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
          const matchedOp = v.operatorId ? operators.find(op => op.id === v.operatorId) : null;
          const resolvedOperatorName = matchedOp ? matchedOp.warName : v.operatorName;

          const activeFlight = flights.find(f => f.fleet === v.id && f.status !== 'FINALIZADO' && f.status !== 'CANCELADO');
          if (activeFlight) {
              return {
                  ...v,
                  status: 'OCUPADO',
                  operatorId: activeFlight.operatorId || v.operatorId,
                  operatorName: activeFlight.operator || resolvedOperatorName,
                  currentPosition: activeFlight.positionId || v.currentPosition
              } as Vehicle;
          }
          
          let status = v.status;
          if (v.status === 'OCUPADO') {
               status = 'DISPONÍVEL';
          }
          if (v.type === 'SERVIDOR' && v.status === 'ENCHIMENTO') {
               status = 'DISPONÍVEL';
          }
          
          return {
              ...v,
              status,
              operatorName: resolvedOperatorName
          } as Vehicle;
      });
  }, [vehicles, flights, operators]);

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
    } else if (activeTab === 'CTA') {
        // Classificação automática da esquerda para a direita (maior para menor volume)
        sortableItems.sort((a, b) => {
            const volA = a.currentVolume || 0;
            const volB = b.currentVolume || 0;
            return volB - volA;
        });
    }
    return sortableItems;
  }, [filteredVehicles, sortConfig, activeTab]);

  const requestSort = (key: keyof Vehicle | string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleUpdateVehicle = async (updatedVehicle: Vehicle) => {
    onUpdateVehicles(vehicles.map(v => v.id === updatedVehicle.id ? updatedVehicle : v));
    try {
        await updateVehicle(updatedVehicle.id, {
            isActive: updatedVehicle.isActive,
            status: updatedVehicle.status,
            observations: updatedVehicle.observations,
            currentVolume: updatedVehicle.currentVolume,
            operatorName: updatedVehicle.operatorName,
        });
    } catch (e) {
        console.error("Failed to update vehicle remotely:", e);
    }
  };

  const getStatusColor = (status: VehicleStatus) => {
    switch (status) {
      case 'DISPONÍVEL': return 'bg-emerald-600 text-white border-emerald-600 font-black shadow-sm';
      case 'OCUPADO': return 'bg-blue-600 text-white border-blue-600 font-black shadow-sm';
      case 'INATIVO': return 'bg-red-600 text-white border-red-600 font-black shadow-sm';
      case 'ENCHIMENTO': return 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-sm';
      default: return 'bg-slate-800 text-slate-400 border-slate-700 font-bold';
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

  const renderOperations = (vehicle: Vehicle) => {
    const activeFlights = flights.filter(f => f.fleet === vehicle.id && (f.status === 'EM_ATENDIMENTO' || f.status === 'DESLOCAMENTO' || f.status === 'ABASTECENDO' || f.status === 'DESIGNADO'));
    if (activeFlights.length === 0) return null;

    return (
        <div className="mt-3 space-y-1">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-500 block mb-1">Operações Ativas</span>
            {activeFlights.map(f => (
                <div key={f.id} className="bg-slate-950 px-2 py-1.5 border border-slate-800 rounded flex justify-between items-center text-[9px] font-mono shadow-sm">
                    <span className="text-white font-bold">{f.flightNumber} <span className="text-indigo-400">({f.aircraft})</span></span>
                    <span className="text-slate-400">{f.positionId || f.parkingState}</span>
                </div>
            ))}
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
        vehicles={syncedVehicles}
        flights={flights}
      />
      <header className="px-8 py-3 border-b border-slate-800/60 bg-slate-900/40 shrink-0">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2"><Truck className="text-amber-500" size={24} /> MONITOR FROTAS</h2>
            <div className="flex items-center gap-1 bg-slate-950/50 p-1 rounded-md border border-slate-800/50">
              <button onClick={() => setActiveTab('SERVIDOR')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'SERVIDOR' ? 'bg-white text-slate-950 font-black' : 'text-slate-500 hover:text-slate-300'}`}>SRV's</button>
              <button onClick={() => setActiveTab('CTA')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'CTA' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-500 hover:text-slate-300'}`}>CTAs</button>
            </div>

            <div className="w-px h-6 bg-slate-800/60"></div>

            <div className="flex items-center gap-2 bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-800/40">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Status:</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="bg-transparent text-[10px] font-bold text-slate-400 outline-none cursor-pointer">
                <option value="ALL">TODOS</option>
                <option value="DISPONÍVEL">DISPONÍVEL</option>
                <option value="OCUPADO">OCUPADO</option>
                <option value="INATIVO">INATIVO</option>
                {activeTab === 'CTA' && <option value="ENCHIMENTO">ENCHIMENTO</option>}
              </select>
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
      </header>

      <div className={`flex-1 overflow-y-auto ${viewMode === 'GRID' ? 'p-8' : 'px-8'}`}>
        {viewMode === 'GRID' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {sortedVehicles.map((vehicle) => {
              if (activeTab === 'CTA') {
                return (
                  <div key={vehicle.id} onClick={() => setSelectedVehicle(vehicle)} className="bg-slate-900 border border-slate-800 rounded-md p-4 flex flex-col justify-between hover:border-amber-500/30 cursor-pointer shadow-xl">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-col gap-2">
                        <span 
                          className="inline-flex items-center justify-center font-mono font-black text-lg px-2.5 py-1 rounded shadow-md border leading-none text-slate-950 uppercase"
                          style={{ backgroundColor: '#E7C800', borderColor: '#E7C800' }}
                        >
                          {vehicle.id}
                        </span>
                        <p className="text-xs font-bold text-blue-400 font-mono tracking-wider">{getCtaPosition(vehicle)}</p>
                      </div>
                      {vehicle.operatorName ? (
                        <OperatorHeaderCard operatorName={vehicle.operatorName} status={vehicle.status} operators={operators} />
                      ) : (
                        <div className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider ${getStatusColor(vehicle.status)}`}>{vehicle.status}</div>
                      )}
                    </div>

                    <div className="flex-1 flex items-stretch justify-center my-4">
                        <div className="flex gap-4 w-full items-stretch">
                            <div className="shrink-0">{renderTankLevel(vehicle)}</div>
                            <div className="flex-1 flex flex-col justify-between gap-2">
                                <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-800/60">
                                    <div className="text-[9px] font-black text-slate-400 uppercase mb-1 text-center font-mono">LITROS</div>
                                    <div className="flex justify-between text-xs px-1">
                                        <div className="flex flex-col"><span className="text-[7px] text-slate-500 uppercase font-black">Contável</span><span className="font-mono text-white font-bold">{(vehicle.currentVolume || 0).toLocaleString()}</span></div>
                                        <div className="flex flex-col text-right"><span className="text-[7px] text-slate-500 uppercase font-black">Real</span><span className="font-mono text-emerald-400 font-bold">{(Math.max(0, (vehicle.currentVolume || 0) - 300)).toLocaleString()}</span></div>
                                    </div>
                                </div>
                                <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-800/60">
                                    <div className="text-[9px] font-black text-slate-400 uppercase mb-1 text-center font-mono">KILOS</div>
                                    <div className="flex justify-between text-xs px-1">
                                        <div className="flex flex-col"><span className="text-[7px] text-slate-500 uppercase font-black">Contável</span><span className="font-mono text-amber-500 font-bold">{Math.round((vehicle.currentVolume || 0) * density).toLocaleString()}</span></div>
                                        <div className="flex flex-col text-right"><span className="text-[7px] text-slate-500 uppercase font-black">Real</span><span className="font-mono text-amber-400 font-bold">{Math.round(Math.max(0, (vehicle.currentVolume || 0) - 300) * density).toLocaleString()}</span></div>
                                    </div>
                                </div>
                                <div className="bg-slate-900/40 rounded-lg p-2 border border-slate-800/60">
                                    <div className="text-[9px] font-black text-slate-400 uppercase mb-1 text-center font-mono">LIBRAS</div>
                                    <div className="flex justify-between text-xs px-1">
                                        <div className="flex flex-col"><span className="text-[7px] text-slate-500 uppercase font-black">Contável</span><span className="font-mono text-amber-500 font-bold">{Math.round((vehicle.currentVolume || 0) * density * 2.20462).toLocaleString()}</span></div>
                                        <div className="flex flex-col text-right"><span className="text-[7px] text-slate-500 uppercase font-black">Real</span><span className="font-mono text-amber-400 font-bold">{Math.round(Math.max(0, (vehicle.currentVolume || 0) - 300) * density * 2.20462).toLocaleString()}</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mb-0">
                        {renderOperations(vehicle)}
                    </div>
                  </div>
                )
              } else {
                return (
                  <div key={vehicle.id} onClick={() => { setSelectedVehicle(vehicle); setIsStatusModalOnly(false); }} className="bg-slate-900 border border-slate-800 rounded-md flex flex-col justify-between hover:border-amber-500/30 cursor-pointer shadow-xl">
                    <div className="flex justify-between items-start p-4">
                      <div className="flex flex-col gap-2">
                        <span 
                          className="inline-flex items-center justify-center font-mono font-black text-lg px-2.5 py-1 rounded shadow-md border leading-none text-white uppercase"
                          style={{ backgroundColor: '#2563eb', borderColor: '#2563eb' }}
                        >
                          {vehicle.id}
                        </span>
                        <p className="text-xs font-bold text-slate-500 font-sans tracking-wide">{vehicle.manufacturer}</p>
                      </div>
                      {vehicle.operatorName ? (
                        <OperatorHeaderCard operatorName={vehicle.operatorName} status={vehicle.status} operators={operators} />
                      ) : (
                        <div className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider ${getStatusColor(vehicle.status)}`}>{vehicle.status}</div>
                      )}
                    </div>

                    <div className="border-y border-dashed border-slate-800 px-4 py-2 flex items-center justify-center min-h-[60px]">
                      {vehicle.status === 'INATIVO' ? (
                        <div className="text-center">
                           <Wrench size={16} className="text-red-500 mx-auto mb-1"/><span className="text-[10px] font-black text-red-500">MANUTENÇÃO</span>
                        </div>
                      ) : vehicle.operatorName ? (
                        <div className="flex items-center gap-3 w-full justify-start">
                            <OperatorCell operatorName={vehicle.operatorName} operators={operators} />
                            <span className="text-[10px] font-mono text-blue-400">| {vehicle.currentPosition || 'PÁTIO'}</span>
                        </div>
                      ) : (
                        <div className="text-center">
                          <MousePointer2 size={16} className="text-slate-600 mx-auto mb-1"/><span className="text-[10px] font-black text-slate-600">AGUARDANDO</span>
                        </div>
                      )}
                    </div>

                    <div className="px-4 pb-2">
                        {renderOperations(vehicle)}
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
          <div className="overflow-auto flex-1 bg-slate-950 rounded-xl border border-slate-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-900 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-mono text-slate-500 font-bold uppercase cursor-pointer" onClick={() => requestSort('id')}>Frota</th>
                  <th className="px-4 py-3 text-slate-500 font-bold uppercase cursor-pointer" onClick={() => requestSort('manufacturer')}>Fabricante</th>
                  <th className="px-4 py-3 text-slate-500 font-bold uppercase cursor-pointer" onClick={() => requestSort('operatorName')}>Operador</th>
                  <th className="px-4 py-3 text-slate-500 font-bold uppercase cursor-pointer" onClick={() => requestSort('currentPosition')}>Posição</th>
                  {activeTab === 'CTA' && <th className="px-4 py-3 text-slate-500 font-bold uppercase text-right font-mono">V. Litros</th>}
                  {activeTab === 'CTA' && <th className="px-4 py-3 text-slate-500 font-bold uppercase text-right font-mono">V. kg.</th>}
                  {activeTab === 'CTA' && <th className="px-4 py-3 text-slate-500 font-bold uppercase text-right font-mono">V. Libras</th>}
                  <th className="px-4 py-3 text-slate-500 font-bold text-right">Vazão Máxima</th>
                  <th className="px-4 py-3 text-slate-500 font-bold text-center">Status</th>
                  <th className="px-4 py-3 text-slate-500 font-bold text-center">Ação</th>
                </tr>
              </thead>
              <tbody>
                {sortedVehicles.map((v) => (
                  <tr key={v.id} onClick={() => { setSelectedVehicle(v); setIsStatusModalOnly(false); }} className="border-b border-slate-800/40 hover:bg-slate-800/20 cursor-pointer">
                    <td className="px-4 py-3">
                      <span 
                        className="inline-flex items-center justify-center font-mono font-black text-xs px-2 py-0.5 rounded shadow-sm border uppercase min-w-[55px] text-center leading-none"
                        style={
                          v.type === 'CTA' 
                            ? { backgroundColor: '#E7C800', borderColor: '#E7C800', color: '#000000' } 
                            : { backgroundColor: '#2563eb', borderColor: '#2563eb', color: '#ffffff' }
                        }
                      >
                        {v.id}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-bold">{v.manufacturer}</td>
                    <td className="px-4 py-3"><OperatorCell operatorName={v.operatorName} operators={operators} /></td>
                    <td className="px-4 py-3 font-mono text-blue-400 font-bold">{v.currentPosition || '--'}</td>
                    {activeTab === 'CTA' && <td className="px-4 py-3 font-mono text-right text-white">{(v.currentVolume || 0).toLocaleString()}</td>}
                    {activeTab === 'CTA' && <td className="px-4 py-3 font-mono text-right text-amber-500 font-bold">{Math.round((v.currentVolume || 0) * density).toLocaleString()}</td>}
                    {activeTab === 'CTA' && <td className="px-4 py-3 font-mono text-right text-amber-400 font-bold">{Math.round((v.currentVolume || 0) * density * 2.20462).toLocaleString()}</td>}
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
