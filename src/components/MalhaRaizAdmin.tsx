import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Database, RefreshCw, Upload, Info } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { getRootMesh, deleteRootMeshFlight, upsertRootMesh, clearRootMesh } from '../services/supabaseService';
import { AirlineLogo } from './AirlineLogo';
import { MeshFlight } from '../types';

interface MalhaRaizAdminProps {
  isDarkMode: boolean;
}

type FlightField = 'flightNumber' | 'destination' | 'etd' | 'eta' | 'airline' | 'disabled' | 'actions';

const COLUMNS: { key: FlightField; label: string; width: string; isVariable: boolean }[] = [
  { key: 'airline', label: 'COMPANHIA', width: 'w-px whitespace-nowrap px-4', isVariable: false },
  { key: 'flightNumber', label: 'VÔO', width: 'w-px px-2', isVariable: true },
  { key: 'destination', label: 'ICAO', width: 'w-px px-2', isVariable: true },
  { key: 'eta', label: 'ETA', width: 'w-px px-2', isVariable: true },
  { key: 'etd', label: 'ETD', width: 'w-px px-2', isVariable: true },
  { key: 'disabled', label: 'DES.', width: 'w-px px-2', isVariable: false },
  { key: 'actions', label: 'Ações', width: 'w-px px-2', isVariable: false },
];

