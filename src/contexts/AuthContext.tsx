import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: any;
  session: any;
  loading: boolean;
  signOut: () => Promise<void>;
  warName: string;
  loginWithWarName: (name: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  warName: '',
  loginWithWarName: async () => ({ success: false }),
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for virtual session first
    const savedVirtualUser = localStorage.getItem('virtual_user');
    if (savedVirtualUser) {
      const virtualUser = JSON.parse(savedVirtualUser);
      setUser(virtualUser);
      setSession({ user: virtualUser });
      setLoading(false);
      return;
    }

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginWithWarName = async (name: string) => {
    try {
      const { data, error } = await supabase
        .from('operadores_geral')
        .select('*')
        .ilike('war_name', name)
        .eq('is_lt', 'SIM')
        .limit(1)
        .single();

      if (error || !data) {
        return { success: false, error: 'Acesso negado. Apenas LTs (Líderes Técnicos) podem acessar o sistema.' };
      }

      const virtualUser = {
        id: data.id,
        email: data.email || `${data.war_name}@sistema.com.br`,
        user_metadata: {
          war_name: data.war_name,
          full_name: data.full_name,
          is_virtual: true
        }
      };

      setUser(virtualUser);
      setSession({ user: virtualUser });
      localStorage.setItem('virtual_user', JSON.stringify(virtualUser));
      
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao validar acesso.' };
    }
  };

  const signOut = async () => {
    localStorage.removeItem('virtual_user');
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const warName = user?.user_metadata?.war_name 
    || user?.email?.split('@')[0].toUpperCase() 
    || 'LT';

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, warName, loginWithWarName }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
