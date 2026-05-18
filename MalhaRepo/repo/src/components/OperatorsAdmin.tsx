import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Trash2, Edit2, ChevronDown, RefreshCw, Save, X, Settings, Upload, Download, Calendar as CalendarIcon, ChevronLeft, ChevronRight, User, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { updateOperatorWorkDays } from '../services/supabaseService';
import { OperatorProfile } from '../types';
import * as XLSX from 'xlsx';

interface OperatorsAdminProps {
  isDarkMode: boolean;
  globalOperators: OperatorProfile[];
  onUpdateGlobalOperators: (ops: OperatorProfile[]) => void;
}

type OperatorField = keyof OperatorProfile | 'actions' | 'shiftCycle' | 'shiftStart' | 'shiftEnd';

const COLUMNS: { key: OperatorField; label: string; width: string; isVariable: boolean }[] = [
  { key: 'photoUrl', label: 'FOTO', width: 'w-[70px] min-w-[70px] text-center', isVariable: false },
  { key: 'warName', label: 'NOME DE GUERRA', width: 'w-[140px] min-w-[140px]', isVariable: true },
  { key: 'fullName', label: 'NOME COMPLETO', width: 'w-[200px] min-w-[200px]', isVariable: true },
  { key: 'role', label: 'FUNÇÃO', width: 'w-[100px] min-w-[100px]', isVariable: true },
  { key: 'isLT', label: 'LT?', width: 'w-[70px] min-w-[70px]', isVariable: true },
  { key: 'companyId', label: 'MATR. VB', width: 'w-[100px] min-w-[100px]', isVariable: true },
  { key: 'gruId', label: 'MATR. GRU', width: 'w-[100px] min-w-[100px]', isVariable: true },
  { key: 'vestNumber', label: 'ISO', width: 'w-[70px] min-w-[70px]', isVariable: true },
  { key: 'tmfLogin', label: 'LOG. TMF', width: 'w-[100px] min-w-[100px]', isVariable: true },
  { key: 'bloodType', label: 'TS', width: 'w-[60px] min-w-[60px]', isVariable: true },
  { key: 'email', label: 'EMAIL CORP.', width: 'w-[240px] min-w-[240px]', isVariable: true },
  { key: 'patio', label: 'PÁTIO', width: 'w-[100px] min-w-[100px]', isVariable: true },
  { key: 'shiftCycle', label: 'TURNO', width: 'w-[100px] min-w-[100px]', isVariable: true },
  { key: 'shiftStart', label: 'HR. ENT.', width: 'w-[80px] min-w-[80px]', isVariable: true },
  { key: 'shiftEnd', label: 'HR. SAI.', width: 'w-[80px] min-w-[80px]', isVariable: true },
  { key: 'status', label: 'STATUS', width: 'w-[100px] min-w-[100px]', isVariable: true },
  { key: 'workDays', label: 'ESCALA', width: 'w-[80px] min-w-[80px]', isVariable: false },
  { key: 'actions', label: 'AÇÕES', width: 'w-[80px] min-w-[80px]', isVariable: false },
];

