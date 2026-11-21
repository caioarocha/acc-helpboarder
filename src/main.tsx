import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import { AuthGate } from './components/AuthGate';
import { installLockInterceptor } from './auth';
import './styles.css';

// Se a sessão expirar no meio do uso, qualquer chamada bloqueada volta para a tela de digital
installLockInterceptor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthGate>
        <App />
      </AuthGate>
    </BrowserRouter>
  </StrictMode>,
);
