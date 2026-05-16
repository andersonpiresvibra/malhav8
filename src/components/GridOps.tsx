
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FlightStatus, FlightData, FlightLog, LogType, OperatorProfile } from '../types';
import { getCurrentShift, getLocalTodayDateStr, getLocalDateStr } from '../utils/shiftUtils';
 // Importando perfis para designação

import { FlightDetailsModal } from './FlightDetailsModal';
import { FlightReportInputModal } from './FlightReportInputModal';
import { TimeConflictModal } from './TimeConflictModal';
import { StatusBadge } from './SharedStats';
import { OperatorCell } from './OperatorCell';
import { AirlineLogo } from './AirlineLogo';
import { Spinner } from './ui/Spinner';
import { InlineCalendar } from './ui/InlineCalendar';
import { InlineOperatorSelect } from './ui/InlineOperatorSelect';
import { insertAuditLog, upsertFlight, deleteFlight } from '../services/supabaseService';
import { useAuth } from '../contexts/AuthContext';

import { 
  LayoutGrid, Clock, UserCheck, Droplet, CheckCircle, 
  ArrowUp, ArrowDown, ArrowUpDown, 
  MessageSquare, FileText, Plane, Pen, BusFront,
  PlaneLanding, ListOrdered, AlertTriangle, Play, Pause, XCircle, Plus, Anchor,
  MapPin, Eye, CheckCheck, X, Save, History, TimerOff, UserPlus, Building2, Bell, Zap,
  MessageCircle, MoreVertical, Search, Settings, Upload, RefreshCw, Network, Archive, Trash2, Printer, FileBarChart,
  CalendarDays, ChevronLeft, ChevronRight, Table
} from 'lucide-react';

type Tab = 'GERAL' | 'CHEGADA' | 'FILA' | 'DESIGNADOS' | 'ABASTECENDO' | 'FINALIZADO' | 'MALHA';
type SortDirection = 'asc' | 'desc' | null;
type MeshShift = 'TODOS' | 'MANHA' | 'TARDE' | 'NOITE';

// Utils para Data da Malha
const getDisplayDate = (dateOffset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + dateOffset);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const formattedDate = `${day}/${month}`;
    if (dateOffset === 0) return `HOJE`;
    if (dateOffset === -1) return `ONTEM`;
    if (dateOffset === 1) return `AMANHÃ`;
    return formattedDate;
};

const isTimeInShift = (timeStr: string, shift: MeshShift) => {
  if (shift === 'TODOS' || !timeStr) return true;
  const parts = timeStr.split(':');
  if (parts.length < 2) return true;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const totalMinutes = h * 60 + m;

  if (shift === 'MANHA') return totalMinutes >= 300 && totalMinutes < 900;
  if (shift === 'TARDE') return totalMinutes >= 840 && totalMinutes <= 1440;
  if (shift === 'NOITE') return (totalMinutes >= 1260 && totalMinutes <= 1440) || (totalMinutes >= 0 && totalMinutes < 360);
  return true;
};

interface SortConfig {
  key: keyof FlightData | null;
  direction: SortDirection;
}

interface ToastNotification {
    id: string;
    title: string;
    message: string;
    type: 'success' | 'info' | 'warning';
}

import { CreateFlightModal } from './CreateFlightModal';
import { DesigOpr } from './desigopr';
import { DelayJustificationModal } from './modals/DelayJustificationModal';
import { ObservationModal } from './modals/ObservationModal';
import { ConfirmActionModal } from './modals/ConfirmActionModal';
import { ImportModal } from './modals/ImportModal';
import { Vehicle, MeshFlight } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface GridOpsProps {
    flights: FlightData[];
    onUpdateFlights: React.Dispatch<React.SetStateAction<FlightData[]>>;
    vehicles: Vehicle[];
    operators: OperatorProfile[];
    initialTab?: Tab;
    globalSearchTerm?: string;
    onUpdateSearch?: (term: string) => void;
    meshFlights?: MeshFlight[];
    setMeshFlights?: React.Dispatch<React.SetStateAction<MeshFlight[]>>;
    onOpenShiftOperators?: () => void;
    onOpenReport?: (flight: FlightData) => void;
    pendingAction?: 'CREATE' | 'IMPORT' | null;
    setPendingAction?: React.Dispatch<React.SetStateAction<'CREATE' | 'IMPORT' | null>>;
    onEditingStateChange?: (isEditing: boolean) => void;
    ltName: string;
    currentMeshDate?: string;
    positionRestrictions: Record<string, 'HYBRID' | 'CTA' | 'SRV'>;
}

const parseTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
};

// Função para calcular diferença em minutos entre uma hora (HH:MM) e o momento atual
const getMinutesDiff = (targetTimeStr: string, flightDateStr?: string) => {
    if (!targetTimeStr) return 0;
    
    const [hours, minutes] = targetTimeStr.split(':').map(Number);
    const target = new Date();
    
    if (flightDateStr) {
        // flightDateStr is in "YYYY-MM-DD"
        const [year, month, day] = flightDateStr.split('-').map(Number);
        target.setFullYear(year, month - 1, day);
    }
    
    target.setHours(hours, minutes, 0, 0);
    const current = new Date();
    
    let diff = Math.round((target.getTime() - current.getTime()) / 60000);
    
    return diff;
};
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

const DELAY_REASONS = [
    "Atraso Chegada Aeronave (Late Arrival)",
    "Solicitação Cia Aérea (Abastecimento Parcial)",
    "Manutenção Equipamento Abastecimento",
    "Manutenção Aeronave (Mecânica)",
    "Indisponibilidade de Posição/Balizamento",
    "Restrição Meteorológica (Raios)",
    "Atraso Operacional (Equipe)",
    "Fluxo Lento / Pressão Hidrante Baixa"
];

