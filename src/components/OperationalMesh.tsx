import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Plane, Send, Search, Edit2, Trash2, Play, ClipboardList, Plus, Ban, AlertCircle, MoreVertical, Settings, ChevronDown, RefreshCw, Upload, ChevronLeft, ChevronRight, Calendar, Database, History } from 'lucide-react';
import { MeshFlight, INITIAL_MESH_FLIGHTS } from '../data/operationalMesh';
import { FlightData, FlightStatus, AircraftType } from '../types';
import { getCurrentShift, getLocalDateStr } from '../utils/shiftUtils';
import * as XLSX from 'xlsx';
import { ConfirmActionModal } from './modals/ConfirmActionModal';
import { AlertModal } from './modals/AlertModal';
import { TimeConflictModal } from './TimeConflictModal';
import { BulkNextDayModal } from './BulkNextDayModal';
import { InlineCalendar } from './ui/InlineCalendar';
import { supabase } from '../lib/supabase';

const getMinutesDiff = (targetTimeStr: string, flightDateStr?: string) => {
    if (!targetTimeStr) return 0;
    
    const [hours, minutes] = targetTimeStr.split(':').map(Number);
    const target = new Date();
    
    if (flightDateStr) {
        const [year, month, day] = flightDateStr.split('-').map(Number);
        target.setFullYear(year, month - 1, day);
    }
    
    target.setHours(hours, minutes, 0, 0);
    const current = new Date();
    
    let diff = Math.round((target.getTime() - current.getTime()) / 60000);
    
    return diff;
};

interface OperationalMeshProps {
  onClose: () => void;
  onActivateMesh: (flights: FlightData[]) => void;
  isDarkMode: boolean;
  meshFlights: MeshFlight[];
  setMeshFlights: React.Dispatch<React.SetStateAction<MeshFlight[]>>;
  currentMeshDate: string;
  setCurrentMeshDate: (date: string) => void;
  setFlights?: React.Dispatch<React.SetStateAction<FlightData[]>>;
  globalFlights: FlightData[];
}

const formatMeshDateDisplay = (dateString: string) => {
  if (!dateString) return '';
  const dateObj = new Date(dateString + 'T00:00:00'); // Prevent timezone issues
  if (isNaN(dateObj.getTime())) return dateString;

  const today = new Date();
  
  // Calculate difference in days safely
  const todayStr = getLocalDateStr(today);
  const dateStr = getLocalDateStr(dateObj);
  
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const formattedDate = `${day}/${month}`;

  if (dateStr === todayStr) {
    return `HOJE`;
  } 
  
  // check for yesterday/tomorrow
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === getLocalDateStr(yesterday)) {
      return `ONTEM`;
  }
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === getLocalDateStr(tomorrow)) {
      return `AMANHÃ`;
  }

  return formattedDate;
};

type MeshField = keyof MeshFlight | 'actions';
type MeshShift = 'TODOS' | 'MANHA' | 'TARDE' | 'NOITE';

const isTimeInShift = (timeStr: string, shift: MeshShift) => {
  if (shift === 'TODOS' || !timeStr) return true;
  
  // Format should be HH:MM
  const parts = timeStr.split(':');
  if (parts.length < 2) return true;
  
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const totalMinutes = h * 60 + m;

  if (shift === 'MANHA') {
    // 05:00 to 15:00
    return totalMinutes >= 300 && totalMinutes < 900;
  }
  if (shift === 'TARDE') {
    // 14:00 to 00:00 (1440 mins)
    return totalMinutes >= 840 && totalMinutes <= 1440;
  }
  if (shift === 'NOITE') {
    // 21:00 to 06:00
    // Range 1 (21:00 to 23:59): 1260 to 1440
    // Range 2 (00:00 to 06:00): 0 to 360
    return (totalMinutes >= 1260 && totalMinutes <= 1440) || (totalMinutes >= 0 && totalMinutes < 360);
  }
  return true;
};

const formatImportTime = (rawVal: string) => {
  if (!rawVal || String(rawVal).trim() === '') return '?';
  const val = String(rawVal).trim().toUpperCase();
  
  if (val === 'PRÉ' || val === 'PRE') return 'PRÉ';

  // Check if it's an excel time or date-time (number format)
  const num = Number(val);
  if (!isNaN(num) && val !== '' && val !== '0') {
    // Extract the fractional part for the time
    const fraction = num - Math.floor(num);
    const totalMinutes = Math.round(fraction * 24 * 60);
    const hh = Math.floor(totalMinutes / 60);
    const mm = totalMinutes % 60;
    
    if (val.includes('.') || num === 0 || num > 30000) {
      if (fraction === 0 && num > 30000 && !val.includes('.')) {
          return '?';
      }
      return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
    }
  }

  const digits = val.replace(/[^0-9]/g, '');
  if (digits.length >= 4) {
    const hh = parseInt(digits.slice(0, 2), 10);
    const mm = parseInt(digits.slice(2, 4), 10);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
    }
  } else if (val.includes(':')) {
     const [h, m] = val.split(':');
     if (!isNaN(Number(h)) && !isNaN(Number(m))) {
       const hh = Number(h);
       const mm = Number(m);
       if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
           return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
       }
     }
  }
  return '?';
};

const COLUMNS: { key: MeshField; label: string; width: string; isVariable: boolean }[] = [
  { key: 'airline', label: 'Cia', width: 'w-24', isVariable: false },
  { key: 'flightNumber', label: 'V.Cheg', width: 'w-24', isVariable: true },
  { key: 'departureFlightNumber', label: 'V.Saída', width: 'w-24', isVariable: false },
  { key: 'destination', label: 'Destino', width: 'w-24', isVariable: false },
  { key: 'etd', label: 'ETD', width: 'w-20', isVariable: true },
  { key: 'registration', label: 'Prefixo', width: 'w-28', isVariable: true },
  { key: 'model', label: 'Modelo', width: 'w-24', isVariable: false },
  { key: 'eta', label: 'ETA', width: 'w-24', isVariable: true },
  { key: 'positionId', label: 'Posição', width: 'w-20', isVariable: true },
  { key: 'actualArrivalTime', label: 'Calço', width: 'w-24', isVariable: true },
  { key: 'actions', label: 'Ações', width: 'w-14', isVariable: false },
];

