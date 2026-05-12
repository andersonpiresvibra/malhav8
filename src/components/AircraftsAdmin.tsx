import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Trash2, Database, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AirlineLogo } from './AirlineLogo';
import { AircraftType } from '../types';

interface AircraftsAdminProps {
  isDarkMode: boolean;
}

type AircraftField = 'airline' | 'model' | 'prefix' | 'actions';

const COLUMNS: { key: AircraftField; label: string; width: string; isVariable: boolean }[] = [
  { key: 'airline', label: 'Logo', width: 'w-16', isVariable: false },
  { key: 'airline', label: 'Comp.', width: 'w-24', isVariable: true },
  { key: 'model', label: 'Modelo', width: 'w-32', isVariable: true },
  { key: 'prefix', label: 'Prefixo', width: 'w-32', isVariable: true },
  { key: 'actions', label: 'Ações', width: 'w-20', isVariable: false },
];

export const AircraftsAdmin: React.FC<AircraftsAdminProps> = ({ isDarkMode }) => {
  const [aircrafts, setAircrafts] = useState<AircraftType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [airlines, setAirlines] = useState<string[]>([]);
  const [activeAirline, setActiveAirline] = useState<string>('');
  const [showNewAirlineModal, setShowNewAirlineModal] = useState(false);
  const [newAirlineName, setNewAirlineName] = useState('');

  const [editingCell, setEditingCell] = useState<{ rowId: string; col: number } | null>(null);

  const fetchAircrafts = async () => {
    setIsLoading(true);
    try {
        const { data, error } = await supabase.from('aircrafts').select('*').order('prefix');
        if (error) {
            console.error('Error fetching aircrafts', error);
        } else if (data) {
            setAircrafts(data as AircraftType[]);
            const uniqueAirlines = Array.from(new Set(data.map(a => a.airline))).filter(Boolean).sort();
            setAirlines(uniqueAirlines);
            if (uniqueAirlines.length > 0 && !activeAirline) {
                setActiveAirline(uniqueAirlines[0]);
            }
        }
    } catch (e) {
        console.error(e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAircrafts();
  }, []);

  const handleCreateNewAirline = () => {
    if (!newAirlineName.trim()) return;
    const name = newAirlineName.trim().toUpperCase();
    if (!airlines.includes(name)) {
        setAirlines([...airlines, name].sort());
    }
    setActiveAirline(name);
    setShowNewAirlineModal(false);
    setNewAirlineName('');
  };

  const handleCreateNewAircraft = async () => {
    if (!activeAirline) return;
    // Create optimistic record
    const tempId = `temp-${Date.now()}`;
    const newAircraft: AircraftType = {
        id: tempId,
        airline: activeAirline,
        manufacturer: '--',
        model: '--',
        prefix: 'NEW-PX'
    };
    
    setAircrafts([...aircrafts, newAircraft]);
    
    try {
        const { data, error } = await supabase.from('aircrafts').insert({
            airline: newAircraft.airline,
            manufacturer: newAircraft.manufacturer,
            model: newAircraft.model,
            prefix: newAircraft.prefix
        }).select().single();
        
        if (data) {
            setAircrafts(prev => prev.map(a => a.id === tempId ? data as AircraftType : a));
        } else if (error) {
            console.error(error);
            setAircrafts(prev => prev.filter(a => a.id !== tempId));
        }
    } catch (e) {
        console.error(e);
        setAircrafts(prev => prev.filter(a => a.id !== tempId));
    }
  };

  const handleDeleteAirline = async (airlineCode: string) => {
    // update local state
    setAircrafts(prev => prev.filter(a => a.airline !== airlineCode));
    const newAirlines = airlines.filter(a => a !== airlineCode);
    setAirlines(newAirlines);
    if (newAirlines.length > 0) {
        setActiveAirline(newAirlines[0]);
    } else {
        setActiveAirline('');
    }

    try {
        const { error } = await supabase.from('aircrafts').delete().eq('airline', airlineCode);
        if (error) {
            console.error('Error deleting airline', error);
            fetchAircrafts(); // rollback na interface se houver erro
        }
    } catch(e) {
        console.error(e);
        fetchAircrafts();
    }
  };

  const handleDeleteAircraft = async (id: string) => {
    setAircrafts(prev => prev.filter(a => a.id !== id));
    try {
        const { error } = await supabase.from('aircrafts').delete().eq('id', id);
        if (error) {
           console.error(error);
           fetchAircrafts(); // rollback na interface se houver erro
        }
    } catch(e) {
        console.error(e);
        fetchAircrafts();
    }
  };

  const handleUpdateField = async (id: string, field: keyof AircraftType, value: any) => {
    const updatedAircrafts = aircrafts.map(a => {
        if (a.id === id) {
            return { ...a, [field]: value };
        }
        return a;
    });
    setAircrafts(updatedAircrafts);
    
    // Check if temp id
    if (id.startsWith('temp-')) return;
    
    try {
        await supabase.from('aircrafts').update({ [field]: value }).eq('id', id);
        
        // Re-calculate airlines if airline changed
        if (field === 'airline') {
             const uniqueAirlines = Array.from(new Set(updatedAircrafts.map(a => a.airline))).filter(Boolean).sort();
             setAirlines(uniqueAirlines);
             if (!uniqueAirlines.includes(activeAirline) && uniqueAirlines.length > 0) {
                 setActiveAirline(uniqueAirlines[0]);
             }
        }
    } catch (e) {
        console.error(e);
        fetchAircrafts();
    }
  };

  const currentAirlineAircrafts = useMemo(() => {
    return aircrafts.filter(a => a.airline === activeAirline).sort((a,b) => a.prefix.localeCompare(b.prefix));
  }, [aircrafts, activeAirline]);

  return (
    <div className={`flex flex-col h-full ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-800'}`}>
        {/* HEADER */}
        <div className={`shrink-0 h-16 border-b flex items-center justify-between px-4 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
           <div className="flex flex-col justify-center">
               <div className="flex items-center gap-2">
                    <Database size={16} className={isDarkMode ? 'text-emerald-500' : 'text-emerald-600'} />
                    <h1 className="text-sm font-black uppercase tracking-widest">Aeronaves</h1>
                    {isLoading && <RefreshCw size={12} className="animate-spin ml-2 text-slate-500" />}
               </div>
               <span className={`text-[10px] font-medium tracking-wide ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Gerencie o banco de dados de aeronaves por companhia</span>
           </div>
           
           <div className="flex items-center gap-3">
               {activeAirline && airlines.includes(activeAirline) && (
                 <button 
                     onClick={() => {
                         if (window.confirm(`Deseja realmente excluir a companhia ${activeAirline} e todas as suas aeronaves cadastradas?`)) {
                              handleDeleteAirline(activeAirline);
                         }
                     }}
                     className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm ${isDarkMode ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'} active:scale-95`}
                 >
                     <Trash2 size={12} /> Excluir Companhia
                 </button>
               )}
               <button 
                   onClick={handleCreateNewAircraft}
                   disabled={!activeAirline}
                   className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-[#329858] text-white border-[#29824a] hover:bg-[#29824a]'} ${!activeAirline ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
               >
                   <Plus size={12} /> Novo Registro
               </button>
           </div>
        </div>

        {/* TABS */}
        <div className={`h-12 shrink-0 flex border-b ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'} z-30 overflow-hidden`}>
           <nav className="flex overflow-x-auto custom-scrollbar flex-1 items-stretch">
             {airlines.map((airline) => {
                 const isActive = activeAirline === airline;
                 return (
                     <button
                        key={airline}
                        onClick={() => setActiveAirline(airline)}
                        className={`
                            group
                            shrink-0 px-6 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-r ${isDarkMode ? 'border-slate-950/20' : 'border-slate-200'} last:border-r-0
                            ${isActive 
                                ? (isDarkMode ? 'bg-slate-950 text-emerald-400 border-b-2 border-emerald-500' : 'bg-[#329858] text-white border-b-0')
                                : (isDarkMode ? 'text-slate-500 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')}
                        `}
                     >
                        <div className="w-5 h-5 flex items-center justify-center bg-white rounded-sm overflow-hidden shrink-0 shadow-sm border border-slate-200">
                            <AirlineLogo airlineCode={airline} className="w-full h-full object-contain" fallback={<span className="text-black text-[8px] font-black leading-none">{airline.slice(0, 3)}</span>} />
                        </div>
                        {airline}
                     </button>
                 )
             })}
             <button 
                onClick={() => setShowNewAirlineModal(true)}
                className={`w-12 flex items-center justify-center shrink-0 border-r ${isDarkMode ? 'bg-slate-800 text-emerald-400 hover:bg-slate-700 border-slate-950/20' : 'bg-slate-100 text-[#329858] hover:bg-slate-200 border-slate-200'} transition-colors group`}
                title="Adicionar nova companhia"
             >
                <Plus size={16} className="group-hover:scale-110 transition-transform" />
             </button>
           </nav>
        </div>

        {/* TABLE WRAPPER - aligned to left with right space */}
        <div className={`w-full flex-1 overflow-auto relative flex justify-start custom-scrollbar items-start ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
            <div className={`w-max border-r border-b text-left ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`} style={{ minWidth: '500px' }}>
                <table className="w-full text-left border-separate border-spacing-0">
                    <thead className={`sticky top-0 z-10 ${isDarkMode ? 'bg-slate-950 border-slate-700' : 'bg-[#2D8E48] text-white shadow-sm'}`}>
                        <tr>
                            {COLUMNS.map((col, idx) => {
                                if (col.key === 'airline' && col.label === 'Logo') {
                                    return <th key={idx} className={`px-2 py-3 text-[10px] font-black uppercase tracking-widest border-b border-r ${isDarkMode ? 'border-slate-800' : 'border-[#29824a]'} text-center ${col.width}`}>{col.label}</th>
                                }
                                return (
                                    <th key={idx} className={`px-2 py-3 text-[10px] font-black uppercase tracking-widest border-b border-r ${isDarkMode ? 'border-slate-800' : 'border-[#29824a]'} text-center ${col.width}`}>
                                        {col.label}
                                    </th>
                                )
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {currentAirlineAircrafts.length === 0 ? (
                            <tr>
                                <td colSpan={COLUMNS.length} className={`px-4 py-8 text-center text-[10px] uppercase tracking-widest font-black ${isDarkMode ? 'bg-slate-900 text-slate-500' : 'bg-white text-slate-400'}`}>
                                    Nenhuma aeronave cadastrada para esta companhia
                                </td>
                            </tr>
                        ) : (
                            currentAirlineAircrafts.map((aircraft, rowIndex) => (
                                <tr key={aircraft.id} className={`group transition-colors h-10 border-b ${isDarkMode ? 'hover:bg-slate-800/50 border-slate-800/50' : 'hover:bg-slate-50 border-slate-200'}`}>
                                    {COLUMNS.map((col, colIndex) => {
                                        if (col.key === 'airline' && col.label === 'Logo') {
                                            return (
                                                <td key={`${aircraft.id}-logo`} className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-slate-800/20' : 'border-slate-200 bg-white group-hover:bg-slate-50'} text-center relative pointer-events-none align-middle`}>
                                                    <div className="w-8 h-8 rounded bg-white overflow-hidden mx-auto flex items-center justify-center p-0.5 shadow-sm border border-slate-200">
                                                        <AirlineLogo airlineCode={aircraft.airline} className="w-full h-full object-contain" fallback={<span className="text-black text-[8px] font-black tabular-nums">{aircraft.airline.slice(0, 3)}</span>} />
                                                    </div>
                                                </td>
                                            )
                                        }

                                        if (col.key === 'actions') {
                                            return (
                                                <td key={`${aircraft.id}-actions`} className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-slate-800/20' : 'border-slate-200 bg-white group-hover:bg-slate-50'} text-center actions-container align-middle`}>
                                                    <div className="flex justify-center">
                                                        <button onClick={() => handleDeleteAircraft(aircraft.id)} className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${isDarkMode ? 'hover:bg-red-500/20 text-slate-400 hover:text-red-400' : 'hover:bg-red-500/10 text-slate-400 hover:text-red-500'}`}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            );
                                        }

                                        const value = aircraft[col.key as keyof AircraftType];
                                        const isEditingObj = editingCell?.rowId === aircraft.id && editingCell?.col === colIndex;
                                        
                                        // Conditional styles based on column
                                        const extraStyle = col.key === 'prefix' ? (isDarkMode ? 'text-emerald-500 tracking-tighter' : 'text-emerald-600 tracking-tighter') : '';

                                        return (
                                            <td 
                                                key={`${aircraft.id}-${col.key}-${colIndex}`} 
                                                className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-slate-800/20 text-slate-300' : 'border-slate-200 bg-white group-hover:bg-slate-50 text-slate-700'} text-center relative cursor-text align-middle transition-colors`}
                                                onClick={() => setEditingCell({ rowId: aircraft.id, col: colIndex })}
                                            >
                                                {isEditingObj ? (
                                                    <input 
                                                        autoFocus
                                                        value={value as string || ''}
                                                        onChange={(e) => handleUpdateField(aircraft.id, col.key as keyof AircraftType, e.target.value.toUpperCase())}
                                                        onBlur={() => setEditingCell(null)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null);
                                                        }}
                                                        className={`w-full px-1 py-1 rounded text-[11px] font-mono font-bold text-center outline-none focus:ring-1 uppercase ${isDarkMode ? 'bg-slate-950 text-emerald-400 border border-emerald-500/50 focus:ring-emerald-500' : 'bg-slate-100 text-emerald-700 border border-emerald-500/30 focus:ring-emerald-600'}`}
                                                    />
                                                ) : (
                                                    <div className={`font-mono text-[11px] font-bold w-full uppercase flex items-center justify-center min-h-[24px] ${extraStyle}`}>
                                                        {value || '--'}
                                                    </div>
                                                )}
                                            </td>
                                        )
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* NEW AIRLINE MODAL */}
        {showNewAirlineModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm shadow-2xl">
                <div className={`p-6 rounded-xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] w-80 flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                    <h2 className={`font-black text-xs uppercase tracking-widest ${isDarkMode ? 'text-emerald-500' : 'text-emerald-600'}`}>Nova Companhia</h2>
                    <div>
                        <label className={`block text-[9px] font-black uppercase tracking-widest mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            Código IATA ou Nome
                        </label>
                        <input
                            type="text"
                            value={newAirlineName}
                            onChange={(e) => setNewAirlineName(e.target.value.toUpperCase())}
                            className={`w-full px-3 py-2 rounded text-xs focus:outline-none focus:ring-1 font-mono tracking-wider transition-all placeholder:opacity-50 ${isDarkMode ? 'bg-slate-950 border border-slate-700 text-white focus:ring-emerald-500 focus:border-emerald-500' : 'bg-slate-50 border border-slate-300 text-slate-900 focus:ring-emerald-600 focus:border-emerald-600'}`}
                            placeholder="LATAM"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateNewAirline();
                                if (e.key === 'Escape') setShowNewAirlineModal(false);
                            }}
                        />
                    </div>
                    <div className="flex items-center justify-end flex-wrap gap-2 pt-2">
                        <button onClick={() => setShowNewAirlineModal(false)} className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100 text-slate-700'}`}>
                            Cancelar
                        </button>
                        <button onClick={handleCreateNewAirline} className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded shadow-md transition-colors flex items-center gap-1.5 active:scale-95 ${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-[#329858] hover:bg-[#29824a] text-white'}`}>
                            <Plus size={12} />
                            Adicionar
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
