import React, { useState, useRef, useEffect } from 'react';
import { Vehicle } from '../types';

interface FleetSelectDropdownProps {
    value: string;
    onChange: (val: string) => void;
    vehicles: Vehicle[];
    fleetCapability: 'SRV' | 'CTA' | 'BOTH' | '' | undefined;
    isDarkMode: boolean;
    isPaused?: boolean;
    disabled?: boolean;
}

export const FleetSelectDropdown: React.FC<FleetSelectDropdownProps> = ({
    value, onChange, vehicles, fleetCapability, isDarkMode, isPaused = false, disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const isCTA = fleetCapability === 'CTA';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredVehicles = vehicles.filter(v => 
        (fleetCapability === 'CTA' && v.type === 'CTA') || 
        (fleetCapability === 'SRV' && v.type === 'SERVIDOR') || 
        (!fleetCapability) ||
        (fleetCapability === 'BOTH')
    );

    const selectedVehicle = vehicles.find(v => v.id === value);
    const displayValue = selectedVehicle?.fleet_number || value || 'N/A';

    return (
        <div className={`relative w-full ${disabled || isPaused ? 'opacity-50 pointer-events-none' : ''}`} ref={dropdownRef}>
            <button
                type="button"
                disabled={disabled || isPaused}
                onClick={(e) => {
                    e.preventDefault();
                    setIsOpen(!isOpen);
                }}
                className={`w-full border px-[2px] py-[3px] sm:px-1 sm:py-1.5 text-[10px] rounded shadow-sm focus:ring-2 outline-none uppercase text-center font-mono font-bold transition-all truncate ${
                    isCTA ? 'focus:ring-yellow-500/20 focus:border-yellow-500' : 'focus:ring-emerald-500/20 focus:border-emerald-500'
                } ${
                    isDarkMode ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}
                title="Selecione a Frota"
            >
                {displayValue}
            </button>
            
            {isOpen && (
                <div className={`absolute top-full left-0 mt-1 w-full max-h-[160px] overflow-y-auto z-[9999] rounded shadow-xl border ${
                    isDarkMode ? 'bg-slate-800 border-slate-600 shadow-black/50' : 'bg-white border-slate-300 shadow-black/10'
                }`}>
                    <div 
                        onClick={() => { onChange(''); setIsOpen(false); }}
                        className={`px-2 py-2 text-center text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                            isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100'
                        }`}
                    >
                        N/A
                    </div>
                    {filteredVehicles.length === 0 ? (
                         <div className={`px-2 py-2 text-center text-[10px] font-mono cursor-not-allowed opacity-50 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>BANCO VAZIO</div>
                    ) : (
                        filteredVehicles.map(v => (
                           <div 
                               key={v.id}
                               onClick={() => { onChange(v.id!); setIsOpen(false); }}
                               className={`px-2 py-2 text-center text-[10px] font-mono font-bold cursor-pointer transition-colors border-t ${
                                   isDarkMode ? 'border-slate-700/50' : 'border-slate-100'
                               } ${
                                   value === v.id 
                                     ? (isCTA ? 'bg-yellow-500/20 text-yellow-600' : 'bg-emerald-500/20 text-emerald-600') 
                                     : (isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-700')
                               }`}
                           >
                               {v.fleet_number || v.id}
                           </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
