import React, { useState } from 'react';
import { PlaneTakeoff, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const LoginScreen: React.FC = () => {
  const { loginWithWarName } = useAuth();
  const [warName, setWarName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warName.trim()) {
      setError('Por favor, insira seu Nome de Guerra.');
      return;
    }

    setError(null);
    setLoading(true);

    const result = await loginWithWarName(warName.trim());
    
    if (!result.success) {
      setError(result.error || 'Erro ao validar acesso.');
      setLoading(false);
    }
    // Success is handled by AuthContext state update which triggers re-render in App.tsx
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-slate-900 rounded-2xl shadow-2xl border border-slate-800/50 p-8 relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-600/10 rounded-full blur-3xl"></div>

        <div className="flex flex-col items-center mb-10 relative z-10">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-600/20 rotate-3">
            <PlaneTakeoff size={32} className="text-white -rotate-3" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter">MALHA</h1>
          <div className="flex items-center gap-2 mt-2">
            <ShieldCheck size={12} className="text-emerald-500" />
            <p className="text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black">
              Acesso Restrito LT
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-4 rounded-xl mb-6 font-bold text-center leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Identificação Operacional</label>
            <div className="relative">
              <input 
                type="text" 
                value={warName}
                onChange={(e) => setWarName(e.target.value)}
                required
                placeholder="NOME DE GUERRA"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-white placeholder-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all uppercase font-black tracking-widest text-sm"
                autoFocus
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-white hover:bg-blue-50 text-slate-950 font-black uppercase tracking-[0.15em] text-xs py-4 rounded-xl transition-all mt-4 flex justify-center items-center disabled:opacity-50 shadow-lg shadow-white/5 active:scale-[0.98]"
          >
            {loading ? <Loader2 size={18} className="animate-spin text-blue-600" /> : 'Validar Credenciais'}
          </button>
        </form>

        <div className="mt-12 text-center relative z-10">
          <p className="text-slate-600 text-[9px] font-bold uppercase tracking-widest">
            Vibra Energia • Aeroportuário
          </p>
        </div>
      </div>
      
      <div className="mt-8 flex items-center gap-4 text-slate-700 opacity-20">
        <div className="h-px w-8 bg-current"></div>
        <span className="text-[10px] font-black tracking-[0.3em]">JETFUEL-SIM</span>
        <div className="h-px w-8 bg-current"></div>
      </div>
    </div>
  );
};
