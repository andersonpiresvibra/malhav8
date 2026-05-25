import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Layout, Check, RotateCcw, Columns, Compass, Lock, Info, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export interface UserLayoutPreferences {
  visibleTabs: {
    GRID_OPS?: boolean;          // Malha
    SHIFT_OPERATORS?: boolean;   // Equipe / Escala
    AERODROMO?: boolean;         // Aeródromo
    REPORTS?: boolean;           // Relatório
    // Admins / Sub-abas do menu expansível
    MALHA_RAIZ_ADMIN?: boolean;
    OPERATIONAL_MESH?: boolean;
    OPERATORS_ADMIN?: boolean;
    FLEETS_ADMIN?: boolean;
    AIRCRAFTS_ADMIN?: boolean;
    AIRLINES_ADMIN?: boolean;
    AERODROMO_ADMIN?: boolean;
    // Malha internal tabs
    CHEGADA?: boolean;
    FILA?: boolean;
    DESIGNADOS?: boolean;
    ABASTECENDO?: boolean;
    FINALIZADO?: boolean;
    STANDBY?: boolean;
  };
  visibleColumns: {
    airlineCode?: boolean;       // Companhia Aérea (CIA)
    registration?: boolean;      // Prefixo (PREFIXO)
    model?: boolean;             // Modelo Aeronave (MODELO)
    flightNumber?: boolean;      // Voo Chegada/Saída (V.SAÍDA)
    eta?: boolean;               // Horários (ETA/ETD)
    destination?: boolean;       // Destino (ICAO/CID)
    positionId?: boolean;        // Posição (POS)
    actualArrivalTime?: boolean; // Hora de Calço (CALÇO)
    etd?: boolean;               // SLA Restante (T. REST)
    operator?: boolean;          // Operador designado (OPERADOR)
    fleet?: boolean;             // Número da Viatura/Tipo (FROTA/F.TIPO)
    report?: boolean;            // Relatório operacional (REPORT)
    tab?: boolean;               // Botão tático (TAB)
    status?: boolean;            // Status tático (STATUS)
    [key: string]: boolean | undefined;
  };
}

export const defaultPreferences: UserLayoutPreferences = {
  visibleTabs: {
    GRID_OPS: true,
    SHIFT_OPERATORS: true,
    AERODROMO: true,
    REPORTS: true,
    MALHA_RAIZ_ADMIN: true,
    OPERATIONAL_MESH: true,
    OPERATORS_ADMIN: true,
    FLEETS_ADMIN: true,
    AIRCRAFTS_ADMIN: true,
    AIRLINES_ADMIN: true,
    AERODROMO_ADMIN: true,
    // Default subtabs for internal Malha Operacional
    CHEGADA: true,
    FILA: true,
    DESIGNADOS: true,
    ABASTECENDO: true,
    FINALIZADO: true,
    STANDBY: true,
  },
  visibleColumns: {
    airlineCode: true,
    registration: true,
    model: true,
    flightNumber: true,
    eta: true,
    destination: true,
    positionId: true,
    actualArrivalTime: true,
    etd: true,
    operator: true,
    fleet: true,
    report: true,
    tab: true,
    status: true,
  }
};

interface LayoutPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserLayoutPreferences;
  onSave: (prefs: UserLayoutPreferences, lockedCols: Record<string, boolean>, lockedTabs: Record<string, boolean>) => void;
  currentUser: string;
  lockedColumnsFromDb?: Record<string, boolean>;
  lockedTabsFromDb?: Record<string, boolean>;
}

