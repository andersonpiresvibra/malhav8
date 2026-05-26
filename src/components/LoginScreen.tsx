import React, { useState } from 'react';
import { PlaneTakeoff, Loader2, ShieldCheck, ArrowLeft, Mail, Lock, UserCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const LoginScreen: React.FC = () => {
  const { loginWithWarName, loginWithPassword, completeFirstLogin } = useAuth();
  const [loginStep, setLoginStep] = useState<'warName' | 'password' | 'first_login'>('warName');
  
  const [warName, setWarName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleWarNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warName.trim()) {
      setError('Por favor, insira seu Nome de Guerra.');
      return;
    }

    setError(null);
    setLoading(true);

    const result = await loginWithWarName(warName.trim());
    
    if (result.success) {
      if (result.step === 'password') {
        setLoginStep('password');
        setError(null);
        setLoading(false);
      } else if (result.step === 'first_login') {
        setEmail(result.defaultEmail || '');
        setLoginStep('first_login');
        setError(null);
        setLoading(false);
      } else {
        // Logged in directly (e.g. standard operator session bypass or password-not-found fallback)
        setError(null);
        setLoading(false);
      }
    } else {
      setError(result.error || 'Erro ao validar acesso.');
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Por favor, insira sua senha de acesso.');
      return;
    }

    setError(null);
    setLoading(true);

    const result = await loginWithPassword(warName.trim(), password.trim());
    if (!result.success) {
      setError(result.error || 'Senha incorreta. Verifique suas credenciais operacionais.');
      setLoading(false);
    }
  };

  const handleFirstLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Por favor, defina um e-mail para comunicação direta.');
      return;
    }
    if (!password.trim()) {
      setError('Por favor, digite sua senha de acesso de altíssima segurança.');
      return;
    }
    if (password.length < 4) {
      setError('A senha de acesso deve possuir ao menos 4 dígitos operacionais.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas especificadas não coincidem. Digite novamente.');
      return;
    }

    setError(null);
    setLoading(true);

    const result = await completeFirstLogin(warName.trim(), email.trim(), password.trim());
    if (!result.success) {
      setError(result.error || 'Erro ao registrar credenciais de primeiro acesso.');
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    setLoginStep('warName');
    setPassword('');
    setConfirmPassword('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-slate-900 rounded-2xl shadow-2xl border border-slate-800/50 p-8 relative overflow-hidden transition-all duration-300">
        {/* Glow effects */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-600/10 rounded-full blur-3xl"></div>

        {/* Dynamic header depending on the steps */}
        {loginStep === 'warName' && (
          <div className="flex flex-col items-center mb-8 relative z-10 animate-fade-in">
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
        )}

        {loginStep === 'password' && (
          <div className="flex flex-col items-center mb-6 relative z-10 animate-fade-in">
            <button 
              onClick={handleGoBack}
              className="absolute left-0 top-1 text-slate-500 hover:text-white transition-colors flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider"
              title="Voltar"
            >
              <ArrowLeft size={14} /> Voltar
            </button>
            <div className="w-12 h-12 bg-indigo-600/10 border border-indigo-500/20 rounded-xl flex items-center justify-center mb-3">
              <Lock size={20} className="text-indigo-400 animate-pulse" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight uppercase">Autenticação Base</h2>
            <div className="text-[10px] uppercase font-black tracking-widest bg-indigo-950/45 px-2 py-0.5 rounded border border-indigo-900/40 text-indigo-400 mt-2">
              OPERADOR: {warName.toUpperCase()}
            </div>
            <p className="text-slate-400 text-[11px] text-center mt-3 font-medium px-2 leading-relaxed">
              Este perfil operacional está protegido. Por favor, insira sua senha registrada para confirmar acesso ao NOC.
            </p>
          </div>
        )}

        {loginStep === 'first_login' && (
          <div className="flex flex-col items-center mb-6 relative z-10 animate-fade-in">
            <button 
              onClick={handleGoBack}
              className="absolute left-0 top-1 text-slate-500 hover:text-white transition-colors flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider"
              title="Voltar"
            >
              <ArrowLeft size={14} /> Voltar
            </button>
            <div className="w-12 h-12 bg-amber-600/10 border border-amber-500/20 rounded-xl flex items-center justify-center mb-3">
              <UserCheck size={20} className="text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight uppercase">Primeiro Acesso</h2>
            <div className="text-[10px] uppercase font-black tracking-widest bg-amber-950/45 px-2 py-0.5 rounded border border-amber-900/40 text-amber-400 mt-2">
              NOVO PERFIL: {warName.toUpperCase()}
            </div>
            <p className="text-slate-400 text-[10px] text-center mt-3 font-medium leading-relaxed bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
              Você é um **LT** ou **Operador Sênior** na base do projeto MALHA. Defina suas credenciais operacionais para iniciar.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-4 rounded-xl mb-6 font-bold text-center leading-relaxed relative z-10 animate-fade-in">
            {error}
          </div>
        )}

        {/* STEP 0: WAR NAME INPUT */}
        {loginStep === 'warName' && (
          <form onSubmit={handleWarNameSubmit} className="space-y-6 relative z-10 animate-fade-in">
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
              className="w-full bg-white hover:bg-blue-50 text-slate-950 font-black uppercase tracking-[0.15em] text-xs py-4 rounded-xl transition-all mt-4 flex justify-center items-center disabled:opacity-50 shadow-lg shadow-white/5 active:scale-[0.98] cursor-pointer"
            >
              {loading ? <Loader2 size={18} className="animate-spin text-blue-600" /> : 'Validar Credenciais'}
            </button>
          </form>
        )}

        {/* STEP 1: PASSWORD VERIFICATION */}
        {loginStep === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-5 relative z-10 animate-fade-in">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Senha Estratégica</label>
              <div className="relative">
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="DIGITE SUA SENHA"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-white placeholder-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono tracking-widest text-sm"
                  autoFocus
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.15em] text-xs py-4 rounded-xl transition-all mt-2 flex justify-center items-center disabled:opacity-50 shadow-lg shadow-indigo-600/10 active:scale-[0.98] cursor-pointer"
            >
              {loading ? <Loader2 size={18} className="animate-spin text-white" /> : 'Confirmar e Entrar'}
            </button>
          </form>
        )}

        {/* STEP 2: REGISTER EMAIL AND PASSWORD (FIRST LOGIN) */}
        {loginStep === 'first_login' && (
          <form onSubmit={handleFirstLoginSubmit} className="space-y-4 relative z-10 animate-fade-in">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Endereço de E-mail</label>
              <div className="relative flex items-center">
                <Mail size={16} className="absolute left-4 text-slate-600" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="EX: NOME@VIBRA.COM.BR"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-5 py-3 text-white placeholder-slate-700 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all font-sans text-xs uppercase"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Criar Senha Operacional</label>
              <div className="relative flex items-center">
                <Lock size={16} className="absolute left-4 text-slate-600" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="SENHA DE ACESSO"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-5 py-3 text-white placeholder-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono tracking-wider text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Confirmar Nova Senha</label>
              <div className="relative flex items-center">
                <Lock size={16} className="absolute left-4 text-slate-600" />
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="CONFIRMAÇÃO"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-5 py-3 text-white placeholder-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all font-mono tracking-wider text-xs"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-[0.12em] text-[11px] py-4 rounded-xl transition-all mt-4 flex justify-center items-center disabled:opacity-50 shadow-lg shadow-amber-500/10 active:scale-[0.98] cursor-pointer"
            >
              {loading ? <Loader2 size={18} className="animate-spin text-slate-950" /> : 'Cadastrar Senha e Entrar'}
            </button>
          </form>
        )}

        <div className="mt-8 text-center relative z-10">
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
