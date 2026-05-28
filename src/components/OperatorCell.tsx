import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { OperatorProfile } from '../types';

interface OperatorCellProps {
  operatorName?: string;
  className?: string;
  showName?: boolean;
  operators?: OperatorProfile[];
}

export const OperatorCell: React.FC<OperatorCellProps> = ({ 
  operatorName, 
  className = "",
  showName = true,
  operators
}) => {
  const [imageError, setImageError] = useState(false);
  const [profile, setProfile] = useState<OperatorProfile | null>(null);

  useEffect(() => {
    if (operatorName) {
      if (operators && operators.length > 0) {
        const match = operators.find(p => p.warName === operatorName || p.fullName === operatorName || p.id === operatorName);
        if (match) {
          setProfile(match);
          return;
        }
      }
      try {
        const cached = localStorage.getItem('supabase_cache_operators');
        if (cached) {
          const list: OperatorProfile[] = JSON.parse(cached);
          const match = list.find(p => p.warName === operatorName || p.fullName === operatorName || p.id === operatorName);
          if (match) {
            setProfile(match);
          }
        }
      } catch (e) {
        console.error('Erro ao ler cache de operadores em OperatorCell:', e);
      }
    }
  }, [operatorName, operators]);

  if (!operatorName) return <span className="text-slate-600 font-mono">---</span>;
  
  return (
    <div className={`flex items-center justify-start gap-2 ${className}`}>
      <div className="w-6 h-8 bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-end justify-center">
        {profile?.photoUrl && !imageError ? (
          <img 
            src={profile.photoUrl} 
            alt={operatorName} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
          />
        ) : (
          <User size={16} className="text-slate-500 mb-0.5" />
        )}
      </div>
      {showName && (
        <span className="text-slate-300 uppercase tracking-tight truncate text-[10px] font-black leading-none mt-0.5">
          {operatorName}
        </span>
      )}
    </div>
  );
};
