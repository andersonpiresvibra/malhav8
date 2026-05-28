import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sun, Moon, User, Edit2, Maximize, Minimize, Plane, Search, RefreshCw, Power, X, SlidersHorizontal, ChevronDown } from 'lucide-react';
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
  onOpenLayoutPrefs?: () => void;
  density: number;
  setDensity: (val: number) => void;
  temperature: number;
  setTemperature: (val: number) => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ isDarkMode, toggleDarkMode, isFullscreen, onToggleFullscreen, globalSearchTerm, setGlobalSearchTerm, ltName, ltPhotoUrl, setLtName, operators = [], onOpenLayoutPrefs, density, setDensity, temperature, setTemperature }) => {
  const { signOut } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [editingField, setEditingField] = useState<'density' | 'temperature' | 'ltName' | null>(null);
  const [densityN, setDensityN] = useState(String(density));
  const [tempN, setTempN] = useState(String(temperature));
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDensityN(String(density));
  }, [density]);

  useEffect(() => {
    setTempN(String(temperature));
  }, [temperature]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target as Node)) {
        setIsAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

          <div className="relative" ref={avatarMenuRef}>
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)}>
                <div className="w-11 h-11 rounded-lg bg-white/10 border-2 border-white/20 flex items-center justify-center group-hover:border-white/40 transition-colors overflow-hidden">
                    {ltPhotoUrl ? (
                        <img src={ltPhotoUrl} alt={ltName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                        <User size={18} className="text-white" />
                    )}
                </div>
                <div className="text-left flex items-center gap-2">
                  <div>
                    <span className="text-sm font-bold transition-colors uppercase block select-none text-white group-hover:text-emerald-200">
                        {ltName || 'SELECIONE O LÍDER'}
                    </span>
                    <span className="text-[10px] text-emerald-200 font-black tracking-widest uppercase block">Líder de Turno</span>
                  </div>
                  <ChevronDown className="text-white/60 group-hover:text-white transition-colors" size={16} />
                </div>
            </div>

            {isAvatarMenuOpen && (
              <div className={`absolute top-full right-0 mt-3 w-48 rounded-xl shadow-2xl py-1 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 text-slate-800'} border z-[110]`}>
                <button
                  onClick={() => {
                    setIsAvatarMenuOpen(false);
                    setEditingField('ltName');
                  }}
                  className={`w-full flex items-center justify-start gap-3 px-4 py-2 text-[11px] font-bold uppercase transition-colors ${isDarkMode ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}`}
                >
                  <User size={14} /> Mudar Usuário
                </button>
                {onOpenLayoutPrefs && (
                  <button
                    onClick={() => {
                      setIsAvatarMenuOpen(false);
                      onOpenLayoutPrefs();
                    }}
                    className={`w-full flex items-center justify-start gap-3 px-4 py-2 text-[11px] font-bold uppercase transition-colors ${isDarkMode ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}`}
                  >
                    <SlidersHorizontal size={14} /> Personalizar Tema
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsAvatarMenuOpen(false);
                    onToggleFullscreen();
                  }}
                  className={`w-full flex items-center justify-start gap-3 px-4 py-2 text-[11px] font-bold uppercase transition-colors ${isDarkMode ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}`}
                >
                  {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />} 
                  Tela Cheia
                </button>
                <button
                  onClick={() => {
                    setIsAvatarMenuOpen(false);
                    toggleDarkMode();
                  }}
                  className={`w-full flex items-center justify-start gap-3 px-4 py-2 text-[11px] font-bold uppercase transition-colors ${isDarkMode ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}`}
                >
                  {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                  Claro/Escuro
                </button>
                <div className={`w-full h-px my-1 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                <button
                  onClick={() => {
                    setIsAvatarMenuOpen(false);
                    signOut();
                  }}
                  className={`w-full flex items-center justify-start gap-3 px-4 py-2 text-[11px] font-bold uppercase transition-colors ${isDarkMode ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'}`}
                >
                  <Power size={14} /> Sair do Sistema
                </button>
              </div>
            )}
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
                                      setDensityN(val);
                                  }
                              }}
                              onBlur={() => {
                                  setEditingField(null);
                                  const valNum = Number(densityN) || 0.803;
                                  setDensity(valNum);
                              }}
                              onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                      setEditingField(null);
                                      const valNum = Number(densityN) || 0.803;
                                      setDensity(valNum);
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
                              {density.toFixed(3)}
                          </span>
                      )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                      <span className="text-white font-bold text-xs uppercase w-10">TEMP.</span>
                      {editingField === 'temperature' ? (
                          <input 
                              type="text"
                              inputMode="decimal"
                              value={tempN} 
                              onChange={(e) => {
                                  const val = e.target.value.replace(',', '.');
                                  if (!isNaN(Number(val)) || val === '' || val === '-' || val === '.') {
                                      setTempN(val);
                                  }
                              }}
                              onBlur={() => {
                                  setEditingField(null);
                                  const valNum = Number(tempN) || 24.5;
                                  setTemperature(valNum);
                              }}
                              onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                      setEditingField(null);
                                      const valNum = Number(tempN) || 24.5;
                                      setTemperature(valNum);
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
                              {temperature.toFixed(1)}°C
                          </span>
                      )}
                  </div>
              </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div id="header-options-portal-target"></div>
        </div>
      </header>
    </>
  );
};