const calculateLandingETA = (blockTime: string) => {
    const date = parseTime(blockTime);
    date.setMinutes(date.getMinutes() - 15);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getLatestReportItem = (flight: FlightData) => {
    if (!flight.report) return null;
    const { report } = flight;
    
    const items = [];
    if (report.fuelOrderTime) items.push({ label: 'FO', time: report.fuelOrderTime, color: 'text-orange-500', bg: 'bg-orange-500/10' });
    if (report.mechanicTime) items.push({ label: 'MEC', time: report.mechanicTime, color: 'text-blue-500', bg: 'bg-blue-500/10' });
    if (report.crewTime) items.push({ label: 'TRP', time: report.crewTime, color: 'text-indigo-500', bg: 'bg-indigo-500/10' });
    if (report.obstructedAreaTime) items.push({ label: 'OBS', time: report.obstructedAreaTime, color: 'text-red-500', bg: 'bg-red-500/10' });
    if (report.authorizationTime) items.push({ label: 'AUT', time: report.authorizationTime, color: 'text-emerald-500', bg: 'bg-emerald-500/10' });
    if (report.dispensed) items.push({ label: 'DISP', time: '--:--', color: 'text-amber-500', bg: 'bg-amber-500/10' });
    
    if (items.length === 0) return null;

    items.sort((a, b) => {
        if (a.time === '--:--') return -1;
        if (b.time === '--:--') return 1;
        return a.time.localeCompare(b.time);
    });

    return items[items.length - 1];
};

// Verifica se houve atraso REAL (Hora Finalização > ETD)
const checkIsDelayed = (flight: FlightData) => {
    if (!flight.endTime || !flight.etd) return false;
    const [h, m] = flight.etd.split(':').map(Number);
    const etdDate = new Date(flight.endTime); 
    etdDate.setHours(h, m, 0, 0);
    // Se EndTime for maior que ETD, houve atraso
    return flight.endTime.getTime() > etdDate.getTime();
};

const calculateTAB = (flight: FlightData) => {
    if (!flight.designationTime || !flight.endTime) return "--:--";
    const diffMs = flight.endTime.getTime() - flight.designationTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const createNewLog = (type: LogType, message: string, author: string = 'GESTOR_MESA'): FlightLog => ({
    id: Date.now().toString(),
    timestamp: new Date(),
    type,
    message,
    author
});

export const GridOps: React.FC<GridOpsProps> = ({ 
    flights, 
    onUpdateFlights, 
    vehicles, 
    operators,
    initialTab = 'GERAL', 
    globalSearchTerm = '',
    onUpdateSearch,
    meshFlights = [],
    setMeshFlights,
    onOpenShiftOperators,
    onOpenReport,
    pendingAction,
    setPendingAction,
    onEditingStateChange,
    ltName,
    currentMeshDate,
    positionRestrictions
}) => {
  const { isDarkMode } = useTheme();
  const { user, warName } = useAuth();
  
  const currentUserName = user?.warName || warName || ltName || 'SISTEMA';
  const currentUserRole = user?.role || 'LÍDER DE TURNO';

  const logAudit = (
    actionType: string, 
    flight: Partial<FlightData>, 
    field?: string, 
    oldVal?: string, 
    newVal?: string, 
    metadata?: any
  ) => {
    insertAuditLog({
      entity_type: 'FLIGHT',
      entity_id: flight.id,
      action_type: actionType,
      flight_number: flight.flightNumber,
      flight_date: flight.date || currentMeshDate,
      registration: flight.registration,
      field_changed: field,
      old_value: oldVal,
      new_value: newVal,
      user_name: currentUserName,
      user_role: currentUserRole,
      metadata
    });
  };

  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [activeShift, setActiveShift] = useState<MeshShift>(getCurrentShift(false) as MeshShift);
  const [activeDateOffset, setActiveDateOffset] = useState<number>(0);
  const [showCalendar, setShowCalendar] = useState(false);
  
  // Track target simulated day from App
  useEffect(() => {
     if (currentMeshDate) {
         const targetD = new Date(currentMeshDate + 'T00:00:00');
         const today = new Date();
         today.setHours(0,0,0,0);
         const diffTime = targetD.getTime() - today.getTime();
         const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
         setActiveDateOffset(diffDays);
     }
  }, [currentMeshDate]);

  useEffect(() => {
    // Manter o hook vazio por enquanto caso no futuro precise carregar dados reais, mas sem o delay simulado
  }, []);

  useEffect(() => {
      if (initialTab) {
          setActiveTab(initialTab);
      }
  }, [initialTab]);

  const [selectedFlight, setSelectedFlight] = useState<FlightData | null>(null);
  const [reportInputFlight, setReportInputFlight] = useState<FlightData | null>(null);

  // Keep selectedFlight in sync with global flights
  useEffect(() => {
      if (selectedFlight) {
          const updated = flights.find(f => f.id === selectedFlight.id);
          if (updated && JSON.stringify(updated) !== JSON.stringify(selectedFlight)) {
              setSelectedFlight(updated);
          }
      }
  }, [flights, selectedFlight]);

  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null });
  
  // Estado para controlar visualização de finalizados na aba GERAL
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  
  // Modals e Toasts
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [standbyModalFlightId, setStandbyModalFlightId] = useState<string | null>(null);
  const [standbyReason, setStandbyReason] = useState('');
  const [observationModalFlight, setObservationModalFlight] = useState<FlightData | null>(null);
  const [newObservation, setNewObservation] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  const [optionsMenuRect, setOptionsMenuRect] = useState<DOMRect | null>(null);
  const [timeConflictData, setTimeConflictData] = useState<{rowId: string, oldEtd: string, newEtd: string} | null>(null);
  
  // NEW: Spreadsheet inline editing states
  const [focusedCell, setFocusedCell] = useState<{ rowId: string; col: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: string } | null>(null);
  const [isKeystrokeEdit, setIsKeystrokeEdit] = useState(false);
  const [calcoModalFlight, setCalcoModalFlight] = useState<FlightData | null>(null);
  const [calcoModalPosition, setCalcoModalPosition] = useState<string>('');
  const [calcoModalTime, setCalcoModalTime] = useState<string>('');
  const tableRef = useRef<HTMLTableElement>(null);
  const lastStableFlightsRef = useRef<FlightData[]>([]);
  const lastFiltersRef = useRef({ activeTab, activeShift, globalSearchTerm });

  useEffect(() => {
    if (activeTab !== lastFiltersRef.current.activeTab || 
        activeShift !== lastFiltersRef.current.activeShift || 
        globalSearchTerm !== lastFiltersRef.current.globalSearchTerm) {
      setEditingCell(null);
      lastFiltersRef.current = { activeTab, activeShift, globalSearchTerm };
    }
  }, [activeTab, activeShift, globalSearchTerm]);

  useEffect(() => {
    if (focusedCell) {
      if (editingCell?.rowId === focusedCell.rowId && editingCell?.col === focusedCell.col) {
        const input = tableRef.current?.querySelector(`tr[data-rowid="${focusedCell.rowId}"] td[data-colkey="${focusedCell.col}"] input`) as HTMLInputElement;
        if (input && document.activeElement !== input) {
          input.focus();
        }
      } else {
        const cell = tableRef.current?.querySelector(`tr[data-rowid="${focusedCell.rowId}"] td[data-colkey="${focusedCell.col}"] div`) as HTMLDivElement;
        if (cell && document.activeElement !== cell) {
          cell.focus();
        }
      }
    }
  }, [focusedCell, editingCell]);

  const syncFlight = (updatedFlight: FlightData, shouldPersist: boolean = true) => {
    onUpdateFlights(prev => prev.map(f => f.id === updatedFlight.id ? updatedFlight : f));
    
    if (shouldPersist) {
      upsertFlight(updatedFlight).catch(err => {
        console.error('Failed to persist flight update:', err);
      });
    }

    if (setMeshFlights) {
      setMeshFlights(prevMesh => prevMesh.map(m => {
        const flightIdBase = updatedFlight.id.replace(/^mesh-\d+-/, '');
        const isIdMatch = updatedFlight.id === m.id || flightIdBase === m.id || flightIdBase === m.id.replace(/^mesh-\d+-/, '');
        const isNumberMatch = (updatedFlight.departureFlightNumber && m.departureFlightNumber && updatedFlight.departureFlightNumber === m.departureFlightNumber) ||
                             (updatedFlight.flightNumber && m.flightNumber && updatedFlight.flightNumber === m.flightNumber);

        if (isIdMatch || isNumberMatch) {
          return { 
            ...m, 
            actualArrivalTime: updatedFlight.actualArrivalTime || m.actualArrivalTime,
            etd: updatedFlight.etd || m.etd,
            eta: updatedFlight.eta || m.eta,
            registration: updatedFlight.registration || m.registration,
            destination: updatedFlight.destination || m.destination,
            positionId: updatedFlight.positionId || m.positionId,
            positionType: updatedFlight.positionType || m.positionType,
            departureFlightNumber: updatedFlight.departureFlightNumber || m.departureFlightNumber,
            operator: updatedFlight.operator || m.operator,
            supportOperator: updatedFlight.supportOperator || m.supportOperator,
            fleet: updatedFlight.fleet || m.fleet,
          };
        }
        return m;
      }));
    }
  };

  const handleFieldChange = (id: string, field: keyof FlightData, value: string) => {
    const flight = flights.find(f => f.id === id);
    if (!flight) return;

    let newValue: any = value.toUpperCase();
    
    if (field === 'eta' || field === 'etd' || field === 'actualArrivalTime' || field === 'designationTime') {
      newValue = value.replace(/[^0-9]/g, '');
      if (newValue.length > 2) {
        newValue = `${newValue.slice(0, 2)}:${newValue.slice(2, 4)}`;
      }
      if (newValue.length > 5) newValue = newValue.slice(0, 5);
    } else if (field === 'fuelStatus' || field === 'volume' || field === 'maxFlowRate') {
      newValue = parseFloat(value) || 0;
    } else if (field === 'positionId') {
      let payload: FlightData = { ...flight, [field]: newValue };
      const restrictionType = positionRestrictions[newValue];
      if (restrictionType === 'CTA') {
        payload.positionType = 'CTA';
      } else if (restrictionType === 'SRV') {
        payload.positionType = 'SRV';
      } else if (payload.positionType) {
        payload.positionType = undefined;
      }
      syncFlight(payload);
      return;
    }

    const updatedFlight = { ...flight, [field]: newValue };
    syncFlight(updatedFlight); // Local update only
  };

  const confirmedConflictsRef = useRef<Set<string>>(new Set());

  const handleFinishEdit = (rowId: string, colKey: string) => {
    setEditingCell(null);
    setIsKeystrokeEdit(false);

    const flight = flights.find(f => f.id === rowId);
    if (flight) {
      // Persist on blur
      upsertFlight(flight).catch(err => console.error('Error on blur persistence:', err));
    }

    if (colKey === 'etd') {
        const flight = flights.find(f => f.id === rowId);
        if (flight && flight.etd && flight.etd.length >= 4) {
            const [h] = flight.etd.split(':').map(Number);
            const currentH = new Date().getHours();
            // Verificação se o horário digitado cruza a meia-noite (próximo dia)
            const isNextDayCross = (currentH >= 12 && h < currentH - 12);
            
            if (isNextDayCross) {
                const oldFlight = lastStableFlightsRef.current.find(f => f.id === rowId);
                const trueOldEtd = oldFlight?.etd || ''; // REAL original ETD
                const conflictKey = `${rowId}-${flight.etd}`;
                if (!confirmedConflictsRef.current.has(conflictKey)) {
                    setTimeConflictData({ rowId, oldEtd: trueOldEtd, newEtd: flight.etd });
                }
            }
        }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowId: string, colKey: string, rowIndex: number, colIndex: number) => {
    const isEditing = editingCell?.rowId === rowId && editingCell?.col === colKey;
    let targetTd = e.currentTarget as HTMLElement;
    if (targetTd.tagName !== 'TD') {
        targetTd = targetTd.closest('td') as HTMLElement;
    }
    const currentTr = targetTd?.parentElement as HTMLTableRowElement;
    if (!currentTr) return;
    const tbody = currentTr.parentElement as HTMLTableSectionElement;
    if (!tbody) return;

    const navigate = (newRowIndex: number, newColIndex: number, preferEditing = false, horizontalDirection: 1 | -1 | 0 = 0) => {
      let targetRow = Array.from(tbody.children).find(el => parseInt(el.getAttribute('data-rowindex') || '-1') === newRowIndex) as HTMLTableRowElement;
      
      let nextRowIndex = newRowIndex;
      let nextColIndex = newColIndex;

      if (horizontalDirection !== 0) {
          while (true) {
              if (!targetRow) break;
              let targetCell = Array.from(targetRow.children).find(el => parseInt(el.getAttribute('data-colindex') || '-1') === nextColIndex) as HTMLElement;
              
              if (!targetCell) {
                  if (horizontalDirection === 1) {
                      nextRowIndex += 1;
                      nextColIndex = 0;
                  } else {
                      nextRowIndex -= 1;
                      const prevRow = Array.from(tbody.children).find(el => parseInt(el.getAttribute('data-rowindex') || '-1') === nextRowIndex) as HTMLTableRowElement;
                      if (!prevRow) break;
                      nextColIndex = Array.from(prevRow.children)
                          .filter(c => c.hasAttribute('data-colindex'))
                          .map(c => parseInt(c.getAttribute('data-colindex')!))
                          .reduce((max, val) => Math.max(max, val), 0);
                  }
                  targetRow = Array.from(tbody.children).find(el => parseInt(el.getAttribute('data-rowindex') || '-1') === nextRowIndex) as HTMLTableRowElement;
                  continue;
              }

              if (targetCell.getAttribute('data-editable') === 'true') {
                  break;
              } else {
                  nextColIndex += horizontalDirection;
              }
          }
      }

      if (targetRow) {
        const targetCell = Array.from(targetRow.children).find(el => parseInt(el.getAttribute('data-colindex') || '-1') === nextColIndex) as HTMLElement;
        if (targetCell && (horizontalDirection !== 0 ? true : targetCell.getAttribute('data-editable') === 'true')) {
          const newRowId = targetCell.getAttribute('data-rowid');
          const newColKey = targetCell.getAttribute('data-colkey');
          if (newRowId && newColKey) {
            setFocusedCell({ rowId: newRowId, col: newColKey });
            if (preferEditing) {
              setEditingCell({ rowId: newRowId, col: newColKey });
            } else {
              handleFinishEdit(rowId, colKey);
            }
            setTimeout(() => {
                const innerEl = targetCell.querySelector('input') || targetCell.querySelector('div');
                if (innerEl) (innerEl as HTMLElement).focus();
                else targetCell.focus();
            }, 0);
          }
        }
      }
    };

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        navigate(rowIndex + 1, colIndex);
        break;
      case 'ArrowUp':
        e.preventDefault();
        navigate(rowIndex - 1, colIndex);
        break;
      case 'ArrowRight':
        if (!isEditing) {
          e.preventDefault();
          navigate(rowIndex, colIndex + 1, false, 1);
        } else {
          const input = e.target as HTMLInputElement;
          if (input && input.selectionStart === input.value.length) {
            e.preventDefault();
            navigate(rowIndex, colIndex + 1, false, 1);
            handleFinishEdit(rowId, colKey);
          }
        }
        break;
      case 'ArrowLeft':
        if (!isEditing) {
          e.preventDefault();
          navigate(rowIndex, colIndex - 1, false, -1);
        } else {
          const input = e.target as HTMLInputElement;
          if (input && input.selectionStart === 0) {
            e.preventDefault();
            navigate(rowIndex, colIndex - 1, false, -1);
            handleFinishEdit(rowId, colKey);
          }
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (isEditing) {
          navigate(rowIndex, colIndex + 1, false, 1);
          handleFinishEdit(rowId, colKey);
        } else if (targetTd?.getAttribute('data-editable') === 'true') {
          setEditingCell({ rowId, col: colKey });
        } else {
          // If not editable, just move right like excel
          navigate(rowIndex, colIndex + 1, false, 1);
        }
        break;
      case 'Tab':
        e.preventDefault();
        handleFinishEdit(rowId, colKey);
        if (e.shiftKey) {
          navigate(rowIndex, colIndex - 1, false, -1);
        } else {
          navigate(rowIndex, colIndex + 1, false, 1);
        }
        break;
      case 'Escape':
        if (isEditing) {
          e.preventDefault();
          handleFinishEdit(rowId, colKey);
        }
        break;
      case 'Backspace':
      case 'Delete':
        if (!isEditing) {
          e.preventDefault();
          handleFieldChange(rowId, colKey as keyof FlightData, '');
        }
        break;
      default:
        if (!isEditing && !e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
          e.preventDefault();
          setIsKeystrokeEdit(true);
          handleFieldChange(rowId, colKey as keyof FlightData, e.key.toUpperCase());
          setEditingCell({ rowId, col: colKey });
        }
        break;
    }
  };

  // Delay Justification Modal States
  const [delayModalFlightId, setDelayModalFlightId] = useState<string | null>(null);
  const [delayReasonCode, setDelayReasonCode] = useState('');
  const [delayReasonDetail, setDelayReasonDetail] = useState('');

  // Assign Operator Modal State
  const [assignModalFlight, setAssignModalFlight] = useState<FlightData | null>(null);
  const [assignSupportModalFlight, setAssignSupportModalFlight] = useState<FlightData | null>(null);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number, left: number } | null>(null);
  const [cancelModalFlight, setCancelModalFlight] = useState<FlightData | null>(null);
  const [deleteModalFlight, setDeleteModalFlight] = useState<FlightData | null>(null);
  
  // New Confirmation Modals
  const [confirmStartModalFlight, setConfirmStartModalFlight] = useState<FlightData | null>(null);
  const [missingPositionModalFlight, setMissingPositionModalFlight] = useState<FlightData | null>(null);
  const [confirmRemoveOperatorFlight, setConfirmRemoveOperatorFlight] = useState<FlightData | null>(null);
  const [confirmFinishModalFlight, setConfirmFinishModalFlight] = useState<FlightData | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  const isEditingAny = useMemo(() => {
    return !!(
      editingCell ||
      openMenuId ||
      isCreateModalOpen ||
      isImportModalOpen ||
      selectedFlight ||
      reportInputFlight ||
      standbyModalFlightId ||
      observationModalFlight ||
      calcoModalFlight ||
      delayModalFlightId ||
      assignModalFlight ||
      assignSupportModalFlight ||
      cancelModalFlight ||
      deleteModalFlight ||
      confirmStartModalFlight ||
      missingPositionModalFlight ||
      confirmRemoveOperatorFlight ||
      confirmFinishModalFlight
    );
  }, [
    editingCell, openMenuId, isCreateModalOpen, isImportModalOpen, selectedFlight, reportInputFlight,
    standbyModalFlightId, observationModalFlight, calcoModalFlight, delayModalFlightId, assignModalFlight,
    assignSupportModalFlight, cancelModalFlight, deleteModalFlight, confirmStartModalFlight,
    missingPositionModalFlight, confirmRemoveOperatorFlight, confirmFinishModalFlight
  ]);

  useEffect(() => {
    if (onEditingStateChange) {
      onEditingStateChange(isEditingAny);
    }
  }, [isEditingAny, onEditingStateChange]);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  const handleCreateFlight = (newFlight: FlightData) => {
    // If getting date string for the currently selected activeDateOffset
    const d = new Date();
    d.setDate(d.getDate() + activeDateOffset);
    const dateStr = getLocalDateStr(d);

    const flightWithDate = {
        ...newFlight,
        date: newFlight.date || dateStr
    };
    onUpdateFlights(prev => [flightWithDate, ...prev]);
    upsertFlight(flightWithDate).catch(err => console.error('Error persisting new flight:', err));
    addToast('VOO CRIADO', `Voo ${newFlight.flightNumber} criado com sucesso.`, 'success');
    setIsCreateModalOpen(false);
  };

  // Notifications Logic
  const allNotifications = useMemo(() => {
      const msgs = flights.flatMap(f => (f.messages || []).map(m => ({ ...m, flight: f })));
      // Filtra mensagens que não são do gestor (mensagens recebidas)
      return msgs.filter(m => !m.isManager).sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [flights]);

  // Auto-Update Logic (Usando o state setter global)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
        setShowOptionsDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
        onUpdateFlights(prevFlights => {
            let hasChanges = false;
            const changedFlights: FlightData[] = [];
            
            const updated = prevFlights.map(f => {
                const minutesToETD = getMinutesDiff(f.etd, f.date);
                let updatedF = { ...f };
                let isModified = false;
                
                // LÓGICA DE AUTOMATIZAÇÃO PARA FILA:
                if (f.status === FlightStatus.CHEGADA && minutesToETD < 60 && minutesToETD >= -120 && !f.operator && !f.isExcludedFromQueue) {
                    isModified = true;
                    const newLog = createNewLog('SISTEMA', 'Voo movido para FILA automaticamente (ETD < 60min).', 'SISTEMA');
                    updatedF = { 
                        ...updatedF, 
                        status: FlightStatus.FILA,
                        logs: [...(f.logs || []), newLog]
                    };
                }
                
                // NOVA LÓGICA: Início de abastecimento automático
                const hasPosition = f.positionId && f.positionId !== '?' && f.positionId.trim() !== '';
                if ((f.status === FlightStatus.DESIGNADO || f.status === FlightStatus.PRÉ) && f.operator && hasPosition) {
                    const designationTime = f.designationTime ? new Date(f.designationTime).getTime() : 0;
                    if (designationTime > 0) {
                        const minsSinceDesig = (Date.now() - designationTime) / 60000;
                        if (minsSinceDesig >= 10) {
                            if (minutesToETD <= 25 || minutesToETD < 30) {
                                isModified = true;
                                const newLog = createNewLog('SISTEMA', 'Início aut. de abastecimento (10m deslocamento/acoplamento respeitados).', 'SISTEMA');
                                updatedF = {
                                    ...updatedF,
                                    status: FlightStatus.ABASTECENDO,
                                    startTime: new Date(),
                                    logs: [...(f.logs || []), newLog]
                                };
                            }
                        }
                    }
                }
                
                if (isModified) {
                    hasChanges = true;
                    changedFlights.push(updatedF);
                    return updatedF;
                }
                return f;
            });

            if (hasChanges) {
                // Persistir no banco
                changedFlights.forEach(f => {
                    upsertFlight(f).catch(err => console.error("Erro na persistência automática:", err));
                });
                return updated;
            }
            return prevFlights;
        });
    }, 5000);
    return () => clearInterval(interval);
  }, [onUpdateFlights]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (observationModalFlight && newObservation.trim()) {
            handleSaveObservation();
        } else if (delayModalFlightId && delayReasonCode) {
            handleSubmitDelay();
        } else if (cancelModalFlight) {
            confirmCancelFlight();
        } else if (deleteModalFlight) {
            confirmDeleteFlight();
        } else if (confirmStartModalFlight) {
            handleConfirmStart();
        } else if (missingPositionModalFlight) {
            const f = missingPositionModalFlight;
            setMissingPositionModalFlight(null);
            onUpdateFlights(prev => prev.map(flight => 
                flight.id === f.id ? { ...flight, positionId: 'PÁTIO VIP' } : flight
            ));
            setConfirmStartModalFlight({ ...f, positionId: 'PÁTIO VIP' });
        } else if (confirmFinishModalFlight) {
            handleConfirmFinish();
        } else if (confirmRemoveOperatorFlight) {
            handleConfirmRemoveOperator();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
      observationModalFlight, newObservation, 
      delayModalFlightId, delayReasonCode, 
      cancelModalFlight, confirmStartModalFlight, missingPositionModalFlight,
      confirmFinishModalFlight, confirmRemoveOperatorFlight,
      deleteModalFlight
  ]);

  const addToast = (title: string, message: string, type: 'success' | 'info' | 'warning' = 'info') => {
      const id = Date.now().toString();
      setToasts(prev => [...prev, { id, title, message, type }]);
      setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
      }, 5000);
  };

  const removeToast = (id: string) => {
      setToasts(prev => prev.filter(t => t.id !== id));
  };

  const visibleFlights = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + activeDateOffset);
    const targetDateStr = getLocalDateStr(d);
    
    // For crossover shift logic
    const dNext = new Date();
    dNext.setDate(dNext.getDate() + activeDateOffset + 1);
    const nextDateStr = getLocalDateStr(dNext);
    
    // We already have getDisplayDate but it returns offset today, but if we need real today:
    const todayStr = getLocalTodayDateStr();

    return flights.filter(f => {
       if (f.isHiddenFromGrid) return false;
       const fDate = f.date || todayStr;
       
       if (fDate === targetDateStr) return true;
       
       // Crossover turn concept (virada de turno): 
       // Bring next day's early morning flights (00:00 - 05:00) into today's view automatically
       if (fDate === nextDateStr && f.etd && f.etd !== '?' && f.etd !== 'PRÉ') {
           const [h] = f.etd.split(':').map(Number);
           if (h >= 0 && h < 5) {
               return true; // Aparece simultaneamente
           }
       }
       
       return false;
    });
  }, [flights, activeDateOffset]);

  const shiftedFlights = useMemo(() => 
    visibleFlights.filter(f => isTimeInShift(f.etd, activeShift)), 
    [visibleFlights, activeShift]
  );

  const searchFilteredFlights = useMemo(() => {
    if (!globalSearchTerm) return shiftedFlights;
    const lowerTerms = globalSearchTerm.toLowerCase().trim().split(/\s+/);
    return shiftedFlights.filter(f => {
        const city = ICAO_CITIES[f.destination as string] || '';
        const allFields = [
            f.flightNumber, f.departureFlightNumber, f.airline, f.airlineCode, f.model, 
            f.registration, f.origin, f.destination, f.eta, f.etd, f.actualArrivalTime,
            f.positionId, f.positionType, f.pitId, f.operator,
            f.supportOperator, f.fleet, f.fleetType, f.vehicleType, 
            city,
            (f.airlineCode || '') + '-' + (f.flightNumber || ''),
            (f.airlineCode || '') + (f.flightNumber || ''),
            (f.airlineCode || '') + '-' + (f.departureFlightNumber || ''),
            (f.airlineCode || '') + (f.departureFlightNumber || '')
        ];
        const searchString = allFields
            .filter(Boolean)
            .map(val => String(val).toLowerCase())
            .join(' | ');
        
        return lowerTerms.every(term => searchString.includes(term));
    });
  }, [shiftedFlights, globalSearchTerm]);

  const hasReport = (flight: FlightData) => Boolean(flight.report && Object.values(flight.report).some(v => v !== '' && v !== false));

  const stats = useMemo(() => ({
    total: searchFilteredFlights.length,
    chegada: searchFilteredFlights.filter(f => {
        if (!f.eta) return false;
        const minutesToEta = getMinutesDiff(f.eta, f.date);
        return f.status === FlightStatus.CHEGADA && !(f.isOnGround && f.positionId) && minutesToEta <= 120;
    }).length,
    fila: searchFilteredFlights.filter(f => f.status === FlightStatus.FILA && !f.operator).length,
    designados: searchFilteredFlights.filter(f => f.status === FlightStatus.DESIGNADO).length,
    abastecendo: searchFilteredFlights.filter(f => f.status === FlightStatus.ABASTECENDO).length,
    finalizados: searchFilteredFlights.filter(f => f.status === FlightStatus.FINALIZADO || f.status === FlightStatus.CANCELADO).length,
  }), [searchFilteredFlights]);

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'GERAL', label: 'TODOS OS VOOS', icon: LayoutGrid, count: stats.total },
    { id: 'CHEGADA', label: 'CHEGADA', icon: PlaneLanding, count: stats.chegada },
    { id: 'FILA', label: 'FILA', icon: ListOrdered, count: stats.fila },
    { id: 'DESIGNADOS', label: 'DESIGNADOS', icon: UserCheck, count: stats.designados },
    { id: 'ABASTECENDO', label: 'ABASTECENDO', icon: Droplet, count: stats.abastecendo },
    { id: 'FINALIZADO', label: 'FINALIZADOS', icon: CheckCircle, count: stats.finalizados },
  ];

  const filteredData = useMemo(() => {
    let base = searchFilteredFlights;
    
    switch (activeTab) {
      case 'CHEGADA': 
        base = searchFilteredFlights.filter(f => {
            if (!f.eta) return false;
            const minutesToEta = getMinutesDiff(f.eta, f.date);
            return f.status === FlightStatus.CHEGADA && 
                   !(f.isOnGround && f.positionId) && 
                   minutesToEta <= 120;
        });
        break;
      case 'FILA': 
        base = searchFilteredFlights.filter(f => f.status === FlightStatus.FILA && !f.operator);
        break;
      case 'DESIGNADOS': base = searchFilteredFlights.filter(f => f.status === FlightStatus.DESIGNADO); break;
      case 'ABASTECENDO': base = searchFilteredFlights.filter(f => f.status === FlightStatus.ABASTECENDO); break;
      case 'FINALIZADO': base = searchFilteredFlights.filter(f => f.status === FlightStatus.FINALIZADO || f.status === FlightStatus.CANCELADO); break;
      case 'GERAL': 
        base = searchFilteredFlights;
        break;
      default: base = searchFilteredFlights;
    }

    return base;
  }, [activeTab, searchFilteredFlights, archivedIds]);

  const isStreamlinedView = ['FILA', 'DESIGNADOS', 'ABASTECENDO'].includes(activeTab);
  const isFinishedView = activeTab === 'FINALIZADO';

  const handleSort = (key: keyof FlightData) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    else if (sortConfig.key === key && sortConfig.direction === 'desc') direction = null;
    setSortConfig({ key: direction ? key : null, direction });
  };

  const renderEditableCell = (row: FlightData, colKey: keyof FlightData, value: string | number, className: string = "", rowIndex: number, colIndex: number, editable: boolean = true) => {
    const isFocused = focusedCell?.rowId === row.id && focusedCell?.col === colKey;
    const isEditing = editable && editingCell?.rowId === row.id && editingCell?.col === colKey;
    
    // Custom styling for CTA positions
    const isCTA = colKey === 'positionId' && (row.positionType === 'CTA' || positionRestrictions[row.positionId as string] === 'CTA');
    const ctaClasses = isCTA ? 'bg-yellow-400 text-slate-900 border-yellow-500' : '';

    let cellStyle = className;
    let extraLabel = null;

    if (colKey === 'etd' && row.status !== FlightStatus.FINALIZADO && row.status !== FlightStatus.CANCELADO) {
        // Removido destaque de cor para seguir padrão automático solicitado
    }

    if (row.status === FlightStatus.CHEGADA) {
        const hasPositionAndCalco = Boolean(row.positionId && row.positionId !== '?' && row.positionId.trim() !== '' && row.actualArrivalTime && row.actualArrivalTime.trim() !== '');

        if (colKey === 'positionId' || colKey === 'flightNumber' || colKey === 'actualArrivalTime' || (colKey === 'eta' && !hasPositionAndCalco)) {
            cellStyle += isDarkMode ? " !text-yellow-400 font-bold" : " !text-yellow-600 font-bold";
        }
    }

    // Indicator for Next Day crossover shift
    const d = new Date();
    d.setDate(d.getDate() + activeDateOffset);
    const targetDateStr = getLocalDateStr(d);
    if (colKey === 'etd' && row.date && row.date > targetDateStr) {
        extraLabel = <span className="absolute -top-1.5 -left-1 text-[7px] bg-blue-500 text-white px-1 rounded-sm font-black uppercase tracking-tighter shadow-sm z-20 pointer-events-none" title="Voo do dia seguinte (cruzamento de turno)">+1D</span>;
    }

    if (row.status === FlightStatus.CHEGADA && colKey === 'actualArrivalTime' && !value) {
        const handleSetCalcoNow = (e: React.MouseEvent) => {
            e.stopPropagation();
            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            
            if (!row.positionId) {
                setCalcoModalFlight(row);
                setCalcoModalPosition('');
                setCalcoModalTime(timeStr);
            } else {
                syncFlight({ ...row, actualArrivalTime: timeStr });
            }
        };
        return (
          <td 
            key={`${row.id}-${colKey}`}
            data-rowid={row.id}
            data-colkey={colKey as string}
            className={`p-0 border-y border-l transition-all relative h-10 outline-none
               ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'}
            `}
          >
             <div className="w-full h-full flex items-center justify-center p-1">
                 <button 
                   onClick={handleSetCalcoNow}
                   title="Marcar calço (hora atual)"
                   className="w-full h-full bg-yellow-500/10 hover:bg-yellow-500/30 border border-yellow-500/30 hover:border-yellow-500/60 text-yellow-600 dark:text-yellow-400 rounded flex items-center justify-center gap-1 text-[9px] uppercase tracking-tighter font-black transition-all shadow-sm"
                 >
                    CALÇO
                 </button>
             </div>
          </td>
        );
    }

    return (
      <td 
        data-rowid={row.id}
        data-colkey={colKey as string}
        data-rowindex={rowIndex}
        data-colindex={colIndex}
        data-editable={editable}
        className={`
          p-0 border-y border-l transition-all relative h-10 outline-none
          ${isCTA ? 'bg-yellow-400 border-yellow-500' : (isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50')}
        `}
      >
        {isEditing ? (
          <input 
            type="text"
            autoFocus
            onFocus={(e) => {
              if (isKeystrokeEdit) {
                // Posiciona o cursor no final para não sobrescrever o primeiro dígito
                const val = e.target.value;
                e.target.value = '';
                e.target.value = val;
                setIsKeystrokeEdit(false);
              } else {
                e.target.select();
              }
            }}
            className={`absolute inset-0 w-full h-full text-center px-1 font-mono outline-none border-none text-[13px] uppercase font-bold text-inherit ${cellStyle} ${isDarkMode ? (isCTA ? 'bg-yellow-400 text-slate-900' : 'bg-slate-900 shadow-inner') : (isCTA ? 'bg-yellow-400 text-slate-900' : 'bg-white font-black text-slate-900')}`}
            value={value}
            onChange={(e) => handleFieldChange(row.id, colKey, e.target.value)}
            onBlur={() => handleFinishEdit(row.id, colKey as string)}
            onKeyDown={(e) => handleKeyDown(e, row.id, colKey as string, rowIndex, colIndex)}
          />
        ) : (
          <div 
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              if (isFocused) {
                if (editable) setEditingCell({ rowId: row.id, col: colKey });
              } else {
                setFocusedCell({ rowId: row.id, col: colKey });
                setEditingCell(null);
                // Garantir foco no div para capturar o handleKeyDown imediatamente (técnica Excel)
                setTimeout(() => {
                   (e.currentTarget as HTMLElement).focus();
                }, 0);
              }
            }}
            onKeyDown={(e) => handleKeyDown(e, row.id, colKey as string, rowIndex, colIndex)}
            className={`w-full h-full px-1 flex items-center relative ${colKey === 'airlineCode' ? 'justify-start ml-2' : 'justify-center'} font-mono text-[12px] select-none cursor-default outline-none ${isFocused ? 'ring-2 ring-indigo-500 ring-inset z-20 shadow-xl ' + (editable ? 'bg-indigo-600 text-white shadow-indigo-500/20' : 'bg-slate-500/10') : ''} ${cellStyle} ${ctaClasses}`}
          >
            {extraLabel}
            {colKey === 'airlineCode' ? (
              <AirlineLogo airlineCode={row.airlineCode || row.airline} className={isFocused && editable && isDarkMode ? 'invert brightness-200 justify-start' : 'justify-start'} />
            ) : (
              value || '--'
            )}
          </div>
        )}
      </td>
    );
  };

  const sortedData = useMemo(() => {
    let data = [...filteredData];
    
    // Default sort by isPinned
    const calculateSorted = (list: FlightData[]) => {
      if (!sortConfig.key || !sortConfig.direction) {
          return [...list].sort((a, b) => {
              if (a.isReforco && !b.isReforco) return -1;
              if (!a.isReforco && b.isReforco) return 1;
              
              if (a.isPinned && !b.isPinned) return -1;
              if (!a.isPinned && b.isPinned) return 1;
              
              if (activeTab === 'FILA') {
                  const aMin = getMinutesDiff(a.etd, a.date);
                  const bMin = getMinutesDiff(b.etd, b.date);
                  const aSevere = aMin <= -60;
                  const bSevere = bMin <= -60;
                  if (aSevere && !bSevere) return 1;
                  if (!aSevere && bSevere) return -1;
                  return aMin - bMin;
              }
              
              if (activeTab === 'GERAL') {
                  const aInactive = a.status === FlightStatus.FINALIZADO || a.status === FlightStatus.CANCELADO;
                  const bInactive = b.status === FlightStatus.FINALIZADO || b.status === FlightStatus.CANCELADO;
                  if (aInactive && !bInactive) return 1;
                  if (!aInactive && bInactive) return -1;
                  
                  const aMin = getMinutesDiff(a.etd, a.date);
                  const bMin = getMinutesDiff(b.etd, b.date);
                  return aMin - bMin;
              }
              
              return 0;
          });
      }
      
      return [...list].sort((a, b) => {
        if (a.isReforco && !b.isReforco) return -1;
        if (!a.isReforco && b.isReforco) return 1;

        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        
        if (activeTab === 'FILA') {
            const aMin = getMinutesDiff(a.etd, a.date);
            const bMin = getMinutesDiff(b.etd, b.date);
            const aSevere = aMin <= -60;
            const bSevere = bMin <= -60;
            if (aSevere && !bSevere) return 1;
            if (!aSevere && bSevere) return -1;
        }
        
        if (activeTab === 'GERAL') {
            const aInactive = a.status === FlightStatus.FINALIZADO || a.status === FlightStatus.CANCELADO;
            const bInactive = b.status === FlightStatus.FINALIZADO || b.status === FlightStatus.CANCELADO;
            if (aInactive && !bInactive) return 1;
            if (!aInactive && bInactive) return -1;
        }
        
        const aValue = (a[sortConfig.key!] ?? '').toString();
        const bValue = (b[sortConfig.key!] ?? '').toString();
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      });
    };

    const freshSorted = calculateSorted(filteredData);

    if (!editingCell) {
      lastStableFlightsRef.current = freshSorted;
      return freshSorted;
    }

    const freshIds = new Set(freshSorted.map(f => f.id));
    return lastStableFlightsRef.current
      .filter(f => {
        const existsInDatabase = flights.some(gf => gf.id === f.id);
        const isBeingEdited = f.id === editingCell.rowId;
        return existsInDatabase && (freshIds.has(f.id) || isBeingEdited);
      })
      .map(f => {
        const latest = flights.find(gf => gf.id === f.id);
        return latest || f;
      });
  }, [filteredData, sortConfig, editingCell, flights, activeTab]);

  // --- ACTIONS HANDLERS (ATUALIZANDO ESTADO GLOBAL) ---
  const handleMoveToQueue = (flight: FlightData, e: React.MouseEvent) => {
      e.stopPropagation();
      
      // TRAVA LÓGICA: Se tem operador, não pode ir para fila.
      if (flight.operator) {
          addToast('AÇÃO NEGADA', 'Voo com operador designado não pode ir para a fila.', 'warning');
          return;
      }

      const newLog = createNewLog('MANUAL', 'Voo movido para FILA manualmente.', 'GESTOR_MESA');
      logAudit('MOVE_TO_QUEUE', flight, 'status', flight.status, 'FILA');
      
      const updated = { 
        ...flight, 
        status: FlightStatus.FILA,
        logs: [...(flight.logs || []), newLog]
      };
      
      onUpdateFlights(prev => prev.map(f => f.id === flight.id ? updated : f));
      upsertFlight(updated).catch(err => console.error('Error persisting status change:', err));
      
      addToast('VOO NA FILA', `Voo ${flight.flightNumber} adicionado à fila de prioridade.`, 'success');
  };

  const handleManualStart = (id: string, e: React.MouseEvent, startTime?: Date) => {
      e.stopPropagation();
      const flight = flights.find(f => f.id === id);
      const start = startTime || new Date();
      const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const newLog = createNewLog('SISTEMA', `Início de abastecimento confirmado às ${timeStr}.`, 'GESTOR_MESA');
      
      if (flight) {
        logAudit('START_FLIGHT', flight, 'status', flight.status, 'ABASTECENDO');
        const updated = { 
          ...flight, 
          status: FlightStatus.ABASTECENDO, 
          startTime: start,
          logs: [...(flight.logs || []), newLog]
        };
        onUpdateFlights(prev => prev.map(f => f.id === id ? updated : f));
        upsertFlight(updated).catch(err => console.error('Error persisting manual start:', err));
      }
  };

  const handleManualFinish = (flight: FlightData, e: React.MouseEvent) => {
      e.stopPropagation();
      const minutesToETD = getMinutesDiff(flight.etd, flight.date);
      if (minutesToETD < 0) {
          setDelayModalFlightId(flight.id);
          setDelayReasonCode('');
          setDelayReasonDetail('');
          return;
      }
      confirmFinish(flight.id, flight.flightNumber);
  };

  const handleCancelFlight = (flight: FlightData, e: React.MouseEvent) => {
      e.stopPropagation();
      setCancelModalFlight(flight);
      setOpenMenuId(null);
  };

  const handleDeleteFlight = (flight: FlightData, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteModalFlight(flight);
      setOpenMenuId(null);
  };

  const confirmDeleteFlight = () => {
      if (!deleteModalFlight) return;
      
      logAudit('DELETE_FLIGHT', deleteModalFlight);
      
      onUpdateFlights(prev => prev.filter(f => f.id !== deleteModalFlight.id));
      deleteFlight(deleteModalFlight.id).catch(err => console.error('Error deleting from DB:', err));
      
      addToast('VOO EXCLUÍDO', `Voo ${deleteModalFlight.flightNumber || deleteModalFlight.departureFlightNumber} foi removido do sistema.`, 'info');
      setDeleteModalFlight(null);
  };

  const confirmCancelFlight = () => {
      if (!cancelModalFlight) return;
      
      const newLog = createNewLog('MANUAL', 'Voo CANCELADO manualmente pelo gestor.', 'GESTOR_MESA');
      logAudit('CANCEL_FLIGHT', cancelModalFlight, 'status', cancelModalFlight.status, 'CANCELADO');
      
      const updated = { 
          ...cancelModalFlight, 
          status: FlightStatus.CANCELADO,
          logs: [...(cancelModalFlight.logs || []), newLog]
      };
      
      onUpdateFlights(prev => prev.map(f => f.id === cancelModalFlight.id ? updated : f));
      upsertFlight(updated).catch(err => console.error('Error persisting cancel:', err));
      
      addToast('VOO CANCELADO', `Voo ${cancelModalFlight.flightNumber} foi cancelado.`, 'info');
      setCancelModalFlight(null);
  };

  const handleReportCalco = (flight: FlightData, e: React.MouseEvent) => {
      e.stopPropagation();
      const newLog = createNewLog('MANUAL', 'Calço reportado manualmente pelo gestor.', 'GESTOR_MESA');
      const updated = { 
          ...flight, 
          isOnGround: true,
          logs: [...(flight.logs || []), newLog]
      };
      
      onUpdateFlights(prev => prev.map(f => f.id === flight.id ? updated : f));
      upsertFlight(updated).catch(err => console.error('Error persisting calco:', err));
      
      addToast('CALÇO REPORTADO', `Aeronave ${flight.registration} (Voo ${flight.flightNumber}) em calço.`, 'success');
      setOpenMenuId(null);
  };

  const confirmFinish = (id: string, flightNumber: string, delayJustification?: string) => {
      let newLog: FlightLog;
      const flight = flights.find(f => f.id === id);
      
      if (delayJustification) {
          newLog = createNewLog('ATRASO', `Finalizado com ATRASO. Justificativa: ${delayJustification}`, 'GESTOR_MESA');
      } else {
          newLog = createNewLog('SISTEMA', 'Abastecimento finalizado no horário.', 'GESTOR_MESA');
      }
      
      if (flight) {
          logAudit('FINISH_FLIGHT', flight, 'status', flight.status, 'FINALIZADO', { 
            delayJustification,
            hasDelay: !!delayJustification 
          });
      }

      const updated = { 
          ...flight, 
          status: FlightStatus.FINALIZADO, 
          endTime: new Date(),
          delayJustification: delayJustification,
          logs: [...(flight.logs || []), newLog]
      };

      onUpdateFlights(prev => prev.map(f => f.id === id ? updated : f));
      upsertFlight(updated).catch(err => console.error('Error persisting finish:', err));

      addToast(
          delayJustification ? 'ATRASO REGISTRADO' : 'OPERAÇÃO CONCLUÍDA', 
          `Voo ${flightNumber} finalizado${delayJustification ? ' com relatório de atraso' : ''}.`, 
          delayJustification ? 'warning' : 'success'
      );
      setDelayModalFlightId(null);
  };

  const handleSubmitDelay = () => {
      if (delayModalFlightId && delayReasonCode) {
          const flight = flights.find(f => f.id === delayModalFlightId);
          if (flight) {
              const justification = `${delayReasonCode}${delayReasonDetail ? ` - ${delayReasonDetail}` : ''}`;
              confirmFinish(delayModalFlightId, flight.flightNumber, justification);
          }
      }
  };
  
  const handleRemoveStandby = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newLog = createNewLog('MANUAL', 'Removido de Standby. Retomando prioridade.', 'GESTOR_MESA');
      onUpdateFlights(prev => prev.map(f => {
          if (f.id === id) {
              const updated = { 
                  ...f, 
                  isStandby: false, 
                  standbyReason: undefined,
                  logs: [...(f.logs || []), newLog]
              };
              upsertFlight(updated).catch(err => console.error('Error persisting standby removal:', err));
              return updated;
          }
          return f;
      }));
  };

  const handleConfirmVisual = (id: string, flightNumber: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setArchivedIds(prev => new Set(prev).add(id));
      
      const newLog = createNewLog('MANUAL', 'Voo arquivado da visão geral pelo gestor.', 'GESTOR_MESA');
      onUpdateFlights(prev => prev.map(f => f.id === id ? {
          ...f,
          isHiddenFromGrid: true,
          logs: [...(f.logs || []), newLog]
      } : f));
      
      addToast('ARQUIVADO', `Voo ${flightNumber} movido para histórico.`, 'info');
  };

  const handleClearFinished = () => {
      onUpdateFlights(prev => prev.map(f => 
          (f.status === FlightStatus.FINALIZADO || f.status === FlightStatus.CANCELADO) 
              ? { ...f, isHiddenFromGrid: true } 
              : f
      ));
      addToast('HISTÓRICO LIMPO', 'Voos finalizados e cancelados foram arquivados.', 'success');
  };

  const handlePinFlight = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onUpdateFlights(prev => prev.map(f => {
          if (f.id === id) {
              const newLog = createNewLog('MANUAL', f.isPinned ? 'Voo desfixado do topo pelo gestor.' : 'Voo fixado no topo pelo gestor.', 'GESTOR_MESA');
              const updated = { ...f, isPinned: !f.isPinned, logs: [...(f.logs || []), newLog] };
              upsertFlight(updated).catch(err => console.error('Error persisting pin:', err));
              return updated;
          }
          return f;
      }));
      setOpenMenuId(null);
  };

  const handleReforco = (flight: FlightData, e: React.MouseEvent) => {
      e.stopPropagation();
      const newLog = createNewLog('MANUAL', 'Voo redirecionado para REFORÇO (Fila).', 'GESTOR_MESA');
      
      const updated = { 
          ...flight, 
          status: FlightStatus.FILA,
          isReforco: true,
          operator: undefined,
          operatorId: undefined,
          supportOperator: undefined,
          supportOperatorId: undefined,
          designationTime: undefined,
          logs: [...(flight.logs || []), newLog]
      };
      
      onUpdateFlights(prev => prev.map(f => f.id === flight.id ? updated : f));
      upsertFlight(updated).catch(err => console.error('Error persisting reforco status:', err));
      
      addToast('REFORÇO', `Voo ${flight.flightNumber} retornado para a fila.`, 'success');
      setOpenMenuId(null);
  };

  const handleIntentStart = (row: FlightData, e: React.MouseEvent) => {
      e.stopPropagation();
      const pos = row.positionId?.trim();
      if (!pos || pos === '?' || pos === '-') {
          setMissingPositionModalFlight(row);
      } else {
          setConfirmStartModalFlight(row);
      }
      setOpenMenuId(null);
  };

  const handleConfirmStart = (data?: { startTime?: Date }) => {
      if (!confirmStartModalFlight) return;
      handleManualStart(confirmStartModalFlight.id, { stopPropagation: () => {} } as React.MouseEvent, data?.startTime);
      addToast('ABASTECIMENTO INICIADO', `Voo ${confirmStartModalFlight.flightNumber} em abastecimento.`, 'success');
      setConfirmStartModalFlight(null);
  };

  const handleConfirmRemoveOperator = () => {
      if (!confirmRemoveOperatorFlight) return;
      const newLog = createNewLog('MANUAL', 'Operador removido. Voo retornou para a fila.', 'GESTOR_MESA');
      
      const updated = { 
          ...confirmRemoveOperatorFlight, 
          status: FlightStatus.FILA,
          operator: undefined,
          operatorId: undefined,
          supportOperator: undefined,
          supportOperatorId: undefined,
          designationTime: undefined,
          logs: [...(confirmRemoveOperatorFlight.logs || []), newLog]
      };

      onUpdateFlights(prev => prev.map(f => f.id === confirmRemoveOperatorFlight.id ? updated : f));
      upsertFlight(updated).catch(err => console.error('Error persisting operator removal:', err));
      
      addToast('OPERADOR REMOVIDO', `Operador removido do voo ${confirmRemoveOperatorFlight.flightNumber}.`, 'info');
      setConfirmRemoveOperatorFlight(null);
  };

  const handleConfirmFinish = () => {
      if (!confirmFinishModalFlight) return;
      handleManualFinish(confirmFinishModalFlight, { stopPropagation: () => {} } as React.MouseEvent);
      setConfirmFinishModalFlight(null);
  };

  // --- ASSIGNMENT LOGIC ---
  const openAssignModal = (flight: FlightData, e: React.MouseEvent) => {
      e.stopPropagation();
      setAssignModalFlight(flight);
      setSelectedOperatorId(null);
  };

  const confirmAssignment = (opId?: string) => {
      const idToUse = opId || selectedOperatorId;
      if (assignModalFlight && idToUse) {
          const operator = operators.find(op => op.id === idToUse);
          if (!operator) return;

          const newLog = createNewLog('MANUAL', `Operador ${operator.warName} designado manualmente.`, 'GESTOR_MESA');
          
          logAudit('ASSIGN_OPERATOR', assignModalFlight, 'operator', assignModalFlight.operator, operator.warName, { 
              fleet: operator.assignedVehicle, 
              assigned_by: ltName 
          });

          const updated = { 
              ...assignModalFlight, 
              status: FlightStatus.DESIGNADO, 
              operator: operator.warName,
              operatorId: operator.id,
              fleet: operator.assignedVehicle,
              fleetType: operator.assignedVehicle?.startsWith('CTA') ? 'CTA' : operator.assignedVehicle?.startsWith('SRV') ? 'SRV' : undefined,
              designationTime: new Date(),
              assignmentTime: new Date(),
              assignedByLt: ltName,
              logs: [...(assignModalFlight.logs || []), newLog]
          };

          onUpdateFlights(prev => prev.map(f => f.id === assignModalFlight.id ? updated : f));
          upsertFlight(updated).catch(err => console.error('Error persisting operator assignment:', err));

          addToast('DESIGNADO', `Operador ${operator.warName} assumiu voo ${assignModalFlight.flightNumber}.`, 'success');
          setAssignModalFlight(null);
          setSelectedOperatorId(null);
      }
  };


  const confirmSupportAssignment = (opId?: string) => {
      const idToUse = opId || selectedOperatorId;
      if (assignSupportModalFlight && idToUse) {
          const operator = operators.find(op => op.id === idToUse);
          if (!operator) return;

          const newLog = createNewLog('MANUAL', `Op. Apoio ${operator.warName} designado manualmente.`, 'GESTOR_MESA');
          
          logAudit('ASSIGN_SUPPORT_OPERATOR', assignSupportModalFlight, 'supportOperator', assignSupportModalFlight.supportOperator, operator.warName, { 
              fleet: operator.assignedVehicle 
          });

          const updated = { 
              ...assignSupportModalFlight, 
              supportOperator: operator.warName,
              supportOperatorId: operator.id,
              logs: [...(assignSupportModalFlight.logs || []), newLog]
          };

          onUpdateFlights(prev => prev.map(f => f.id === assignSupportModalFlight.id ? updated : f));
          upsertFlight(updated).catch(err => console.error('Error persisting support operator assignment:', err));

          addToast('APOIO DESIGNADO', `Operador ${operator.warName} assumiu como apoio no voo ${assignSupportModalFlight.flightNumber}.`, 'success');
          setAssignSupportModalFlight(null);
          setSelectedOperatorId(null);
      }
  };

  // Filters operators based on Vehicle Compatibility (SRV vs CTA)
  const getEligibleOperators = (flight: FlightData, isSupport: boolean = false) => {
      // Get all active missions to determine status
      const activeMissions = flights.filter(f => f.status !== 'FINALIZADO' && f.status !== 'CANCELADO');

      return operators.map(op => {
          // Find if operator has an active mission in ANOTHER flight
          const mission = activeMissions.find(m => 
              m.id !== flight.id && 
              (m.operator?.toLowerCase() === op.warName.toLowerCase() || m.supportOperator?.toLowerCase() === op.warName.toLowerCase())
          );
          
          let dynamicStatus = op.status;
          if (mission) {
              if (mission.status === 'ABASTECENDO') dynamicStatus = 'OCUPADO'; 
              else if (mission.status === 'DESIGNADO') dynamicStatus = 'DESIGNADO';
              else dynamicStatus = 'OCUPADO';
          }
          
          return { ...op, status: dynamicStatus };
      });
  };

  // OBSERVATION HANDLERS
  const handleOpenObservationModal = (flight: FlightData, e: React.MouseEvent) => {
    e.stopPropagation();
    setObservationModalFlight(flight);
    setNewObservation(''); 
    setOpenMenuId(null);
  };

  const handleSaveObservation = () => {
    if (observationModalFlight && newObservation.trim()) {
      const newLog = createNewLog('OBSERVACAO', newObservation.trim(), 'GESTOR_MESA');
      const updated = { ...observationModalFlight, logs: [...(observationModalFlight.logs || []), newLog] };
      
      onUpdateFlights(prev => prev.map(f => 
        f.id === observationModalFlight.id ? updated : f
      ));
      upsertFlight(updated).catch(err => console.error('Error persisting observation:', err));
      
      addToast('OBSERVAÇÃO REGISTRADA', `Nota adicionada ao voo ${observationModalFlight.flightNumber}.`, 'success');
      setObservationModalFlight(null);
      setNewObservation('');
    }
  };

  // --- HELPER RENDERS ---
  const getDynamicStatus = (f: FlightData): any => {
    const minutesToETA = getMinutesDiff(f.eta, f.date);
    const minutesToETD = getMinutesDiff(f.etd, f.date);

    if (activeTab === 'GERAL') {
        const baseStatusMap: Record<FlightStatus, string> = {
            [FlightStatus.CHEGADA]: 'CHEGADA',
            [FlightStatus.FILA]: 'FILA',
            [FlightStatus.DESIGNADO]: 'DESIGNADO',
            [FlightStatus.AGUARDANDO]: 'AGUARDANDO',
            [FlightStatus.ABASTECENDO]: 'ABASTECENDO',
            [FlightStatus.FINALIZADO]: 'FINALIZADO',
            [FlightStatus.CANCELADO]: 'CANCELADO',
            [FlightStatus.PRÉ]: 'PRÉ',
        };
        const stLabel = baseStatusMap[f.status] || f.status;
        return {
            label: stLabel,
            color: isDarkMode ? 'text-slate-300 bg-slate-800 border-slate-700' : 'text-slate-700 bg-slate-200 border-slate-400'
        };
    }

    if (f.status === FlightStatus.FINALIZADO || f.status === FlightStatus.CANCELADO) {
        if (activeTab === 'FINALIZADO') {
            if (f.status === FlightStatus.CANCELADO) return { 
                label: 'CANCELADO', 
                color: isDarkMode ? 'text-red-400 bg-red-500/10 border-red-500/30' : 'text-red-600 bg-red-50 border-red-200' 
            };
            const hasSwap = f.logs.some(l => l.message.toLowerCase().includes('troca') || l.message.toLowerCase().includes('swap'));
            if (hasSwap) return { 
                label: 'COM TROCA', 
                color: isDarkMode ? 'text-purple-400 bg-purple-500/10 border-purple-500/30' : 'text-purple-600 bg-purple-50 border-purple-200' 
            };
            if (checkIsDelayed(f) || f.delayJustification) return { 
                label: 'COM ATRASO', 
                color: isDarkMode ? 'text-amber-500 bg-amber-500/10 border-amber-500/30' : 'text-amber-600 bg-amber-50 border-amber-200' 
            };
            return { 
                label: 'COM SUCESSO', 
                color: isDarkMode ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-emerald-600 bg-emerald-50 border-emerald-200' 
            };
        }
    }

    if (f.status === FlightStatus.CHEGADA) {
        if (f.isOnGround && f.positionId) return { 
            label: 'CALÇADA', 
            color: isDarkMode ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-emerald-600 bg-emerald-50 border-emerald-200' 
        };
        if (f.isOnGround) return { 
            label: 'SOLO', 
            color: isDarkMode ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' : 'text-indigo-600 bg-indigo-50 border-indigo-200' 
        };
        if (minutesToETA < 10) return { 
            label: 'APROXIMAÇÃO', 
            color: isDarkMode ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-amber-600 bg-amber-50 border-amber-200' 
        };
        const h = Math.floor(minutesToETA / 60);
        const m = Math.floor(minutesToETA % 60);
        return { 
            label: `${h}H ${m}M`, 
            color: isDarkMode ? 'text-slate-400 bg-slate-800/50 border-slate-700' : 'text-slate-600 bg-slate-100 border-slate-300' 
        };
    }

    if (f.status === FlightStatus.FILA) {
        if (f.isReforco) return {
            label: 'REFORÇO',
            color: isDarkMode ? 'text-purple-400 bg-purple-500/10 border-purple-400/50' : 'text-purple-600 bg-purple-50 border-purple-200'
        };
        if (f.isStandby) return { 
            label: 'STAND-BY', 
            color: isDarkMode ? 'text-slate-400 bg-slate-800 border-slate-600' : 'text-slate-600 bg-slate-100 border-slate-300' 
        };
        
        const absMins = Math.abs(minutesToETD);
        const h = Math.floor(absMins / 60);
        const m = Math.floor(absMins % 60);
        const displayTime = minutesToETD >= 60 || minutesToETD <= -60 ? `${h}h ${m}m${minutesToETD < 0 ? ' ATRASO' : ''}` : `${minutesToETD < 0 ? absMins + 'm ATRASO' : minutesToETD + ' min'}`;

        if (minutesToETD <= -60) return {
            label: 'RETIDO (+1H)',
            subtitle: displayTime,
            color: isDarkMode ? 'text-slate-500 bg-slate-900 border-slate-700/50' : 'text-slate-500 bg-slate-200 border-slate-300',
            rowClass: isDarkMode ? '[&>td]:!bg-slate-900/40 [&>td]:!border-slate-800/50 [&>td]:opacity-60' : '[&>td]:!bg-slate-100 [&>td]:!border-slate-200 [&>td]:opacity-60'
        };

        if (minutesToETD < 20) return { 
            label: 'PENALTY', 
            subtitle: displayTime,
            color: 'text-white bg-black border-red-500',
            rowClass: isDarkMode ? '[&>td]:!bg-red-950/40 [&>td]:!border-red-900/50' : '[&>td]:!bg-red-100 [&>td]:!border-red-300'
        };
        if (minutesToETD < 30) return { 
            label: 'ATRASANDO', 
            subtitle: displayTime,
            color: isDarkMode ? 'text-red-500 bg-red-900/50 border-red-500' : 'text-red-700 bg-red-100 border-red-500',
            rowClass: isDarkMode ? '[&>td]:!bg-red-900/40 [&>td]:!border-red-800/30' : '[&>td]:!bg-red-50 [&>td]:!border-red-200'
        };
        if (minutesToETD < 40) return { 
            label: 'ATRASANDO', 
            subtitle: displayTime,
            color: isDarkMode ? 'text-amber-500 bg-amber-900/50 border-amber-500' : 'text-amber-800 bg-amber-100 border-amber-500',
            rowClass: isDarkMode ? '[&>td]:!bg-amber-900/20 [&>td]:!border-amber-800/30' : '[&>td]:!bg-yellow-50 [&>td]:!border-yellow-200'
        };
        return { 
            label: 'FILA', 
            subtitle: displayTime,
            color: isDarkMode ? 'text-blue-400 bg-blue-500/10 border-blue-400/50' : 'text-blue-600 bg-blue-50 border-blue-200' 
        };
    }

    if (f.status === FlightStatus.PRÉ) {
        if (!f.operator) return { 
            label: 'PRÉ', 
            color: isDarkMode ? 'text-blue-300 bg-blue-500/20 border-blue-400' : 'text-blue-700 bg-blue-50 border-blue-400' 
        };
        
        // Se tem operador, segue a mesma lógica de designado (A caminho, acoplando...)
        const elapsed = f.designationTime ? (new Date().getTime() - new Date(f.designationTime).getTime()) / 60000 : 0;
        const isDelayed = minutesToETD < 30; // Atraso ou Penalty
        const delayedColor = isDarkMode ? 'text-red-500 bg-red-900/40 border-red-500/50' : 'text-red-700 bg-red-100 border-red-400';
        const delayedRowClass = isDarkMode ? '[&>td]:!bg-red-950/30 [&>td]:!border-red-900/40' : '[&>td]:!bg-red-50 [&>td]:!border-red-200';
        
        let targetLabel = 'A CAMINHO';
        let targetColor = isDarkMode ? 'text-indigo-400 bg-indigo-500/10 border-indigo-400' : 'text-indigo-600 bg-indigo-50 border-indigo-200';
        
        const hasPosition = f.positionId && f.positionId !== '?' && f.positionId.trim() !== '';

        if (!hasPosition) {
            if (elapsed > 5) {
                targetLabel = 'AGUARDANDO';
                targetColor = isDarkMode ? 'text-amber-500 bg-amber-500/10 border-amber-500' : 'text-amber-600 bg-amber-50 border-amber-200';
            }
        } else {
            if (elapsed > 10) {
                targetLabel = 'ACOPLADO';
                targetColor = isDarkMode ? 'text-blue-500 bg-blue-900/40 border-blue-500' : 'text-blue-700 bg-blue-100 border-blue-300';
            } else if (elapsed > 5) {
                targetLabel = 'ACOPLANDO';
                targetColor = isDarkMode ? 'text-blue-400 bg-blue-500/10 border-blue-400' : 'text-blue-600 bg-blue-50 border-blue-200';
            }
        }
        
        return { 
            label: targetLabel, 
            color: isDelayed ? delayedColor : targetColor,
            rowClass: isDelayed ? delayedRowClass : undefined
        };
    }

    if (f.status === FlightStatus.DESIGNADO) {
        const elapsed = f.designationTime ? (new Date().getTime() - new Date(f.designationTime).getTime()) / 60000 : 0;
        const isDelayed = minutesToETD < 30; // Atraso ou Penalty
        const delayedColor = isDarkMode ? 'text-red-500 bg-red-900/40 border-red-500/50' : 'text-red-700 bg-red-100 border-red-400';
        const delayedRowClass = isDarkMode ? '[&>td]:!bg-red-950/30 [&>td]:!border-red-900/40' : '[&>td]:!bg-red-50 [&>td]:!border-red-200';
        
        let targetLabel = 'A CAMINHO';
        let targetColor = isDarkMode ? 'text-indigo-400 bg-indigo-500/10 border-indigo-400' : 'text-indigo-600 bg-indigo-50 border-indigo-200';
        
        const hasPosition = f.positionId && f.positionId !== '?' && f.positionId.trim() !== '';

        if (!hasPosition) {
            if (elapsed > 5) {
                targetLabel = 'AGUARDANDO';
                targetColor = isDarkMode ? 'text-amber-500 bg-amber-500/10 border-amber-500' : 'text-amber-600 bg-amber-50 border-amber-200';
            }
        } else {
            if (elapsed > 10) {
                targetLabel = 'ACOPLADO';
                targetColor = isDarkMode ? 'text-blue-500 bg-blue-900/40 border-blue-500' : 'text-blue-700 bg-blue-100 border-blue-300';
            } else if (elapsed > 5) {
                targetLabel = 'ACOPLANDO';
                targetColor = isDarkMode ? 'text-blue-400 bg-blue-500/10 border-blue-400' : 'text-blue-600 bg-blue-50 border-blue-200';
            }
        }
        
        return { 
            label: targetLabel, 
            color: isDelayed ? delayedColor : targetColor,
            rowClass: isDelayed ? delayedRowClass : undefined
        };
    }

    if (f.status === FlightStatus.ABASTECENDO) {
        const isDelayed = minutesToETD <= 0;
        
        // Regra especial para voos PRÉ: 25 minutos de abastecimento -> CONFIRMAR
        const isPreFlight = f.etd === 'PRÉ' || f.logs.some(l => l.message.includes('PRÉ'));
        const startTime = f.startTime ? new Date(f.startTime).getTime() : 0;
        const fuelingElapsed = startTime ? (new Date().getTime() - startTime) / 60000 : 0;
        
        if (isPreFlight && fuelingElapsed >= 25) {
            return { 
                label: 'CONFIRMAR', 
                color: isDarkMode ? 'text-emerald-400 bg-emerald-500/20 border-emerald-500 animate-bounce' : 'text-emerald-700 bg-emerald-50 border-emerald-500 animate-bounce' 
            };
        }

        // Finalizando se: faltam menos de 10 min OU se já passou de 90% do volume
        const isFinalizando = (minutesToETD < 10 && minutesToETD > 0) || (f.fuelStatus > 90);
        
        let label = 'ABASTECENDO';
        let color = isDarkMode ? 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30' : 'text-emerald-600 bg-emerald-50 border-emerald-200';
        
        if (isFinalizando) {
            label = 'FINALIZANDO';
            color = isDarkMode ? 'text-blue-300 bg-blue-500/20 border-blue-300' : 'text-blue-700 bg-blue-50 border-blue-300';
        }
        
        if (isDelayed) {
            color = isDarkMode ? 'text-white bg-red-600 border-red-500' : 'text-white bg-red-700 border-red-600';
        }
        
        return { label, color };
    }

    return null;
  };

  const SortableHeader = ({ label, columnKey, className = "" }: { label: string, columnKey: keyof FlightData, className?: string }) => {
    const isActive = sortConfig.key === columnKey;
    return (
      <th 
        className={`px-1 py-1.5 sticky top-0 cursor-pointer select-none transition-all group z-[40] grid-ops-header-th border-b ${isDarkMode ? 'bg-slate-950 border-slate-700/50 shadow-sm' : 'bg-[#2D8E48] border-[#29824a] text-white shadow-none'} ${className}`}
        onClick={() => handleSort(columnKey)}
      >
        <div className={`flex items-center gap-1 ${className.includes('text-center') ? 'justify-center' : 'justify-start'}`}>
          <span className={`font-black text-[9px] uppercase tracking-wider transition-colors ${isActive ? (isDarkMode ? 'text-emerald-400' : 'text-slate-100') : (isDarkMode ? 'text-white' : 'text-white')}`}>
            {label}
          </span>
          <div className="flex items-center justify-center transition-all">
            {isActive ? (
                sortConfig.direction === 'asc' ? <ArrowUp size={10} className={isDarkMode ? "text-emerald-500" : "text-slate-100"} /> : <ArrowDown size={10} className={isDarkMode ? "text-emerald-500" : "text-slate-100"} />
            ) : <ArrowUpDown size={8} className={isDarkMode ? "text-white/20 group-hover:text-white/60" : "text-slate-200 group-hover:text-white"} />}
          </div>
        </div>
      </th>
    );
  };

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [optionsPortalTarget, setOptionsPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.getElementById('subheader-portal-target'));
    setOptionsPortalTarget(document.getElementById('header-options-portal-target'));
  }, []);

  useEffect(() => {
      if (pendingAction === 'CREATE') {
          setIsCreateModalOpen(true);
          if (setPendingAction) setPendingAction(null);
      } else if (pendingAction === 'IMPORT') {
          setIsImportModalOpen(true);
          if (setPendingAction) setPendingAction(null);
      }
  }, [pendingAction, setPendingAction]);

  // Animação de sincronização removida a pedido do usuário

  const optionsDropdownContent = (
    <div className="relative" ref={optionsMenuRef}>
        <button 
            onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setOptionsMenuRect(rect);
                setShowOptionsDropdown(!showOptionsDropdown);
            }}
            className={`flex items-center gap-2 px-6 py-2 rounded-md border border-[#FEDC00] transition-all font-bold uppercase tracking-wider text-[11px] bg-[#FEDC00] text-[#4e4141] hover:bg-[#e5c600] shadow-sm`}
        >
            <span>Opções</span>
            <Settings size={14} />
        </button>

        {showOptionsDropdown && optionsMenuRect && createPortal(
            <div 
                ref={optionsMenuRef}
                style={{ top: optionsMenuRect.bottom + 8, left: optionsMenuRect.right - 224 }}
                className={`fixed w-56 ${isDarkMode ? "bg-slate-900 border-emerald-500/30 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]" : "bg-white border-emerald-500/30 shadow-xl"} border rounded-xl z-[9999] overflow-hidden animate-in fade-in slide-in-from-top-2`}
            >
                <div className="p-1.5 space-y-0.5">
                    <div className="px-3 py-2 border-b border-white/5 mb-1">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Ações da Malha</span>
                    </div>
                    <button 
                        onClick={() => {
                            if (onUpdateFlights && meshFlights) {
                                onUpdateFlights(prev => {
                                    // Manter voos existentes que já foram processados
                                    const existingIds = new Set(prev.map(f => f.id));
                                    const newFlights = meshFlights.map(m => {
                                        if (existingIds.has(m.id)) return prev.find(f => f.id === m.id)!;
                                        return {
                                            id: m.id,
                                            flightNumber: '--',
                                            departureFlightNumber: m.departureFlightNumber,
                                            airline: m.airline,
                                            airlineCode: m.airlineCode,
                                            model: m.model || '',
                                            registration: m.registration || '',
                                            origin: '',
                                            destination: m.destination,
                                            eta: m.eta || '--:--',
                                            etd: m.etd,
                                            actualArrivalTime: m.actualArrivalTime,
                                            positionId: m.positionId || '',
                                            status: FlightStatus.CHEGADA,
                                            logs: []
                                        };
                                    });
                                    return newFlights as any[]; // Type cast handled by external context
                                });
                                addToast('SINCRONIZAÇÃO', 'Voos da Malha Base sincronizados!', 'success');
                            }
                            setShowOptionsDropdown(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isDarkMode ? 'text-slate-300 hover:bg-emerald-500/10 hover:text-emerald-400' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-600'}`}
                    >
                        <RefreshCw size={14} />
                        Sincronizar Dados
                    </button>
                    <button 
                        onClick={() => {
                            const dateStr = getDisplayDate(activeDateOffset);
                            const headers = ['COMP', 'V.SAIDA', 'ICAO', 'CID', 'PREFIXO', 'POS', 'ETD', 'CALCO', 'ETA', 'OPERADOR', 'FROTA', 'FRT.TIPO', 'STATUS', 'VOLUME'];
                            const rows = visibleFlights.map(f => [
                                f.airline || '', f.departureFlightNumber || '', f.destination || '', ICAO_CITIES[f.destination] || 'EXTERIOR',
                                f.registration || '', f.positionId || '', f.etd || '', f.actualArrivalTime || '?', f.eta || '?',
                                f.operator || '', f.fleet || '', f.fleetType || '', f.status || '', f.volume || ''
                            ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));
                            const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + '\n' + rows.join('\n');
                            const encodedUri = encodeURI(csvContent);
                            const link = document.createElement("a");
                            link.setAttribute("href", encodedUri);
                            link.setAttribute("download", `malha_${dateStr.replace(/\s+/g, '_')}.csv`);
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            setShowOptionsDropdown(false);
                            addToast('EXPORTAÇÃO', 'Exportação para CSV iniciada com sucesso.', 'success');
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        <FileBarChart size={14} />
                        Exportar Malha (CSV)
                    </button>
                    <button 
                        onClick={() => {
                            handleClearFinished();
                            setShowOptionsDropdown(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isDarkMode ? 'text-slate-300 hover:bg-red-500/10 hover:text-red-400' : 'text-slate-600 hover:bg-red-50 hover:text-red-400'}`}
                    >
                        <Archive size={14} />
                        Arquivar Finalizados
                    </button>
                    <button 
                        onClick={() => {
                            setShowClearAllConfirm(true);
                            setShowOptionsDropdown(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isDarkMode ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300' : 'text-red-600 hover:bg-red-50 hover:text-red-700'}`}
                    >
                        <Trash2 size={14} />
                        Limpar Malha Oper.
                    </button>
                </div>
            </div>,
            document.body
        )}
    </div>
  );

  const subheaderContent = (
      <div className={`px-6 h-16 shrink-0 flex items-center justify-between border-b ${isDarkMode ? "bg-slate-950 border-slate-800" : "bg-[#3CA317] border-transparent text-white shadow-[0_2px_8px_rgba(0,0,0,0.5)]"} z-20 w-full`}>
        <div className="flex items-center gap-6 h-full">
            <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-sm font-black text-white tracking-tighter uppercase leading-none">MALHA OPER.</h2>
                </div>
            </div>

            <div className="flex items-center ml-2 bg-black/20 p-0.5 rounded border border-white/10 h-8">
                <button 
                  onClick={() => setActiveDateOffset(prev => prev - 1)}
                  className="px-1.5 py-1 flex items-center justify-center text-white hover:bg-white/10 rounded transition-colors"
                >
                    <ChevronLeft size={14} strokeWidth={2.5} />
                </button>
                <div className="px-2 flex items-center gap-1.5 relative overflow-visible group hover:bg-white/5 rounded cursor-pointer transition-colors h-full">
                    <div 
                      className="flex items-center gap-1.5 w-full h-full"
                      onClick={() => setShowCalendar(!showCalendar)}
                    >
                      <CalendarDays size={13} className="text-emerald-400 group-hover:text-emerald-300 transition-colors" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-white whitespace-nowrap text-center group-hover:text-emerald-50 transition-colors">
                          {getDisplayDate(activeDateOffset)}
                      </span>
                    </div>
                    {showCalendar && (
                      <InlineCalendar 
                        currentOffset={activeDateOffset}
                        onSelectOffset={(offset) => {
                          setActiveDateOffset(offset);
                          setShowCalendar(false);
                        }}
                        onClose={() => setShowCalendar(false)}
                        isDarkMode={isDarkMode}
                      />
                    )}
                </div>
                <button 
                  onClick={() => setActiveDateOffset(prev => prev + 1)}
                  className="px-1.5 py-1 flex items-center justify-center text-white hover:bg-white/10 rounded transition-colors"
                >
                    <ChevronRight size={14} strokeWidth={2.5} />
                </button>
            </div>

            <div className="flex items-center gap-2 ml-4 bg-black/20 p-1 rounded border border-white/10 w-[270px] h-10">
                {(['TODOS', 'MANHA', 'TARDE', 'NOITE'] as MeshShift[]).map(shift => (
                    <button
                        key={shift}
                        onClick={() => setActiveShift(shift)}
                        className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all h-full ${activeShift === shift ? 'bg-emerald-500 text-white flex-1' : 'text-emerald-100/50 hover:text-white flex-1'}`}
                    >
                        {shift}
                    </button>
                ))}
            </div>
          </div>

          <div className="flex items-center gap-4 mr-6">
              <div className="relative w-[280px] h-9">
                <div className={`absolute inset-0 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-white/20 text-slate-900'} shadow-sm border rounded flex items-center transition-all`}>
                    <Search size={14} className={`shrink-0 ml-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`} />
                    <input 
                        type="text" 
                        placeholder="Pesquise..." 
                        className={`bg-transparent border-none outline-none text-[10px] ${isDarkMode ? 'text-slate-200 placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'} font-mono uppercase w-full px-3 transition-all h-full rounded`}
                        value={globalSearchTerm}
                        onChange={(e) => onUpdateSearch && onUpdateSearch(e.target.value)}
                    />
                    {globalSearchTerm && (
                        <button 
                            onClick={() => onUpdateSearch && onUpdateSearch('')}
                            className={`p-1.5 mr-1 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>
            {optionsDropdownContent}
        </div>
      </div>
  );

  return (
    <div className={`w-full h-full flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'} overflow-hidden selection:bg-emerald-500/30 font-sans relative`}>
      
      {/* HEADER E TABS */}
      {portalTarget ? createPortal(subheaderContent, portalTarget) : subheaderContent}
      <div className={`h-12 shrink-0 flex border-b ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'} z-30 overflow-hidden`}>
        <nav className="flex w-full">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            data-active={isActive ? "true" : "false"}
                            className={`
                                table-tab-btn
                                flex-1 h-full px-2 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-r ${isDarkMode ? 'border-slate-950/20' : 'border-slate-200'} last:border-r-0
                                ${isActive 
                                    ? (isDarkMode ? 'bg-slate-950 text-emerald-400 border-b-2 border-emerald-500' : 'bg-[#329858] text-white border-b-0')
                                    : (isDarkMode ? 'text-slate-500 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')}
                            `}
                        >
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className={`flex items-center justify-center px-1.5 min-w-[18px] h-4 text-[9px] font-black rounded-sm ${isActive ? (isDarkMode ? 'bg-emerald-500 text-slate-950' : 'bg-white text-[#2D8E48]') : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')}`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>
          </div>

      {/* GRID CONTAINER */}
      <div className={`flex-1 min-w-0 overflow-hidden relative ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
            <div className="w-full h-full overflow-auto min-w-0 custom-scrollbar relative">
              <table ref={tableRef} className="w-full text-left border-separate border-spacing-0 grid-ops-table">
                  <thead className={`grid-ops-thead sticky top-0 z-40 shadow-sm ${isDarkMode ? 'bg-slate-950' : 'bg-[#2D8E48]'}`}>
                      <tr id="grid-header-container" className="h-10">
                    {/* LAYOUT CONDICIONAL DE COLUNAS */}
                    {activeTab === 'FILA' ? (
                        <>
                            <SortableHeader label="COMP." columnKey="airlineCode" className="text-center w-16" />
                            <SortableHeader label="V.SAÍDA" columnKey="departureFlightNumber" className="text-center w-20" />
                            <SortableHeader label="ICAO" columnKey="destination" className="text-center w-16" />
                            <SortableHeader label="CID" columnKey="destination" className="text-center w-20" />
                            <SortableHeader label="PREFIXO" columnKey="registration" className="text-center w-20" />
                            <SortableHeader label="POS" columnKey="positionId" className="text-center w-16" />
                            <SortableHeader label="ETD" columnKey="etd" className="text-center w-16" />
                            <SortableHeader label="CALÇO" columnKey="actualArrivalTime" className="text-center w-16" />
                            <SortableHeader label="ETA" columnKey="eta" className="text-center w-16" />
                            <SortableHeader label="OPERADOR" columnKey="operator" className="text-left pl-2 w-32" />
                            <SortableHeader label="FROTA" columnKey="fleet" className="text-center w-16" />
                            <SortableHeader label="FRT.TIPO" columnKey="fleet" className="text-center w-20" />
                        </>
                    ) : isStreamlinedView ? (
                        <>
                            <SortableHeader label="COMP." columnKey="airlineCode" className="text-center w-16" />
                            <SortableHeader label="V.SAÍDA" columnKey="departureFlightNumber" className="text-center w-20" />
                            <SortableHeader label="ICAO" columnKey="destination" className="text-center w-16" />
                            <SortableHeader label="CID" columnKey="destination" className="text-center w-20" />
                            <SortableHeader label="PREFIXO" columnKey="registration" className="text-center w-20" />
                            <SortableHeader label="POS" columnKey="positionId" className="text-center w-16" />
                            <SortableHeader label="CALÇO" columnKey="actualArrivalTime" className="text-center w-16" />
                            <SortableHeader label="ETD" columnKey="etd" className="text-center w-16" />
                            <SortableHeader label="OPERADOR" columnKey="operator" className="text-left pl-2 w-32" />
                            <SortableHeader label="FROTA" columnKey="fleet" className="text-center w-16" />
                            <SortableHeader label="FRT.TIPO" columnKey="fleet" className="text-center w-20" />
                            <th className={`px-1 py-1 sticky top-0 text-center z-50 grid-ops-header-th border-b ${isDarkMode ? 'bg-slate-950 border-slate-700/50 shadow-sm' : 'bg-[#2D8E48] border-[#29824a] text-white shadow-none'} w-16`}>
                                <div className="flex items-center justify-center gap-1.5">
                                    <span className={`font-black text-[9px] uppercase tracking-wider text-white`}>
                                        REPORT
                                    </span>
                                </div>
                            </th>
                            {activeTab === 'DESIGNADOS' && (
                                <>
                                    <SortableHeader label="HR.D" columnKey="assignmentTime" className="text-center w-16" />
                                    <SortableHeader label="LT" columnKey="assignedByLt" className="text-left pl-2 w-28" />
                                </>
                            )}

                        </>
                    ) : isFinishedView ? (
                        <>
                            <SortableHeader label="COMP." columnKey="airlineCode" className="text-center w-16" />
                            <SortableHeader label="PREFIXO" columnKey="registration" className="text-center w-20" />
                            <SortableHeader label="V.SAÍDA" columnKey="departureFlightNumber" className="text-center w-20" />
                            <SortableHeader label="ICAO" columnKey="destination" className="text-center w-16" />
                            <SortableHeader label="CID" columnKey="destination" className="text-center w-20" />
                            <SortableHeader label="POS" columnKey="positionId" className="text-center w-16" />
                            <SortableHeader label="CALÇO" columnKey="actualArrivalTime" className="text-center w-16" />
                            <SortableHeader label="ETD" columnKey="etd" className="text-center w-16" />
                            <SortableHeader label="OPERADOR" columnKey="operator" className="text-left pl-2 w-32" />
                            <SortableHeader label="FROTA" columnKey="fleet" className="text-center w-16" />
                            <SortableHeader label="FRT.TIPO" columnKey="fleet" className="text-center w-20" />
                            <th className={`px-1 py-1 sticky top-0 text-center z-50 grid-ops-header-th border-b ${isDarkMode ? 'bg-slate-950 border-slate-700/50 shadow-sm' : 'bg-[#2D8E48] border-[#29824a] text-white shadow-none'} w-16`}>
                                <div className="flex items-center justify-center gap-1.5">
                                    <span className={`font-black text-[9px] uppercase tracking-wider text-white`}>
                                        REPORT
                                    </span>
                                </div>
                            </th>
                            <th className={`px-1 py-1 sticky top-0 text-center z-50 grid-ops-header-th border-b ${isDarkMode ? 'bg-slate-950 border-slate-700/50 shadow-sm' : 'bg-[#2D8E48] border-[#29824a] text-white shadow-none'} w-16`}>
                                <div className="flex items-center justify-center gap-1.5">
                                    <span className={`font-black text-[9px] uppercase tracking-wider text-white`}>
                                        TAB
                                    </span>
                                </div>
                            </th>

                        </>
                    ) : (
                        <>
                            <SortableHeader label="COMP." columnKey="airlineCode" className="text-center w-16" />
                            <SortableHeader label="PREFIXO" columnKey="registration" className="text-center w-20" />
                            <SortableHeader label="MODELO" columnKey="model" className="text-center w-16" />
                            <SortableHeader label="V.CHEG" columnKey="flightNumber" className="text-center w-20" />
                            <SortableHeader label="ETA" columnKey="eta" className="text-center w-16" />
                            <SortableHeader label="V.SAÍDA" columnKey="departureFlightNumber" className="text-center w-20" />
                            <SortableHeader label="ICAO" columnKey="destination" className="text-center w-16" />
                            <SortableHeader label="CID" columnKey="destination" className="text-center w-20" />
                            <SortableHeader label="POS" columnKey="positionId" className="text-center w-16" />
                            <SortableHeader label="CALÇO" columnKey="actualArrivalTime" className="text-center w-16" />
                            <SortableHeader label="ETD" columnKey="etd" className="text-center w-16" />
                            <SortableHeader label="OPERADOR" columnKey="operator" className="text-left pl-2 w-32" />
                            <SortableHeader label="FROTA" columnKey="fleet" className="text-center w-16" />
                            <SortableHeader label="FRT.TIPO" columnKey="fleet" className="text-center w-20" />

                        </>
                    )}
                      
                      {activeTab === 'DESIGNADOS' ? (
                        <SortableHeader label="STATUS" columnKey="status" className="text-center w-36" />
                      ) : (
                        <SortableHeader label="STATUS" columnKey="status" className="text-center w-24" />
                      )}

                      <th className={`px-1 py-1 sticky top-0 text-center z-50 grid-ops-header-th border-b ${isDarkMode ? 'bg-slate-950 border-slate-700/50 shadow-sm' : 'bg-[#2D8E48] border-[#29824a] text-white shadow-none'} group w-16`}>
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`font-black text-[9px] uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-white'}`}>
                            AÇÕES
                          </span>
                        </div>
                      </th>
                  </tr>
              </thead>
              <tbody className="text-[11px] font-bold">
                  {sortedData.map((row, rowIndex) => {
                      const dynamicStatus = getDynamicStatus(row);
                      const isInactiveRow = row.status === FlightStatus.FINALIZADO || row.status === FlightStatus.CANCELADO;
                      
                      const renderReportCell = (flight: FlightData) => {
                          const latest = getLatestReportItem(flight);
                          if (!latest) {
                              return (
                                  <td className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all text-center`}>
                                      <span className="text-slate-300">-</span>
                                  </td>
                              );
                          }
                          return (
                              <td 
                                className={`px-1 py-1 border-y border-l cursor-pointer ${isDarkMode ? 'border-slate-700/50 hover:bg-slate-700 bg-gradient-to-b from-slate-800/50 to-slate-900/80' : 'border-slate-200 hover:bg-slate-100 bg-white'} transition-all text-center`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onOpenReport) {
                                        onOpenReport(flight);
                                    }
                                }}
                                title="Ver Relatório"
                              >
                                  <div className={`inline-flex flex-col items-center justify-center rounded px-1.5 py-[2px] ${latest.bg}`}>
                                      <span className={`text-[8px] font-black tracking-widest ${latest.color} leading-none`}>{latest.label}</span>
                                      <span className={`text-[10px] font-mono font-bold ${latest.color} leading-tight mb-0.5`}>{latest.time}</span>
                                  </div>
                              </td>
                          );
                      };

                      return (
                      <tr 
                          key={row.id} 
                          data-rowindex={rowIndex}
                          onContextMenu={(e) => {
                              e.preventDefault();
                              setSelectedFlight(row);
                          }}
                          className={`h-10 cursor-pointer transition-all active:scale-[0.99] group shadow-sm rounded-[4px] ${isInactiveRow ? 'opacity-40 grayscale' : ''} ${dynamicStatus?.rowClass ? dynamicStatus.rowClass : (isDarkMode ? '' : 'hover:bg-slate-50')}`}
                      >
                          {/* AIRLINE */}
                          {renderEditableCell(row, 'airlineCode', row.airlineCode, "justify-start text-left first:rounded-l-[4px]", rowIndex, 0, false)}

                          {/* RENDERIZAÇÃO CONDICIONAL DAS CÉLULAS */}
                          {activeTab === 'FILA' ? (
                            <>
                                {/* FLIGHT OUT */}
                                {renderEditableCell(row, 'departureFlightNumber', row.departureFlightNumber || '', "text-center font-mono tracking-tighter", rowIndex, 1)}

                                {/* ICAO */}
                                {renderEditableCell(row, 'destination', row.destination, `text-center font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} font-bold text-[10px]`, rowIndex, 2, false)}

                                {/* CITY */}
                                <td className={`px-1 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all text-center font-black text-[9px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-tight`}>
                                    {ICAO_CITIES[row.destination] || 'EXTERIOR'}
                                </td>

                                {/* REGISTRATION */}
                                {renderEditableCell(row, 'registration', row.registration, "text-center font-mono text-emerald-500 tracking-tighter uppercase", rowIndex, 3)}

                                {/* POSITION */}
                                {renderEditableCell(row, 'positionId', row.positionId, "text-center font-mono text-[12px]", rowIndex, 4)}

                                {/* ETD */}
                                {renderEditableCell(row, 'etd', row.etd, "text-center font-mono text-emerald-400", rowIndex, 6)}

                                {/* CALÇO (ATA) */}
                                {renderEditableCell(row, 'actualArrivalTime', row.actualArrivalTime || '', "text-center font-mono font-black", rowIndex, 5)}

                                {/* ETA */}
                                {renderEditableCell(row, 'eta', row.eta || '', "text-center font-mono text-emerald-400 font-black tracking-widest", rowIndex, 99)}

                                {/* OPERATOR (WITH ASSIGN BUTTON) */}
                                <td className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all text-left align-middle overflow-visible`}>
                                    <div className="relative w-full h-full flex flex-col justify-center">
                                      {row.operator ? (
                                          <div className="flex items-center justify-start w-full cursor-pointer" onClick={(e) => { e.stopPropagation(); setAssignModalFlight(row); }}>
                                              <OperatorCell operatorName={row.operator} operators={operators} />
                                          </div>
                                      ) : (
                                          <button 
                                              onClick={(e) => { e.stopPropagation(); setAssignModalFlight(row); }}
                                              className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1.5 rounded shadow-lg shadow-indigo-600/20 transition-all active:scale-95 w-full mx-auto"
                                          >
                                              <UserPlus size={12} />
                                              <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">Designar</span>
                                          </button>
                                      )}
                                    </div>
                                </td>

                                {/* FLEET */}
                                {renderEditableCell(row, 'fleet', row.fleet ? row.fleet.replace('CTA-', '').replace('SRV-', '') : '', "text-center font-mono text-[10px]", rowIndex, 7, false)}

                                {/* FLEET TYPE */}
                                {renderEditableCell(row, 'fleetType', row.fleetType || '', "text-center font-mono text-[10px]", rowIndex, 8, false)}
                            </>
                          ) : isStreamlinedView ? (
                            <>
                                {/* FLIGHT OUT */}
                                {renderEditableCell(row, 'departureFlightNumber', row.departureFlightNumber || '', "text-center font-mono tracking-tighter", rowIndex, 1)}

                                {/* ICAO */}
                                {renderEditableCell(row, 'destination', row.destination, `text-center font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} font-bold text-[10px]`, rowIndex, 2, false)}

                                {/* CITY (Not directly editable, derived from destination) */}
                                <td className={`px-1 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all text-center font-black text-[9px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-tight`}>
                                    {ICAO_CITIES[row.destination] || 'EXTERIOR'}
                                </td>

                                {/* REGISTRATION */}
                                {renderEditableCell(row, 'registration', row.registration, "text-center font-mono text-emerald-500 tracking-tighter uppercase", rowIndex, 3)}

                                {/* POSITION */}
                                {renderEditableCell(row, 'positionId', row.positionId, "text-center font-mono text-[12px]", rowIndex, 4)}

                                {/* CALÇO (ATA) */}
                                {renderEditableCell(row, 'actualArrivalTime', row.actualArrivalTime || '', "text-center font-mono font-black", rowIndex, 5)}

                                {/* ETD */}
                                {renderEditableCell(row, 'etd', row.etd, "text-center font-mono text-emerald-400", rowIndex, 6)}

                                {/* OPERATOR (WITH ASSIGN BUTTON) */}
                                <td className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all text-left align-middle overflow-visible`}>
                                    <div className="relative w-full h-full flex flex-col justify-center">
                                      {row.operator ? (
                                          <div className="flex items-center justify-start w-full cursor-pointer" onClick={(e) => { e.stopPropagation(); setAssignModalFlight(row); }}>
                                              <OperatorCell operatorName={row.operator} operators={operators} />
                                          </div>
                                      ) : (
                                          <button 
                                              onClick={(e) => { e.stopPropagation(); setAssignModalFlight(row); }}
                                              className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1.5 rounded shadow-lg shadow-indigo-600/20 transition-all active:scale-95 w-full mx-auto"
                                          >
                                              <UserPlus size={12} />
                                              <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">Designar</span>
                                          </button>
                                      )}
                                    </div>
                                </td>

                                {/* FLEET */}
                                {renderEditableCell(row, 'fleet', row.fleet ? row.fleet.replace('CTA-', '').replace('SRV-', '') : '', "text-center font-mono text-[10px]", rowIndex, 7, false)}

                                {/* FLEET TYPE */}
                                {renderEditableCell(row, 'fleetType', row.fleetType || '', "text-center font-mono text-[10px]", rowIndex, 8, false)}

                                {/* REPORT */}
                                {renderReportCell(row)}

                                {activeTab === 'DESIGNADOS' && (
                                    <>
                                        {/* HR.D */}
                                        {renderEditableCell(
                                            row, 
                                            'assignmentTime' as any, 
                                            row.assignmentTime ? new Date(row.assignmentTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', 'H') : '--', 
                                            "text-center font-mono text-emerald-400 tracking-tighter", 
                                            rowIndex, 
                                            9, 
                                            false
                                        )}
                                        {/* LT */}
                                        <td className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all text-left font-black text-[9px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-tight overflow-hidden truncate`}>
                                            {row.assignedByLt || '--'}
                                        </td>
                                    </>
                                )}


                            </>
                          ) : isFinishedView ? (
                            <>
                                {/* REGISTRATION */}
                                {renderEditableCell(row, 'registration', row.registration, "text-center font-mono text-emerald-500 tracking-tighter uppercase", rowIndex, 1)}

                                {/* FLIGHT OUT */}
                                {renderEditableCell(row, 'departureFlightNumber', row.departureFlightNumber || '', "text-center font-mono tracking-tighter", rowIndex, 2)}

                                {/* ICAO */}
                                {renderEditableCell(row, 'destination', row.destination, `text-center font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} font-bold text-[10px]`, rowIndex, 3, false)}

                                {/* CITY */}
                                <td className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all text-center font-black text-[9px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-tight`}>
                                    {ICAO_CITIES[row.destination] || 'EXTERIOR'}
                                </td>

                                {/* POSITION */}
                                {renderEditableCell(row, 'positionId', row.positionId, "text-center font-mono text-[12px]", rowIndex, 4)}

                                {/* CALÇO (ATA) */}
                                {renderEditableCell(row, 'actualArrivalTime', row.actualArrivalTime || '', "text-center font-mono font-black", rowIndex, 5)}

                                {/* ETD */}
                                {renderEditableCell(row, 'etd', row.etd, "text-center font-mono text-emerald-400", rowIndex, 6)}
                                
                                {/* OPERATOR (WITH ASSIGN BUTTON & MESSAGE DOT) */}
                                <td className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all text-left align-middle overflow-visible truncate`}>
                                    <div className="relative w-full h-full flex flex-col justify-center">
                                      {row.operator ? (
                                          <div className="flex items-center justify-start w-full cursor-pointer" onClick={(e) => { e.stopPropagation(); setAssignModalFlight(row); }}>
                                              <OperatorCell operatorName={row.operator} operators={operators} />
                                          </div>
                                      ) : (
                                          <span className={`${isDarkMode ? 'text-slate-700' : 'text-slate-400'} italic uppercase text-[9px] pl-2 cursor-pointer`} onClick={(e) => { e.stopPropagation(); setAssignModalFlight(row); }}>--</span>
                                      )}
                                    </div>
                                </td>

                                {/* FLEET */}
                                {renderEditableCell(row, 'fleet', row.fleet ? row.fleet.replace('CTA-', '').replace('SRV-', '') : '', "text-center font-mono text-[10px]", rowIndex, 7, false)}

                                {/* FLEET TYPE */}
                                {renderEditableCell(row, 'fleetType', row.fleetType || '', "text-center font-mono text-[10px]", rowIndex, 8, false)}

                                {/* REPORT */}
                                {renderReportCell(row)}

                                {/* TAB (Exclusivo Finalizados) - Not directly editable as it's calculated */}
                                <td className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all text-center font-mono ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {calculateTAB(row)}
                                </td>


                            </>
                          ) : (
                            <>
                                {/* REGISTRATION */}
                                {renderEditableCell(row, 'registration', row.registration, "text-center font-mono text-emerald-500 tracking-tighter uppercase", rowIndex, 1)}

                                {/* MODEL */}
                                {renderEditableCell(row, 'model', row.model, "text-center font-mono text-[10px] font-bold", rowIndex, 2, false)}

                                {/* FLIGHT IN */}
                                {renderEditableCell(row, 'flightNumber', row.flightNumber, "text-center font-mono tracking-tighter", rowIndex, 3)}

                                {/* ETA (POUSO ESTIMADO) - Derived from eta, but maybe let them edit eta */}
                                {renderEditableCell(row, 'eta', row.eta, "text-center font-mono", rowIndex, 4)}

                                {/* FLIGHT OUT */}
                                {renderEditableCell(row, 'departureFlightNumber', row.departureFlightNumber || '', "text-center font-mono tracking-tighter", rowIndex, 5)}

                                {/* ICAO */}
                                {renderEditableCell(row, 'destination', row.destination, `text-center font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} font-bold text-[10px]`, rowIndex, 6, false)}

                                {/* CITY */}
                                <td className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all text-center font-black text-[9px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-tight`}>
                                    {ICAO_CITIES[row.destination] || 'EXTERIOR'}
                                </td>

                                {/* POSITION */}
                                {renderEditableCell(row, 'positionId', row.positionId, "text-center font-mono text-[12px]", rowIndex, 7)}

                                {/* CALÇO (ATA) */}
                                {renderEditableCell(row, 'actualArrivalTime', row.actualArrivalTime || '', "text-center font-mono font-black", rowIndex, 8)}

                                {/* ETD */}
                                {renderEditableCell(row, 'etd', row.etd, "text-center font-mono text-emerald-400", rowIndex, 9)}

                                {/* OPERATOR (WITH ASSIGN BUTTON) */}
                                <td className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all text-left align-middle overflow-visible`}>
                                    <div className="relative w-full h-full flex flex-col justify-center">
                                      {row.operator ? (
                                          <div className="flex items-center justify-start w-full cursor-pointer" onClick={(e) => { e.stopPropagation(); setAssignModalFlight(row); }}>
                                              <OperatorCell operatorName={row.operator} operators={operators} />
                                          </div>
                                      ) : (
                                          <button 
                                              onClick={(e) => { e.stopPropagation(); setAssignModalFlight(row); }}
                                              className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1.5 rounded shadow-lg shadow-indigo-600/20 transition-all active:scale-95 w-full mx-auto"
                                          >
                                              <UserPlus size={12} />
                                              <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">Designar</span>
                                          </button>
                                      )}
                                    </div>
                                </td>

                                {/* FLEET */}
                                {renderEditableCell(row, 'fleet', row.fleet ? row.fleet.replace('CTA-', '').replace('SRV-', '') : '', "text-center font-mono text-[10px]", rowIndex, 10, false)}

                                {/* FLEET TYPE */}
                                {renderEditableCell(row, 'fleetType', row.fleetType || '', "text-center font-mono text-[10px]", rowIndex, 11, false)}


                            </>
                          )}
                          
                          {/* STATUS (PILL DESIGN RESTORED) - MOVED OUTSIDE CONDITIONAL */}
                          <td className={`px-1.5 py-1 text-center border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all`}>
                              {dynamicStatus ? (
                                  <div className="flex flex-col items-center justify-center gap-0.5 w-full">
                                      <div className={`flex items-center justify-center w-full min-h-[28px] px-2 rounded text-[9px] leading-[10px] py-1 font-black uppercase tracking-[0.1em] border ${dynamicStatus.color}`}>
                                          {dynamicStatus.label}
                                      </div>
                                      {dynamicStatus.subtitle && (
                                          <span className={`block text-[8px] font-black uppercase tracking-widest mt-0.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                              {dynamicStatus.subtitle}
                                          </span>
                                      )}
                                  </div>
                              ) : (
                                  <StatusBadge status={row.status} isDarkMode={isDarkMode} />
                              )}
                              {row.isStandby && (
                                  <span className="block text-[7px] text-amber-500 uppercase mt-1 text-center font-bold tracking-widest">{row.standbyReason}</span>
                              )}
                          </td>
                          
                          <td className={`px-1.5 text-center last:rounded-r-[4px] border-y border-l border-r ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all`}>
                              <div className="relative">
                                  <>
                                      <button onClick={(e) => { 
                                          e.stopPropagation(); 
                                          if (openMenuId === row.id) {
                                              setOpenMenuId(null);
                                          } else {
                                              const rect = e.currentTarget.getBoundingClientRect();
                                              setMenuPosition({ top: rect.bottom, left: rect.right - 224 });
                                              setOpenMenuId(row.id);
                                          }
                                      }} className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all btn-action-menu shadow-lg shadow-indigo-600/20 active:scale-95">
                                          <MoreVertical size={16} />
                                      </button>

                                          {openMenuId === row.id && menuPosition && createPortal(
                                              <div 
                                                  ref={actionMenuRef} 
                                                  style={{ top: menuPosition.top, left: menuPosition.left }}
                                                  className={`fixed mt-1 w-56 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border rounded-md shadow-2xl z-[9999] overflow-hidden animate-in fade-in slide-in-from-top-2`}
                                              >
                                                  <div className={`p-2 border-b ${isDarkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50/50'}`}>
                                                      <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-bold uppercase tracking-wider`}>Ações - Voo {row.flightNumber}</p>
                                                  </div>
                                                  <div className="flex flex-col text-xs p-1">
                                                      {(() => {
                                                          const btnClass = `w-full text-left px-3 py-2 ${isDarkMode ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'} rounded flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`;
                                                          const cancelBtnClass = "w-full text-left px-3 py-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
                                                          const separator = <div className={`h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'} my-1`} />;

                                                          const obsBtn = (
                                                              <button onClick={(e) => handleOpenObservationModal(row, e)} className={btnClass}>
                                                                  <Pen size={14} /> Observações
                                                              </button>
                                                          );

                                                          const cancelBtn = (
                                                              <button onClick={(e) => handleCancelFlight(row, e)} className={cancelBtnClass}>
                                                                  <XCircle size={14} /> Cancelar Voo
                                                              </button>
                                                          );

                                                          const delBtn = (
                                                              <button onClick={(e) => handleDeleteFlight(row, e)} className={cancelBtnClass}>
                                                                  <XCircle size={14} /> Excluir Voo
                                                              </button>
                                                          );

                                                          const pinBtn = (
                                                              <button onClick={(e) => handlePinFlight(row.id, e)} className={btnClass}>
                                                                  <Anchor size={14} /> {row.isPinned ? 'Desfixar do topo' : 'Fixar no topo'}
                                                              </button>
                                                          );

                                                          const moveToQueueBtn = (
                                                              <button onClick={(e) => handleMoveToQueue(row, e)} className={btnClass} disabled={!!row.operator}>
                                                                  <ListOrdered size={14} /> Mover para Fila
                                                              </button>
                                                          );

                                                          const inputReportBtn = (
                                                              <button onClick={(e) => { 
                                                                  e.stopPropagation(); 
                                                                  setReportInputFlight(row);
                                                                  setOpenMenuId(null);
                                                              }} className={btnClass}>
                                                                  <FileText size={14} /> Lançar Relatório
                                                              </button>
                                                          );

                                                          const viewReportBtn = hasReport(row) ? (
                                                              <button onClick={(e) => { 
                                                                  e.stopPropagation(); 
                                                                  if (onOpenReport) {
                                                                      onOpenReport(row);
                                                                  }
                                                                  setOpenMenuId(null);
                                                              }} className={btnClass}>
                                                                  <FileBarChart size={14} /> Ver Relatório
                                                              </button>
                                                          ) : null;

                                                          if (activeTab === 'GERAL') {
                                                              return (
                                                                  <>
                                                                      {moveToQueueBtn}
                                                                      {pinBtn}
                                                                      <button 
                                                                          onClick={(e) => { handleConfirmVisual(row.id, row.flightNumber, e); setOpenMenuId(null); }} 
                                                                          className={btnClass} 
                                                                          disabled={row.status !== FlightStatus.FINALIZADO && row.status !== FlightStatus.CANCELADO}
                                                                      >
                                                                          <CheckCheck size={14} /> Limpar da Lista
                                                                      </button>
                                                                      {cancelBtn}
                                                                      {obsBtn}
                                                                  </>
                                                              );
                                                          }

                                                          if (activeTab === 'CHEGADA') {
                                                              return (
                                                                  <>
                                                                      {moveToQueueBtn}
                                                                      {pinBtn}
                                                                      {cancelBtn}
                                                                      {obsBtn}
                                                                  </>
                                                              );
                                                          }

                                                          if (activeTab === 'FILA') {
                                                              return (
                                                                  <>
                                                                      {pinBtn}
                                                                      {cancelBtn}
                                                                      {delBtn}
                                                                      {obsBtn}
                                                                  </>
                                                              );
                                                          }

                                                          if (activeTab === 'DESIGNADOS') {
                                                              return (
                                                                  <>
                                                                      <button 
                                                                          onClick={(e) => handleIntentStart(row, e)} 
                                                                          className={btnClass}
                                                                      >
                                                                          <Play size={14} className="text-emerald-500" /> Iniciar Abastecimento
                                                                      </button>
                                                                      <button onClick={(e) => { e.stopPropagation(); setConfirmRemoveOperatorFlight(row); setOpenMenuId(null); }} className={btnClass}>
                                                                          <UserCheck size={14} /> Cancelar Designação
                                                                      </button>
                                                                      {inputReportBtn}
                                                                      {viewReportBtn}
                                                                      {obsBtn}
                                                                      {cancelBtn}
                                                                  </>
                                                              );
                                                          }

                                                          if (activeTab === 'ABASTECENDO') {
                                                              return (
                                                                  <>
                                                                      {pinBtn}
                                                                      <button onClick={(e) => { e.stopPropagation(); setConfirmFinishModalFlight(row); setOpenMenuId(null); }} className={btnClass}>
                                                                          <CheckCircle size={14} className="text-emerald-500" /> Finalizar
                                                                      </button>
                                                                      {inputReportBtn}
                                                                      {viewReportBtn}
                                                                      {obsBtn}
                                                                  </>
                                                              );
                                                          }

                                                          if (activeTab === 'FINALIZADO') {
                                                              return (
                                                                  <>
                                                                      <button onClick={(e) => handleReforco(row, e)} className={btnClass}>
                                                                          <History size={14} /> Reforço
                                                                      </button>
                                                                      {inputReportBtn}
                                                                      {viewReportBtn}
                                                                      {obsBtn}
                                                                  </>
                                                              );
                                                          }

                                                          return null;
                                                      })()}
                                                  </div>
                                              </div>
                                          , document.body)}
                                  </>
                              </div>
                          </td>
                      </tr>
                  )})}
              </tbody>
          </table>
        </div>
      </div>

      {/* TOAST NOTIFICATION CONTAINER */}
      <div className="absolute bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
          {toasts.map(toast => (
              <div 
                  key={toast.id}
                  className={`pointer-events-auto min-w-[300px] bg-slate-900 border-l-4 p-4 rounded-md shadow-2xl animate-in slide-in-from-right duration-300 flex items-start gap-3 ${
                      toast.type === 'success' ? 'border-emerald-500' :
                      toast.type === 'info' ? 'border-blue-500' :
                      'border-amber-500'
                  }`}
              >
                  <div className={`p-1.5 rounded-full shrink-0 ${
                      toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-500' :
                      toast.type === 'info' ? 'bg-blue-500/20 text-blue-500' :
                      'bg-amber-500/20 text-amber-500'
                  }`}>
                      {toast.type === 'success' ? <CheckCircle size={16} /> : <Eye size={16} />}
                  </div>
                  <div className="flex-1">
                      <h4 className={`text-xs font-black uppercase tracking-widest mb-1 ${
                          toast.type === 'success' ? 'text-emerald-500' :
                          toast.type === 'info' ? 'text-blue-500' :
                          'text-amber-500'
                      }`}>
                          {toast.title}
                      </h4>
                      <p className="text-[11px] text-slate-300 leading-tight">{toast.message}</p>
                  </div>
                  <button onClick={() => removeToast(toast.id)} className="text-slate-500 hover:text-white transition-colors">
                      <X size={14} />
                  </button>
              </div>
          ))}
      </div>

      {selectedFlight && (
        <FlightDetailsModal 
          flight={selectedFlight} 
          onClose={() => setSelectedFlight(null)} 
          onUpdate={syncFlight}
          vehicles={vehicles}
          operators={getEligibleOperators(selectedFlight)}
          onOpenAssignSupport={(flight) => setAssignSupportModalFlight(flight)}
        />
      )}

      {reportInputFlight && (
        <FlightReportInputModal
            flight={reportInputFlight}
            onClose={() => setReportInputFlight(null)}
            onUpdate={syncFlight}
        />
      )}


      {/* Observation Modal */}
      {observationModalFlight && (
        <ObservationModal
          flight={observationModalFlight}
          newObservation={newObservation}
          setNewObservation={setNewObservation}
          onSave={handleSaveObservation}
          onClose={() => setObservationModalFlight(null)}
        />
      )}

      {/* MODAL DE DESIGNAÇÃO DE OPERADOR */}
      <DesigOpr 
          isOpen={!!assignModalFlight}
          onClose={() => { setAssignModalFlight(null); setSelectedOperatorId(null); }}
          flight={assignModalFlight}
          operators={assignModalFlight ? getEligibleOperators(assignModalFlight, false) : []}
          onConfirm={(operatorId) => {
              confirmAssignment(operatorId);
          }}
      />

      {/* MODAL DE DESIGNAÇÃO DE APOIO */}
      <DesigOpr 
          isOpen={!!assignSupportModalFlight}
          onClose={() => { setAssignSupportModalFlight(null); setSelectedOperatorId(null); }}
          flight={assignSupportModalFlight}
          operators={assignSupportModalFlight ? getEligibleOperators(assignSupportModalFlight, true) : []}
          onConfirm={(operatorId) => {
              confirmSupportAssignment(operatorId);
          }}
      />

      {/* MODAL DE JUSTIFICATIVA DE ATRASO (SLA COMPLIANCE) */}
      {delayModalFlightId && (
        <DelayJustificationModal
          delayReasonCode={delayReasonCode}
          setDelayReasonCode={setDelayReasonCode}
          delayReasonDetail={delayReasonDetail}
          setDelayReasonDetail={setDelayReasonDetail}
          onSubmit={handleSubmitDelay}
          onClose={() => setDelayModalFlightId(null)}
        />
      )}

      {/* CALÇO CONFIRMATION MODAL */}
      {calcoModalFlight && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div 
            className={`${isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} border rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-4 py-3 border-b ${isDarkMode ? 'border-white/5 bg-slate-800/50' : 'border-slate-100 bg-slate-50'} flex justify-between items-center`}>
              <div className="flex items-center gap-2 text-yellow-500">
                <Plane size={16} className="transform rotate-45" />
                <h3 className="font-black text-[11px] uppercase tracking-widest">Confirmar Calço</h3>
              </div>
              <button 
                onClick={() => setCalcoModalFlight(null)}
                className={`p-1.5 rounded-md transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'}`}
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-black text-xs ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-900'}`}>
                  {calcoModalFlight.registration || '--'}
                </div>
                <div>
                  <div className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Voo {calcoModalFlight.airlineCode} {calcoModalFlight.departureFlightNumber}
                  </div>
                  <div className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    Destino: {calcoModalFlight.destination}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1 space-y-1.5">
                  <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Confirmar Posição 
                  </label>
                  <input
                    type="text"
                    value={calcoModalPosition}
                    onChange={(e) => setCalcoModalPosition(e.target.value.toUpperCase())}
                    className={`w-full px-3 py-2.5 rounded-lg text-lg font-black uppercase ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500' : 'bg-white border-slate-300 text-slate-900 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500'} border transition-all outline-none`}
                    placeholder="EX: 104"
                    autoFocus
                  />
                </div>
              </div>
            </div>

            <div className={`px-4 py-3 border-t ${isDarkMode ? 'border-white/5 bg-slate-800/30' : 'border-slate-100 bg-slate-50'} flex justify-between items-center gap-4`}>
              <div className="flex items-center gap-2">
                 <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Hora</label>
                 <input
                    type="time"
                    value={calcoModalTime}
                    onChange={(e) => setCalcoModalTime(e.target.value)}
                    className={`w-28 px-2 py-1.5 rounded-md text-sm font-bold font-mono ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500' : 'bg-white border-slate-300 text-slate-900 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500'} border transition-all outline-none`}
                  />
              </div>
              <div className="flex gap-2">
                  <button
                    onClick={() => {
                      syncFlight({
                        ...calcoModalFlight,
                        positionId: calcoModalPosition,
                        actualArrivalTime: calcoModalTime
                      });
                      setCalcoModalFlight(null);
                    }}
                    className="flex flex-1 items-center justify-center gap-2 px-5 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider bg-yellow-500 hover:bg-yellow-400 text-slate-900 transition-all shadow-md hover:shadow-lg active:scale-95"
                  >
                    Calçar Agora
                  </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CREATE FLIGHT MODAL */}
      {isCreateModalOpen && (
        <CreateFlightModal 
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateFlight}
        />
      )}

      {/* IMPORT MODAL */}
      {isImportModalOpen && (
        <ImportModal
          isDarkMode={isDarkMode}
          onClose={() => setIsImportModalOpen(false)}
          onImport={(file) => {
            setIsLoading(true);
            setIsImportModalOpen(false);
            setTimeout(() => {
                setIsLoading(false);
                addToast(`Arquivo ${file.name} importado com sucesso!`, 'success');
            }, 1500);
          }}
        />
      )}

      {/* CANCEL FLIGHT CONFIRMATION MODAL */}
      {cancelModalFlight && (
        <ConfirmActionModal
          type="cancel"
          flightNumber={cancelModalFlight.flightNumber}
          registration={cancelModalFlight.registration}
          onConfirm={confirmCancelFlight}
          onClose={() => setCancelModalFlight(null)}
        />
      )}

      {/* DELETE FLIGHT CONFIRMATION MODAL */}
      {deleteModalFlight && (
        <ConfirmActionModal
          type="delete"
          flightNumber={deleteModalFlight.flightNumber}
          registration={deleteModalFlight.registration}
          onConfirm={confirmDeleteFlight}
          onClose={() => setDeleteModalFlight(null)}
        />
      )}

      {/* MISSING POSITION VIP MODAL */}
      {missingPositionModalFlight && (
        <ConfirmActionModal
          type="missingPositionVIP"
          flightNumber={missingPositionModalFlight.flightNumber}
          onConfirm={() => {
              const f = missingPositionModalFlight;
              setMissingPositionModalFlight(null);
              onUpdateFlights(prev => prev.map(flight => 
                  flight.id === f.id ? { ...flight, positionId: 'PÁTIO VIP' } : flight
              ));
              setConfirmStartModalFlight({ ...f, positionId: 'PÁTIO VIP' });
          }}
          onClose={() => setMissingPositionModalFlight(null)}
        />
      )}

      {/* CONFIRM START MODAL */}
      {confirmStartModalFlight && (
        <ConfirmActionModal
          type="start"
          flightNumber={confirmStartModalFlight.flightNumber}
          onConfirm={handleConfirmStart}
          onClose={() => setConfirmStartModalFlight(null)}
        />
      )}

      {/* CONFIRM REMOVE OPERATOR MODAL */}
      {confirmRemoveOperatorFlight && (
        <ConfirmActionModal
          type="remove"
          flightNumber={confirmRemoveOperatorFlight.flightNumber}
          onConfirm={handleConfirmRemoveOperator}
          onClose={() => setConfirmRemoveOperatorFlight(null)}
        />
      )}

      {/* CONFIRM FINISH MODAL */}
      {confirmFinishModalFlight && (
        <ConfirmActionModal
          type="finish"
          flightNumber={confirmFinishModalFlight.flightNumber}
          onConfirm={handleConfirmFinish}
          onClose={() => setConfirmFinishModalFlight(null)}
        />
      )}

      {showClearAllConfirm && (
        <ConfirmActionModal 
          type="clearMesh"
          message="Isso irá limpar voos da malha operacional. Você deseja um reset total (apagar tudo) ou o 'Smart Clear' (manter apenas voos com designação ou operação viva)?"
          onConfirm={(data) => {
            const clearMode = data?.clearMode || 'all';
            import('../services/supabaseService').then(({ deleteAllFlightsByDate, deleteInactiveFlightsByDate }) => {
                const targetDate = new Date();
                targetDate.setDate(targetDate.getDate() + activeDateOffset);
                const activeDateStr = getLocalDateStr(targetDate);
                
                const deleteAction = clearMode === 'all' 
                    ? deleteAllFlightsByDate(activeDateStr)
                    : deleteInactiveFlightsByDate(activeDateStr);

                deleteAction
                    .then(() => {
                        if (clearMode === 'all') {
                            onUpdateFlights([]);
                            addToast('MALHA OPER.', 'Toda a malha operacional da data selecionada foi removida.', 'warning');
                        } else {
                            // Smart Clear: Filtramos localmente para manter os que têm operador ou status avançado
                            onUpdateFlights(prev => prev.filter(f => 
                                (f.operatorId || f.operator) || // Tem operador
                                (f.status !== FlightStatus.CHEGADA && f.status !== FlightStatus.FILA) // Status avançado
                            ));
                            addToast('MALHA OPER.', 'Voos sem designação foram removidos. Operação mantida.', 'info');
                        }
                    })
                    .catch(err => {
                        console.error('Erro ao limpar banco:', err);
                        addToast('ERRO', 'Falha ao sincronizar limpeza com o servidor.', 'warning');
                    });
            });

            setShowClearAllConfirm(false);
          }}
          onClose={() => setShowClearAllConfirm(false)}
        />
      )}
      {timeConflictData && (
        <TimeConflictModal 
            timeStr={timeConflictData.newEtd}
            isDarkMode={isDarkMode}
            onConfirmToday={() => {
                const flight = flights.find(f => f.id === timeConflictData.rowId);
                if (flight) {
                    confirmedConflictsRef.current.add(`${flight.id}-${flight.etd}`);
                }
                setTimeConflictData(null);
            }}
            onConfirmTomorrow={() => {
                const flight = flights.find(f => f.id === timeConflictData.rowId);
                if (flight) {
                    confirmedConflictsRef.current.add(`${flight.id}-${flight.etd}`);
                    let baseDate = new Date();
                    if (flight.date) {
                        const [y, m, d] = flight.date.split('-').map(Number);
                        baseDate = new Date(y, m - 1, d);
                    }
                    baseDate.setDate(baseDate.getDate() + 1);
                    const newDateStr = getLocalDateStr(baseDate);
                    onUpdateFlights(prev => prev.map(f => f.id === flight.id ? { ...f, date: newDateStr } : f));
                }
                setTimeConflictData(null);
            }}
            onCorrect={() => {
                setTimeConflictData(null);
                setEditingCell({ rowId: timeConflictData.rowId, col: 'etd' });
            }}
            onDiscard={() => {
                const flight = flights.find(f => f.id === timeConflictData.rowId);
                if (flight) {
                    onUpdateFlights(prev => prev.map(f => f.id === flight.id ? { ...f, etd: timeConflictData.oldEtd } : f));
                }
                setTimeConflictData(null);
            }}
        />
      )}

    </div>
  );
};
