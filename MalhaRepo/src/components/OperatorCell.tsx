
import React, { useState } from 'react';
import { User } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { OperatorProfile } from '../types';

interface OperatorCellProps {
  operatorName?: string;
  className?: string;
  showName?: boolean;
  operators?: OperatorProfile[];
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLivre?: boolean;
}

export const OperatorCell: React.FC<OperatorCellProps> = ({ 
  operatorName, 
  className = "",
  showName = true,
  operators = [],
  size = 'sm',
  isLivre = false
}) => {
  const [imageError, setImageError] = useState(false);
  const { isDarkMode } = useTheme();

  const profile = operatorName ? operators.find(p => p.warName === operatorName) : undefined;

  const containerSizes = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-11 h-11',
    xl: 'w-12 h-12'
  };

  const iconSizes = {
    sm: 16,
    md: 24,
    lg: 26,
    xl: 30
  };

  const textStyles = {
    sm: 'text-[10px] leading-none',
    md: 'text-xs leading-tight',
    lg: 'text-sm leading-tight',
    xl: 'text-base leading-tight'
  };
  
  return (
    <div className={`flex items-center justify-start gap-2 ${className}`}>
      <div className={`${containerSizes[size]} ${isLivre ? (isDarkMode ? 'bg-emerald-500/20 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-emerald-500 border-emerald-400') : (isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200')} border ${isLivre ? 'border-2' : ''} rounded overflow-hidden shrink-0 flex items-center justify-center`}>
        {profile?.photoUrl && !imageError ? (
          <img 
            src={profile.photoUrl} 
            alt={operatorName} 
            className={`w-full h-full object-cover ${isLivre ? 'opacity-90' : ''}`}
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
          />
        ) : (
          <User size={iconSizes[size]} className={isLivre ? (isDarkMode ? 'text-emerald-400' : 'text-white') : (isDarkMode ? "text-slate-600" : "text-slate-400/50")} />
        )}
      </div>
      {showName && operatorName && (
        <div className="flex flex-col">
          {isLivre && (
            <span className={`text-[10px] sm:text-xs font-black ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} uppercase animate-pulse leading-none mb-0.5`}>LIVRE</span>
          )}
          <span className={`${isLivre ? (isDarkMode ? 'text-slate-400 text-[9px]' : 'text-slate-500 text-[9px]') : (isDarkMode ? 'text-slate-300' : 'text-slate-700')} uppercase tracking-tight truncate font-bold ${isLivre ? '' : textStyles[size]} ${isLivre ? 'max-w-[70px]' : ''}`}>
            {operatorName}
          </span>
        </div>
      )}
      {showName && !operatorName && (
        <span className={`${isDarkMode ? 'text-slate-600' : 'text-slate-400'} uppercase tracking-tight truncate font-bold ${textStyles[size]} mt-0.5`}>
          ---
        </span>
      )}
    </div>
  );
};
