import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plane, Calendar, Clock, MapPin, Hash, Tag, Globe } from 'lucide-react';
import { FlightData, FlightStatus, FlightLog, AircraftType } from '../types';
import { generateUUID } from '../utils/uuid';
import { useTheme } from '../contexts/ThemeContext';
import { TimeConflictModal } from './TimeConflictModal';
import { supabase } from '../lib/supabase';

const GOL_PREFIXOS = [
  "PR-GEA", "PR-GEC", "PR-GED", "PR-GEH", "PR-GEI", "PR-GEJ", "PR-GEK", "PR-GEQ", "PR-GIH", "PR-GOQ", "PR-GOR", "PR-VBQ",
  "PR-GGE", "PR-GGF", "PR-GGH", "PR-GGL", "PR-GGM", "PR-GGP", "PR-GGQ", "PR-GGR", "PR-GGX", "PR-GKA", "PR-GKB", "PR-GKC", "PR-GKD", "PR-GKE", "PR-GTC", "PR-GTE", "PR-GTG", "PR-GTH", "PR-GTL", "PR-GTM", "PR-GUB", "PR-GUC", "PR-GUE", "PR-GUF", "PR-GUH", "PR-GUI", "PR-GUJ", "PR-GUK", "PR-GUL", "PR-GUM", "PR-GUN", "PR-GUP", "PR-GUR", "PR-GUT", "PR-GUU", "PR-GUV", "PR-GUX", "PR-GUY", "PR-GUZ", "PR-GXA", "PR-GXB", "PR-GXC", "PR-GXD", "PR-GXE", "PR-GXH", "PR-GXI", "PR-GXJ", "PR-GXL", "PR-GXM", "PR-GXN", "PR-GXP", "PR-GXQ", "PR-GXR", "PR-GXT", "PR-GXU", "PR-GXV", "PR-GXW", "PR-GXX", "PR-GYA", "PR-GYD", "PR-GZH", "PR-GZI", "PR-GZS", "PR-GZU", "PR-GZV", "PR-VBF", "PR-VBG", "PR-VBK", "PS-GFA", "PS-GFB", "PS-GFC", "PS-GFD", "PS-GFE", "PS-GFF", "PS-GFG", "PS-GFH", "PS-GFI", "PR-XMA", "PR-XMB", "PR-XMC", "PR-XMD", "PR-XME", "PR-XMF", "PR-XMG", "PR-XMH", "PR-XMI", "PR-XMJ", "PR-XMK", "PR-XML", "PR-XMM", "PR-XMN", "PR-XMO", "PR-XMP", "PR-XMQ", "PR-XMR", "PR-XMS", "PR-XMT", "PR-XMU", "PR-XMV", "PR-XMW", "PR-XMX", "PR-XMY", "PR-XMZ", "PS-GOL", "PS-GPA", "PS-GPB", "PS-GPC", "PS-GPD", "PS-GPE", "PS-GPF", "PS-GPG", "PS-GPH", "PS-GPI", "PS-GPJ", "PS-GPK", "PS-GPL", "PS-GPM", "PS-GPN", "PS-GPO", "PS-GPP", "PS-GPQ", "PS-GPR", "PS-GRA", "PS-GRB", "PS-GRC", "PS-GRD", "PS-GRE", "PS-GRF", "PS-GRG", "PS-GRH", "PS-GRI", "PS-GRJ", "PS-GRK", "PS-GRL", "PS-GRO", "PS-GRQ", "PS-GRR", "PS-GRS", "PS-GRT", "PS-GRU", "PS-GRV", "PS-GRW", "PS-GRY", "PS-GRZ"
];

const GOL_MODELOS = ["B737-7", "B737-8"];

const createNewLog = (type: FlightLog['type'], message: string, author: string): FlightLog => ({
    id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
    timestamp: new Date(),
    type,
    message,
    author
});

interface CreateFlightModalProps {
  onClose: () => void;
  onCreate: (flight: FlightData) => void;
}

