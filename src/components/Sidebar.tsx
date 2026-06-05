import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, Users, Earth, Database, FileBarChart, Network, Settings, ChevronRight, Clock, Plane, BusFront, Table, Navigation, Compass, CalendarDays, Building, Layers, HardHat, MapPin, ChevronDown } from 'lucide-react';
import { ViewState } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  activeView: ViewState;
  onViewChange: (view: ViewState) => void;
  isDarkMode: boolean;
  onSimulateEndOfDay?: () => void;
  visibleTabs?: Record<string, boolean>;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange, isDarkMode, onSimulateEndOfDay, visibleTabs }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    MALHA: false,
    OPERACIONAL: false,
    ESTRUTURA: false,
    CLIENTES: false,
  });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { isUsuario, isAdministrador, isMaster } = useAuth();

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const navItems = [
    { id: 'GRID_OPS' as ViewState, icon: Table, label: 'Malha' },
    { id: 'SHIFT_OPERATORS' as ViewState, icon: Users, label: 'Equipe' },
    { id: 'AERODROMO' as ViewState, icon: MapPin, label: 'Aeródromo' },
    { id: 'FLEET' as ViewState, icon: BusFront, label: 'Frotas' },
    { id: 'REPORTS' as ViewState, icon: FileBarChart, label: 'Relatório', adminOnly: true },
  ].filter(item => {
    if (visibleTabs && visibleTabs[item.id] === false) return false;
    if (item.adminOnly) {
      return isAdministrador || isMaster;
    }
    return true;
  });

  const isManagementActive = activeView === 'OPERATIONAL_MESH' || activeView === 'OPERATORS_ADMIN' || activeView === 'FLEETS_ADMIN' || activeView === 'AIRCRAFTS_ADMIN' || activeView === 'AIRLINES_ADMIN' || activeView === 'AERODROMO_ADMIN';
  
  return (
    <aside className="w-20 shrink-0 border-r flex flex-col items-center py-6 transition-all duration-300 relative z-[80] border-transparent shadow-[2px_0_8px_rgba(0,0,0,0.5)]">
      <div className="flex flex-col gap-6 w-full items-center flex-1">
        <nav className="flex flex-col gap-4 w-full px-2">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            const Icon = item.icon;
            
            return (
              <a
                key={item.id}
                href={`/${item.id}`}
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey) return;
                  e.preventDefault();
                  onViewChange(item.id);
                }}
                data-active={isActive}
                title={item.label}
                className={`sidebar-nav-btn flex flex-col items-center justify-center p-3 rounded-xl transition-all group cursor-pointer ${
                  isActive 
                    ? isDarkMode 
                      ? 'bg-emerald-500 text-white shadow-lg' 
                      : 'bg-white text-emerald-900 shadow-lg' 
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className="transition-transform group-hover:scale-110" />
                <span className={`text-[8px] font-black uppercase tracking-tighter mt-1 whitespace-nowrap ${
                  isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
                } transition-opacity`}>
                  {item.label}
                </span>
              </a>
            );
          })}
        </nav>
      </div>

      <div className="w-full px-2 mt-auto relative" ref={menuRef}>
        <div className={`w-full h-px mb-4 ${isDarkMode ? 'bg-slate-800' : 'bg-white/20'}`}></div>
        
        {isMenuOpen && (
          <div className={`absolute bottom-0 left-full ml-2 p-2 rounded-xl shadow-xl w-56 border z-[100] flex flex-col gap-1 max-h-[80vh] overflow-y-auto ${
            isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
          }`}>


             {/* GRUPO: MALHA */}
             <button
               onClick={() => toggleSection('MALHA')}
               className={`w-full justify-between flex items-center gap-2 p-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                 isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
               }`}
             >
                <span className="text-left w-full">MALHA</span>
                <ChevronRight size={14} className={`transition-transform duration-200 ${expandedSections.MALHA ? 'rotate-90' : ''}`} />
             </button>

             {expandedSections.MALHA && (
               <div className="flex flex-col gap-1 mb-2 ml-2 border-l pl-2 border-slate-200 dark:border-slate-700">
                 {(!visibleTabs || visibleTabs.OPERATIONAL_MESH !== false) && (
                   <a
                      href="/OPERATIONAL_MESH"
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) return;
                        e.preventDefault();
                        onViewChange('OPERATIONAL_MESH');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full justify-start flex items-center gap-3 p-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        activeView === 'OPERATIONAL_MESH' 
                          ? (isDarkMode ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white')
                          : (isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100')
                      }`}
                    >
                      <Table size={14} className="shrink-0" /> <span className="text-left w-full">MALHABASE_BD</span>
                    </a>
                 )}
               </div>
             )}


             {/* GRUPO: OPERACIONAL */}
             <button
               onClick={() => toggleSection('OPERACIONAL')}
               className={`w-full justify-between flex items-center gap-2 p-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                 isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
               }`}
             >
                <span className="text-left w-full">OPERACIONAL</span>
                <ChevronRight size={14} className={`transition-transform duration-200 ${expandedSections.OPERACIONAL ? 'rotate-90' : ''}`} />
             </button>

             {expandedSections.OPERACIONAL && (
               <div className="flex flex-col gap-1 mb-2 ml-2 border-l pl-2 border-slate-200 dark:border-slate-700">
                 {(!visibleTabs || visibleTabs.OPERATORS_ADMIN !== false) && (
                   <a
                      href="/OPERATORS_ADMIN"
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) return;
                        e.preventDefault();
                        onViewChange('OPERATORS_ADMIN');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full justify-start flex items-center gap-3 p-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        activeView === 'OPERATORS_ADMIN' 
                          ? (isDarkMode ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white')
                          : (isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100')
                      }`}
                    >
                      <HardHat size={14} className="shrink-0" /> <span className="text-left w-full">OPERADORES_BD</span>
                    </a>
                 )}

                 {(!visibleTabs || visibleTabs.FLEETS_ADMIN !== false) && (
                   <a
                      href="/FLEETS_ADMIN"
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) return;
                        e.preventDefault();
                        onViewChange('FLEETS_ADMIN');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full justify-start flex items-center gap-3 p-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        activeView === 'FLEETS_ADMIN' 
                          ? (isDarkMode ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white')
                          : (isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100')
                      }`}
                    >
                      <Layers size={14} className="shrink-0" /> <span className="text-left w-full">FROTAS_BD</span>
                    </a>
                 )}
               </div>
             )}


             {/* GRUPO: ESTRUTURA */}
             <button
               onClick={() => toggleSection('ESTRUTURA')}
               className={`w-full justify-between flex items-center gap-2 p-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                 isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
               }`}
             >
                <span className="text-left w-full">ESTRUTURA</span>
                <ChevronRight size={14} className={`transition-transform duration-200 ${expandedSections.ESTRUTURA ? 'rotate-90' : ''}`} />
             </button>

             {expandedSections.ESTRUTURA && (
               <div className="flex flex-col gap-1 mb-2 ml-2 border-l pl-2 border-slate-200 dark:border-slate-700">
                 {(!visibleTabs || visibleTabs.AERODROMO_ADMIN !== false) && (
                   <a
                      href="/AERODROMO_ADMIN"
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) return;
                        e.preventDefault();
                        onViewChange('AERODROMO_ADMIN');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full justify-start flex items-center gap-3 p-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        activeView === 'AERODROMO_ADMIN' 
                          ? (isDarkMode ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white')
                          : (isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100')
                      }`}
                    >
                      <MapPin size={14} className="shrink-0" /> <span className="text-left w-full">AERÓDROMO_DB</span>
                    </a>
                 )}
               </div>
             )}


             {/* GRUPO: CLIENTES */}
             <button
               onClick={() => toggleSection('CLIENTES')}
               className={`w-full justify-between flex items-center gap-2 p-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                 isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
               }`}
             >
                <span className="text-left w-full">CLIENTES</span>
                <ChevronRight size={14} className={`transition-transform duration-200 ${expandedSections.CLIENTES ? 'rotate-90' : ''}`} />
             </button>

             {expandedSections.CLIENTES && (
               <div className="flex flex-col gap-1 mb-2 ml-2 border-l pl-2 border-slate-200 dark:border-slate-700">
                 {(!visibleTabs || visibleTabs.AIRLINES_ADMIN !== false) && (
                   <a
                      href="/AIRLINES_ADMIN"
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) return;
                        e.preventDefault();
                        onViewChange('AIRLINES_ADMIN');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full justify-start flex items-center gap-3 p-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        activeView === 'AIRLINES_ADMIN' 
                          ? (isDarkMode ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white')
                          : (isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100')
                      }`}
                    >
                      <Building size={14} className="shrink-0" /> <span className="text-left w-full">COMPANHIAS_DB</span>
                    </a>
                 )}

                 {(!visibleTabs || visibleTabs.AIRCRAFTS_ADMIN !== false) && (
                   <a
                      href="/AIRCRAFTS_ADMIN"
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) return;
                        e.preventDefault();
                        onViewChange('AIRCRAFTS_ADMIN');
                        setIsMenuOpen(false);
                      }}
                      className={`w-full justify-start flex items-center gap-3 p-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        activeView === 'AIRCRAFTS_ADMIN' 
                          ? (isDarkMode ? 'bg-indigo-600 text-white' : 'bg-emerald-650 text-white')
                          : (isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100')
                      }`}
                    >
                      <Plane size={14} className="shrink-0" /> <span className="text-left w-full">AERONAVES_BD</span>
                    </a>
                 )}
               </div>
             )}

             {process.env.NODE_ENV !== 'production' && onSimulateEndOfDay && (
               <>
                 <div className={`mt-3 pt-2 border-t px-2 pb-1 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                   <span className={`text-[8px] font-black uppercase tracking-tighter ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                     Simuladores
                   </span>
                 </div>
                 <button
                    onClick={() => {
                       onSimulateEndOfDay();
                       setIsMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 p-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                       isDarkMode ? 'text-orange-400 hover:bg-slate-800' : 'text-orange-600 hover:bg-slate-100'
                    }`}
                 >
                    <Clock size={16} /> Transf. Data
                 </button>
               </>
             )}
          </div>
        )}

        {(isUsuario || isAdministrador || isMaster) && (
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            data-active={isManagementActive}
            title="Gerenciamento"
            className={`sidebar-nav-btn flex flex-col items-center justify-center p-3 rounded-xl transition-all w-full group cursor-pointer ${
              isManagementActive
                ? 'bg-white text-emerald-900 shadow-lg'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Settings size={22} strokeWidth={isManagementActive ? 2.5 : 2} className={`transition-transform duration-300 ${isMenuOpen ? 'rotate-90' : 'group-hover:rotate-45'}`} />
            <span className={`text-[8px] font-black uppercase tracking-tighter mt-1 whitespace-nowrap ${
              isManagementActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
            } transition-opacity`}>
              Gerenciar
            </span>
          </button>
        )}
      </div>
    </aside>
  );
};
