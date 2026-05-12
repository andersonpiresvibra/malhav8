import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sun, Moon, User, Edit2, Maximize, Minimize, Plane, Search, RefreshCw, Power, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface DashboardHeaderProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  globalSearchTerm: string;
  setGlobalSearchTerm: (term: string) => void;
  ltName: string;
  ltPhotoUrl?: string;
  setLtName: (name: string) => void;
  operators?: any[];
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ isDarkMode, toggleDarkMode, isFullscreen, onToggleFullscreen, globalSearchTerm, setGlobalSearchTerm, ltName, ltPhotoUrl, setLtName, operators = [] }) => {
  const { signOut } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [editingField, setEditingField] = useState<'density' | 'temperature' | 'ltName' | null>(null);
  const [densityN, setDensityN] = useState(0.803);
  const [temperature, setTemperature] = useState(24.5);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', 'H');
  };

  const formatDate = (date: Date) => {
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase().replace('.', '');
    const dayMonth = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `${weekday} - ${dayMonth}`;
  };

  return (
    <>
      <header className={`h-20 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-[#004D24] border-transparent'} border-b flex items-center justify-between px-8 z-[100] relative transition-colors duration-500`}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg shadow-[0_0_20px_rgba(255,255,255,0.2)]">
              <Plane className="text-white" size={20} />
            </div>
          </div>

          <div className="w-px h-10 bg-white/20"></div>

          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setEditingField('ltName')}>
              <div className="w-11 h-11 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center group-hover:border-white/40 transition-colors overflow-hidden">
                  {ltPhotoUrl ? (
                      <img src={ltPhotoUrl} alt={ltName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                      <User size={18} className="text-white" />
                  )}
              </div>
              <div className="text-left">
                  <span className="text-sm font-bold transition-colors uppercase block select-none text-white group-hover:text-emerald-200">
                      {ltName || 'SELECIONE O LÍDER'}
                  </span>
                  <span className="text-[10px] text-emerald-200 font-black tracking-widest uppercase block">Líder de Turno</span>
              </div>
          </div>

          {editingField === 'ltName' && createPortal(
              <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <div className={`w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden ${isDarkMode ? 'bg-[#1a1f2e] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'} border flex flex-col max-h-[80vh]`}>
                      <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'} shrink-0`}>
                          <h3 className="text-lg font-bold">Selecionar Líder de Turno</h3>
                          <button 
                              onClick={() => setEditingField(null)}
                              className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                          >
                              <X size={20} />
                          </button>
                      </div>
                      
                      <div className="p-4 overflow-y-auto">
                          {operators?.length === 0 ? (
                              <p className={`text-center py-8 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} italic`}>
                                  Nenhum operador encontrado.
                              </p>
                          ) : (
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                  {operators?.map(op => (
                                      <button
                                          key={op.id}
                                          onClick={() => {
                                              setLtName(op.name || op.warName || '');
                                              setEditingField(null);
                                          }}
                                          className={`flex items-center gap-3 p-2 rounded-xl transition-all select-none text-left w-full
                                              ${ltName === (op.name || op.warName) 
                                                  ? (isDarkMode ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-emerald-50 border-emerald-200') 
                                                  : (isDarkMode ? 'bg-slate-800/50 border-transparent hover:bg-slate-800' : 'bg-slate-50 border-transparent hover:bg-slate-100')} 
                                              border`}
                                      >
                                          <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden shrink-0 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}>
                                              {op.photoUrl ? (
                                                  <img src={op.photoUrl} alt={op.warName} className="w-full h-full object-cover" />
                                              ) : (
                                                  <User size={16} className={isDarkMode ? 'text-slate-400' : 'text-slate-500'} />
                                              )}
                                          </div>
                                          <div className="flex-1 min-w-0 w-full">
                                              <p className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                                  {op.warName || op.name}
                                              </p>
                                              <p className={`text-[10px] uppercase font-bold tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                                  {op.role || 'LT'}
                                              </p>
                                          </div>
                                      </button>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          , document.body)}

          <div className="w-px h-10 bg-white/20"></div>

          <div>
              <h1 className="text-4xl font-bold tracking-tighter font-mono text-white">{formatTime(currentTime)}</h1>
              <p className="text-xs text-emerald-100 font-bold tracking-widest">{formatDate(currentTime)}</p>
          </div>

          <div className="w-px h-10 bg-white/20"></div>

          <div className="flex items-center gap-6">
              <div className="text-sm">
                  <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-xs uppercase w-10">DENS.</span>
                      {editingField === 'density' ? (
                          <input 
                              type="text"
                              inputMode="decimal"
                              value={densityN} 
                              onChange={(e) => {
                                  const val = e.target.value.replace(',', '.');
                                  if (!isNaN(Number(val)) || val === '' || val === '.') {
                                      setDensityN(val as any);
                                  }
                              }}
                              onBlur={() => {
                                  setEditingField(null);
                                  setDensityN(Number(densityN) || 0.803);
                              }}
                              onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                      setEditingField(null);
                                      setDensityN(Number(densityN) || 0.803);
                                  }
                              }}
                              autoFocus
                              className={`w-16 font-mono font-bold text-lg rounded px-1 outline-none ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-slate-900 border border-emerald-500/50'}`}
                          />
                      ) : (
                          <span 
                              className="font-mono font-bold text-white text-lg cursor-pointer hover:text-emerald-200 transition-colors w-16 inline-block"
                              onClick={() => setEditingField('density')}
                          >
                              {Number(densityN).toFixed(3)}
                          </span>
                      )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                      <span className="text-white font-bold text-xs uppercase w-10">TEMP.</span>
                      {editingField === 'temperature' ? (
                          <input 
                              type="text"
                              inputMode="decimal"
                              value={temperature} 
                              onChange={(e) => {
                                  const val = e.target.value.replace(',', '.');
                                  if (!isNaN(Number(val)) || val === '' || val === '-' || val === '.') {
                                      setTemperature(val as any);
                                  }
                              }}
                              onBlur={() => {
                                  setEditingField(null);
                                  setTemperature(Number(temperature) || 24.5);
                              }}
                              onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                      setEditingField(null);
                                      setTemperature(Number(temperature) || 24.5);
                                  }
                              }}
                              autoFocus
                              className={`w-16 font-mono font-bold text-lg rounded px-1 outline-none ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-slate-900 border border-emerald-500/50'}`}
                          />
                      ) : (
                          <span 
                              className="font-mono font-bold text-white text-lg cursor-pointer hover:text-emerald-200 transition-colors w-16 inline-block"
                              onClick={() => setEditingField('temperature')}
                          >
                              {Number(temperature).toFixed(1)}°C
                          </span>
                      )}
                  </div>
              </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={onToggleFullscreen} 
            className="p-2.5 text-emerald-100 hover:text-white hover:bg-white/10 transition-all rounded-md"
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
          <button 
            onClick={toggleDarkMode} 
            className="p-2.5 text-emerald-100 hover:text-white hover:bg-white/10 transition-all rounded-md"
          >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button 
            onClick={() => signOut()} 
            title="Sair do sistema"
            className="p-2.5 text-emerald-100 hover:text-red-400 hover:bg-white/10 transition-all rounded-md ml-1"
          >
              <Power size={20} />
          </button>
          <div id="header-options-portal-target"></div>
        </div>
      </header>
    </>
  );
};
