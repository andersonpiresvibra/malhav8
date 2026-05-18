import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Database, RefreshCw, Upload, Info, Image as ImageIcon, FileSpreadsheet, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { AirlineLogo } from './AirlineLogo';
import { AirlineType } from '../types';
import { downloadTemplate } from '../utils/excelTemplateUtils';

interface AirlinesAdminProps {
  isDarkMode: boolean;
}

type AirlineField = 'logo_url' | 'legal_name' | 'airline' | 'airline_code' | 'country' | 'equipment_count' | 'flight_count' | 'is_active' | 'actions';

const COLUMNS: { key: AirlineField; label: string; width: string; isVariable: boolean }[] = [
  { key: 'logo_url', label: 'Logo', width: 'w-16', isVariable: true },
  { key: 'legal_name', label: 'Razão social', width: 'w-auto min-w-[200px]', isVariable: true },
  { key: 'airline', label: 'Comp.', width: 'w-32', isVariable: true },
  { key: 'airline_code', label: 'Cód. da Comp', width: 'w-32', isVariable: true },
  { key: 'country', label: 'País/Região', width: 'w-32', isVariable: true },
  { key: 'equipment_count', label: 'Qnt Aeron.', width: 'w-24', isVariable: false },
  { key: 'flight_count', label: 'Qnt. Voos', width: 'w-24', isVariable: false },
  { key: 'is_active', label: 'Ativo', width: 'w-24', isVariable: true },
  { key: 'actions', label: 'Ações', width: 'w-20', isVariable: false },
];