export const OperatorsAdmin: React.FC<OperatorsAdminProps> = ({ isDarkMode, globalOperators, onUpdateGlobalOperators }) => {
  const [operators, setOperators] = useState<OperatorProfile[]>(globalOperators);
  const [isLoading, setIsLoading] = useState(true);

  // Sync to global Operators on change
  useEffect(() => {
    onUpdateGlobalOperators(operators.filter(o => !o.id.startsWith('new-')));
  }, [operators]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterShift, setFilterShift] = useState<string>('TODOS');
  const [filterCategory, setFilterCategory] = useState<string>('TODOS');
  const [filterPatio, setFilterPatio] = useState<string>('TODOS');
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  
  const [sortConfig, setSortConfig] = useState<{ key: OperatorField; direction: 'asc' | 'desc' }>({ key: 'warName', direction: 'asc' });
  const [focusedCell, setFocusedCell] = useState<{ rowId: string; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: number } | null>(null);
  const [isKeystrokeEdit, setIsKeystrokeEdit] = useState(false);
  const [unlockedRowId, setUnlockedRowId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoUploadRowId, setPhotoUploadRowId] = useState<string | null>(null);
  
  const tableRef = useRef<HTMLTableElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  const [schedulingOperator, setSchedulingOperator] = useState<OperatorProfile | null>(null);

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
               supabase.from('operadores_geral').update(insertPayload).eq('id', photoUploadRowId).then();
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
    const { data, error } = await supabase.from('operadores_geral').select('*, oper_do_dia(work_date, day_type)').order('war_name');
    if (!error && data) {
      setOperators(prev => {
        const newUnsaved = prev.filter(o => o.id.startsWith('new-'));
        const fetched = data.map(o => ({
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
          email: o.email || '',
          companyId: o.company_id || '',
          gruId: o.gru_id || '',
          vestNumber: o.vest_number || '',
          photoUrl: o.photo_url || '',
          lastPosition: o.last_position || '',
          shift: { cycle: o.shift_cycle || 'GERAL', start: o.shift_start || '00:00', end: o.shift_end || '23:59' },
          airlines: [],
          ratings: { speed: 100, safety: 100, airlineSpecific: {} },
          expertise: { servidor: 100, cta: 100 },
          stats: { flightsWeekly: 0, flightsMonthly: 0, volumeWeekly: 0, volumeMonthly: 0 },
          workDays: o.operator_work_days?.map((wd: any) => ({
            date: wd.work_date,
            type: wd.day_type || 'TRABALHO'
          })) || []
        } as OperatorProfile));
        return [...newUnsaved, ...fetched];
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOperators();
  }, []);

  const handleFinishEdit = async (rowId: string, colIndex: number) => {
    setEditingCell(null);
    setIsKeystrokeEdit(false);
  };

  const startEditingCell = (rowId: string, colIndex: number) => {
    if (!rowId.startsWith('new-') && unlockedRowId !== rowId) return;
    setEditingCell({ rowId, col: colIndex });
  };

  const handleSaveExistingOperator = async (op: any) => {
    let emailVal = op.email?.toLowerCase().trim() || null;
    if (emailVal && !emailVal.includes('@')) {
        emailVal = `${emailVal}@vibraenergia.com.br`;
    }
    
    const supabasePayload = {
      full_name: op.fullName,
      war_name: op.warName,
      status: op.status,
      fleet_capability: op.fleetCapability,
      category: op.role || op.category || 'JUNIOR',
      role: op.role || null,
      is_lt: op.isLT || 'NÃO',
      company_id: op.companyId || null,
      gru_id: op.gruId || null,
      vest_number: op.vestNumber || null,
      tmf_login: op.tmfLogin || null,
      blood_type: op.bloodType || null,
      email: emailVal,
      patio: op.patio || null,
      shift_cycle: op.shift?.cycle || null,
      shift_start: op.shift?.start || null,
      shift_end: op.shift?.end || null,
    };

    const { error } = await supabase.from('operadores_geral').update(supabasePayload).eq('id', op.id);
    if (error) {
        alert('Erro ao salvar edição: ' + error.message);
    } else {
        lastStableOperatorsRef.current = lastStableOperatorsRef.current.map(o => o.id === op.id ? { ...op, email: emailVal || '' } : o);
        setOperators(prev => prev.map(o => o.id === op.id ? { ...op, email: emailVal || '' } : o));
        setUnlockedRowId(null);
        setEditingCell(null);
    }
  };

  const handleCancelEdit = (rowId: string) => {
    const stable = lastStableOperatorsRef.current.find(row => row.id === rowId);
    if (stable) {
      setOperators(prev => prev.map(row => row.id === rowId ? stable : row));
    }
    setUnlockedRowId(null);
    setEditingCell(null);
    setFocusedCell(null);
  };

  const handleFieldChange = (id: string, field: OperatorField, value: string) => {
    if (field === 'actions') return;

    let newValue: any = (field === 'photoUrl' || field === 'email') ? value : value.toUpperCase();
    
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
    const newId = `new-${Date.now()}`;
    const optimisticOp = { 
        id: newId, 
        fullName: 'Novo Operador', 
        warName: 'Novo Operador', 
        status: 'ATIVO', 
        isLT: false, 
        shift: { cycle: 'GERAL', start: '00:00', end: '23:59' }
    } as any;
    
    setOperators(prev => [optimisticOp, ...prev]);
    setFocusedCell({ rowId: newId, col: 0 });
    setEditingCell({ rowId: newId, col: 0 });
  };

  const handleSaveNewOperator = async (op: any) => {
    const emailVal = op.email?.toLowerCase().trim();
    const finalEmail = emailVal ? (emailVal.includes('@') ? emailVal : `${emailVal}@vibraenergia.com.br`) : null;
    
    const insertPayload = {
        full_name: op.fullName || 'Sem Nome',
        war_name: op.warName || 'Sem Nome',
        status: op.status || 'ATIVO',
        fleet_capability: op.fleetCapability || 'SRV',
        category: op.role || op.category || 'JUNIOR',
        role: op.role || null,
        is_lt: op.isLT || 'NÃO',
        patio: op.patio || null,
        tmf_login: op.tmfLogin || null,
        blood_type: op.bloodType || null,
        email: finalEmail,
        company_id: op.companyId || null,
        gru_id: op.gruId || null,
        vest_number: op.vestNumber || null,
        shift_cycle: op.shift?.cycle || null,
        shift_start: op.shift?.start || null,
        shift_end: op.shift?.end || null,
        photo_url: op.photoUrl || null,
    };
    
    try {
        const { data, error } = await supabase.from('operadores_geral').insert([insertPayload]).select('id').single();
        if (error) {
            alert('Erro ao criar operador: ' + error.message);
            return;
        }
        
        if (data) {
            setOperators(prev => prev.filter(o => o.id !== op.id));
            fetchOperators(); // reload all to get perfect relations
            setFocusedCell(null);
            setEditingCell(null);
        }
    } catch (e) {
        console.error(e);
        alert('Erro inexperado ao criar operador');
    }
  };

  const handleBatchImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet);

        const newOpsDrafts = json.map((row: any) => {
          const roleVal = row['Função'] || null;
          return {
            fullName: row['Nome Completo'] || 'Operador',
            warName: row['Nome de Guerra'] || 'Operador',
            status: 'ATIVO',
            role: roleVal,
            category: roleVal || 'JUNIOR',
            fleetCapability: 'SRV',
            companyId: row['Matrícula'] || null,
            gruId: row['Credencial GRU'] || null,
            vestNumber: row['Colete'] || null,
            shift: { 
              cycle: row['Turno'] || 'GERAL', 
              start: row['Entrada'] || '00:00', 
              end: row['Saída'] || '23:59' 
            },
            isLT: row['Líder de Turno'] || 'NÃO',
            patio: row['Pátio'] || 'AERODROMO',
          };
        });
        
        // Prepare bulk insert
        const insertPayloads = newOpsDrafts.map((op: any) => ({
          full_name: op.fullName,
          war_name: op.warName,
          status: op.status,
          category: op.category,
          fleet_capability: op.fleetCapability,
          company_id: op.companyId,
          gru_id: op.gruId,
          vest_number: op.vestNumber,
          shift_cycle: op.shift.cycle,
          shift_start: op.shift.start,
          shift_end: op.shift.end,
          is_lt: op.isLT,
          patio: op.patio
        }));
        
        try {
          const { data: inserted, error } = await supabase.from('operadores_geral').insert(insertPayloads).select();
          if (error) {
             alert('Erro ao importar para o banco: ' + error.message);
             return;
          }
          if (inserted) {
            fetchOperators(); // Reload from DB
          }
        } catch (err) {
          console.error('Import error', err);
        }
        setShowOptionsDropdown(false);
      };
      reader.readAsArrayBuffer(file);
    }
    // reset input value
    e.target.value = '';
  };

  const handleExportList = () => {
    const data = operators.map(op => ({
      'Nome Completo': op.fullName,
      'Nome de Guerra': op.warName,
      'Matrícula': op.companyId,
      'Credencial GRU': op.gruId,
      'Colete': op.vestNumber,
      'Turno': op.shift?.cycle || '',
      'Entrada': op.shift?.start || '',
      'Saída': op.shift?.end || '',
      'Líder de Turno': op.isLT || 'NÃO',
      'Pátio': op.patio || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Operadores');
    XLSX.writeFile(workbook, 'Lista_Operadores.xlsx');
  };

  const handleDeleteOperator = async (id: string) => {
    if (!id.startsWith('new-')) {
      await supabase.from('operadores_geral').delete().eq('id', id);
    }
    setOperators(prev => prev.filter(f => f.id !== id));
    setFocusedCell(null);
  };

  // Ref to hold the last stable version of operators before editing
  const lastStableOperatorsRef = useRef<OperatorProfile[]>([]);

  // 1. Base filtering
  const filteredOperators = useMemo(() => {
    const isGridActive = focusedCell !== null;

    const freshSorted = operators.filter(o => {
      const isNewRow = o.id.startsWith('new-');
      if (isNewRow) return true; // ALWAYS SHOW NEW UNSAVED ROWS
      
      const isActiveRow = focusedCell && o.id === focusedCell.rowId;
      if (isActiveRow) return true; // ALWAYS SHOW THE ACTIVE ROW (so new operators don't vanish)
      
      if (searchTerm && !(o.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          o.warName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          o.category.toLowerCase().includes(searchTerm.toLowerCase()))) {
        return false;
      }
      // 1. Turno
      if (filterShift !== 'TODOS') {
        const cycle = o.shift?.cycle?.toUpperCase() || '';
        if (cycle !== filterShift) return false;
      }
      
      // 2. Cargo
      if (filterCategory !== 'TODOS') {
        if (filterCategory === 'LT') {
          if (o.isLT !== 'SIM') return false;
        } else {
          const role = o.role?.toUpperCase() || '';
          if (filterCategory === 'JUNIOR' && !role.includes('JR')) return false;
          if (filterCategory === 'PLENO' && !role.includes('PL')) return false;
          if (filterCategory === 'SENIOR' && !role.includes('SR')) return false;
        }
      }

      // 3. Pátio
      if (filterPatio !== 'TODOS') {
        const pt = o.patio?.toUpperCase() || '';
        if (filterPatio === 'AMBOS') {
            if (pt !== 'AMBOS') return false;
        } else {
            if (!pt.includes(filterPatio) && pt !== 'AMBOS') return false;
        }
      }

      // 4. Status
      if (filterStatus !== 'TODOS') {
         const st = (o.status || '').toUpperCase();
         if (filterStatus === 'ATIVOS') {
           if (st === 'FÉRIAS' || st.includes('AFAST')) return false; 
         } else if (filterStatus === 'FÉRIAS') {
           if (!st.includes('FÉRIA')) return false;
         } else if (filterStatus === 'AFASTADOS') {
           if (!st.includes('AFAST')) return false;
         }
      }

      return true;
    }).sort((a, b) => {
      const isAsc = sortConfig.direction === 'asc';
      const key = sortConfig.key === 'actions' ? 'warName' : sortConfig.key;
      const valA = String(a[key] || '');
      const valB = String(b[key] || '');
      
      if (valA === valB) return 0;
      const comparison = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      return isAsc ? comparison : -comparison;
    });

    if (!isGridActive) {
      lastStableOperatorsRef.current = freshSorted;
      return freshSorted;
    }

    const freshIds = new Set(freshSorted.map(o => o.id));
    const stablePart = lastStableOperatorsRef.current
      .filter(o => {
        const existsInDatabase = operators.some(op => op.id === o.id);
        const isBeingEdited = o.id === focusedCell?.rowId;
        const matchesCurrentFilters = freshIds.has(o.id);
        
        return existsInDatabase && (matchesCurrentFilters || isBeingEdited);
      })
      .map(o => {
        const latest = operators.find(op => op.id === o.id);
        return latest || o;
      });

    const stableIds = new Set(stablePart.map(o => o.id));
    // New operators added while locked appear at the very top.
    const newOperators = freshSorted.filter(o => !stableIds.has(o.id));

    return [...newOperators, ...stablePart];
  }, [operators, searchTerm, sortConfig, focusedCell, filterShift, filterCategory, filterPatio, filterStatus]);

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
        if (editingCell || unlockedRowId === op.id) {
          e.preventDefault();
          if (unlockedRowId === op.id) {
              handleCancelEdit(op.id);
          } else {
              handleFinishEdit(op.id, colIndex);
          }
        }
        break;
      case 'Backspace':
      case 'Delete':
        if (!isEditing && (op.id.startsWith('new-') || unlockedRowId === op.id)) {
          e.preventDefault();
          handleFieldChange(op.id, COLUMNS[colIndex].key, '');
        }
        break;
      default:
        // Handle alphanumeric direct entry like Excel
        if (!isEditing && !e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
          if (!op.id.startsWith('new-') && unlockedRowId !== op.id) return;
          e.preventDefault();
          setIsKeystrokeEdit(true);
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
    <div className={`px-4 md:px-6 h-16 shrink-0 flex items-center justify-between border-b ${isDarkMode ? "bg-slate-950 border-slate-800" : "bg-[#3CA317] border-transparent text-white shadow-[0_2px_8px_rgba(0,0,0,0.5)]"} z-20 w-full`}>
      <div className="flex items-center gap-2 md:gap-4 h-full">
        {/* Brand & Quick Stats */}
        <div className="flex items-center gap-2 shrink-0 pr-4 border-r border-white/10 h-10">
          <div className="flex flex-col">
            <h2 className="text-sm font-black text-white tracking-widest uppercase italic leading-none">DB Operadores</h2>
            <p className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter mt-1">{filteredOperators.length} REGISTROS</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 h-full">
          {/* Filters */}
        <div className="flex items-center gap-1.5">
          <select 
            className="bg-transparent hover:bg-white/10 border border-white/20 rounded text-[10px] text-white font-bold uppercase h-7 px-2 outline-none cursor-pointer transition-colors"
            value={filterShift}
            onChange={e => setFilterShift(e.target.value)}
          >
            <option value="TODOS" className="text-slate-900 bg-white">TURNO: TODOS</option>
            <option value="MANHÃ" className="text-slate-900 bg-white">MANHÃ</option>
            <option value="TARDE" className="text-slate-900 bg-white">TARDE</option>
            <option value="NOITE" className="text-slate-900 bg-white">NOITE</option>
          </select>
          
          <select 
            className="bg-transparent hover:bg-white/10 border border-white/20 rounded text-[10px] text-white font-bold uppercase h-7 px-2 outline-none cursor-pointer transition-colors"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="TODOS" className="text-slate-900 bg-white">CARGO: TODOS</option>
            <option value="JUNIOR" className="text-slate-900 bg-white">JÚNIOR</option>
            <option value="PLENO" className="text-slate-900 bg-white">PLENO</option>
            <option value="SENIOR" className="text-slate-900 bg-white">SÊNIOR</option>
            <option value="LT" className="text-slate-900 bg-white">LÍDER (LT)</option>
          </select>

          <select 
            className="bg-transparent hover:bg-white/10 border border-white/20 rounded text-[10px] text-white font-bold uppercase h-7 px-2 outline-none cursor-pointer transition-colors"
            value={filterPatio}
            onChange={e => setFilterPatio(e.target.value)}
          >
            <option value="TODOS" className="text-slate-900 bg-white">PÁTIO: TODOS</option>
            <option value="AERODROMO" className="text-slate-900 bg-white">AERÓDROMO</option>
            <option value="VIP" className="text-slate-900 bg-white">VIP</option>
          </select>

          <select 
            className="bg-transparent hover:bg-white/10 border border-white/20 rounded text-[10px] text-white font-bold uppercase h-7 px-2 outline-none cursor-pointer transition-colors"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="TODOS" className="text-slate-900 bg-white">STATUS: TODOS</option>
            <option value="ATIVOS" className="text-slate-900 bg-white">ATIVOS</option>
            <option value="FÉRIAS" className="text-slate-900 bg-white">FÉRIAS</option>
            <option value="AFASTADOS" className="text-slate-900 bg-white">AFASTADOS</option>
          </select>
        </div>

        {/* Search Engine - COMPACT */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
            <Search size={13} className={`${isDarkMode ? 'text-white/40 group-focus-within:text-white' : 'text-slate-400 group-focus-within:text-[#3CA317]'} transition-colors`} />
          </div>
          <input 
            type="text" 
            placeholder="PESQUISAR OPERADOR..." 
            className={`border rounded text-[10px] uppercase w-56 pl-8 pr-3 h-7 tracking-widest outline-none transition-colors font-bold ${isDarkMode 
              ? 'bg-transparent hover:bg-white/5 border-white/20 focus:border-white/40 text-white placeholder:text-white/40' 
              : 'bg-white border-transparent text-slate-800 placeholder:text-slate-500 focus:ring-2 focus:ring-[#3CA317]/50 focus:border-[#3CA317]'
            }`}
            value={searchTerm}
            onClick={() => { setFocusedCell(null); setEditingCell(null); setUnlockedRowId(null); }}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button 
            onClick={fetchOperators}
            className={`flex items-center justify-center w-7 h-7 rounded transition-all bg-transparent hover:bg-white/10 text-white border border-white/20 outline-none cursor-pointer`}
            title="Recarregar do banco"
        >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
        </button>

        <div className="relative" ref={optionsMenuRef}>
          <button 
            onClick={() => setShowOptionsDropdown(!showOptionsDropdown)}
            className={`flex items-center gap-2 px-4 py-2 rounded transition-all font-bold uppercase tracking-wider text-[11px] ${showOptionsDropdown ? 'bg-[#e5c600] shadow-inner' : 'bg-[#FEDC00] hover:bg-[#e5c600] shadow-sm'} text-slate-800 active:scale-95 border border-[#FEDC00] h-7`}
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
                    handleAddOperator();
                    setShowOptionsDropdown(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isDarkMode ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                  <Plus size={14} />
                  <span>Add. Operador</span>
                </button>

                <label className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${isDarkMode ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                  <Upload size={14} />
                  <span>Imp. em Lote</span>
                  <input 
                    type="file" 
                    accept=".xlsx, .xls" 
                    className="hidden" 
                    onChange={handleBatchImport} 
                  />
                </label>

                <button 
                  onClick={() => {
                    handleExportList();
                    setShowOptionsDropdown(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isDarkMode ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                  <Download size={14} />
                  <span>Exp. Lista</span>
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
        
        {/* Header */}
        {portalTarget ? createPortal(headerContent, portalTarget) : headerContent}

        {/* Spreadsheet Area */}
        <div className={`flex-1 min-w-0 overflow-auto custom-scrollbar ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
          <table ref={tableRef} className="w-full border-collapse select-none min-w-[1850px] table-fixed">
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
                const isUnlocked = unlockedRowId === op.id || op.id.startsWith('new-');
                const isRowActive = focusedCell?.rowId === op.id || isUnlocked;
                return (
                  <tr 
                    key={op.id}
                    data-row={rIdx}
                    className={`
                      group relative transition-all h-10 border-b ${isDarkMode ? 'border-slate-800/50' : 'border-slate-200'}
                      ${isRowActive 
                         ? (isDarkMode ? 'bg-emerald-900/40 border-y-emerald-500/50' : 'bg-emerald-50/80 border-y-emerald-400')
                         : (isDarkMode ? 'bg-slate-950 hover:bg-slate-800' : 'bg-white hover:bg-slate-50')}
                      ${isUnlocked ? 'shadow-[0_0_15px_rgba(16,185,129,0.15)] z-10' : ''}
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
                      const isSelectField = ['status', 'role', 'isLT', 'patio', 'shiftCycle'].includes(col.key);
                      
                      if (col.key === 'workDays') {
                        const todayStr = new Date().toISOString().split('T')[0];
                        const dayEntry = op.workDays?.find(wd => wd.date === todayStr);
                        const isWorkingToday = !dayEntry || !['FOLGA', 'AT', 'AF'].includes(dayEntry.type);
                        const hasScaleExceptions = op.workDays && op.workDays.length > 0;

                        return (
                          <td 
                            key={`${op.id}-workDays`}
                            className={`p-0 border-r border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} relative h-10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group`}
                            onClick={() => setSchedulingOperator(op)}
                          >
                            <div className="w-full h-full flex items-center justify-center gap-1.5">
                              <CalendarIcon 
                                size={14} 
                                className={hasScaleExceptions ? 'text-indigo-400' : 'text-slate-400 opacity-40'} 
                              />
                              <span className={`text-[10px] font-black font-mono transition-all ${
                                hasScaleExceptions 
                                  ? (isDarkMode ? 'text-indigo-300' : 'text-indigo-600')
                                  : 'text-slate-400 opacity-40'
                              }`}>
                                {op.workDays?.length || 0}
                              </span>
                              
                              {isWorkingToday && (
                                <div className="absolute right-0 top-0 w-2 h-2 bg-emerald-500" title="Trabalhando Hoje" />
                              )}
                              {!isWorkingToday && dayEntry && (
                                <div className="absolute right-0 top-0 w-2 h-2 bg-red-500" title={dayEntry.type} />
                              )}
                            </div>
                          </td>
                        );
                      }

                      if (col.key === 'actions') {
                        const isUnlocked = unlockedRowId === op.id;
                        return (
                          <td 
                            key={`${op.id}-actions`}
                            className={`p-0 relative h-10 text-center pointer-events-auto actions-container border-r border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} `}
                          >
                            <div className="flex items-center justify-center w-full h-full gap-1">
                              {op.id.startsWith('new-') ? (
                                <button 
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      handleSaveNewOperator(op);
                                  }}
                                  className={`p-1.5 rounded-md transition-all active:scale-95 ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'}`}
                                  title="Salvar Novo Operador"
                                >
                                  <Save size={14} />
                                </button>
                              ) : isUnlocked ? (
                                <>
                                  <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSaveExistingOperator(op);
                                    }}
                                    className={`p-1 rounded-md transition-all active:scale-95 ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'}`}
                                    title="Salvar"
                                  >
                                    <Save size={14} />
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancelEdit(op.id);
                                    }}
                                    className={`p-1 rounded-md transition-all active:scale-95 ${isDarkMode ? 'bg-slate-500/20 text-slate-400 hover:bg-slate-500/30' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                                    title="Cancelar (Esc)"
                                  >
                                    <X size={14} />
                                  </button>
                                </>
                              ) : (
                                <button 
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      setUnlockedRowId(op.id);
                                  }}
                                  className={`p-1.5 rounded-md transition-all hover:bg-blue-500/20 text-blue-500 active:scale-95`}
                                  title="Editar"
                                >
                                  <Edit2 size={14} />
                                </button>
                              )}
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

                      if (col.key === 'photoUrl') {
                        return (
                          <td 
                            key={`${op.id}-${col.key}`} 
                            data-col={cIdx}
                            onClick={() => handlePhotoClick(op.id)}
                            className={`p-0 border-r border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} relative h-10 w-12 text-center align-middle hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer`}
                          >
                            <div className="w-full h-full flex items-center justify-center relative">
                              {cellValue ? (
                                <div className={`group w-8 h-8 rounded-full border bg-slate-200 flex-shrink-0 overflow-hidden relative ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}>
                                  <img src={String(cellValue)} alt="Foto" referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-slate-900 bg-black/20">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                                  </div>
                                </div>
                              ) : (
                                <div className={`group w-8 h-8 rounded-full border border-dashed flex items-center justify-center text-[10px] flex-shrink-0 transition-all ${isDarkMode ? 'border-slate-600 bg-slate-800/50 hover:bg-slate-700' : 'border-slate-400 bg-slate-100/50 hover:bg-slate-200'}`}>
                                  <span className="opacity-40 group-hover:hidden">Sem</span>
                                  <svg className="hidden group-hover:block opacity-60" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td 
                          key={`${op.id}-${col.key}`} 
                          data-col={cIdx}
                          onClick={(e) => {
                            if (isCellFocused) {
                              startEditingCell(op.id, cIdx);
                            } else {
                              setFocusedCell({ rowId: op.id, col: cIdx });
                              setEditingCell(null);
                              // Garantir foco no div para capturar o handleKeyDown imediatamente (técnica Excel)
                              const target = e.currentTarget;
                              setTimeout(() => {
                                (target.querySelector('div[tabIndex="0"]') as HTMLElement)?.focus();
                              }, 0);
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
                                {col.key === 'role' && ['OP. JR.', 'OP. PL', 'OP. SR.'].map(v => <option key={v} value={v}>{v}</option>)}
                                {col.key === 'isLT' && ['SIM', 'NÃO'].map(v => <option key={v} value={v}>{v}</option>)}
                                {col.key === 'patio' && ['AERODROMO', 'VIP', 'AMBOS'].map(v => <option key={v} value={v}>{v}</option>)}
                                {col.key === 'shiftCycle' && ['MANHÃ', 'TARDE', 'NOITE', 'GERAL'].map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                            ) : (
                              <input 
                                type="text"
                                autoFocus
                                onFocus={(e) => {
                                  if (isKeystrokeEdit) {
                                    const val = e.target.value;
                                    e.target.value = '';
                                    e.target.value = val;
                                    setIsKeystrokeEdit(false);
                                  } else {
                                    e.target.select();
                                  }
                                }}
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
                                w-full h-full px-3 flex items-center gap-2 font-bold text-[11px] uppercase select-none cursor-default outline-none tracking-tight relative overflow-hidden min-w-0
                                ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}
                                ${col.key === 'fullName' ? 'justify-start text-left' : 'justify-center text-center'}
                                ${isMandatoryEmpty ? 'text-red-500 animate-pulse font-black text-xs' : ''}
                                ${col.key === 'status' && cellValue === 'ATIVO' ? 'text-emerald-500' : ''}
                                ${col.key === 'status' && (cellValue === 'FÉRIAS' || cellValue === 'AFAST.') ? 'text-amber-500' : ''}
                                ${col.key === 'status' && cellValue === 'FOLG.' ? 'text-indigo-500' : ''}
                              `}
                            >
                              <span className="block truncate w-full min-w-0">{isMandatoryEmpty ? '?' : (String(cellValue) || '-')}</span>
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

      {schedulingOperator && (
        <ScheduleModal 
          isDarkMode={isDarkMode}
          operator={schedulingOperator}
          onClose={() => setSchedulingOperator(null)}
          onSave={async (days) => {
            let currentId = schedulingOperator.id;
            console.log('Tentando salvar escala para:', schedulingOperator.warName, 'ID:', currentId);
            
            // Se o ID ainda for temporário "new-", buscar o ID real que o Supabase retornou no salvamento automático
            if (currentId.startsWith('new-')) {
              const latestOp = operators.find(o => o.warName === schedulingOperator.warName && !o.id.startsWith('new-'));
              if (latestOp) {
                currentId = latestOp.id;
                console.log('ID real encontrado:', currentId);
              } else {
                console.warn('ID real ainda não disponível para:', schedulingOperator.warName);
                alert('Aguarde: o perfil do operador está sendo criado. Tente novamente em 3 segundos.');
                return;
              }
            }

            try {
              console.log('Enviando dados para o Supabase (ID:', currentId + '):', days);
              await updateOperatorWorkDays(currentId, days);
              setOperators(prev => prev.map(o => o.id === currentId ? { ...o, workDays: days } : o));
              setSchedulingOperator(null);
            } catch (err: any) {
              console.error('Erro detalhado ao salvar escala:', err);
              // Verificar se o erro é de coluna faltante (day_type)
              if (err.message?.includes('column "day_type" does not exist')) {
                alert('ERRO CRÍTICO: Sua tabela "operator_work_days" no Supabase precisa da coluna "day_type". Por favor, execute o SQL de atualização no painel do Supabase.');
              }
              throw err;
            }
          }}
        />
      )}
    </div>
  );
};

interface ScheduleModalProps {
  isDarkMode: boolean;
  operator: OperatorProfile;
  onClose: () => void;
  onSave: (days: Array<{ date: string; type: string }>) => void;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({ isDarkMode, operator, onClose, onSave }) => {
  const [selectedDates, setSelectedDates] = useState<Array<{ date: string; type: string }>>(operator.workDays || []);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [contextMenu, setContextMenu] = useState<{ date: string; x: number; y: number } | null>(null);
  const [bulkAbsence, setBulkAbsence] = useState<{ start: string; end: string; type: 'AT' | 'AF' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const numDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);
  
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const requiredOffDays = numDays === 31 ? 9 : 8;
  
  // Um dia é FOLGA se estiver no array com tipo 'FOLGA', 'AT' ou 'AF'
  const currentOffDays = selectedDates.filter(d => 
    d.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`) && 
    ['FOLGA', 'AT', 'AF'].includes(d.type)
  ).length;
  
  const currentWorkDays = numDays - currentOffDays;
  const offDayDiff = currentOffDays - requiredOffDays;

  // Lógica de Ciclo (Dias Consecutivos de Trabalho REAL)
  const getConsecutiveWorkDays = (dateStr: string) => {
    const isWorking = (dStr: string) => {
      const entry = selectedDates.find(d => d.date === dStr);
      // Trabalho se não tem entrada ou se a entrada é de um tipo de dever especial (não folga/afastamento)
      return !entry || !['FOLGA', 'AT', 'AF'].includes(entry.type);
    };

    if (!isWorking(dateStr)) return 0;
    
    let count = 1;
    const date = new Date(dateStr);
    
    // Contar para trás
    let current = new Date(date);
    current.setDate(current.getDate() - 1);
    while (isWorking(current.toISOString().split('T')[0])) {
      count++;
      current.setDate(current.getDate() - 1);
      if (count > 31) break; // Safety
    }
    
    // Contar para frente
    current = new Date(date);
    current.setDate(current.getDate() + 1);
    while (isWorking(current.toISOString().split('T')[0])) {
      count++;
      current.setDate(current.getDate() + 1);
      if (count > 31) break; // Safety
    }
    
    return count;
  };

  const toggleDay = (dateStr: string) => {
    setSelectedDates(prev => {
      const existing = prev.find(d => d.date === dateStr);
      
      // Se já existe uma entrada (Folga ou Especial), e clicamos, resetamos para Trabalho (remove da lista)
      if (existing) {
        return prev.filter(d => d.date !== dateStr);
      }
      
      // Se não existe, estamos transformando Trabalho -> FOLGA (Verde)
      const currentMonthFolgas = prev.filter(d => 
        d.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`) && 
        d.type === 'FOLGA'
      ).length;

      if (currentMonthFolgas + 1 > requiredOffDays) {
        if (!window.confirm(`ALERTA DE SEGURANÇA: Este mês requer ${requiredOffDays} folgas. Você está tentando inserir a ${currentMonthFolgas + 1}ª folga. Deseja prosseguir com o excesso?`)) {
          return prev;
        }
      }

      return [...prev, { date: dateStr, type: 'FOLGA' }];
    });
  };

  const setDayType = (dateStr: string, type: string) => {
    if (type === 'TRABALHO') {
      setSelectedDates(prev => prev.filter(d => d.date !== dateStr));
    } else {
      // Validação rápida de limite se estiver setando FOLGA via menu
      if (type === 'FOLGA') {
        const currentMonthFolgas = selectedDates.filter(d => 
          d.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`) && 
          d.type === 'FOLGA'
        ).length;
        
        const existing = selectedDates.find(d => d.date === dateStr);
        if (!existing || existing.type !== 'FOLGA') {
          if (currentMonthFolgas + 1 > requiredOffDays) {
            if (!window.confirm(`ALERTA: Limite de ${requiredOffDays} folgas atingido. Confirmar ${currentMonthFolgas + 1}ª folga?`)) {
              setContextMenu(null);
              return;
            }
          }
        }
      }

      setSelectedDates(prev => {
        const existing = prev.find(d => d.date === dateStr);
        if (existing) {
          return prev.map(d => d.date === dateStr ? { ...d, type } : d);
        }
        return [...prev, { date: dateStr, type }];
      });
    }
    setContextMenu(null);
  };

  const applyBulkAbsence = () => {
    if (!bulkAbsence || !bulkAbsence.start || !bulkAbsence.end) return;
    
    const start = new Date(bulkAbsence.start);
    const end = new Date(bulkAbsence.end);
    const newDates = [...selectedDates];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const index = newDates.findIndex(ed => ed.date === dateStr);
      if (index !== -1) {
        newDates[index] = { date: dateStr, type: bulkAbsence.type };
      } else {
        newDates.push({ date: dateStr, type: bulkAbsence.type });
      }
    }
    
    setSelectedDates(newDates);
    setBulkAbsence(null);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className={`relative w-full max-w-sm max-h-[85vh] flex flex-col rounded shadow-2xl overflow-hidden border animate-in zoom-in-95 duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        
        {/* HEADER MODAL */}
        <div className={`p-2 shrink-0 border-b ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center overflow-hidden">
                {operator.photoUrl ? <img src={operator.photoUrl} className="w-full h-full object-cover" /> : <User size={14} className="text-emerald-500" />}
              </div>
              <div>
                <h3 className={`text-[10px] font-black uppercase tracking-widest leading-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{operator.warName}</h3>
                <div className="flex items-center gap-1.5">
                  <span className="text-[7px] font-black bg-blue-500/10 text-blue-500 px-1 py-0 rounded border border-blue-500/20 uppercase">{operator.shift?.cycle}</span>
                  <span className="text-[7px] font-bold text-slate-400 font-mono italic">{operator.shift?.start}-{operator.shift?.end}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className={`p-1 hover:bg-slate-500/10 rounded-full transition-colors ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* CONTENÚDO SCROLLABLE */}
        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          <div className="flex items-center justify-between mb-2">
            <h4 className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {monthNames[month]} {year}
            </h4>
            <div className="flex gap-1">
              <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className={`p-0.5 rounded bg-slate-500/5 hover:bg-slate-500/10 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                <ChevronLeft size={12} />
              </button>
              <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className={`p-0.5 rounded bg-slate-500/5 hover:bg-slate-500/10 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
              <div key={`${d}-${i}`} className="text-[9px] font-black text-slate-400 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 relative">
            {Array.from({ length: startDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: numDays }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const entry = selectedDates.find(d => d.date === dateStr);
              const isToday = new Date().toISOString().split('T')[0] === dateStr;
              
              // Um dia é de trabalho por padrão se não houver entrada de folga ou ausência
              const isWorking = !entry || !['FOLGA', 'AT', 'AF'].includes(entry.type);
              const consecutiveCount = isWorking ? getConsecutiveWorkDays(dateStr) : 0;
              const isSixthDay = consecutiveCount === 6;
              const isCritical = consecutiveCount > 6;

              return (
                <button
                  key={day}
                  onClick={() => toggleDay(dateStr)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setContextMenu({ date: dateStr, x: rect.left, y: rect.bottom });
                  }}
                  className={`
                    h-9 rounded-sm text-[10px] font-black transition-all flex flex-col items-center justify-center relative border
                    ${entry 
                      ? (entry.type === 'FOLGA' ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm' : 
                         ['AT', 'AF'].includes(entry.type) ? 'bg-red-500 text-white border-red-600' : 
                         'bg-blue-500 text-white border-blue-600') 
                      : (isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700/50' : 'bg-slate-100 text-slate-500 border-slate-200')
                    }
                    ${isToday ? 'ring-2 ring-amber-500/50 z-10 scale-105' : ''}
                    ${isWorking && isSixthDay ? 'bg-amber-400 text-amber-950 border-amber-500' : ''}
                    ${isWorking && isCritical ? 'ring-2 ring-red-500 ring-inset' : ''}
                  `}
                >
                  <span className="leading-none">{day}</span>
                  {entry && entry.type !== 'FOLGA' && (
                    <span className="text-[6px] opacity-90 leading-none mt-1 uppercase font-black truncate w-full px-0.5">
                      {entry.type === 'EXAME' ? 'EX.PER' : entry.type === 'B_HORAS' ? 'B.HORAS' : entry.type}
                    </span>
                  )}
                  {isWorking && isSixthDay && (
                    <div className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-amber-950/40" />
                  )}
                </button>
              );
            })}
          </div>

          {/* INDICADORES DE REGRAS */}
          <div className="mt-3 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div className={`p-2 rounded-md border flex flex-col justify-center ${isDarkMode ? 'bg-slate-850 border-slate-700' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
                <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Status da Escala</span>
                <div className="flex items-baseline gap-1">
                  <span className={`text-lg font-black font-mono leading-none ${offDayDiff !== 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {currentWorkDays}T / {currentOffDays}F
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[7px] font-bold text-slate-400 uppercase tracking-tighter">
                  <span>Alvo: {numDays - requiredOffDays}T / {requiredOffDays}F</span>
                  {offDayDiff !== 0 && <span className="text-amber-600 font-black">!</span>}
                </div>
              </div>
              <div className={`p-2 rounded-md border flex flex-col justify-center ${isDarkMode ? 'bg-slate-850 border-slate-700' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
                <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Ausências</span>
                <div className="flex gap-1">
                  <button 
                    onClick={() => setBulkAbsence({ start: '', end: '', type: 'AT' })}
                    className="flex-1 py-1 bg-red-500 hover:bg-red-600 active:scale-95 text-white text-[8px] font-black rounded transition-all shadow-sm"
                  >
                    ATEST.
                  </button>
                  <button 
                    onClick={() => setBulkAbsence({ start: '', end: '', type: 'AF' })}
                    className="flex-1 py-1 bg-red-700 hover:bg-red-800 active:scale-95 text-white text-[8px] font-black rounded transition-all shadow-sm"
                  >
                    AFAST.
                  </button>
                </div>
              </div>
            </div>

            {bulkAbsence && (
              <div className={`p-3 rounded-sm border animate-in slide-in-from-top-2 ${isDarkMode ? 'bg-slate-800 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black text-red-500 uppercase">Lançamento em Massa: {bulkAbsence.type === 'AT' ? 'Atestado' : 'Afastamento'}</span>
                  <button onClick={() => setBulkAbsence(null)}><X size={12} className="text-red-400" /></button>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase">Início</label>
                    <input 
                      type="date" 
                      value={bulkAbsence.start}
                      onChange={(e) => setBulkAbsence({ ...bulkAbsence, start: e.target.value })}
                      className={`w-full text-[10px] p-1 border rounded-sm outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase">Término</label>
                    <input 
                      type="date" 
                      value={bulkAbsence.end}
                      onChange={(e) => setBulkAbsence({ ...bulkAbsence, end: e.target.value })}
                      className={`w-full text-[10px] p-1 border rounded-sm outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                    />
                  </div>
                </div>
                <button 
                  onClick={applyBulkAbsence}
                  className="w-full py-1.5 bg-red-500 hover:bg-red-600 text-white text-[9px] font-black uppercase rounded-sm transition-all"
                >
                  Aplicar Período
                </button>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className={`p-4 border-t flex gap-2 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <button 
            onClick={onClose} 
            disabled={isSaving}
            className={`flex-1 px-4 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'} disabled:opacity-50`}
          >
            Cancelar
          </button>
          <button 
            disabled={isSaving}
            onClick={async () => {
              if (offDayDiff !== 0) {
                const confirmMsg = offDayDiff > 0 
                  ? `AVISO DE ESCALA: O operador possui FOLGAS EXCEDENTES (${currentOffDays} de ${requiredOffDays} necessárias). Confirmar mesmo assim?`
                  : `AVISO DE ESCALA: Saldo de folgas INSUFICIENTE (${currentOffDays} de ${requiredOffDays} necessárias). Confirmar escala incompleta?`;
                
                if (!window.confirm(confirmMsg)) return;
              }
              
              setIsSaving(true);
              setSaveError(null);
              try {
                await onSave(selectedDates);
              } catch (e: any) {
                console.error('Falha no salvamento:', e);
                const errorStr = e?.message || e?.details || String(e);
                if (errorStr.includes('check_day_type')) {
                  setSaveError('ERRO DO SUPABASE: O banco bloqueou "FOLGA". Copie e rode no SQL Editor do Supabase: ALTER TABLE public.operator_work_days DROP CONSTRAINT check_day_type;');
                } else {
                  setSaveError(errorStr);
                }
              } finally {
                setIsSaving(false);
              }
            }} 
            className="flex-1 px-4 py-2 rounded-sm bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <span>Confirmar</span>
            )}
          </button>
        </div>

        {saveError && (
          <div className="absolute top-0 inset-x-0 p-4 bg-red-500/95 backdrop-blur text-white text-[11px] font-bold text-center z-[200] shadow-2xl flex flex-col gap-2 items-center justify-center">
            <span className="select-all block max-w-sm">{saveError}</span>
            <button onClick={() => setSaveError(null)} className="px-4 py-1 bg-white text-red-600 rounded-sm font-black mt-1 hover:bg-red-50">ENTENDI E VOU CORRIGIR NO SUPABASE</button>
          </div>
        )}

        {/* CONTEXT MENU */}
        {contextMenu && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
            <div 
              className={`fixed z-[9999] w-36 py-1 rounded shadow-xl border animate-in fade-in zoom-in-95 duration-100 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              {[
                { id: 'TRABALHO', label: 'TRABALHO (Normal)', color: 'text-slate-400' },
                { id: 'FOLGA', label: 'FOLGA (Prioridade)', color: 'text-emerald-500' },
                { id: 'BRIGADA', label: 'Brigada', color: 'text-blue-500' },
                { id: 'CIPA', label: 'CIPA', color: 'text-blue-500' },
                { id: 'EXAME', label: 'EX. PER.', color: 'text-blue-500' },
                { id: 'B_HORAS', label: 'B. Horas', color: 'text-blue-500' },
                { id: 'CT', label: 'CT (Treinam.)', color: 'text-blue-500' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setDayType(contextMenu.date, opt.id as any)}
                  className={`w-full text-left px-3 py-1.5 text-[9px] font-black uppercase hover:bg-black/5 dark:hover:bg-white/5 ${opt.color}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