export const LayoutPreferencesModal: React.FC<LayoutPreferencesModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onSave,
  currentUser,
  lockedColumnsFromDb,
  lockedTabsFromDb
}) => {
  const { isDarkMode } = useTheme();
  
  // Navigation tabs inside LayoutPreferences modal
  const [activeSubTab, setActiveSubTab] = useState<'columns' | 'tabs'>('columns');
  
  // Active internal Malha Operacional category/tab for columns grouping
  const [activeMeshTab, setActiveMeshTab] = useState<string>('GERAL');

  // Define tabs of the Malha Operacional
  const MESH_TABS = [
    { id: 'GERAL', label: 'Todos os voos' },
    { id: 'CHEGADA', label: 'Chegada' },
    { id: 'FILA', label: 'Fila' },
    { id: 'DESIGNADOS', label: 'Designados' },
    { id: 'ABASTECENDO', label: 'Abastecendo' },
    { id: 'FINALIZADO', label: 'Finalizados' },
    { id: 'STANDBY', label: 'Stand-by' },
  ];

  // Map of which columns are rendered inside each of these Malha Operacional tabs
  const getColumnsForTab = (tabId: string) => {
    switch (tabId) {
      case 'GERAL':
      case 'CHEGADA':
        return [
          { key: 'airlineCode', label: 'Companhia (CIA)', desc: 'Identificação e logo da empresa aérea.', isCustomizable: true },
          { key: 'registration', label: 'Prefixo (PREFIXO)', desc: 'Matrícula oficial da aeronave no pátio.', isCustomizable: true },
          { key: 'model', label: 'Modelo da Aeronave', desc: 'Modelo exato da aeronave (B738, A20N, etc).', isCustomizable: true },
          { key: 'flightNumber', label: 'Voo (V.CHEG / V.SAÍDA)', desc: 'Identificação dos voos do painel.', isCustomizable: false },
          { key: 'eta', label: 'Prev. Pouso (ETA)', desc: 'Estimativa de pouso da aeronave.', isCustomizable: true },
          { key: 'destination', label: 'Roteiro (ICAO/CID)', desc: 'Aeroporto correspondente e cidade.', isCustomizable: false },
          { key: 'positionId', label: 'Posição / Box (POS)', desc: 'Portão ou Box alocado.', isCustomizable: false },
          { key: 'actualArrivalTime', label: 'Calço', desc: 'Horário do calço físico nos portões.', isCustomizable: false },
          { key: 'etd', label: 'ETD / SLA Restante', desc: 'Margem de tempo e sinalização de SLA.', isCustomizable: false },
          { key: 'operator', label: 'Operador Designado', desc: 'Nome do operador de pista alocado.', isCustomizable: true },
          { key: 'fleet', label: 'Viatura (Frota & Tipo)', desc: 'Carro-tanque ou hidrante acoplado.', isCustomizable: true },
          { key: 'status', label: 'Status da Missão (STATUS)', desc: 'Coluna de estado tático e SLAs operacionais.', isCustomizable: true },
          { key: 'report', label: 'Botões Log (REPORT)', desc: 'Histórico e auditoria de checklist.', isCustomizable: false },
          { key: 'tab', label: 'Botões Ação (TAB)', desc: 'Botão de despacho e comando operacional direto.', isCustomizable: false },
        ];
      case 'FILA':
        return [
          { key: 'airlineCode', label: 'Companhia (CIA)', desc: 'Identificação e logo da empresa aérea.', isCustomizable: true },
          { key: 'flightNumber', label: 'V.SAÍDA', desc: 'Voo de decolagem planejado na malha.', isCustomizable: false },
          { key: 'destination', label: 'Roteiro (ICAO/CID)', desc: 'Aeroporto correspondente e cidade.', isCustomizable: false },
          { key: 'registration', label: 'Prefixo (PREFIXO)', desc: 'Matrícula oficial da aeronave no pátio.', isCustomizable: true },
          { key: 'positionId', label: 'Posição / Box (POS)', desc: 'Portão ou Box alocado.', isCustomizable: false },
          { key: 'etd', label: 'ETD / SLA Restante', desc: 'Margem de tempo e sinalização de SLA.', isCustomizable: false },
          { key: 'actualArrivalTime', label: 'Calço', desc: 'Horário do calço físico nos portões.', isCustomizable: false },
          { key: 'eta', label: 'Prev. Pouso (ETA)', desc: 'Estimativa de pouso da aeronave.', isCustomizable: true },
          { key: 'operator', label: 'Operador Designado', desc: 'Nome do operador de pista alocado.', isCustomizable: true },
          { key: 'fleet', label: 'Viatura (Frota & Tipo)', desc: 'Carro-tanque ou hidrante acoplado.', isCustomizable: true },
          { key: 'status', label: 'Status da Missão (STATUS)', desc: 'Coluna de estado tático e SLAs operacionais.', isCustomizable: true },
        ];
      case 'DESIGNADOS':
        return [
          { key: 'operator', label: 'Operador (HR.D / LT)', desc: 'Nome do operador e hora da designação.', isCustomizable: true },
          { key: 'flightNumber', label: 'Voo Chegada/Saída', desc: 'Identificação dos voos do painel.', isCustomizable: false },
          { key: 'positionId', label: 'Posição / Box (POS)', desc: 'Portão ou Box alocado.', isCustomizable: false },
          { key: 'airlineCode', label: 'Companhia (CIA)', desc: 'Identificação e logo da empresa aérea.', isCustomizable: true },
          { key: 'registration', label: 'Prefixo (PREFIXO)', desc: 'Matrícula oficial da aeronave.', isCustomizable: true },
          { key: 'model', label: 'Modelo da Aeronave', desc: 'Modelo exato da aeronave.', isCustomizable: true },
          { key: 'actualArrivalTime', label: 'Calço', desc: 'Horário do calço físico nos portões.', isCustomizable: false },
          { key: 'etd', label: 'ETD / SLA Restante', desc: 'Margem de tempo e sinalização de SLA.', isCustomizable: false },
          { key: 'destination', label: 'Roteiro (ICAO/CID)', desc: 'Aeroporto correspondente e cidade.', isCustomizable: false },
          { key: 'fleet', label: 'Viatura (Frota & Tipo)', desc: 'Carro-tanque ou hidrante acoplado.', isCustomizable: true },
          { key: 'status', label: 'Status da Missão (STATUS)', desc: 'Coluna de estado tático e SLAs operacionais.', isCustomizable: true },
          { key: 'report', label: 'Botões Log (REPORT)', desc: 'Histórico e auditoria de checklist.', isCustomizable: false },
          { key: 'tab', label: 'Botões Ação (TAB)', desc: 'Botão de despacho e comando operacional direto.', isCustomizable: false },
        ];
      case 'ABASTECENDO':
      case 'FINALIZADO':
        return [
          { key: 'airlineCode', label: 'Companhia (CIA)', desc: 'Identificação e logo da empresa aérea.', isCustomizable: true },
          { key: 'registration', label: 'Prefixo (PREFIXO)', desc: 'Matrícula de aeronave abastecida no pátio.', isCustomizable: true },
          { key: 'model', label: 'Modelo da Aeronave', desc: 'Modelo exato da aeronave.', isCustomizable: true },
          { key: 'flightNumber', label: 'Voo Chegada/Saída', desc: 'Identificação dos voos.', isCustomizable: false },
          { key: 'destination', label: 'Roteiro (ICAO/CID)', desc: 'Aeroporto correspondente e cidade.', isCustomizable: false },
          { key: 'positionId', label: 'Posição / Box (POS)', desc: 'Portão ou Box alocado.', isCustomizable: false },
          { key: 'actualArrivalTime', label: 'Calço', desc: 'Horário do calço físico nos portões.', isCustomizable: false },
          { key: 'etd', label: 'ETD / SLA Restante', desc: 'Margem de tempo e sinalização de SLA.', isCustomizable: false },
          { key: 'operator', label: 'Operador Designado', desc: 'Nome do operador de pista alocado.', isCustomizable: true },
          { key: 'fleet', label: 'Viatura (Frota & Tipo)', desc: 'Carro-tanque ou hidrante acoplado.', isCustomizable: true },
          { key: 'status', label: 'Status da Missão (STATUS)', desc: 'Coluna de estado tático e SLAs operacionais.', isCustomizable: true },
          { key: 'report', label: 'Botões Log (REPORT)', desc: 'Histórico e auditoria de checklist.', isCustomizable: false },
          { key: 'tab', label: 'Botões Ação (TAB)', desc: 'Botão de despacho e comando operacional direto.', isCustomizable: false },
        ];
      case 'STANDBY':
        return [
          { key: 'airlineCode', label: 'Companhia (CIA)', desc: 'Identificação e logo da empresa aérea.', isCustomizable: true },
          { key: 'registration', label: 'Prefixo (PREFIXO)', desc: 'Matrícula de aeronave no pátio.', isCustomizable: true },
          { key: 'model', label: 'Modelo da Aeronave', desc: 'Modelo exato da aeronave.', isCustomizable: true },
          { key: 'flightNumber', label: 'Voo Chegada/Saída', desc: 'Identificação dos voos.', isCustomizable: false },
          { key: 'destination', label: 'Roteiro (ICAO/CID)', desc: 'Aeroporto correspondente e cidade.', isCustomizable: false },
          { key: 'positionId', label: 'Posição / Box (POS)', desc: 'Portão ou Box alocado.', isCustomizable: false },
          { key: 'actualArrivalTime', label: 'Calço', desc: 'Horário do calço físico nos portões.', isCustomizable: false },
          { key: 'eta', label: 'Prev. Pouso (ETA)', desc: 'Estimativa de pouso da aeronave.', isCustomizable: true },
          { key: 'etd', label: 'ETD / SLA Restante', desc: 'Margem de tempo e sinalização de SLA.', isCustomizable: false },
          { key: 'operator', label: 'Operador Designado', desc: 'Nome do operador de pista alocado.', isCustomizable: true },
          { key: 'fleet', label: 'Viatura (Frota & Tipo)', desc: 'Carro-tanque ou hidrante acoplado.', isCustomizable: true },
          { key: 'status', label: 'Status da Missão (STATUS)', desc: 'Coluna de estado tático e SLAs operacionais.', isCustomizable: true },
        ];
      default:
        return [];
    }
  };

  // Local state initialized with current preferences
  const [localPrefs, setLocalPrefs] = useState<UserLayoutPreferences>(() => {
    const baseCols = { ...defaultPreferences.visibleColumns, ...preferences.visibleColumns };
    const baseTabs = { ...defaultPreferences.visibleTabs, ...preferences.visibleTabs };
    return { visibleColumns: baseCols, visibleTabs: baseTabs };
  });

  // Keep static non-modifiable locks structure (since sidebar is no longer customizable)
  // We keep locked flags internally to maintain standard functional compatibility
  const [lockedColumns] = useState<Record<string, boolean>>(() => {
    return {
      flightNumber: true,
      destination: true,
      positionId: true,
      actualArrivalTime: true,
      etd: true,
    };
  });

  const [lockedTabs] = useState<Record<string, boolean>>(() => {
    return {
      GRID_OPS: true,
    };
  });

  React.useEffect(() => {
    if (isOpen) {
      const baseCols = { ...defaultPreferences.visibleColumns, ...preferences.visibleColumns };
      const baseTabs = { ...defaultPreferences.visibleTabs, ...preferences.visibleTabs };
      setLocalPrefs({ visibleColumns: baseCols, visibleTabs: baseTabs });
    }
  }, [isOpen, preferences]);

  if (!isOpen) return null;

  // Toggles the visibility state of a column key globally
  const toggleColumn = (key: keyof UserLayoutPreferences['visibleColumns']) => {
    setLocalPrefs(prev => ({
      ...prev,
      visibleColumns: {
        ...prev.visibleColumns,
        [key]: !prev.visibleColumns[key]
      }
    }));
  };

  // Toggles the visibility state of a sub-tab key (CHEGADA, FILA, etc.)
  const toggleTab = (key: keyof UserLayoutPreferences['visibleTabs']) => {
    setLocalPrefs(prev => ({
      ...prev,
      visibleTabs: {
        ...prev.visibleTabs,
        [key]: !prev.visibleTabs[key]
      }
    }));
  };

  // Reverts customizations to default layouts
  const handleReset = () => {
    if (confirm('Deseja restaurar as configurações padrão de visualização da Malha Operacional?')) {
      setLocalPrefs(JSON.parse(JSON.stringify(defaultPreferences)));
    }
  };

  // Saves and triggers event for real-time update
  const handleSaveSubmit = () => {
    // Keep sidebar and critical columns visible
    const finalVisibleColumns = { ...localPrefs.visibleColumns };
    Object.keys(lockedColumns).forEach(key => {
      if (lockedColumns[key]) {
        finalVisibleColumns[key as keyof UserLayoutPreferences['visibleColumns']] = true;
      }
    });

    const finalVisibleTabs = { ...localPrefs.visibleTabs };
    // Keep sidebar views always active as sidebar is not customizable
    finalVisibleTabs.GRID_OPS = true;
    finalVisibleTabs.SHIFT_OPERATORS = true;
    finalVisibleTabs.AERODROMO = true;
    finalVisibleTabs.REPORTS = true;
    finalVisibleTabs.MALHA_RAIZ_ADMIN = true;
    finalVisibleTabs.OPERATIONAL_MESH = true;
    finalVisibleTabs.OPERATORS_ADMIN = true;
    finalVisibleTabs.FLEETS_ADMIN = true;
    finalVisibleTabs.AIRCRAFTS_ADMIN = true;
    finalVisibleTabs.AIRLINES_ADMIN = true;
    finalVisibleTabs.AERODROMO_ADMIN = true;

    const finalPrefs = {
      visibleColumns: finalVisibleColumns,
      visibleTabs: finalVisibleTabs
    };

    onSave(finalPrefs, lockedColumns, lockedTabs);
    window.dispatchEvent(new Event('layout-locks-updated'));
    onClose();
  };

  const columnsList = getColumnsForTab(activeMeshTab);

  return createPortal(
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border flex flex-col max-h-[85vh] transition-colors duration-300 ${
        isDarkMode ? 'bg-[#121622] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b shrink-0 ${
          isDarkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-100 bg-slate-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${
              isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700'
            }`}>
              <Layout size={20} />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-tight">Personalização da Malha Operacional</h3>
              <p className={`text-[10px] uppercase font-bold tracking-widest ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Visualização do LT: <span className="text-emerald-500 dark:text-emerald-400 font-extrabold">{currentUser}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Main Navigation */}
        <div className={`flex border-b px-6 shrink-0 ${
          isDarkMode ? 'border-slate-800 bg-slate-900/10' : 'border-slate-100 bg-slate-50/50'
        }`}>
          <button
            onClick={() => setActiveSubTab('columns')}
            className={`py-3.5 px-4 text-xs font-black uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              activeSubTab === 'columns'
                ? isDarkMode
                  ? 'border-indigo-500 text-indigo-400 font-black'
                  : 'border-emerald-600 text-emerald-800 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Columns size={14} /> Colunas por Aba
          </button>
          <button
            onClick={() => setActiveSubTab('tabs')}
            className={`py-3.5 px-4 text-xs font-black uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              activeSubTab === 'tabs'
                ? isDarkMode
                  ? 'border-indigo-500 text-indigo-400 font-black'
                  : 'border-emerald-600 text-emerald-800 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Compass size={14} /> Visualização de Abas
          </button>
        </div>

        {/* Content Panel */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {activeSubTab === 'columns' ? (
            <div className="flex flex-col gap-4">
              <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                isDarkMode ? 'bg-slate-900/40 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                <Info size={16} className="text-sky-500 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Selecione uma das abas abaixo para revisar suas colunas. Tente desmarcar colunas redundantes para diminuir a fadiga visual. Colunas críticas de controle, horários obrigatórios e botões táticos são fixados pelo sistema.
                </p>
              </div>

              {/* Subtabs representing actual views on Malha Operacional */}
              <div className="flex gap-1.5 overflow-x-auto pb-1.5 shrink-0 scrollbar-thin">
                {MESH_TABS.map((tab) => {
                  const isActive = activeMeshTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveMeshTab(tab.id)}
                      className={`text-[9px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${
                        isActive
                          ? isDarkMode
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                            : 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                          : isDarkMode
                            ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                            : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200/80'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Columns list for the selected grid subtab */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                {columnsList.map(({ key, label, desc, isCustomizable }) => {
                  const isVisible = localPrefs.visibleColumns[key] !== false;
                  
                  return (
                    <button
                      key={key}
                      onClick={() => isCustomizable && toggleColumn(key as keyof UserLayoutPreferences['visibleColumns'])}
                      disabled={!isCustomizable}
                      className={`flex items-start text-left gap-3.5 p-3 rounded-xl border transition-all ${
                        !isCustomizable
                          ? isDarkMode
                            ? 'bg-slate-900/40 border-slate-950 text-slate-400 cursor-not-allowed opacity-95'
                            : 'bg-slate-100/75 border-slate-200 text-slate-500 cursor-not-allowed opacity-95'
                          : isVisible
                            ? isDarkMode
                              ? 'bg-indigo-500/5 border-indigo-500/20 text-white shadow-sm'
                              : 'bg-emerald-50/40 border-emerald-600/20 text-slate-900 shadow-sm'
                            : isDarkMode
                              ? 'bg-slate-900/10 border-slate-800/80 text-slate-500'
                              : 'bg-slate-50/50 border-slate-150 text-slate-400'
                      }`}
                    >
                      <div className="mt-0.5">
                        {!isCustomizable ? (
                          <div className={`p-1 rounded-md ${isDarkMode ? 'bg-amber-600/10 text-amber-500' : 'bg-amber-100/80 text-amber-700'}`}>
                            <Lock size={12} strokeWidth={3} />
                          </div>
                        ) : isVisible ? (
                          <div className={`p-1 rounded-md ${isDarkMode ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'}`}>
                            <Check size={12} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className={`w-[20px] h-[20px] rounded-md border-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`} />
                        )}
                      </div>
                      <div className="flex-1 leading-normal">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black block tracking-tight uppercase">{label}</span>
                          {!isCustomizable && (
                            <span className={`text-[8px] font-extrabold uppercase px-1 py-0.5 rounded leading-none ${
                              isDarkMode ? 'bg-amber-950/40 text-amber-500' : 'bg-amber-100 text-amber-800'
                            }`}>
                              Sempre Visível
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] block mt-0.5 ${
                          !isCustomizable
                            ? isDarkMode ? 'text-slate-500' : 'text-slate-500 font-medium'
                            : isVisible
                              ? isDarkMode ? 'text-slate-300' : 'text-slate-600'
                              : isDarkMode ? 'text-slate-600' : 'text-slate-400'
                        }`}>
                          {desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                isDarkMode ? 'bg-slate-900/40 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                <Info size={16} className="text-sky-500 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Desmarque as abas da Malha Operacional que você não precisa acompanhar no painel central de despachos rápidos. A aba "Todos os Voos" sempre permanece ativa por motivos de auditoria de segurança.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {[
                  { key: 'CHEGADA', label: 'Chegada', desc: 'Amostragem de voos estimados para pouso e calço.' },
                  { key: 'FILA', label: 'Fila', desc: 'Alocação pendente de operadores do pátio.' },
                  { key: 'DESIGNADOS', label: 'Designados', desc: 'Voos delegados com operador atribuído.' },
                  { key: 'ABASTECENDO', label: 'Abastecendo', desc: 'Aeronaves recebendo combustível ativamente.' },
                  { key: 'FINALIZADO', label: 'Finalizados', desc: 'Histórico de checklists concluídos e cancelamentos.' },
                  { key: 'STANDBY', label: 'Stand-by', desc: 'Abas de acompanhamento tático prioritário.' },
                ].map(({ key, label, desc }) => {
                  const isVisible = localPrefs.visibleTabs[key as keyof UserLayoutPreferences['visibleTabs']] !== false;
                  
                  return (
                    <button
                      key={key}
                      onClick={() => toggleTab(key as keyof UserLayoutPreferences['visibleTabs'])}
                      className={`flex items-start text-left gap-3.5 p-3 rounded-xl border transition-all ${
                        isVisible
                          ? isDarkMode
                            ? 'bg-indigo-500/5 border-indigo-500/20 text-white shadow-sm'
                            : 'bg-emerald-50/40 border-emerald-600/20 text-slate-900 shadow-sm'
                          : isDarkMode
                            ? 'bg-slate-900/10 border-slate-800/80 text-slate-500'
                            : 'bg-slate-50/50 border-slate-100 text-slate-400'
                      }`}
                    >
                      <div className="mt-0.5">
                        {isVisible ? (
                          <div className={`p-1 rounded-md ${isDarkMode ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'}`}>
                            <Check size={12} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className={`w-[20px] h-[20px] rounded-md border-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`} />
                        )}
                      </div>
                      <div className="flex-1 leading-normal">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black block tracking-tight uppercase">{label}</span>
                        </div>
                        <span className={`text-[10px] block mt-0.5 ${
                          isVisible
                            ? isDarkMode ? 'text-slate-300' : 'text-slate-650'
                            : isDarkMode ? 'text-slate-600' : 'text-slate-400'
                        }`}>
                          {desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 flex justify-between gap-3 shrink-0 ${
          isDarkMode ? 'bg-slate-950/50 border-t border-slate-800/60' : 'bg-slate-50 border-t border-slate-100'
        }`}>
          <button
            onClick={handleReset}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${
              isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-850' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/55'
            }`}
          >
            <RotateCcw size={14} /> Resetar Padrão
          </button>
          
          <div className="flex gap-2">
            <button
               onClick={onClose}
               className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${
                 isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-200/60 text-slate-700 hover:bg-slate-200'
               }`}
            >
              Cancelar
            </button>
            <button
               onClick={handleSaveSubmit}
               className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-white shadow-lg active:scale-95 flex items-center gap-2 ${
                 isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-emerald-600 hover:bg-emerald-500'
               }`}
            >
              <Check size={14} /> Aplicar Ajustes
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