export const MalhaRaizAdmin: React.FC<MalhaRaizAdminProps> = ({ isDarkMode }) => {
  const [flights, setFlights] = useState<MeshFlight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [airlines, setAirlines] = useState<string[]>([]);
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});
  const [activeAirline, setActiveAirline] = useState<string>('');
  const [showNewAirlineModal, setShowNewAirlineModal] = useState(false);
  const [showImportInstructions, setShowImportInstructions] = useState(false);
  const [newAirlineName, setNewAirlineName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; isError: boolean } | null>(null);
  const [confirmDeleteAirline, setConfirmDeleteAirline] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const [focusedCell, setFocusedCell] = useState<{ rowId: string; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: number } | null>(null);
  const [isKeystrokeEdit, setIsKeystrokeEdit] = useState(false);

  const fetchFlights = async () => {
    setIsLoading(true);
    try {
        const data = await getRootMesh();
        const { data: companies } = await supabase.from('companhias').select('airline, airline_code');
        
        if (companies) {
            const mapping: Record<string, string> = {};
            companies.forEach(c => {
                if (c.airline_code) mapping[c.airline_code.toUpperCase()] = c.airline.toUpperCase();
            });
            setCompanyNames(mapping);
        }

        if (data) {
            const validData = data.filter(f => {
                const flightNum = (f.flightNumber || '').toUpperCase();
                const cia = (f.airlineCode || '').toUpperCase();
                return !flightNum.includes('ENCH') && !flightNum.includes('ENCHIMENTO') && cia !== 'ENCH';
            });
            setFlights(validData);
            const uniqueAirlines = Array.from(new Set(validData.map(a => a.airlineCode))).filter(a => Boolean(a) && a !== 'EM GERAL').sort();
            setAirlines(uniqueAirlines);
            if (!activeAirline) {
                setActiveAirline('EM GERAL');
            }
        }
    } catch (e) {
        console.error(e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchFlights();
  }, []);

  const handleCreateNewAirline = () => {
    if (!newAirlineName.trim()) return;
    const name = newAirlineName.trim().toUpperCase();
    if (!airlines.includes(name)) {
        const uniqueAirlines = Array.from(new Set([...airlines, name])).filter(a => a !== 'EM GERAL').sort();
        setAirlines(uniqueAirlines);
    }
    setActiveAirline(name);
    setShowNewAirlineModal(false);
    setNewAirlineName('');
  };

  const handleCreateNewFlight = async () => {
    if (!activeAirline) return;
    const tempId = `temp-${Date.now()}`;
    const newFlight: any = {
        id: tempId,
        airline: activeAirline,
        airline_code: '',
        flightNumber: 'NEW',
        departureFlightNumber: 'NEW',
        destination: '',
        etd: '00:00',
        eta: '00:00',
        is_disabled: false,
        isNew: true
    };
    
    setFlights([...flights, newFlight]);
    
    try {
        const { id: _, ...flightToSave } = newFlight;
        const meshFlight: MeshFlight = {
            id: '',
            airline: activeAirline === 'EM GERAL' ? '' : activeAirline,
            airlineCode: activeAirline === 'EM GERAL' ? '' : activeAirline,
            flightNumber: 'NEW',
            departureFlightNumber: 'NEW',
            destination: '',
            etd: '00:00',
            eta: '00:00',
            registration: '',
            model: '',
            positionId: '',
            actualArrivalTime: '',
            isNew: true
        };

        await upsertRootMesh([meshFlight]);
        await fetchFlights();
    } catch (err: any) {
        setFeedback({ msg: `Erro ao adicionar: ${err.message}`, isError: true });
        setFlights(prev => prev.filter(a => a.id !== tempId));
    }
  };

  const handleDeleteAirline = async (airlineCode: string) => {
    try {
        // Encontra os voos desta companhia para excluir um por um ou via clear?
        // Como o serviço não tem delete por companhia, vamos filtrar localmente e avisar o serviço
        const toDelete = flights.filter(f => f.airlineCode === airlineCode);
        for (const flight of toDelete) {
            await deleteRootMeshFlight(flight.id);
        }
        
        // update local state
        setFlights(prev => prev.filter(a => a.airlineCode !== airlineCode));
        const newAirlines = airlines.filter(a => a !== airlineCode);
        setAirlines(newAirlines);
        if (newAirlines.length > 0) {
            setActiveAirline('EM GERAL');
        } else {
            setActiveAirline('');
        }
        setFeedback({ msg: `Companhia ${airlineCode} excluída com sucesso.`, isError: false });
    } catch(e: any) {
        console.error(e);
        setFeedback({ msg: `Erro ao excluir companhia: ${e.message}`, isError: true });
        fetchFlights();
    }
  };

  const handleDeleteFlight = async (id: string) => {
    const flight = flights.find(f => f.id === id);
    setFlights(prev => prev.filter(a => a.id !== id));
    try {
        await deleteRootMeshFlight(id);
    } catch(e) {
        console.error(e);
        fetchFlights();
    }
  };

  const handleUpdateField = async (id: string, field: keyof MeshFlight, value: any) => {
    const updatedFlights = flights.map(a => {
        if (a.id === id) {
            const updated = { ...a, [field]: value };
            // Sincroniza airline com airlineCode se necessário
            if (field === 'airlineCode') {
                updated.airline = value;
            }
            return updated;
        }
        return a;
    });
    setFlights(updatedFlights);
    
    // Check if temp id
    if (id.startsWith('temp-')) return;
    
    try {
        const flightToUpdate = updatedFlights.find(f => f.id === id);
        if (flightToUpdate) {
            await upsertRootMesh([flightToUpdate]);
        }
        
        // Re-calculate airlines if airline changed
        if (field === 'airline' || field === 'airlineCode') {
             const uniqueAirlines = Array.from(new Set(updatedFlights.map(a => a.airlineCode))).filter(a => Boolean(a) && a !== 'EM GERAL').sort();
             setAirlines(uniqueAirlines);
        }
    } catch (e) {
        console.error(e);
        fetchFlights();
    }
  };

  const handleFinishEdit = () => {
    setEditingCell(null);
    setIsKeystrokeEdit(false);
  };

  const currentAirlineFlights = useMemo(() => {
    if (activeAirline === 'EM GERAL') {
      return [...flights].sort((a,b) => (a.etd || '').localeCompare(b.etd || ''));
    }
    return flights.filter(a => a.airline === activeAirline).sort((a,b) => (a.etd || '').localeCompare(b.etd || ''));
  }, [flights, activeAirline]);

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    const aircraft = currentAirlineFlights[rowIndex];
    if (!aircraft) return;
    
    const input = e.target as HTMLInputElement;
    const isEditing = editingCell?.rowId === aircraft.id && editingCell?.col === colIndex;

    switch (e.key) {
        case 'ArrowDown':
            if (isEditing) return;
            e.preventDefault();
            if (rowIndex < currentAirlineFlights.length - 1) {
                setFocusedCell({ rowId: currentAirlineFlights[rowIndex + 1].id, col: colIndex });
            }
            break;
        case 'ArrowUp':
            if (isEditing) return;
            e.preventDefault();
            if (rowIndex > 0) {
                setFocusedCell({ rowId: currentAirlineFlights[rowIndex - 1].id, col: colIndex });
            }
            break;
        case 'ArrowRight':
            if (!isEditing) {
                e.preventDefault();
                setFocusedCell({ rowId: aircraft.id, col: Math.min(COLUMNS.length - 1, colIndex + 1) });
            } else {
                if (input.selectionStart === input.value.length) {
                    e.preventDefault();
                    setFocusedCell({ rowId: aircraft.id, col: Math.min(COLUMNS.length - 1, colIndex + 1) });
                    handleFinishEdit();
                }
            }
            break;
        case 'ArrowLeft':
            if (!isEditing) {
                e.preventDefault();
                setFocusedCell({ rowId: aircraft.id, col: Math.max(0, colIndex - 1) });
            } else {
                if (input.selectionStart === 0) {
                    e.preventDefault();
                    setFocusedCell({ rowId: aircraft.id, col: Math.max(0, colIndex - 1) });
                    handleFinishEdit();
                }
            }
            break;
        case 'Enter':
            e.preventDefault();
            if (isEditing) {
                handleFinishEdit();
                setFocusedCell({ rowId: aircraft.id, col: Math.min(COLUMNS.length - 1, colIndex + 1) });
            } else {
               setEditingCell({ rowId: aircraft.id, col: colIndex });
            }
            break;
        case 'Escape':
            if (isEditing) {
                e.preventDefault();
                handleFinishEdit();
            }
            break;
        case 'Tab':
            e.preventDefault();
            handleFinishEdit();
            if (e.shiftKey) {
                if (colIndex > 0) {
                    setFocusedCell({ rowId: aircraft.id, col: colIndex - 1 });
                } else if (rowIndex > 0) {
                    setFocusedCell({ rowId: currentAirlineFlights[rowIndex - 1].id, col: COLUMNS.length - 1 });
                }
            } else {
                if (colIndex < COLUMNS.length - 1) {
                    setFocusedCell({ rowId: aircraft.id, col: colIndex + 1 });
                } else if (rowIndex < currentAirlineFlights.length - 1) {
                    setFocusedCell({ rowId: currentAirlineFlights[rowIndex + 1].id, col: 0 });
                }
            }
            break;
        default:
            // Excel-like direct entry
            if (!isEditing && !e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
                const isBooleanField = ['missing_cap', 'defective_door', 'defective_panel', 'no_autocut', 'airline', 'actions', 'disabled'].includes(COLUMNS[colIndex].key);
                if (!isBooleanField) {
                    e.preventDefault();
                    setIsKeystrokeEdit(true);
                    setEditingCell({ rowId: aircraft.id, col: colIndex });
                    handleUpdateField(aircraft.id, COLUMNS[colIndex].key as keyof MeshFlight, e.key);
                }
            }
            break;
    }
  };

  useEffect(() => {
    if (focusedCell) {
        const rowIndex = currentAirlineFlights.findIndex(a => a.id === focusedCell.rowId);
        if (rowIndex !== -1) {
            const isEditing = editingCell?.rowId === focusedCell.rowId && editingCell?.col === focusedCell.col;
            if (isEditing) {
                const input = tableRef.current?.querySelector(`tr[data-row="${rowIndex}"] td[data-col="${focusedCell.col}"] input`) as HTMLInputElement;
                if (input && document.activeElement !== input) {
                    input.focus();
                }
            } else {
                const td = tableRef.current?.querySelector(`tr[data-row="${rowIndex}"] td[data-col="${focusedCell.col}"]`) as HTMLTableCellElement;
                if (td && document.activeElement !== td) {
                    td.focus();
                }
            }
        }
    }
  }, [focusedCell, editingCell, currentAirlineFlights]);

    const processImport = async (data: any[]) => {
      setIsImporting(true);
      
      const flightsMap = new Map<string, any>();
      let missingCodeCount = 0;

      // Função para converter o tempo do Excel (decimal) em HH:MM
      const formatExcelTime = (val: any): string => {
          if (typeof val === 'number') {
              const totalMinutes = Math.round(val * 24 * 60);
              const hours = Math.floor(totalMinutes / 60) % 24;
              const minutes = totalMinutes % 60;
              return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          }
          if (typeof val === 'string' && val.includes(':')) return val.trim();
          if (typeof val === 'string' && /^\d{4}$/.test(val)) return `${val.slice(0, 2)}:${val.slice(2, 4)}`;
          return val?.toString() || '';
      };

      for (const row of data) {
          const getVal = (possibleKeys: string[]) => {
              for (const key of Object.keys(row)) {
                  const cleanKey = key.toString().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '');
                  if (possibleKeys.includes(cleanKey)) {
                      return row[key];
                  }
              }
              return undefined;
          };

          const vooRaw = getVal(['VOO', 'FLIGHT', 'NVOO', 'FLIGHTNUMBER', 'NUMEROVOO']);
          const isVooKey = row['VÔO'] || row['VOO'] || row['Voo'] || row['vôo'];
          const destinoRaw = getVal(['DESTINO', 'ICAO', 'DESTINATION']);
          const etaRaw = getVal(['ESTIMADO', 'ETA', 'CHEGADA']);
          const etdRaw = getVal(['SAIDA', 'ETD', 'PARTIDA']);
          const ciaRaw = getVal(['COMPANHIA', 'CIA', 'EMPRESA', 'AIRLINE']);

          const voo = vooRaw?.toString().toUpperCase().trim() || isVooKey?.toString().toUpperCase().trim();
          let cia = ciaRaw?.toString().toUpperCase().trim() || '';
          
          if (!voo) {
              missingCodeCount++;
              continue;
          }

          // Extract airline from flight number (e.g. LA3396 -> LA, RG1644 -> RG)
          if (!cia) {
             const ciaMatch = voo.match(/^[A-Z]{2,3}/);
             cia = ciaMatch ? ciaMatch[0] : 'OUTRA';
          }

          if (voo.includes('ENCH') || voo.includes('ENCHIMENTO') || cia === 'ENCH') {
              continue;
          }

          flightsMap.set(voo, {
              flight_number: voo,
              airline_code: cia,
              destination: destinoRaw?.toString().toUpperCase().trim() || '',
              eta: formatExcelTime(etaRaw),
              etd: formatExcelTime(etdRaw)
          });
      }

      const flightsToUpsert = Array.from(flightsMap.values());

      if (flightsToUpsert.length === 0) {
          setFeedback({ msg: `ERRO: Nenhuma linha válida encontrada para importar.\n\nLinhas ignoradas por falta de VÔO: ${missingCodeCount}\n\nDICA: Verifique se o título da coluna de voo na primeira linha é "VÔO".`, isError: true });
          setIsImporting(false);
          return;
      }

      try {
          const existingData = await getRootMesh();
          const existingMap = new Map((existingData || []).map((r: MeshFlight) => [r.flightNumber, r.id]));

          const finalPayload: MeshFlight[] = flightsToUpsert.map((f: any) => {
              const existingId = existingMap.get(f.flight_number);
              return {
                  id: existingId || '',
                  airline: f.airline_code,
                  airlineCode: f.airline_code,
                  flightNumber: f.flight_number,
                  departureFlightNumber: f.flight_number,
                  destination: f.destination,
                  eta: f.eta,
                  etd: f.etd,
                  registration: f.registration || '',
                  model: f.model || '',
                  positionId: f.positionId || '',
                  actualArrivalTime: ''
              };
          });

          await upsertRootMesh(finalPayload);
          
          let msg = `SUCESSO! Importação concluída.\n\nVoos importados/atualizados: ${flightsToUpsert.length}`;
          if (missingCodeCount > 0) {
              msg += `\n\n(Aviso: ${missingCodeCount} linhas foram ignoradas por estarem vazias ou não terem a coluna VÔO preenchida corretamente)`;
          }
          setFeedback({ msg, isError: false });
      } catch (err: any) {
          console.error("Erro no upsert de malha_raiz:", err);
          setFeedback({ msg: `ERRO CRÍTICO ao salvar a malha_raiz no Banco de Dados.\n\nMensagem técnica: ${err?.message || 'Falha de comunicação.'}`, isError: true });
      }

      setIsImporting(false);
      fetchFlights(); // Recarrega todas as abas e dados localmente exibindo o resultado fresco
    };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputElement = e.target;
    const file = inputElement.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        
        if (!wb.SheetNames || wb.SheetNames.length === 0) {
            throw new Error("O arquivo Excel enviado não possui abas válidas.");
        }
        
        const wsname = wb.SheetNames[0]; 
        const ws = wb.Sheets[wsname];
        
        // Pega as linhas puras para encontrar o cabeçalho
        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        let headerRowIndex = 0;
        let bestScore = 0;
        
        // Procurar qual linha é de fato o cabeçalho (a que tem mais 'palavras-chave' conhecidas)
        const keyWords = ['PREFIXO', 'MATRICULA', 'COMPANHIA', 'MODELO', 'TAMPA', 'PORTINHOLA', 'PAINEL', 'OBSERVACOES'];
        
        rawRows.forEach((row, index) => {
            if (!Array.isArray(row)) return;
            let score = 0;
            for (const cell of row) {
                if (typeof cell !== 'string') continue;
                const clean = cell.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '');
                if (keyWords.some(kw => clean.includes(kw))) {
                    score++;
                }
            }
            if (score > bestScore) {
                bestScore = score;
                headerRowIndex = index;
            }
        });

        // Agora pulamos as linhas até o cabeçalho e lemos os dados
        const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '', range: headerRowIndex });
        
        await processImport(jsonData);
    } catch (error: any) {
        console.error("Error parsing Excel:", error);
        setFeedback({ msg: `FALHA NA LEITURA DO ARQUIVO: ${error?.message || 'Formato de Excel inválido.'}`, isError: true });
        setIsImporting(false);
    } finally {
        if (inputElement) {
            inputElement.value = ''; // Reseta usando a referência direta capturada no início
        }
    }
  };

  const handleDeleteAction = async () => {
    if (activeAirline === 'EM GERAL') {
        if (!window.confirm("Deseja realmente limpar TODA a malha raiz? Esta ação não pode ser desfeita.")) return;
        setIsLoading(true);
        try {
            await clearRootMesh();
            setFlights([]);
            setAirlines([]);
            setActiveAirline('EM GERAL');
            setFeedback({ msg: "Malha raiz limpa com sucesso.", isError: false });
        } catch (e: any) {
            setFeedback({ msg: `Erro ao limpar malha: ${e.message}`, isError: true });
        } finally {
            setIsLoading(false);
        }
    } else {
        setConfirmDeleteAirline(activeAirline);
    }
  };

  return (
  <div className={`flex flex-col h-full ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-800'}`}>
        {/* HEADER */}
        <div className={`shrink-0 h-16 border-b flex items-center justify-between px-4 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.5)]'} z-20`}>
           <div className="flex flex-col justify-center">
               <div className="flex items-center gap-2">
                    <Database size={16} className={isDarkMode ? 'text-emerald-500' : 'text-emerald-600'} />
                    <h1 className="text-sm font-black uppercase tracking-widest">Malha Raiz</h1>
                    {isLoading && <RefreshCw size={12} className="animate-spin ml-2 text-slate-500" />}
               </div>
               <span className={`text-[10px] font-medium tracking-wide ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Gerencie o banco de dados de malha_raiz por companhia</span>
           </div>
           
           <div className="flex items-center gap-3">
               <input 
                   type="file" 
                   ref={fileInputRef} 
                   accept=".xlsx, .xls" 
                   className="hidden" 
                   onChange={handleFileUpload}
               />
               <button 
                    onClick={() => setShowImportInstructions(true)}
                    className={`p-1.5 rounded-md border transition-all ${isDarkMode ? 'border-slate-700 text-slate-400 hover:text-blue-400 hover:border-blue-500/50' : 'border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-300'}`}
                    title="Instruções de Importação"
                >
                    <Info size={14} />
                </button>
                <button 
                    onClick={handleDeleteAction}
                    disabled={isLoading}
                    className={`p-1.5 rounded-md border transition-all ${isDarkMode ? 'border-red-900/30 text-red-400/60 hover:text-red-400 hover:bg-red-500/10' : 'border-red-100 text-red-300 hover:text-red-600 hover:bg-red-50'}`}
                    title={activeAirline === 'EM GERAL' ? "Limpar toda a Malha Raiz" : `Excluir companhia ${activeAirline}`}
                >
                    <Trash2 size={14} />
                </button>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm ${isDarkMode ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-white' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'} disabled:opacity-50`}
                >
                    {isImporting ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}
                    {isImporting ? 'Importando...' : 'Importar XLS'}
                </button>
                <button 
                     onClick={handleCreateNewFlight}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-[#329858] text-white border-[#29824a] hover:bg-[#29824a]'} active:scale-95`}
                >
                    <Plus size={12} /> Novo Registro
                </button>
           </div>
        </div>




        {/* TABLE WRAPPER - aligned to left with right space */}
        <div className={`w-full flex-1 overflow-auto relative flex justify-start custom-scrollbar items-start ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
            <div className={`w-1/2 border-r border-b text-left ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
                <table ref={tableRef} className="w-full text-left border-separate border-spacing-0">
                    <thead className={`sticky top-0 z-10 ${isDarkMode ? 'bg-slate-950 border-slate-700' : 'bg-[#2D8E48] text-white shadow-sm'}`}>
                        <tr>
                            {COLUMNS.map((col, idx) => {
                                return (
                                    <th key={idx} className={`whitespace-nowrap px-2 py-3 text-[10px] font-black uppercase tracking-widest border-b border-r ${isDarkMode ? 'border-slate-800' : 'border-[#29824a]'} text-center ${col.width}`}>
                                        {col.label}
                                    </th>
                                )
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {currentAirlineFlights.length === 0 ? (
                            <tr>
                                <td colSpan={COLUMNS.length} className={`px-4 py-8 text-center text-[10px] uppercase tracking-widest font-black ${isDarkMode ? 'bg-slate-900 text-slate-500' : 'bg-white text-slate-400'}`}>
                                    Nenhum voo cadastrado para esta companhia
                                </td>
                            </tr>
                        ) : (
                            currentAirlineFlights.map((aircraft, rowIndex) => (
                                <tr key={aircraft.id} data-row={rowIndex} className={`group transition-colors h-10 border-b ${isDarkMode ? 'hover:bg-slate-800/50 border-slate-800/50' : 'hover:bg-slate-50 border-slate-200'}`}>
                                    {COLUMNS.map((col, colIndex) => {
                                        const isFocused = focusedCell?.rowId === aircraft.id && focusedCell?.col === colIndex;
                                        const focusClasses = isFocused ? 'ring-2 ring-emerald-500 ring-inset z-10 shadow-[inset_0_0_0_2px_rgba(16,185,129,0.5)]' : '';

                                        if (col.key === 'actions') {
                                            return (
                                                <td 
                                                  key={`${aircraft.id}-actions`} 
                                                  data-col={colIndex}
                                                  tabIndex={0}
                                                  onClick={() => setFocusedCell({ rowId: aircraft.id, col: colIndex })}
                                                  onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                                  className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-slate-800/20' : 'border-slate-200 bg-white group-hover:bg-slate-50'} text-center actions-container align-middle outline-none ${focusClasses}`}
                                                >
                                                    <div className="flex justify-center">
                                                        <button onClick={() => handleDeleteFlight(aircraft.id)} className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${isDarkMode ? 'hover:bg-red-500/20 text-slate-400 hover:text-red-400' : 'hover:bg-red-500/10 text-slate-400 hover:text-red-500'}`}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            );
                                        }

                                        const value = aircraft[col.key as keyof MeshFlight];
                                        const isEditingObj = editingCell?.rowId === aircraft.id && editingCell?.col === colIndex;
                                        const isBooleanField = col.key === 'disabled';
                                        
                                        if (isBooleanField) {
                                            return (
                                                <td 
                                                  key={`${aircraft.id}-${col.key}-${colIndex}`} 
                                                  data-col={colIndex}
                                                  tabIndex={0}
                                                  onClick={() => setFocusedCell({ rowId: aircraft.id, col: colIndex })}
                                                  onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                                  className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-slate-800/20' : 'border-slate-200 bg-white group-hover:bg-slate-50'} text-center align-middle outline-none ${focusClasses}`}
                                                >
                                                    <div className="flex items-center justify-center">
                                                        <input 
                                                            type="checkbox"
                                                            checked={!!value}
                                                            onChange={(e) => handleUpdateField(aircraft.id, col.key as keyof MeshFlight, e.target.checked)}
                                                            className={`w-4 h-4 rounded cursor-pointer ${isDarkMode ? 'accent-emerald-500 bg-slate-900 border-slate-700' : 'accent-[#329858] bg-white border-slate-300'}`}
                                                        />
                                                    </div>
                                                </td>
                                            );
                                        }

                                        // Conditional styles based on column
                                        const extraStyle = '';
                                        const alignStyle = false ? 'text-left px-2' : 'text-center';

                                        return (
                                            <td 
                                                key={`${aircraft.id}-${col.key}-${colIndex}`} 
                                                data-col={colIndex}
                                                tabIndex={0}
                                                onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                                className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-slate-800/20 text-slate-300' : 'border-slate-200 bg-white group-hover:bg-slate-50 text-slate-700'} ${alignStyle} relative cursor-text align-middle transition-colors outline-none ${focusClasses}`}
                                                onClick={(e) => {
                                                  setFocusedCell({ rowId: aircraft.id, col: colIndex });
                                                  setEditingCell({ rowId: aircraft.id, col: colIndex });
                                                  // Garantir foco (técnica Excel)
                                                  const target = e.currentTarget;
                                                  setTimeout(() => {
                                                     (target as HTMLElement).focus();
                                                  }, 0);
                                                }}
                                            >
                                                {isEditingObj ? (
                                                    <input 
                                                        autoFocus
                                                        value={value as string || ''}
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
                                                        onChange={(e) => {
                                                            let val = e.target.value.toUpperCase();
                                                            if (col.key === 'destination') {
                                                                val = val.replace(/[^A-Z]/g, '').slice(0, 4);
                                                            } else if (col.key === 'eta' || col.key === 'etd') {
                                                                val = val.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1:$2').slice(0, 5);
                                                            }
                                                            handleUpdateField(aircraft.id, col.key as keyof MeshFlight, val);
                                                        }}
                                                        onBlur={() => handleFinishEdit()}
                                                        onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                                        className={`w-full min-w-[50px] px-1 py-1 rounded text-[11px] font-mono font-bold ${alignStyle} outline-none focus:ring-1 ${true ? 'uppercase' : ''} ${isDarkMode ? 'bg-slate-950 text-emerald-400 border border-emerald-500/50 focus:ring-emerald-500' : 'bg-slate-100 text-emerald-700 border border-emerald-500/30 focus:ring-emerald-600'}`}
                                                    />
                                                ) : (
                                                    <div className={`font-mono text-[11px] font-bold w-full ${true ? 'uppercase justify-center' : 'justify-start'} flex items-center min-h-[24px] ${extraStyle}`}>

                                                        {col.key === 'airline' ? (
                                                            <div className="flex items-center gap-2 justify-start w-full px-2">
                                                                <div className="flex items-center justify-center w-6 h-6 shrink-0 bg-white rounded shadow-sm border border-slate-200">
                                                                    <AirlineLogo airlineCode={value as string} showName={false} size="sm" className="pl-0 gap-0" />
                                                                </div>
                                                                <span className="whitespace-nowrap font-bold text-[11px] uppercase">
                                                                    {(() => {
                                                                        const code = (value as string || '').toUpperCase();
                                                                        const fallbackNames: Record<string, string> = {
                                                                            'LA': 'LATAM', 'JJ': 'LATAM', 'DL': 'DELTA', 'AA': 'AMERICAN', 
                                                                            'G3': 'GOL', 'AD': 'AZUL', 'AF': 'AIR FRANCE', 'KL': 'KLM',
                                                                            'LH': 'LUFTHANSA', 'TP': 'TAP', 'CM': 'COPA', 'UA': 'UNITED',
                                                                            'RG': 'GOL', 'LX': 'SWISS', 'TT': 'TOTAL', 'B0': 'BOA',
                                                                            'AR': 'AEROLINEAS', 'UC': 'LADECO', 'BA': 'BRITISH AIRWAYS',
                                                                            'AV': 'AVIANCA', 'IB': 'IBERIA', 'EK': 'EMIRATES', 'QR': 'QATAR',
                                                                            'TK': 'TURKISH', 'AM': 'AEROMEXICO', 'AC': 'AIR CANADA',
                                                                            'UX': 'AIR EUROPA', 'AT': 'ROYAL AIR MAROC', 'DT': 'TAAG'
                                                                        };
                                                                        return companyNames[code] || fallbackNames[code] || value || '--';
                                                                    })()}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            value || '--'
                                                        )}
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

            {/* LOGOS DIV */}
            <div className="w-1/2 p-1 flex flex-col items-center justify-start min-h-[500px] gap-1">
                 <div className={`flex flex-col items-start justify-center p-3 w-full rounded-[3px] shadow-sm border shrink-0 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                     <h3 className={`text-base font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Companhias Aéreas</h3>
                     <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{airlines.filter(a => a && a !== 'EM GERAL').length} companhias cadastradas</p>
                 </div>
                 <div className={`flex flex-wrap gap-3 justify-start content-start overflow-auto p-3 w-full flex-1 border-0 rounded-[3px] ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                     {airlines.filter(a => a && a !== 'EM GERAL').map(airline => {
                         const flightCount = flights.filter(f => f.airlineCode === airline).length;
                         return (
                         <div key={airline} className="cursor-pointer flex-shrink-0 hover:scale-110 hover:-translate-y-1 transition-all duration-200 flex flex-col items-center justify-center relative" onClick={() => setActiveAirline(airline)} title={`${airline} - ${flightCount} voos`}>
                             <AirlineLogo airlineCode={airline} className="w-[50px] h-[50px] rounded overflow-hidden shadow-sm ring-1 ring-black/5 flex items-center justify-center [&_img]:!w-[40px] [&_img]:!h-[40px]" showName={false} size="full" />
                             <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center bg-white dark:bg-slate-800 text-[#2D8E48] dark:text-green-500 text-[8px] font-black rounded-full min-w-[16px] h-[16px] px-1 text-center shadow-sm border border-slate-300 dark:border-slate-600">
                                 {flightCount}
                             </div>
                         </div>
                         );
                     })}
                 </div>
            </div>
        </div>

        {/* IMPORT INSTRUCTIONS MODAL */}
        {showImportInstructions && createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm shadow-2xl p-4">
                <div className={`p-6 rounded-xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] w-full max-w-lg flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                    <div className="flex items-center gap-3 border-b pb-3 border-slate-200 dark:border-slate-800">
                        <Info className={isDarkMode ? 'text-blue-400' : 'text-blue-600'} />
                        <h2 className="font-black text-sm uppercase tracking-widest">Instruções para Importação XLSX</h2>
                    </div>
                    
                    <div className="text-sm space-y-3">
                        <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                            Para importar dados em lote para a Malha Raiz, sua planilha Excel (<span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">.xlsx</span>) 
                            deve conter na primeira linha (cabeçalho) as seguintes colunas exatas:
                        </p>
                        
                        <ul className="list-disc pl-5 space-y-1 font-mono text-[11px] mb-2">
                            <li><strong className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>VÔO</strong> (Obrigatório) - Número do Voo (ex: LA3396)</li>
                            <li><strong className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>ICAO</strong> (Opcional) - ICAO de destino (ex: SBPS)</li>
                            <li><strong>ETA</strong> (Opcional) - Horário Estimado (ex: 22:50)</li>
                            <li><strong>ETD</strong> (Opcional) - Horário de Saída (ex: 00:00)</li>
                        </ul>
                        
                        <div className={`p-3 rounded text-xs border ${isDarkMode ? 'bg-amber-900/20 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                            <strong>Nota Importante:</strong> O sistema tentará encontrar e atualizar o voo pelo <strong>VÔO</strong>. 
                        </div>
                    </div>

                    <div className="flex items-center justify-end pt-2">
                        <button 
                            onClick={() => setShowImportInstructions(false)} 
                            className={`px-6 py-2 text-xs font-black uppercase tracking-wider rounded transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'}`}
                        >
                            Entendi
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )}

        {/* NEW AIRLINE MODAL */}
        {showNewAirlineModal && createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm shadow-2xl p-4">
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
            </div>,
            document.body
        )}

        {/* CONFIRM DELETE AIRLINE MODAL */}
        {confirmDeleteAirline && createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm shadow-2xl p-4">
                <div className={`p-6 rounded-xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] w-full max-w-sm flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                    <h2 className={`font-black text-sm uppercase tracking-widest ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                        Confirmar Exclusão
                    </h2>
                    <div className={`text-sm whitespace-pre-wrap font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        Deseja realmente excluir a companhia <strong className="uppercase">{confirmDeleteAirline}</strong> e todas as suas malha_raiz cadastradas?
                        <br/><br/>
                        Esta ação não pode ser desfeita.
                    </div>
                    <div className="flex items-center justify-end flex-wrap gap-2 pt-2">
                        <button onClick={() => setConfirmDeleteAirline(null)} className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100 text-slate-700'}`}>
                            Cancelar
                        </button>
                        <button onClick={() => {
                            handleDeleteAirline(confirmDeleteAirline);
                            setConfirmDeleteAirline(null);
                        }} className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded shadow-md transition-colors flex items-center gap-1.5 active:scale-95 ${isDarkMode ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
                            <Trash2 size={12} />
                            Excluir
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )}

        {/* FEEDBACK MODAL */}
        {feedback && createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm shadow-2xl p-4">
                <div className={`p-6 rounded-xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] w-full max-w-sm flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                    <h2 className={`font-black text-sm uppercase tracking-widest ${feedback.isError ? (isDarkMode ? 'text-red-400' : 'text-red-600') : (isDarkMode ? 'text-emerald-400' : 'text-emerald-600')}`}>
                        {feedback.isError ? 'Aviso' : 'Sucesso'}
                    </h2>
                    <div className={`text-sm whitespace-pre-wrap font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        {feedback.msg}
                    </div>
                    <div className="flex items-center justify-end pt-2">
                        <button onClick={() => setFeedback(null)} className={`px-6 py-2 text-xs font-black uppercase tracking-wider rounded shadow-md transition-colors active:scale-95 ${feedback.isError ? (isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800') : (isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-[#329858] border hover:bg-[#29824a] text-white')}`}>
                            OK
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )}
    </div>
  );
};
