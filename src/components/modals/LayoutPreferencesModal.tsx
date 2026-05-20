import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Layout, ToggleLeft, ToggleRight, Check, RotateCcw, Columns, Compass, Lock, Unlock, Shield } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export interface UserLayoutPreferences {
  visibleTabs: {
    GRID_OPS: boolean;          // Malha
    SHIFT_OPERATORS: boolean;   // Equipe / Escala
    AERODROMO: boolean;         // Aeródromo
    REPORTS: boolean;           // Relatório
    // Admins / Sub-abas do menu expansível
    MALHA_RAIZ_ADMIN: boolean;
    OPERATIONAL_MESH: boolean;
    OPERATORS_ADMIN: boolean;
    FLEETS_ADMIN: boolean;
    AIRCRAFTS_ADMIN: boolean;
    AIRLINES_ADMIN: boolean;
    AERODROMO_ADMIN: boolean;
  };
  visibleColumns: {
    airlineCode: boolean;       // Companhia Aérea (COMP.)
    registration: boolean;      // Prefixo (PREFIXO)
    model: boolean;             // Modelo Aeronave (MODELO)
    flightNumber: boolean;      // Voo Chegada/Saída (V.SAÍDA)
    eta: boolean;               // Horários (ETA/ETD)
    destination: boolean;       // Destino (ICAO/CID)
    positionId: boolean;        // Posição (POS)
    actualArrivalTime: boolean; // Hora de Calço (CALÇO)
    etd: boolean;               // SLA Restante (T. REST)
    operator: boolean;          // Operador designado (OPERADOR)
    fleet: boolean;             // Número da Viatura/Tipo (FROTA/F.TIPO)
    report: boolean;            // Relatório operacional (REPORT)
    tab: boolean;               // Botão tático (TAB)
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
  const [activeSubTab, setActiveSubTab] = useState<'columns' | 'tabs' | 'locks'>('columns');
  
  // Local state for locked components (stored in localStorage / synced from props)
  const [lockedColumns, setLockedColumns] = useState<Record<string, boolean>>(() => {
    if (lockedColumnsFromDb) return lockedColumnsFromDb;
    const saved = localStorage.getItem('layout_locks_columns');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // use default patterns
      }
    }
    // Default initial mandatory columns
    return {
      flightNumber: true,
      positionId: true,
      operator: true,
      etd: true,
    };
  });

  const [lockedTabs, setLockedTabs] = useState<Record<string, boolean>>(() => {
    if (lockedTabsFromDb) return lockedTabsFromDb;
    const saved = localStorage.getItem('layout_locks_tabs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // use default patterns
      }
    }
    // Default initial mandatory tabs
    return {
      GRID_OPS: true,
    };
  });

  // Local state initialized with current preferences, forced true if locked
  const getInitialPrefs = () => {
    const baseCols = { ...defaultPreferences.visibleColumns, ...preferences.visibleColumns };
    const baseTabs = { ...defaultPreferences.visibleTabs, ...preferences.visibleTabs };
    
    // Force highly restrictive settings if locked
    Object.keys(lockedColumns).forEach(key => {
      if (lockedColumns[key]) {
        baseCols[key as keyof UserLayoutPreferences['visibleColumns']] = true;
      }
    });
    Object.keys(lockedTabs).forEach(key => {
      if (lockedTabs[key]) {
        baseTabs[key as keyof UserLayoutPreferences['visibleTabs']] = true;
      }
    });

    return { visibleColumns: baseCols, visibleTabs: baseTabs };
  };

  const [localPrefs, setLocalPrefs] = useState<UserLayoutPreferences>(getInitialPrefs);

  // Sync state if modal reopens or props change
  React.useEffect(() => {
    if (isOpen) {
      if (lockedColumnsFromDb) setLockedColumns(lockedColumnsFromDb);
      if (lockedTabsFromDb) setLockedTabs(lockedTabsFromDb);
    }
  }, [isOpen, lockedColumnsFromDb, lockedTabsFromDb]);

  React.useEffect(() => {
    if (isOpen) {
      setLocalPrefs(getInitialPrefs());
    }
  }, [isOpen, preferences, lockedColumns, lockedTabs]);

  if (!isOpen) return null;

  const toggleColumn = (key: keyof UserLayoutPreferences['visibleColumns']) => {
    if (lockedColumns[key]) return; // Cannot modify locked column
    
    setLocalPrefs(prev => ({
      ...prev,
      visibleColumns: {
        ...prev.visibleColumns,
        [key]: !prev.visibleColumns[key]
      }
    }));
  };

  const toggleTab = (key: keyof UserLayoutPreferences['visibleTabs']) => {
    if (lockedTabs[key]) return; // Cannot modify locked tab
    
    setLocalPrefs(prev => ({
      ...prev,
      visibleTabs: {
        ...prev.visibleTabs,
        [key]: !prev.visibleTabs[key]
      }
    }));
  };

  const toggleLockColumn = (key: string) => {
    const updated = {
      ...lockedColumns,
      [key]: !lockedColumns[key]
    };
    setLockedColumns(updated);
    localStorage.setItem('layout_locks_columns', JSON.stringify(updated));
    
    // If locked, automatically force visiblity to true
    if (updated[key]) {
      setLocalPrefs(prev => ({
        ...prev,
        visibleColumns: {
          ...prev.visibleColumns,
          [key]: true
        }
      }));
    }
  };

  const toggleLockTab = (key: string) => {
    const updated = {
      ...lockedTabs,
      [key]: !lockedTabs[key]
    };
    setLockedTabs(updated);
    localStorage.setItem('layout_locks_tabs', JSON.stringify(updated));
    
    // If locked, automatically force visibility to true
    if (updated[key]) {
      setLocalPrefs(prev => ({
        ...prev,
        visibleTabs: {
          ...prev.visibleTabs,
          [key]: true
        }
      }));
    }
  };

  const handleReset = () => {
    if (confirm('Deseja restaurar as configurações padrão de layout e travas?')) {
      const defaultColsLock = {
        flightNumber: true,
        positionId: true,
        operator: true,
        etd: true,
      };
      const defaultTabsLock = {
        GRID_OPS: true,
      };
      
      setLockedColumns(defaultColsLock);
      setLockedTabs(defaultTabsLock);
      localStorage.setItem('layout_locks_columns', JSON.stringify(defaultColsLock));
      localStorage.setItem('layout_locks_tabs', JSON.stringify(defaultTabsLock));
      
      const resetPrefs = JSON.parse(JSON.stringify(defaultPreferences));
      // Force defaults
      Object.keys(defaultColsLock).forEach(k => { if (defaultColsLock[k as keyof typeof defaultColsLock]) resetPrefs.visibleColumns[k as any] = true; });
      Object.keys(defaultTabsLock).forEach(k => { if (defaultTabsLock[k as keyof typeof defaultTabsLock]) resetPrefs.visibleTabs[k as any] = true; });

      setLocalPrefs(resetPrefs);
    }
  };

  const handleSaveSubmit = () => {
    // Ensure locked remain visible
    const finalVisibleColumns = { ...localPrefs.visibleColumns };
    Object.keys(lockedColumns).forEach(key => {
      if (lockedColumns[key]) {
        finalVisibleColumns[key as keyof UserLayoutPreferences['visibleColumns']] = true;
      }
    });

    const finalVisibleTabs = { ...localPrefs.visibleTabs };
    Object.keys(lockedTabs).forEach(key => {
      if (lockedTabs[key]) {
        finalVisibleTabs[key as keyof UserLayoutPreferences['visibleTabs']] = true;
      }
    });

    const finalPrefs = {
      visibleColumns: finalVisibleColumns,
      visibleTabs: finalVisibleTabs
    };

    onSave(finalPrefs, lockedColumns, lockedTabs);
    window.dispatchEvent(new Event('layout-locks-updated'));
    onClose();
  };

  const columnMetadata = [
    { key: 'airlineCode' as const, label: 'Companhia (COMP.)', desc: 'Identificação e logo das empresas aéreas brasileiras e internacionais.' },
    { key: 'registration' as const, label: 'Prefixo (PRFX)', desc: 'Matrícula oficial da aeronave abastecida no pátio de Guarulhos.' },
    { key: 'model' as const, label: 'Modelo da Aeronave', desc: 'Fabricante e modelo exato do avião (B738, A20N, B77W, etc).' },
    { key: 'flightNumber' as const, label: 'Identificação de Voos', desc: 'Códigos dos voos de pouso e de decolagem planejados na malha.' },
    { key: 'eta' as const, label: 'ETA / ETD planejado', desc: 'Estimativas oficiais de pouso e partida da aeronave.' },
    { key: 'destination' as const, label: 'Origem / Destino', desc: 'Localidades, código ICAO do aeroporto e nome correspondente da cidade.' },
    { key: 'positionId' as const, label: 'Posição / Box', desc: 'Portão de calço (gate ou box remoto) onde a aeronave se posicionou.' },
    { key: 'actualArrivalTime' as const, label: 'Hora de Calço', desc: 'Horário do calço físico nos portões do terminal de GRU SBGR.' },
    { key: 'etd' as const, label: 'SLA / Tempo de Calço', desc: 'Sinalizador do tempo disponível para abastecimento, margem de atraso.' },
    { key: 'operator' as const, label: 'Operador Designado', desc: 'Nome do operador de abastecimento com atalhos de atribuição rápida.' },
    { key: 'fleet' as const, label: 'Viatura (Frota & Tipo)', desc: 'Identificação da viatura (Servidor de Hidrante ou CTA) e tipo operacional.' },
    { key: 'report' as const, label: 'Log e Report', desc: 'Histórico operacional com atalho em tempo real para auditoria de checklists.' },
    { key: 'tab' as const, label: 'Ação Tática (TAB)', desc: 'Controle direto de ações rápidas baseados no fluxo de status dos voos.' },
  ];

  const tabMetadata = [
    { key: 'GRID_OPS' as const, label: 'Painel da Malha', desc: 'Central operacional de monitoramento de voos, SLAs e despacho rápido.' },
    { key: 'SHIFT_OPERATORS' as const, label: 'Organização de Equipe', desc: 'Escala de pessoal, descanso, horários e capacidade das alas.' },
    { key: 'AERODROMO' as const, label: 'Visualizador de Aeródromo', desc: 'Gargalos físicos de portão, caminhões no pátio e posições remotas.' },
    { key: 'REPORTS' as const, label: 'Painel de Relatórios', desc: 'Sumarização de eventos, histórico de checklists e exportação para XLS.' },
    
    { key: 'MALHA_RAIZ_ADMIN' as const, label: 'BD: Malha Raiz', desc: 'Interface de importação e manutenção da base de voos planejados (VRA).' },
    { key: 'OPERATIONAL_MESH' as const, label: 'BD: Malha Operacional', desc: 'Banco de dados mutável das operações correntes em Guarulhos.' },
    { key: 'OPERATORS_ADMIN' as const, label: 'Cadastro: Operadores', desc: 'Banco de perfis, habilidades, fotos e exames da equipe ativa.' },
    { key: 'FLEETS_ADMIN' as const, label: 'Cadastro: Frotas', desc: 'Controle de viaturas, fluxo volumétrico máximo e dados de hidrantes.' },
    { key: 'AIRCRAFTS_ADMIN' as const, label: 'Cadastro: Aeronaves', desc: 'Controle das aeronaves integradas ao ecossistema do aeroporto.' },
    { key: 'AIRLINES_ADMIN' as const, label: 'Cadastro: Empresas Aéreas', desc: 'Código de cores e fotos das logomarcas oficiais das parcerias Vibra.' },
    { key: 'AERODROMO_ADMIN' as const, label: 'Config de Portões / Boxes', desc: 'Controle geométrico e de restrição do pátio de combustível (GRU).' },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-200">
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
              <h3 className="text-base font-black uppercase tracking-tight">Personalização de Painel</h3>
              <p className={`text-[10px] uppercase font-bold tracking-widest ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Configuração para o login do LT: <span className="text-emerald-500 font-extrabold">{currentUser}</span>
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

        {/* Modal Navigation */}
        <div className={`flex border-b px-6 shrink-0 ${
          isDarkMode ? 'border-slate-800 bg-slate-900/10' : 'border-slate-100 bg-slate-50/50'
        }`}>
          <button
            onClick={() => setActiveSubTab('columns')}
            className={`py-3.5 px-4 text-xs font-black uppercase tracking-wider border-b-2 flex items-center gap-2 transition-colors ${
              activeSubTab === 'columns'
                ? isDarkMode
                  ? 'border-indigo-500 text-indigo-400 font-black'
                  : 'border-emerald-600 text-emerald-800 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Columns size={14} /> Colunas da Malha
          </button>
          <button
            onClick={() => setActiveSubTab('tabs')}
            className={`py-3.5 px-4 text-xs font-black uppercase tracking-wider border-b-2 flex items-center gap-2 transition-colors ${
              activeSubTab === 'tabs'
                ? isDarkMode
                  ? 'border-indigo-500 text-indigo-400 font-black'
                  : 'border-emerald-600 text-emerald-800 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Compass size={14} /> Abas e Menus
          </button>
          <button
            onClick={() => setActiveSubTab('locks')}
            className={`py-3.5 px-4 text-xs font-black uppercase tracking-wider border-b-2 flex items-center gap-2 transition-colors ${
              activeSubTab === 'locks'
                ? isDarkMode
                  ? 'border-indigo-500 text-indigo-400 font-black'
                  : 'border-emerald-600 text-emerald-800 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Lock size={14} /> 🔒 Editar Travas / Obrigatoriedade
          </button>
        </div>

        {/* Content Panel */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {activeSubTab === 'columns' ? (
            <div className="flex flex-col gap-3">
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} mb-2`}>
                Selecione as colunas da malha operacional que deseja visualizar. Desmarque para limpar seu campo visual e diminuir a fadiga durante turnos agitados de pátio em Guarulhos.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {columnMetadata.map(({ key, label, desc }) => {
                  const isVisible = localPrefs.visibleColumns[key];
                  const isLocked = lockedColumns[key];
                  return (
                    <button
                      key={key}
                      onClick={() => toggleColumn(key)}
                      disabled={isLocked}
                      className={`flex items-start text-left gap-3.5 p-3 rounded-xl border transition-all ${
                        isLocked
                          ? isDarkMode
                            ? 'bg-slate-900/50 border-slate-800/80 text-slate-400 cursor-not-allowed opacity-90'
                            : 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed opacity-90'
                          : isVisible
                            ? isDarkMode
                              ? 'bg-indigo-500/5 border-indigo-500/20 text-white shadow-sm'
                              : 'bg-emerald-50/40 border-emerald-600/20 text-slate-900 shadow-sm'
                            : isDarkMode
                              ? 'bg-slate-900/10 border-slate-800/80 text-slate-500'
                              : 'bg-slate-50/50 border-slate-100 text-slate-400'
                      }`}
                    >
                      <div className="mt-0.5">
                        {isLocked ? (
                          <div className={`p-1 rounded-md ${isDarkMode ? 'bg-amber-600/20 text-amber-500' : 'bg-amber-100 text-amber-700'}`}>
                            <Lock size={12} strokeWidth={3} />
                          </div>
                        ) : isVisible ? (
                          <div className={`p-1 rounded-md ${isDarkMode ? 'bg-indigo-500 text-white' : 'bg-emerald-600 text-white'}`}>
                            <Check size={12} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className={`w-[20px] h-[20px] rounded-md border-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`} />
                        )}
                      </div>
                      <div className="flex-1 leading-normal">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black block tracking-tight uppercase">{label}</span>
                          {isLocked && (
                            <span className={`text-[8px] font-extrabold uppercase px-1 py-0.5 rounded leading-none ${
                              isDarkMode ? 'bg-amber-950/40 text-amber-500' : 'bg-amber-100 text-amber-800'
                            }`}>
                              Obrigatório
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] block mt-0.5 ${
                          isLocked
                            ? isDarkMode ? 'text-slate-550' : 'text-slate-500 font-medium'
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
          ) : activeSubTab === 'tabs' ? (
            <div className="flex flex-col gap-3">
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} mb-2`}>
                Desmarque as abas ou views administrativas que sua skala atual não demanda gerenciar. Elas estarão ocultas na barra lateral e nos sub-menus, mas permanecem seguras na base relacional do Supabase.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tabMetadata.map(({ key, label, desc }) => {
                  const isVisible = localPrefs.visibleTabs[key];
                  const isLocked = lockedTabs[key];
                  return (
                    <button
                      key={key}
                      onClick={() => toggleTab(key)}
                      disabled={isLocked}
                      className={`flex items-start text-left gap-3.5 p-3 rounded-xl border transition-all ${
                        isLocked
                          ? isDarkMode
                            ? 'bg-slate-900/50 border-slate-800/80 text-slate-400 cursor-not-allowed opacity-90'
                            : 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed opacity-90'
                          : isVisible
                            ? isDarkMode
                              ? 'bg-indigo-500/5 border-indigo-500/20 text-white shadow-sm'
                              : 'bg-emerald-50/40 border-emerald-600/20 text-slate-900 shadow-sm'
                            : isDarkMode
                              ? 'bg-slate-900/10 border-slate-800/80 text-slate-500'
                              : 'bg-slate-50/50 border-slate-100 text-slate-400'
                      }`}
                    >
                      <div className="mt-0.5">
                        {isLocked ? (
                          <div className={`p-1 rounded-md ${isDarkMode ? 'bg-amber-600/20 text-amber-500' : 'bg-amber-100 text-amber-700'}`}>
                            <Lock size={12} strokeWidth={3} />
                          </div>
                        ) : isVisible ? (
                          <div className={`p-1 rounded-md ${isDarkMode ? 'bg-indigo-500 text-white' : 'bg-emerald-600 text-white'}`}>
                            <Check size={12} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className={`w-[20px] h-[20px] rounded-md border-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`} />
                        )}
                      </div>
                      <div className="flex-1 leading-normal">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black block tracking-tight uppercase">{label}</span>
                          {isLocked && (
                            <span className={`text-[8px] font-extrabold uppercase px-1 py-0.5 rounded leading-none ${
                              isDarkMode ? 'bg-amber-950/40 text-amber-500' : 'bg-amber-100 text-amber-800'
                            }`}>
                              Obrigatório
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] block mt-0.5 ${
                          isLocked
                            ? isDarkMode ? 'text-slate-550' : 'text-slate-500 font-medium'
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
            <div className="flex flex-col gap-5">
              <div className={`p-4 rounded-xl border flex gap-3.5 items-start ${
                isDarkMode ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-emerald-50/30 border-emerald-600/15'
              }`}>
                <div className={`p-2 rounded-xl mt-0.5 ${
                  isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  <Shield size={18} />
                </div>
                <div className="flex-1 leading-normal">
                  <span className="text-xs font-black block tracking-tight uppercase">🔒 Gestão de Obrigatoriedade (Travas)</span>
                  <span className={`text-[11px] block mt-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-650'}`}>
                    Configure abaixo quais colunas e seções operacionais são <strong>obrigatórias</strong> para os LTs e operadores. Elementos com a trava ativada <span className="text-amber-500 font-bold">não poderão ser ocultados</span> nas telas de trabalho, mantendo as informações críticas sempre visíveis.
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                {/* Seção 1: Colunas */}
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-wider mb-3 text-emerald-600 dark:text-indigo-400 pb-1 border-b border-dashed border-slate-700/50 flex items-center gap-1.5">
                    <Columns size={12} /> Travar Colunas da Tabela
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {columnMetadata.map(({ key, label }) => {
                      const isLocked = lockedColumns[key];
                      return (
                        <button
                          key={key}
                          onClick={() => toggleLockColumn(key)}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                            isLocked
                              ? isDarkMode
                                ? 'bg-amber-500/5 border-amber-500/20 text-white shadow-sm'
                                : 'bg-amber-50/40 border-amber-500/30 text-amber-900 font-semibold shadow-sm'
                              : isDarkMode
                                ? 'bg-slate-900/10 border-slate-800 text-slate-500'
                                : 'bg-slate-50/50 border-slate-150 text-slate-400 shadow-none'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`p-1 rounded ${
                              isLocked
                                ? isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-800'
                                : isDarkMode ? 'bg-slate-850 text-slate-600' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                            </div>
                            <span className="text-xs font-bold uppercase tracking-tight">{label}</span>
                          </div>
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded leading-none ${
                            isLocked
                              ? 'bg-amber-500/10 text-amber-500'
                              : isDarkMode ? 'bg-slate-850 text-slate-600' : 'bg-slate-150 text-slate-500'
                          }`}>
                            {isLocked ? 'TRAVADO' : 'LIBERADO'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Seção 2: Abas */}
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-wider mb-3 text-emerald-600 dark:text-indigo-400 pb-1 border-b border-dashed border-slate-700/50 flex items-center gap-1.5">
                    <Compass size={12} /> Travar Abas de Navegação
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {tabMetadata.map(({ key, label }) => {
                      const isLocked = lockedTabs[key];
                      return (
                        <button
                          key={key}
                          onClick={() => toggleLockTab(key)}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                            isLocked
                              ? isDarkMode
                                ? 'bg-amber-500/5 border-amber-500/20 text-white shadow-sm'
                                : 'bg-amber-50/40 border-amber-500/30 text-amber-900 font-semibold shadow-sm'
                              : isDarkMode
                                ? 'bg-slate-900/10 border-slate-800 text-slate-500'
                                : 'bg-slate-50/50 border-slate-150 text-slate-400 shadow-none'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`p-1 rounded ${
                              isLocked
                                ? isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-800'
                                : isDarkMode ? 'bg-slate-850 text-slate-600' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                            </div>
                            <span className="text-xs font-bold uppercase tracking-tight">{label}</span>
                          </div>
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded leading-none ${
                            isLocked
                              ? 'bg-amber-500/10 text-amber-500'
                              : isDarkMode ? 'bg-slate-850 text-slate-600' : 'bg-slate-150 text-slate-500'
                          }`}>
                            {isLocked ? 'TRAVADO' : 'LIBERADO'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
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
