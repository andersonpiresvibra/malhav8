import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Database, RefreshCw, Upload, Info } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { AirlineLogo } from './AirlineLogo';
import { MeshFlight } from '../types';

interface MalhaRaizAdminProps {
  isDarkMode: boolean;
}

type FlightField = 'flightNumber' | 'destination' | 'etd' | 'eta' | 'actions';

const COLUMNS: { key: FlightField; label: string; width: string; isVariable: boolean }[] = [
  { key: 'flightNumber', label: 'VÔO', width: 'w-32', isVariable: true },
  { key: 'destination', label: 'DESTINO (ICAO)', width: 'w-32', isVariable: true },
  { key: 'eta', label: 'ESTIMADO (ETA)', width: 'w-24', isVariable: true },
  { key: 'etd', label: 'SAÍDA (ETD)', width: 'w-24', isVariable: true },
  { key: 'actions', label: 'Ações', width: 'w-20', isVariable: false },
];

export const MalhaRaizAdmin: React.FC<MalhaRaizAdminProps> = ({ isDarkMode }) => {
  const [flights, setFlights] = useState<MeshFlight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [airlines, setAirlines] = useState<string[]>(['EM GERAL']);
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
        const { data, error } = await supabase.from('malha_raiz').select('*').order('etd');
        if (error) {
            console.error('Error fetching flights', error);
        } else if (data) {
            // Mapeia os dados do banco (que usa 'cia') para o objeto MeshFlight (que usa 'airline')
            const mappedFlights = (data as any[]).map(f => ({
                ...f,
                airline: f.cia || '',
                flightNumber: f.voo || '',
                destination: f.icao || '',
                eta: f.eta || '',
                etd: f.etd || ''
            })) as MeshFlight[];

            setFlights(mappedFlights);
            const uniqueAirlines = Array.from(new Set(mappedFlights.map(a => a.airline))).filter(a => Boolean(a) && a !== 'EM GERAL').sort();
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
        setAirlines([...airlines, name].sort());
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
        registration: '',
        model: '',
        is_disabled: false,
        isNew: true
    };
    
    setFlights([...flights, newFlight]);
    
    try {
        const { data, error } = await supabase.from('malha_raiz').insert({
            voo: 'NEW',
            cia: activeAirline,
            icao: '',
            etd: '00:00',
            eta: '00:00',
            updated_at: new Date().toISOString()
        }).select('id').single();

        if (error) {
            setFeedback({ msg: `Erro: ${error.message}`, isError: true });
            setFlights(prev => prev.filter(a => a.id !== tempId));
            return;
        }

        if (data) {
            setFlights(prev => prev.map(a => a.id === tempId ? { ...a, id: data.id } : a));
        }
    } catch (err: any) {
        setFeedback({ msg: `Erro de conexão: ${err.message}`, isError: true });
        setFlights(prev => prev.filter(a => a.id !== tempId));
    }
  };

  const handleDeleteAirline = async (airlineCode: string) => {
    try {
        const { error } = await supabase.from('malha_raiz').delete().like('voo', `${airlineCode}%`);
        
        if (error) {
            console.error('Error deleting airline', error);
            setFeedback({ msg: `Erro ao excluir a companhia: ${error.message}`, isError: true });
            return;
        }

        // update local state
        setFlights(prev => prev.filter(a => a.airline !== airlineCode));
        const newAirlines = airlines.filter(a => a !== airlineCode);
        setAirlines(newAirlines);
        if (newAirlines.length > 0) {
            setActiveAirline('EM GERAL');
        } else {
            setActiveAirline('');
        }
    } catch(e: any) {
        console.error(e);
        setFeedback({ msg: `Ocorreu um erro inesperado ao excluir. ${e?.message || ''}`, isError: true });
        fetchFlights();
    }
  };

  const handleDeleteFlight = async (id: string) => {
    setFlights(prev => prev.filter(a => a.id !== id));
    try {
        const { error } = await supabase.from('malha_raiz').delete().eq('id', id);
        if (error) {
           console.error(error);
           fetchFlights(); // rollback na interface se houver erro
        }
    } catch(e) {
        console.error(e);
        fetchFlights();
    }
  };

  const handleUpdateField = async (id: string, field: keyof MeshFlight, value: any) => {
    const updatedFlights = flights.map(a => {
        if (a.id === id) {
            return { ...a, [field]: value };
        }
        return a;
    });
    setFlights(updatedFlights);
    
    // Check if temp id
    if (id.startsWith('temp-')) return;
    
    try {
        let mappedField = field;
        if (field === 'flightNumber' || field === 'departureFlightNumber') mappedField = 'voo' as any;
        if (field === 'destination') mappedField = 'icao' as any;
        if (field === 'airline') mappedField = 'cia' as any;
        
        const { error } = await supabase.from('malha_raiz').update({ [mappedField]: value }).eq('id', id);
        if (error) {
            console.error(error);
            setFeedback({ msg: `Erro ao atualizar voo: ${error.message}`, isError: true });
        }
        
        // Re-calculate airlines if airline changed
        if (field === 'airline') {
             const uniqueAirlines = Array.from(new Set(updatedFlights.map(a => a.airline))).filter(a => Boolean(a) && a !== 'EM GERAL').sort();
             setAirlines(uniqueAirlines);
             if (activeAirline !== 'EM GERAL' && !uniqueAirlines.includes(activeAirline) && uniqueAirlines.length > 0) {
                 setActiveAirline(uniqueAirlines[0]);
             }
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
    return flights.filter(a => a.airline === activeAirline).sort((a,b) => (a.registration || '').localeCompare(b.registration || ''));
  }, [flights, activeAirline]);

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    const aircraft = currentAirlineFlights[rowIndex];
    if (!aircraft) return;
    
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
                const input = e.target as HTMLInputElement;
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
                const input = e.target as HTMLInputElement;
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
                const isBooleanField = ['missing_cap', 'defective_door', 'defective_panel', 'no_autocut', 'airline', 'actions'].includes(COLUMNS[colIndex].key);
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

          const vooRaw = getVal(['VOO', 'FLIGHT', 'NVOO', 'PREFIXO', 'FLIGHTNUMBER']);
          const isVooKey = row['VÔO'] || row['VOO'] || row['Voo'] || row['vôo'];
          const destinoRaw = getVal(['DESTINO', 'ICAO', 'DESTINATION']);
          const etaRaw = getVal(['ESTIMADO', 'ETA']);
          const etdRaw = getVal(['SAIDA', 'ETD']);
          const ciaRaw = getVal(['COMPANHIA', 'CIA', 'EMPRESA', 'AIRLINE']);

          const voo = vooRaw?.toString().toUpperCase().trim() || isVooKey?.toString().toUpperCase().trim();
          
          if (!voo) {
              missingCodeCount++;
              continue;
          }

          // Extract airline from flight number (e.g. LA3396 -> LA, RG1644 -> RG)
          let cia = ciaRaw?.toString().toUpperCase().trim() || '';
          if (!cia) {
             const ciaMatch = voo.match(/^[A-Z]{2,3}/);
             cia = ciaMatch ? ciaMatch[0] : 'OUTRA';
          }

          flightsMap.set(voo, {
              voo: voo,
              cia: cia,
              icao: destinoRaw?.toString().toUpperCase().trim() || '',
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
          // Salva as malha_raiz baseadas no voo
          // Busca os registros para descobrir os IDs, já que não temos a constraint UNIQUE forçada
          const { data: existingData, error: fetchErr } = await supabase.from('malha_raiz').select('id, voo');
          if (fetchErr) throw fetchErr;

          const existingMap = new Map((existingData || []).map((r: any) => [r.voo, r.id]));

          const finalPayload = flightsToUpsert.map((f: any) => {
              const existingId = existingMap.get(f.voo);
              if (existingId) {
                  return { ...f, id: existingId };
              }
              return f;
          });

          const { error } = await supabase
              .from('malha_raiz')
              .upsert(finalPayload);

          if (error) {
            console.error("Supabase upsert error:", error);
            throw error;
          }
          
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

        {/* TABS */}
        <div className={`h-12 shrink-0 flex border-b ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'} z-30 overflow-hidden`}>
           <nav className="flex overflow-x-auto custom-scrollbar flex-1 items-stretch">
             <button
                onClick={() => setActiveAirline('EM GERAL')}
                className={`
                    group
                    shrink-0 px-6 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-r ${isDarkMode ? 'border-slate-950/20' : 'border-slate-200'}
                    ${activeAirline === 'EM GERAL' 
                        ? (isDarkMode ? 'bg-slate-950 text-emerald-400 border-b-2 border-emerald-500' : 'bg-[#329858] text-white border-b-0')
                        : (isDarkMode ? 'text-slate-500 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')}
                `}
             >
                EM GERAL
             </button>
             {airlines.map((airlineCode, i) => (
                 <div key={i} className={`flex items-center border-r shrink-0 ${isDarkMode ? 'border-slate-950/20' : 'border-slate-200'}`}>
                     <button
                        onClick={() => setActiveAirline(airlineCode)}
                        className={`
                            h-full px-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all
                            ${activeAirline === airlineCode
                                ? (isDarkMode ? 'bg-slate-950 text-white border-b-2 border-emerald-500' : 'bg-slate-100 text-[#329858] border-b-2 border-[#1E6038]')
                                : (isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800')}
                        `}
                     >
                        {airlineCode && <AirlineLogo airlineCode={airlineCode} className="w-5 h-5 rounded-full ring-2 ring-white/10" />}
                        {airlineCode || 'OUTRA'}
                     </button>
                     <button onClick={() => setConfirmDeleteAirline(airlineCode)} className={`w-10 h-full flex items-center justify-center transition-colors border-l ${isDarkMode ? 'border-l-slate-800 text-slate-500 hover:text-red-400 hover:bg-slate-800' : 'border-l-slate-200 text-slate-400 hover:text-red-500 hover:bg-slate-200/50'}`}>
                         <Trash2 size={12} />
                     </button>
                 </div>
             ))}
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
                <table ref={tableRef} className="w-full text-left border-separate border-spacing-0">
                    <thead className={`sticky top-0 z-10 ${isDarkMode ? 'bg-slate-950 border-slate-700' : 'bg-[#2D8E48] text-white shadow-sm'}`}>
                        <tr>
                            {COLUMNS.map((col, idx) => {
                                return (
                                    <th key={idx} className={`px-2 py-3 text-[10px] font-black uppercase tracking-widest border-b border-r ${isDarkMode ? 'border-slate-800' : 'border-[#29824a]'} text-center ${col.width}`}>
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
                                        const isBooleanField = col.key === 'is_disabled';
                                        
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
                                        const extraStyle = col.key === 'registration' ? (isDarkMode ? 'text-emerald-500 tracking-tighter' : 'text-emerald-600 tracking-tighter') : '';
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
                                                        className={`w-full px-1 py-1 rounded text-[11px] font-mono font-bold ${alignStyle} outline-none focus:ring-1 ${true ? 'uppercase' : ''} ${isDarkMode ? 'bg-slate-950 text-emerald-400 border border-emerald-500/50 focus:ring-emerald-500' : 'bg-slate-100 text-emerald-700 border border-emerald-500/30 focus:ring-emerald-600'}`}
                                                    />
                                                ) : (
                                                    <div className={`font-mono text-[11px] font-bold w-full ${true ? 'uppercase justify-center' : 'justify-start'} flex items-center min-h-[24px] ${extraStyle}`}>
                                                        {col.key === 'airline' ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded bg-white overflow-hidden flex items-center justify-center p-[1px] shadow-sm border border-slate-200 shrink-0">
                                                                    <AirlineLogo airlineCode={value as string} showName={false} size="sm" />
                                                                </div>
                                                                <span>{value || '--'}</span>
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
                            <li><strong className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>DESTINO</strong> (Opcional) - ICAO de destino (ex: SBPS)</li>
                            <li><strong>ESTIMADO</strong> (Opcional) - ETA (ex: 22:50)</li>
                            <li><strong>SAÍDA</strong> (Opcional) - ETD (ex: 00:00)</li>
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
