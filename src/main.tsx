import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

// Safe alert override to prevent uncaught sandbox iframe exceptions
if (typeof window !== 'undefined') {
  const originalAlert = window.alert;
  window.alert = function (message) {
    try {
      console.log('[App Alert]:', message);
      originalAlert(message);
    } catch (e) {
      console.warn('[App Alert Blocked by Sandbox IFrame]:', message, e);
    }
  };

  // Safe localStorage interceptor to prevent QuotaExceededError crashes across the entire app
  if (typeof Storage !== 'undefined') {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      try {
        originalSetItem.call(this, key, value);
      } catch (error: any) {
        const isQuotaError = error.name === 'QuotaExceededError' || 
                             error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
                             (error.message && error.message.includes('exceeded the quota'));
        if (isQuotaError) {
          console.warn(`[Storage Interceptor] Cota esgotada ao gravar chave '${key}'. Limpando caches de voos e dados do Supabase para liberar espaço...`);
          try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < this.length; i++) {
              const k = this.key(i);
              if (k && (k.startsWith('supabase_cache_') || k.startsWith('meshFlights') || k.startsWith('globalFlights'))) {
                keysToRemove.push(k);
              }
            }
            keysToRemove.forEach(k => this.removeItem(k));
            console.warn(`[Storage Interceptor] ${keysToRemove.length} chaves de cache removidas. Tentando gravar novamente...`);
            
            // Re-tenta a gravação após limpar caches
            originalSetItem.call(this, key, value);
            console.log(`[Storage Interceptor] Gravado com sucesso (chave: '${key}') após a limpeza de cota.`);
          } catch (retryError) {
            console.warn(`[Storage Interceptor] Falha persistente ao gravar chave '${key}' após limpeza de cota. Ignorando para preservar o fluxo do sistema.`, retryError);
          }
        } else {
          console.warn(`[Storage Interceptor] Interceptada e ignorada exceção de Storage não relacionada a cota para fins de resiliência (chave: '${key}').`, error);
        }
      }
    };
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
