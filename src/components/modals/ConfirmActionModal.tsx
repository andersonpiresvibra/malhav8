import React from 'react';
import { X, AlertTriangle, Play, UserCheck, CheckCircle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface ConfirmActionModalProps {
    type: 'cancel' | 'start' | 'remove' | 'finish' | 'delete' | 'clearMesh' | 'syncPartial' | 'missingPositionVIP';
    flightNumber?: string;
    registration?: string;
    message?: string;
    onConfirm: (data?: { startTime?: Date }) => void;
    onClose: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
    type,
    flightNumber,
    registration,
    message,
    onConfirm,
    onClose
}) => {
    const { isDarkMode } = useTheme();
    const [manualTime, setManualTime] = React.useState('');
    const [useManualTime, setUseManualTime] = React.useState(false);

    const handleConfirmClick = () => {
        if (type === 'start' && useManualTime && manualTime) {
            const [hours, minutes] = manualTime.split(':').map(Number);
            const date = new Date();
            date.setHours(hours, minutes, 0, 0);
            onConfirm({ startTime: date });
        } else {
            onConfirm();
        }
    };
    let config = {
        title: '',
        icon: <AlertTriangle size={32} className="text-red-500" />,
        iconBg: 'bg-red-500/10 border-red-500/20',
        description: <></>,
        confirmText: '',
        confirmBg: 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
    };

    switch (type) {
        case 'cancel':
            config = {
                title: 'Confirmar Cancelamento',
                icon: <AlertTriangle size={32} className="text-red-500" />,
                iconBg: 'bg-red-500/10 border-red-500/20',
                description: (
                    <>Você optou por <span className="text-red-400 font-bold">CANCELAR</span> o voo <span className={`${isDarkMode ? 'text-white' : 'text-slate-900'} font-mono font-bold`}>{flightNumber}</span> {registration}. Deseja seguir com a ação?</>
                ),
                confirmText: 'Sim, Cancelar',
                confirmBg: 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
            };
            break;
        case 'start':
            config = {
                title: 'Iniciar Abastecimento',
                icon: <Play size={32} className="text-emerald-500" />,
                iconBg: 'bg-emerald-500/10 border-emerald-500/20',
                description: (
                    <>Registrar início do abastecimento para o voo <span className={`${isDarkMode ? 'text-white' : 'text-slate-900'} font-mono font-bold`}>{flightNumber}</span>?</>
                ),
                confirmText: 'Sim, Iniciar',
                confirmBg: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
            };
            break;
        case 'remove':
            config = {
                title: 'Cancelar Designação',
                icon: <UserCheck size={32} className="text-amber-500" />,
                iconBg: 'bg-amber-500/10 border-amber-500/20',
                description: (
                    <>Deseja remover o operador deste voo?</>
                ),
                confirmText: 'Sim, Remover',
                confirmBg: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20 btn-confirm-remove'
            };
            break;
        case 'finish':
            config = {
                title: 'Finalizar Abastecimento',
                icon: <CheckCircle size={32} className="text-emerald-500" />,
                iconBg: 'bg-emerald-500/10 border-emerald-500/20',
                description: (
                    <>Deseja Finalizar o abastecimento deste voo?</>
                ),
                confirmText: 'Sim, Finalizar',
                confirmBg: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
            };
            break;
        case 'delete':
            config = {
                title: 'Excluir Voo',
                icon: <AlertTriangle size={32} className="text-red-500" />,
                iconBg: 'bg-red-500/10 border-red-500/20',
                description: (
                    <>Você optou por <span className="text-red-400 font-bold">EXCLUIR</span> o voo <span className={`${isDarkMode ? 'text-white' : 'text-slate-900'} font-mono font-bold`}>{flightNumber}</span> {registration}. Esta ação não pode ser desfeita.</>
                ),
                confirmText: 'Sim, Excluir',
                confirmBg: 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
            };
            break;
        case 'clearMesh':
            config = {
                title: 'Limpar Malha Base',
                icon: <AlertTriangle size={32} className="text-red-500" />,
                iconBg: 'bg-red-500/10 border-red-500/20',
                description: (
                    <>Tem certeza de que deseja limpar toda a Malha Base? <span className="text-red-400 font-bold">Esta ação não pode ser desfeita.</span></>
                ),
                confirmText: 'Sim, Limpar',
                confirmBg: 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
            };
            break;
        case 'syncPartial':
            config = {
                title: 'Sincronização Parcial',
                icon: <AlertTriangle size={32} className="text-amber-500" />,
                iconBg: 'bg-amber-500/10 border-amber-500/20',
                description: (
                    <>{message}</>
                ),
                confirmText: 'Sim, Enviar Prontos',
                confirmBg: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
            };
            break;
        case 'missingPositionVIP':
            config = {
                title: 'Posição Não Informada',
                icon: <AlertTriangle size={32} className="text-amber-500" />,
                iconBg: 'bg-amber-500/10 border-amber-500/20',
                description: (
                    <>O voo <span className={`${isDarkMode ? 'text-white' : 'text-slate-900'} font-mono font-bold`}>{flightNumber}</span> não possui posição definida! Não é permitido iniciar o abastecimento sem posição de calço.<br/><br/><b>Este voo é do Pátio VIP?</b></>
                ),
                confirmText: 'Sim, Pátio VIP (Continuar)',
                confirmBg: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
            };
            break;
    }

    return (
        <div className="absolute inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center animate-in fade-in zoom-in-95 duration-200">
            <div className={`${isDarkMode ? 'bg-slate-900 border-emerald-500/30' : 'bg-white border-slate-200'} border-[0.5px] rounded-[8px] w-[450px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden`}>
                <div className={`${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-[#004D24] border-[#004D24]'} p-4 border-b flex justify-between items-center`}>
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest">{config.title}</h3>
                    <button onClick={onClose} className={`${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-emerald-100 hover:text-white'} transition-colors`}>
                        <X size={18} />
                    </button>
                </div>
                <div className="p-8">
                    <div className="flex flex-col items-center text-center mb-8">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 border ${config.iconBg}`}>
                            {config.icon}
                        </div>
                        <h3 className={`text-xl font-black uppercase tracking-tighter mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{config.title}</h3>
                        <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {config.description}
                        </p>
                    </div>

                    {type === 'start' && (
                        <div className={`mb-8 p-4 rounded-xl border ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Horário de Início
                                </span>
                                <div className="flex bg-slate-900/50 p-0.5 rounded-lg border border-slate-800">
                                    <button 
                                        onClick={() => setUseManualTime(false)}
                                        className={`px-3 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all ${!useManualTime ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        Agora
                                    </button>
                                    <button 
                                        onClick={() => setUseManualTime(true)}
                                        className={`px-3 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all ${useManualTime ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        Retroativo
                                    </button>
                                </div>
                            </div>

                            {useManualTime && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                    <input 
                                        type="time" 
                                        value={manualTime}
                                        onChange={(e) => setManualTime(e.target.value)}
                                        className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white font-mono text-center text-lg focus:border-emerald-500 outline-none transition-all`}
                                    />
                                    <p className="text-[9px] text-slate-500 mt-2 text-center uppercase font-black tracking-widest">
                                        Informe a hora que o operador iniciou o abastecimento
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div className="flex gap-4">
                        <button 
                            onClick={handleConfirmClick}
                            className={`flex-1 flex items-center justify-center gap-2 text-white px-6 py-4 rounded-lg shadow-lg transition-all active:scale-95 ${config.confirmBg}`}
                        >
                            <span className="text-[10px] font-black uppercase tracking-widest">{config.confirmText}</span>
                        </button>
                        <button 
                            onClick={onClose}
                            className={`flex-1 font-black py-4 rounded-lg uppercase tracking-widest text-[10px] transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                        >
                            {type === 'syncPartial' ? 'Não, Editar Antes' : type === 'missingPositionVIP' ? 'Não, Editar Posição' : 'Não, Voltar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
