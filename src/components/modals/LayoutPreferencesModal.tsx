import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Layout, ToggleLeft, ToggleRight, Check, RotateCcw, Columns, Compass } from 'lucide-react';
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
  onSave: (prefs: UserLayoutPreferences) => void;
  currentUser: string;
}

export const LayoutPreferencesModal: React.FC<LayoutPreferencesModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onSave,
  currentUser
}) => {
  const { isDarkMode } = useTheme();
  const [activeSubTab, setActiveSubTab] = useState<'columns' | 'tabs'>('columns');
  
  // Local state initialized with current preferences
  const [localPrefs, setLocalPrefs] = useState<UserLayoutPreferences>({
    visibleTabs: { ...defaultPreferences.visibleTabs, ...preferences.visibleTabs },
    visibleColumns: { ...defaultPreferences.visibleColumns, ...preferences.visibleColumns }
  });

  if (!isOpen) return null;

  const toggleColumn = (key: keyof UserLayoutPreferences['visibleColumns']) => {
    setLocalPrefs(prev => ({
      ...prev,
      visibleColumns: {
        ...prev.visibleColumns,
        [key]: !prev.visibleColumns[key]
      }
    }));
  };

  const toggleTab = (key: keyof UserLayoutPreferences['visibleTabs']) => {
    setLocalPrefs(prev => ({
      ...prev,
      visibleTabs: {
        ...prev.visibleTabs,
        [key]: !prev.visibleTabs[key]
      }
    }));
  };

  const handleReset = () => {
    if (confirm('Deseja restaurar as configurações padrão de layout?')) {
      setLocalPrefs(JSON.parse(JSON.stringify(defaultPreferences)));
    }
  };

  const handleSaveSubmit = () => {
    onSave(localPrefs);
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
                  return (
                    <button
                      key={key}
                      onClick={() => toggleColumn(key)}
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
                          <div className={`p-1 rounded-md ${isDarkMode ? 'bg-indigo-500 text-white' : 'bg-emerald-600 text-white'}`}>
                            <Check size={12} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className={`w-[20px] h-[20px] rounded-md border-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`} />
                        )}
                      </div>
                      <div className="flex-1 leading-normal">
                        <span className="text-xs font-black block tracking-tight uppercase">{label}</span>
                        <span className={`text-[10px] block mt-0.5 ${
                          isVisible
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
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} mb-2`}>
                Desmarque as abas ou views administrativas que sua escala atual não demanda gerenciar. Elas estarão ocultas na barra lateral e nos sub-menus, mas permanecem seguras na base relacional do Supabase.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tabMetadata.map(({ key, label, desc }) => {
                  const isVisible = localPrefs.visibleTabs[key];
                  return (
                    <button
                      key={key}
                      onClick={() => toggleTab(key)}
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
                          <div className={`p-1 rounded-md ${isDarkMode ? 'bg-indigo-500 text-white' : 'bg-emerald-600 text-white'}`}>
                            <Check size={12} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className={`w-[20px] h-[20px] rounded-md border-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`} />
                        )}
                      </div>
                      <div className="flex-1 leading-normal">
                        <span className="text-xs font-black block tracking-tight uppercase">{label}</span>
                        <span className={`text-[10px] block mt-0.5 ${
                          isVisible
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
              className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-emerald-600 hover:bg-emerald-505 text-white shadow-lg active:scale-95 flex items-center gap-2 ${
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
