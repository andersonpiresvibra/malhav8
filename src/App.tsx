import React, { useState, useEffect, Suspense, lazy, useCallback, useMemo } from 'react';
import { ViewState, FlightData, Vehicle } from './types';

import { MeshFlight, INITIAL_MESH_FLIGHTS } from './data/operationalMesh';
import { DashboardHeader } from './components/DashboardHeader';
import { Spinner } from './components/ui/Spinner';
import { useTheme } from './contexts/ThemeContext';
import { Table, X, AlertCircle } from 'lucide-react';
import { OperatorProfile } from './types';
import { ShiftOperatorsSection } from './components/ShiftOperatorsSection';
import { Sidebar } from './components/Sidebar';
import { OperationalMesh } from './components/OperationalMesh';
import { RootMesh } from './components/RootMesh';
import { ReportsView } from './components/ReportsView';
import { OperatorsAdmin } from './components/OperatorsAdmin';

const GridOps = lazy(() => import('./components/GridOps').then(m => ({ default: m.GridOps })));

const App: React.FC = () => {
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
    import('./services/supabaseService').then(async ({ getVehicles, getOperators }) => {
      try {
        const [vehicles, operators] = await Promise.all([
          getVehicles(),
          getOperators()
        ]);
        
        console.log("Supabase Vehicles returned:", vehicles);
        console.log("Supabase Operators returned:", operators);
        
        if (vehicles && vehicles.length > 0) {
          setGlobalVehicles(vehicles);
        } else if (vehicles && vehicles.length === 0) {
          console.warn("Nenhum veículo encontrado no Supabase. Tabelas vazias ou bloqueadas por RLS.");
        }

        if (operators && operators.length > 0) {
          setGlobalOperators(operators);
        } else if (operators && operators.length === 0) {
          console.warn("Nenhum operador encontrado no Supabase. Tabelas vazias ou bloqueadas por RLS.");
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

  const [meshFlightsByDate, setMeshFlightsByDate] = useState<Record<string, MeshFlight[]>>(() => {
    const saved = localStorage.getItem('meshFlightsByDate');
    const today = new Date().toISOString().split('T')[0];
    
    let loadedData: Record<string, MeshFlight[]> | null = null;
    if (saved) {
      try {
        loadedData = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse meshFlightsByDate', e);
      }
    }
    
    if (!loadedData) {
      // Fallback: load old single mesh if exists
      const oldSaved = localStorage.getItem('meshFlights');
      if (oldSaved) {
         try {
            loadedData = { [today]: JSON.parse(oldSaved) };
         } catch (e) {}
      }
    }
    
    if (!loadedData) {
        loadedData = { [today]: INITIAL_MESH_FLIGHTS };
    }

    return loadedData;
  });

  const [rootMeshFlights, setRootMeshFlights] = useState<MeshFlight[]>(() => {
    const saved = localStorage.getItem('rootMeshFlights');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse rootMeshFlights', e);
      }
    }
    
    // Fallback to initial mapping
    return INITIAL_MESH_FLIGHTS.map((f, i) => ({ ...f }));
  });

  useEffect(() => {
    localStorage.setItem('rootMeshFlights', JSON.stringify(rootMeshFlights));
  }, [rootMeshFlights]);

  const [currentMeshDate, setCurrentMeshDate] = useState<string>(
      () => new Date().toISOString().split('T')[0]
  );
  
  const meshFlights = meshFlightsByDate[currentMeshDate] || INITIAL_MESH_FLIGHTS.map((f, i) => ({
      ...f, 
      id: `mesh-${currentMeshDate}-${i}`,
      date: currentMeshDate
  }));
  
  const setMeshFlights = useCallback((action: React.SetStateAction<MeshFlight[]>) => {
      setMeshFlightsByDate(prev => {
          const current = prev[currentMeshDate] || INITIAL_MESH_FLIGHTS.map((f, i) => ({
              ...f, 
              id: `mesh-${currentMeshDate}-${i}`,
              date: currentMeshDate
          }));
          const updated = typeof action === 'function' ? action(current) : action;
          return { ...prev, [currentMeshDate]: updated };
      });
  }, [currentMeshDate]);

  useEffect(() => {
    localStorage.setItem('meshFlightsByDate', JSON.stringify(meshFlightsByDate));
  }, [meshFlightsByDate]);

  useEffect(() => {
    if (!localStorage.getItem('migration_no_mocks_v5')) {
      localStorage.removeItem('globalFlights');
      localStorage.removeItem('meshFlights');
      localStorage.removeItem('globalOperators');
      localStorage.setItem('migration_no_mocks_v5', 'true');
      window.location.reload();
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

  const [showExitWarning, setShowExitWarning] = useState<{ id: string } | null>(null);
  const [targetView, setTargetView] = useState<ViewState | null>(null);
  const [targetReportFlight, setTargetReportFlight] = useState<FlightData | null>(null);

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
        setLtName={setLtName}
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
        <div className="fixed inset-x-0 bottom-0 top-20 z-[90] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
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

      <div id="subheader-portal-target" className="w-full shrink-0 z-[60] relative"></div>

      <div className={`flex flex-1 w-full ${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-800'} transition-colors duration-500 font-sans overflow-hidden relative`}>
        <Sidebar 
          activeView={view} 
          onViewChange={handleViewChange} 
          isDarkMode={isDarkMode} 
        />

        <main className="flex-1 flex flex-col overflow-hidden relative w-full">
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
                    onOpenReport={(flight) => {
                        setTargetReportFlight(flight);
                        handleViewChange('REPORTS');
                    }}
                    pendingAction={pendingAction}
                    setPendingAction={setPendingAction}
                    ltName={ltName}
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
                    }}
                  />
                )}
                {view === 'ROOT_MESH' && (
                  <RootMesh
                    rootMeshFlights={rootMeshFlights}
                    setRootMeshFlights={setRootMeshFlights}
                    isDarkMode={isDarkMode}
                    setMeshFlightsByDate={setMeshFlightsByDate}
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