export const CreateFlightModal: React.FC<CreateFlightModalProps> = ({ onClose, onCreate }) => {
  const { isDarkMode } = useTheme();
  const [formData, setFormData] = useState({
    airlineCode: '',
    registration: '',
    model: '',
    flightNumber: '', // Chegada
    eta: '',
    departureFlightNumber: '', // Saída
    destination: '', // ICAO
    positionId: '',
    etd: ''
  });

  const [timeConflict, setTimeConflict] = useState<string | null>(null);
  const [aircraftsDB, setAircraftsDB] = useState<AircraftType[]>([]);

  useEffect(() => {
    // Fetch aircrafts from DB for auto-complete magic
    supabase.from('aircrafts').select('*').then(res => {
      if (res.data) setAircraftsDB(res.data as AircraftType[]);
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let newValue = value.toUpperCase();
    
    if (name === 'eta' || name === 'etd') {
      newValue = value.replace(/[^0-9]/g, '');
      if (newValue.length > 2) {
        newValue = `${newValue.slice(0, 2)}:${newValue.slice(2, 4)}`;
      }
      if (newValue.length > 5) newValue = newValue.slice(0, 5);
      
      setFormData(prev => ({ ...prev, [name]: newValue }));
      return;
    }

    if (name === 'registration') {
        let autoRegistration = newValue;
        let autoModel = formData.model;
        let autoAirlineCode = formData.airlineCode;

        // Magic 1: If it's a suffix match (e.g. user typed "GFA" and DB has "PS-GFA")
        if (autoRegistration.length >= 3 && !autoRegistration.includes('-')) {
            const match = aircraftsDB.find(a => a.prefix.replace('-', '').endsWith(autoRegistration));
            if (match) {
                autoRegistration = match.prefix;
                autoModel = match.model && match.model !== '--' ? match.model : autoModel;
                
                // Set airline code automatically if unknown or general
                if (!autoAirlineCode || autoAirlineCode === 'OUTRA') {
                    const airlineUpper = match.airline.toUpperCase();
                    if (airlineUpper.includes('GOL')) autoAirlineCode = 'RG';
                    else if (airlineUpper.includes('LATAM')) autoAirlineCode = 'LA';
                    else if (airlineUpper.includes('AZUL')) autoAirlineCode = 'AD';
                    else autoAirlineCode = match.airline.slice(0, 3).toUpperCase();
                }
            }
        } else {
            // Magic 2: Exact match auto-fill
            const matchExact = aircraftsDB.find(a => a.prefix === autoRegistration);
            if (matchExact) {
                autoModel = matchExact.model && matchExact.model !== '--' ? matchExact.model : autoModel;
                
                if (!autoAirlineCode || autoAirlineCode === 'OUTRA') {
                    const airlineUpperExact = matchExact.airline.toUpperCase();
                    if (airlineUpperExact.includes('GOL')) autoAirlineCode = 'RG';
                    else if (airlineUpperExact.includes('LATAM')) autoAirlineCode = 'LA';
                    else if (airlineUpperExact.includes('AZUL')) autoAirlineCode = 'AD';
                    else autoAirlineCode = matchExact.airline.slice(0, 3).toUpperCase();
                }
            }
        }

        setFormData(prev => ({ 
            ...prev, 
            registration: autoRegistration, 
            model: autoModel,
            airlineCode: autoAirlineCode
        }));
        return;
    }
    
    setFormData(prev => ({ ...prev, [name]: newValue }));
  };

  const handleCreate = (forceDateStr?: string) => {
    // Basic validation
    if (!formData.registration || !formData.airlineCode || !formData.departureFlightNumber || !formData.etd) return;
    
    // Arrival flight validation
    if (formData.flightNumber && formData.flightNumber.trim() !== '' && !formData.eta) {
       alert("Um Voo de Chegada requer a inserção do ETA.");
       return;
    }

    // Check time conflict if forceDateStr is not provided
    if (!forceDateStr && formData.etd.length >= 4) {
      const now = new Date();
      const [h, m] = formData.etd.split(':').map(Number);
      const etdDate = new Date();
      etdDate.setHours(h, m, 0, 0);
      const diffMins = (etdDate.getTime() - now.getTime()) / 60000;
      if (diffMins < 0) {
        setTimeConflict(formData.etd);
        return;
      }
    }

    const airlineCode = formData.airlineCode.toUpperCase() === 'G3' ? 'RG' : formData.airlineCode.toUpperCase();
    const airlineName = airlineCode === 'RG' ? 'GOL' : (airlineCode === 'LA' ? 'LATAM' : (airlineCode === 'AD' ? 'AZUL' : 'OUTRA'));

    const newFlight: FlightData = {
      id: generateUUID(),
      airline: airlineName,
      airlineCode: airlineCode,
      registration: formData.registration.toUpperCase(),
      model: formData.model.toUpperCase(),
      flightNumber: formData.flightNumber.toUpperCase(),
      eta: formData.eta,
      departureFlightNumber: formData.departureFlightNumber.toUpperCase(),
      destination: formData.destination.toUpperCase(),
      positionId: formData.positionId,
      etd: formData.etd,
      date: forceDateStr, // if undefined, GridOps adds activeDateOffset
      insertionTime: new Date(),
      origin: 'SBGL', // Default
      fuelStatus: 0,
      status: FlightStatus.CHEGADA, // Default status
      logs: [createNewLog('SISTEMA', 'Voo criado manualmente pelo gestor.', 'GESTOR_MESA')],
      messages: []
    };

    onCreate(newFlight);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCreate();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        // If an input is focused, let it handle its own Enter
        if (document.activeElement?.tagName === 'INPUT') return;
        handleCreate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formData, onCreate, onClose]);

  // Helper to calculate if priority queue warning is needed
  const isPriority = () => {
    if (!formData.etd) return false;
    const now = new Date();
    const [h, m] = formData.etd.split(':').map(Number);
    const etdDate = new Date();
    etdDate.setHours(h, m, 0, 0);
    const diffMins = (etdDate.getTime() - now.getTime()) / 60000;
    return diffMins < 60;
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
      <div className={`w-full max-w-xl ${isDarkMode ? 'bg-slate-900 border-emerald-500/30' : 'bg-white border-slate-200'} border-[0.5px] rounded-[8px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
        
        {/* Header */}
        <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-slate-800 bg-slate-950' : 'border-transparent bg-[#004D24]'} flex justify-between items-center`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 flex items-center justify-center shrink-0 ${isDarkMode ? 'text-emerald-500' : 'text-emerald-100'}`}>
              <Plane size={20} />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-tight">Criar Voo Manual</h3>
          </div>
          <button onClick={onClose} className={`transition-colors p-1 rounded-full ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-emerald-100 hover:text-white hover:bg-emerald-700'}`}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          <div className="grid grid-cols-3 gap-4">
            {/* Linha 1 */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                Comp. (Cia) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                 <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input 
                  name="airlineCode"
                  value={formData.airlineCode}
                  onChange={handleChange}
                  placeholder="RG"
                  className="w-full bg-slate-50 border-2 border-emerald-500 text-[11px] font-black text-slate-900 rounded-xl pl-9 pr-3 py-2.5 outline-none focus:ring-4 focus:ring-emerald-500/10 uppercase placeholder:text-slate-400 transition-all shadow-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                Prefixo <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                 <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input 
                  name="registration"
                  value={formData.registration}
                  onChange={handleChange}
                  placeholder="PR-..."
                  list="prefixos-list"
                  className="w-full bg-slate-50 border-2 border-emerald-500 text-[11px] font-black text-slate-900 rounded-xl pl-9 pr-3 py-2.5 outline-none focus:ring-4 focus:ring-emerald-500/10 uppercase placeholder:text-slate-400 transition-all shadow-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Modelo</label>
              <div className="relative">
                 <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input 
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  placeholder="B738"
                  list="modelos-list"
                  className="w-full bg-slate-50 border-2 border-emerald-500 text-[11px] font-black text-slate-900 rounded-xl pl-9 pr-3 py-2.5 outline-none focus:ring-4 focus:ring-emerald-500/10 uppercase placeholder:text-slate-400 transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Linha 2 */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Nº Voo (Chegada)</label>
              <div className="relative">
                 <Plane size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input 
                  name="flightNumber"
                  value={formData.flightNumber}
                  onChange={handleChange}
                  placeholder="RG-1234"
                  className="w-full bg-slate-50 border-2 border-emerald-500 text-[11px] font-black text-slate-900 rounded-xl pl-9 pr-3 py-2.5 outline-none focus:ring-4 focus:ring-emerald-500/10 uppercase placeholder:text-slate-400 transition-all shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">ETA (Chegada)</label>
              <div className="relative">
                 <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input 
                  type="time"
                  name="eta"
                  value={formData.eta}
                  onChange={handleChange}
                  className="w-full bg-slate-50 border-2 border-emerald-500 text-[11px] font-black text-slate-900 rounded-xl pl-9 pr-3 py-2.5 outline-none focus:ring-4 focus:ring-emerald-500/10 uppercase transition-all shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Posição</label>
              <div className="relative">
                 <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input 
                  name="positionId"
                  value={formData.positionId}
                  onChange={handleChange}
                  placeholder="000"
                  className="w-full bg-slate-50 border-2 border-emerald-500 text-[11px] font-black text-slate-900 rounded-xl pl-9 pr-3 py-2.5 outline-none focus:ring-4 focus:ring-emerald-500/10 uppercase placeholder:text-slate-400 transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Linha 3 */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                Nº Voo (Saída) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                 <Plane size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transform rotate-45" />
                 <input 
                  name="departureFlightNumber"
                  value={formData.departureFlightNumber}
                  onChange={handleChange}
                  placeholder="RG-..."
                  className="w-full bg-slate-50 border-2 border-emerald-500 text-[11px] font-black text-slate-900 rounded-xl pl-9 pr-3 py-2.5 outline-none focus:ring-4 focus:ring-emerald-500/10 uppercase placeholder:text-slate-400 transition-all shadow-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">ICAO</label>
              <div className="relative">
                 <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input 
                  name="destination"
                  value={formData.destination}
                  onChange={handleChange}
                  placeholder="SB..."
                  className="w-full bg-slate-50 border-2 border-emerald-500 text-[11px] font-black text-slate-900 rounded-xl pl-9 pr-3 py-2.5 outline-none focus:ring-4 focus:ring-emerald-500/10 uppercase placeholder:text-slate-400 transition-all shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                ETD (Partida) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                 <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input 
                  type="time"
                  name="etd"
                  value={formData.etd}
                  onChange={handleChange}
                  className="w-full bg-slate-50 border-2 border-emerald-500 text-[11px] font-black text-slate-900 rounded-xl pl-9 pr-3 py-2.5 outline-none focus:ring-4 focus:ring-emerald-500/10 uppercase transition-all shadow-sm"
                  required
                />
              </div>
            </div>
          </div>

          {/* Datalists for suggestions */}
          <datalist id="prefixos-list">
            {aircraftsDB.map(a => (
              <option key={a.id} value={a.prefix} />
            ))}
          </datalist>
          <datalist id="modelos-list">
            {Array.from(new Set(aircraftsDB.map(a => a.model).filter(m => m && m !== '--'))).map(model => (
              <option key={model} value={model} />
            ))}
          </datalist>

          {isPriority() && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
                <Clock size={16} />
              </div>
              <div>
                <h4 className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Atenção: Prioridade Automática</h4>
                <p className="text-[10px] text-amber-600/80 leading-relaxed font-medium">
                   Voos criados com ETD menor que 1h entrarão automaticamente na FILA de prioridade.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-4 border-t border-slate-100">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-slate-200 hover:text-slate-900 transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-3 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20"
            >
              Criar Voo
            </button>
          </div>

        </form>
      </div>

      {timeConflict && (
        <TimeConflictModal 
            timeStr={timeConflict}
            isDarkMode={isDarkMode}
            onConfirmToday={() => {
                const now = new Date();
                const dList = now.toISOString().split('T')[0];
                handleCreate(dList); // Hoje
                setTimeConflict(null);
            }}
            onConfirmTomorrow={() => {
                const now = new Date();
                now.setDate(now.getDate() + 1);
                const dList = now.toISOString().split('T')[0];
                handleCreate(dList); // Amanhã
                setTimeConflict(null);
            }}
            onCancel={() => {
                setTimeConflict(null);
            }}
        />
      )}
    </div>,
    document.body
  );
};
