import React, { useState, useEffect, Suspense, lazy } from 'react';
import { ViewState, FlightData, Vehicle } from './types';
import { MOCK_TEAM_PROFILES } from './data/mockData';
import { MOCK_VEHICLES } from './data/mockVehicleData';
import { MeshFlight, INITIAL_MESH_FLIGHTS } from './data/operationalMesh';
import { DashboardHeader } from './components/DashboardHeader';
import { Spinner } from './components/ui/Spinner';
import { useTheme } from './contexts/ThemeContext';
import { Table, X, AlertCircle } from 'lucide-react';
import { OperatorProfile } from './types';
import { ShiftOperatorsSection } from './components/ShiftOperatorsSection';
import { Sidebar } from './components/Sidebar';
import { OperationalMesh } from './components/OperationalMesh';
import { ReportsView } from './components/ReportsView';

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

  const [globalVehicles, setGlobalVehicles] = useState<Vehicle[]>(MOCK_VEHICLES);
  const [globalOperators, setGlobalOperators] = useState<OperatorProfile[]>([]);
  const [meshFlights, setMeshFlights] = useState<MeshFlight[]>(() => {
    const saved = localStorage.getItem('meshFlights');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse meshFlights from localStorage', e);
      }
    }
    return INITIAL_MESH_FLIGHTS;
  });

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

  const isNameInvalid = !ltName || ltName.trim() === '';

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
                    setFlights={setGlobalFlights}
                    globalFlights={globalFlights}
                    onActivateMesh={(newFlights) => {
                      setGlobalFlights(prev => [...newFlights, ...prev]);
                    }}
                  />
                )}
                {view === 'REPORTS' && (
                  <ReportsView flights={globalFlights} initialFlight={targetReportFlight} />
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
