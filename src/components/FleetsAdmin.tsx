import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Trash2, Edit2, ChevronDown, RefreshCw, Save, X, Settings, Database } from 'lucide-react';
import { supabase } from '../lib/supabase';

import { Vehicle } from '../types';

interface FleetsAdminProps {
  isDarkMode: boolean;
  globalVehicles: Vehicle[];
  onUpdateGlobalVehicles: (vehicles: Vehicle[]) => void;
}

type FleetField = 'fleetNumber' | 'type' | 'manufacturer' | 'status' | 'maxFlowRate' | 'hasPlatform' | 'capacity' | 'plate' | 'atve' | 'actions';

interface FleetAdminItem {
  id: string;
  fleetNumber: string;
  type: string;
  manufacturer: string;
  status: string;
  maxFlowRate: number;
  hasPlatform: 'SIM' | 'NÃO';
  capacity: number;
  plate: string;
  atve: string;
  observations: string;
}

const COLUMNS: { key: FleetField; label: string; width: string; isVariable: boolean }[] = [
  { key: 'fleetNumber', label: 'ID Frota', width: 'w-[100px]', isVariable: true },
  { key: 'type', label: 'Tipo', width: 'w-[120px]', isVariable: true },
  { key: 'manufacturer', label: 'Fabricante', width: 'w-[200px]', isVariable: true },
  { key: 'status', label: 'Status', width: 'w-[140px]', isVariable: true },
  { key: 'hasPlatform', label: 'Plat. (S/N)?', width: 'w-[100px]', isVariable: true },
  { key: 'capacity', label: 'Capacidade (L)', width: 'w-[150px]', isVariable: true },
  { key: 'plate', label: 'Placa', width: 'w-[120px]', isVariable: true },
  { key: 'atve', label: 'ATVE', width: 'w-[140px]', isVariable: true },
  { key: 'actions', label: 'Ações', width: 'w-[80px]', isVariable: false },
];

