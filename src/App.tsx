import React, { useState, useEffect, Suspense, lazy, useCallback, useMemo } from 'react';
import { ViewState, FlightData, Vehicle, MeshFlight } from './types';

import { getLocalTodayDateStr } from './utils/shiftUtils';
import { DashboardHeader } from './components/DashboardHeader';
import { Spinner } from './components/ui/Spinner';
import { useTheme } from './contexts/ThemeContext';
import { useAuth } from './contexts/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { AlertModal } from './components/modals/AlertModal';
import { Table, X, AlertCircle } from 'lucide-react';
import { OperatorProfile } from './types';
import { ShiftOperatorsSection } from './components/ShiftOperatorsSection';
import { Sidebar } from './components/Sidebar';
import { OperationalMesh } from './components/OperationalMesh';
import { RootMesh } from './components/RootMesh';
import { ReportsView } from './components/ReportsView';
import { OperatorsAdmin } from './components/OperatorsAdmin';
import { FleetsAdmin } from './components/FleetsAdmin';
import { AircraftsAdmin } from './components/AircraftsAdmin';
import { Aerodromo } from './components/Aerodromo';
import { POSITIONS_METADATA, POSITIONS_BY_PATIO, PositionMetadata } from './constants/aerodromoConfig';

import { GridOps } from './components/GridOps';
import { AerodromoAdmin } from './components/AerodromoAdmin';

