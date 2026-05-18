import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface AirlineLogoProps {
  airlineCode: string;
  className?: string;
  showName?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const AIRLINE_INFO: Record<string, { iata: string, name: string }> = {
  'RG': { iata: 'G3', name: 'GOL' },
  'G3': { iata: 'G3', name: 'GOL' },
  'GOL': { iata: 'G3', name: 'GOL' },
  'GLO': { iata: 'G3', name: 'GOL' },
  'LA': { iata: 'LA', name: 'LATAM' },
  'TAM': { iata: 'LA', name: 'LATAM' },
  'LATAM': { iata: 'LA', name: 'LATAM' },
  'LAT': { iata: 'LA', name: 'LATAM' },
  'AD': { iata: 'AD', name: 'AZUL' },
  'AZUL': { iata: 'AD', name: 'AZUL' },
  'AZU': { iata: 'AD', name: 'AZUL' },
  'TP': { iata: 'TP', name: 'TAP' },
  'TAP': { iata: 'TP', name: 'TAP' },
  'AF': { iata: 'AF', name: 'AIR FR' },
  'AIR FRANCE': { iata: 'AF', name: 'AIR FR' },
  'AFR': { iata: 'AF', name: 'AIR FR' },
  'LH': { iata: 'LH', name: 'LUFTH' },
  'LUFTHANSA': { iata: 'LH', name: 'LUFTH' },
  'DLH': { iata: 'LH', name: 'LUFTH' },
  'CM': { iata: 'CM', name: 'COPA' },
  'COPA': { iata: 'CM', name: 'COPA' },
  'COPA AIRLINES': { iata: 'CM', name: 'COPA' },
  'CMP': { iata: 'CM', name: 'COPA' },
  'UA': { iata: 'UA', name: 'UNITED' },
  'UNITED': { iata: 'UA', name: 'UNITED' },
  'UAL': { iata: 'UA', name: 'UNITED' },
  'AA': { iata: 'AA', name: 'AMERIC' },
  'AMERICAN': { iata: 'AA', name: 'AMERIC' },
  'AMERICAN AIRLINES': { iata: 'AA', name: 'AMERIC' },
  'AAL': { iata: 'AA', name: 'AMERIC' },
  'KL': { iata: 'KL', name: 'KLM' },
  'KLM': { iata: 'KL', name: 'KLM' },
  'DL': { iata: 'DL', name: 'DELTA' },
  'DELTA': { iata: 'DL', name: 'DELTA' },
  'DAL': { iata: 'DL', name: 'DELTA' },
  'TT': { iata: 'TT', name: 'TOTAL' },
  'TOTAL': { iata: 'TT', name: 'TOTAL' },
};

export const AirlineLogo: React.FC<AirlineLogoProps> = ({ airlineCode, className = "", showName = true, size = 'md' }) => {
  const [imgError, setImgError] = useState(false);
  const { isDarkMode } = useTheme();
  
  const getNormalizedInfo = (code: string) => {
    const upperCode = code.toUpperCase();
    if (upperCode.includes('LA') && upperCode.includes('TAM') || upperCode.includes('LATAM')) return { iata: 'LA', name: 'LATAM' };
    if (upperCode.includes('GOL') || upperCode.includes('G3') || upperCode.includes('GLO')) return { iata: 'G3', name: 'GOL' };
    if (upperCode.includes('AZUL') || upperCode.includes('AD') || upperCode.includes('AZU')) return { iata: 'AD', name: 'AZUL' };
    if (upperCode.includes('TAP') || upperCode.includes('TP')) return { iata: 'TP', name: 'TAP' };
    if (upperCode.includes('FRANCE') || upperCode.includes('AFR') || upperCode.includes('AF')) return { iata: 'AF', name: 'AIR FRANCE' };
    if (upperCode.includes('LUFTHANSA') || upperCode.includes('DLH') || upperCode.includes('LH')) return { iata: 'LH', name: 'LUFTHANSA' };
    if (upperCode.includes('COPA') || upperCode.includes('CM') || upperCode.includes('CMP')) return { iata: 'CM', name: 'COPA' };
    if (upperCode.includes('UNITED') || upperCode.includes('UA') || upperCode.includes('UAL')) return { iata: 'UA', name: 'UNITED' };
    if (upperCode.includes('AMERICAN') || upperCode.includes('AA') || upperCode.includes('AAL')) return { iata: 'AA', name: 'AMERICAN' };
    if (upperCode.includes('KLM') || upperCode.includes('KL')) return { iata: 'KL', name: 'KLM' };
    if (upperCode.includes('DELTA') || upperCode.includes('DL') || upperCode.includes('DAL')) return { iata: 'DL', name: 'DELTA' };
    if (upperCode.includes('TOTAL') || upperCode.includes('TT')) return { iata: 'TT', name: 'TOTAL' };
    if (upperCode.includes('QATAR') || upperCode.includes('QR') || upperCode.includes('QTR')) return { iata: 'QR', name: 'QATAR' };
    if (upperCode.includes('EMIRATES') || upperCode.includes('EK') || upperCode.includes('UAE')) return { iata: 'EK', name: 'EMIRATES' };
    if (upperCode.includes('AEROLINEAS') || upperCode.includes('AR') || upperCode.includes('ARG')) return { iata: 'AR', name: 'AEROLINEAS' };
    if (upperCode.includes('SKY') || upperCode.includes('H2') || upperCode.includes('SKU')) return { iata: 'H2', name: 'SKY' };
    if (upperCode.includes('AVIANCA') || upperCode.includes('AV') || upperCode.includes('AVA')) return { iata: 'AV', name: 'AVIANCA' };
    if (upperCode.includes('BOA') || upperCode.includes('OB') || upperCode.includes('BOV')) return { iata: 'OB', name: 'BOA' };
    if (upperCode.includes('BRITISH') || upperCode.includes('BA') || upperCode.includes('BAW')) return { iata: 'BA', name: 'BRITISH' };
    if (upperCode.includes('IBERIA') || upperCode.includes('IB') || upperCode.includes('IBE')) return { iata: 'IB', name: 'IBERIA' };
    if (upperCode.includes('SWISS') || upperCode.includes('LX') || upperCode.includes('SWR')) return { iata: 'LX', name: 'SWISS' };
    if (upperCode.includes('ITA') || upperCode.includes('AZ') || upperCode.includes('ITY')) return { iata: 'AZ', name: 'ITA' };
    if (upperCode.includes('TURKISH') || upperCode.includes('TK') || upperCode.includes('THY')) return { iata: 'TK', name: 'TURKISH' };
    if (upperCode.includes('ETHIOPIAN') || upperCode.includes('ET') || upperCode.includes('ETH')) return { iata: 'ET', name: 'ETHIOPIAN' };
    if (upperCode.includes('AIR CANADA') || upperCode.includes('AC') || upperCode.includes('ACA')) return { iata: 'AC', name: 'AIR CANADA' };
    if (upperCode.includes('AEROMEXICO') || upperCode.includes('AM') || upperCode.includes('AMX')) return { iata: 'AM', name: 'AEROMEXICO' };

    const info = AIRLINE_INFO[upperCode];
    if (info) return info;

    // Try to find by name partially
    return { iata: upperCode.substring(0,2), name: upperCode.split(' ')[0] };
  };

  const normalizedCode = airlineCode?.toUpperCase() || '';
  const info = getNormalizedInfo(normalizedCode);
  
  const iconUrl = `https://images.kiwi.com/airlines/64/${info.iata}.png`;

  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10'
  };

  return (
    <div className={`flex items-center gap-2 pl-1 ${className}`}>
      <div className={`${sizeClasses[size]} flex items-center justify-center shrink-0 rounded-sm ${isDarkMode ? 'bg-white/10' : 'bg-transparent'}`}>
        {!imgError ? (
          <img 
            src={iconUrl} 
            alt={info.name} 
            className="w-full h-full object-contain drop-shadow-[1px_1px_1px_rgba(0,0,0,0.5)] hover:scale-110 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{info.iata}</span>
        )}
      </div>
      {showName && (
        <span className={`text-[10px] font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} tracking-wider uppercase truncate max-w-[50px]`} title={info.name}>
          {info.name}
        </span>
      )}
    </div>
  );
};
