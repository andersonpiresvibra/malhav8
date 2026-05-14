import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Trash2, Database, RefreshCw, Upload, Info } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { AirlineLogo } from './AirlineLogo';
import { AircraftType } from '../types';

interface AircraftsAdminProps {
  isDarkMode: boolean;
}

type AircraftField = 'airline' | 'model' | 'prefix' | 'missing_cap' | 'defective_door' | 'defective_panel' | 'no_autocut' | 'observations' | 'actions';

const COLUMNS: { key: AircraftField; label: string; width: string; isVariable: boolean }[] = [
  { key: 'airline', label: 'Logo', width: 'w-16', isVariable: false },
  { key: 'airline', label: 'Comp.', width: 'w-24', isVariable: true },
  { key: 'model', label: 'Modelo', width: 'w-32', isVariable: true },
  { key: 'prefix', label: 'Prefixo', width: 'w-32', isVariable: true },
  { key: 'missing_cap', label: 'S/ Tampa', width: 'w-24', isVariable: true },
  { key: 'defective_door', label: 'Portinhola Defeito', width: 'w-32', isVariable: true },
  { key: 'defective_panel', label: 'Painel Defeito', width: 'w-28', isVariable: true },
  { key: 'no_autocut', label: 'Falha Corte', width: 'w-28', isVariable: true },
  { key: 'observations', label: 'Observações', width: 'w-48', isVariable: true },
  { key: 'actions', label: 'Ações', width: 'w-20', isVariable: false },
];

