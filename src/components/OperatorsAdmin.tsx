import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Trash2, Edit2, ChevronDown, RefreshCw, Save, X, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { OperatorProfile } from '../types';

interface OperatorsAdminProps {
  isDarkMode: boolean;
}

type OperatorField = keyof OperatorProfile | 'actions' | 'shiftCycle' | 'shiftStart' | 'shiftEnd';

const COLUMNS: { key: OperatorField; label: string; width: string; isVariable: boolean }[] = [
  { key: 'photoUrl', label: 'Foto (URL)', width: 'w-[100px]', isVariable: true },
  { key: 'warName', label: 'Nome de Guerra', width: 'w-[140px]', isVariable: true },
  { key: 'fullName', label: 'Nome Completo', width: 'w-[260px]', isVariable: true },
  { key: 'role', label: 'Função', width: 'w-[100px]', isVariable: true },
  { key: 'isLT', label: 'LT?', width: 'w-[60px]', isVariable: true },
  { key: 'companyId', label: 'Matr. VB', width: 'w-[100px]', isVariable: true },
  { key: 'gruId', label: 'Matr. Gru', width: 'w-[100px]', isVariable: true },
  { key: 'vestNumber', label: 'ISO', width: 'w-[70px]', isVariable: true },
  { key: 'tmfLogin', label: 'Log. TMF', width: 'w-[90px]', isVariable: true },
  { key: 'bloodType', label: 'TS', width: 'w-[60px]', isVariable: true },
  { key: 'patio', label: 'Pátio', width: 'w-[100px]', isVariable: true },
  { key: 'shiftCycle', label: 'Turno', width: 'w-[100px]', isVariable: true },
  { key: 'shiftStart', label: 'Hr. Ent.', width: 'w-[80px]', isVariable: true },
  { key: 'shiftEnd', label: 'Hr. Sai.', width: 'w-[80px]', isVariable: true },
  { key: 'status', label: 'Status', width: 'w-[100px]', isVariable: true },
  { key: 'actions', label: 'Ações', width: 'w-[70px]', isVariable: false },
];

