import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Trash2, Edit2, ChevronDown, RefreshCw, Save, X, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { OperatorProfile } from '../types';

interface OperatorsAdminProps {
  isDarkMode: boolean;
}

type OperatorField = keyof OperatorProfile | 'actions';

const COLUMNS: { key: OperatorField; label: string; width: string; isVariable: boolean }[] = [
  { key: 'warName', label: 'Nome de Guerra', width: 'w-48', isVariable: true },
  { key: 'fullName', label: 'Nome Completo', width: 'w-72', isVariable: true },
  { key: 'category', label: 'Categoria', width: 'w-32', isVariable: true },
  { key: 'status', label: 'Status', width: 'w-32', isVariable: true },
  { key: 'fleetCapability', label: 'Frota', width: 'w-24', isVariable: true },
  { key: 'actions', label: 'Ações', width: 'w-20', isVariable: false },
];

export const OperatorsAdmin: React.FC<OperatorsAdminProps> = ({ isDarkMode }) => {
  const [operators, setOperators] = useState<OperatorProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: OperatorField; direction: 'asc' | 'desc' }>({ key: 'warName', direction: 'asc' });
  const [focusedCell, setFocusedCell] = useState<{ rowId: string; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: number } | null>(null);
  
  const tableRef = useRef<HTMLTableElement>(null);

  const fetchOperators = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('operators').select('*').order('war_name');
    if (!error && data) {
      setOperators(data.map(o => ({
        id: o.id,
        fullName: o.full_name,
        warName: o.war_name,
        status: o.status,
        fleetCapability: o.fleet_capability,
        category: o.category,
        companyId: o.company_id || '',
        gruId: o.gru_id || '',
        vestNumber: o.vest_number || '',
        photoUrl: o.photo_url || '',
        lastPosition: o.last_position || '',
        shift: { cycle: 'GERAL', start: '00:00', end: '23:59' } // default placeholder if needed
      } as OperatorProfile)));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOperators();
  }, []);

  const handleFinishEdit = async (rowId: string, colIndex: number) => {
    setEditingCell(null);
    const colKey = COLUMNS[colIndex]?.key;
    if (colKey === 'actions') return;

    const op = operators.find(o => o.id === rowId);
    if (!op) return;

    // Persist to Supabase
    // Mapping camelCase to snake_case for Supabase
    const supabasePayload: any = {};
    if (colKey === 'fullName') supabasePayload.full_name = op.fullName;
    if (colKey === 'warName') supabasePayload.war_name = op.warName;
    if (colKey === 'status') supabasePayload.status = op.status;
    if (colKey === 'fleetCapability') supabasePayload.fleet_capability = op.fleetCapability;
    if (colKey === 'category') supabasePayload.category = op.category;

    if (Object.keys(supabasePayload).length > 0) {
      if (rowId.startsWith('new-')) {
          // It's a new unsaved row, wait until they finish editing something or manually dispatch. 
          // Actually, let's auto-save new rows if they have warName and fullName at least
          if (op.warName && op.fullName && !op.id.startsWith('saved-')) {
              const insertPayload = {
                  full_name: op.fullName,
                  war_name: op.warName,
                  status: op.status || 'DISPONÍVEL',
                  fleet_capability: op.fleetCapability || 'SRV',
                  category: op.category || 'JUNIOR',
                  company_id: op.companyId || '',
                  gru_id: op.gruId || '',
                  vest_number: op.vestNumber || '',
              };
              const { data, error } = await supabase.from('operators').insert([insertPayload]).select('id').single();
              if (!error && data) {
                  // update local ID to the real UUID so future edits use update()
                  setOperators(prev => prev.map(o => o.id === rowId ? { ...o, id: data.id } : o));
              }
          }
      } else {
        await supabase.from('operators').update(supabasePayload).eq('id', rowId);
      }
    }
  };

  const startEditingCell = (rowId: string, colIndex: number) => {
    setEditingCell({ rowId, col: colIndex });
  };

  const handleFieldChange = (id: string, field: OperatorField, value: string) => {
    if (field === 'actions') return;

    let newValue: any = value.toUpperCase();
    
    setOperators(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(f => f.id === id);
        if (idx !== -1) {
            updated[idx] = { ...updated[idx], [field]: newValue };
        }
        return updated;
    });
  };

  const handleAddOperator = () => {
    const newOp: OperatorProfile = {
      id: `new-${Date.now()}`,
      fullName: '',
      warName: '',
      status: 'DISPONÍVEL',
      category: 'JUNIOR',
      fleetCapability: 'SRV',
      companyId: '',
      gruId: '',
      vestNumber: '',
      photoUrl: '',
      lastPosition: '',
      shift: { cycle: 'GERAL', start: '00:00', end: '23:59' }
    };
    setOperators(prev => [newOp, ...prev]);
    setFocusedCell({ rowId: newOp.id, col: 0 });
    setEditingCell({ rowId: newOp.id, col: 0 });
  };

  const handleDeleteOperator = async (id: string) => {
    if (!id.startsWith('new-')) {
      await supabase.from('operators').delete().eq('id', id);
    }
    setOperators(prev => prev.filter(f => f.id !== id));
    setFocusedCell(null);
  };

  // 1. Base filtering
  const filteredOperators = useMemo(() => {
    return operators.filter(o => 
      o.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      o.warName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.category.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => {
      const isAsc = sortConfig.direction === 'asc';
      const key = sortConfig.key === 'actions' ? 'warName' : sortConfig.key;
      const valA = String(a[key] || '');
      const valB = String(b[key] || '');
      
      if (valA === valB) return 0;
      const comparison = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      return isAsc ? comparison : -comparison;
    });
  }, [operators, searchTerm, sortConfig]);

  const handleSort = (key: OperatorField) => {
    if (key === 'actions') return;
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    const op = filteredOperators[rowIndex];
    if (!op) return;
    const isEditing = editingCell?.rowId === op.id && editingCell?.col === colIndex;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (rowIndex < filteredOperators.length - 1) {
          setFocusedCell({ rowId: filteredOperators[rowIndex + 1].id, col: colIndex });
        }
        setEditingCell(null);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (rowIndex > 0) {
          setFocusedCell({ rowId: filteredOperators[rowIndex - 1].id, col: colIndex });
        }
        setEditingCell(null);
        break;
      case 'ArrowRight':
        if (!isEditing) {
          e.preventDefault();
          setFocusedCell({ rowId: op.id, col: Math.min(COLUMNS.length - 1, colIndex + 1) });
        } else {
          const input = e.target as HTMLInputElement;
          if (input.selectionStart === input.value.length) {
            e.preventDefault();
            setFocusedCell({ rowId: op.id, col: Math.min(COLUMNS.length - 1, colIndex + 1) });
            handleFinishEdit(op.id, colIndex);
          }
        }
        break;
      case 'ArrowLeft':
        if (!isEditing) {
          e.preventDefault();
          setFocusedCell({ rowId: op.id, col: Math.max(0, colIndex - 1) });
        } else {
          const input = e.target as HTMLInputElement;
          if (input.selectionStart === 0) {
            e.preventDefault();
            setFocusedCell({ rowId: op.id, col: Math.max(0, colIndex - 1) });
            handleFinishEdit(op.id, colIndex);
          }
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (isEditing) {
            setFocusedCell({ rowId: op.id, col: Math.min(COLUMNS.length - 1, colIndex + 1) });
            handleFinishEdit(op.id, colIndex);
        } else if (COLUMNS[colIndex].isVariable) {
          startEditingCell(op.id, colIndex);
        } else {
          setFocusedCell({ rowId: op.id, col: Math.min(COLUMNS.length - 1, colIndex + 1) });
        }
        break;
      case 'Tab':
        e.preventDefault();
        handleFinishEdit(op.id, colIndex);
        if (e.shiftKey) {
          if (colIndex > 0) {
            setFocusedCell({ rowId: op.id, col: colIndex - 1 });
          } else if (rowIndex > 0) {
            setFocusedCell({ rowId: filteredOperators[rowIndex - 1].id, col: COLUMNS.length - 1 });
          }
        } else {
          if (colIndex < COLUMNS.length - 1) {
            setFocusedCell({ rowId: op.id, col: colIndex + 1 });
          } else if (rowIndex < filteredOperators.length - 1) {
            setFocusedCell({ rowId: filteredOperators[rowIndex + 1].id, col: 0 });
          }
        }
        break;
      case 'Escape':
        if (editingCell) {
          e.preventDefault();
          handleFinishEdit(op.id, colIndex);
        }
        break;
      case 'Backspace':
      case 'Delete':
        if (!isEditing) {
          e.preventDefault();
          handleFieldChange(op.id, COLUMNS[colIndex].key, '');
        }
        break;
      default:
        // Handle alphanumeric direct entry like Excel
        if (!isEditing && !e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
          e.preventDefault();
          startEditingCell(op.id, colIndex);
          handleFieldChange(op.id, COLUMNS[colIndex].key, e.key);
        }
        break;
    }
  };

  useEffect(() => {
    if (focusedCell) {
      const rowIndex = filteredOperators.findIndex(f => f.id === focusedCell.rowId);
      if (rowIndex !== -1) {
        if (editingCell?.rowId === focusedCell.rowId && editingCell?.col === focusedCell.col) {
          const input = tableRef.current?.querySelector(`tr[data-row="${rowIndex}"] td[data-col="${focusedCell.col}"] input`) as HTMLInputElement;
          if (input && document.activeElement !== input) {
            input.focus();
            input.select();
          }
        } else {
          // Focus the cell div to enable keyboard nav without showing a cursor
          const cell = tableRef.current?.querySelector(`tr[data-row="${rowIndex}"] td[data-col="${focusedCell.col}"] div`) as HTMLDivElement;
          if (cell && document.activeElement !== cell) {
            cell.focus();
          }
        }
      }
    }
  }, [focusedCell, editingCell, filteredOperators]);

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.getElementById('subheader-portal-target'));
  }, []);

  const headerContent = (
    <div className={`px-4 h-auto min-h-[3.5rem] py-1.5 shrink-0 flex items-center flex-wrap md:flex-nowrap justify-between gap-2 border-b ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-[#000021] border-transparent text-white'} z-[60] w-full shadow-md`}>
      <div className="flex items-center gap-2 md:gap-4 flex-wrap md:flex-nowrap">
        {/* Brand & Quick Stats */}
        <div className="flex items-center gap-2 shrink-0 pr-2 border-r border-white/10">
          <div className="flex flex-col">
            <h2 className="text-sm font-black text-white tracking-widest uppercase italic leading-none">DB Operadores</h2>
            <p className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter mt-1">{filteredOperators.length} REGISTROS</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Search Engine - COMPACT */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={13} className="text-white/40 group-focus-within:text-white transition-colors" />
          </div>
          <input 
            type="text" 
            placeholder="PESQUISAR OPERADOR..." 
            className="bg-black/20 border border-white/10 rounded-lg text-[10px] text-white placeholder:text-white/20 font-bold uppercase w-56 pl-9 pr-3 h-9 tracking-widest outline-none focus:ring-1 focus:ring-amber-500/50 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button 
            onClick={fetchOperators}
            className={`flex items-center gap-2 p-2 rounded-md transition-all font-bold uppercase tracking-wider text-[11px] bg-black/20 hover:bg-black/40 text-white border border-transparent hover:border-white/10`}
            title="Recarregar do banco"
        >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
        </button>

        <button 
            onClick={handleAddOperator}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all font-bold uppercase tracking-wider text-[11px] bg-[#FEDC00] text-slate-900 hover:bg-[#e5c600] shadow-sm active:scale-95 border border-[#FEDC00]`}
        >
            <Plus size={14} />
            <span>Novo Op</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col animate-in fade-in">
      <div className={`flex-1 overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
        
        {/* Header */}
        {portalTarget ? createPortal(headerContent, portalTarget) : headerContent}

        {/* Spreadsheet Area */}
        <div className={`flex-1 min-w-0 overflow-auto ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
          <table ref={tableRef} className="w-full border-collapse table-fixed select-none min-w-[800px]">
            <thead className="sticky top-0 z-[40]">
                <tr className={`${isDarkMode ? 'bg-slate-800/95 text-slate-400' : 'bg-slate-800 text-slate-200'} backdrop-blur-sm shadow-md`}>
                {COLUMNS.map((col, idx) => (
                    <th 
                      key={col.key} 
                      onClick={() => handleSort(col.key)}
                      className={`
                        ${col.width} px-2 py-3 text-[10px] font-black uppercase tracking-widest border-b border-r ${isDarkMode ? 'border-slate-700' : 'border-slate-700/50'} text-center
                        ${col.isVariable ? (isDarkMode ? 'bg-[#FEDC00]/10 text-[#FEDC00]' : 'bg-[#FEDC00]/20 text-slate-900') : ''}
                        ${col.key !== 'actions' ? 'cursor-pointer hover:bg-slate-700 transition-colors' : ''}
                      `}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        {col.label}
                        {col.key !== 'actions' && (
                          <div className="flex flex-col gap-0.5 opacity-30">
                            <ChevronDown size={8} className={`-rotate-180 ${sortConfig.key === col.key && sortConfig.direction === 'asc' ? 'opacity-100 text-[#FEDC00]' : ''}`} />
                            <ChevronDown size={8} className={`${sortConfig.key === col.key && sortConfig.direction === 'desc' ? 'opacity-100 text-[#FEDC00]' : ''}`} />
                          </div>
                        )}
                      </div>
                    </th>
                ))}
              </tr>
            </thead>
              <tbody className={isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}>
              {filteredOperators.map((op, rIdx) => {
                
                return (
                  <tr 
                    key={op.id}
                    data-row={rIdx}
                    className={`
                      group relative transition-all h-10 border-b ${isDarkMode ? 'border-slate-800/50' : 'border-slate-200'}
                      ${isDarkMode ? 'bg-slate-950 hover:bg-slate-800' : 'bg-white hover:bg-slate-50'}
                    `}
                  >
                    {COLUMNS.map((col, cIdx) => {
                      const isCellFocused = focusedCell?.rowId === op.id && focusedCell?.col === cIdx;
                      const isCellEditing = editingCell?.rowId === op.id && editingCell?.col === cIdx;
                      const cellValue = op[col.key as OperatorField] || '';
                      const isMandatoryField = col.key === 'warName' || col.key === 'fullName';
                      const isMandatoryEmpty = isMandatoryField && (cellValue === '' || cellValue === '?');
                      
                      if (col.key === 'actions') {
                        return (
                          <td 
                            key={`${op.id}-actions`}
                            className={`p-0 relative h-10 text-center pointer-events-auto actions-container border-r border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}
                          >
                            <div className="flex items-center justify-center w-full h-full gap-1">
                              <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteOperator(op.id);
                                }}
                                className="p-1.5 rounded-md hover:bg-red-500/20 text-red-500 transition-all active:scale-95"
                                title="Excluir"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td 
                          key={`${op.id}-${col.key}`} 
                          data-col={cIdx}
                          onClick={() => {
                            if (isCellFocused) {
                              startEditingCell(op.id, cIdx);
                            } else {
                              setFocusedCell({ rowId: op.id, col: cIdx });
                              setEditingCell(null);
                            }
                          }}
                          className={`
                            p-0 border-r border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} relative transition-all h-10
                            ${col.isVariable ? (isDarkMode ? 'bg-[#FEDC00]/5' : 'bg-[#FEDC00]/5') : ''}
                            ${isCellFocused ? 'ring-2 ring-[#FEDC00] ring-inset z-20 shadow-xl' : ''}
                          `}
                        >
                          {isCellEditing ? (
                            <input 
                              type="text"
                              autoFocus
                              value={String(op[col.key as OperatorField] || '')}
                              onChange={(e) => handleFieldChange(op.id, col.key as OperatorField, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                              onBlur={() => handleFinishEdit(op.id, cIdx)}
                              className={`
                                absolute inset-0 w-full h-full px-3 bg-[#e5c600] text-slate-950 font-mono text-[11px] uppercase font-black outline-none
                                ${col.key === 'fullName' ? 'text-left' : 'text-center'}
                              `}
                            />
                          ) : (
                            <div 
                              tabIndex={0}
                              onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                              className={`
                                w-full h-full px-3 flex items-center gap-2 font-bold text-[11px] uppercase select-none cursor-default outline-none tracking-tight relative
                                ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}
                                ${col.key === 'fullName' ? 'justify-start text-left' : 'justify-center text-center'}
                                ${isMandatoryEmpty ? 'text-red-500 animate-pulse font-black text-xs' : ''}
                                ${col.key === 'status' && cellValue === 'DISPONÍVEL' ? 'text-emerald-500' : ''}
                                ${col.key === 'status' && (cellValue === 'FÉRIAS' || cellValue === 'AFASTADO') ? 'text-amber-500' : ''}
                                ${col.key === 'status' && cellValue === 'OCUPADO' ? 'text-indigo-500' : ''}
                              `}
                            >
                              <span>{isMandatoryEmpty ? '?' : (String(cellValue) || '-')}</span>
                              {isMandatoryEmpty && op.id === focusedCell?.rowId && (
                                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]" />
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredOperators.length === 0 && (
            <div className="flex flex-col items-center justify-center p-20 text-slate-500">
               <Search size={48} className="opacity-10 mb-4" />
               <p className="text-xs font-bold uppercase tracking-widest opacity-40">Nenhum registro encontrado</p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className={`h-8 px-6 border-t flex items-center justify-between text-[9px] font-bold uppercase tracking-widest ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-white border-slate-200 text-slate-400'}`}>
          <div className="flex gap-4">
            <span>Registros: {filteredOperators.length}</span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-[#FEDC00]"></div>
              Salvo automaticamente
            </span>
          </div>
          <div>Dica: 1 clique seleciona, 2 cliques editam. Setas navegam, Enter pula para a direita.</div>
        </div>
      </div>
    </div>
  );
};