export const AircraftsAdmin: React.FC<AircraftsAdminProps> = ({ isDarkMode }) => {
  const [aircrafts, setAircrafts] = useState<AircraftType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [airlines, setAirlines] = useState<string[]>([]);
  const [activeAirline, setActiveAirline] = useState<string>('');
  const [showNewAirlineModal, setShowNewAirlineModal] = useState(false);
  const [showImportInstructions, setShowImportInstructions] = useState(false);
  const [newAirlineName, setNewAirlineName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; isError: boolean } | null>(null);
  const [confirmDeleteAirline, setConfirmDeleteAirline] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        model: '--',
        prefix: 'NEW-PX',
        missing_cap: false,
        defective_door: false,
        defective_panel: false,
        no_autocut: false,
        observations: ''
    };
    
    setAircrafts([...aircrafts, newAircraft]);
    
    try {
        const { data, error } = await supabase.from('aircrafts').insert({
            airline: newAircraft.airline,
            model: newAircraft.model,
            prefix: newAircraft.prefix,
            missing_cap: newAircraft.missing_cap,
            defective_door: newAircraft.defective_door,
            defective_panel: newAircraft.defective_panel,
            no_autocut: newAircraft.no_autocut,
            observations: newAircraft.observations
        }).select().single();
        
        if (error) {
            setFeedback({ msg: `Erro ao criar aeronave: ${error.message}`, isError: true });
            setAircrafts(prev => prev.filter(a => a.id !== tempId));
            return;
        }

        if (data) {
            setAircrafts(prev => prev.map(a => a.id === tempId ? data as AircraftType : a));
            setEditingCell({ rowId: data.id, col: 1 });
        }
    } catch (e: any) {
        setFeedback({ msg: `Exceção ao criar aeronave: ${e.message}`, isError: true });
        setAircrafts(prev => prev.filter(a => a.id !== tempId));
    }
  };

  const handleDeleteAirline = async (airlineCode: string) => {
    try {
        const { error } = await supabase.from('aircrafts').delete().eq('airline', airlineCode);
        
        if (error) {
            console.error('Error deleting airline', error);
            setFeedback({ msg: `Erro ao excluir a companhia: ${error.message}`, isError: true });
            return;
        }

        // update local state
        setAircrafts(prev => prev.filter(a => a.airline !== airlineCode));
        const newAirlines = airlines.filter(a => a !== airlineCode);
        setAirlines(newAirlines);
        if (newAirlines.length > 0) {
            setActiveAirline(newAirlines[0]);
        } else {
            setActiveAirline('');
        }
    } catch(e: any) {
        console.error(e);
        setFeedback({ msg: `Ocorreu um erro inesperado ao excluir. ${e?.message || ''}`, isError: true });
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
        const { error } = await supabase.from('aircrafts').update({ [field]: value }).eq('id', id);
        if (error) {
            console.error(error);
            setFeedback({ msg: `Erro ao atualizar aeronave: ${error.message}`, isError: true });
        }
        
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

    const processImport = async (data: any[]) => {
      setIsImporting(true);
      
      const aircraftsMap = new Map<string, any>();
      let missingPrefixCount = 0;

      for (const row of data) {
          // Helper OBRIGATÓRIO (Extremamente robusto):
          // Ignora acentos, espaços de entrelinhas, underscores (_) ou hifens (-).
          // Tudo é reduzido a apenas letras (A-Z) para não haver MAIS ERROS.
          const getVal = (possibleKeys: string[]) => {
              for (const key of Object.keys(row)) {
                  // Limpa: 'S_TAMPA' -> 'STAMPA', 'PORTINHOLA_DEFEITO' -> 'PORTINHOLADEFEITO'
                  const cleanKey = key.toString().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z]/g, '');
                  if (possibleKeys.includes(cleanKey)) {
                      return row[key];
                  }
              }
              return undefined;
          };

          const prefixRaw = getVal(['PREFIXO', 'PREFRES', 'MATRICULA']);
          const airlineRaw = getVal(['COMPANHIA', 'EMPRESA', 'CIA']);
          const modelRaw = getVal(['MODELO', 'EQUIPAMENTO']);
          const missingCapRaw = getVal(['STAMPA', 'SEMTAMPA', 'TAMPA']);
          const defDoorRaw = getVal(['PORTINHOLADEFEITO', 'PORTINHOLA', 'DEFEITOPORTINHOLA']);
          const defPanelRaw = getVal(['PAINELDEFEITO', 'PAINEL', 'DEFEITOPAINEL']);
          const noAutocutRaw = getVal(['FALHACORTE', 'CORTE', 'NAOCORTA']);
          const obsRaw = getVal(['OBSERVACOES', 'OBSERVACAO', 'OBS']);

          const prefix = prefixRaw?.toString().toUpperCase().trim();
          
          if (!prefix) {
              missingPrefixCount++;
              continue;
          }

          let airline = airlineRaw?.toString().toUpperCase().trim();
          if (!airline && activeAirline) airline = activeAirline.toUpperCase().trim();
          if (!airline) airline = 'OUTRA'; // Fallback absoluto

          const model = modelRaw?.toString().toUpperCase().trim() || '--';
          
          // Função helper para tratar valores Booleanos/Checkbox (Aceita SIM, S, TRUE, 1, X)
          const checkBoolean = (val: any) => {
              if (val === true || val === 1) return true;
              const str = val?.toString().toUpperCase().trim();
              return str === 'SIM' || str === 'S' || str === 'TRUE' || str === '1' || str === 'X';
          };

          aircraftsMap.set(prefix, {
              prefix,
              airline,
              model,
              missing_cap: checkBoolean(missingCapRaw),
              defective_door: checkBoolean(defDoorRaw),
              defective_panel: checkBoolean(defPanelRaw),
              no_autocut: checkBoolean(noAutocutRaw),
              observations: obsRaw?.toString().trim() || ''
          });
      }

      const aircraftsToUpsert = Array.from(aircraftsMap.values());

      if (aircraftsToUpsert.length === 0) {
          setFeedback({ msg: `ERRO: Nenhuma linha válida encontrada para importar.\n\nLinhas ignoradas por falta de PREFIXO: ${missingPrefixCount}\n\nDICA: Verifique se o título da coluna de prefixo na primeira linha é "PREFIXO".`, isError: true });
          setIsImporting(false);
          return;
      }

      try {
          // Salva as aeronaves baseadas no Prefixo (UPSERT substitui se já existe)
          const { error } = await supabase
              .from('aircrafts')
              .upsert(aircraftsToUpsert, { onConflict: 'prefix', ignoreDuplicates: false });

          if (error) {
            console.error("Supabase upsert error:", error);
            throw error;
          }
          
          let msg = `SUCESSO! Importação concluída.\n\nAeronaves importadas/atualizadas: ${aircraftsToUpsert.length}`;
          if (missingPrefixCount > 0) {
              msg += `\n\n(Aviso: ${missingPrefixCount} linhas foram ignoradas por estarem vazias ou não terem a coluna PREFIXO preenchida corretamente)`;
          }
          setFeedback({ msg, isError: false });
      } catch (err: any) {
          console.error("Erro no upsert de aeronaves:", err);
          setFeedback({ msg: `ERRO CRÍTICO ao salvar as aeronaves no Banco de Dados.\n\nMensagem técnica: ${err?.message || 'Falha de comunicação.'}`, isError: true });
      }

      setIsImporting(false);
      fetchAircrafts(); // Recarrega todas as abas e dados localmente exibindo o resultado fresco
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

  const currentAirlineAircrafts = useMemo(() => {
    return aircrafts.filter(a => a.airline === activeAirline).sort((a,b) => a.prefix.localeCompare(b.prefix));
  }, [aircrafts, activeAirline]);

  return (
    <div className={`flex flex-col h-full ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-800'}`}>
        {/* HEADER */}
        <div className={`shrink-0 h-16 border-b flex items-center justify-between px-4 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.5)]'} z-20`}>
           <div className="flex flex-col justify-center">
               <div className="flex items-center gap-2">
                    <Database size={16} className={isDarkMode ? 'text-emerald-500' : 'text-emerald-600'} />
                    <h1 className="text-sm font-black uppercase tracking-widest">Aeronaves</h1>
                    {isLoading && <RefreshCw size={12} className="animate-spin ml-2 text-slate-500" />}
               </div>
               <span className={`text-[10px] font-medium tracking-wide ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Gerencie o banco de dados de aeronaves por companhia</span>
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
                   className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm ${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300'} active:scale-95`}
               >
                   <Info size={12} /> Instruções XLSX
               </button>
               <button 
                   onClick={() => fileInputRef.current?.click()}
                   disabled={isImporting}
                   className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm ${isDarkMode ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'} ${isImporting ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
               >
                   {isImporting ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />} 
                   {isImporting ? 'Importando...' : 'Importar XLSX'}
               </button>
               {activeAirline && airlines.includes(activeAirline) && (
                 <button 
                     onClick={() => setConfirmDeleteAirline(activeAirline)}
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
                                        const isBooleanField = ['missing_cap', 'defective_door', 'defective_panel', 'no_autocut'].includes(col.key);
                                        
                                        if (isBooleanField) {
                                            return (
                                                <td key={`${aircraft.id}-${col.key}-${colIndex}`} className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-slate-800/20' : 'border-slate-200 bg-white group-hover:bg-slate-50'} text-center align-middle`}>
                                                    <div className="flex items-center justify-center">
                                                        <input 
                                                            type="checkbox"
                                                            checked={!!value}
                                                            onChange={(e) => handleUpdateField(aircraft.id, col.key as keyof AircraftType, e.target.checked)}
                                                            className={`w-4 h-4 rounded cursor-pointer ${isDarkMode ? 'accent-emerald-500 bg-slate-900 border-slate-700' : 'accent-[#329858] bg-white border-slate-300'}`}
                                                        />
                                                    </div>
                                                </td>
                                            );
                                        }

                                        // Conditional styles based on column
                                        const extraStyle = col.key === 'prefix' ? (isDarkMode ? 'text-emerald-500 tracking-tighter' : 'text-emerald-600 tracking-tighter') : '';
                                        const alignStyle = col.key === 'observations' ? 'text-left px-2' : 'text-center';

                                        return (
                                            <td 
                                                key={`${aircraft.id}-${col.key}-${colIndex}`} 
                                                className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-slate-800/20 text-slate-300' : 'border-slate-200 bg-white group-hover:bg-slate-50 text-slate-700'} ${alignStyle} relative cursor-text align-middle transition-colors`}
                                                onClick={() => setEditingCell({ rowId: aircraft.id, col: colIndex })}
                                            >
                                                {isEditingObj ? (
                                                    <input 
                                                        autoFocus
                                                        value={value as string || ''}
                                                        onChange={(e) => {
                                                            const val = col.key === 'observations' ? e.target.value : e.target.value.toUpperCase();
                                                            handleUpdateField(aircraft.id, col.key as keyof AircraftType, val);
                                                        }}
                                                        onBlur={() => setEditingCell(null)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null);
                                                        }}
                                                        className={`w-full px-1 py-1 rounded text-[11px] font-mono font-bold ${alignStyle} outline-none focus:ring-1 ${col.key !== 'observations' ? 'uppercase' : ''} ${isDarkMode ? 'bg-slate-950 text-emerald-400 border border-emerald-500/50 focus:ring-emerald-500' : 'bg-slate-100 text-emerald-700 border border-emerald-500/30 focus:ring-emerald-600'}`}
                                                    />
                                                ) : (
                                                    <div className={`font-mono text-[11px] font-bold w-full ${col.key !== 'observations' ? 'uppercase justify-center' : 'justify-start'} flex items-center min-h-[24px] ${extraStyle}`}>
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

        {/* IMPORT INSTRUCTIONS MODAL */}
        {showImportInstructions && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm shadow-2xl">
                <div className={`p-6 rounded-xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] w-full max-w-lg flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                    <div className="flex items-center gap-3 border-b pb-3 border-slate-200 dark:border-slate-800">
                        <Info className={isDarkMode ? 'text-blue-400' : 'text-blue-600'} />
                        <h2 className="font-black text-sm uppercase tracking-widest">Instruções para Importação XLSX</h2>
                    </div>
                    
                    <div className="text-sm space-y-3">
                        <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                            Para importar dados em lote, sua planilha Excel (<span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">.xlsx</span>) 
                            deve conter na primeira linha (cabeçalho) as seguintes colunas exatas (em maiúsculo):
                        </p>
                        
                        <ul className="list-disc pl-5 space-y-1 font-mono text-[11px] mb-2">
                            <li><strong className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>PREFIXO</strong> (Obrigatório) - Prefixo da aeronave (ex: PR-XMB). Também aceitamos <span className="text-gray-500">PREF.RES, MATRICULA ou PREFIX.</span></li>
                            <li><strong className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>COMPANHIA</strong> (Opcional) - Se não informada, a importação usará a Cia selecionada na aba.</li>
                            <li><strong>MODELO</strong> (Opcional) - Ex: B738, A320</li>
                            <li><strong>S_TAMPA</strong> (Opcional) - Use "SIM", "S" ou "TRUE" se não tiver tampa.</li>
                            <li><strong>PORTINHOLA_DEFEITO</strong> (Opcional) - Mesmo padrão acima.</li>
                            <li><strong>PAINEL_DEFEITO</strong> (Opcional) - Mesmo padrão acima.</li>
                            <li><strong>FALHA_CORTE</strong> (Opcional) - Mesmo padrão acima.</li>
                            <li><strong>OBSERVACOES</strong> (Opcional) - Texto livre.</li>
                        </ul>
                        
                        <div className={`p-3 rounded text-xs border ${isDarkMode ? 'bg-amber-900/20 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                            <strong>Nota Importante:</strong> O sistema tentará encontrar a aeronave pelo <strong>PREFIXO</strong>. 
                            Se ela já existir, seus dados serão atualizados. Caso contrário, uma nova aeronave será inserida.
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
            </div>
        )}

        {/* NEW AIRLINE MODAL */}
        {showNewAirlineModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm shadow-2xl">
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

        {/* CONFIRM DELETE AIRLINE MODAL */}
        {confirmDeleteAirline && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm shadow-2xl">
                <div className={`p-6 rounded-xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] w-full max-w-sm flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                    <h2 className={`font-black text-sm uppercase tracking-widest ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                        Confirmar Exclusão
                    </h2>
                    <div className={`text-sm whitespace-pre-wrap font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        Deseja realmente excluir a companhia <strong className="uppercase">{confirmDeleteAirline}</strong> e todas as suas aeronaves cadastradas?
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
            </div>
        )}

        {/* FEEDBACK MODAL */}
        {feedback && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm shadow-2xl">
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
            </div>
        )}
    </div>
  );
};
