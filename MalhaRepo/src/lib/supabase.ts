import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isInvalid = !supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('<project-ref>') || supabaseUrl === 'https://placeholder.supabase.co';

// Sempre criar um client válido pro módulo não quebrar o app inteiro durante a inicialização,
// mas exibir uma mensagem de erro robusta na tela usando o proxy de métodos do supabase, ou lidar com isso na UI.
const validUrl = isInvalid ? 'https://is-invalid.supabase.co' : supabaseUrl;
const validKey = isInvalid ? 'invalid-key' : supabaseAnonKey;

export const supabase = createClient(validUrl, validKey);

// Uma função auxiliar para verificar na UI
export const isSupabaseConfigured = () => !isInvalid;

