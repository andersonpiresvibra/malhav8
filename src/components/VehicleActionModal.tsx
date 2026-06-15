import React, { useState, useEffect } from 'react';
import { Vehicle, OperatorProfile, FlightData } from '../types';
import { X, UserPlus, Trash2, Power, PowerOff, Droplet, Save } from 'lucide-react';
import { DesigOpr } from './desigopr';

interface VehicleActionModalProps {
  vehicle: Vehicle | null;
  onClose: () => void;
  onUpdateVehicle: (updatedVehicle: Vehicle) => void;
  density: number;
  operators: OperatorProfile[];
  showStatusOnly?: boolean;
  vehicles?: Vehicle[];
  flights?: FlightData[];
}

export const VehicleActionModal: React.FC<VehicleActionModalProps> = ({ 
  vehicle, 
  onClose, 
  onUpdateVehicle, 
  density, 
  operators, 
  showStatusOnly = false,
  vehicles = [],
  flights = []
}) => {
  const [currentVolume, setCurrentVolume] = useState(vehicle?.currentVolume || 0);
  const [isDeactivationModalOpen, setIsDeactivationModalOpen] = useState(false);
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);
  const [deactivationReason, setDeactivationReason] = useState('Manutenção preventiva');
  const [activationReason, setActivationReason] = useState('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  useEffect(() => {
    if (vehicle) {
      setCurrentVolume(vehicle.currentVolume || 0);
    }
  }, [vehicle]);

  if (!vehicle) return null;

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setCurrentVolume(Number(value));
  };

  const handleSave = () => {
    onUpdateVehicle({ ...vehicle, currentVolume });
    onClose();
  };
  
  const handleDeactivate = () => {
    onUpdateVehicle({ ...vehicle, isActive: false, status: 'INATIVO', observations: `Desativado: ${deactivationReason}` });
    setIsDeactivationModalOpen(false);
    onClose();
  };

  const handleActivate = () => {
    onUpdateVehicle({ ...vehicle, isActive: true, status: 'DISPONÍVEL', observations: `Ativado: ${activationReason}` });
    setIsActivationModalOpen(false);
    onClose();
  };

  const volumeKg = (currentVolume * density).toFixed(0);
  const volumeLbs = (currentVolume * density * 2.20462).toFixed(0);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <span className="text-3xl font-black text-amber-500 font-mono">{vehicle.id}</span>
            <div>
              <h2 className="text-lg font-bold text-white">Ações da Frota</h2>
              <p className="text-xs text-slate-500">{vehicle.manufacturer}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-800 transition-colors"><X size={20} className="text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-6">
          {!showStatusOnly && (
            <>
              {vehicle.type === 'CTA' && (
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Droplet size={14}/>Ajustar Litragem de Entrada</h3>
                <div className="grid grid-cols-3 gap-4">
                    <div className='bg-slate-900 p-2 rounded-lg text-center'>
                        <label className="text-[10px] text-slate-550 font-bold uppercase font-mono">Vol. (Litros)</label>
                        <input 
                          type="text" 
                          value={currentVolume} 
                          onChange={handleVolumeChange} 
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSave();
                            }
                          }}
                          className="w-full bg-transparent text-center text-lg font-mono text-white outline-none border-b border-slate-850 focus:border-amber-500" 
                        />
                    </div>
                    <div className='bg-slate-900 p-2 rounded-lg text-center'>
                        <p className="text-[10px] text-slate-550 font-bold uppercase font-mono">Vol. Kg</p>
                        <p className="text-lg font-mono text-slate-400">{Number(volumeKg).toLocaleString()}</p>
                    </div>
                    <div className='bg-slate-900 p-2 rounded-lg text-center'>
                        <p className="text-[10px] text-slate-550 font-bold uppercase font-mono">Vol. Lbs</p>
                        <p className="text-lg font-mono text-slate-550">{Number(volumeLbs).toLocaleString()}</p>
                    </div>
                </div>
              </div>
              )}

              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                 <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">Designação de Operador</h3>
                 <div className="flex gap-4">
                    <button onClick={() => setIsAssignModalOpen(true)} className="flex-1 flex items-center justify-center gap-2 bg-blue-500/20 text-blue-450 hover:bg-blue-500/30 p-2.5 rounded-lg text-xs font-black uppercase tracking-widest">Alocar</button>
                    <button onClick={() => { onUpdateVehicle({ ...vehicle, operatorName: undefined, status: 'DISPONÍVEL' }); onClose(); }} disabled={!vehicle.operatorName} className="flex-1 flex items-center justify-center gap-2 bg-amber-500/10 text-amber-550 hover:bg-amber-500/20 p-2.5 rounded-lg text-xs font-black uppercase tracking-widest disabled:opacity-30">Remover</button>
                 </div>
              </div>
            </>
          )}

          <div className="flex gap-4">
            {vehicle.isActive !== false ? (
              <button onClick={() => setIsDeactivationModalOpen(true)} className="w-full flex items-center justify-center gap-2 bg-red-550/10 text-red-500 hover:bg-red-550/20 p-3 rounded-lg text-xs font-black uppercase tracking-widest border border-red-500/20">Desativar Frota</button>
            ) : (
              <button onClick={() => setIsActivationModalOpen(true)} className="w-full flex items-center justify-center gap-2 bg-emerald-550/10 text-emerald-500 hover:bg-emerald-555/20 p-3 rounded-lg text-xs font-black uppercase tracking-widest border border-emerald-500/20">Ativar Frota</button>
            )}
          </div>
        </div>

        {!showStatusOnly && (
          <div className="flex gap-3 justify-end p-4 bg-slate-950/50 border-t border-slate-800 rounded-b-2xl">
              <button onClick={onClose} className="flex-1 bg-slate-800 text-slate-400 p-3 rounded-lg text-xs font-black uppercase tracking-widest">Cancelar</button>
              <button onClick={handleSave} className="flex-1 bg-emerald-500 text-slate-950 hover:bg-emerald-400 p-3 rounded-lg text-xs font-black uppercase tracking-widest shadow-md">Concluido</button>
          </div>
        )}
      </div>

      {isDeactivationModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] shadow-2xl" onClick={() => setIsDeactivationModalOpen(false)}>
            <div className="bg-slate-900 border border-red-500/40 rounded-xl p-6 w-96 space-y-4 animate-in zoom-in-95 duration-100" onClick={(e) => e.stopPropagation()}>
                <h3 className='text-sm font-black text-red-400 uppercase tracking-wider font-mono'>Selecione o Motivo</h3>
                <select onChange={(e) => setDeactivationReason(e.target.value)} className='w-full bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-white font-mono text-xs'>
                    <option value="Manutenção preventiva">Manutenção Preventiva</option>
                    <option value="Troca de pneu/freio">Troca de Pneu/Freio</option>
                    <option value="Verificação de vazão">Ajuste de Vazão</option>
                    <option value="Abastecimento do veículo (Diesel)">Diesel Motor</option>
                    <option value="Aguardando inspeção fiscal">Inspeção Fiscal</option>
                </select>
                <button onClick={handleDeactivate} className='w-full bg-red-600 text-white p-3 rounded-lg font-bold hover:bg-red-500 tracking-wider text-xs font-black uppercase'>SALVAR INATIVIDADE</button>
            </div>
        </div>
      )}

      {isActivationModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] shadow-2xl" onClick={() => setIsActivationModalOpen(false)}>
            <div className="bg-slate-900 border border-emerald-500/40 rounded-xl p-6 w-96 space-y-4 animate-in zoom-in-95 duration-100" onClick={(e) => e.stopPropagation()}>
                <h3 className='text-sm font-black text-emerald-400 uppercase tracking-wider font-mono'>Responsável pela Liberação</h3>
                <input type="text" placeholder='Nome do Engenheiro/Técnico...' onChange={(e) => setActivationReason(e.target.value)} className='w-full bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-white font-mono text-xs' />
                <button onClick={handleActivate} className='w-full bg-emerald-500 text-slate-950 p-3 rounded-lg font-bold hover:bg-emerald-450 tracking-wider text-xs font-black uppercase'>REATIVAR CABINE</button>
            </div>
        </div>
      )}

      <DesigOpr 
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        operators={operators}
        vehicles={vehicles}
        flights={flights}
        vehicle={vehicle}
        onConfirm={(operatorId) => {
            const operator = operators.find(op => op.id === operatorId);
            if (operator) {
                onUpdateVehicle({ ...vehicle, operatorName: operator.warName, status: 'OCUPADO' });
            }
            setIsAssignModalOpen(false);
            onClose();
        }}
      />
    </div>
  );
};
