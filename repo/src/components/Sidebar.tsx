import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, Users, Earth, Database, FileBarChart, Network, Settings, ChevronRight, Clock, Plane, BusFront, Table } from 'lucide-react';
import { ViewState } from '../types';

interface SidebarProps {
  activeView: ViewState;
  onViewChange: (view: ViewState) => void;
  isDarkMode: boolean;
  onSimulateEndOfDay?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange, isDarkMode, onSimulateEndOfDay }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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

  const navItems = [
    { id: 'GRID_OPS' as ViewState, icon: Table, label: 'Malha' },
    { id: 'AERODROMO' as ViewState, icon: Earth, label: 'Aeródromo' },
    { id: 'SHIFT_OPERATORS' as ViewState, icon: Users, label: 'Equipe' },
    { id: 'REPORTS' as ViewState, icon: FileBarChart, label: 'Relatório' },
  ];

  const isManagementActive = activeView === 'OPERATIONAL_MESH' || activeView === 'OPERATORS_ADMIN' || activeView === 'FLEETS_ADMIN' || activeView === 'AIRCRAFTS_ADMIN' || activeView === 'AERODROMO_ADMIN';

  return (
    <aside className={`w-20 shrink-0 border-r flex flex-col items-center py-6 transition-all duration-300 relative z-[80] ${
      isDarkMode 
        ? 'bg-slate-900 border-slate-800' 
        : 'bg-[#617b7b] border-transparent shadow-[2px_0_8px_rgba(0,0,0,0.5)]'
    }`}>
      <div className="flex flex-col gap-6 w-full items-center flex-1">
        <nav className={`flex flex-col gap-4 w-full px-2 ${!isDarkMode ? 'bg-[#617b7b]' : ''}`}>
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            const Icon = item.icon;
            
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                data-active={isActive}
                title={item.label}
                className={`sidebar-nav-btn flex flex-col items-center justify-center p-3 rounded-xl transition-all group ${
                  isActive 
                    ? isDarkMode 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                      : 'bg-white text-emerald-900 shadow-lg' 
                    : isDarkMode
                      ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className="transition-transform group-hover:scale-110" />
                <span className={`text-[8px] font-black uppercase tracking-tighter mt-1 whitespace-nowrap ${
                  isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
                } transition-opacity`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="w-full px-2 mt-auto relative" ref={menuRef}>
        <div className={`w-full h-px mb-4 ${isDarkMode ? 'bg-slate-800' : 'bg-white/20'}`}></div>
        
        {isMenuOpen && (
          <div className={`absolute bottom-0 left-full ml-2 p-2 rounded-xl shadow-xl w-48 border z-[100] flex flex-col gap-1 ${
            isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
          }`}>
             <button
                onClick={() => {
                   onViewChange('OPERATIONAL_MESH');
                   setIsMenuOpen(false);
                }}
                className={`flex items-center gap-3 p-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                   activeView === 'OPERATIONAL_MESH' 
                     ? (isDarkMode ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white')
                     : (isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100')
                }`}
             >
                <Database size={16} /> MalhaBase_BD
             </button>
             <button
                onClick={() => {
                   onViewChange('AERODROMO_ADMIN');
                   setIsMenuOpen(false);
                }}
                className={`flex items-center gap-3 p-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                   activeView === 'AERODROMO_ADMIN' 
                     ? (isDarkMode ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white')
                     : (isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100')
                }`}
             >
                <Earth size={16} /> AERÓDROMO_BD
             </button>
             <button
                onClick={() => {
                   onViewChange('OPERATORS_ADMIN');
                   setIsMenuOpen(false);
                }}
                className={`flex items-center gap-3 p-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                   activeView === 'OPERATORS_ADMIN' 
                     ? (isDarkMode ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white')
                     : (isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100')
                }`}
             >
                <Users size={16} /> Operadores_BD
             </button>
             <button
                onClick={() => {
                   onViewChange('FLEETS_ADMIN');
                   setIsMenuOpen(false);
                }}
                className={`flex items-center gap-3 p-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                   activeView === 'FLEETS_ADMIN' 
                     ? (isDarkMode ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white')
                     : (isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100')
                }`}
             >
                <BusFront size={16} /> Frotas_BD
             </button>
             <button
                onClick={() => {
                   onViewChange('AIRCRAFTS_ADMIN');
                   setIsMenuOpen(false);
                }}
                className={`flex items-center gap-3 p-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                   activeView === 'AIRCRAFTS_ADMIN' 
                     ? (isDarkMode ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white')
                     : (isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100')
                }`}
             >
                <Plane size={16} /> Aeronaves_BD
             </button>

             {process.env.NODE_ENV !== 'production' && onSimulateEndOfDay && (
               <>
                 <div className={`mt-2 pt-2 border-t px-2 pb-1 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                   <span className={`text-[8px] font-black uppercase tracking-tighter ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                     Simuladores
                   </span>
                 </div>
                 <button
                    onClick={() => {
                       onSimulateEndOfDay();
                       setIsMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                       isDarkMode ? 'text-orange-400 hover:bg-slate-700' : 'text-orange-600 hover:bg-slate-100'
                    }`}
                 >
                    <Clock size={16} /> Transf. Data
                 </button>
               </>
             )}
          </div>
        )}

        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          data-active={isManagementActive}
          title="Gerenciamento"
          className={`sidebar-nav-btn flex flex-col items-center justify-center p-3 rounded-xl transition-all w-full group ${
            isManagementActive
              ? isDarkMode 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'bg-white text-emerald-900 shadow-lg' 
              : isDarkMode
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
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
      </div>
    </aside>
  );
};