export const OperationalMesh: React.FC<OperationalMeshProps> = ({ onClose, onActivateMesh, isDarkMode, meshFlights, setMeshFlights, currentMeshDate, setCurrentMeshDate, setFlights, globalFlights }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeShift, setActiveShift] = useState<MeshShift>(getCurrentShift(false) as MeshShift);
  const [readyStateFilter, setReadyStateFilter] = useState<'ALL' | 'READY' | 'ERROR'>('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: MeshField; direction: 'asc' | 'desc' }>({ key: 'etd', direction: 'asc' });
  const [focusedCell, setFocusedCell] = useState<{ rowId: string; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [flightActionMenu, setFlightActionMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number, left: number } | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  const [showClearMeshModal, setShowClearMeshModal] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const lastStableFlightsRef = useRef<MeshFlight[]>([]);
  const lastFiltersRef = useRef({ readyStateFilter, activeShift, searchTerm });
  const [aircraftsDB, setAircraftsDB] = useState<AircraftType[]>([]);

  useEffect(() => {
    supabase.from('aircrafts').select('*').then(res => {
      if (res.data) setAircraftsDB(res.data as AircraftType[]);
    });
  }, []);

  useEffect(() => {
    if (readyStateFilter !== lastFiltersRef.current.readyStateFilter || 
        activeShift !== lastFiltersRef.current.activeShift || 
        searchTerm !== lastFiltersRef.current.searchTerm) {
      // Se mudar o filtro explicito via botão ou busca, resetamos a edição e a estabilidade
      setEditingCell(null);
      lastFiltersRef.current = { readyStateFilter, activeShift, searchTerm };
    }
  }, [readyStateFilter, activeShift, searchTerm]);

  const [alertState, setAlertState] = useState<{isOpen: boolean; title: string; message: React.ReactNode}>({isOpen: false, title: '', message: ''});
  const [syncConfirmState, setSyncConfirmState] = useState<{isOpen: boolean; message: string; unsynced: MeshFlight[]}>({isOpen: false, message: '', unsynced: []});

  const [timeConflictData, setTimeConflictData] = useState<{rowId: string, oldEtd: string, newEtd: string}|null>(null);
  const [bulkConflictData, setBulkConflictData] = useState<{fileName: string; nonDuplicates: MeshFlight[]; ignoredCount: number; crossedFlightsIds: string[]}|null>(null);
  const confirmedConflictsRef = useRef<Set<string>>(new Set());
  const [editingCellOriginalValue, setEditingCellOriginalValue] = useState<string>('');
  const [showCalendar, setShowCalendar] = useState(false);

  const handlePrevDay = () => {
    const d = new Date(currentMeshDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setCurrentMeshDate(getLocalDateStr(d));
  };

  const handleNextDay = () => {
    const d = new Date(currentMeshDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    setCurrentMeshDate(getLocalDateStr(d));
  };

  const handleFinishEdit = (rowId: string, colIndex: number) => {
    setEditingCell(null);
    const colKey = COLUMNS[colIndex]?.key;
    if (colKey === 'etd') {
      const flight = meshFlights.find(f => f.id === rowId);
      if (flight && flight.etd && flight.etd.length >= 4) {
        const [h] = flight.etd.split(':').map(Number);
        const currentH = new Date().getHours();
        // Verificação se o horário digitado cruza a meia-noite (próximo dia)
        const isNextDayCross = (currentH >= 12 && h < currentH - 12);

        if (isNextDayCross) {
          const conflictKey = `${rowId}-${flight.etd}`;
          if (!confirmedConflictsRef.current.has(conflictKey)) {
            setTimeConflictData({ rowId, oldEtd: editingCellOriginalValue, newEtd: flight.etd });
          }
        }
      }
    }
  };

  const startEditingCell = (rowId: string, colIndex: number) => {
      const flight = meshFlights.find(f => f.id === rowId);
      if (flight) {
          setEditingCellOriginalValue(flight[COLUMNS[colIndex].key as keyof MeshFlight] as string || '');
      }
      setEditingCell({ rowId, col: colIndex });
  };

  const handleFieldChange = (id: string, field: MeshField, value: string) => {
    if (field === 'actions') return;

    let newValue: any = value.toUpperCase();
    if (field === 'etd' || field === 'eta' || field === 'actualArrivalTime') {
      newValue = value.replace(/[^0-9PPRRÉÉ]/g, ''); // Allow PRÉ
      if (newValue === 'PRE' || newValue === 'PRÉ') {
        newValue = 'PRÉ';
      } else {
        const digits = newValue.replace(/[^0-9]/g, '');
        if (digits.length > 2) {
          newValue = `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
        } else {
          newValue = digits;
        }
        if (newValue.length > 5) newValue = newValue.slice(0, 5);
      }
    }
    
    // Auto-fill Magic for Registration
    let autoModel: string | undefined = undefined;
    let autoAirlineCode: string | undefined = undefined;

    if (field === 'registration') {
        const cleanInput = newValue.replace(/[^A-Z0-9]/g, '');
        let attemptMatch: AircraftType | undefined;
        
        if (cleanInput.length >= 3) {
            // Try matching suffix first (e.g. user types "MZY" matches "PT-MZY")
            attemptMatch = aircraftsDB.find(a => {
                const cleanPrefix = a.prefix.replace(/[^A-Z0-9]/g, '').toUpperCase();
                return cleanPrefix === cleanInput || cleanPrefix.endsWith(cleanInput);
            });
        }
        
        if (!attemptMatch) {
            attemptMatch = aircraftsDB.find(a => a.prefix.toUpperCase() === newValue);
        }

        if (attemptMatch) {
            newValue = attemptMatch.prefix;
            if (attemptMatch.model && attemptMatch.model !== '--') {
                autoModel = attemptMatch.model;
            } else {
                autoModel = '';
            }
            
            const airlineUpper = attemptMatch.airline.toUpperCase();
            if (airlineUpper.includes('GOL')) autoAirlineCode = 'RG';
            else if (airlineUpper.includes('LATAM')) autoAirlineCode = 'LA';
            else if (airlineUpper.includes('AZUL')) autoAirlineCode = 'AD';
            else if (attemptMatch.airline) autoAirlineCode = attemptMatch.airline.slice(0, 3).toUpperCase();
        } else if (cleanInput.length >= 3) {
            autoModel = '';
        }
    }
    
    setMeshFlights(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(f => f.id === id);
        if (idx !== -1) {
            updated[idx] = { ...updated[idx], [field]: newValue };
            if (autoModel !== undefined) {
                updated[idx].model = autoModel;
            }
            if (autoAirlineCode && (!updated[idx].airlineCode || updated[idx].airlineCode === 'OUTRA' || updated[idx].airlineCode === '--')) {
                 updated[idx].airlineCode = autoAirlineCode;
                 if (autoAirlineCode === 'RG') updated[idx].airline = 'GOL';
                 else if (autoAirlineCode === 'LA') updated[idx].airline = 'LATAM';
                 else if (autoAirlineCode === 'AD') updated[idx].airline = 'AZUL';
                 else updated[idx].airline = autoAirlineCode;
            }
        }
        return updated;
    });

    if (setFlights) {
      setFlights(prevFlights => prevFlights.map(f => {
        const flightIdBase = f.id.replace(/^mesh-\d+-/, '');
        const isIdMatch = f.id === id || flightIdBase === id;
        
        // Se o ID não bater, tentamos pelo número do voo (Saída ou Chegada)
        const currentMeshFlight = meshFlights.find(m => m.id === id);
        const isNumberMatch = currentMeshFlight && (
          (f.departureFlightNumber && currentMeshFlight.departureFlightNumber && f.departureFlightNumber === currentMeshFlight.departureFlightNumber) ||
          (f.flightNumber && currentMeshFlight.departureFlightNumber && f.flightNumber === currentMeshFlight.departureFlightNumber)
        );

        if (isIdMatch || isNumberMatch) {
            const result = { ...f, [field]: newValue };
            if (autoModel !== undefined) result.model = autoModel;
            if (autoAirlineCode && (!result.airlineCode || result.airlineCode === 'OUTRA' || result.airlineCode === '--')) {
               result.airlineCode = autoAirlineCode;
               if (autoAirlineCode === 'RG') result.airline = 'GOL';
               else if (autoAirlineCode === 'LA') result.airline = 'LATAM';
               else if (autoAirlineCode === 'AD') result.airline = 'AZUL';
               else result.airline = autoAirlineCode;
            }
            return result;
        }
        return f;
      }));
    }
  };

  const handleAddFlight = () => {
    const newFlight: MeshFlight = {
      id: `new-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      airline: '',
      airlineCode: '',
      departureFlightNumber: '',
      destination: '',
      etd: '',
      registration: '',
      eta: '',
      positionId: '',
      actualArrivalTime: '',
      model: '',
      isNew: true
    };
    setMeshFlights(prev => [newFlight, ...prev]);
    setFocusedCell({ rowId: newFlight.id, col: 0 });
  };

  const handleDeleteFlight = (id: string) => {
    setMeshFlights(prev => prev.filter(f => f.id !== id));
    setFocusedCell(null);
    setFlightActionMenu(null);
  };

  const handleRemoveDuplicates = () => {
    const seen = new Set<string>();
    const uniqueFlights: MeshFlight[] = [];
    let removedCount = 0;

    meshFlights.forEach(f => {
      // Chave de unicidade completa: CIA + VOO + DESTINO + ETD + ETA
      const key = [
        f.airline.trim().toUpperCase(),
        f.departureFlightNumber.trim().toUpperCase(),
        f.destination.trim().toUpperCase(),
        f.etd.trim().toUpperCase(),
        f.eta.trim().toUpperCase()
      ].join('|');
      
      // Se não tiver pelo menos o número do voo ou etd, ignoramos do processo de limpeza automática para não apagar placeholders
      if (!f.departureFlightNumber || !f.etd) {
        uniqueFlights.push(f);
      } else if (!seen.has(key)) {
        seen.add(key);
        uniqueFlights.push(f);
      } else {
        removedCount++;
      }
    });

    if (removedCount > 0) {
      setMeshFlights(uniqueFlights);
      setAlertState({
        isOpen: true,
        title: 'Limpeza Concluída',
        message: (
          <div className="flex flex-col items-center py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
              <RefreshCw size={24} className="text-emerald-500 animate-spin-slow" />
            </div>
            <span className="text-emerald-500 font-black text-xl">{removedCount}</span>
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Voos duplicados removidos</span>
          </div>
        )
      });
    } else {
      setAlertState({
        isOpen: true,
        title: 'Nenhuma Duplicata',
        message: 'Não foram encontrados voos duplicados (mesmo número) na lista atual.'
      });
    }
    setShowOptionsDropdown(false);
  };

  const handleToggleDisable = (id: string) => {
    setMeshFlights(prev => prev.map(f => 
      f.id === id ? { ...f, disabled: !f.disabled } : f
    ));
    setFlightActionMenu(null);
  };

  const isFlightSynced = (mesh: MeshFlight) => {
    return globalFlights.some(f => {
        // Ignorar voos que já foram finalizados, cancelados ou arquivados (histórico)
        // Isso permite que o mesmo voo seja importado novamente no dia seguinte
        const isFinishedOrArchived = f.status === 'FINALIZADO' || f.status === 'CANCELADO' || f.isHiddenFromGrid;
        if (isFinishedOrArchived) return false;

        const fIdBase = f.id.replace(/^mesh-\d+-/, ''); // Extract original mesh.id from f.id
        const isIdMatch = f.id === mesh.id || fIdBase === mesh.id;
        if (isIdMatch) return true;
        
        // Checking by properties
        const depMatch = f.departureFlightNumber && mesh.departureFlightNumber && 
            f.departureFlightNumber.toUpperCase() === mesh.departureFlightNumber.toUpperCase();
        const destMatch = f.destination && mesh.destination && 
            f.destination.toUpperCase() === mesh.destination.toUpperCase();
        const etdMatch = f.etd === mesh.etd;
        
        return depMatch && destMatch && etdMatch;
    });
  };

  const getFlightErrors = (flight: MeshFlight) => {
    const isDuplicated = meshFlights.some(f => 
       f.id !== flight.id && 
       f.airline.trim().toUpperCase() === flight.airline.trim().toUpperCase() &&
       f.departureFlightNumber.trim().toUpperCase() === flight.departureFlightNumber.trim().toUpperCase() &&
       f.destination.trim().toUpperCase() === flight.destination.trim().toUpperCase() &&
       f.etd.trim().toUpperCase() === flight.etd.trim().toUpperCase() &&
       f.eta.trim().toUpperCase() === flight.eta.trim().toUpperCase() &&
       f.departureFlightNumber !== '' &&
       f.etd !== '' &&
       f.etd !== '?'
    );
    
    const isPre = flight.etd === 'PRÉ';
    const checkField = (val: any) => !val || String(val).trim() === '' || String(val).trim() === '?';
    
    // Um voo é considerado "Chegada" se possuir V.Cheg, ETA ou Calço
    const isArrivalFlight = !checkField(flight.flightNumber) || !checkField(flight.eta) || !checkField(flight.actualArrivalTime);

    // Campos obrigatórios definidos pelo usuário: Cia, Prefixo, V.Saída, Destino e ETD
    const isIncomplete = checkField(flight.airline) || 
                         checkField(flight.registration) ||
                         checkField(flight.departureFlightNumber) || 
                         checkField(flight.destination) || 
                         checkField(flight.etd) || 
                         (isArrivalFlight && checkField(flight.eta)); // V.Cheg is no longer strictly mandatory, just ETA for arrivals
    
    const hasFormatError = (flight.etd === '?' || (isArrivalFlight && flight.eta === '?') || flight.actualArrivalTime === '?') && !isPre;
    const isUltrapassado = !checkField(flight.etd) && !isPre && getMinutesDiff(flight.etd, flight.date || currentMeshDate) < 0;
    
    return { 
      isDuplicated, 
      hasFormatError, 
      isIncomplete,
      isUltrapassado,
      isValid: !isDuplicated && !isIncomplete && !flight.disabled
    };
  };

  const handleActivate = () => {
    const activeFlights = meshFlights.filter(f => !f.disabled);
    const unsyncedFlights = activeFlights.filter(f => !isFlightSynced(f));

    if (unsyncedFlights.length === 0) {
        setAlertState({isOpen: true, title: 'Malha Sincronizada', message: 'A malha geral já está sincronizada. Todos os voos ativos da malha base já estão presentes na malha geral.'});
        return;
    }

    const readyToSync = unsyncedFlights.filter(f => getFlightErrors(f).isValid).sort((a, b) => {
        const aMin = getMinutesDiff(a.etd, a.date || currentMeshDate);
        const bMin = getMinutesDiff(b.etd, b.date || currentMeshDate);
        return aMin - bMin;
    });
    const inconsistent = unsyncedFlights.filter(f => !getFlightErrors(f).isValid);

    if (readyToSync.length === 0) {
        let advice = "Corrija as duplicatas e campos obrigatórios (marcados em vermelho/laranja) para prosseguir.";
        const firstUnsynced = unsyncedFlights[0];
        if (firstUnsynced) {
            const errs = getFlightErrors(firstUnsynced);
            if (errs.isIncomplete) {
                advice = `Exemplo: O voo ${firstUnsynced.departureFlightNumber} está incompleto ou sem prefixo.`;
            } else if (errs.isDuplicated) {
                advice = `Exemplo: O voo ${firstUnsynced.departureFlightNumber} está duplicado.`;
            }
        }

        setAlertState({
            isOpen: true, 
            title: 'Nenhum Voo Pronto', 
            message: `Não há voos prontos para sincronização. ${advice}`
        });
        return;
    }

    if (inconsistent.length > 0) {
        setSyncConfirmState({
            isOpen: true, 
            message: `Identificamos ${readyToSync.length} voos prontos e ${inconsistent.length} voos inconsistentes. Deseja enviar apenas os voos prontos? Os inconsistentes ficarão pendentes na Malha Base.`, 
            unsynced: readyToSync
        });
        return;
    }

    executeSync(readyToSync);
  };

  const executeSync = (flightsToSync: MeshFlight[]) => {
    const newFlights: FlightData[] = flightsToSync.map(mesh => {
      const isPre = mesh.etd === 'PRÉ';
      let derivedCode = mesh.airlineCode || mesh.airline.substring(0, 3) || 'G3';
      if (mesh.airline.toUpperCase().includes('GOL') && !mesh.airlineCode) {
          derivedCode = 'RG';
      }
      
      return {
        id: `mesh-${Date.now()}-${mesh.id}`,
        airline: mesh.airline,
        airlineCode: derivedCode,
        registration: mesh.registration.toUpperCase(),
        model: mesh.model.toUpperCase(),
        flightNumber: '', 
        eta: mesh.eta,
        departureFlightNumber: mesh.departureFlightNumber.toUpperCase(),
        destination: mesh.destination.toUpperCase(),
        positionId: mesh.positionId,
        etd: mesh.etd,
        date: mesh.date || currentMeshDate,
        origin: 'SBGL', 
        fuelStatus: 0,
        status: isPre ? FlightStatus.PRÉ : FlightStatus.CHEGADA,
        logs: [{
          id: Date.now().toString(),
          timestamp: new Date(),
          type: 'SISTEMA',
          message: isPre ? 'Voo de manutenção (PRÉ) carregado da malha operacional.' : 'Voo carregado da malha operacional.',
          author: 'SISTEMA'
        }],
        messages: [],
        actualArrivalTime: mesh.actualArrivalTime || ''
      };
    });

    onActivateMesh(newFlights);
    
    // Total de voos filtrados pelo shift ativo (total visível)
    const pendingCount = meshFlights.length - newFlights.length;

    setAlertState({
        isOpen: true, 
        title: 'Sincronização concluída!', 
        message: (
            <div className="space-y-3 py-2">
                <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                   <span className="text-emerald-500 font-bold uppercase text-[10px] tracking-widest">Enviado(s) com sucesso</span>
                   <span className="text-emerald-500 font-black text-sm">{newFlights.length}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <span className="text-amber-500 font-bold uppercase text-[10px] tracking-widest">Pendente(s) na Malha</span>
                    <span className="text-amber-500 font-black text-sm">{pendingCount}</span>
                </div>
            </div>
        )
    });

  };

  // 1. Filtragem Base para Contadores (AO VIVO)
  const baseFiltered = useMemo(() => {
    return meshFlights.filter(f => {
      const matchesSearch = f.departureFlightNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.airline.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.airlineCode.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesShift = isTimeInShift(f.etd, activeShift);

      return matchesSearch && matchesShift;
    });
  }, [meshFlights, searchTerm, activeShift]);

  const readyCount = useMemo(() => baseFiltered.filter(f => getFlightErrors(f).isValid).length, [baseFiltered]);
  const pendingCount = useMemo(() => baseFiltered.filter(f => !getFlightErrors(f).isValid).length, [baseFiltered]);
  const totalCount = baseFiltered.length;

  // 2. Lista Filtrada/Ordenada Estável para a Tabela
  const filteredFlights = useMemo(() => {
    // Calculamos o que seria a lista "fresca" com base nos filtros e ordenação
    const freshList = baseFiltered.filter(f => {
      const errors = getFlightErrors(f);
      const matchesReadyState = 
        readyStateFilter === 'ALL' ? true :
        readyStateFilter === 'READY' ? errors.isValid :
        !errors.isValid;
      
      return matchesReadyState;
    }).sort((a, b) => {
      const isAsc = sortConfig.direction === 'asc';
      const key = sortConfig.key === 'actions' ? 'etd' : sortConfig.key;
      const valA = String(a[key] || '');
      const valB = String(b[key] || '');
      
      if (valA === valB) return 0;
      const comparison = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      return isAsc ? comparison : -comparison;
    });

    // Se NÃO estivermos editando uma célula ou se a malha foi limpa, a freshList é soberana 
    if (!editingCell || meshFlights.length === 0) {
      lastStableFlightsRef.current = freshList;
      return freshList;
    }

    // Se estivermos EDITANDO, mantemos a ordem das linhas da referência estável.
    const freshIds = new Set(freshList.map(f => f.id));
    
    return lastStableFlightsRef.current
      .filter(f => {
        const existsInDatabase = meshFlights.some(mf => mf.id === f.id);
        const isBeingEdited = f.id === editingCell.rowId;
        const matchesCurrentFilters = freshIds.has(f.id);
        
        // Mantemos se: existe no banco E (combina com filtros OU está sendo editado agora)
        return existsInDatabase && (matchesCurrentFilters || isBeingEdited);
      })
      .map(f => {
        const latest = meshFlights.find(mf => mf.id === f.id);
        return latest || f;
      });
  }, [baseFiltered, readyStateFilter, sortConfig, editingCell, meshFlights]);

  const handleSort = (key: MeshField) => {
    if (key === 'actions') return;
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    const flight = filteredFlights[rowIndex];
    if (!flight) return;
    const isEditing = editingCell?.rowId === flight.id && editingCell?.col === colIndex;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (rowIndex < filteredFlights.length - 1) {
          setFocusedCell({ rowId: filteredFlights[rowIndex + 1].id, col: colIndex });
        }
        setEditingCell(null);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (rowIndex > 0) {
          setFocusedCell({ rowId: filteredFlights[rowIndex - 1].id, col: colIndex });
        }
        setEditingCell(null);
        break;
      case 'ArrowRight':
        if (!isEditing) {
          e.preventDefault();
          setFocusedCell({ rowId: flight.id, col: Math.min(COLUMNS.length - 1, colIndex + 1) });
        } else {
          const input = e.target as HTMLInputElement;
          if (input.selectionStart === input.value.length) {
            e.preventDefault();
            setFocusedCell({ rowId: flight.id, col: Math.min(COLUMNS.length - 1, colIndex + 1) });
            handleFinishEdit(flight.id, colIndex);
          }
        }
        break;
      case 'ArrowLeft':
        if (!isEditing) {
          e.preventDefault();
          setFocusedCell({ rowId: flight.id, col: Math.max(0, colIndex - 1) });
        } else {
          const input = e.target as HTMLInputElement;
          if (input.selectionStart === 0) {
            e.preventDefault();
            setFocusedCell({ rowId: flight.id, col: Math.max(0, colIndex - 1) });
            handleFinishEdit(flight.id, colIndex);
          }
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (isEditing) {
          const updatedFlight = meshFlights.find(f => f.id === flight.id);
          const errors = getFlightErrors(updatedFlight || flight);
          
          if (errors.isValid && readyStateFilter === 'ERROR') {
             const nextIndex = rowIndex + 1;
             const nextPending = filteredFlights.slice(nextIndex).find(f => !getFlightErrors(f).isValid);
             
             if (nextPending) {
                setFocusedCell({ rowId: nextPending.id, col: colIndex }); 
             } else {
                setFocusedCell(null);
             }
          } else {
             setFocusedCell({ rowId: flight.id, col: Math.min(COLUMNS.length - 1, colIndex + 1) });
          }
          handleFinishEdit(flight.id, colIndex);
        } else if (COLUMNS[colIndex].isVariable) {
          startEditingCell(flight.id, colIndex);
        } else {
          setFocusedCell({ rowId: flight.id, col: Math.min(COLUMNS.length - 1, colIndex + 1) });
        }
        break;
      case 'Tab':
        e.preventDefault();
        handleFinishEdit(flight.id, colIndex);
        if (e.shiftKey) {
          if (colIndex > 0) {
            setFocusedCell({ rowId: flight.id, col: colIndex - 1 });
          } else if (rowIndex > 0) {
            setFocusedCell({ rowId: filteredFlights[rowIndex - 1].id, col: COLUMNS.length - 1 });
          }
        } else {
          if (colIndex < COLUMNS.length - 1) {
            setFocusedCell({ rowId: flight.id, col: colIndex + 1 });
          } else if (rowIndex < filteredFlights.length - 1) {
            setFocusedCell({ rowId: filteredFlights[rowIndex + 1].id, col: 0 });
          }
        }
        break;
      case 'Escape':
        if (editingCell) {
          e.preventDefault();
          handleFinishEdit(flight.id, colIndex);
        }
        break;
      case 'Backspace':
      case 'Delete':
        if (!isEditing) {
          e.preventDefault();
          handleFieldChange(flight.id, COLUMNS[colIndex].key, '');
        }
        break;
      default:
        // Handle alphanumeric direct entry like Excel
        if (!isEditing && !e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1 && COLUMNS[colIndex].isVariable) {
          e.preventDefault();
          startEditingCell(flight.id, colIndex);
          handleFieldChange(flight.id, COLUMNS[colIndex].key, e.key);
        }
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (flightActionMenu && !(e.target as Element).closest('.actions-container') && !actionMenuRef.current?.contains(e.target as Node)) {
        setFlightActionMenu(null);
      }
      if (showOptionsDropdown && !optionsMenuRef.current?.contains(e.target as Node)) {
        setShowOptionsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [flightActionMenu, showOptionsDropdown]);

  useEffect(() => {
    if (focusedCell) {
      const rowIndex = filteredFlights.findIndex(f => f.id === focusedCell.rowId);
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
  }, [focusedCell, editingCell, filteredFlights]);

  const handleClose = () => {
    onClose();
  };

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.getElementById('subheader-portal-target'));
  }, []);

  const headerContent = (
    <div className={`px-4 md:px-6 h-16 shrink-0 flex items-center justify-between border-b ${isDarkMode ? "bg-slate-950 border-slate-800" : "bg-[#3CA317] border-transparent text-white shadow-[0_2px_8px_rgba(0,0,0,0.5)]"} z-20 w-full`}>
      <div className="flex items-center gap-2 md:gap-4 h-full">
        {/* Brand & Quick Stats */}
        <div className="flex items-center gap-2 shrink-0 pr-4 border-r border-white/10 h-10">
          <div className="flex flex-col">
            <h2 className="text-sm font-black text-white tracking-widest uppercase italic leading-none">Malha Base</h2>
            <p className="text-[9px] font-bold text-emerald-100/40 uppercase tracking-tighter mt-1">{totalCount} REGISTROS</p>
          </div>
          
          <div className="h-4 w-px bg-white/10 hidden md:block mx-1" />

            {/* Custom Date Picker */}
            <div className="flex items-center gap-0.5 bg-[#3a8b28] px-0.5 py-0.5 rounded-md hover:bg-[#327a23] transition-colors shadow-inner shrink-0 leading-none">
              <button 
                onClick={handlePrevDay}
                className="p-1 rounded hover:bg-white/20 text-white transition-colors"
              >
                <ChevronLeft size={14} strokeWidth={3} />
              </button>
              
              <div className="flex items-center gap-1.5 px-2 relative cursor-pointer group hover:bg-white/10 rounded h-full py-1">
                <div
                  className="flex items-center gap-1.5 w-full h-full overflow-visible"
                  onClick={() => setShowCalendar(!showCalendar)}
                >
                  <Calendar size={14} className="text-emerald-400 shrink-0 group-hover:text-emerald-300 transition-colors" strokeWidth={2.5} />
                  
                  <span className="text-white font-mono text-[11px] font-black uppercase tracking-wider whitespace-nowrap group-hover:text-emerald-50 transition-colors">
                    {formatMeshDateDisplay(currentMeshDate)}
                  </span>
                </div>
                {showCalendar && (
                  <InlineCalendar 
                    currentOffset={(() => {
                        const targetD = new Date(currentMeshDate + 'T00:00:00');
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        const diffTime = targetD.getTime() - today.getTime();
                        return Math.round(diffTime / (1000 * 60 * 60 * 24));
                    })()}
                    onSelectOffset={(offset: number) => {
                      const newD = new Date();
                      newD.setDate(newD.getDate() + offset);
                      setCurrentMeshDate(getLocalDateStr(newD));
                      setShowCalendar(false);
                    }}
                    onClose={() => setShowCalendar(false)}
                    isDarkMode={isDarkMode}
                  />
                )}
              </div>

              <button 
                onClick={handleNextDay}
                className="p-1 rounded hover:bg-white/20 text-white transition-colors"
              >
                <ChevronRight size={14} strokeWidth={3} />
              </button>
            </div>

            <div className="h-6 w-px bg-white/10 hidden md:block" />
          </div>

          {/* Unified Filters Controls */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap md:flex-nowrap">
            {/* Shift Selector - COMPACT */}
            <div className="flex items-center gap-0.5 bg-black/20 p-0.5 rounded-md border border-white/5">
              {(['TODOS', 'MANHA', 'TARDE', 'NOITE'] as MeshShift[]).map(shift => (
                <button
                  key={shift}
                  onClick={() => setActiveShift(shift)}
                  className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-all ${activeShift === shift ? 'bg-white/20 text-white shadow-sm' : 'text-white/50 hover:text-white/80 hover:bg-white/5'}`}
                >
                  {shift}
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-white/10 mx-1 hidden md:block" />

            {/* Status Integrity Selector - COMPACT */}
            <div className="flex items-center gap-0.5 bg-black/20 p-0.5 rounded-md border border-white/5">
              {[
                { id: 'ALL', label: 'TUDO', count: totalCount, dot: null },
                { id: 'READY', label: 'PRONTOS', count: readyCount, dot: 'bg-emerald-400' },
                { id: 'ERROR', label: 'PENDENTES', count: pendingCount, dot: 'bg-amber-400' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setReadyStateFilter(f.id as any)}
                  className={`flex flex-col items-center justify-center px-3 py-1 rounded transition-all min-w-[64px] ${
                    readyStateFilter === f.id 
                      ? 'bg-white/20 text-white shadow-sm' 
                      : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-1.5 leading-none">
                    {f.dot && <div className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />}
                    <span className="text-[10px] font-bold uppercase tracking-widest">{f.label}</span>
                  </div>
                  <span className={`text-[10px] font-mono leading-none mt-1 ${readyStateFilter === f.id ? 'text-white/90' : 'text-white/40'}`}>{f.count || 0}</span>
                </button>
              ))}
            </div>
          </div>
      </div>

      <div className="flex items-center gap-4 h-full">
        {/* Search Engine - COMPACT */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
            <Search size={13} className={`${isDarkMode ? 'text-white/40 group-focus-within:text-white' : 'text-slate-400 group-focus-within:text-[#3CA317]'} transition-colors`} />
          </div>
          <input 
            type="text" 
            placeholder="PESQUISAR VOO..." 
            className={`border rounded text-[10px] uppercase w-56 pl-8 pr-3 h-7 tracking-widest outline-none transition-colors font-bold ${isDarkMode 
              ? 'bg-transparent hover:bg-white/5 border-white/20 focus:border-white/40 text-white placeholder:text-white/40' 
              : 'bg-white border-transparent text-slate-800 placeholder:text-slate-500 focus:ring-2 focus:ring-[#3CA317]/50 focus:border-[#3CA317]'
            }`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="relative" ref={optionsMenuRef}>
          <button 
            onClick={() => setShowOptionsDropdown(!showOptionsDropdown)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all font-bold uppercase tracking-wider text-[11px] ${showOptionsDropdown ? 'bg-[#e5c600] shadow-inner' : 'bg-[#FEDC00] hover:bg-[#e5c600] shadow-sm'} text-slate-800 active:scale-95 border border-[#FEDC00]`}
          >
            <Settings size={14} className={showOptionsDropdown ? 'animate-spin-slow' : ''} />
            <span>OPÇÕES</span>
            <ChevronDown size={14} className={`transition-transform duration-200 ${showOptionsDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showOptionsDropdown && (
            <div className={`absolute right-0 top-full mt-2 w-56 ${isDarkMode ? "bg-slate-900 border-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]" : "bg-white border-slate-200 shadow-xl"} border rounded-xl z-[200] overflow-hidden animate-in fade-in slide-in-from-top-2`}>
              <div className="p-1.5 space-y-0.5">
                <div className="px-3 py-2 border-b border-white/5 mb-1">
                  <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Ações da Malha Base</span>
                </div>

                <button 
                  onClick={() => {
                    handleAddFlight();
                    setShowOptionsDropdown(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isDarkMode ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                  <Plus size={14} />
                  Adicionar Voo
                </button>

                <button 
                  onClick={() => {
                    const d = new Date(currentMeshDate + 'T12:00:00');
                    d.setDate(d.getDate() - 1);
                    const prevDateStr = getLocalDateStr(d);
                    
                    let prevFlights: MeshFlight[] = [];
                    const saved = localStorage.getItem('meshFlightsByDate');
                    if (saved) {
                        try {
                            const parsed = JSON.parse(saved);
                            if (parsed[prevDateStr] && parsed[prevDateStr].length > 0) {
                                prevFlights = parsed[prevDateStr];
                            }
                        } catch(e) {
                            console.error(e);
                        }
                    }
                    
                    if (prevFlights.length === 0) {
                        prevFlights = INITIAL_MESH_FLIGHTS.map((f, i) => ({
                             ...f, 
                             id: `mesh-${prevDateStr}-${Date.now()}-${i}`,
                             date: prevDateStr
                        }));
                    }

                    if (prevFlights && prevFlights.length > 0) {
                        // Ask if they want to replace or merge
                        if (window.confirm(`Foram encontrados ${prevFlights.length} voos no dia anterior (${prevDateStr}).\n\nDeseja SUBSTITUIR COMPLETAMENTE a malha atual? (Cancele se quiser apenas Mesclar/Atualizar)`)) {
                             // REPLACE
                             const updatedFlights = prevFlights.map((f: any, i: number) => ({
                                 ...f, 
                                 id: `mesh-${currentMeshDate}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                                 date: currentMeshDate
                             }));
                             
                             setMeshFlights(updatedFlights);
                             setTimeout(() => {
                                 alert(`Malha substituída com sucesso! ${updatedFlights.length} voos carregados.`);
                             }, 100);
                        } else {
                             // MERGE / UPSERT
                             if (window.confirm(`Deseja Mesclar e Atualizar a malha atual com os dados do dia anterior?\n(Isso adicionará novos voos e atualizará os dados [Prefixo, Posição, etc] dos voos existentes).`)) {
                                 const updatedFlights = prevFlights.map((f: any, i: number) => ({
                                     ...f, 
                                     id: `mesh-${currentMeshDate}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                                     date: currentMeshDate
                                 }));
                                 
                                 setMeshFlights(prev => {
                                     const nextMesh = [...prev];
                                     let updatedCount = 0;
                                     let addedCount = 0;

                                     updatedFlights.forEach(nf => {
                                         const existingIdx = nextMesh.findIndex(pf => 
                                             pf.departureFlightNumber === nf.departureFlightNumber && 
                                             pf.etd === nf.etd
                                         );
                                         if (existingIdx >= 0) {
                                             // Update existing
                                             nextMesh[existingIdx] = {
                                                 ...nextMesh[existingIdx],
                                                 registration: nf.registration || nextMesh[existingIdx].registration,
                                                 eta: nf.eta || nextMesh[existingIdx].eta,
                                                 actualArrivalTime: nf.actualArrivalTime || nextMesh[existingIdx].actualArrivalTime,
                                                 positionId: nf.positionId || nextMesh[existingIdx].positionId,
                                                 model: nf.model || nextMesh[existingIdx].model
                                             };
                                             updatedCount++;
                                         } else {
                                             // Add new
                                             nextMesh.push(nf);
                                             addedCount++;
                                         }
                                     });
                                     
                                     setTimeout(() => {
                                         alert(`${addedCount} novos voos adicionados e ${updatedCount} voos atualizados (dados copiados) com sucesso.`);
                                     }, 100);
                                     
                                     return nextMesh;
                                 });
                             }
                        }
                    } else {
                        alert(`Erro inesperado: Não foi possível carregar a malha base do dia anterior.`);
                    }
                    setShowOptionsDropdown(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isDarkMode ? 'text-slate-300 hover:bg-emerald-500/10 hover:text-emerald-400' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-600'}`}
                >
                  <History size={14} />
                  Imp. dia anterior
                </button>

                <label className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${isDarkMode ? 'text-slate-300 hover:bg-blue-500/10 hover:text-blue-400' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-600'}`}>
                  <Upload size={14} />
                  Import. voos
                  <input 
                    type="file" 
                    accept=".csv, .xlsx, .xls"
                    className="hidden" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        const file = e.target.files[0];
                        
                        const handleNewFlights = (newFlights: MeshFlight[]) => {
                          if (newFlights.length > 0) {
                            setMeshFlights(prev => {
                              const nonDuplicates = newFlights.filter(nf => {
                                return !prev.some(pf => 
                                  pf.departureFlightNumber === nf.departureFlightNumber && 
                                  pf.etd === nf.etd
                                );
                              });
                              const ignoredCount = newFlights.length - nonDuplicates.length;
                              
                              const currentH = new Date().getHours();
                              const crossedFlightsIds = nonDuplicates.filter(nf => {
                                if (!nf.etd || nf.etd === '?' || nf.etd === 'PRÉ') return false;
                                const [h] = nf.etd.split(':').map(Number);
                                return currentH >= 12 && h < currentH - 12;
                              }).map(f => f.id);

                              if (crossedFlightsIds.length > 0) {
                                // Defer the bulk conflict modal because we are inside a state setter function here.
                                setTimeout(() => setBulkConflictData({
                                  fileName: file.name,
                                  nonDuplicates,
                                  ignoredCount,
                                  crossedFlightsIds
                                }), 0);
                                return prev; // Do not apply yet
                              }

                              const messageContent = (
                                <>
                                  Arquivo "{file.name}" foi carregado com sucesso!
                                  <br/><br/>
                                  "{ignoredCount}" ignorados (por duplicidade).
                                  <br/>
                                  {nonDuplicates.length} importados.
                                </>
                              );
                              setTimeout(() => setAlertState({isOpen: true, title: 'Importação Concluída', message: messageContent}), 100);
                              return [...nonDuplicates, ...prev];
                            });
                          }
                        };

                        const parseGridData = (grid: string[][]) => {
                          if (!grid || grid.length === 0) return [];
                          
                          let startIdx = 0;
                          const headers = grid[0].map(h => String(h || '').trim().toLowerCase());
                          let idxCia = headers.findIndex(h => h === 'cia' || h === 'airline' || h === 'companhia');
                          let idxVooCheg = headers.findIndex(h => h.includes('v.cheg') || h.includes('chegada') && !h.includes('eta') && !h.includes('sta') && !h.includes('hora'));
                          let idxVoo = headers.findIndex(h => h.includes('v.saí') || h.includes('v.sai') || (h.includes('voo') && !h.includes('cheg')));
                          if (idxVoo === -1) idxVoo = headers.findIndex(h => h.includes('voo') || h.includes('vôo') || h.includes('flight'));
                          let idxDestino = headers.findIndex(h => h.includes('dest'));
                          let idxEtd = headers.findIndex(h => h === 'etd' || h.includes('partida') || h === 'std' || h.includes('saida') || h.includes('saída'));
                          let idxPrefixo = headers.findIndex(h => h.includes('prefixo') || h.includes('reg') || h.includes('matricula'));
                          let idxModelo = headers.findIndex(h => h.includes('modelo') || h.includes('eqp') || h.includes('equipamento'));
                          // In the user's Excel, "ESTIMADO" means ETA.
                          let idxEta = headers.findIndex(h => h === 'eta' || h.includes('chegada') && h.includes('estimado') || h === 'sta' || h === 'estimado');
                          let idxPosicao = headers.findIndex(h => h.includes('posi') || h.includes('gate') || h.includes('berco') || h.includes('berço'));
                          let idxCalco = headers.findIndex(h => h.includes('calco') || h.includes('calço') || h.includes('ata'));
                          
                          if (idxVoo >= 0 || idxDestino >= 0 || idxEtd >= 0 || idxEta >= 0 || idxVooCheg >= 0) {
                            startIdx = 1;
                          } else {
                            idxCia = 0;
                            idxVooCheg = 1;
                            idxVoo = 2; // departure
                            idxDestino = 3;
                            idxEtd = 4;
                            idxPrefixo = 5;
                            idxModelo = 6;
                            idxEta = 7;
                            idxPosicao = 8;
                            idxCalco = 9;
                          }

                          const getCol = (row: string[], idx: number) => idx >= 0 && idx < row.length ? String(row[idx]).trim().toUpperCase() : '';
                          
                          const newFlights: MeshFlight[] = [];
                          for (let i = startIdx; i < grid.length; i++) {
                            const cols = grid[i];
                            if (!cols || cols.length === 0 || cols.every(c => !c)) continue;
                            
                            let vooSaida = getCol(cols, idxVoo);
                            let vooCheg = getCol(cols, idxVooCheg);
                            
                            const isEnchimento = vooSaida.includes('ENCH') || vooSaida.includes('ENCHIMENTO') || vooSaida.includes('...') || vooSaida.includes('---');
                            if (!vooSaida && !vooCheg) continue;
                            if (isEnchimento) continue;

                            let cia = '';
                            if (idxCia >= 0) {
                              cia = getCol(cols, idxCia);
                            }
                            
                            // Extrair companhia aéreo do voo caso não exista a coluna
                            if (!cia && vooSaida.length >= 2) {
                              const match = vooSaida.match(/^[A-Z0-9]{2}/);
                              if (match) cia = match[0];
                            }

                            if (cia === 'G3') cia = 'RG';
                            if (cia === 'GOL') cia = 'RG';
                            if (!cia) cia = 'RG';
                            
                            if (cia === 'RG' && vooSaida.startsWith('G3')) {
                              vooSaida = vooSaida.replace(/^G3/, 'RG');
                            } else if (cia === 'RG' && /^[\d]+$/.test(vooSaida)) {
                               vooSaida = `RG${vooSaida}`;
                            }

                            if (cia === 'RG' && vooCheg.startsWith('G3')) {
                              vooCheg = vooCheg.replace(/^G3/, 'RG');
                            } else if (cia === 'RG' && /^[\d]+$/.test(vooCheg)) {
                               vooCheg = `RG${vooCheg}`;
                            }

                            const getAirlineName = (code: string) => {
                                const map: Record<string, string> = {
                                    'AA': 'AMERICAN',
                                    'LA': 'LATAM',
                                    'RG': 'GOL',
                                    'G3': 'GOL',
                                    'CM': 'COPA',
                                    'AR': 'AEROLINEAS',
                                    'AM': 'AEROMEXICO',
                                    'AZ': 'ITA',
                                    'AD': 'AZUL',
                                    '2Z': 'VOEPASS',
                                    'TP': 'TAP',
                                    'DL': 'DELTA',
                                    'UA': 'UNITED',
                                    'AF': 'AIR FRANCE',
                                    'BA': 'BRITISH',
                                    'IB': 'IBERIA',
                                    'KL': 'KLM',
                                    'LH': 'LUFTHANSA',
                                    'UX': 'AIR EUROPA',
                                    'AC': 'AIR CANADA',
                                    'AT': 'ROYAL AIR',
                                    'AV': 'AVIANCA',
                                    '5Y': 'ATLAS',
                                };
                                return map[code] || code;
                            };

                            newFlights.push({
                              id: `imp-${Date.now()}-${i}`,
                              airline: getAirlineName(cia),
                              airlineCode: cia,
                              flightNumber: vooCheg,
                              departureFlightNumber: vooSaida,
                              destination: getCol(cols, idxDestino).trim().toUpperCase(),
                              etd: formatImportTime(getCol(cols, idxEtd)),
                              registration: getCol(cols, idxPrefixo).trim().toUpperCase(),
                              model: getCol(cols, idxModelo).trim().toUpperCase(),
                              eta: formatImportTime(getCol(cols, idxEta)),
                              positionId: getCol(cols, idxPosicao).trim().toUpperCase(),
                              actualArrivalTime: formatImportTime(getCol(cols, idxCalco)),
                              isNew: true
                            });
                          }
                          return newFlights;
                        };

                        if (file.name.endsWith('.csv')) {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            const text = evt.target?.result as string;
                            const lines = text.split(/\r?\n/);
                            const grid = lines.map(line => line.split(/[;,]/).map(c => c.trim().replace(/^["']|["']$/g, '')));
                            handleNewFlights(parseGridData(grid));
                          };
                          reader.readAsText(file);
                        } else {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            const arrayBuffer = evt.target?.result as ArrayBuffer;
                            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                            const sheetName = workbook.SheetNames[0];
                            const sheet = workbook.Sheets[sheetName];
                            const jsonData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
                            const grid = jsonData.map(row => row.map(cell => cell != null ? String(cell) : ''));
                            handleNewFlights(parseGridData(grid));
                          };
                          reader.readAsArrayBuffer(file);
                        }
                      }
                      // Reset input value to allow importing the same file again
                      e.target.value = '';
                      setShowOptionsDropdown(false);
                    }} 
                  />
                </label>

                <button 
                  onClick={() => {
                    handleActivate();
                    setShowOptionsDropdown(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isDarkMode ? 'text-slate-300 hover:bg-[#FEDC00]/20 hover:text-[#FEDC00]' : 'text-slate-600 hover:bg-[#FEDC00]/20 hover:text-slate-900'}`}
                >
                  <RefreshCw size={14} />
                  Sincronizar Malha
                </button>

                <button 
                  onClick={handleRemoveDuplicates}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isDarkMode ? 'text-amber-400 hover:bg-amber-500/10 hover:text-amber-300' : 'text-amber-600 hover:bg-amber-50 hover:text-amber-700'}`}
                >
                  <RefreshCw size={14} />
                  Limpar Duplicados
                </button>

                <div className={`my-1 border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`} />

                <button 
                  onClick={() => {
                    setShowClearMeshModal(true);
                    setShowOptionsDropdown(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isDarkMode ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300' : 'text-red-600 hover:bg-red-50 hover:text-red-700'}`}
                >
                  <Trash2 size={14} />
                  Limpar Malha Base
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col animate-in fade-in" onKeyDown={(e) => {
      if (e.key === 'Escape') handleClose();
    }}>
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
              {filteredFlights.map((flight, rIdx) => {
                const isSynced = isFlightSynced(flight);
                const errors = getFlightErrors(flight);
                const isReady = errors.isValid;
                const isDuplicated = errors.isDuplicated;
                const isPending = !errors.isValid && !isDuplicated;

                // Semaphoric row coloring
                const rowBg = isDuplicated ? 
                    (isDarkMode ? 'bg-red-500/10' : 'bg-red-50') : 
                    (isPending ? 
                        (isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50/50') : 
                        (isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50/30')
                    );
                
                return (
                  <React.Fragment key={flight.id}>
                    <tr 
                      key={flight.id}
                      data-row={rIdx}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (flight.disabled) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMenuPosition({ top: rect.bottom, left: rect.right - 144 });
                        setFlightActionMenu(flight.id);
                      }}
                      className={`
                        group relative transition-all h-10 border-b ${isDarkMode ? 'border-slate-800/50' : 'border-slate-200'}
                        ${rowBg}
                        ${flight.disabled ? 'opacity-30' : 'hover:opacity-100'}
                      `}
                    >
                      {COLUMNS.map((col, cIdx) => {
                        const isCellFocused = focusedCell?.rowId === flight.id && focusedCell?.col === cIdx;
                        const isCellEditing = editingCell?.rowId === flight.id && editingCell?.col === cIdx;
                        const cellValue = flight[col.key as keyof MeshFlight] || '';
                        const isPre = flight.etd === 'PRÉ' || flight.etd === 'PRE';
                        const checkField = (val: any) => !val || String(val).trim() === '' || String(val).trim() === '?';
                        const hasCalco = !checkField(flight.actualArrivalTime);
                        const hasEta = !checkField(flight.eta);
                        const isArrivalFlight = !checkField(flight.flightNumber) || hasCalco || hasEta;
                        
                        // Prefixo (registration) is now mandatory.
                        // For arrival flights, ETA is mandatory. V.Cheg is optional.
                        const isMandatoryField = col.key === 'airline' || 
                                                 col.key === 'registration' || 
                                                 col.key === 'departureFlightNumber' || 
                                                 col.key === 'destination' || 
                                                 col.key === 'etd' || 
                                                 (isArrivalFlight && col.key === 'eta');
                        
                        const isMandatoryEmpty = isMandatoryField && checkField(cellValue);
                        
                        if (col.key === 'actions') {
                          return (
                            <td 
                              key={`${flight.id}-actions`}
                              className={`p-0 relative h-10 text-center pointer-events-auto actions-container border-r border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}
                            >
                              <div className="flex items-center justify-center w-full h-full gap-1">
                                <button 
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteFlight(flight.id);
                                  }}
                                  className="p-1.5 rounded-md hover:bg-red-500/20 text-red-500 transition-all active:scale-95"
                                  title="Excluir"
                                >
                                  <Trash2 size={14} />
                                </button>
                                <button 
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      if (flightActionMenu === flight.id) {
                                          setFlightActionMenu(null);
                                      } else {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          setMenuPosition({ top: rect.bottom, left: rect.right - 144 });
                                          setFlightActionMenu(flight.id);
                                      }
                                  }}
                                  className={`p-1.5 rounded-md transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-200 text-slate-600 hover:text-slate-900'}`}
                                >
                                  <MoreVertical size={14} />
                                </button>
                              </div>

                              {flightActionMenu === flight.id && menuPosition && createPortal(
                                <div 
                                    ref={actionMenuRef}
                                    style={{ top: menuPosition.top + 4, left: menuPosition.left }}
                                    className="fixed w-36 bg-slate-900 rounded-lg shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border border-slate-700/50 z-[9999] flex flex-col overflow-hidden ring-1 ring-black/10 animate-in fade-in zoom-in-95 duration-200"
                                >
                                    <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-700/50 flex flex-col gap-0.5">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-left">Ações - Voo {flight.departureFlightNumber || 'NOVO'}</span>
                                    </div>
                                    <button 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleToggleDisable(flight.id);
                                        }}
                                        className="w-full px-3 py-2.5 text-[10px] font-bold uppercase flex items-center gap-2 hover:bg-slate-800 text-slate-300 border-b border-slate-700/50 transition-colors text-left"
                                    >
                                        <Ban size={12} className={flight.disabled ? 'text-emerald-500' : 'text-slate-400'} />
                                        {flight.disabled ? 'Ativar Voo' : 'Inativar Voo'}
                                    </button>
                                    <button 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (!errors.isValid) {
                                              alert('Corrija as inconsistências antes de enviar.');
                                              return;
                                            }
                                            executeSync([flight]);
                                            setFlightActionMenu(null);
                                        }}
                                        className={`w-full px-3 py-2.5 text-[10px] font-bold uppercase flex items-center gap-2 border-b border-slate-700/50 transition-colors text-left ${errors.isValid ? 'hover:bg-emerald-900/30 text-emerald-400' : 'opacity-50 cursor-not-allowed text-slate-500'}`}
                                    >
                                        <Send size={12} />
                                        Enviar p/ Malha Geral
                                    </button>
                                    <button 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleDeleteFlight(flight.id);
                                        }}
                                        className="w-full px-3 py-2.5 text-[10px] font-bold uppercase flex items-center gap-2 hover:bg-red-900/40 text-red-500 transition-colors text-left"
                                    >
                                        <Trash2 size={12} />
                                        Excluir
                                    </button>
                                </div>
                              , document.body)}
                            </td>
                          );
                        }

                        return (
                          <td 
                            key={`${flight.id}-${col.key}`} 
                            data-col={cIdx}
                            onClick={() => {
                              if (flight.disabled) return;
                              if (isCellFocused && col.isVariable) {
                                startEditingCell(flight.id, cIdx);
                              } else {
                                setFocusedCell({ rowId: flight.id, col: cIdx });
                                setEditingCell(null);
                              }
                            }}
                            className={`
                              p-0 border-r border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-200'} relative transition-all h-10
                              ${col.isVariable ? (isDarkMode ? 'bg-emerald-400/5' : 'bg-emerald-500/5') : ''}
                              ${isCellFocused ? 'ring-2 ring-emerald-500 ring-inset z-20 shadow-xl' : ''}
                            `}
                          >
                            {isCellEditing ? (
                              <input 
                                type="text"
                                autoFocus
                                value={String(flight[col.key as keyof MeshFlight] || '')}
                                onChange={(e) => handleFieldChange(flight.id, col.key as MeshField, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                                onBlur={() => handleFinishEdit(flight.id, cIdx)}
                                className={`
                                  absolute inset-0 w-full h-full px-3 bg-emerald-500 text-slate-950 font-mono text-[11px] uppercase font-black outline-none
                                  ${col.key === 'airline' ? 'text-left' : 'text-center'}
                                `}
                              />
                            ) : (
                              <div 
                                tabIndex={0}
                                onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                                className={`
                                  w-full h-full px-3 flex items-center gap-2 font-bold text-[11px] uppercase select-none cursor-default outline-none tracking-tight relative
                                  ${flight.disabled ? (isDarkMode ? 'text-slate-500/30' : 'text-slate-400/50') : (isDarkMode ? 'text-slate-200' : 'text-slate-700')}
                                  ${col.key === 'airline' ? 'justify-start text-left' : 'justify-center text-center'}
                                  ${!col.isVariable && !isCellFocused && !isMandatoryEmpty ? (isDarkMode ? 'text-indigo-400' : 'text-indigo-700') : ''}
                                  ${col.key === 'etd' && flight[col.key] === 'PRÉ' ? (isDarkMode ? 'text-blue-400 font-black' : 'text-blue-600 font-black text-[12px]') : ''}
                                  ${col.key === 'etd' && flight[col.key] && flight[col.key] !== '?' && flight[col.key] !== 'PRÉ' && getMinutesDiff(flight[col.key] as string, flight.date || currentMeshDate) < 0 ? (isDarkMode ? 'text-red-300 bg-red-900/60 font-black' : 'text-red-800 bg-red-200 font-black tracking-widest') : ''}
                                  ${isMandatoryEmpty ? 'text-red-500 animate-pulse font-black text-xs' : ''}
                                `}
                              >
                                <span>{isMandatoryEmpty ? '?' : (String(cellValue) || '-')}</span>
                                {isMandatoryEmpty && flight.id === focusedCell?.rowId && (
                                    <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]" />
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {filteredFlights.length === 0 && (
            <div className="flex flex-col items-center justify-center p-20 text-slate-500">
               <Search size={48} className="opacity-10 mb-4" />
               <p className="text-xs font-bold uppercase tracking-widest opacity-40">Nenhum registro encontrado</p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className={`h-8 px-6 border-t flex items-center justify-between text-[9px] font-bold uppercase tracking-widest ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-white border-slate-200 text-slate-400'}`}>
          <div className="flex gap-4">
            <span>Linhas: {filteredFlights.length}</span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              Colunas Editáveis
            </span>
          </div>
          <div>Dica: 1 clique seleciona, 2 cliques editam. Setas navegam, Enter pula para a direita.</div>
        </div>
      </div>
      
      {showClearMeshModal && (
        <ConfirmActionModal
          type="clearMesh"
          onConfirm={() => {
            setMeshFlights([]);
            setFocusedCell(null);
            setEditingCell(null);
            setShowClearMeshModal(false);
          }}
          onClose={() => setShowClearMeshModal(false)}
        />
      )}

      {alertState.isOpen && (
          <AlertModal 
              isOpen={alertState.isOpen}
              title={alertState.title}
              message={alertState.message}
              onClose={() => setAlertState(prev => ({...prev, isOpen: false}))}
          />
      )}

      {syncConfirmState.isOpen && (
          <ConfirmActionModal 
              type="syncPartial"
              message={syncConfirmState.message}
              onConfirm={() => {
                  setSyncConfirmState(prev => ({...prev, isOpen: false}));
                  executeSync(syncConfirmState.unsynced);
              }}
              onClose={() => setSyncConfirmState(prev => ({...prev, isOpen: false}))}
          />
      )}

      {timeConflictData && (
        <TimeConflictModal 
            timeStr={timeConflictData.newEtd}
            isDarkMode={isDarkMode}
            onConfirmToday={() => {
                const flight = meshFlights.find(f => f.id === timeConflictData.rowId);
                if (flight) {
                    confirmedConflictsRef.current.add(`${flight.id}-${flight.etd}`);
                }
                setTimeConflictData(null);
            }}
            onConfirmTomorrow={() => {
                const flight = meshFlights.find(f => f.id === timeConflictData.rowId);
                if (flight) {
                    confirmedConflictsRef.current.add(`${flight.id}-${flight.etd}`);
                    let baseDate = new Date();
                    if (flight.date) {
                        const [y, m, d] = flight.date.split('-').map(Number);
                        baseDate = new Date(y, m - 1, d);
                    }
                    baseDate.setDate(baseDate.getDate() + 1);
                    const newDateStr = getLocalDateStr(baseDate);
                    setMeshFlights(prev => prev.map(f => f.id === flight.id ? { ...f, date: newDateStr } : f));
                }
                setTimeConflictData(null);
            }}
            onCorrect={() => {
                // If cancelled, let them edit
                setTimeConflictData(null);
                setEditingCell({ rowId: timeConflictData.rowId, col: COLUMNS.findIndex(c => c.key === 'etd') });
            }}
            onDiscard={() => {
                const flight = meshFlights.find(f => f.id === timeConflictData.rowId);
                if (flight) {
                    setMeshFlights(prev => prev.map(f => f.id === flight.id ? { ...f, etd: timeConflictData.oldEtd } : f));
                }
                setTimeConflictData(null);
            }}
        />
      )}

      {bulkConflictData && (
        <BulkNextDayModal 
            count={bulkConflictData.crossedFlightsIds.length}
            isDarkMode={isDarkMode}
            onMoveToNextDay={() => {
                setMeshFlights(prev => {
                    let baseDate = new Date();
                    const [y, m, d] = currentMeshDate.split('-').map(Number);
                    baseDate = new Date(y, m - 1, d);
                    baseDate.setDate(baseDate.getDate() + 1);
                    const newDateStr = getLocalDateStr(baseDate);
                    
                    const appliedFlights = bulkConflictData.nonDuplicates.map(f => {
                       if (bulkConflictData.crossedFlightsIds.includes(f.id)) {
                           f.date = newDateStr;
                       }
                       return f;
                    });
                    return [...appliedFlights, ...prev];
                });
                
                const messageContent = (
                   <>
                     Arquivo "{bulkConflictData.fileName}" carregado!
                     <br/><br/>
                     {bulkConflictData.crossedFlightsIds.length} voo(s) foram movidos para o próximo dia.
                   </>
                );
                setAlertState({isOpen: true, title: 'Importação Concluída', message: messageContent});
                setBulkConflictData(null);
            }}
            onEditToday={() => {
                setMeshFlights(prev => [...bulkConflictData.nonDuplicates, ...prev]);
                const messageContent = (
                   <>
                     Arquivo "{bulkConflictData.fileName}" carregado!
                     <br/><br/>
                     Os voos que aparentam cruzar o dia foram mantidos na malha atual para sua conferência ou reedição.
                   </>
                );
                setAlertState({isOpen: true, title: 'Importação Concluída', message: messageContent});
                setBulkConflictData(null);
            }}
            onCancel={() => {
                setBulkConflictData(null);
            }}
        />
      )}
    </div>
  );
};