export const FleetsAdmin: React.FC<FleetsAdminProps> = ({ isDarkMode, globalVehicles, onUpdateGlobalVehicles }) => {
  const [fleets, setFleets] = useState<FleetAdminItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('TODOS');
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  
  const [sortConfig, setSortConfig] = useState<{ key: FleetField; direction: 'asc' | 'desc' }>({ key: 'fleetNumber', direction: 'asc' });
  const [focusedCell, setFocusedCell] = useState<{ rowId: string; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: number } | null>(null);
  
  const tableRef = useRef<HTMLTableElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);

  const fetchFleets = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('vehicles').select('*').order('fleet_number');
    if (!error && data) {
      setFleets(prev => {
        const newUnsaved = prev.filter(f => f.id.startsWith('new-'));
        const fetched = data.map(v => ({
          id: v.id,
          fleetNumber: v.fleet_number || '',
          type: v.type || 'SERVIDOR',
          manufacturer: v.manufacturer || '',
          status: v.status || 'INATIVO',
          maxFlowRate: v.max_flow_rate || 0,
          hasPlatform: v.has_platform ? 'SIM' : 'NÃO',
          capacity: v.capacity || 0,
          plate: v.plate || '',
          atve: v.atve || '',
          observations: v.observations || ''
        } as FleetAdminItem));
        return [...newUnsaved, ...fetched];
      });
    } else {
        console.error('Error loading fleets:', error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchFleets();
  }, []);

  useEffect(() => {
    // Map FleetAdminItem to Vehicle
    const mappedVehicles: Vehicle[] = fleets.filter(f => !f.id.startsWith('new-')).map(f => ({
      id: f.fleetNumber,
      type: f.type as any,
      manufacturer: f.manufacturer,
      status: f.status as any,
      maxFlowRate: f.maxFlowRate,
      hasPlatform: f.hasPlatform === 'SIM',
      capacity: f.capacity,
    }));
    onUpdateGlobalVehicles(mappedVehicles);
  }, [fleets]);

  const handleFinishEdit = async (rowId: string, colIndex: number) => {
    setEditingCell(null);
    const colKey = COLUMNS[colIndex]?.key;
    if (colKey === 'actions') return;

    const v = fleets.find(f => f.id === rowId);
    if (!v) return;

    const supabasePayload: any = {};
    if (colKey === 'fleetNumber') supabasePayload.fleet_number = v.fleetNumber;
    if (colKey === 'type') supabasePayload.type = v.type;
    if (colKey === 'manufacturer') supabasePayload.manufacturer = v.manufacturer;
    if (colKey === 'status') supabasePayload.status = v.status;
    if (colKey === 'maxFlowRate') supabasePayload.max_flow_rate = v.maxFlowRate;
    if (colKey === 'hasPlatform') supabasePayload.has_platform = v.hasPlatform === 'SIM';
    if (colKey === 'capacity') supabasePayload.capacity = v.capacity;
    if (colKey === 'plate') supabasePayload.plate = v.plate;
    if (colKey === 'atve') supabasePayload.atve = v.atve;

    if (Object.keys(supabasePayload).length > 0) {
      if (rowId.startsWith('new-')) {
          if (v.fleetNumber && !v.id.startsWith('saved-')) {
              const insertPayload = {
                  fleet_number: v.fleetNumber || 'Novo Frota',
                  type: v.type || 'SERVIDOR',
                  manufacturer: v.manufacturer || null,
                  status: v.status || 'INATIVO',
                  max_flow_rate: v.maxFlowRate || null,
                  has_platform: v.hasPlatform === 'SIM',
                  capacity: v.capacity || null,
                  plate: v.plate || null,
                  atve: v.atve || null
              };
              const { data, error } = await supabase.from('vehicles').insert([insertPayload]).select('id').single();
              if (error) console.error('Error inserting vehicle:', error);
              if (!error && data) {
                  lastStableRef.current = lastStableRef.current.map(f => f.id === rowId ? { ...f, id: data.id } : f);
                  setFleets(prev => prev.map(f => f.id === rowId ? { ...f, id: data.id } : f));
              }
          }
      } else {
        const { error } = await supabase.from('vehicles').update(supabasePayload).eq('id', rowId);
        if (error) console.error('Error updating vehicle:', error);
      }
    }
  };

  const startEditingCell = (rowId: string, colIndex: number) => {
    setEditingCell({ rowId, col: colIndex });
  };

  const handleFieldChange = (id: string, field: FleetField, value: string) => {
    if (field === 'actions') return;

    let newValue: any = value;
    if (typeof newValue === 'string') newValue = newValue.toUpperCase();

    if (field === 'maxFlowRate' || field === 'capacity') {
       newValue = parseInt(newValue.replace(/\D/g, ''), 10);
       if (isNaN(newValue)) newValue = 0;
    }

    setFleets(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(f => f.id === id);
        if (idx !== -1) {
            updated[idx] = { ...updated[idx], [field]: newValue };
        }
        return updated;
    });
  };

  const handleAddFleet = async () => {
    const insertPayload = {
        fleet_number: 'NOVO' + Math.floor(Math.random() * 1000),
        type: 'SERVIDOR',
        status: 'INATIVO',
        has_platform: false
    };
    
    try {
        const { data, error } = await supabase.from('vehicles').insert([insertPayload]).select().single();
        if (error) {
            alert('Erro ao criar frota: ' + error.message);
            return;
        }
        
        if (data) {
            fetchFleets(); 
            setFocusedCell({ rowId: data.id, col: 0 });
            setEditingCell({ rowId: data.id, col: 0 });
        }
    } catch (e) {
        console.error(e);
    }
  };

  const handleDeleteFleet = async (id: string) => {
    if (!id.startsWith('new-')) {
      await supabase.from('vehicles').delete().eq('id', id);
    }
    setFleets(prev => prev.filter(f => f.id !== id));
    setFocusedCell(null);
  };

  const lastStableRef = useRef<FleetAdminItem[]>([]);

  const filteredFleets = useMemo(() => {
    const freshSorted = fleets.filter(f => 
      f.fleetNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
      f.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.plate.toLowerCase().includes(searchTerm.toLowerCase())
    ).filter(f => {
      if (filterType !== 'TODOS' && f.type !== filterType) return false;
      if (filterStatus !== 'TODOS' && f.status !== filterStatus) return false;
      return true;
    }).sort((a, b) => {
      const isAsc = sortConfig.direction === 'asc';
      const key = sortConfig.key === 'actions' ? 'fleetNumber' : sortConfig.key;
      const valA = String(a[key] || '');
      const valB = String(b[key] || '');
      
      if (valA === valB) return 0;
      const comparison = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      return isAsc ? comparison : -comparison;
    });

    if (!editingCell) {
      lastStableRef.current = freshSorted;
      return freshSorted;
    }

    const freshIds = new Set(freshSorted.map(f => f.id));
    return lastStableRef.current
      .filter(f => {
        const existsInDatabase = fleets.some(fl => fl.id === f.id);
        const isBeingEdited = f.id === editingCell.rowId;
        const matchesCurrentFilters = freshIds.has(f.id);
        
        return existsInDatabase && (matchesCurrentFilters || isBeingEdited);
      })
      .map(f => {
        const latest = fleets.find(fl => fl.id === f.id);
        return latest || f;
      });
  }, [fleets, searchTerm, sortConfig, editingCell, filterType, filterStatus]);

  const handleSort = (key: FleetField) => {
    if (key === 'actions') return;
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    const v = filteredFleets[rowIndex];
    if (!v) return;
    const isEditing = editingCell?.rowId === v.id && editingCell?.col === colIndex;

    switch (e.key) {
      case 'ArrowDown':
        if (isEditing) return;
        e.preventDefault();
        if (rowIndex < filteredFleets.length - 1) {
          setFocusedCell({ rowId: filteredFleets[rowIndex + 1].id, col: colIndex });
        }
        setEditingCell(null);
        break;
      case 'ArrowUp':
        if (isEditing) return;
        e.preventDefault();
        if (rowIndex > 0) {
          setFocusedCell({ rowId: filteredFleets[rowIndex - 1].id, col: colIndex });
        }
        setEditingCell(null);
        break;
      case 'ArrowRight':
        if (!isEditing) {
          e.preventDefault();
          setFocusedCell({ rowId: v.id, col: Math.min(COLUMNS.length - 1, colIndex + 1) });
        } else {
          const input = e.target as HTMLInputElement;
          if (input.selectionStart === input.value.length) {
            e.preventDefault();
            setFocusedCell({ rowId: v.id, col: Math.min(COLUMNS.length - 1, colIndex + 1) });
            handleFinishEdit(v.id, colIndex);
          }
        }
        break;
      case 'ArrowLeft':
        if (!isEditing) {
          e.preventDefault();
          setFocusedCell({ rowId: v.id, col: Math.max(0, colIndex - 1) });
        } else {
          const input = e.target as HTMLInputElement;
          if (input.selectionStart === 0) {
            e.preventDefault();
            setFocusedCell({ rowId: v.id, col: Math.max(0, colIndex - 1) });
            handleFinishEdit(v.id, colIndex);
          }
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (isEditing) {
            setFocusedCell({ rowId: v.id, col: Math.min(COLUMNS.length - 1, colIndex + 1) });
            handleFinishEdit(v.id, colIndex);
        } else if (COLUMNS[colIndex].isVariable) {
           startEditingCell(v.id, colIndex);
        } else {
          setFocusedCell({ rowId: v.id, col: Math.min(COLUMNS.length - 1, colIndex + 1) });
        }
        break;
      case 'Tab':
        e.preventDefault();
        handleFinishEdit(v.id, colIndex);
        if (e.shiftKey) {
          if (colIndex > 0) {
            setFocusedCell({ rowId: v.id, col: colIndex - 1 });
          } else if (rowIndex > 0) {
            setFocusedCell({ rowId: filteredFleets[rowIndex - 1].id, col: COLUMNS.length - 1 });
          }
        } else {
          if (colIndex < COLUMNS.length - 1) {
            setFocusedCell({ rowId: v.id, col: colIndex + 1 });
          } else if (rowIndex < filteredFleets.length - 1) {
            setFocusedCell({ rowId: filteredFleets[rowIndex + 1].id, col: 0 });
          }
        }
        break;
      case 'Escape':
        if (editingCell) {
          e.preventDefault();
          handleFinishEdit(v.id, colIndex);
        }
        break;
      case 'Backspace':
      case 'Delete':
        if (!isEditing) {
          e.preventDefault();
          handleFieldChange(v.id, COLUMNS[colIndex].key, '');
        }
        break;
      default:
        if (!isEditing && !e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
          e.preventDefault();
          startEditingCell(v.id, colIndex);
          handleFieldChange(v.id, COLUMNS[colIndex].key, e.key);
        }
        break;
    }
  };

  useEffect(() => {
    if (focusedCell) {
      const rowIndex = filteredFleets.findIndex(f => f.id === focusedCell.rowId);
      if (rowIndex !== -1) {
        if (editingCell?.rowId === focusedCell.rowId && editingCell?.col === focusedCell.col) {
          const input = tableRef.current?.querySelector(`tr[data-row="${rowIndex}"] td[data-col="${focusedCell.col}"] input`) as HTMLInputElement;
          if (input && document.activeElement !== input) {
            input.focus();
            input.select();
          }
        } else {
          const cell = tableRef.current?.querySelector(`tr[data-row="${rowIndex}"] td[data-col="${focusedCell.col}"] div`) as HTMLDivElement;
          if (cell && document.activeElement !== cell) {
            cell.focus();
          }
        }
      }
    }
  }, [focusedCell, editingCell, filteredFleets]);

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.getElementById('subheader-portal-target'));
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
        setShowOptionsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const headerContent = (
    <div className={`px-4 md:px-6 h-16 shrink-0 flex items-center justify-between border-b ${isDarkMode ? "bg-slate-950 border-slate-800" : "bg-[#3CA317] border-transparent text-white"} z-[60] w-full shadow-md`}>
      <div className="flex items-center gap-2 md:gap-4 h-full">
        <div className="flex items-center gap-2 shrink-0 pr-4 border-r border-white/10 h-10">
          <div className="flex flex-col">
            <h2 className="text-sm font-black text-white tracking-widest uppercase italic leading-none">DB Frotas</h2>
            <p className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter mt-1">{filteredFleets.length} REGISTROS</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 h-full">
        <div className="flex items-center gap-2">
          <select 
            className="bg-black/20 hover:bg-black/40 border border-white/10 rounded-md text-[9px] text-white font-bold uppercase h-7 px-2 outline-none cursor-pointer"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="TODOS" className="text-slate-900 bg-white">TIPO: TODOS</option>
            <option value="SERVIDOR" className="text-slate-900 bg-white">SERVIDOR</option>
            <option value="CTA" className="text-slate-900 bg-white">CTA</option>
          </select>

          <select 
            className="bg-black/20 hover:bg-black/40 border border-white/10 rounded-md text-[9px] text-white font-bold uppercase h-7 px-2 outline-none cursor-pointer"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="TODOS" className="text-slate-900 bg-white">STATUS: TODOS</option>
            <option value="DISPONÍVEL" className="text-slate-900 bg-white">DISPONÍVEL</option>
            <option value="OCUPADO" className="text-slate-900 bg-white">OCUPADO</option>
            <option value="INATIVO" className="text-slate-900 bg-white">INATIVO</option>
          </select>
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={13} className="text-white/40 group-focus-within:text-white transition-colors" />
          </div>
          <input 
            type="text" 
            placeholder="PESQUISAR FROTA..." 
            className="bg-black/20 border border-white/10 rounded-lg text-[10px] text-white placeholder:text-white/20 font-bold uppercase w-56 pl-9 pr-3 h-9 tracking-widest outline-none focus:ring-1 focus:ring-amber-500/50 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button 
            onClick={fetchFleets}
            className={`flex items-center gap-2 p-2 rounded-md transition-all font-bold uppercase tracking-wider text-[11px] bg-black/20 hover:bg-black/40 text-white border border-transparent hover:border-white/10`}
            title="Recarregar do banco"
        >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
        </button>

        <div className="relative" ref={optionsMenuRef}>
          <button 
            onClick={() => setShowOptionsDropdown(!showOptionsDropdown)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all font-bold uppercase tracking-wider text-[11px] ${showOptionsDropdown ? 'bg-[#e5c600] shadow-inner' : 'bg-[#FEDC00] hover:bg-[#e5c600] shadow-sm'} text-slate-900 active:scale-95 border border-[#FEDC00]`}
          >
            <Settings size={14} className={showOptionsDropdown ? 'animate-spin-slow' : ''} />
            <span>OPÇÕES</span>
            <ChevronDown size={14} className={`transition-transform duration-200 ${showOptionsDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showOptionsDropdown && (
            <div className={`absolute right-0 top-full mt-2 w-56 ${isDarkMode ? 'bg-slate-900 border-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]' : 'bg-white border-slate-200 shadow-xl'} border rounded-xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2`}>
              <div className="p-1.5 space-y-0.5">
                <button 
                  onClick={() => {
                    handleAddFleet();
                    setShowOptionsDropdown(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isDarkMode ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                  <Plus size={14} />
                  <span>Add. Frota</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col animate-in fade-in">
      <div className={`flex-1 overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
        
        {portalTarget ? createPortal(headerContent, portalTarget) : headerContent}

        <div className={`flex-1 min-w-0 overflow-auto ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
          <table ref={tableRef} className="w-full border-collapse table-fixed select-none min-w-[800px]">
            <thead className={`sticky top-0 z-50 ${isDarkMode ? 'bg-slate-900 border-slate-800 shadow-md' : 'bg-slate-100 border-slate-200 shadow-sm'}`}>
              <tr>
                <th className={`w-10 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} bg-transparent`}></th>
                {COLUMNS.map((col, idx) => (
                  <th 
                    key={col.key} 
                    style={{ width: col.width }}
                    onClick={() => handleSort(col.key)}
                    className={`h-9 px-3 text-left border-b border-r last:border-r-0 ${isDarkMode ? 'border-slate-800 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-200'} text-[9px] font-black uppercase tracking-widest cursor-pointer transition-colors relative group`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.label}</span>
                      {sortConfig.key === col.key && (
                        <span className={`text-[8px] ${sortConfig.direction === 'asc' ? 'text-emerald-500' : 'text-red-500'}`}>
                          {sortConfig.direction === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            
            <tbody className="bg-transparent">
              {filteredFleets.map((v, rowIndex) => (
                <tr 
                  key={v.id} 
                  data-row={rowIndex}
                  className={`group border-b ${isDarkMode ? 'border-slate-800/50 hover:bg-slate-800/20' : 'border-slate-100 hover:bg-slate-50'} transition-colors h-10`}
                >
                  <td className={`w-10 border-r ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} text-center text-slate-500 font-mono text-[9px]`}>
                    {rowIndex + 1}
                  </td>
                  {COLUMNS.map((col, colIndex) => {
                    const isEditing = editingCell?.rowId === v.id && editingCell?.col === colIndex;
                    const isFocused = focusedCell?.rowId === v.id && focusedCell?.col === colIndex;
                    const value = v[col.key] as string | number;

                    const baseCellClasses = `h-10 px-3 border-r last:border-r-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} relative align-middle`;
                    const focusClasses = isFocused ? `ring-2 ring-indigo-500 ring-inset z-20 ${isDarkMode ? 'bg-indigo-900/20' : 'bg-indigo-50/50'}` : '';

                    if (col.key === 'actions') {
                      return (
                        <td key={col.key} className={`${baseCellClasses} ${focusClasses} p-0`} data-col={colIndex}>
                          <div
                            tabIndex={0}
                            onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                            onClick={() => setFocusedCell({ rowId: v.id, col: colIndex })}
                            className="w-full h-full flex items-center justify-center gap-2 outline-none"
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); setFocusedCell({ rowId: v.id, col: 0 }); startEditingCell(v.id, 0); }}
                              className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteFleet(v.id); }}
                              className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={col.key} data-col={colIndex} className={`${baseCellClasses} ${focusClasses} p-0`}>
                        {isEditing ? (
                          <div className="w-full h-full relative" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              autoFocus
                              value={value}
                              onChange={(e) => handleFieldChange(v.id, col.key, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                              onBlur={(e) => {
                                if (!e.relatedTarget || !(e.relatedTarget as HTMLElement).closest('table')) {
                                  handleFinishEdit(v.id, colIndex);
                                }
                              }}
                              className={`w-full h-full px-3 py-0 absolute inset-0 text-[10px] font-bold uppercase outline-none flex items-center shadow-inner pt-[1px] tracking-tight ${isDarkMode ? 'bg-[#0a0f1c] text-emerald-400 border-none' : 'bg-white text-emerald-700 border-none'}`}
                              style={{ lineHeight: '1' }}
                            />
                          </div>
                        ) : (
                          <div
                            tabIndex={0}
                            onClick={() => {
                                setFocusedCell({ rowId: v.id, col: colIndex });
                            }}
                            onDoubleClick={() => {
                              if (col.isVariable) startEditingCell(v.id, colIndex);
                            }}
                            onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                            className={`w-full h-full px-3 flex items-center font-bold text-[10px] uppercase select-none cursor-default outline-none tracking-tight relative overflow-hidden min-w-0 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}
                          >
                            {col.key === 'status' ? (
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                                  value === 'DISPONÍVEL' || value === 'ATIVO' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                                  value === 'OCUPADO' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 
                                  'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                                }`}>
                                   {value}
                                </span>
                            ) : (
                                <span className="truncate w-full">{value}</span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredFleets.length === 0 && !isLoading && (
            <div className="w-full flex-1 flex flex-col items-center justify-center p-12 text-slate-500">
              <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4 border border-slate-700">
                <Database size={24} className="text-slate-400" />
              </div>
              <p className="text-sm font-bold uppercase tracking-widest">Nenhum frota encontrado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
