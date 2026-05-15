import React, { useState, useMemo } from 'react';
import { 
  Search, Power, BusFront, LayoutGrid, AlertCircle, Info, Plus, Trash2, MoreVertical, Check, X, Settings, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { FlightData } from '../types';

import { POSITIONS_BY_PATIO, PATIO_LABELS, PositionMetadata } from '../constants/aerodromoConfig';

interface AerodromoAdminProps {
  disabledPositions: Set<string>;
  setDisabledPositions: React.Dispatch<React.SetStateAction<Set<string>>>;
  positionsMetadata: Record<string, PositionMetadata>;
  setPositionsMetadata: React.Dispatch<React.SetStateAction<Record<string, PositionMetadata>>>;
  positionRestrictions: Record<string, 'HYBRID' | 'CTA' | 'SRV'>;
  setPositionRestrictions: React.Dispatch<React.SetStateAction<Record<string, 'HYBRID' | 'CTA' | 'SRV'>>>;
  flights: FlightData[];
  patioPositions: Record<string, string[]>;
  setPatioPositions: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  onClearAllAssignments?: () => void;
}

export const AerodromoAdmin: React.FC<AerodromoAdminProps> = ({ 
  disabledPositions, 
  setDisabledPositions, 
  positionsMetadata,
  setPositionsMetadata,
  positionRestrictions,
  setPositionRestrictions,
  flights,
  patioPositions,
  setPatioPositions,
  onClearAllAssignments
}) => {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [activePatioId, setActivePatioId] = useState('2');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'HYBRID' | 'SRV' | 'CTA' | 'REMOTA' | 'INACTIVE'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPos, setNewPos] = useState({ id: '', patio: '2', type: 'PIT' as 'PIT' | 'REMOTA' });
  const [showOptions, setShowOptions] = useState(false);

  const allPositions = useMemo(() => Object.keys(positionsMetadata), [positionsMetadata]);
  const currentPositions = useMemo(() => patioPositions[activePatioId] || [], [activePatioId, patioPositions]);

  const activeFlightsByPos = useMemo(() => {
    const map = new Map<string, FlightData>();
    flights.forEach(f => {
      // Only consider flights that are ACTIVE or in progress
      if (f.positionId && f.status !== 'FINALIZADO' && f.status !== 'CANCELADO') {
        map.set(f.positionId, f);
      }
    });
    return map;
  }, [flights]);

  const baseList = useMemo(() => {
    return searchTerm ? allPositions : currentPositions;
  }, [searchTerm, allPositions, currentPositions]);

  const stats = useMemo(() => {
    // Calculamos as estatísticas com base no que está visível (Filtro ou Busca)
    const baseListRef = searchTerm ? allPositions : currentPositions;
    const total = baseListRef.length;
    
    return {
      total,
      hybrid: baseListRef.filter(id => {
        if (disabledPositions.has(id)) return false;
        const meta = positionsMetadata[id];
        const rest = positionRestrictions[id] || 'HYBRID';
        return meta?.type === 'PIT' && (rest === 'HYBRID' || !rest);
      }).length,
      srvOnly: baseListRef.filter(id => !disabledPositions.has(id) && positionRestrictions[id] === 'SRV' && positionsMetadata[id]?.type === 'PIT').length,
      ctaOnly: baseListRef.filter(id => {
        if (disabledPositions.has(id)) return false;
        const meta = positionsMetadata[id];
        const rest = positionRestrictions[id];
        return (meta?.type === 'PIT' && rest === 'CTA') || meta?.type === 'REMOTA';
      }).length,
      remote: baseListRef.filter(id => !disabledPositions.has(id) && positionsMetadata[id]?.type === 'REMOTA').length,
      inactive: baseListRef.filter(id => disabledPositions.has(id)).length
    };
  }, [allPositions, currentPositions, searchTerm, positionsMetadata, positionRestrictions, disabledPositions]);

  const displayedPositions = useMemo(() => {
    let list = baseList;
    
    if (activeFilter !== 'ALL') {
      list = list.filter(id => {
        const isDisabled = disabledPositions.has(id);
        if (activeFilter === 'INACTIVE') return isDisabled;
        if (isDisabled) return false; // Filter categories only show active ones
        
        const meta = positionsMetadata[id];
        const rest = positionRestrictions[id] || 'HYBRID';
        
        if (activeFilter === 'HYBRID') return meta?.type === 'PIT' && (rest === 'HYBRID' || !rest);
        if (activeFilter === 'SRV') return meta?.type === 'PIT' && rest === 'SRV';
        if (activeFilter === 'CTA') return (meta?.type === 'PIT' && rest === 'CTA') || meta?.type === 'REMOTA';
        if (activeFilter === 'REMOTA') return meta?.type === 'REMOTA';
        return true;
      });
    }

    return list;
  }, [baseList, activeFilter, disabledPositions, positionsMetadata, positionRestrictions]);

  const toggleDisabled = (posId: string) => {
    setDisabledPositions(prev => {
      const next = new Set(prev);
      if (next.has(posId)) next.delete(posId); else next.add(posId);
      return next;
    });
    
    // Log de Auditoria para rastreabilidade em SBGR
    console.log(`[Admin] Posição ${posId} alterada por ${user?.email || 'Admin'}`);
  };

  const handleClearAllAssignments = async () => {
    if (!confirm("⚠️ ATENÇÃO: Isso irá desvincular TODOS os voos de todas as posições no BANCO DE DADOS. Esta ação é irreversível. Deseja continuar?")) return;
    
    try {
      if (onClearAllAssignments) {
        await onClearAllAssignments();
        alert("BASE DE DADOS LIMPA: Todas as associações de pátio foram removidas com sucesso.");
      }
    } catch (err) {
      console.error("Erro na limpeza global:", err);
      alert("Erro ao limpar banco de dados.");
    }
  };

  const toggleType = (posId: string) => {
    // Não impedimos a troca de tipo se houver voo (apenas alertamos no console para auditoria)
    if (activeFlightsByPos.has(posId)) {
      console.warn(`[Audit] Mudança de tipo em posição ocupada: ${posId}`);
    }
    const currentMeta = positionsMetadata[posId];
    const nextType = currentMeta?.type === 'PIT' ? 'REMOTA' : 'PIT';
    
    setPositionsMetadata(prev => ({
       ...prev,
       [posId]: { ...prev[posId], type: nextType }
    }));

    setPositionRestrictions(prev => ({
       ...prev,
       [posId]: nextType === 'REMOTA' ? 'CTA' : 'HYBRID'
    }));
  };

  const cycleRestriction = (posId: string) => {
    if (activeFlightsByPos.has(posId)) return;
    const metadata = positionsMetadata[posId];
    if (metadata?.type === 'REMOTA') return; // Fixed to CTA for REMOTA

    setPositionRestrictions(prev => {
      const next = { ...prev };
      const current = next[posId] || 'HYBRID';
      if (current === 'HYBRID') next[posId] = 'CTA';
      else if (current === 'CTA') next[posId] = 'SRV';
      else next[posId] = 'HYBRID';
      return next;
    });
  };

  const handleAddPosition = () => {
    if (!newPos.id) return;
    if (positionsMetadata[newPos.id]) {
       alert("Posição já existe!");
       return;
    }

    setPositionsMetadata(prev => ({
       ...prev,
       [newPos.id]: { type: newPos.type }
    }));

    setPatioPositions(prev => ({
       ...prev,
       [newPos.patio]: [...(prev[newPos.patio] || []), newPos.id].sort()
    }));

    setPositionRestrictions(prev => ({
       ...prev,
       [newPos.id]: newPos.type === 'REMOTA' ? 'CTA' : 'HYBRID'
    }));

    setNewPos({ id: '', patio: activePatioId, type: 'PIT' });
    setShowAddModal(false);
  };

  const handleDeletePosition = (posId: string) => {
    if (activeFlightsByPos.has(posId)) {
       alert("Não é possível excluir uma posição ocupada.");
       return;
    }

    if (!confirm(`Deseja realmente excluir a posição ${posId}?`)) return;

    setPositionsMetadata(prev => {
       const next = { ...prev };
       delete next[posId];
       return next;
    });

    setPatioPositions(prev => {
       const next = { ...prev };
       Object.keys(next).forEach(patioId => {
          next[patioId] = next[patioId].filter(id => id !== posId);
       });
       return next;
    });

    setPositionRestrictions(prev => {
       const next = { ...prev };
       delete next[posId];
       return next;
    });

    setDisabledPositions(prev => {
       const next = new Set(prev);
       next.delete(posId);
       return next;
    });
  };

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden ${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-800'}`}>
      {/* Header Admin */}
      <div className={`px-6 h-16 shrink-0 flex items-center justify-between border-b ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} z-20`}>
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
             <LayoutGrid size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tighter uppercase leading-none">Gerenciar Posições</h2>
            <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Ground Layout Control</span>
          </div>
        </div>

        <div className={`flex items-center gap-1 mr-4 px-1 py-1 rounded-xl transition-all ${isDarkMode ? 'bg-[#0a0f1d] shadow-inner shadow-black/60' : 'bg-slate-200'} border ${isDarkMode ? 'border-white/5' : 'border-slate-300'}`}>
          <button 
            onClick={() => setActiveFilter('ALL')}
            className={`flex flex-col items-center justify-center min-w-[60px] h-10 px-3 rounded-lg transition-all duration-200 ${activeFilter === 'ALL' ? (isDarkMode ? 'bg-white/10 text-emerald-400 scale-[1.02] shadow-[0_0_15px_rgba(52,211,153,0.1)]' : 'bg-white shadow-md text-slate-900') : 'text-slate-500 hover:text-slate-300'}`}
          >
            <span className="text-[7px] font-black uppercase tracking-widest leading-none mb-1">Geral</span>
            <span className={`text-xs font-black leading-none ${activeFilter === 'ALL' ? 'text-emerald-400' : ''}`}>{stats.total}</span>
          </button>

          <div className={`w-[1px] h-6 mx-1 ${isDarkMode ? 'bg-white/5' : 'bg-slate-300'}`}></div>

          <div className="flex items-center gap-1">
            <button 
              onClick={() => setActiveFilter('HYBRID')}
              className={`flex flex-col items-center justify-center min-w-[70px] h-10 px-2 rounded-lg transition-all duration-200 ${activeFilter === 'HYBRID' ? (isDarkMode ? 'bg-emerald-500/10 text-emerald-400 scale-[1.02]' : 'bg-emerald-500 text-white shadow-md') : 'text-slate-500 hover:text-emerald-500'}`}
            >
              <span className="text-[7px] font-black uppercase tracking-widest leading-none mb-1">Híbridas</span>
              <span className="text-xs font-black leading-none">{stats.hybrid}</span>
            </button>
            <button 
              onClick={() => setActiveFilter('SRV')}
              className={`flex flex-col items-center justify-center min-w-[55px] h-10 px-2 rounded-lg transition-all duration-200 ${activeFilter === 'SRV' ? (isDarkMode ? 'bg-indigo-500/10 text-indigo-400 scale-[1.02]' : 'bg-indigo-500 text-white shadow-md') : 'text-slate-500 hover:text-indigo-500'}`}
            >
              <span className="text-[7px] font-black uppercase tracking-widest leading-none mb-1">SRV</span>
              <span className="text-xs font-black leading-none">{stats.srvOnly}</span>
            </button>
            <button 
              onClick={() => setActiveFilter('CTA')}
              className={`flex flex-col items-center justify-center min-w-[55px] h-10 px-2 rounded-lg transition-all duration-200 ${activeFilter === 'CTA' ? (isDarkMode ? 'bg-yellow-500/10 text-yellow-400 scale-[1.02]' : 'bg-yellow-500 text-white shadow-md') : 'text-slate-500 hover:text-yellow-500'}`}
            >
              <span className="text-[7px] font-black uppercase tracking-widest leading-none mb-1">CTA</span>
              <span className="text-xs font-black leading-none">{stats.ctaOnly}</span>
            </button>
            
            <div className={`w-[1px] h-6 mx-1 ${isDarkMode ? 'bg-white/5' : 'bg-slate-300'}`}></div>

            <button 
              onClick={() => setActiveFilter('INACTIVE')}
              className={`flex flex-col items-center justify-center min-w-[65px] h-10 px-2 rounded-lg transition-all duration-200 ${activeFilter === 'INACTIVE' ? (isDarkMode ? 'bg-red-500/15 text-red-400 scale-[1.02]' : 'bg-red-600 text-white shadow-md') : 'text-slate-500 hover:text-red-500'}`}
            >
              <span className="text-[7px] font-black uppercase tracking-widest leading-none mb-1">Inativas</span>
              <span className="text-xs font-black leading-none">{stats.inactive}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 h-full">
          {/* Search Engine - COMPACT */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <Search size={13} className={`${isDarkMode ? 'text-white/40 group-focus-within:text-white' : 'text-slate-400 group-focus-within:text-[#3CA317]'} transition-colors`} />
            </div>
            <input 
              type="text" 
              placeholder="PESQUISE..." 
              className={`border rounded text-[10px] uppercase w-56 pl-8 pr-3 h-7 tracking-widest outline-none transition-colors font-bold ${isDarkMode 
                ? 'bg-transparent hover:bg-white/5 border-white/20 focus:border-white/40 text-white placeholder:text-white/40' 
                : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-500 focus:ring-2 focus:ring-[#3CA317]/50 focus:border-[#3CA317]'
              }`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="relative">
            <button 
              onClick={() => setShowOptions(!showOptions)}
              className={`flex items-center gap-2 px-4 py-2 rounded transition-all font-bold uppercase tracking-wider text-[11px] ${showOptions ? 'bg-[#e5c600] shadow-inner' : 'bg-[#FEDC00] hover:bg-[#e5c600] shadow-sm'} text-slate-800 active:scale-95 border border-[#FEDC00] h-7`}
            >
              <Settings size={14} className={showOptions ? 'animate-spin-slow' : ''} />
              <span>OPÇÕES</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${showOptions ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showOptions && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setShowOptions(false)}></div>
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className={`absolute right-0 mt-2 w-48 rounded-xl border shadow-xl z-[70] overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                  >
                    <button 
                      onClick={() => { handleClearAllAssignments(); setShowOptions(false); }}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-amber-400' : 'hover:bg-amber-50 text-amber-600'}`}
                    >
                      <Trash2 size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Limpar Todas Posições</span>
                    </button>
                    <button 
                      onClick={() => { setShowAddModal(true); setShowOptions(false); }}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      <Plus size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Adicionar Posição</span>
                    </button>
                    <button 
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors opacity-50 cursor-not-allowed ${isDarkMode ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      <LayoutGrid size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Adicionar Pátio</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Patio Tabs */}
      <div className={`px-6 py-3 border-b flex items-center justify-between ${isDarkMode ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-1 group">
          {PATIO_LABELS.map(patio => (
            <button 
              key={patio.id} 
              onClick={() => { setActivePatioId(patio.id); setSearchTerm(''); }}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activePatioId === patio.id ? (isDarkMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white text-indigo-600 border border-indigo-100 shadow-sm') : (isDarkMode ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-white')}`}
            >
              {patio.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Inativas: {disabledPositions.size}</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Apenas CTA: {Object.values(positionRestrictions).filter(v => v === 'CTA').length}</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Apenas SRV: {Object.values(positionRestrictions).filter(v => v === 'SRV').length}</span>
           </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
          {displayedPositions.map(posId => {
            const isDisabled = disabledPositions.has(posId);
            const restriction = positionRestrictions[posId] || 'HYBRID';
            const hasFlight = activeFlightsByPos.has(posId);
            const metadata = positionsMetadata[posId];
            const isRemota = metadata?.type === 'REMOTA';
            
            const getRestrictionColor = () => {
              if (isDisabled) return isDarkMode ? 'border-red-900/50 bg-red-950/20' : 'border-red-100 bg-red-50/50';
              if (restriction === 'CTA') return isDarkMode ? 'border-yellow-900/50 bg-yellow-950/20' : 'border-yellow-100 bg-yellow-50/50';
              if (restriction === 'SRV') return isDarkMode ? 'border-indigo-900/50 bg-indigo-950/20' : 'border-indigo-100 bg-indigo-50/50';
              return isDarkMode ? 'border-emerald-900/50 bg-emerald-950/20' : 'border-emerald-100 bg-emerald-50/50';
            };

            const getRestrictionLabel = () => {
                if (isRemota) return 'CTA';
                if (restriction === 'HYBRID') return 'Híbrido';
                return restriction;
            };

            return (
              <div 
                key={posId} 
                className={`relative flex flex-col border-2 rounded transition-all h-32 ${getRestrictionColor()} ${hasFlight ? 'opacity-50 grayscale' : ''}`}
              >
                  <div className="p-2 border-b border-inherit flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                       <span className={`text-sm font-black font-mono ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{posId}</span>
                       <button 
                         onClick={() => toggleType(posId)}
                         disabled={hasFlight}
                         className={`text-[7px] font-black px-1.5 py-0.5 rounded transition-all hover:scale-110 active:scale-95 ${!isRemota ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'}`}
                       >
                          {metadata?.type}
                       </button>
                    </div>
                    {hasFlight ? (
                      <AlertCircle size={10} className="text-amber-500" title="Ocupado" />
                    ) : (
                      <button 
                        onClick={() => handleDeletePosition(posId)}
                        className={`p-1 rounded-lg transition-colors ${isDarkMode ? 'text-slate-600 hover:text-red-500 hover:bg-red-500/10' : 'text-slate-300 hover:text-red-600 hover:bg-red-50'}`}
                        title="Excluir posição"
                      >
                         <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col justify-center gap-1 px-2">
                    <button 
                      onClick={() => toggleDisabled(posId)}
                      className={`flex items-center justify-between w-full p-2 rounded-lg transition-all duration-200 ${isDisabled ? 'text-red-500 bg-red-500/20' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'}`}
                    >
                        <Power size={14} strokeWidth={2.5} />
                        <span className="text-[8px] font-black uppercase tracking-widest">{isDisabled ? 'OFF' : 'ATIVO'}</span>
                    </button>

                    <button 
                      onClick={() => cycleRestriction(posId)}
                      disabled={hasFlight || isRemota}
                      className={`flex items-center justify-between w-full p-1 rounded transition-colors ${restriction !== 'HYBRID' ? 'text-yellow-500 bg-yellow-500/10' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'} ${isRemota ? 'cursor-default opacity-50' : ''}`}
                    >
                        <BusFront size={12} strokeWidth={2.5} className={(restriction === 'SRV') ? 'text-indigo-400' : ''} />
                        <span className={`text-[8px] font-black uppercase text-right ${(restriction === 'SRV') ? 'text-indigo-400' : ''}`}>{getRestrictionLabel()}</span>
                    </button>
                  </div>

                  {/* Quick Indicator */}
                  {!isDisabled && restriction === 'HYBRID' && (
                    <div className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-slate-900"></div>
                  )}
                  {!isDisabled && restriction === 'CTA' && (
                    <div className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full bg-yellow-500 border border-white dark:border-slate-900"></div>
                  )}
                  {!isDisabled && restriction === 'SRV' && (
                    <div className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full bg-indigo-500 border border-white dark:border-slate-900"></div>
                  )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Footer */}
      <div className={`px-6 py-4 border-t flex items-center gap-4 ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-blue-50 border-blue-100'}`}>
         <Info size={16} className={isDarkMode ? 'text-indigo-400' : 'text-blue-500'} />
         <p className={`text-[11px] font-medium leading-tight ${isDarkMode ? 'text-slate-400' : 'text-blue-700'}`}>
           <span className="font-bold">Regras do Sistema:</span> Posições ocupadas (com voo ativo) não podem ter seu status alterado. Desabilitar uma posição no Aeródromo a remove das filas de prioridade e do grid de visualização operacional, mas mantém o histórico se houver.
         </p>
      </div>

      {/* Add Position Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
               onClick={() => setShowAddModal(false)}
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className={`relative w-full max-w-md rounded-3xl border shadow-2xl p-8 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
             >
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-black uppercase tracking-tighter">Nova Posição</h3>
                   <button 
                     onClick={() => setShowAddModal(false)}
                     className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}
                   >
                      <X size={20} />
                   </button>
                </div>

                <div className="space-y-6">
                   <div>
                      <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>ID da Posição</label>
                      <input 
                        type="text" 
                        value={newPos.id}
                        onChange={(e) => setNewPos(prev => ({ ...prev, id: e.target.value }))}
                        placeholder="Ex: 204L"
                        className={`w-full px-4 py-3 rounded-xl border-2 text-lg font-black font-mono transition-all focus:outline-none focus:ring-4 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:ring-indigo-500/20' : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-indigo-500/10'}`}
                      />
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Pátio</label>
                        <select 
                          value={newPos.patio}
                          onChange={(e) => setNewPos(prev => ({ ...prev, patio: e.target.value }))}
                          className={`w-full px-4 py-2.5 rounded-xl border text-[11px] font-black uppercase transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                        >
                           {PATIO_LABELS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Tipo Base</label>
                        <select 
                          value={newPos.type}
                          onChange={(e) => setNewPos(prev => ({ ...prev, type: e.target.value as any }))}
                          className={`w-full px-4 py-2.5 rounded-xl border text-[11px] font-black uppercase transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                        >
                           <option value="PIT">PIT</option>
                           <option value="REMOTA">REMOTA</option>
                        </select>
                      </div>
                   </div>

                   <div className={`p-4 rounded-2xl flex items-start gap-3 ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                      <Info size={16} className="shrink-0 mt-0.5" />
                      <p className="text-[10px] font-medium leading-tight">
                         Ao salvar, a posição será classificada automaticamente como <span className="font-bold">{newPos.type === 'REMOTA' ? 'CTA' : 'HÍBRIDA'}</span> e estará disponível imediatamente na malha.
                      </p>
                   </div>

                   <button 
                     onClick={handleAddPosition}
                     disabled={!newPos.id}
                     className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest transition-all ${!newPos.id ? 'opacity-50 grayscale cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 active:scale-95'}`}
                   >
                      <Check size={18} />
                      Salvar Posição
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
