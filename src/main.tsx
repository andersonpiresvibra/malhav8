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