export const OperatorsAdmin: React.FC<OperatorsAdminProps> = ({ isDarkMode }) => {
  const [operators, setOperators] = useState<OperatorProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: OperatorField; direction: 'asc' | 'desc' }>({ key: 'warName', direction: 'asc' });
  const [focusedCell, setFocusedCell] = useState<{ rowId: string; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoUploadRowId, setPhotoUploadRowId] = useState<string | null>(null);
  
  const tableRef = useRef<HTMLTableElement>(null);

  const handlePhotoClick = (rowId: string) => {
    setPhotoUploadRowId(rowId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !photoUploadRowId) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          
          // Update locally
          handleFieldChange(photoUploadRowId, 'photoUrl', dataUrl);
          // Persist to Supabase implicitly by calling handleFinishEdit logic later
          // Wait, handleFieldChange just updates the state. We need to trigger save to supabase directly.
          setTimeout(() => {
             // Since handleFieldChange is synchronous but setting state is async, 
             // it's better to force save.
             const insertPayload = { photo_url: dataUrl };
             if (!photoUploadRowId.startsWith('new-')) {
               supabase.from('operators').update(insertPayload).eq('id', photoUploadRowId).then();
             }
          }, 0);
        }
      };
      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

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
        role: o.role || '',
        isLT: o.is_lt || 'NÃO',
        patio: o.patio || '',
        tmfLogin: o.tmf_login || '',
        bloodType: o.blood_type || '',
        companyId: o.company_id || '',
        gruId: o.gru_id || '',
        vestNumber: o.vest_number || '',
        photoUrl: o.photo_url || '',
        lastPosition: o.last_position || '',
        shift: { cycle: o.shift_cycle || 'GERAL', start: o.shift_start || '00:00', end: o.shift_end || '23:59' },
        airlines: [],
        ratings: { speed: 100, safety: 100, airlineSpecific: {} },
        expertise: { servidor: 100, cta: 100 },
        stats: { flightsWeekly: 0, flightsMonthly: 0, volumeWeekly: 0, volumeMonthly: 0 }
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
    if (colKey === 'role') supabasePayload.role = op.role;
    if (colKey === 'isLT') supabasePayload.is_lt = op.isLT;
    if (colKey === 'companyId') supabasePayload.company_id = op.companyId;
    if (colKey === 'gruId') supabasePayload.gru_id = op.gruId;
    if (colKey === 'vestNumber') supabasePayload.vest_number = op.vestNumber;
    if (colKey === 'tmfLogin') supabasePayload.tmf_login = op.tmfLogin;
    if (colKey === 'bloodType') supabasePayload.blood_type = op.bloodType;
    if (colKey === 'patio') supabasePayload.patio = op.patio;
    if (colKey === 'shiftCycle') supabasePayload.shift_cycle = op.shift?.cycle;
    if (colKey === 'shiftStart') supabasePayload.shift_start = op.shift?.start;
    if (colKey === 'shiftEnd') supabasePayload.shift_end = op.shift?.end;
    if (colKey === 'photoUrl') supabasePayload.photo_url = op.photoUrl;

    if (Object.keys(supabasePayload).length > 0) {
      if (rowId.startsWith('new-')) {
          // It's a new unsaved row, wait until they finish editing something or manually dispatch. 
          // Actually, let's auto-save new rows if they have warName and fullName at least
          if (op.warName && op.fullName && !op.id.startsWith('saved-')) {
              const insertPayload = {
                  full_name: op.fullName,
                  war_name: op.warName,
                  status: op.status || 'ATIVO',
                  fleet_capability: op.fleetCapability || 'SRV',
                  category: op.category || 'JUNIOR',
                  role: op.role || '',
                  is_lt: op.isLT || 'NÃO',
                  patio: op.patio || '',
                  tmf_login: op.tmfLogin || '',
                  blood_type: op.bloodType || '',
                  company_id: op.companyId || '',
                  gru_id: op.gruId || '',
                  vest_number: op.vestNumber || '',
                  shift_cycle: op.shift?.cycle || '',
                  shift_start: op.shift?.start || '',
                  shift_end: op.shift?.end || '',
                  photo_url: op.photoUrl || '',
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
    
    if (field === 'companyId' || field === 'gruId') {
      const digits = newValue.replace(/\D/g, '');
      if (digits.length <= 6) {
         if (digits.length > 3) newValue = `${digits.slice(0,3)}.${digits.slice(3)}`;
         else newValue = digits;
      } else {
         newValue = `${digits.slice(0,3)}.${digits.slice(3,6)}`;
      }
    } else if (field === 'vestNumber' || field === 'tmfLogin') {
      newValue = newValue.replace(/\D/g, '').slice(0, 4);
    } else if (field === 'shiftStart' || field === 'shiftEnd') {
      const digits = newValue.replace(/\D/g, '');
      if (digits.length > 2) {
         newValue = `${digits.slice(0,2)}:${digits.slice(2,4)}`;
      } else {
         newValue = digits;
      }
      if (newValue.length > 5) newValue = newValue.slice(0,5);
    }
    
    setOperators(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(f => f.id === id);
        if (idx !== -1) {
            if (field === 'shiftCycle') {
                updated[idx] = { ...updated[idx], shift: { ...updated[idx].shift, cycle: newValue } };
            } else if (field === 'shiftStart') {
                updated[idx] = { ...updated[idx], shift: { ...updated[idx].shift, start: newValue } };
            } else if (field === 'shiftEnd') {
                updated[idx] = { ...updated[idx], shift: { ...updated[idx].shift, end: newValue } };
            } else {
                updated[idx] = { ...updated[idx], [field]: newValue };
            }
        }
        return updated;
    });
  };

  const handleAddOperator = () => {
    const newOp: OperatorProfile = {
      id: `new-${Date.now()}`,
      fullName: '',
      warName: '',
      status: 'ATIVO',
      category: 'JUNIOR',
      fleetCapability: 'SRV',
      companyId: '',
      gruId: '',
      vestNumber: '',
      photoUrl: '',
      lastPosition: '',
      shift: { cycle: 'GERAL', start: '00:00', end: '23:59' },
      airlines: [],
      ratings: { speed: 100, safety: 100, airlineSpecific: {} },
      expertise: { servidor: 100, cta: 100 },
      stats: { flightsWeekly: 0, flightsMonthly: 0, volumeWeekly: 0, volumeMonthly: 0 }
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
        if (isEditing) return; // Allow native dropdown navigation
        e.preventDefault();
        if (rowIndex < filteredOperators.length - 1) {
          setFocusedCell({ rowId: filteredOperators[rowIndex + 1].id, col: colIndex });
        }
        setEditingCell(null);
        break;
      case 'ArrowUp':
        if (isEditing) return; // Allow native dropdown navigation
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
          if (COLUMNS[colIndex].key === 'photoUrl') {
            handlePhotoClick(op.id);
          } else {
            startEditingCell(op.id, colIndex);
          }
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
    <div className={`px-4 h-auto min-h-[3.5rem] py-1.5 shrink-0 flex items-center flex-wrap md:flex-nowrap justify-between gap-2 border-b ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-[#3CA317] border-transparent text-white'} z-[60] w-full shadow-md`}>
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
          <datalist id="datalist-role">
            {['OP. JR.', 'OP. PL', 'OP. SR.', 'OP. LT'].map(v => <option key={v} value={v} />)}
          </datalist>
          <datalist id="datalist-isLT">
            {['SIM', 'NÃO'].map(v => <option key={v} value={v} />)}
          </datalist>
          <datalist id="datalist-patio">
            {['AEROD.', 'VIP', 'AMBOS'].map(v => <option key={v} value={v} />)}
          </datalist>
          <datalist id="datalist-shiftCycle">
            {['MANHÃ', 'TARDE', 'NOITE', 'GERAL'].map(v => <option key={v} value={v} />)}
          </datalist>
          
          <table ref={tableRef} className="w-full border-collapse table-fixed select-none min-w-[800px]">
            <thead className="sticky top-0 z-[40]">
                <tr className={`${isDarkMode ? 'bg-slate-800/95 text-slate-400' : 'bg-slate-800 text-slate-200'} backdrop-blur-sm shadow-md`}>
                {COLUMNS.map((col, idx) => (
                    <th 
                      key={col.key} 
                      onClick={() => handleSort(col.key)}
                      className={`
                        ${col.width} px-2 py-3 text-[10px] font-black uppercase tracking-widest border-b border-r ${isDarkMode ? 'border-slate-700' : 'border-slate-700/50'} text-center
                        ${col.isVariable ? (isDarkMode ? 'bg-emerald-950/20 text-emerald-400' : 'bg-emerald-500/10 text-white') : ''}
                        ${col.key !== 'actions' ? 'cursor-pointer hover:bg-slate-700 transition-colors' : ''}
                      `}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        {col.label}
                        {col.key !== 'actions' && (
                          <div className="flex flex-col gap-0.5 opacity-30">
                            <ChevronDown size={8} className={`-rotate-180 ${sortConfig.key === col.key && sortConfig.direction === 'asc' ? 'opacity-100 text-emerald-400' : ''}`} />
                            <ChevronDown size={8} className={`${sortConfig.key === col.key && sortConfig.direction === 'desc' ? 'opacity-100 text-emerald-400' : ''}`} />
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
                      const getCellValue = (opAny: any, key: string) => {
                        if (key === 'shiftCycle') return opAny.shift?.cycle || '';
                        if (key === 'shiftStart') return opAny.shift?.start || '';
                        if (key === 'shiftEnd') return opAny.shift?.end || '';
                        return opAny[key] || '';
                      };
                      
                      const cellValue = getCellValue(op, col.key);
                      const isMandatoryField = col.key === 'warName' || col.key === 'fullName';
                      const isMandatoryEmpty = isMandatoryField && (cellValue === '' || cellValue === '?');
                      const isSelectField = ['status'].includes(col.key);
                      const isDatalistField = ['role', 'isLT', 'patio', 'shiftCycle'].includes(col.key);
                      
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
                            if (col.key === 'photoUrl') {
                              handlePhotoClick(op.id);
                              return;
                            }
                            if (isCellFocused) {
                              startEditingCell(op.id, cIdx);
                            } else {
                              setFocusedCell({ rowId: op.id, col: cIdx });
                              setEditingCell(null);
                            }
                          }}
                          className={`
                            p-0 border-r border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} relative transition-all h-10
                            ${col.isVariable ? (isDarkMode ? 'bg-emerald-950/5' : 'bg-emerald-500/5') : ''}
                            ${isCellFocused ? 'ring-2 ring-emerald-500 ring-inset z-20 shadow-xl' : ''}
                          `}
                        >
                          {isCellEditing ? (
                            isSelectField ? (
                              <select
                                autoFocus
                                value={String(cellValue)}
                                onChange={(e) => handleFieldChange(op.id, col.key as OperatorField, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                                onBlur={() => handleFinishEdit(op.id, cIdx)}
                                className={`
                                  absolute inset-0 w-full h-full px-3 bg-emerald-500 text-slate-950 font-mono text-[11px] uppercase font-black outline-none appearance-none text-center cursor-pointer
                                `}
                              >
                                <option value=""></option>
                                {col.key === 'status' && ['ATIVO', 'FOLG.', 'FÉRIAS', 'AFAST.'].map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                            ) : (
                              <input 
                                type="text"
                                autoFocus
                                list={isDatalistField ? `datalist-${col.key}` : undefined}
                                placeholder={col.key === 'photoUrl' ? 'URL da Imagem' : undefined}
                                value={String(cellValue)}
                                onChange={(e) => handleFieldChange(op.id, col.key as OperatorField, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                                onBlur={() => handleFinishEdit(op.id, cIdx)}
                                className={`
                                  absolute inset-0 w-full h-full px-3 bg-emerald-500 text-slate-950 font-mono text-[11px] uppercase font-black outline-none
                                  ${col.key === 'fullName' ? 'text-left' : 'text-center'}
                                `}
                              />
                            )
                          ) : (
                            <div 
                              tabIndex={0}
                              onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                              className={`
                                w-full h-full px-3 flex items-center gap-2 font-bold text-[11px] uppercase select-none cursor-default outline-none tracking-tight relative
                                ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}
                                ${col.key === 'fullName' ? 'justify-start text-left' : 'justify-center text-center'}
                                ${isMandatoryEmpty ? 'text-red-500 animate-pulse font-black text-xs' : ''}
                                ${col.key === 'status' && cellValue === 'ATIVO' ? 'text-emerald-500' : ''}
                                ${col.key === 'status' && (cellValue === 'FÉRIAS' || cellValue === 'AFAST.') ? 'text-amber-500' : ''}
                                ${col.key === 'status' && cellValue === 'FOLG.' ? 'text-indigo-500' : ''}
                              `}
                            >
                              {col.key === 'photoUrl' ? (
                                cellValue ? (
                                  <div className={`group w-8 h-8 rounded-full border bg-slate-200 flex-shrink-0 overflow-hidden relative cursor-pointer ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}>
                                    <img src={String(cellValue)} alt="Foto" referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-slate-900 bg-black/20">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                                    </div>
                                  </div>
                                ) : (
                                  <div className={`group w-8 h-8 rounded-full border border-dashed flex items-center justify-center text-[10px] flex-shrink-0 cursor-pointer transition-all ${isDarkMode ? 'border-slate-600 bg-slate-800 hover:bg-slate-700' : 'border-slate-400 bg-slate-100 hover:bg-slate-200'}`}>
                                    <span className="opacity-40 group-hover:hidden">Sem</span>
                                    <svg className="hidden group-hover:block opacity-60" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                                  </div>
                                )
                              ) : (
                                <span>{isMandatoryEmpty ? '?' : (String(cellValue) || '-')}</span>
                              )}
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
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              Salvo automaticamente
            </span>
          </div>
          <div>Dica: 1 clique seleciona, 2 cliques editam. Setas navegam, Enter pula para a direita.</div>
        </div>
      </div>
      
      {/* Hidden inputs & portals */}
      <input 
        type="file" 
        accept="image/jpeg, image/png, image/webp" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handlePhotoFileChange} 
      />
    </div>
  );
};
