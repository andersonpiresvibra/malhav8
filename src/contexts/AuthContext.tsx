import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: any;
  session: any;
  loading: boolean;
  signOut: () => Promise<void>;
  warName: string;
  loginWithWarName: (name: string) => Promise<{ success: boolean; error?: string; step?: 'password' | 'first_login'; defaultEmail?: string }>;
  completeFirstLogin: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithPassword: (name: string, password: string) => Promise<{ success: boolean; error?: string }>;
  isUsuario: boolean;
  isAdministrador: boolean;
  isMaster: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  warName: '',
  loginWithWarName: async () => ({ success: false }),
  completeFirstLogin: async () => ({ success: false }),
  loginWithPassword: async () => ({ success: false }),
  isUsuario: false,
  isAdministrador: false,
  isMaster: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for virtual session first
    const savedVirtualUser = localStorage.getItem('virtual_user');
    if (savedVirtualUser) {
      try {
        const virtualUser = JSON.parse(savedVirtualUser);
        setUser(virtualUser);
        setSession({ user: virtualUser });
        setLoading(false);
      } catch (e) {
        localStorage.removeItem('virtual_user');
      }
    } else {
      // Check active session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!localStorage.getItem('virtual_user')) {
          setSession(session);
          setUser(session?.user ?? null);
        }
        setLoading(false);
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (localStorage.getItem('virtual_user')) {
        // If we have a virtual session, ONLY clear it if it's an explicit SIGNED_IN event
        // and the session user is a real non-virtual user. This prevents INITIAL_SESSION
        // auto-recovery of stale/other standard sessions from destroying the active virtual user session.
        if (session && event === 'SIGNED_IN') {
          const isVirtual = session.user?.user_metadata?.is_virtual;
          if (!isVirtual) {
            localStorage.removeItem('virtual_user');
            setSession(session);
            setUser(session.user);
            setLoading(false);
          }
        }
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const [dbUserRoles, setDbUserRoles] = useState<{ isUsuario: boolean; isAdministrador: boolean; isMaster: boolean } | null>(null);

  useEffect(() => {
    if (user) {
      const name = user.user_metadata?.war_name || user.email?.split('@')[0].toUpperCase();
      const email = user.email;

      const fetchRoles = async () => {
        try {
          // 1. Tenta buscar por e-mail primeiro (utilizadores reais autenticados)
          if (email) {
            const { data: rawData, error } = await supabase
              .from('operadores_geral')
              .select('is_usuario, is_administrador, is_master, is_lt')
              .ilike('email', email)
              .maybeSingle();

            const data = rawData as any;
            if (!error && data) {
              const hasUsuarioCol = 'is_usuario' in data;
              setDbUserRoles({
                isUsuario: hasUsuarioCol ? !!data.is_usuario : (data.is_lt === 'SIM'),
                isAdministrador: !!data.is_administrador,
                isMaster: !!data.is_master
              });
              return;
            }
          }

          // 2. Se não encontrar ou não tiver e-mail, tenta buscar por war_name (compatibilidade/usuarios virtuais)
          if (name) {
            const { data: rawData, error } = await supabase
              .from('operadores_geral')
              .select('is_usuario, is_administrador, is_master, is_lt')
              .ilike('war_name', name)
              .maybeSingle();

            const data = rawData as any;
            if (!error && data) {
              const hasUsuarioCol = 'is_usuario' in data;
              setDbUserRoles({
                isUsuario: hasUsuarioCol ? !!data.is_usuario : (data.is_lt === 'SIM'),
                isAdministrador: !!data.is_administrador,
                isMaster: !!data.is_master
              });
              return;
            }
          }

          setDbUserRoles(null);
        } catch (err) {
          console.error("Erro ao obter funções do usuário no banco:", err);
          setDbUserRoles(null);
        }
      };

      fetchRoles();
    } else {
      setDbUserRoles(null);
    }
  }, [user]);

  const isCurrentUserOwner = user?.email === 'andersonpires.vibra@gmail.com';

  const isUsuario = isCurrentUserOwner || (dbUserRoles?.isUsuario ?? (user?.user_metadata?.is_usuario ?? (user?.user_metadata?.is_lt === 'SIM' || false)));
  const isAdministrador = isCurrentUserOwner || (dbUserRoles?.isAdministrador ?? (user?.user_metadata?.is_administrador ?? false));
  const isMaster = isCurrentUserOwner || (dbUserRoles?.isMaster ?? (user?.user_metadata?.is_master ?? false));

  // Helper to determine if an operator is an LT or Senior Operator
  const isLtOrSenior = (operator: any): boolean => {
    if (!operator) return false;
    const isLTValue = String(operator.is_lt || '').toUpperCase() === 'SIM';
    const roleValue = String(operator.role || '').toUpperCase();
    const categoryValue = String(operator.category || '').toUpperCase();
    const isSenior = roleValue.includes('SENIOR') || roleValue.includes('SÊNIOR') || roleValue.includes('SR') ||
                     categoryValue.includes('SENIOR') || categoryValue.includes('SÊNIOR') || categoryValue.includes('SR');
    return isLTValue || isSenior || !!operator.is_administrador || !!operator.is_master;
  };

  const buildVirtualUser = (data: any, dbIsUsuario: boolean, dbIsAdmin: boolean, dbIsMaster: boolean) => {
    return {
      id: data.id,
      email: data.email || `${data.war_name}@sistema.com.br`,
      user_metadata: {
        war_name: data.war_name,
        full_name: data.full_name,
        is_virtual: true,
        is_usuario: dbIsUsuario,
        is_administrador: dbIsAdmin,
        is_master: dbIsMaster
      }
    };
  };

  const loginWithWarName = async (name: string) => {
    try {
      const { data, error } = await supabase
        .from('operadores_geral')
        .select('*')
        .ilike('war_name', name)
        .limit(1)
        .single();

      if (error || !data) {
        return { success: false, error: 'Acesso negado. Usuário não encontrado no sistema.' };
      }

      const hasUsuarioCol = 'is_usuario' in data;
      const dbIsUsuario = hasUsuarioCol ? !!data.is_usuario : (data.is_lt === 'SIM');
      const dbIsAdmin = !!data.is_administrador;
      const dbIsMaster = !!data.is_master;

      if (!dbIsUsuario && !dbIsAdmin && !dbIsMaster) {
        return { success: false, error: 'Acesso negado. Usuário sem permissões autorizadas para acessar o sistema.' };
      }

      // Check if this user qualifies as LT or Senior Operator
      if (isLtOrSenior(data)) {
        const hasPasswordColumn = 'password' in data;
        if (!hasPasswordColumn) {
          console.warn("A coluna 'password' não existe na tabela 'operadores_geral'. Faça o ALTER correspondente.");
          // Backwards compatibility fallback if ALTER TABLE not run yet
          const virtualUser = buildVirtualUser(data, dbIsUsuario, dbIsAdmin, dbIsMaster);
          setUser(virtualUser);
          setSession({ user: virtualUser });
          localStorage.setItem('virtual_user', JSON.stringify(virtualUser));
          return { success: true };
        }

        // If password hasn't been defined yet: it is first login
        if (!data.password || data.password.trim() === '') {
          return { success: true, step: 'first_login', defaultEmail: data.email || '' };
        }

        // Must submit password
        return { success: true, step: 'password' };
      }

      // If they are regular operators (not LT, not Senior), use the legacy passwordless bypass
      const virtualUser = buildVirtualUser(data, dbIsUsuario, dbIsAdmin, dbIsMaster);
      setUser(virtualUser);
      setSession({ user: virtualUser });
      localStorage.setItem('virtual_user', JSON.stringify(virtualUser));
      
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao validar acesso.' };
    }
  };

  const loginWithPassword = async (name: string, password: string) => {
    try {
      const { data, error } = await supabase
        .from('operadores_geral')
        .select('*')
        .ilike('war_name', name)
        .limit(1)
        .single();

      if (error || !data) {
        return { success: false, error: 'Usuário não encontrado.' };
      }

      if (data.password !== password) {
        return { success: false, error: 'Senha inválida de identificação.' };
      }

      const hasUsuarioCol = 'is_usuario' in data;
      const dbIsUsuario = hasUsuarioCol ? !!data.is_usuario : (data.is_lt === 'SIM');
      const dbIsAdmin = !!data.is_administrador;
      const dbIsMaster = !!data.is_master;

      const virtualUser = buildVirtualUser(data, dbIsUsuario, dbIsAdmin, dbIsMaster);
      setUser(virtualUser);
      setSession({ user: virtualUser });
      localStorage.setItem('virtual_user', JSON.stringify(virtualUser));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao efetuar login.' };
    }
  };

  const completeFirstLogin = async (name: string, email: string, password: string) => {
    try {
      const { data: operator, error: fetchError } = await supabase
        .from('operadores_geral')
        .select('*')
        .ilike('war_name', name)
        .limit(1)
        .single();

      if (fetchError || !operator) {
        return { success: false, error: 'Usuário não encontrado.' };
      }

      // Update email and password
      const { error: updateError } = await supabase
        .from('operadores_geral')
        .update({
          email: email.trim(),
          password: password.trim()
        })
        .eq('id', operator.id);

      if (updateError) {
        return { success: false, error: `Falha ao salvar senha e email: ${updateError.message}` };
      }

      const hasUsuarioCol = 'is_usuario' in operator;
      const dbIsUsuario = hasUsuarioCol ? !!operator.is_usuario : (operator.is_lt === 'SIM');
      const dbIsAdmin = !!operator.is_administrador;
      const dbIsMaster = !!operator.is_master;

      const virtualUser = buildVirtualUser({ ...operator, email, password }, dbIsUsuario, dbIsAdmin, dbIsMaster);
      setUser(virtualUser);
      setSession({ user: virtualUser });
      localStorage.setItem('virtual_user', JSON.stringify(virtualUser));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao efetuar cadastro inicial.' };
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
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      signOut, 
      warName, 
      loginWithWarName, 
      completeFirstLogin, 
      loginWithPassword, 
      isUsuario, 
      isAdministrador, 
      isMaster 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
