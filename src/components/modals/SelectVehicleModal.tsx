import React, { useMemo, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Truck, X, Search, AlertTriangle, Link2Off, CheckCircle2, Lock } from 'lucide-react';
import { Vehicle, OperatorProfile } from '../../types';

interface SelectVehicleModalProps {
    isOpen: boolean;
    onClose: () => void;
    operator: OperatorProfile | null;
    vehicles: Vehicle[];
    operators: OperatorProfile[];
    onAssignVehicle: (operatorId: string, vehicleId: string) => void;
}

export const SelectVehicleModal: React.FC<SelectVehicleModalProps> = ({ 
    isOpen, onClose, operator, vehicles, operators, onAssignVehicle 
}) => {
    const { isDarkMode } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'SRV' | 'CTA'>('SRV');
    const [pendingSelection, setPendingSelection] = useState<{
        vehicleName: string;
        otherOps: OperatorProfile[];
        currentVehicle: string | undefined;
    } | null>(null);

    // Get active vehicles and format them
    const processedVehicles = useMemo(() => {
        return vehicles.filter(v => v.status !== 'INATIVO').map(v => {
            const prefix = v.type === 'SERVIDOR' ? 'SRV' : 'CTA';
            const vId = (v as any).fleetNumber || v.id;
            const displayName = `${prefix}-${vId}`;
            return {
                ...v,
                prefix,
                vId,
                displayName
            };
        }).sort((a, b) => a.displayName.localeCompare(b.displayName));
    }, [vehicles]);

    const filteredVehicles = useMemo(() => {
        return processedVehicles.filter(v => {
            if (activeTab === 'SRV' && v.type !== 'SERVIDOR') return false;
            if (activeTab === 'CTA' && v.type === 'SERVIDOR') return false;
            
            if (searchQuery) {
                return v.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                       v.vId.toLowerCase().includes(searchQuery.toLowerCase());
            }
            return true;
        });
    }, [processedVehicles, activeTab, searchQuery]);

    if (!isOpen || !operator) return null;

    const handleSelect = (vehicleName: string) => {
        if (operator.assignedVehicle === vehicleName) {
            onClose(); // Already assigned
            return;
        }

        const otherOps = operators.filter(op => 
            op.id !== operator.id && 
            op.assignedVehicle && 
            (op.assignedVehicle === vehicleName || 
             op.assignedVehicle.replace('SRV-', '').replace('CTA-', '') === vehicleName.replace('SRV-', '').replace('CTA-', ''))
        );

        if (operator.assignedVehicle || otherOps.length > 0) {
            setPendingSelection({
                vehicleName,
                otherOps,
                currentVehicle: operator.assignedVehicle
            });
        } else {
            onAssignVehicle(operator.id, vehicleName);
            onClose();
        }
    };

    const confirmSelection = () => {
        if (pendingSelection) {
            onAssignVehicle(operator.id, pendingSelection.vehicleName);
        }
        setPendingSelection(null);
        onClose();
    };

    const handleUnassign = () => {
        onAssignVehicle(operator.id, '');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            {pendingSelection ? (
                <div className={`${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative flex flex-col p-6 animate-in zoom-in-95`}>
                    <div className="flex flex-col items-center text-center">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 border ${isDarkMode ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                            <AlertTriangle size={32} />
                        </div>
                        <h3 className={`text-lg font-black uppercase tracking-tight mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            Atenção ao Vínculo
                        </h3>
                        
                        <div className={`space-y-3 mb-6 w-full text-left p-4 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                            {pendingSelection.currentVehicle && (
                                <div>
                                    <p className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1`}>
                                        Conflito de Operador:
                                    </p>
                                    <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                        O operador já está vinculado ao frota <span className="font-mono font-black">{pendingSelection.currentVehicle}</span>. Deseja substituir para o frota <span className="font-mono font-black text-blue-500">{pendingSelection.vehicleName}</span>?
                                    </p>
                                </div>
                            )}

                            {pendingSelection.otherOps.length > 0 && (
                                <div className={pendingSelection.currentVehicle ? "pt-3 border-t border-slate-700/50" : ""}>
                                    <p className={`text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1`}>
                                        Conflito de Frota:
                                    </p>
                                    <p className={`text-[13px] leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                        O frota <span className="font-mono font-black">{pendingSelection.vehicleName}</span> já está vinculado {pendingSelection.otherOps.length === 1 ? 'ao operador' : 'aos operadores'}:
                                    </p>
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {pendingSelection.otherOps.map(op => (
                                            <span key={op.id} className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-950 text-amber-400 border border-amber-500/20' : 'bg-white text-amber-600 border border-amber-200'}`}>
                                                {op.warName}
                                            </span>
                                        ))}
                                    </div>
                                    <p className={`text-[13px] leading-relaxed mt-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                        Deseja desvincular o frota deste(s) operador(es) e vincular ao novo operador selecionado (<span className="font-mono font-black text-amber-500">{operator.warName}</span>)?
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3 w-full">
                            <button
                                onClick={() => setPendingSelection(null)}
                                className={`flex-1 px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border ${isDarkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-600'}`}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmSelection}
                                className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-lg shadow-amber-500/20"
                            >
                                <CheckCircle2 size={16} /> Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className={`${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative flex flex-col max-h-[85vh]`}>
                    <div className={`shrink-0 px-6 py-4 flex flex-col gap-4 border-b ${isDarkMode ? 'border-slate-800 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-blue-500/10 border-blue-500/20 text-blue-500">
                                    <Truck size={20} />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="font-black uppercase tracking-tight text-lg leading-none mb-1">
                                        Vincular Frota
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                            {operator.warName}
                                        </p>
                                        {operator.assignedVehicle && (
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                                                Atual: {operator.assignedVehicle}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {operator.assignedVehicle && (
                                    <button 
                                        onClick={handleUnassign}
                                        className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors group ${isDarkMode ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20' : 'bg-red-50 hover:bg-red-100 text-red-500 border border-red-200'}`}
                                        title="Remover frota atual"
                                    >
                                        <Link2Off size={16} className="group-hover:scale-110 transition-transform" />
                                    </button>
                                )}
                                <button 
                                    onClick={onClose}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors border ${isDarkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-200 text-slate-500'}`}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className={`flex items-center p-1 rounded-lg ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-slate-200/50 border border-slate-200'} h-10 w-full sm:w-[160px] shrink-0`}>
                                <button
                                    onClick={() => setActiveTab('SRV')}
                                    className={`flex-1 flex items-center justify-center h-full rounded text-[10px] font-black uppercase tracking-widest transition-all ${
                                        activeTab === 'SRV' 
                                            ? isDarkMode ? 'bg-slate-600 shadow-sm text-white' : 'bg-white shadow text-slate-800'
                                            : isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    SRV
                                </button>
                                <button
                                    onClick={() => setActiveTab('CTA')}
                                    className={`flex-1 flex items-center justify-center h-full rounded text-[10px] font-black uppercase tracking-widest transition-all ${
                                        activeTab === 'CTA' 
                                            ? isDarkMode ? 'bg-slate-600 shadow-sm text-white' : 'bg-white shadow text-slate-800'
                                            : isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    CTA
                                </button>
                            </div>
                            
                            <div className={`flex flex-1 items-center px-3 rounded-lg border h-10 transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-700 focus-within:border-blue-500 text-white' : 'bg-white border-slate-300 focus-within:border-blue-500 text-slate-900'}`}>
                                <Search size={16} className={`shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                                <input
                                    type="text"
                                    placeholder="PESQUISAR FROTA..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-transparent border-none outline-none text-xs font-bold uppercase px-3 placeholder:text-slate-400"
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} className={isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}>
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className={`p-4 overflow-y-auto w-full flex-1 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                        {filteredVehicles.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                                    <Truck size={24} className={isDarkMode ? 'text-slate-600' : 'text-slate-400'} />
                                </div>
                                <h4 className={`text-sm font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Nenhum frota encontrado</h4>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3 w-full">
                                {filteredVehicles.map(v => {
                                    const isSelected = operator.assignedVehicle === v.displayName;
                                    
                                    // See if it is used by OTHERS
                                    const otherOpsCount = operators.filter(op => 
                                        op.id !== operator.id && 
                                        op.assignedVehicle && 
                                        (op.assignedVehicle === v.displayName || 
                                         op.assignedVehicle.replace('SRV-', '').replace('CTA-', '') === v.vId)
                                    ).length;

                                    return (
                                        <button
                                            key={v.id}
                                            onClick={() => handleSelect(v.displayName)}
                                            className={`flex flex-col gap-1.5 p-3 rounded-xl border text-left transition-all active:scale-95 group ${
                                                isSelected 
                                                    ? 'border-blue-500 bg-blue-500/10 shadow-inner' 
                                                    : otherOpsCount > 0
                                                        ? isDarkMode 
                                                            ? 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-amber-500/50 hover:bg-slate-800 opacity-60 hover:opacity-100' 
                                                            : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-amber-300 hover:bg-amber-50 opacity-60 hover:opacity-100'
                                                        : isDarkMode 
                                                            ? 'bg-slate-800 border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/80' 
                                                            : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-mono font-black text-sm ${isSelected ? 'text-blue-500' : otherOpsCount > 0 ? (isDarkMode ? 'text-slate-500 group-hover:text-amber-500' : 'text-slate-400 group-hover:text-amber-600') : isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                                        {v.displayName}
                                                    </span>
                                                    {otherOpsCount > 0 && !isSelected && (
                                                        <Lock size={12} className={isDarkMode ? 'text-slate-600 group-hover:text-amber-500/70' : 'text-slate-400 group-hover:text-amber-500/70'} title="Ocupado por outro operador" />
                                                    )}
                                                </div>
                                                {isSelected && (
                                                    <CheckCircle2 size={16} className="text-blue-500" />
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between w-full">
                                                <span className={`text-[9px] font-bold uppercase tracking-widest ${isSelected ? 'text-blue-400' : isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                                                    {v.type}
                                                </span>
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${v.status === 'DISPONÍVEL' || v.status === 'ATIVO' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>
                                                    {v.status}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