export const AirlinesAdmin: React.FC<AirlinesAdminProps> = ({ isDarkMode }) => {
  const [airlines, setAirlines] = useState<(AirlineType & { equipment_count?: number; flight_count?: number })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'GERAL' | 'NACIONAL' | 'INTERNACIONAL' | 'EXECUTIVA'>('GERAL');
  
  const filteredAirlines = useMemo(() => {
    if (activeTab === 'GERAL') return airlines;
    
    return airlines.filter(a => {
        if (activeTab === 'EXECUTIVA') return a.category === 'EXECUTIVA';
        
        const country = a.country?.toUpperCase()?.trim() || '';
        const isBrasil = country === 'BRASIL' || country === 'BR' || country === 'BRAZIL';
        
        if (activeTab === 'NACIONAL') return isBrasil;
        if (activeTab === 'INTERNACIONAL') return !isBrasil && a.category !== 'EXECUTIVA';
        
        return a.category === activeTab;
    });
  }, [airlines, activeTab]);
  
  const [showImportInstructions, setShowImportInstructions] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; isError: boolean } | null>(null);
  const [confirmDeleteAirline, setConfirmDeleteAirline] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const tableRef = useRef<HTMLTableElement>(null);

  const getLogoUrl = (code: string) => {
    if (!code) return '';
    const upper = code.toUpperCase();
    if (upper === 'G3' || upper === 'RG') {
        return 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Gol_Linhas_A%C3%A9reas_Inteligentes_logo_2015.svg/320px-Gol_Linhas_A%C3%A9reas_Inteligentes_logo_2015.svg.png';
    }
    return `https://images.kiwi.com/airlines/64/${upper}.png`;
  };

  const [focusedCell, setFocusedCell] = useState<{ rowId: string; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: number } | null>(null);
  const [isKeystrokeEdit, setIsKeystrokeEdit] = useState(false);

  const fetchAirlines = async () => {
    setIsLoading(true);
    try {
        const { data: airlinesData, error } = await supabase.from('companhias').select('*').order('airline');
        if (error) {
            console.error('Error fetching airlines', error);
            return;
        }

        // Fetch counts from aeronaves and malha_raiz
        const { data: aeronaves } = await supabase.from('aeronaves').select('airline');
        const { data: malha } = await supabase.from('malha_raiz').select('flight_number, airline_code');

        const equipCounts: Record<string, number> = {};
        const flightCounts: Record<string, number> = {};

        if (aeronaves) {
            aeronaves.forEach(a => {
                if (a.airline) {
                    equipCounts[a.airline] = (equipCounts[a.airline] || 0) + 1;
                }
            });
        }

        if (malha) {
            malha.forEach(m => {
                const cia = m.airline_code || (m.flight_number ? m.flight_number.match(/^[A-Z]{2,3}/)?.[0] : null);
                if (cia) {
                    flightCounts[cia] = (flightCounts[cia] || 0) + 1;
                }
            });
        }

        const enrichedAirlines = (airlinesData as AirlineType[]).map(a => ({
            ...a,
            equipment_count: equipCounts[a.airline_code] || equipCounts[a.airline] || 0, // Fallback check
            flight_count: flightCounts[a.airline_code] || 0
        }));

        setAirlines(enrichedAirlines);
    } catch (e) {
        console.error('Exception fetching airlines', e);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAirlines();
  }, []);

  const handleCreateNewAirline = async () => {
    try {
        const payload: Omit<AirlineType, 'id'> = {
            legal_name: '',
            airline: '',
            airline_code: '',
            country: '',
            is_active: true,
            category: activeTab === 'GERAL' ? 'NACIONAL' : activeTab,
        };

        const { data, error } = await supabase.from('companhias').insert(payload).select().single();
        if (error) {
            setFeedback({ msg: `Erro ao criar companhia: ${error.message}`, isError: true });
        } else if (data) {
            setAirlines(prev => [...prev, { ...data, equipment_count: 0, flight_count: 0 } as any]);
        }
    } catch (e: any) {
        setFeedback({ msg: `Exceção ao criar companhia: ${e.message}`, isError: true });
    }
  };

  const handleDeleteAirline = async (id: string) => {
    try {
        const { error } = await supabase.from('companhias').delete().eq('id', id);
        if (error) {
             setFeedback({ msg: `Erro ao excluir companhia: ${error.message}`, isError: true });
        } else {
             setAirlines(prev => prev.filter(c => c.id !== id));
             setConfirmDeleteAirline(null);
        }
    } catch (e: any) {
        setFeedback({ msg: `Erro ao excluir companhia: ${e.message}`, isError: true });
    }
  };

  const handleDeleteAll = async () => {
    try {
        const { error } = await supabase.from('companhias').delete().not('id', 'is', null);
        if (error) {
             setFeedback({ msg: `Erro ao excluir dados: ${error.message}`, isError: true });
        } else {
             setAirlines([]);
             setConfirmDeleteAll(false);
             setFeedback({ msg: 'Todos os registros foram excluídos com sucesso.', isError: false });
        }
    } catch (e: any) {
        setFeedback({ msg: `Erro de rede: ${e.message}`, isError: true });
    }
  };

  const handleUpdateField = async (id: string, field: keyof AirlineType, value: any) => {
    let updatePayload: any = { [field]: value };
    
    // Auto-update category if country changes
    if (field === 'country') {
        const upperCountry = String(value || '').toUpperCase();
        if (upperCountry === 'BRASIL' || upperCountry === 'BR' || upperCountry === 'BRAZIL') {
            updatePayload.category = 'NACIONAL';
        } else if (value) {
            updatePayload.category = 'INTERNACIONAL';
        }
    }

    setAirlines(prev => prev.map(c => c.id === id ? { ...c, ...updatePayload } : c));
    try {
        const { error } = await supabase.from('companhias').update(updatePayload).eq('id', id);
        if (error) {
            setFeedback({ msg: `Erro ao atualizar companhia: ${error.message}`, isError: true });
            fetchAirlines(); // Revert
        }
    } catch (e: any) {
         setFeedback({ msg: `Erro de rede: ${e.message}`, isError: true });
         fetchAirlines(); // Revert
    }
  };
  
  const handlePhotoClick = (rowId: string) => {
    photoInputRefs.current[rowId]?.click();
  };

  const handlePhotoFileChange = (rowId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        handleUpdateField(rowId, 'logo_url', dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFinishEdit = () => {
      setEditingCell(null);
      setIsKeystrokeEdit(false);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setFeedback(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) {
          throw new Error('A planilha está vazia.');
        }
        
        const normalizedData = jsonData.map(row => {
            const normalizedRow: any = {};
            for (const key in row) {
                normalizedRow[key.trim().toUpperCase()] = row[key];
            }
            return normalizedRow;
        });

        const airlinesToUpsert = [];
        const seenCodes = new Set<string>();
        let missingCodeCount = 0;

        for (const row of normalizedData) {
            // Find logic similar to aircrafts
            const rawLegal = row['RAZÃO'] || row['RAZÃO SOCIAL'] || row['LEGAL'] || row['NOME'] || row['LEGAL_NAME'] || '';
            const rawAirline = row['COMP.'] || row['COMPANHIA'] || row['AIRLINE'] || '';
            const rawCode = row['CÓD. DA COMP'] || row['COD. COMP.'] || row['CODIGO'] || row['CÓD.'] || row['CODE'] || row['AIRLINE_CODE'] || '';
            const rawCountry = row['PAÍS/REGIÃO'] || row['PAÍS'] || row['COUNTRY'] || '';

            const legalNameStr = String(rawLegal).trim();
            const airlineStr = String(rawAirline).trim();
            const codeStr = String(rawCode).trim().toUpperCase();
            const countryStr = String(rawCountry).trim();

            if (!codeStr) {
                missingCodeCount++;
                continue;
            }

            if (seenCodes.has(codeStr)) {
                // If there are duplicate codes in the excel file, keep the first one
                continue;
            }
            seenCodes.add(codeStr);

            let categoryToUse: 'NACIONAL' | 'INTERNACIONAL' | 'EXECUTIVA' = activeTab as any;
            if (activeTab === 'GERAL') categoryToUse = 'NACIONAL';
            
            if (countryStr) {
                const upperCountry = countryStr.toUpperCase();
                if (upperCountry === 'BRASIL' || upperCountry === 'BR' || upperCountry === 'BRAZIL') {
                    categoryToUse = 'NACIONAL';
                } else if (upperCountry) {
                    categoryToUse = 'INTERNACIONAL';
                }
            }

            airlinesToUpsert.push({
                legal_name: legalNameStr,
                airline: airlineStr || codeStr,
                airline_code: codeStr,
                country: countryStr,
                is_active: true,
                category: categoryToUse,
            });
        }

        if (airlinesToUpsert.length === 0) {
            throw new Error('Nenhum dado válido encontrado para importação (Cód. da Comp é obrigatório).');
        }

        const { error } = await supabase
            .from('companhias')
            .upsert(airlinesToUpsert, { onConflict: 'airline_code', ignoreDuplicates: false });

        if (error) {
            throw error;
        }

        let msg = `SUCESSO! Importação concluída.\n\nCompanhias importadas/atualizadas: ${airlinesToUpsert.length}`;
        if (missingCodeCount > 0) {
            msg += `\n\n(Aviso: ${missingCodeCount} linhas foram ignoradas por estarem sem Cód. da Comp)`;
        }

        setFeedback({ msg, isError: false });
        fetchAirlines();
      } catch (err: any) {
         setFeedback({ msg: `Erro: ${err.message}`, isError: true });
      } finally {
         setIsImporting(false);
         if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
        setFeedback({ msg: 'Erro na leitura do arquivo.', isError: true });
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
      if (editingCell) {
          if (e.key === 'Enter') {
              e.preventDefault();
              handleFinishEdit();
              if (rowIndex < filteredAirlines.length - 1) {
                  setFocusedCell({ rowId: filteredAirlines[rowIndex + 1].id, col: colIndex });
              }
          } else if (e.key === 'Escape') {
              handleFinishEdit();
          } else if (e.key === 'Tab') {
              e.preventDefault();
              handleFinishEdit();
              if (!e.shiftKey && colIndex < COLUMNS.length - 2) { 
                  setFocusedCell({ rowId: filteredAirlines[rowIndex].id, col: colIndex + 1 });
              } else if (e.shiftKey && colIndex > 1) {
                  setFocusedCell({ rowId: filteredAirlines[rowIndex].id, col: colIndex - 1 });
              }
          }
          return;
      }

      const isModifierKeys = e.ctrlKey || e.altKey || e.metaKey;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (rowIndex < filteredAirlines.length - 1) {
              setFocusedCell({ rowId: filteredAirlines[rowIndex + 1].id, col: colIndex });
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (rowIndex > 0) {
              setFocusedCell({ rowId: filteredAirlines[rowIndex - 1].id, col: colIndex });
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (colIndex < COLUMNS.length - 2) {
              setFocusedCell({ rowId: filteredAirlines[rowIndex].id, col: colIndex + 1 });
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (colIndex > 1) {
              setFocusedCell({ rowId: filteredAirlines[rowIndex].id, col: colIndex - 1 });
          }
          break;
        case 'Enter':
        case 'F2':
          e.preventDefault();
          if (COLUMNS[colIndex].isVariable && COLUMNS[colIndex].key !== 'is_active' && COLUMNS[colIndex].key !== 'logo_url') {
              setEditingCell({ rowId: filteredAirlines[rowIndex].id, col: colIndex });
              setIsKeystrokeEdit(false);
          }
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          if (COLUMNS[colIndex].isVariable && COLUMNS[colIndex].key !== 'is_active' && COLUMNS[colIndex].key !== 'logo_url') {
              handleUpdateField(filteredAirlines[rowIndex].id, COLUMNS[colIndex].key as keyof AirlineType, '');
          }
          break;
        default:
          if (!isModifierKeys && e.key.length === 1 && COLUMNS[colIndex].isVariable && COLUMNS[colIndex].key !== 'is_active' && COLUMNS[colIndex].key !== 'logo_url') {
              e.preventDefault();
              handleUpdateField(filteredAirlines[rowIndex].id, COLUMNS[colIndex].key as keyof AirlineType, e.key.toUpperCase());
              setEditingCell({ rowId: filteredAirlines[rowIndex].id, col: colIndex });
              setIsKeystrokeEdit(true);
          }
          break;
      }
  };
  
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* HEADER */}
        <div className={`flex justify-between items-end px-6 py-4 border-b shrink-0 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
           <div className="flex flex-col justify-center">
               <div className="flex items-center gap-2">
                    <Database size={16} className={isDarkMode ? 'text-emerald-500' : 'text-emerald-600'} />
                    <h1 className="text-sm font-black uppercase tracking-widest">Companhias Aéreas</h1>
                    {isLoading && <RefreshCw size={12} className="animate-spin ml-2 text-slate-500" />}
               </div>
               <span className={`text-[10px] font-medium tracking-wide ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Gerencie o banco de dados de companhias aéreas</span>
           </div>
           
           <div className="flex items-center gap-3">
               <button 
                  onClick={() => setShowImportInstructions(true)} 
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded shadow-md transition-colors flex items-center gap-1.5 active:scale-95 ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'}`}
               >
                  <Upload size={14} /> IMPORTAR (XLSX)
               </button>
               <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleImportExcel} 
               />
               <button 
                  onClick={() => setConfirmDeleteAll(true)} 
                  className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded shadow-md transition-colors flex items-center gap-1.5 active:scale-95 ${isDarkMode ? 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20' : 'bg-white hover:bg-red-50 text-red-600 border border-red-200'}`}
               >
                  <Trash2 size={14} /> LIMPAR TUDO
               </button>
               <button onClick={handleCreateNewAirline} className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded shadow-md transition-colors flex items-center gap-1.5 active:scale-95 ${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-[#329858] hover:bg-[#29824a] text-white'}`}>
                  <Plus size={14} /> NOVO
               </button>
           </div>
        </div>

        {/* TABS */}
        <div className={`flex items-center gap-6 px-6 border-b shrink-0 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
           {(['GERAL', 'NACIONAL', 'INTERNACIONAL', 'EXECUTIVA'] as const).map(tab => (
               <button
                  key={tab}
                  onClick={() => {
                      setActiveTab(tab);
                      setFocusedCell(null);
                      setEditingCell(null);
                  }}
                  className={`py-3 text-[10px] font-black uppercase tracking-widest transition-colors border-b-2 ${activeTab === tab ? (isDarkMode ? 'border-emerald-500 text-emerald-400' : 'border-[#29824a] text-[#29824a]') : 'border-transparent ' + (isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-800')}`}
               >
                  {tab}
               </button>
           ))}
        </div>

        {/* FEEDBACK BANNERS */}
        {feedback && (
            <div className={`p-4 ${feedback.isError ? 'bg-red-500/10 text-red-500 border-b border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-b border-emerald-500/20'} flex justify-between items-start shrink-0`}>
                <span className="text-xs font-medium whitespace-pre-wrap">{feedback.msg}</span>
                <button onClick={() => setFeedback(null)} className="text-xs uppercase font-bold hover:underline opacity-80">Voltar</button>
            </div>
        )}

        {/* GRID VIEW */}
        <div className={`w-full flex-1 overflow-auto relative flex justify-start custom-scrollbar items-start ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
            <div className={`w-[65%] border-r border-b text-left ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
                <table ref={tableRef} className="w-full text-left border-separate border-spacing-0">
                    <thead className={`sticky top-0 z-10 ${isDarkMode ? 'bg-slate-950 border-slate-700' : 'bg-[#2D8E48] text-white shadow-sm'}`}>
                        <tr>
                            {COLUMNS.map((col, idx) => (
                                <th key={idx} className={`px-2 py-3 text-[10px] font-black uppercase tracking-widest border-b border-r last:border-r-0 ${isDarkMode ? 'border-slate-800' : 'border-[#29824a]'} text-center ${col.width}`}>
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAirlines.length === 0 ? (
                            <tr>
                                <td colSpan={COLUMNS.length} className={`px-4 py-8 text-center text-[10px] border-b uppercase tracking-widest font-black ${isDarkMode ? 'bg-slate-900 text-slate-500' : 'bg-white text-slate-400'}`}>
                                    Nenhuma companhia cadastrada nesta aba
                                </td>
                            </tr>
                        ) : (
                            filteredAirlines.map((airline, rowIndex) => (
                                <tr key={airline.id} data-row={rowIndex} className={`group transition-colors h-10 border-b ${isDarkMode ? 'hover:bg-slate-800/50 border-slate-800/50' : 'hover:bg-slate-50 border-slate-200'}`}>
                                    {COLUMNS.map((col, colIndex) => {
                                        const isFocused = focusedCell?.rowId === airline.id && focusedCell?.col === colIndex;
                                        const focusClasses = isFocused ? 'ring-2 ring-emerald-500 ring-inset z-10 shadow-[inset_0_0_0_2px_rgba(16,185,129,0.5)]' : '';

                                        if (col.key === 'logo_url') {
                                            return (
                                                <td 
                                                    key={`${airline.id}-logo`} 
                                                    onClick={() => handlePhotoClick(airline.id)}
                                                    className={`px-2 border-y border-l cursor-pointer ${isDarkMode ? 'border-slate-700/50 bg-slate-800/20' : 'border-slate-200 bg-white group-hover:bg-slate-50'} text-center align-middle ${focusClasses}`}
                                                >
                                                    <div className="w-8 h-8 rounded bg-white overflow-hidden mx-auto flex items-center justify-center p-0.5 shadow-sm border border-slate-200 group/logo relative">
                                                        {airline.logo_url ? (
                                                           <img src={airline.logo_url} alt="Logo" className="w-full h-full object-contain bg-white" />
                                                        ) : airline.airline_code ? (
                                                           <>
                                                             <img src={getLogoUrl(airline.airline_code)} alt="Logo" className="w-full h-full object-contain bg-white" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                                                             <div className="hidden w-full h-full flex items-center justify-center">
                                                                <ImageIcon size={14} className="text-slate-300" />
                                                             </div>
                                                           </>
                                                        ) : (
                                                           <ImageIcon size={14} className="text-slate-300" />
                                                        )}
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/logo:opacity-100 flex items-center justify-center transition-opacity rounded">
                                                            <Upload size={14} className="text-white" />
                                                        </div>
                                                    </div>
                                                    <input 
                                                      type="file" 
                                                      accept="image/png, image/jpeg" 
                                                      className="hidden" 
                                                      ref={(el) => (photoInputRefs.current[airline.id] = el)}
                                                      onChange={(e) => handlePhotoFileChange(airline.id, e)} 
                                                    />
                                                </td>
                                            );
                                        }

                                        if (col.key === 'actions') {
                                            return (
                                                <td 
                                                  key={`${airline.id}-actions`} 
                                                  data-col={colIndex}
                                                  tabIndex={0}
                                                  onClick={() => setFocusedCell({ rowId: airline.id, col: colIndex })}
                                                  onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                                  className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-slate-800/20' : 'border-slate-200 bg-white group-hover:bg-slate-50'} text-center actions-container align-middle outline-none ${focusClasses}`}
                                                >
                                                    <div className="flex justify-center">
                                                        <button onClick={() => setConfirmDeleteAirline(airline.id)} className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${isDarkMode ? 'hover:bg-red-500/20 text-slate-400 hover:text-red-400' : 'hover:bg-red-500/10 text-slate-400 hover:text-red-500'}`}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            );
                                        }

                                        const value = airline[col.key as keyof typeof airline];
                                        const isEditingObj = editingCell?.rowId === airline.id && editingCell?.col === colIndex;
                                        const isBooleanField = col.key === 'is_active';
                                        
                                        if (isBooleanField) {
                                            return (
                                                <td 
                                                  key={`${airline.id}-${col.key}-${colIndex}`} 
                                                  data-col={colIndex}
                                                  tabIndex={0}
                                                  onClick={() => setFocusedCell({ rowId: airline.id, col: colIndex })}
                                                  onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                                  className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-slate-800/20' : 'border-slate-200 bg-white group-hover:bg-slate-50'} text-center align-middle outline-none ${focusClasses}`}
                                                >
                                                    <div className="flex items-center justify-center">
                                                        <input 
                                                            type="checkbox"
                                                            checked={!!value}
                                                            onChange={(e) => handleUpdateField(airline.id, col.key as keyof AirlineType, e.target.checked)}
                                                            className={`w-4 h-4 rounded cursor-pointer ${isDarkMode ? 'accent-emerald-500 bg-slate-900 border-slate-700' : 'accent-[#329858] bg-white border-slate-300'}`}
                                                        />
                                                    </div>
                                                </td>
                                            );
                                        }

                                        return (
                                            <td 
                                                key={`${airline.id}-${col.key}-${colIndex}`} 
                                                data-col={colIndex}
                                                tabIndex={0}
                                                onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                                className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-slate-800/20 text-slate-300' : 'border-slate-200 bg-white group-hover:bg-slate-50 text-slate-700'} ${col.key === 'legal_name' ? 'text-left px-3' : 'text-center'} relative ${col.isVariable ? 'cursor-text' : 'opacity-70'} align-middle transition-colors outline-none ${focusClasses}`}
                                                onClick={(e) => {
                                                  setFocusedCell({ rowId: airline.id, col: colIndex });
                                                  if (col.isVariable) {
                                                      setEditingCell({ rowId: airline.id, col: colIndex });
                                                      const target = e.currentTarget;
                                                      setTimeout(() => {
                                                         (target as HTMLElement).focus();
                                                      }, 0);
                                                  }
                                                }}
                                            >
                                                {isEditingObj ? (
                                                    <input 
                                                        autoFocus
                                                        value={(value as string) || ''}
                                                        onChange={(e) => {
                                                            let val = e.target.value;
                                                            if (col.key !== 'legal_name') val = val.toUpperCase();
                                                            handleUpdateField(airline.id, col.key as keyof AirlineType, val);
                                                        }}
                                                        onBlur={() => handleFinishEdit()}
                                                        onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                                        className={`w-full px-1 py-1 rounded text-[11px] font-mono font-bold ${col.key === 'legal_name' ? 'text-left' : 'text-center'} outline-none focus:ring-1 ${col.key !== 'legal_name' ? 'uppercase' : ''} ${isDarkMode ? 'bg-slate-950 text-emerald-400 border border-emerald-500/50 focus:ring-emerald-500' : 'bg-slate-100 text-emerald-700 border border-emerald-500/30 focus:ring-emerald-600'}`}
                                                    />
                                                ) : (
                                                    <div className={`font-mono text-[11px] font-bold w-full ${col.key !== 'legal_name' ? 'uppercase justify-center' : 'justify-start'} flex items-center min-h-[24px]`}>
                                                        {value !== undefined ? value : '--'}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* LOGOS DIV */}
            <div className="w-[35%] p-1 flex flex-col items-center justify-start min-h-[500px] gap-1">
                 <div className={`flex flex-col items-start justify-center p-3 w-full rounded-[3px] shadow-sm border shrink-0 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                     <h3 className={`text-base font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Galeria de Logos</h3>
                     <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{filteredAirlines.length} empresas listadas nesta aba</p>
                 </div>
                 <div className={`flex flex-wrap gap-3 justify-start content-start overflow-auto p-3 w-full flex-1 border-0 rounded-[3px] ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                     {filteredAirlines.map(airline => (
                         <div 
                             key={airline.id} 
                             className="cursor-pointer flex-shrink-0 hover:scale-110 hover:-translate-y-1 transition-all duration-200 flex flex-col items-center justify-center relative"
                             title={`${airline.legal_name || airline.airline} - ${airline.equipment_count || 0} Eqps / ${airline.flight_count || 0} Voos`}
                             onClick={() => {
                                 setFocusedCell({ rowId: airline.id, col: 0 });
                                 // scroll table to row
                                 const rowIndex = filteredAirlines.findIndex(a => a.id === airline.id);
                                 if (rowIndex >= 0 && tableRef.current) {
                                     const rowHtml = tableRef.current.querySelector(`tr[data-row="${rowIndex}"]`);
                                     rowHtml?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                 }
                             }}
                         >
                             <div className="w-[50px] h-[50px] rounded overflow-hidden shadow-sm ring-1 ring-black/5 flex items-center justify-center bg-white relative">
                                 {airline.logo_url ? (
                                    <img src={airline.logo_url} className="w-full h-full object-contain" />
                                 ) : airline.airline_code ? (
                                    <>
                                      <img src={getLogoUrl(airline.airline_code)} className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                                      <div className="hidden w-full h-full flex items-center justify-center">
                                         <ImageIcon size={20} className="text-slate-300" />
                                      </div>
                                    </>
                                 ) : (
                                    <ImageIcon size={20} className="text-slate-300" />
                                 )}
                             </div>
                             {(airline.equipment_count || 0) > 0 && (
                                 <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center bg-white dark:bg-slate-800 text-[#2D8E48] dark:text-green-500 text-[8px] font-black rounded-full min-w-[16px] h-[16px] px-1 text-center shadow-sm border border-slate-300 dark:border-slate-600">
                                     {airline.equipment_count}
                                 </div>
                             )}
                         </div>
                     ))}
                 </div>
            </div>
        </div>

        {/* IMPORT INSTRUCTIONS MODAL */}
        {showImportInstructions && createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className={`w-full max-w-2xl rounded-xl shadow-2xl border flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                    <div className="p-6 overflow-y-auto custom-scrollbar">
                        <div className="flex items-center gap-3 mb-6">
                            <div className={`p-3 rounded-full ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#e5f4ea] text-[#29824a]'}`}>
                                <FileSpreadsheet size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Importar Companhias (XLSX)</h3>
                                <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Modelo e Formatação de Colunas</p>
                            </div>
                        </div>

                        <div className={`p-4 rounded-lg border mb-6 ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            <p className="text-sm mb-4 leading-relaxed">
                                Para importar sua lista de companhias aéreas, o arquivo Excel (.xlsx) deve conter as seguintes colunas na primeira aba. Note que os dados são mesclados <strong>UPSERT</strong> usando o <strong>CÓD. DA COMP</strong> como chave principal.
                            </p>
                            
                            <ul className="text-sm space-y-3 mb-4">
                                <li><strong className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>RAZÃO SOCIAL / RAZÃO</strong> - Nome completo legal (ex: Latam Airlines Brasil)</li>
                                <li><strong className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>COMP. / COMPANHIA</strong> - Nome simplificado / Comercial (ex: LATAM)</li>
                                <li><strong className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>CÓD. DA COMP / COD. COMP / CODE</strong> (Obrigatório) - Código IATA/ICAO ou identificador único (ex: LA, G3, TP)</li>
                                <li><strong className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>PAÍS/REGIÃO</strong> (Opcional) - País ou região de origem (ex: Brasil)</li>
                            </ul>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button
                              onClick={() => downloadTemplate('airlines')}
                              className={`px-6 py-2 rounded text-sm font-bold uppercase tracking-wider transition-colors flex items-center gap-2 ${isDarkMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                            >
                                <Download size={16} /> BAIXAR MODELO
                            </button>
                            <button 
                              onClick={() => setShowImportInstructions(false)}
                              className={`px-6 py-2 rounded text-sm font-bold uppercase tracking-wider transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                            >
                                CANCELAR
                            </button>
                            <button 
                              onClick={() => {
                                setShowImportInstructions(false);
                                fileInputRef.current?.click();
                              }}
                              disabled={isImporting}
                              className={`px-6 py-2 rounded text-sm font-bold uppercase tracking-wider transition-colors flex items-center gap-2 ${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-[#329858] hover:bg-[#29824a]'} text-white disabled:opacity-50`}
                            >
                                {isImporting ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
                                INICIAR IMPORTAÇÃO
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        , document.body)}

        {/* DELETE ALL MODAL */}
        {confirmDeleteAll && createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className={`w-full max-w-sm rounded-xl overflow-hidden shadow-2xl border ${isDarkMode ? 'bg-slate-900 border-red-900/50 text-white' : 'bg-white border-red-200 text-slate-800'}`}>
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-2 text-red-500">
                            <Trash2 size={24} />
                            <h3 className="text-lg font-bold">Limpeza de Banco de Dados</h3>
                        </div>
                        <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} mb-6`}>
                           <strong>ATENÇÃO:</strong> Esta ação irá excluir <strong>TODOS</strong> os registros desta tabela. Esta ação é irreversível. Deseja continuar?
                        </p>
                        <div className="flex justify-end gap-3">
                            <button 
                              onClick={() => setConfirmDeleteAll(false)}
                              className={`px-4 py-2 rounded text-sm font-bold uppercase tracking-wider transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                            >
                                CANCELAR
                            </button>
                            <button 
                              onClick={handleDeleteAll}
                              className="px-4 py-2 rounded text-sm font-bold uppercase tracking-wider bg-red-500 hover:bg-red-600 text-white transition-colors"
                            >
                                SIM, EXCLUIR TUDO
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        , document.body)}

        {/* DELETE MODAL */}
        {confirmDeleteAirline && createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className={`w-full max-w-sm rounded-xl overflow-hidden shadow-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                    <div className="p-6">
                        <h3 className="text-lg font-bold mb-2">Confirmar Exclusão</h3>
                        <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} mb-6`}>
                           Deseja realmente excluir esta companhia?
                        </p>
                        <div className="flex justify-end gap-3">
                            <button 
                              onClick={() => setConfirmDeleteAirline(null)}
                              className={`px-4 py-2 rounded text-sm font-bold uppercase tracking-wider transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                            >
                                CANCELAR
                            </button>
                            <button 
                              onClick={() => handleDeleteAirline(confirmDeleteAirline)}
                              className="px-4 py-2 rounded text-sm font-bold uppercase tracking-wider bg-red-500 hover:bg-red-600 text-white transition-colors"
                            >
                                EXCLUIR
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        , document.body)}
    </div>
  );
};
