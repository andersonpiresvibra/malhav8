import React from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, Play, UserCheck, CheckCircle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { FlightData } from '../../types';

interface ConfirmActionModalProps {
    type: 'cancel' | 'start' | 'remove' | 'finish' | 'delete' | 'clearMesh' | 'syncPartial' | 'missingPositionVIP';
    flightNumber?: string;
    registration?: string;
    message?: string;
    flight?: FlightData;
    initialCtaVolume?: number;
    isCta?: boolean;
    onConfirm: (data?: { 
        startTime?: Date; 
        clearMode?: 'all' | 'inactive';
        resolvedReport?: any;
        flightUpdates?: any;
        ctaVolume?: number;
    }) => void;
    onClose: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
    type,
    flightNumber,
    registration,
    message,
    flight,
    initialCtaVolume,
    isCta,
    onConfirm,
    onClose
}) => {
    const { isDarkMode } = useTheme();
    const [manualTime, setManualTime] = React.useState('');
    const [useManualTime, setUseManualTime] = React.useState(false);
    
    const [ctaVolumeValue, setCtaVolumeValue] = React.useState<number | ''>('');

    React.useEffect(() => {
        if (initialCtaVolume !== undefined) {
            setCtaVolumeValue(initialCtaVolume);
        }
    }, [initialCtaVolume]);

    const isCTA = React.useMemo(() => {
        if (isCta !== undefined) return isCta;
        if (!flight) return false;
        return (
            flight.vehicleType === 'CTA' || 
            flight.fleetType === 'CTA' ||
            !!(flight.fleet && flight.fleet.toUpperCase().includes('CTA')) ||
            !!(flight.vehicleId && flight.vehicleId.toUpperCase().includes('CTA'))
        );
    }, [flight, isCta]);

    // Formatar hora atual em formato HH:MM
    const nowStr = React.useMemo(() => {
        const d = new Date();
        const hrs = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${hrs}:${mins}`;
    }, []);

    // Estados locais para digitação dos tempos de resoluções de restrições
    const [chockTime, setChockTime] = React.useState(nowStr);
    const [crewTimeVal, setCrewTimeVal] = React.useState(nowStr);
    const [mechanicTimeVal, setMechanicTimeVal] = React.useState(nowStr);
    const [fuelOrderTimeVal, setFuelOrderTimeVal] = React.useState(nowStr);
    const [authorizationTimeVal, setAuthorizationTimeVal] = React.useState(nowStr);
    const [clearObstruction, setClearObstruction] = React.useState(true);

    const hasMissingAircraft = React.useMemo(() => {
        return !!flight?.report?.missingAircraft && (!flight?.actualArrivalTime || flight?.actualArrivalTime === '--:--' || flight?.actualArrivalTime === '00:00');
    }, [flight]);

    const hasMissingCrew = React.useMemo(() => {
        return !!flight?.report?.missingCrew && !flight?.report?.crewTime;
    }, [flight]);

    const hasMissingMaintenance = React.useMemo(() => {
        return !!flight?.report?.missingMaintenance && !flight?.report?.mechanicTime;
    }, [flight]);

    const hasMissingDot = React.useMemo(() => {
        return !!flight?.report?.missingDot && !flight?.report?.fuelOrderTime;
    }, [flight]);

    const hasMissingRelease = React.useMemo(() => {
        return !!flight?.report?.missingRelease && !flight?.report?.authorizationTime;
    }, [flight]);

    const hasObstructedArea = React.useMemo(() => {
        return !!flight?.report?.obstructedArea;
    }, [flight]);

    const hasAnyPending = React.useMemo(() => {
        return hasMissingAircraft || hasMissingCrew || hasMissingMaintenance || hasMissingDot || hasMissingRelease || hasObstructedArea;
    }, [hasMissingAircraft, hasMissingCrew, hasMissingMaintenance, hasMissingDot, hasMissingRelease, hasObstructedArea]);

    const handleConfirmClick = (mode?: 'all' | 'inactive') => {
        if (type === 'start') {
            const reportUpdates: any = {};
            const flightUpdates: any = {};

            if (hasMissingAircraft) {
                flightUpdates.actualArrivalTime = chockTime;
            }
            if (hasMissingCrew) {
                reportUpdates.crewTime = crewTimeVal;
            }
            if (hasMissingMaintenance) {
                reportUpdates.mechanicTime = mechanicTimeVal;
            }
            if (hasMissingDot) {
                reportUpdates.fuelOrderTime = fuelOrderTimeVal;
            }
            if (hasMissingRelease) {
                reportUpdates.authorizationTime = authorizationTimeVal;
            }
            if (hasObstructedArea && clearObstruction) {
                reportUpdates.obstructedArea = false;
                reportUpdates.obstructedEquipment = [];
            }

            let startTimeVal = undefined;
            if (useManualTime && manualTime) {
                const [hours, minutes] = manualTime.split(':').map(Number);
                const date = new Date();
                date.setHours(hours, minutes, 0, 0);
                startTimeVal = date;
            }

            onConfirm({
                startTime: startTimeVal,
                resolvedReport: Object.keys(reportUpdates).length > 0 ? reportUpdates : undefined,
                flightUpdates: Object.keys(flightUpdates).length > 0 ? flightUpdates : undefined
            });
        } else if (type === 'clearMesh') {
            onConfirm({ clearMode: mode || 'all' });
        } else if (type === 'finish') {
            onConfirm({
                ctaVolume: isCTA && ctaVolumeValue !== '' ? Number(ctaVolumeValue) : undefined
            });
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
                title: message ? 'Limpar Malha Operacional' : 'Limpar Malha Base',
                icon: <AlertTriangle size={32} className="text-red-500" />,
                iconBg: 'bg-red-500/10 border-red-500/20',
                description: (
                    <>{message || <>Tem certeza de que deseja limpar toda a Malha Base? <span className="text-red-400 font-bold">Esta ação não pode ser desfeita.</span></>}</>
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

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
            <div className={`relative ${isDarkMode ? 'bg-slate-900 border-emerald-500/30' : 'bg-white border-slate-200'} border-[0.5px] rounded-[8px] ${hasAnyPending ? 'w-[500px]' : 'w-[450px]'} transition-all duration-300 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden`}>
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
                        <div className="space-y-4 mb-8">
                            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                        Horário de Início
                                    </span>
                                    <div className="flex bg-slate-150 dark:bg-slate-900/50 p-0.5 rounded-lg border border-slate-300 dark:border-slate-800">
                                        <button 
                                            onClick={() => setUseManualTime(false)}
                                            className={`px-3 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all whitespace-nowrap leading-none cursor-pointer ${!useManualTime ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/10' : isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-750'}`}
                                        >
                                            Agora
                                        </button>
                                        <button 
                                            onClick={() => setUseManualTime(true)}
                                            className={`px-3 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all whitespace-nowrap leading-none cursor-pointer ${useManualTime ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/10' : isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-755'}`}
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
                                            className={`w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-750 rounded-lg px-4 py-3 text-slate-900 dark:text-white font-mono text-center text-lg focus:border-emerald-500 outline-none transition-all`}
                                        />
                                        <p className="text-[9px] text-slate-500 mt-2 text-center uppercase font-black tracking-widest">
                                            Informe a hora que o operador iniciou o abastecimento
                                        </p>
                                    </div>
                                )}
                            </div>

                            {hasAnyPending && (
                                <div className={`p-4 rounded-xl border animate-in fade-in duration-350 ${
                                    isDarkMode 
                                        ? 'bg-slate-950/60 border-amber-500/20 shadow-[inset_0_1px_4px_rgba(245,158,11,0.05)]' 
                                        : 'bg-amber-50/40 border-amber-200 shadow-sm'
                                }`}>
                                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-dashed border-amber-500/10 dark:border-amber-500/15">
                                        <AlertTriangle size={14} className="text-amber-550 dark:text-amber-500 shrink-0 animate-pulse" />
                                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                            Resolver Restrições Ativas
                                        </span>
                                    </div>
                                    <p className={`text-[10px] font-medium mb-3.5 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                        Este voo possui restrições de pátio que bloqueavam o início. Insira os horários em que os ausentes se apresentaram para desobstruir e iniciar:
                                    </p>

                                    <div className="grid grid-cols-2 gap-3 pb-1">
                                        {hasMissingAircraft && (
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] font-extrabold uppercase tracking-wider text-amber-650 dark:text-amber-400 leading-none">
                                                    Horário do Calço
                                                </label>
                                                <input 
                                                    type="time" 
                                                    value={chockTime}
                                                    onChange={(e) => setChockTime(e.target.value)}
                                                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2.5 py-2 font-mono text-center text-xs text-slate-800 dark:text-amber-400 focus:border-amber-500 outline-none font-bold"
                                                />
                                            </div>
                                        )}
                                        {hasMissingCrew && (
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] font-extrabold uppercase tracking-wider text-amber-650 dark:text-amber-400 leading-none">
                                                    Chegada Tripulação
                                                </label>
                                                <input 
                                                    type="time" 
                                                    value={crewTimeVal}
                                                    onChange={(e) => setCrewTimeVal(e.target.value)}
                                                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2.5 py-2 font-mono text-center text-xs text-slate-800 dark:text-amber-400 focus:border-amber-500 outline-none font-bold"
                                                />
                                            </div>
                                        )}
                                        {hasMissingMaintenance && (
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] font-extrabold uppercase tracking-wider text-amber-650 dark:text-amber-400 leading-none">
                                                    Chegada Manutenção
                                                </label>
                                                <input 
                                                    type="time" 
                                                    value={mechanicTimeVal}
                                                    onChange={(e) => setMechanicTimeVal(e.target.value)}
                                                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2.5 py-2 font-mono text-center text-xs text-slate-800 dark:text-amber-400 focus:border-amber-500 outline-none font-bold"
                                                />
                                            </div>
                                        )}
                                        {hasMissingDot && (
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] font-extrabold uppercase tracking-wider text-amber-655 dark:text-amber-400 leading-none">
                                                    Recebimento do DOT
                                                </label>
                                                <input 
                                                    type="time" 
                                                    value={fuelOrderTimeVal}
                                                    onChange={(e) => setFuelOrderTimeVal(e.target.value)}
                                                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2.5 py-2 font-mono text-center text-xs text-slate-800 dark:text-amber-400 focus:border-amber-500 outline-none font-bold"
                                                />
                                            </div>
                                        )}
                                        {hasMissingRelease && (
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[9px] font-extrabold uppercase tracking-wider text-amber-650 dark:text-amber-400 leading-none">
                                                    Chegada da Folha
                                                </label>
                                                <input 
                                                    type="time" 
                                                    value={authorizationTimeVal}
                                                    onChange={(e) => setAuthorizationTimeVal(e.target.value)}
                                                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2.5 py-2 font-mono text-center text-xs text-slate-800 dark:text-amber-400 focus:border-amber-500 outline-none font-bold"
                                                />
                                            </div>
                                        )}
                                        {hasObstructedArea && (
                                            <div className="col-span-2 flex items-center justify-between p-2.5 bg-white dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-850 mt-1">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-450 leading-none mb-1">
                                                        Aeronave Obstruída
                                                    </span>
                                                    <span className="text-[8px] text-slate-400 dark:text-slate-500 uppercase font-bold leading-none">
                                                        Equipamentos no pátio
                                                    </span>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => setClearObstruction(!clearObstruction)}
                                                    className={`px-3 py-1.5 text-[8.5px] font-black uppercase tracking-wider rounded transition-all active:scale-95 cursor-pointer leading-none ${
                                                        clearObstruction 
                                                            ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-sm font-black' 
                                                            : 'bg-slate-100 dark:bg-slate-900 text-slate-400 hover:text-slate-300'
                                                    }`}
                                                >
                                                    {clearObstruction ? 'DESOBSTRUIR RESTR (SIM)' : 'MANTER RESTRITO'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {type === 'finish' && isCTA && (
                        <div className="space-y-4 mb-8">
                            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                {flight?.vehicleId && (
                                    <div className="flex justify-center mb-4">
                                        <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-500/15 border-2 border-amber-500 rounded-lg text-sm font-black font-mono text-amber-500 uppercase tracking-widest shadow-md">
                                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                                            FROTA: {flight.vehicleId}
                                        </div>
                                    </div>
                                )}
                                <label className={`block text-[10px] font-black uppercase tracking-widest text-center mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Volume de Retorno do Caminhão (Litros)
                                </label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        autoFocus
                                        value={ctaVolumeValue === '' ? '' : ctaVolumeValue}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, "");
                                            setCtaVolumeValue(val === '' ? '' : Number(val));
                                        }}
                                        placeholder="Volume em Litros..."
                                        className={`w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-750 focus:border-amber-500 outline-none p-3 rounded-lg text-center text-xl font-mono text-slate-900 dark:text-white tracking-widest`}
                                    />
                                    <span className="absolute right-3 top-3.5 text-xs font-bold text-slate-500 font-mono">LTS</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div className={`p-3 rounded-lg text-center border ${isDarkMode ? 'bg-slate-950/35 border-slate-850' : 'bg-slate-100/30 border-slate-200'}`}>
                                        <span className={`block text-[8px] font-bold uppercase font-mono ${isDarkMode ? 'text-slate-550' : 'text-slate-500'}`}>Conversão Aérea Kg</span>
                                        <span className={`text-sm font-mono font-bold ${isDarkMode ? 'text-slate-350' : 'text-slate-700'}`}>
                                            {Number(((Number(ctaVolumeValue) || 0) * 0.800).toFixed(0)).toLocaleString()} kg
                                        </span>
                                    </div>
                                    <div className={`p-3 rounded-lg text-center border ${isDarkMode ? 'bg-slate-950/35 border-slate-850' : 'bg-slate-100/30 border-slate-200'}`}>
                                        <span className={`block text-[8px] font-bold uppercase font-mono ${isDarkMode ? 'text-slate-550' : 'text-slate-500'}`}>Conversão Aérea Lbs</span>
                                        <span className={`text-sm font-mono font-bold ${isDarkMode ? 'text-slate-350' : 'text-slate-700'}`}>
                                            {Number(((Number(ctaVolumeValue) || 0) * 0.800 * 2.20462).toFixed(0)).toLocaleString()} lbs
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="flex gap-4">
                        {type === 'clearMesh' ? (
                            <>
                                <button 
                                    onClick={() => handleConfirmClick('inactive')}
                                    className={`flex-1 flex items-center justify-center gap-2 text-white px-6 py-4 rounded-lg shadow-lg transition-all active:scale-95 bg-amber-600 hover:bg-amber-500 shadow-amber-600/20`}
                                >
                                    <div className="flex flex-col items-center">
                                        <span className="text-[10px] font-black uppercase tracking-widest">Preservar Ativos</span>
                                        <span className="text-[8px] opacity-70 font-medium">Mantém Designados</span>
                                    </div>
                                </button>
                                <button 
                                    onClick={() => handleConfirmClick('all')}
                                    className={`flex-1 flex items-center justify-center gap-2 text-white px-6 py-4 rounded-lg shadow-lg transition-all active:scale-95 bg-red-600 hover:bg-red-500 shadow-red-600/20`}
                                >
                                    <div className="flex flex-col items-center">
                                        <span className="text-[10px] font-black uppercase tracking-widest">Limpar Tudo</span>
                                        <span className="text-[8px] opacity-70 font-medium">Reset Total</span>
                                    </div>
                                </button>
                            </>
                        ) : (
                            <>
                                <button 
                                    onClick={() => handleConfirmClick()}
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
                            </>
                        )}
                    </div>

                    {type === 'clearMesh' && (
                        <div className="mt-4 flex justify-center">
                            <button 
                                onClick={onClose}
                                className={`w-full font-black py-3 rounded-lg uppercase tracking-widest text-[9px] transition-all active:scale-95 ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Manter como está (Sair)
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
