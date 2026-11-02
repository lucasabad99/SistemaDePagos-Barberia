import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './lib/toast';
import { App } from './App';
import { registrarServiceWorker } from './lib/pwa';
import './styles.css';

registrarServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
);
