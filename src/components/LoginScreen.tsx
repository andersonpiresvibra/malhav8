import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { PlaneTakeoff, Loader2 } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [warName, setWarName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              war_name: warName.toUpperCase()
            }
          }
        });
        if (error) throw error;
        
        if (data.user && data.session === null) {
          setMessage('Cadastro realizado! Verifique seu email para confirmar.');
        } else {
          setMessage('Cadastro realizado com sucesso!');
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let errorMessage = err.message || 'Ocorreu um erro durante a autenticação.';
      if (errorMessage === 'Invalid login credentials') {
        errorMessage = 'Email ou senha incorretos.';
      } else if (errorMessage === 'Email not confirmed') {
        errorMessage = 'Email não confirmado. Se você acabou de desativar a confirmação no Supabase, exclua o usuário lá e crie de novo, ou acesse o SQL Editor do Supabase e rode: UPDATE auth.users SET email_confirmed_at = now();';
      } else if (errorMessage === 'User already registered') {
        errorMessage = 'Este email já está cadastrado.';
      } else if (errorMessage === 'Password should be at least 6 characters') {
         errorMessage = 'A senha deve ter pelo menos 6 caracteres.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800 rounded-lg shadow-2xl border border-slate-700 p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-500 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
            <PlaneTakeoff size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-wider">JETFUEL OPS</h1>
          <p className="text-slate-400 text-sm mt-2 uppercase tracking-widest font-bold">
            Acesso de Líderes
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-md mb-6 font-medium text-center">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-500 text-sm p-3 rounded-md mb-6 font-medium text-center">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nome de Guerra</label>
              <input 
                type="text" 
                value={warName}
                onChange={(e) => setWarName(e.target.value)}
                required={!isLogin}
                placeholder="Ex: SILVA"
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-4 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors uppercase"
              />
            </div>
          )}
          
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Email Corporativo</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="lt@empresa.com.br"
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-4 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Senha</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-4 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-sm py-3 rounded-md transition-colors mt-6 flex justify-center items-center disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : (isLogin ? 'ENTRAR' : 'CADASTRAR')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); }}
            className="text-slate-400 text-xs font-bold uppercase hover:text-white transition-colors"
          >
            {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça Login'}
          </button>
        </div>
      </div>
    </div>
  );
};