const App: React.FC = () => {
  const { user, loading: authLoading, warName } = useAuth();
  const [view, setView] = useState<ViewState>('GRID_OPS');
  const [pendingAction, setPendingAction] = useState<'CREATE' | 'IMPORT' | null>(null);

  // === ESTADO CENTRALIZADO (A VERDADE ÚNICA) ===
  const [globalFlights, setGlobalFlights] = useState<FlightData[]>(() => {
    const saved = localStorage.getItem('globalFlights');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((f: any) => ({
          ...f,
          designationTime: f.designationTime ? new Date(f.designationTime) : undefined,
          assignmentTime: f.assignmentTime ? new Date(f.assignmentTime) : undefined,
          startTime: f.startTime ? new Date(f.startTime) : undefined,
          endTime: f.endTime ? new Date(f.endTime) : undefined,
          logs: f.logs ? f.logs.map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) })) : [],
          messages: f.messages ? f.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })) : []
        }));
      } catch (e) {
      }
    }
    return [];
  });

  const [globalVehicles, setGlobalVehicles] = useState<Vehicle[]>([]);
  const [globalOperators, setGlobalOperators] = useState<OperatorProfile[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  useEffect(() => {
    import('./services/supabaseService').then(async ({ getVehicles, getOperators, getFlights, getRootMesh, getBaseMeshFlights, getAerodromoConfig }) => {
      try {
        const today = getLocalTodayDateStr();
        const [vehicles, operators, flights, rootMesh, baseMesh, aerodromoConfig] = await Promise.all([
          getVehicles(),
          getOperators(),
          getFlights(today),
          getRootMesh(),
          getBaseMeshFlights(today),
          getAerodromoConfig()
        ]);
        
        console.log("Supabase Vehicles returned:", vehicles);
        console.log("Supabase Operators returned:", operators);
        console.log("Supabase Flights returned:", flights);
        console.log("Supabase Root Mesh returned:", rootMesh);
        console.log("Supabase Base Mesh returned:", baseMesh);
        console.log("Supabase Aerodromo Config returned:", aerodromoConfig);
        
        if (vehicles && vehicles.length > 0) {
          setGlobalVehicles(vehicles);
        }

        if (operators && operators.length > 0) {
          setGlobalOperators(operators);
        }

        if (flights && flights.length > 0) {
          console.log(`Povoando ${flights.length} voos do Supabase para a data ${today}`);
          setGlobalFlights(flights);
        }

        if (rootMesh && rootMesh.length > 0) {
          console.log(`Povoando ${rootMesh.length} registros de Malha Raiz do Supabase`);
          setRootMeshFlights(rootMesh);
        }
        
        if (baseMesh && baseMesh.length > 0) {
          console.log(`Povoando ${baseMesh.length} registros de Malha Base do Supabase para a data ${today}`);
          setMeshFlightsByDate(prev => ({ ...prev, [today]: baseMesh }));
        }

        if (aerodromoConfig) {
          if (aerodromoConfig.positions_metadata && Object.keys(aerodromoConfig.positions_metadata).length > 0) {
            setPositionsMetadata(aerodromoConfig.positions_metadata);
          }
          if (aerodromoConfig.position_restrictions && Object.keys(aerodromoConfig.position_restrictions).length > 0) {
            setPositionRestrictions(aerodromoConfig.position_restrictions);
          }
          if (aerodromoConfig.disabled_positions && aerodromoConfig.disabled_positions.length > 0) {
            setDisabledPositions(new Set(aerodromoConfig.disabled_positions));
          }
          if (aerodromoConfig.patio_positions && Object.keys(aerodromoConfig.patio_positions).length > 0) {
            setPatioPositions(aerodromoConfig.patio_positions);
          }
        }
        
        if (vehicles.length === 0 && operators.length === 0) {
            setSupabaseError(`O banco conectou com sucesso, mas não retornou DADOS (0 veículos e 0 operadores). Possíveis causas:\n1. Você não rodou o script "supabase_seed.sql" no SQL Editor do Supabase.\n2. O banco está bloqueado por RLS (Row Level Security). Desative o RLS para leitura anônima ou insira dados pelas tabelas. Vá no seu projeto Supabase > Tabela Vehicles > '...' > 'Disable RLS' para testes.`);
        }
      } catch (err: any) {
        console.error('Failed to load base data from Supabase:', err);
        setSupabaseError(`Erro de conexão com o Supabase: ${err.message || JSON.stringify(err)}`);
      } finally {
        setIsLoadingData(false);
      }
    }).catch(err => {
      console.error('Failed to import supabaseService:', err);
      setSupabaseError(`${err.message || 'Erro ao inicializar conexão com Supabase'}`);
      setIsLoadingData(false);
    });
  }, []);

  const [meshFlightsByDate, setMeshFlightsByDate] = useState<Record<string, MeshFlight[]>>({});

  const [rootMeshFlights, setRootMeshFlights] = useState<MeshFlight[]>([]);


  const [currentMeshDate, setCurrentMeshDate] = useState<string>(
      () => getLocalTodayDateStr()
  );
  
  useEffect(() => {
    import('./services/supabaseService').then(async ({ getBaseMeshFlights }) => {
       try {
           const mesh = await getBaseMeshFlights(currentMeshDate);
           if (mesh && mesh.length > 0) {
              setMeshFlightsByDate(prev => ({ ...prev, [currentMeshDate]: mesh }));
           } else {
              setMeshFlightsByDate(prev => ({ ...prev, [currentMeshDate]: [] }));
           }
       } catch (err) {
           console.error("Error fetching base mesh for date: " + currentMeshDate, err);
       }
    });
  }, [currentMeshDate]);

  const meshFlights = meshFlightsByDate[currentMeshDate] || [];
  
  const setMeshFlights = useCallback((action: React.SetStateAction<MeshFlight[]>) => {
      setMeshFlightsByDate(prev => {
          const current = prev[currentMeshDate] || [];
          const updated = typeof action === 'function' ? action(current) : action;
          return { ...prev, [currentMeshDate]: updated };
      });
  }, [currentMeshDate]);

  useEffect(() => {
    if (!localStorage.getItem('migration_no_mocks_v8')) {
      localStorage.removeItem('globalFlights');
      localStorage.removeItem('meshFlights');
      localStorage.removeItem('globalOperators');
      localStorage.removeItem('rootMeshFlights');
      localStorage.removeItem('meshFlightsByDate');
      localStorage.setItem('migration_no_mocks_v8', 'true');
      
      import('./services/supabaseService').then(({ clearAllBaseMeshFlights, clearRootMesh }) => {
          clearRootMesh().catch(console.error);
          clearAllBaseMeshFlights().catch(console.error);
      });
      
      setTimeout(() => {
          window.location.reload();
      }, 500);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('meshFlights', JSON.stringify(meshFlights));
  }, [meshFlights]);

  useEffect(() => {
    localStorage.setItem('globalFlights', JSON.stringify(globalFlights));
  }, [globalFlights]);

  const { isDarkMode, toggleDarkMode } = useTheme();
  const [gridOpsInitialTab, setGridOpsInitialTab] = useState<'GERAL' | 'CHEGADA' | 'FILA' | 'DESIGNADOS' | 'ABASTECENDO' | 'FINALIZADO'>('GERAL');
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [ltName, setLtName] = useState('');
  const [tempLtName, setTempLtName] = useState('');

  useEffect(() => {
    if (warName) setLtName(warName);
  }, [warName]);

  const isNameInvalid = false; // !ltName || ltName.trim() === ''; // disabled temporarily per user request

  const toggleFullscreen = () => {
    const doc = document as any;
    const element = document.documentElement as any;

    const isNativeFull = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);

    if (!isNativeFull) {
      const requestMethod = element.requestFullscreen || element.webkitRequestFullscreen || element.mozRequestFullScreen || element.msRequestFullscreen;
      if (requestMethod) {
        requestMethod.call(element).catch(() => {
          // Fallback para pseudo-fullscreen se o nativo falhar (comum em iframes)
          setIsPseudoFullscreen(true);
        });
      } else {
        setIsPseudoFullscreen(true);
      }
    } else {
      const exitMethod = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
      if (exitMethod) {
        exitMethod.call(doc);
      }
      setIsPseudoFullscreen(false);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      const doc = document as any;
      const isNativeFull = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
      if (!isNativeFull) setIsPseudoFullscreen(false);
    };
    
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('mozfullscreenchange', onFullscreenChange);
    document.addEventListener('MSFullscreenChange', onFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      document.removeEventListener('mozfullscreenchange', onFullscreenChange);
      document.removeEventListener('MSFullscreenChange', onFullscreenChange);
    };
  }, []);

  const runEndOfDayRoutine = useCallback(async () => {
    // 1. Filtrar voos da Operação (GridOps)
    const finishedFlights = globalFlights.filter(f => f.status === 'FINALIZADO' || f.status === 'CANCELADO');
    const unfinishedFlights = globalFlights.filter(f => f.status !== 'FINALIZADO' && f.status !== 'CANCELADO');
    
    // 2. Gerar relatório Excel dos finalizados
    if (finishedFlights.length > 0) {
      try {
        const XLSX = await import('xlsx');
        const worksheet = XLSX.utils.json_to_sheet(finishedFlights.map(f => ({
            Voo: f.airline + ' ' + f.flightNumber,
            VooChegada: f.departureFlightNumber,
            Prefixo: f.prefix,
            Destino: f.destination,
            Status: f.status,
            Inicio: f.startTime ? new Date(f.startTime).toLocaleTimeString('pt-BR') : '',
            Fim: f.endTime ? new Date(f.endTime).toLocaleTimeString('pt-BR') : '',
            Operadores: f.assignedOperatorsNames ? f.assignedOperatorsNames.join(', ') : '',
            Equipamento: f.fleet || ''
        })));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Fechamento');
        const todayStr = getLocalTodayDateStr();
        XLSX.writeFile(workbook, `Fechamento_Diario_Voos_${todayStr}.xlsx`);
      } catch (err) {
        console.error("Erro exportando excel", err);
      }
    }

    // 4. Determinar a data de amanhã
    const todayStr = currentMeshDate;
    const tomorrowDate = new Date(todayStr + 'T12:00:00');
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

    // 3. Limpar finalizados da visualização atual da Operação (GridOps)
    // Mantendo os não finalizados (transferindo para a nova meta/dia)
    const unfinishedTransferred = unfinishedFlights.map(f => ({
        ...f,
        date: tomorrowStr // Update the date of the active flights to tomorrow so they appear tomorrow
    }));
    setGlobalFlights(unfinishedTransferred);

    // 4. Transferir Malha Planejada para o dia seguinte

    // Pegamos a malha planejada atual
    setMeshFlightsByDate(prev => {
        const todayMeshFlights = prev[todayStr] || [];
        
        // Identificar voos da malha de hoje que NÃO foram finalizados
        const unfinishedMeshFlights = todayMeshFlights.filter(mf => {
             // Tenta achar o voo equivalente no globalFlights
             const gf = globalFlights.find(
                 f => f.airline === mf.airline && 
                      (f.departureFlightNumber === mf.departureFlightNumber || f.flightNumber === mf.departureFlightNumber)
             );
             if (gf) {
                 // Se achou no globalFlights, e está finalizado ou cancelado, ele sai da malha
                 return gf.status !== 'FINALIZADO' && gf.status !== 'CANCELADO';
             }
             // Se não achou no global, quer dizer que nem foi iniciado. Devemos transferir.
             return true;
        });

        // Modificamos a data dos voos transferidos para garantir
        const transferredMeshFlights = unfinishedMeshFlights.map(mf => ({
            ...mf,
            date: tomorrowStr
        }));

        const existingTomorrow = prev[tomorrowStr] || [];

        return {
            ...prev,
            [todayStr]: [], // Limpa a malha de hoje
            [tomorrowStr]: [...existingTomorrow, ...transferredMeshFlights] // Move para a de amanhã
        };
    });

    setCurrentMeshDate(tomorrowStr); // Avança o componente visual para a data de amanhã

    // 5. Alert de sistema
    setEndOfDayAlert({
      isOpen: true,
      title: 'FECHAMENTO DIÁRIO',
      message: (
        <div className="flex flex-col gap-3 text-left">
          <p>O dia foi encerrado com sucesso.</p>
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg">
            <p className="font-bold text-emerald-600 dark:text-emerald-400">
              {finishedFlights.length} voos finalizados / cancelados
            </p>
            <p className="text-xs mt-1">Foram incluídos no Relatório Excel (baixado automaticamente) e removidos do painel e da malha.</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
            <p className="font-bold text-amber-600 dark:text-amber-400">
              {unfinishedFlights.length} voos pendentes
            </p>
            <p className="text-xs mt-1">Transitaram automaticamente para a malha de {tomorrowStr.split('-').reverse().join('/')} (mantidos na tela).</p>
          </div>
        </div>
      )
    });
  }, [globalFlights, currentMeshDate]);

  useEffect(() => {
    const timer = setInterval(() => {
        const now = new Date();
        // Dispara o fechamento na virada do dia exatamente (23:59:59)
        if (now.getHours() === 23 && now.getMinutes() === 59 && now.getSeconds() === 59) {
            runEndOfDayRoutine();
        }
    }, 1000);
    return () => clearInterval(timer);
  }, [runEndOfDayRoutine]);

  const [showExitWarning, setShowExitWarning] = useState<{ id: string } | null>(null);
  const [targetView, setTargetView] = useState<ViewState | null>(null);
  const [targetReportFlight, setTargetReportFlight] = useState<FlightData | null>(null);

  const [endOfDayAlert, setEndOfDayAlert] = useState<{ isOpen: boolean; title: string; message: React.ReactNode }>({
    isOpen: false,
    title: '',
    message: ''
  });

  const [disabledPositions, setDisabledPositions] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('disabledPositions');
    return saved ? new Set(JSON.parse(saved)) : new Set(['208', '212L']);
  });

  const [positionsMetadata, setPositionsMetadata] = useState<Record<string, PositionMetadata>>(() => {
    const saved = localStorage.getItem('positionsMetadata');
    return saved ? JSON.parse(saved) : POSITIONS_METADATA;
  });

  const [patioPositions, setPatioPositions] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('patioPositions');
    return saved ? JSON.parse(saved) : POSITIONS_BY_PATIO;
  });

  const [positionRestrictions, setPositionRestrictions] = useState<Record<string, 'HYBRID' | 'CTA' | 'SRV'>>(() => {
    const saved = localStorage.getItem('positionRestrictions');
    
    const initial: Record<string, 'HYBRID' | 'CTA' | 'SRV'> = {};
    Object.entries(POSITIONS_METADATA).forEach(([id, meta]) => {
      initial[id] = (meta as any).type === 'REMOTA' ? 'CTA' : 'HYBRID';
    });

    if (saved) {
        const parsed = JSON.parse(saved);
        return { ...initial, ...parsed };
    }
    return initial;
  });

  const syncAerodromoConfig = useCallback(async (updates: Partial<any>) => {
    try {
       const { updateAerodromoConfig } = await import('./services/supabaseService');
       await updateAerodromoConfig({
          patio_positions: patioPositions,
          positions_metadata: positionsMetadata,
          position_restrictions: positionRestrictions,
          disabled_positions: Array.from(disabledPositions),
          ...updates // Override the specific piece changing at this moment
       });
    } catch(err) {
       console.error("Failed to sync aerodromo config", err);
    }
  }, [patioPositions, positionsMetadata, positionRestrictions, disabledPositions]);

  useEffect(() => {
    const serialized = Array.from(disabledPositions);
    localStorage.setItem('disabledPositions', JSON.stringify(serialized));
    syncAerodromoConfig({ disabled_positions: serialized });
  }, [disabledPositions]);

  useEffect(() => {
    localStorage.setItem('positionsMetadata', JSON.stringify(positionsMetadata));
    syncAerodromoConfig({ positions_metadata: positionsMetadata });
  }, [positionsMetadata]);

  useEffect(() => {
    localStorage.setItem('patioPositions', JSON.stringify(patioPositions));
    syncAerodromoConfig({ patio_positions: patioPositions });
  }, [patioPositions]);

  useEffect(() => {
    localStorage.setItem('positionRestrictions', JSON.stringify(positionRestrictions));
    syncAerodromoConfig({ position_restrictions: positionRestrictions });
  }, [positionRestrictions]);

  const clearAllPositionAssignments = useCallback(async () => {
    try {
      const { clearAllFlightAssignments } = await import('./services/supabaseService');
      
      console.log(`[Database] Iniciando limpeza profunda de TODAS as posições`);
      
      // 1. Update local state IMEDIATAMENTE (Otimista)
      setGlobalFlights(prev => prev.map(f => ({ ...f, positionId: '', pitId: undefined, positionType: undefined })));
      
      // 2. Persist no Banco de Dados (Todas as datas)
      await clearAllFlightAssignments();
      
      alert("⚠️ SUCESSO: Todas as posições de pátio foram liberadas no sistema e no banco de dados.");
      window.location.reload();
    } catch (err) {
      console.error('Falha crítica na limpeza global:', err);
      alert('Erro ao sincronizar limpeza. Verifique sua conexão com o Supabase.');
    }
  }, []);

  const handleViewChange = (newView: ViewState) => {
    setView(newView);
    if (newView !== 'REPORTS') {
      setTargetReportFlight(null);
    }
  };

  const handleConfirmExit = (action: 'CANCEL' | 'EDIT') => {
    setShowExitWarning(null);
    setTargetView(null);
  };

  if (authLoading) {
    return (
      <div className={`${isDarkMode ? 'dark bg-slate-950' : 'bg-slate-50'} min-h-screen flex items-center justify-center`}>
        <Spinner size="lg" className="text-blue-500" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const currentLtProfile = globalOperators.find(op => {
    const normalizeString = (str?: string) => str?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase() || '';
    const ln = normalizeString(ltName);
    const wn = normalizeString(op.warName);
    const fn = normalizeString(op.fullName);
    if (!ln) return false;
    return wn === ln || fn === ln || (fn && fn.includes(ln));
  });

  return (
    <div className={`${isDarkMode ? 'dark bg-slate-950' : 'bg-slate-50'} ${isPseudoFullscreen ? 'fixed inset-0 z-[9999]' : 'h-[100dvh] w-full'} overflow-hidden flex flex-col`}>
      <DashboardHeader 
        isDarkMode={isDarkMode} 
        toggleDarkMode={toggleDarkMode} 
        isFullscreen={isPseudoFullscreen} 
        onToggleFullscreen={toggleFullscreen} 
        globalSearchTerm={globalSearchTerm}
        setGlobalSearchTerm={setGlobalSearchTerm}
        ltName={ltName}
        ltPhotoUrl={currentLtProfile?.photoUrl}
        setLtName={setLtName}
        operators={globalOperators}
      />

      {supabaseError && (
        <div className="bg-red-500 text-white p-4 font-bold flex items-start justify-between z-[9999]">
            <div className="flex items-start gap-4 flex-1">
                <AlertCircle size={24} className="mt-1 flex-shrink-0" />
                <div className="flex flex-col gap-2">
                    <span className="text-lg">Problema com o Banco de Dados</span>
                    <span className="font-normal whitespace-pre-line">{supabaseError}</span>
                </div>
            </div>
            <button onClick={() => setSupabaseError(null)} className="hover:bg-red-600 p-1 rounded transition-colors"><X size={20}/></button>
        </div>
      )}

      {isNameInvalid && (
        <div className="fixed inset-x-0 bottom-0 top-20 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className={`border ${isDarkMode ? 'bg-slate-900 border-emerald-500/30' : 'bg-white border-[#004D24]/30'} rounded-xl p-8 max-w-md w-full shadow-2xl text-center relative overflow-hidden`}>
                <div className={`absolute top-0 inset-x-0 h-1 ${isDarkMode ? 'bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600' : 'bg-[#004D24]'} animate-pulse`}></div>
                <h2 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'} mb-2 tracking-tight uppercase`}>PRIMEIRO ACESSO</h2>
                <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'} mb-6 font-medium leading-relaxed`}>Por favor, insira o seu nome abaixo para acessar e operar o sistema.</p>
                
                <div className="flex flex-col items-center gap-4 mb-8">
                    <input 
                        type="text" 
                        value={tempLtName}
                        onChange={(e) => setTempLtName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && tempLtName.trim()) {
                                setLtName(tempLtName.trim());
                            }
                        }}
                        placeholder="Digite seu nome..."
                        className={`w-4/5 text-center px-4 py-3 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'} focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold uppercase tracking-wide`}
                        autoFocus
                    />
                    <button
                        onClick={() => {
                            if (tempLtName.trim()) {
                                setLtName(tempLtName.trim());
                            }
                        }}
                        disabled={!tempLtName.trim()}
                        className={`w-4/5 py-3 rounded-lg font-black uppercase tracking-widest transition-all ${!tempLtName.trim() ? 'opacity-50 cursor-not-allowed bg-slate-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 active:scale-95'}`}
                    >
                        Acessar Sistema
                    </button>
                </div>

                <div className={`flex items-center justify-center gap-2 ${isDarkMode ? 'text-emerald-400' : 'text-[#004D24]'} font-bold uppercase tracking-widest text-[10px]`}>
                     <div className="animate-bounce">
                         <Table size={14} />
                     </div>
                     Aguardando Identificação...
                </div>
            </div>
        </div>
      )}

      <AlertModal
        isOpen={endOfDayAlert.isOpen}
        title={endOfDayAlert.title}
        message={endOfDayAlert.message}
        onClose={() => setEndOfDayAlert(prev => ({ ...prev, isOpen: false }))}
      />

      <div className={`flex flex-1 w-full ${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-800'} transition-colors duration-500 font-sans overflow-hidden relative`}>
        <Sidebar 
          activeView={view} 
          onViewChange={handleViewChange} 
          isDarkMode={isDarkMode} 
          onSimulateEndOfDay={runEndOfDayRoutine}
        />

        <main className="flex-1 flex flex-col overflow-hidden relative w-full">
          <div id="subheader-portal-target" className="w-full shrink-0 z-30 relative"></div>
          <div className="flex-1 overflow-hidden relative">
              <Suspense fallback={<div className="flex items-center justify-center h-full w-full"><Spinner size={48} text="Carregando módulo..." /></div>}>
                {view === 'GRID_OPS' && (
                  <GridOps 
                    flights={globalFlights} 
                    onUpdateFlights={setGlobalFlights} 
                    vehicles={globalVehicles}
                    operators={globalOperators}
                    initialTab={gridOpsInitialTab}
                    globalSearchTerm={globalSearchTerm}
                    onUpdateSearch={setGlobalSearchTerm}
                    meshFlights={meshFlights}
                    setMeshFlights={setMeshFlights}
                    onOpenShiftOperators={() => handleViewChange('SHIFT_OPERATORS')}
                    positionRestrictions={positionRestrictions}
                    onOpenReport={(flight) => {
                        setTargetReportFlight(flight);
                        handleViewChange('REPORTS');
                    }}
                    pendingAction={pendingAction}
                    setPendingAction={setPendingAction}
                    ltName={ltName}
                    currentMeshDate={currentMeshDate}
                  />
                )}
                {view === 'SHIFT_OPERATORS' && (
                  <ShiftOperatorsSection 
                    onClose={() => handleViewChange('GRID_OPS')}
                    operators={globalOperators}
                    onUpdateOperators={setGlobalOperators}
                    flights={globalFlights}
                    onUpdateFlights={setGlobalFlights}
                    vehicles={globalVehicles}
                    onOpenCreateModal={() => {
                        setPendingAction('CREATE');
                        handleViewChange('GRID_OPS');
                    }}
                    onOpenImportModal={() => {
                        setPendingAction('IMPORT');
                        handleViewChange('GRID_OPS');
                    }}
                  />
                )}
                {view === 'OPERATIONAL_MESH' && (
                  <OperationalMesh 
                    onClose={() => handleViewChange('GRID_OPS')}
                    isDarkMode={isDarkMode}
                    meshFlights={meshFlights}
                    setMeshFlights={setMeshFlights}
                    currentMeshDate={currentMeshDate}
                    setCurrentMeshDate={setCurrentMeshDate}
                    setFlights={setGlobalFlights}
                    globalFlights={globalFlights}
                    onActivateMesh={(newFlights) => {
                      setGlobalFlights(prev => [...newFlights, ...prev]);
                      import('./services/supabaseService').then(({ bulkInsertFlights }) => {
                        bulkInsertFlights(newFlights).catch(err => {
                          console.error("Falha ao salvar na malha operacional:", err);
                          alert(`Erro Crítico no Banco de Dados (Operacional):\n${err.message}\nVerifique se a tabela 'flights' possui todas as colunas necessárias.`);
                        });
                      });
                    }}
                    positionsMetadata={positionsMetadata}
                    positionRestrictions={positionRestrictions}
                  />
                )}
                {view === 'ROOT_MESH' && (
                  <RootMesh
                    rootMeshFlights={rootMeshFlights}
                    setRootMeshFlights={setRootMeshFlights}
                    isDarkMode={isDarkMode}
                    setMeshFlightsByDate={setMeshFlightsByDate}
                    positionsMetadata={positionsMetadata}
                    positionRestrictions={positionRestrictions}
                  />
                )}
                {view === 'REPORTS' && (
                  <ReportsView flights={globalFlights} initialFlight={targetReportFlight} />
                )}
                {view === 'OPERATORS_ADMIN' && (
                  <OperatorsAdmin 
                    isDarkMode={isDarkMode} 
                    globalOperators={globalOperators}
                    onUpdateGlobalOperators={setGlobalOperators}
                  />
                )}
                {view === 'FLEETS_ADMIN' && (
                  <FleetsAdmin 
                    isDarkMode={isDarkMode} 
                    globalVehicles={globalVehicles}
                    onUpdateGlobalVehicles={setGlobalVehicles}
                   />
                )}
                {view === 'AIRCRAFTS_ADMIN' && (
                  <AircraftsAdmin 
                    isDarkMode={isDarkMode} 
                   />
                )}
                {view === 'AERODROMO' && (
                  <Aerodromo 
                    operators={globalOperators} 
                    flights={globalFlights} 
                    disabledPositions={disabledPositions}
                    positionsMetadata={positionsMetadata}
                    positionRestrictions={positionRestrictions}
                    onRemoveFlight={async (flightId) => {
                      if (!confirm("Deseja desvincular este voo da posição atual?")) return;
                      // Update Local Otimista
                      setGlobalFlights(prev => prev.map(f => f.id === flightId ? { ...f, positionId: '', pitId: undefined, positionType: undefined } : f));
                      // Update Backend
                      import('./services/supabaseService').then(({ clearFlightPosition }) => {
                        clearFlightPosition(flightId).catch(err => {
                           console.error("Falha ao desvincular voo:", err);
                        });
                      });
                    }}
                  />
                )}
                {view === 'AERODROMO_ADMIN' && (
                  <AerodromoAdmin 
                    disabledPositions={disabledPositions}
                    setDisabledPositions={setDisabledPositions}
                    positionsMetadata={positionsMetadata}
                    setPositionsMetadata={setPositionsMetadata}
                    patioPositions={patioPositions}
                    setPatioPositions={setPatioPositions}
                    positionRestrictions={positionRestrictions}
                    setPositionRestrictions={setPositionRestrictions}
                    flights={globalFlights}
                    onClearAllAssignments={clearAllPositionAssignments}
                  />
                )}
              </Suspense>
          </div>
        </main>
      </div>
      {isPseudoFullscreen && (
        <button 
          onClick={() => setIsPseudoFullscreen(false)}
          className="fixed bottom-4 right-4 bg-slate-800/80 hover:bg-slate-700 text-white p-2 rounded-full shadow-lg z-[10000] border border-slate-700 transition-all"
          title="Sair do modo tela cheia"
        >
          <X size={20} />
        </button>
      )}
    </div>
  );
};

export default App;
